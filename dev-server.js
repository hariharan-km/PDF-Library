import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading local environment files
try { process.loadEnvFile(path.join(__dirname, '.env.local')); } catch (_) {}
try { process.loadEnvFile(path.join(__dirname, '.env')); } catch (_) {}

const PORT = process.env.PORT || 3000;
const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD || '1234';
process.env.UPLOAD_PASSWORD = UPLOAD_PASSWORD;

const LOCAL_STORAGE_DIR = path.join(__dirname, '.local_storage');
if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

const MIME_MAP = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.bmp': 'image/bmp'
};

const hasVercelBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

function checkAuth(req, res) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${UPLOAD_PASSWORD}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Access code is incorrect. Use: ' + UPLOAD_PASSWORD }));
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve index.html
  if (pathname === '/' || pathname === '/index.html') {
    const htmlPath = path.join(__dirname, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(htmlPath).pipe(res);
    return;
  }

  // Serve local files in fallback mode
  if (pathname.startsWith('/local-storage/')) {
    const filename = decodeURIComponent(pathname.replace('/local-storage/', ''));
    const safePath = path.join(LOCAL_STORAGE_DIR, path.basename(filename));
    if (fs.existsSync(safePath)) {
      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_MAP[ext] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${path.basename(safePath)}"`
      });
      fs.createReadStream(safePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
    }
    return;
  }

  // --- API Routes ---
  if (pathname === '/api/files' && req.method === 'GET') {
    if (!checkAuth(req, res)) return;

    if (hasVercelBlob) {
      try {
        const handler = (await import('./api/files.js')).default;
        return runVercelHandler(handler, req, res, parsedUrl);
      } catch (err) {
        console.error('Files error:', err);
      }
    }

    // Local Storage Fallback
    try {
      const dirFiles = fs.readdirSync(LOCAL_STORAGE_DIR);
      const list = dirFiles
        .filter(f => {
          const ext = path.extname(f).toLowerCase();
          return Boolean(MIME_MAP[ext]);
        })
        .map(name => {
          const stats = fs.statSync(path.join(LOCAL_STORAGE_DIR, name));
          return {
            pathname: name,
            url: `/local-storage/${encodeURIComponent(name)}`,
            blobUrl: `/local-storage/${encodeURIComponent(name)}`,
            size: stats.size,
            uploadedAt: stats.mtime.toISOString()
          };
        })
        .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ files: list }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    if (!checkAuth(req, res)) return;

    if (hasVercelBlob) {
      try {
        const handler = (await import('./api/upload.js')).default;
        return runVercelHandler(handler, req, res, parsedUrl);
      } catch (err) {
        console.error('Upload error:', err);
      }
    }

    // Local Storage Fallback
    const rawFilename = parsedUrl.searchParams.get('filename') || 'file';
    let cleanName = path.basename(rawFilename);
    let ext = path.extname(cleanName).toLowerCase();

    if (!ext) {
      const cType = req.headers['content-type'] || '';
      if (cType.includes('png')) ext = '.png';
      else if (cType.includes('jpeg') || cType.includes('jpg')) ext = '.jpg';
      else if (cType.includes('webp')) ext = '.webp';
      else if (cType.includes('gif')) ext = '.gif';
      else if (cType.includes('svg')) ext = '.svg';
      else ext = '.pdf';
      cleanName += ext;
    }

    if (!MIME_MAP[ext]) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `File extension ${ext} not supported. Allowed: PDF and images.` }));
      return;
    }

    const dest = path.join(LOCAL_STORAGE_DIR, cleanName);
    const writeStream = fs.createWriteStream(dest);

    req.pipe(writeStream);
    writeStream.on('finish', () => {
      const stats = fs.statSync(dest);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        pathname: cleanName,
        url: `/local-storage/${encodeURIComponent(cleanName)}`,
        size: stats.size,
        uploadedAt: new Date().toISOString()
      }));
    });
    writeStream.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  if (pathname === '/api/rename' && req.method === 'POST') {
    if (!checkAuth(req, res)) return;

    const body = await readJsonBody(req);
    if (hasVercelBlob) {
      try {
        req.body = body;
        const handler = (await import('./api/rename.js')).default;
        return runVercelHandler(handler, req, res, parsedUrl);
      } catch (err) {
        console.error('Rename error:', err);
      }
    }

    // Local Storage Fallback
    const { url, newFilename } = body || {};
    if (!url || !newFilename) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'url and newFilename are required' }));
      return;
    }

    const oldName = path.basename(decodeURIComponent(url.replace('/local-storage/', '')));
    const oldExt = path.extname(oldName).toLowerCase();
    let newClean = path.basename(newFilename.trim());

    if (!path.extname(newClean)) {
      newClean += oldExt;
    }
    const newExt = path.extname(newClean).toLowerCase();

    if (!MIME_MAP[newExt]) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Unsupported file extension "${newExt}". Allowed: PDF and images.` }));
      return;
    }

    const oldPath = path.join(LOCAL_STORAGE_DIR, oldName);
    const newPath = path.join(LOCAL_STORAGE_DIR, newClean);

    if (!fs.existsSync(oldPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Original file not found' }));
      return;
    }

    fs.renameSync(oldPath, newPath);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: `Renamed to ${newClean}` }));
    return;
  }

  if (pathname === '/api/delete' && (req.method === 'POST' || req.method === 'DELETE')) {
    if (!checkAuth(req, res)) return;

    const body = await readJsonBody(req);
    if (hasVercelBlob) {
      try {
        req.body = body;
        const handler = (await import('./api/delete.js')).default;
        return runVercelHandler(handler, req, res, parsedUrl);
      } catch (err) {
        console.error('Delete error:', err);
      }
    }

    // Local Storage Fallback
    const { url } = body || {};
    if (!url) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File url is required' }));
      return;
    }

    const targetName = path.basename(decodeURIComponent(url.replace('/local-storage/', '')));
    const targetPath = path.join(LOCAL_STORAGE_DIR, targetName);

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'File deleted' }));
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found on disk' }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch (_) { resolve({}); }
    });
  });
}

async function runVercelHandler(handler, req, res, parsedUrl) {
  req.query = Object.fromEntries(parsedUrl.searchParams.entries());
  const resProxy = {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(name, val) { this.headers[name] = val; return this; },
    json(obj) {
      res.writeHead(this.statusCode, { 'Content-Type': 'application/json', ...this.headers });
      res.end(JSON.stringify(obj));
    }
  };
  await handler(req, resProxy);
}

function startListening(port) {
  server.removeAllListeners('error');
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`⚠️ Port ${port} is already in use, trying port ${port + 1}...`);
      startListening(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
  server.listen(port, () => {
    console.log('----------------------------------------------------');
    console.log('🚀 PDF & Image Library Dev Server running!');
    console.log(`📍 URL: http://localhost:${port}`);
    console.log(`🔑 Access Code: ${UPLOAD_PASSWORD}`);
    console.log(`💾 Storage Mode: ${hasVercelBlob ? 'Connected to Vercel Blob' : 'Local Storage (.local_storage)'}`);
    console.log('----------------------------------------------------');
  });
}

startListening(PORT);
