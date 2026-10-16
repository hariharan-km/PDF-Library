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

    let cleanName = String(newFilename).trim().split(/[\\/]/).pop();
    if (!cleanName.toLowerCase().endsWith('.pdf')) {
      cleanName += '.pdf';
    }

    if (cleanName === '.pdf' || cleanName.length < 5) {
      return res.status(400).json({ error: 'Please enter a valid filename.' });
    }

    const targetUrl = url.split('?')[0];

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
