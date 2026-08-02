'use strict';
/* G20 — worker/worker.js ve sw.js davranış testleri.

   YÖNTEM KARARI: ikisi de tarayıcı sayfası gerektirmiyor, bu yüzden Playwright'ın
   sayfa/ağ altyapısı yerine DOĞRUDAN NODE'da koşuyorlar:
   - worker.js zaten ESM: dinamik import + global fetch/caches taklidi yeterli.
   - sw.js klasik worker betiği (export yok): kaynağı okuyup kontrollü globallerle
     (self/caches/fetch/Response) çalıştırıyor, kaydedilen fetch dinleyicisini
     sahte event'lerle çağırıyoruz. Böylece ÜRETİMDEKİ dosyanın kendisi test edilir;
     ne sw.js'i test için yeniden şekillendirmek ne de ayrı bir SW-açık Playwright
     projesi kurmak gerekir (o proje her testte gerçek SW kaydı + cache temizliği
     isterdi, kırılgan ve yavaş olurdu).
   Sayfa kullanılmadığı için yardim.js'in ağ-denetimli `test`i yerine temel test
   kullanılıyor — bu dosyada hiçbir ağ çağrısı yok, hepsi taklit. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const KOK = path.join(__dirname, '..');

/* ================= M3: worker ================= */
function sahteYanit(govde, ok) {
  return { ok: ok !== false, status: ok === false ? 500 : 200,
    json: async () => govde, text: async () => (typeof govde === 'string' ? govde : JSON.stringify(govde)) };
}
const GR_YANIT = [{ bookTitleBare: 'Tanrı Yanılgısı', author: { name: 'Richard Dawkins' },
  numPages: 352, imageUrl: 'https://i.gr-assets.com/x.jpg' }];
const BK_HTML = '<script id="__NEXT_DATA__" type="application/json">'
  + JSON.stringify({ props: { liste: [{ adi: 'Tanrı Yanılgısı (Cep)', yazarAdi: 'Richard Dawkins',
      resim: 'https://1k-cdn.com/x.jpg', puan: 8.2 }] } }) + '</script>';

async function workerKos(url, ayar) {
  const a = ayar || {};
  const cacheKayit = [];
  global.caches = { default: {
    match: async () => (a.cacheHit ? sahteYanit({ sonuclar: ['onbellek'] }) : undefined),
    put: async (istek, yanit) => { cacheKayit.push({ url: istek.url, yanit }); }
  } };
  global.fetch = async (u) => {
    if (String(u).includes('goodreads.com')) {
      if (a.grHata) throw new Error('ag');
      return sahteYanit(a.grBos ? [] : GR_YANIT);
    }
    if (String(u).includes('1000kitap.com')) {
      if (a.bkHata) throw new Error('ag');
      return sahteYanit(a.bkBos ? '<html>bos</html>' : BK_HTML);
    }
    throw new Error('beklenmeyen adres: ' + u);
  };
  const mod = await import('file://' + path.join(KOK, 'worker', 'worker.js').replace(/\\/g, '/'));
  const bekleyenler = [];
  const yanit = await mod.default.fetch(new Request(url), {}, { waitUntil: p => bekleyenler.push(p) });
  await Promise.all(bekleyenler);
  return { yanit, govde: await yanit.json(), cacheKayit };
}

test.describe('G20 M3 — worker sessiz arıza önlemleri', () => {

  test('dolu sonuç cache\'lenir, kaynak sayaçları doğru', async () => {
    const { govde, cacheKayit, yanit } = await workerKos('https://x.dev/ara?q=tanri%20yanilgisi');
    expect(govde.sonuclar.length).toBeGreaterThan(0);
    expect(govde.kaynaklar).toEqual({ goodreads: 1, binkitap: 1 });
    expect(cacheKayit.length).toBe(1);                          // cache'lendi
    expect(yanit.headers.get('Cache-Control')).toContain('max-age=21600');
  });

  test('BOŞ sonuç cache\'lenMEZ', async () => {
    const { govde, cacheKayit, yanit } = await workerKos('https://x.dev/ara?q=bulunamayan',
      { grBos: true, bkBos: true });
    expect(govde.sonuclar).toEqual([]);
    expect(govde.kaynaklar).toEqual({ goodreads: 0, binkitap: 0 });
    expect(cacheKayit.length).toBe(0);                          // arıza kendini uzatmıyor
    expect(yanit.headers.get('Cache-Control')).toContain('no-store');
  });

  test('bir kaynak çökerse diğeri çalışmaya devam eder, sayaçta 0 görünür', async () => {
    const { govde, cacheKayit } = await workerKos('https://x.dev/ara?q=tanri%20yanilgisi',
      { bkHata: true });
    expect(govde.kaynaklar).toEqual({ goodreads: 1, binkitap: 0 });
    expect(govde.sonuclar.length).toBe(1);
    expect(cacheKayit.length).toBe(1);
  });

  test('/saglik ucu kaynak başına sayı ve süre döner, cache\'lenmez', async () => {
    const { govde, yanit, cacheKayit } = await workerKos('https://x.dev/saglik');
    expect(govde.goodreads).toBe(1);
    expect(govde.binkitap).toBe(1);
    expect(govde.durum).toContain('iki kaynak');
    expect(typeof govde.sureMs).toBe('number');
    expect(yanit.headers.get('Cache-Control')).toContain('no-store');
    expect(cacheKayit.length).toBe(0);
  });

  test('/saglik iki kaynak da çökünce durumu bildirir', async () => {
    const { govde } = await workerKos('https://x.dev/saglik', { grHata: true, bkHata: true });
    expect(govde.goodreads).toBe(0);
    expect(govde.binkitap).toBe(0);
    expect(govde.durum).toContain('HIC KAYNAK');
  });
});

