const CACHE = 'kitaplik-v67';
// OCR paketi kovası (ocr.js yönetir): ~6 MB'lik tesseract paketi kullanıcı
// ONAYIYLA bir kez iner, buraya alınır. ASSETS'e BİLEREK girmez — ilk PWA
// kurulumunda 6 MB indirtmek yanlış olurdu. ocr.js dosyasının kendisi (küçük
// arayüz kodu) ASSETS'te; ocr/ altındaki paket dosyaları DEĞİL.
const OCR_KOVA = 'kk_ocr_paket_v1';
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png', './senkron.js', './barkod.js', './oturum.js', './fikir.js', './katalog.js', './gorunum.js', './kart.js', './zeka.js', './fikirag.js', './rapor.js', './kapak.js', './oneri.js', './kesfet.js', './tekrar.js', './ocr.js', './bildirim.js', './zengin.js', './zxing.min.js', './font/cormorant-latin.woff2', './font/cormorant-latin-ext.woff2', './font/lora-latin.woff2', './font/lora-latin-ext.woff2', './font/lora-italik-latin.woff2', './font/lora-italik-latin-ext.woff2'];

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

/* ---------- push bildirimi (bildirim.js ile ortak sözleşme) ----------
   GİZLİLİK: push PAYLOAD'SIZ gelir — sunucu yalnız "uyan" der. Bildirim
   içeriği bildirim.js'in IndexedDB'ye yazdığı özetten üretilir; alıntı
   metni sunucuya hiç gitmediği için burada da ağa hiçbir şey yazılmaz.
   Özet SAYI değil VADE listesi taşır: "bugün kaç alıntı" sayımı push
   ANINDA yapılır — gece yarısı devrinde bayat sayı gösterilmez. */
const BILDIRIM_DB = 'kk_bildirim_v1';
function bildirimOzetOku() {
  return new Promise(resolve => {
    let bitti = false;
    const son = v => { if (!bitti) { bitti = true; resolve(v); } };
    try {
      const istek = indexedDB.open(BILDIRIM_DB, 1);
      istek.onupgradeneeded = () => { try { istek.result.createObjectStore('ozet'); } catch (e) {} };
      istek.onsuccess = () => {
        const db = istek.result;
        try {
          const g = db.transaction('ozet', 'readonly').objectStore('ozet').get('guncel');
          g.onsuccess = () => { son(g.result || null); try { db.close(); } catch (e) {} };
          g.onerror = () => { son(null); try { db.close(); } catch (e) {} };
        } catch (e) { son(null); try { db.close(); } catch (h) {} }
      };
      istek.onerror = () => son(null);
    } catch (e) { son(null); }
  });
}
function bildirimGunIso() {
  const s = new Date();
  return s.getFullYear() + '-' + String(s.getMonth() + 1).padStart(2, '0') +
    '-' + String(s.getDate()).padStart(2, '0');
}
self.addEventListener('push', e => {
  e.waitUntil(bildirimOzetOku().then(ozet => {
    /* KARAR: özet yoksa ya da bugün vadesi gelen alıntı yoksa SESSİZ kalınır.
       Ana kapı sunucuda (vade gelmemişse hiç gönderilmez); burası yalnız
       savunma dalı. Yanlış "seni bekleyen alıntı var" bildirimi güveni
       yakar; Chrome'un nadir sessiz-push cezası (jenerik bildirim) bu
       nadirlikte kabul edilen maliyet. */
    if (!ozet || !Array.isArray(ozet.vadeler)) return;
    const bugun = bildirimGunIso();
    const sayi = ozet.vadeler.filter(v => v && v <= bugun).length;
    if (!sayi) return;
    return self.registration.showNotification(
      sayi === 1 ? '1 alıntı seni bekliyor' : sayi + ' alıntı seni bekliyor', {
        body: ozet.ornekMetin || 'Bugünün tekrar kuyruğu hazır.',
        tag: 'kitaplik-tekrar',           // aynı günkü ikinci push üst üste binmez
        icon: './icon-192.png',
        badge: './icon-192.png',
        data: { hedef: './index.html?sekme=alinti' }
      });
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(liste => {
    for (const istemci of liste) {
      let ayni = false;
      try { ayni = new URL(istemci.url).origin === self.location.origin; } catch (h) {}
      if (ayni) {
        // açık sekme: odakla + sayfaya "Alıntılar sekmesine geç" mesajı yolla
        istemci.postMessage({ tur: 'tekrar-ac' });
        return istemci.focus();
      }
    }
    // kapalıysa mevcut derin bağlantı deseniyle aç (?sekme= boot'ta işlenir)
    return self.clients.openWindow('./index.html?sekme=alinti');
  }));
});
