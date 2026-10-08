import { put } from '@vercel/blob';
export default async function handler(req, res) {
  if (!process.env.UPLOAD_PASSWORD) return res.status(503).json({ error: 'Set UPLOAD_PASSWORD in Vercel project settings first.' });
  if (req.headers.authorization !== `Bearer ${process.env.UPLOAD_PASSWORD}`) return res.status(401).json({ error: 'Access code is incorrect.' });
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method not allowed.' }); }
  const filename = String(req.query.filename || '').split(/[\\/]/).pop();
  if (!filename.toLowerCase().endsWith('.pdf') || req.headers['content-type'] !== 'application/pdf') return res.status(400).json({ error: 'Only PDF files can be uploaded.' });
  try {
    const blob = await put(filename, req, { access: 'private', addRandomSuffix: true, contentType: 'application/pdf' });
    return res.status(200).json(blob);
  } catch (error) { console.error(error); return res.status(500).json({ error: 'Upload failed. Keep files under 4 MB and try again.' }); }
}
export const config = { api: { bodyParser: false } };