/* ================= M4: service worker ================= */
function swKur(ayar) {
  const a = ayar || {};
  const kod = fs.readFileSync(path.join(KOK, 'sw.js'), 'utf8');
  const dinleyici = {};
  const cacheDeposu = new Map();
  const sahteCache = {
    put: async (istek, yanit) => { cacheDeposu.set(istek.url || istek, yanit); },
    match: async (istek) => cacheDeposu.get(istek.url || istek),
    addAll: async () => {}
  };
  const ctx = {
    self: {
      location: { origin: 'https://dessn7-bit.github.io' },
      addEventListener: (tur, fn) => { dinleyici[tur] = fn; },
      skipWaiting: () => {}, clients: { claim: () => {} }
    },
    caches: {
      open: async () => sahteCache, keys: async () => [], delete: async () => {},
      match: async (istek) => cacheDeposu.get(istek.url || istek)
    },
    fetch: async (istek) => {
      if (a.cevrimdisi) throw new Error('ag yok');
      return { clone: () => ({ govde: 'ag-yaniti' }), govde: 'ag-yaniti', tip: 'ag' };
    },
    Response: class { constructor(g, o){ this.govde = g; Object.assign(this, o || {}); } },
    URL, console
  };
  vm.createContext(ctx);
  vm.runInContext(kod, ctx);
  // cache'e önceden konmuş içerik
  if (a.onbellek) for (const [k, v] of Object.entries(a.onbellek)) cacheDeposu.set(k, v);
  return { dinleyici, cacheDeposu };
}
async function swIstek(kurulum, url, mod) {
  let yanitSozu = null;
  const olay = {
    request: { url, method: 'GET', mode: mod || 'no-cors' },
    respondWith: (p) => { yanitSozu = p; }
  };
  kurulum.dinleyici.fetch(olay);
  return yanitSozu ? await yanitSozu : null;
}

test.describe('G20 M4 — service worker cache stratejisi', () => {

  test('dış kaynak isteği cache\'e YAZILMAZ (SW hiç karışmaz)', async () => {
    const k = swKur();
    const disKaynaklar = [
      'https://www.googleapis.com/books/v1/volumes?key=GIZLI&q=x',
      'https://kitaplik-sync-default-rtdb.europe-west1.firebasedatabase.app/odalar/oda.json?auth=TOKEN123',
      'https://kitaplik-ara.dessn7.workers.dev/ara?q=x',
      'https://openlibrary.org/search.json?q=x',
      'https://books.google.com/books/content?id=x'
    ];
    for (const u of disKaynaklar) {
      const yanit = await swIstek(k, u);
      expect(yanit).toBeNull();          // respondWith çağrılmadı → tarayıcı doğrudan gider
    }
    expect(k.cacheDeposu.size).toBe(0);  // hiçbiri saklanmadı (auth token'ı dahil)
  });

  test('aynı köken isteği cache\'lenir', async () => {
    const k = swKur();
    const yanit = await swIstek(k, 'https://dessn7-bit.github.io/kitaplik/index.html', 'navigate');
    expect(yanit).not.toBeNull();
    expect(k.cacheDeposu.size).toBe(1);
  });

  test('çevrimdışı gezinme isteği index.html alır', async () => {
    const k = swKur({ cevrimdisi: true,
      onbellek: { './index.html': { govde: 'HTML-KABUK' } } });
    const yanit = await swIstek(k, 'https://dessn7-bit.github.io/kitaplik/index.html', 'navigate');
    expect(yanit.govde).toBe('HTML-KABUK');
  });

  test('çevrimdışı gezinme OLMAYAN istek HTML ALMAZ', async () => {
    const k = swKur({ cevrimdisi: true,
      onbellek: { './index.html': { govde: 'HTML-KABUK' } } });
    const yanit = await swIstek(k, 'https://dessn7-bit.github.io/kitaplik/icon-192.png', 'no-cors');
    expect(yanit.govde).not.toBe('HTML-KABUK');   // XSS tetikleyicisi kapandı
    expect(yanit.status).toBe(504);
  });

  test('çevrimdışında cache\'te olan kaynak cache\'ten döner', async () => {
    const k = swKur({ cevrimdisi: true,
      onbellek: { 'https://dessn7-bit.github.io/kitaplik/zeka.js': { govde: 'ONBELLEK-JS' } } });
    const yanit = await swIstek(k, 'https://dessn7-bit.github.io/kitaplik/zeka.js');
    expect(yanit.govde).toBe('ONBELLEK-JS');
  });
});
