import { NextResponse } from 'next/server';
import { getPhotoBufferFromDrive } from '@/lib/gdrivePhotos';

export async function GET(request, { params }) {
  const { fileId } = await params;
  if (!fileId) {
    return new NextResponse('File ID is required', { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const isDownload = searchParams.get('download') === '1' || searchParams.has('download');
  const filename = searchParams.get('filename') || 'evidence_photo.jpg';

  try {
    const buffer = await getPhotoBufferFromDrive(fileId);

    // Determine basic mime type or fallback to jpeg
    let contentType = 'image/jpeg';
    if (buffer.length > 4) {
      if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
        contentType = 'image/png';
      } else if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) {
        contentType = 'image/gif';
      } else if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
        contentType = 'image/webp';
      }
    }

    const headers = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, immutable',
      'Content-Length': String(buffer.length),
    };

    if (isDownload) {
      headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(filename)}"`;
    }

    return new Response(buffer, {
      status: 200,
      headers,
    });
  } catch (err) {
    console.error('Error proxying Google Drive image:', err.message);
    // Fallback: Redirect to public thumbnail URL
    return NextResponse.redirect(`https://lh3.googleusercontent.com/d/${fileId}`, 302);
  }
}
