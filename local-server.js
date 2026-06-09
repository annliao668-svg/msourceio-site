const http = require('http');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname);
const port = process.env.PORT || 3000;

function contentType(ext) {
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.txt': 'text/plain; charset=utf-8'
    }[ext] || 'application/octet-stream'
  );
}

function sendJson(res, obj, status = 200) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Accept'
  });
  res.end(body);
}

function validatePayload(payload) {
  const required = ['fullName', 'emailAddress', 'message'];
  for (const f of required) {
    if (!String(payload?.[f] || '').trim()) return { ok: false, message: 'Please complete the required fields before submitting.' };
  }
  return { ok: true };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    console.log('Incoming', req.method, url.pathname);
    // Handle CORS preflight for the API when testing from file:// or other origins
    if (url.pathname === '/api/inquiry' && req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept'
      });
      res.end();
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/inquiry') {
      let body = '';
      for await (const chunk of req) body += chunk;
      let payload = {};
      try { payload = JSON.parse(body || '{}'); } catch(e) { return sendJson(res, { ok: false, message: 'Invalid JSON' }, 400); }

      // honeypot
      if (payload.website) return sendJson(res, { ok: true, message: 'Inquiry submitted successfully.' });

      const validation = validatePayload(payload);
      if (!validation.ok) return sendJson(res, { ok: false, message: validation.message }, 400);

      // Simulate sending email (mock)
      return sendJson(res, { ok: true, message: 'Inquiry submitted successfully. (local mock)' });
    }

    // Serve static files
    let pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const filePath = path.join(root, pathname);
    if (!filePath.startsWith(root)) { res.writeHead(403); res.end('Forbidden'); return; }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': contentType(ext) });
      fs.createReadStream(filePath).pipe(res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (error) {
    console.error('Server error', error);
    res.writeHead(500);
    res.end('Server error');
  }
});

server.listen(port, () => {
  console.log(`Local server running at http://localhost:${port}/`);
});
