import { del } from '@vercel/blob';

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
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'POST, DELETE');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }
    const { url } = body || {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'File URL is required for deletion.' });
    }

    const targetUrl = url.split('?')[0];
    await del(targetUrl);
    return res.status(200).json({ success: true, message: 'File deleted successfully.' });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete file from Vercel Blob.' });
  }
}
