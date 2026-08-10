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

/* v52 — 1000Kitap v2 API taklidi (tür keşfi). Şekiller CANLI kaynaktan ölçüldü:
   geçerli slug → kitapTuru + liste; GEÇERSİZ slug → HTTP 200 ama kitapTuru YOK. */
const TURLER_YANIT = { liste: [
  { id: '26', adi: 'Felsefe-Düşünce', seo_adi: 'Felsefe-Dusunce', kitapSayisi: '4114' },
  { id: '12', adi: 'Roman', seo_adi: 'Roman', kitapSayisi: '25393' },
  { id: '99', adi: 'Novella', seo_adi: 'novella', kitapSayisi: '0' }] };
const TUR_YANIT = {
  hasMore: true, sayfa: 1, sayfaBasi: 15,
  kitapTuru: { id: '26', adi: 'Felsefe-Düşünce', seo_adi: 'Felsefe-Dusunce', kitapSayisi: '4114' },
  liste: [
    { adi: 'Yabancı', yazarAdi: 'Albert Camus', ilkYazar: 'Albert Camus',
      puan: 7.9, okuduDuz: 138767, resim: 'https://1k-cdn.com/y.jpg' },
    { adi: 'Simyacı', yazarAdi: 'Paulo Coelho', puan: 8.3, okuduDuz: 248735, resim: null },
    { adi: '', yazarAdi: 'Adsız', puan: 5, okuduDuz: 1 }] };   // adsız kayıt elenmeli
const TUR_YOK_YANIT = { toplamSayfa: 1, kume: -1, sayfa: 1, z: 0, b: 0, sayfaBasi: 4, liste: [] };

