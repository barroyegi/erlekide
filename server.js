// Servidor local que replica las rutas de Vercel sin necesidad de login
// Uso: node server.js        (puerto 3000 por defecto)
//      PORT=4000 node server.js
'use strict';
const http  = require('http');
const fs    = require('fs');
const path  = require('path');
const url   = require('url');

// Cargar .env si existe
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  });
}

const PORT   = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext  = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', c => s += c);
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); } });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsed  = url.parse(req.url);
  const pathname = parsed.pathname;

  // ── /api/config ──────────────────────────────────────────────────────────
  if (pathname === '/api/config') {
    res.setHeader('Cache-Control', 'no-store');
    return json(res, 200, {
      supabaseUrl: process.env.SUPABASE_URL  || '',
      supabaseKey: process.env.SUPABASE_ANON_KEY || ''
    });
  }

  // ── /api/analyze ─────────────────────────────────────────────────────────
  if (pathname === '/api/analyze') {
    if (req.method !== 'POST') return json(res, 405, { error: 'Metodo hau ez da onartzen.' });

    const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!token) return json(res, 401, { error: 'Ez autentifikatua.' });

    // Verificar token con Supabase
    try {
      const userRes = await fetch(`${process.env.SUPABASE_URL}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY }
      });
      if (!userRes.ok) return json(res, 401, { error: 'Token baliogabea.' });
    } catch {
      return json(res, 401, { error: 'Token baliogabea.' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return json(res, 503, { error: 'ANTHROPIC_API_KEY ez dago konfiguratuta.' });

    const body = await readBody(req);
    if (!body.prompt) return json(res, 400, { error: 'prompt falta da.' });

    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 400,
          messages: [{ role: 'user', content: body.prompt }]
        })
      });
      const data = await r.json();
      if (data.error) return json(res, 502, { error: data.error.message });
      const text = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
      return json(res, 200, { text });
    } catch (e) {
      return json(res, 500, { error: 'Sare errorea: ' + e.message });
    }
  }

  // ── Fitxategi estatikoak / Static files ───────────────────────────────────
  // /images/* → public/images/*
  if (pathname.startsWith('/images/')) {
    return serveFile(res, path.join(PUBLIC, pathname));
  }

  // Todo lo demás → index.html (SPA)
  serveFile(res, path.join(PUBLIC, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`\n🐝  Erlekide — servidor local`);
  console.log(`   http://localhost:${PORT}\n`);
  console.log(`   SUPABASE_URL  : ${process.env.SUPABASE_URL  ? '✓ definido' : '✗ falta'}`);
  console.log(`   SUPABASE_ANON_KEY : ${process.env.SUPABASE_ANON_KEY ? '✓ definido' : '✗ falta'}`);
  console.log(`   ANTHROPIC_API_KEY : ${process.env.ANTHROPIC_API_KEY ? '✓ definido' : '— (IA desactivada)'}\n`);
});
