import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'gdrive-config.json');

function getGDriveConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (err) {
    console.error('Failed to read gdrive-config.json:', err.message);
  }

  return {
    client_id: process.env.GDRIVE_CLIENT_ID || '510699103498-lccq9hfvgg1mugjnj7td2cp7640kmrpc.apps.googleusercontent.com',
    client_secret: process.env.GDRIVE_CLIENT_SECRET || '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',
    refresh_token: process.env.GDRIVE_REFRESH_TOKEN || '1//0g4KFrHu2DzRgCgYIARAAGBASNwF-L9IrKvI6xdrd85KzyQYPs9qJxVx030b13cW3bMjKZN3vVoY_4SbKMLGQDgcaGyyz9tV9Kq0',
    photos_folder_id: process.env.GDRIVE_PHOTOS_FOLDER_ID || '12MZly0xY6H3o-Qx6AaBqtdaxOKBcTZ7p',
  };
}

let cachedAccessToken = null;
let tokenExpiresAt = 0;

/**
 * Get valid Google OAuth access token
 */
export async function getAccessToken() {
  const now = Date.now();
  if (cachedAccessToken && now < tokenExpiresAt - 60000) {
    return cachedAccessToken;
  }

  const config = getGDriveConfig();
  if (!config.refresh_token) {
    throw new Error('Google Drive refresh token is not configured');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: config.refresh_token,
      grant_type: 'refresh_token',
    }).toString(),
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    console.error('Failed to refresh Google Drive access token:', data);
    throw new Error(data.error_description || 'Gagal merefresh token Google Drive');
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
  return cachedAccessToken;
}

/**
 * Extract Google Drive file ID from standard drive URLs or raw ID strings
 */
export function extractDriveId(input) {
  if (!input) return null;
  const str = String(input).trim();

  // Pattern for /d/FILE_ID/ or id=FILE_ID
  const matchD = str.match(/\/d\/([a-zA-Z0-9_-]{25,})/);
  if (matchD) return matchD[1];

  const matchId = str.match(/[?&]id=([a-zA-Z0-9_-]{25,})/);
  if (matchId) return matchId[1];

  const matchUc = str.match(/\/uc\?.*id=([a-zA-Z0-9_-]{25,})/);
  if (matchUc) return matchUc[1];

  // If it's a plain alphanumeric ID (length ~ 25-50)
  if (/^[a-zA-Z0-9_-]{25,50}$/.test(str)) {
    return str;
  }

  return null;
}

/**
 * Generate best direct preview URLs for a Google Drive File ID
 */
export function getDriveImageUrls(driveId) {
  if (!driveId) return { previewUrl: '', fullUrl: '', proxyUrl: '' };
  return {
    proxyUrl: `/api/drive/image/${driveId}`,
    previewUrl: `https://lh3.googleusercontent.com/d/${driveId}`,
    fullUrl: `https://drive.google.com/uc?export=view&id=${driveId}`,
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${driveId}&sz=w800`,
  };
}

function sanitizePrefix(name) {
  if (!name) return 'UNNAMED_SITE';
  return String(name)
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '_')
    .toUpperCase();
}

/**
 * Search or create site subfolder inside FOTO_DEVICES root folder
 */
async function getOrCreateSiteFolder(sitePrefix, accessToken) {
  const config = getGDriveConfig();
  const parentFolderId = config.photos_folder_id || '12MZly0xY6H3o-Qx6AaBqtdaxOKBcTZ7p';
  const folderName = sanitizePrefix(sitePrefix);

  // 1. Search existing folder
  const query = `name = '${folderName}' and '${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`;
  
  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (searchRes.ok) {
    const searchData = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      return searchData.files[0].id;
    }
  }

  // 2. Create folder if not found
  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  });

  const createData = await createRes.json();
  if (!createRes.ok || !createData.id) {
    console.error('Failed to create site subfolder, falling back to parent folder:', createData);
    return parentFolderId;
  }

  return createData.id;
}

/**
 * Upload a photo buffer directly to Google Drive via Drive v3 API
 */
