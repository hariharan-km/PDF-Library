import { put } from '@vercel/blob';

const MIME_MAP = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  ico: 'image/x-icon',
  bmp: 'image/bmp'
};

export default async function handler(req, res) {
  if (!process.env.UPLOAD_PASSWORD) {
    return res.status(503).json({ error: 'Set UPLOAD_PASSWORD in Vercel project settings first.' });
  }
  if (req.headers.authorization !== `Bearer ${process.env.UPLOAD_PASSWORD}`) {
    return res.status(401).json({ error: 'Access code is incorrect.' });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const filename = String(req.query.filename || '').split(/[\\/]/).pop();
  const ext = (filename.split('.').pop() || '').toLowerCase();
  const detectedContentType = MIME_MAP[ext];

  if (!detectedContentType) {
    return res.status(400).json({
      error: 'Only PDF documents and image files (PNG, JPG, WEBP, GIF, SVG, AVIF) can be uploaded.'
    });
  }

  // Use valid client header contentType or detected contentType from extension
  const headerType = req.headers['content-type'];
  const contentType = (headerType && (headerType.startsWith('image/') || headerType === 'application/pdf'))
    ? headerType
    : detectedContentType;

  try {
    const blob = await put(filename, req, {
      access: 'private',
      addRandomSuffix: true,
      contentType
    });
    return res.status(200).json(blob);
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: 'Upload failed. Keep files under 4 MB and try again.' });
  }
}

export const config = {
  api: {
    bodyParser: false
  }
};
