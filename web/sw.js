// Vaidya Ashwani Live Call Translator – service worker (app ko install-able + fast banata hai)
const CACHE = 'vaidya-lct-v5';
const FILES = ['./', './index.html', './style.css', './app.js', './admin.js', './firebase-config.js', './languages.js', './manifest.json', './privacy.html',
  './lib/peerjs.min.js', './lib/html2pdf.bundle.min.js', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;   // translation / TTS / call – hamesha live
  e.respondWith(
    fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request))
  );
});