export async function uploadPhotoToDrive({ buffer, sitePrefix, deviceType, originalFilename = 'photo.jpg' }) {
  const token = await getAccessToken();
  const targetFolderId = await getOrCreateSiteFolder(sitePrefix, token);

  const ext = path.extname(originalFilename).toLowerCase() || '.jpg';
  const now = new Date();
  const jakartaDate = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).format(now).replace(' ', '_').replace(/:/g, '-');
  const timestamp = jakartaDate; // e.g. 2026-08-29_23-48-45
  const targetFileName = `${deviceType.toUpperCase()}_${timestamp}${ext}`;

  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  else if (ext === '.webp') mimeType = 'image/webp';
  else if (ext === '.gif') mimeType = 'image/gif';

  // Construct multipart body
  const boundary = '-------NOCR_UPLOAD_BOUNDARY_' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metadata = JSON.stringify({
    name: targetFileName,
    parents: [targetFolderId],
    description: `NOCR Evidence Photo for Site: ${sitePrefix} (${deviceType.toUpperCase()})`,
  });

  const header = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}${delimiter}Content-Type: ${mimeType}\r\n\r\n`;
  const headerBuf = Buffer.from(header, 'utf-8');
  const footerBuf = Buffer.from(closeDelimiter, 'utf-8');

  const multipartBody = Buffer.concat([headerBuf, buffer, footerBuf]);

  const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webContentLink,webViewLink', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
      'Content-Length': String(multipartBody.length),
    },
    body: multipartBody,
  });

  const uploadData = await uploadRes.json();
  if (!uploadRes.ok || !uploadData.id) {
    console.error('Google Drive Upload Error:', uploadData);
    throw new Error(uploadData.error?.message || 'Gagal mengunggah foto ke Google Drive');
  }

  const driveId = uploadData.id;

  // Make file readable for direct preview link
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${driveId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone',
      }),
    });
  } catch (permErr) {
    console.warn('Could not set public permission on uploaded file:', permErr.message);
  }

  const urls = getDriveImageUrls(driveId);

  return {
    success: true,
    driveId,
    fileName: targetFileName,
    remotePath: `${sanitizePrefix(sitePrefix)}/${targetFileName}`,
    url: urls.proxyUrl || urls.previewUrl,
    thumbnailUrl: urls.thumbnailUrl,
    previewUrl: urls.previewUrl,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Delete a photo from Google Drive by driveId or remotePath
 */
export async function deletePhotoFromDrive(driveIdOrPath) {
  if (!driveIdOrPath) return;

  try {
    const driveId = extractDriveId(driveIdOrPath) || driveIdOrPath;
    const token = await getAccessToken();

    await fetch(`https://www.googleapis.com/drive/v3/files/${driveId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (err) {
    console.error('Failed to delete photo from Google Drive:', err.message);
  }
}

/**
 * Stream photo buffer from Google Drive using Drive API v3
 */
export async function getPhotoBufferFromDrive(driveId) {
  // Strategy 1: Try authenticated Google Drive v3 API
  try {
    const token = await getAccessToken();
    const fetchUrl = `https://www.googleapis.com/drive/v3/files/${driveId}?alt=media`;
    const response = await fetch(fetchUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > 0) return Buffer.from(arrayBuffer);
    }
  } catch (_) {}

  // Strategy 2: Try public thumbnail HD lh3.googleusercontent.com
  try {
    const lh3Url = `https://lh3.googleusercontent.com/d/${driveId}`;
    const lh3Resp = await fetch(lh3Url);
    if (lh3Resp.ok) {
      const arrayBuffer = await lh3Resp.arrayBuffer();
      if (arrayBuffer.byteLength > 0) return Buffer.from(arrayBuffer);
    }
  } catch (_) {}

  // Strategy 3: Try Google Drive thumbnail endpoint
  try {
    const thumbUrl = `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`;
    const thumbResp = await fetch(thumbUrl);
    if (thumbResp.ok) {
      const arrayBuffer = await thumbResp.arrayBuffer();
      if (arrayBuffer.byteLength > 0) return Buffer.from(arrayBuffer);
    }
  } catch (_) {}

  // Strategy 4: Try uc export download
  try {
    const ucUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
    const ucResp = await fetch(ucUrl);
    if (ucResp.ok) {
      const arrayBuffer = await ucResp.arrayBuffer();
      if (arrayBuffer.byteLength > 0) return Buffer.from(arrayBuffer);
    }
  } catch (_) {}

  throw new Error('Gagal mendownload gambar dari link Google Drive');
}
