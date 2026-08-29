import { NextResponse } from 'next/server';
import db from '@/lib/dbClient';
import { uploadPhotoToDrive, deletePhotoFromDrive, extractDriveId, getDriveImageUrls, getPhotoBufferFromDrive } from '@/lib/gdrivePhotos';

export async function GET(request, { params }) {
  const { ruijie_mac } = await params;
  const mac = decodeURIComponent(ruijie_mac || '');

  try {
    const { data: site, error } = await db
      .from('sites')
      .select('id, ruijie_mac, evidence_photos')
      .eq('ruijie_mac', mac)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({
      success: true,
      ruijie_mac: mac,
      evidence_photos: site?.evidence_photos || {},
    });
  } catch (err) {
    console.error('Error fetching evidence photos:', err);
    return NextResponse.json({ error: err.message || 'Gagal memuat evidence foto' }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  const { ruijie_mac } = await params;
  const mac = decodeURIComponent(ruijie_mac || '');

  try {
    // 1. Dapatkan info site / mapping untuk nama prefix
    const { data: mapping } = await db
      .from('device_mappings')
      .select('prefix, ruijie_alias')
      .eq('ruijie_mac', mac)
      .maybeSingle();

    let sitePrefix = mapping?.prefix || mapping?.ruijie_alias || mac;

    // 2. Dapatkan site yang sudah ada atau buat baru
    let { data: site } = await db
      .from('sites')
      .select('id, evidence_photos')
      .eq('ruijie_mac', mac)
      .maybeSingle();

    if (!site) {
      const { data: newSite, error: insErr } = await db
        .from('sites')
        .insert({
          ruijie_mac: mac,
          connection_type: 'l2tp',
          evidence_photos: {},
        })
        .select('id, evidence_photos')
        .single();
      if (insErr) throw insErr;
      site = newSite;
    }

    const currentEvidence = site?.evidence_photos || {};

    const contentType = request.headers.get('content-type') || '';

    // Handle Multipart Form Data (File Upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file');
      const deviceType = (formData.get('device_type') || 'ap').toLowerCase(); // ap | mikrotik | ont | panel

      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'File gambar tidak ditemukan' }, { status: 400 });
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      const originalFilename = file.name || `${deviceType}.jpg`;

      // Jika sebelumnya ada foto di slot ini, hapus foto lama di drive
      if (currentEvidence[deviceType]?.remote_path) {
        deletePhotoFromDrive(currentEvidence[deviceType].remote_path).catch(() => {});
      }

      // Upload ke Google Drive
      const uploadResult = await uploadPhotoToDrive({
        buffer,
        sitePrefix,
        deviceType,
        originalFilename,
      });

      const updatedEvidence = {
        ...currentEvidence,
        [deviceType]: {
          drive_id: uploadResult.driveId,
          file_name: uploadResult.fileName,
          remote_path: uploadResult.remotePath,
          url: uploadResult.url,
          preview_url: uploadResult.previewUrl,
          thumbnail_url: uploadResult.thumbnailUrl,
          proxy_url: `/api/drive/image/${uploadResult.driveId}`,
          updated_at: uploadResult.updatedAt,
        },
      };

      // Simpan ke PostgreSQL
      const { error: updErr } = await db
        .from('sites')
        .update({
          evidence_photos: updatedEvidence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', site.id);

      if (updErr) throw updErr;

      return NextResponse.json({
        success: true,
        message: `Foto ${deviceType.toUpperCase()} berhasil diunggah ke Google Drive`,
        evidence_photos: updatedEvidence,
      });
    }

    // Handle JSON (Manual Google Drive Link / ID / Image URL)
    const body = await request.json();
    const { device_type = 'ap', drive_url, custom_name } = body;
    const slot = device_type.toLowerCase();

    if (!drive_url) {
      return NextResponse.json({ error: 'URL Google Drive tidak boleh kosong' }, { status: 400 });
    }

    const driveId = extractDriveId(drive_url);
    if (!driveId && !drive_url.startsWith('http')) {
      return NextResponse.json({ error: 'Format link Google Drive tidak valid' }, { status: 400 });
    }

    // 3. Download dan salin file dari link eksternal ke folder Google Drive milik user (FOTO_DEVICES/<prefix>/)
    let uploadResult = null;
    try {
      let buffer = null;
      if (driveId) {
        buffer = await getPhotoBufferFromDrive(driveId);
      } else {
        const fetchResp = await fetch(drive_url);
        if (fetchResp.ok) {
          const arrBuf = await fetchResp.arrayBuffer();
          buffer = Buffer.from(arrBuf);
        }
      }

      if (buffer && buffer.length > 0) {
        // Hapus foto lama di drive jika ada
        if (currentEvidence[slot]?.remote_path) {
          deletePhotoFromDrive(currentEvidence[slot].remote_path).catch(() => {});
        }

        // Upload ke folder FOTO_DEVICES milik user di Google Drive
        uploadResult = await uploadPhotoToDrive({
          buffer,
          sitePrefix,
          deviceType: slot,
          originalFilename: custom_name || `${slot}.jpg`,
        });
      }
    } catch (copyErr) {
      console.warn('Gagal menyalin file dari link eksternal ke FOTO_DEVICES, fallback ke referensi langsung:', copyErr.message);
    }

    let updatedSlotData;
    if (uploadResult?.driveId) {
      updatedSlotData = {
        drive_id: uploadResult.driveId,
        file_name: uploadResult.fileName,
        remote_path: uploadResult.remotePath,
        url: uploadResult.url,
        preview_url: uploadResult.previewUrl,
        thumbnail_url: uploadResult.thumbnailUrl,
        proxy_url: `/api/drive/image/${uploadResult.driveId}`,
        raw_input: drive_url,
        updated_at: uploadResult.updatedAt,
      };
    } else {
      const urls = getDriveImageUrls(driveId);
      updatedSlotData = {
        drive_id: driveId,
        file_name: custom_name || `${slot.toUpperCase()}_MANUAL.jpg`,
        url: urls.proxyUrl || urls.previewUrl,
        preview_url: urls.previewUrl,
        thumbnail_url: urls.thumbnailUrl,
        proxy_url: urls.proxyUrl,
        raw_input: drive_url,
        updated_at: new Date().toISOString(),
      };
    }

    const updatedEvidence = {
      ...currentEvidence,
      [slot]: updatedSlotData,
    };

    const { error: updErr } = await db
      .from('sites')
      .update({
        evidence_photos: updatedEvidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', site.id);

    if (updErr) throw updErr;

    const savedLocationMsg = uploadResult?.remotePath
      ? `Foto ${slot.toUpperCase()} berhasil disalin dan disimpan ke folder Google Drive FOTO_DEVICES/${sitePrefix}`
      : `Link Google Drive untuk ${slot.toUpperCase()} berhasil disimpan`;

    return NextResponse.json({
      success: true,
      message: savedLocationMsg,
      evidence_photos: updatedEvidence,
    });

  } catch (err) {
    console.error('Error saving evidence photo:', err);
    return NextResponse.json({ error: err.message || 'Gagal menyimpan foto' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { ruijie_mac } = await params;
  const mac = decodeURIComponent(ruijie_mac || '');

  try {
    const { searchParams } = new URL(request.url);
    let deviceType = searchParams.get('device_type');

    if (!deviceType) {
      try {
        const body = await request.json();
        deviceType = body.device_type;
      } catch (_) {}
    }

    if (!deviceType) {
      return NextResponse.json({ error: 'device_type diperlukan (ap, mikrotik, ont, panel)' }, { status: 400 });
    }

    const slot = deviceType.toLowerCase();

    const { data: site } = await db
      .from('sites')
      .select('id, evidence_photos')
      .eq('ruijie_mac', mac)
      .maybeSingle();

    if (!site) {
      return NextResponse.json({ error: 'Site tidak ditemukan' }, { status: 404 });
    }

    const currentEvidence = site.evidence_photos || {};
    const photoToDelete = currentEvidence[slot];

    if (photoToDelete?.remote_path) {
      deletePhotoFromDrive(photoToDelete.remote_path).catch(() => {});
    }

    const updatedEvidence = { ...currentEvidence };
    delete updatedEvidence[slot];

    const { error: updErr } = await db
      .from('sites')
      .update({
        evidence_photos: updatedEvidence,
        updated_at: new Date().toISOString(),
      })
      .eq('id', site.id);

    if (updErr) throw updErr;

    return NextResponse.json({
      success: true,
      message: `Foto ${slot.toUpperCase()} berhasil dihapus`,
      evidence_photos: updatedEvidence,
    });
  } catch (err) {
    console.error('Error deleting evidence photo:', err);
    return NextResponse.json({ error: err.message || 'Gagal menghapus foto' }, { status: 500 });
  }
}
