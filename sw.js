const CACHE = 'kitaplik-v59';
// OCR paketi kovası (ocr.js yönetir): ~6 MB'lik tesseract paketi kullanıcı
// ONAYIYLA bir kez iner, buraya alınır. ASSETS'e BİLEREK girmez — ilk PWA
// kurulumunda 6 MB indirtmek yanlış olurdu. ocr.js dosyasının kendisi (küçük
// arayüz kodu) ASSETS'te; ocr/ altındaki paket dosyaları DEĞİL.
const OCR_KOVA = 'kk_ocr_paket_v1';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png', './senkron.js', './barkod.js', './oturum.js', './fikir.js', './katalog.js', './gorunum.js', './kart.js', './zeka.js', './fikirag.js', './rapor.js', './kapak.js', './oneri.js', './kesfet.js', './tekrar.js', './ocr.js', './zxing.min.js', './font/cormorant-latin.woff2', './font/cormorant-latin-ext.woff2', './font/lora-latin.woff2', './font/lora-latin-ext.woff2', './font/lora-italik-latin.woff2', './font/lora-italik-latin-ext.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      // OCR kovası sürüm temizliğinden MUAF: "k !== CACHE" filtresi onu da
      // silseydi her sw bump'ında kullanıcının onayla indirdiği 6 MB uçardı.
      Promise.all(keys.filter(k => k !== CACHE && k !== OCR_KOVA).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  // YALNIZ kendi kökenimiz cache'lenir. Dış kaynaklara (googleapis, firebasedatabase
  // — URL'inde auth token'ı var —, workers.dev, openlibrary, kapak CDN'leri) hiç
  // karışma: tarayıcı doğrudan gitsin, hiçbir şey saklanmasın.
  let ayniKoken = false;
  let yol = '';
  try { const u = new URL(e.request.url); ayniKoken = u.origin === self.location.origin; yol = u.pathname; } catch (h) {}
  if (!ayniKoken) return;

  // OCR paket dosyaları: ÖNCE kova, yoksa ağ. Network-first buraya uygulanmaz —
  // her kullanımda 6 MB'ı yeniden indirirdi; ana kovaya da YAZILMAZ (çift kopya).
  // Kova boşken (indirme onayı verilmemiş ya da paket silinmişken) istek ağa
  // düşer; indirme akışının kendisi de bu daldan geçer ve ocr.js kovaya yazar.
  if (yol.indexOf('/ocr/') !== -1) {
    e.respondWith(
      caches.open(OCR_KOVA).then(c => c.match(e.request)).then(r => r || fetch(e.request))
    );
    return;
  }

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