async function workerKos(url, ayar) {
  const a = ayar || {};
  const cacheKayit = [];
  const istekKayit = [];
  global.caches = { default: {
    match: async () => (a.cacheHit ? sahteYanit({ sonuclar: ['onbellek'] }) : undefined),
    put: async (istek, yanit) => { cacheKayit.push({ url: istek.url, yanit }); }
  } };
  global.fetch = async (u, secenek) => {
    istekKayit.push({ url: String(u), baslik: (secenek && secenek.headers) || {} });
    if (String(u).includes('api.1000kitap.com')) {
      if (a.apiHata) throw new Error('ag');
      if (a.apiKod) return sahteYanit({}, false);
      if (String(u).includes('kitap-turleri/turler'))
        return sahteYanit(a.turlerBos ? { liste: [] } : TURLER_YANIT);
      return sahteYanit(a.turYok ? TUR_YOK_YANIT
        : a.turBos ? Object.assign({}, TUR_YANIT, { liste: [] }) : TUR_YANIT);
    }
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
  return { yanit, govde: await yanit.json(), cacheKayit, istekKayit };
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

/* ================= v52: tür keşfi uçları ================= */
test.describe('G20 M5 — /turler ve /tur uçları', () => {

  test('/turler 78-tür şeklini döner, 7 gün cache\'lenir', async () => {
    const { govde, yanit, cacheKayit } = await workerKos('https://x.dev/turler');
    expect(govde.turler.length).toBe(3);
    expect(govde.turler[0]).toEqual({ seo: 'Felsefe-Dusunce', ad: 'Felsefe-Düşünce', kitapSayisi: 4114 });
    expect(govde.turler[2].kitapSayisi, '0 kitaplı tür sayısı ham geçer').toBe(0);
    expect(yanit.headers.get('Cache-Control')).toContain('max-age=' + 7 * 86400);
    expect(cacheKayit.length).toBe(1);
  });

  test('/turler BOŞ dönerse cache\'lenMEZ, 502 verir', async () => {
    const { govde, yanit, cacheKayit } = await workerKos('https://x.dev/turler', { turlerBos: true });
    expect(yanit.status).toBe(502);
    expect(govde.hata).toBe('kaynak-bos');
    expect(yanit.headers.get('Cache-Control')).toContain('no-store');
    expect(cacheKayit.length, 'arıza 7 gün servis edilmiyor').toBe(0);
  });

  test('/tur geçerli slug: sonuçlar + hasMore, 12 saat cache\'lenir, gerçek UA + tr-TR gider', async () => {
    const { govde, yanit, cacheKayit, istekKayit } = await workerKos(
      'https://x.dev/tur?slug=Felsefe-Dusunce&sayfa=1');
    expect(govde.tur).toEqual({ seo: 'Felsefe-Dusunce', ad: 'Felsefe-Düşünce' });
    expect(govde.hasMore).toBe(true);
    expect(govde.sonuclar.length, 'adsız kayıt elendi').toBe(2);
    expect(govde.sonuclar[0]).toEqual({ ad: 'Yabancı', yazar: 'Albert Camus',
      puan: 7.9, okuyan: 138767, kapak: 'https://1k-cdn.com/y.jpg' });
    expect(govde.sonuclar[1].kapak, 'kapaksız kayıt null taşır').toBeNull();
    expect(yanit.headers.get('Cache-Control')).toContain('max-age=' + 12 * 3600);
    expect(cacheKayit.length).toBe(1);
    // Cloudflare kapısı: sade istemci 403 alıyor — başlıklar gerçekten gidiyor mu?
    const ist = istekKayit.find(i => i.url.includes('api.1000kitap.com'));
    expect(ist.baslik['User-Agent']).toContain('Chrome/');
    expect(ist.baslik['Accept-Language']).toContain('tr-TR');
    expect(ist.url).toContain('turSeo=Felsefe-Dusunce');
  });

  test('/tur GEÇERSİZ slug: kaynak 200+kitapTuru YOK → temiz 404, cache\'lenMEZ', async () => {
    const { govde, yanit, cacheKayit } = await workerKos(
      'https://x.dev/tur?slug=Boyle-Bir-Tur-Yok', { turYok: true });
    expect(yanit.status).toBe(404);
    expect(govde.hata).toBe('tur-bulunamadi');
    expect(yanit.headers.get('Cache-Control')).toContain('no-store');
    expect(cacheKayit.length).toBe(0);
  });

  test('/tur BOŞ sonuç cache\'lenMEZ (mutasyon kilidi)', async () => {
    const { govde, yanit, cacheKayit } = await workerKos(
      'https://x.dev/tur?slug=Felsefe-Dusunce', { turBos: true });
    expect(yanit.status).toBe(404);
    expect(govde.hata).toBe('tur-bos');
    expect(yanit.headers.get('Cache-Control')).toContain('no-store');
    expect(cacheKayit.length, 'boş tür sayfası 12 saat servis edilmiyor').toBe(0);
  });

  test('/tur biçimsiz slug kaynağa HİÇ gitmez (400)', async () => {
    for (const kotu of ['', 'a/b', 'x?y=1', 'https://evil.example', 'a'.repeat(61)]) {
      const { govde, yanit, istekKayit } = await workerKos(
        'https://x.dev/tur?slug=' + encodeURIComponent(kotu));
      expect(yanit.status, kotu).toBe(400);
      expect(govde.hata).toBe('slug-gecersiz');
      expect(istekKayit.length, 'geçersiz slugda dış istek yok').toBe(0);
    }
  });

  test('/tur sayfa parametresi kelepçelenir ve kaynağa aynen gider', async () => {
    const { istekKayit } = await workerKos('https://x.dev/tur?slug=Roman&sayfa=3');
    expect(istekKayit[0].url).toContain('sayfa=3');
    const k = await workerKos('https://x.dev/tur?slug=Roman&sayfa=0');
    expect(k.istekKayit[0].url, 'sayfa<1 → 1').toContain('sayfa=1');
    const b = await workerKos('https://x.dev/tur?slug=Roman&sayfa=9999');
    expect(b.istekKayit[0].url, 'üst sınır 50').toContain('sayfa=50');
  });

  test('/tur kaynak çökerse 502, cache\'lenMEZ', async () => {
    const { govde, yanit, cacheKayit } = await workerKos(
      'https://x.dev/tur?slug=Roman', { apiHata: true });
    expect(yanit.status).toBe(502);
    expect(govde.hata).toBe('kaynak-ulasilamadi');
    expect(cacheKayit.length).toBe(0);
  });

  test('önbellek isabetinde kaynağa YENİ istek atılmaz', async () => {
    const { istekKayit } = await workerKos('https://x.dev/tur?slug=Roman', { cacheHit: true });
    expect(istekKayit.length).toBe(0);
  });

  test('/saglik tür kaynağını AYRI raporlar (bozulma erken görünür)', async () => {
    const saglam = await workerKos('https://x.dev/saglik');
    expect(saglam.govde.turler).toBe(3);
    expect(saglam.govde.tur).toBe(3);
    expect(saglam.govde.turSlug).toBe('Felsefe-Dusunce');
    expect(saglam.govde.turDurum).toContain('tur kaynagi calisiyor');
    expect(saglam.govde.durum, '/ara hattının sözleşmesi değişmedi')
      .toContain('iki kaynak da calisiyor');
    const bozuk = await workerKos('https://x.dev/saglik', { apiHata: true });
    expect(bozuk.govde.turler).toBe(0);
    expect(bozuk.govde.tur).toBe(0);
    expect(bozuk.govde.turDurum).toContain('TUR KAYNAGI BOZUK');
    expect(bozuk.govde.durum, 'tür çökünce arama hattı yeşil kalır')
      .toContain('iki kaynak da calisiyor');
    expect(bozuk.yanit.headers.get('Cache-Control')).toContain('no-store');
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
