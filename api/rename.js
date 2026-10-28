import { copy, del } from '@vercel/blob';

function authorized(req, res) {
  if (!process.env.UPLOAD_PASSWORD) {
    res.status(503).json({ error: 'Set UPLOAD_PASSWORD in Vercel project settings first.' });
    return false;
  }
  if (req.headers.authorization !== `Bearer ${process.env.UPLOAD_PASSWORD}`) {
    res.status(401).json({ error: 'Access code is incorrect.' });
    return false;
  }
  return true;
}

const ALLOWED_EXTS = [
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'md', 'json',
  'png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif', 'ico', 'bmp'
];

export default async function handler(req, res) {
  if (!authorized(req, res)) return;
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }
    const { url, newFilename } = body || {};

    if (!url || !newFilename) {
      return res.status(400).json({ error: 'Both file URL and new filename are required.' });
    }

    const targetUrl = url.split('?')[0];
    let oldExt = '';
    try {
      const parsedPath = new URL(targetUrl).pathname;
      oldExt = (parsedPath.split('.').pop() || '').toLowerCase();
    } catch (_) {
      oldExt = (targetUrl.split('.').pop() || '').toLowerCase();
    }

    let cleanName = String(newFilename).trim().split(/[\\/]/).pop();
    const dotIndex = cleanName.lastIndexOf('.');
    const hasExt = dotIndex > 0 && dotIndex < cleanName.length - 1;

    if (!hasExt) {
      // Retain the old extension if user didn't enter one
      if (oldExt && ALLOWED_EXTS.includes(oldExt)) {
        cleanName += `.${oldExt}`;
      } else {
        cleanName += '.pdf';
      }
    } else {
      const newExt = cleanName.slice(dotIndex + 1).toLowerCase();
      if (!ALLOWED_EXTS.includes(newExt)) {
        return res.status(400).json({
          error: `Extension .${newExt} is not supported. Allowed: PDF and images (${ALLOWED_EXTS.join(', ')}).`
        });
      }
    }

    if (cleanName.length < 3) {
      return res.status(400).json({ error: 'Please enter a valid filename.' });
    }

    // 1. Copy the blob to the new pathname with private access
    const newBlob = await copy(targetUrl, cleanName, {
      access: 'private',
      addRandomSuffix: true
    });

    // 2. Delete the old blob
    await del(targetUrl);

    return res.status(200).json({ success: true, blob: newBlob });
  } catch (error) {
    console.error('Rename error:', error);
    return res.status(500).json({ error: error.message || 'Failed to rename file in Vercel Blob.' });
  }
}
