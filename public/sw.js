// Erlekide service worker — sarea lehenetsi, cachea babes gisa
// Network-first con cache de respaldo para uso en el campo
'use strict';

const CACHE = 'erlekide-v2';
const PRECACHE = [
  '/',
  '/style.css',
  '/app.js',
  '/manifest.webmanifest',
  '/images/icon.svg',
  '/images/kaja.svg',
  '/images/nukleoa.svg',
  '/images/erlekide_bg2.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // API deiak eta kanpoko jatorriak (Supabase, CDN...) ez dira cacheatzen
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then(m => {
          if (m) return m;
          if (e.request.mode === 'navigate') return caches.match('/');
          return Response.error();
        })
      )
  );
});
