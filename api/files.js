import { list, issueSignedToken, presignUrl } from '@vercel/blob';
function authorized(req, res) {
  if (!process.env.UPLOAD_PASSWORD) { res.status(503).json({ error: 'Set UPLOAD_PASSWORD in Vercel project settings first.' }); return false; }
  if (req.headers.authorization !== `Bearer ${process.env.UPLOAD_PASSWORD}`) { res.status(401).json({ error: 'Access code is incorrect.' }); return false; }
  return true;
}
export default async function handler(req, res) {
  if (!authorized(req, res)) return;
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method not allowed.' }); }
  try {
    const result = await list({ limit: 100 });
    const blobs = await Promise.all(result.blobs.map(async (blob) => {
      const validUntil = Date.now() + 15 * 60 * 1000;
      const token = await issueSignedToken({ pathname: blob.pathname, operations: ['get'], validUntil });
            // `presignUrl` needs the access mode to construct the Blob hostname.
      const { presignedUrl } = await presignUrl(token, { pathname: blob.pathname, operation: 'get', access: 'private', validUntil });
      return { ...blob, url: presignedUrl };
    }));
    return res.status(200).json({ files: blobs.sort((a,b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)) });
  } catch (error) { console.error(error); return res.status(500).json({ error: 'Could not load files from Vercel Blob.' }); }
}
