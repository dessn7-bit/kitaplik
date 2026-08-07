const CACHE = 'kitaplik-v37';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png', './senkron.js', './barkod.js', './oturum.js', './fikir.js', './katalog.js', './gorunum.js', './kart.js', './zeka.js', './fikirag.js', './rapor.js', './kapak.js', './oneri.js', './tekrar.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // YALNIZ kendi kökenimiz cache'lenir. Dış kaynaklara (googleapis, firebasedatabase
  // — URL'inde auth token'ı var —, workers.dev, openlibrary, kapak CDN'leri) hiç
  // karışma: tarayıcı doğrudan gitsin, hiçbir şey saklanmasın.
  let ayniKoken = false;
  try { ayniKoken = new URL(e.request.url).origin === self.location.origin; } catch (h) {}
  if (!ayniKoken) return;

  e.respondWith(
    fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request).then(r => {
      if (r) return r;
      // index.html yedeği YALNIZ gezinme isteklerine. Eskiden her cache-miss'e HTML
      // dönüyordu: çevrimdışında kapak istekleri HTML alıp onerror yolunu tetikliyordu.
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      return new Response('', { status: 504, statusText: 'Cevrimdisi' });
    }))
  );
});
