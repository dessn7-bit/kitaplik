/* Kitaplik test yardimcilari:
   - agTaklit: TUM dis agi taklit eder; taklit edilmeyen dis istek testi DUSURUR
   - kameraTaklit / kameraYok: BarcodeDetector + getUserMedia sahteleri
   - tohumla: localStorage'a baslangic kutuphanesi yazar (goto'dan ONCE cagrilmali)
   - sahteKitap: varsayilan alanlarla kitap nesnesi uretir
   Testler `yardim.js`teki `test`i kullanmali (temel @playwright/test degil):
   agTaklit otomatik kurulur ve test sonunda beklenmeyen-istek denetimi yapilir. */
'use strict';
const { test: temel, expect } = require('@playwright/test');

const BOS_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');

let kitapSayac = 0;
function sahteKitap(ek) {
  kitapSayac++;
  return Object.assign({
    id: 'test' + kitapSayac + 'x' + Math.random().toString(36).slice(2, 7),
    eklenme: 1754000000000 + kitapSayac,
    ad: 'Deneme Kitabı ' + kitapSayac, yazar: 'Deneme Yazar', yayinevi: '', yil: null,
    sayfa: null, tur: '', durum: 'okunacak', puan: null, guncelSayfa: 0,
    baslamaTarihi: null, bitisTarihi: null, etiketler: [], kapak: null,
    g: 0, raf: '', isbn: '', seanslar: [], oturumlar: [], odunc: [], notlar: []
  }, ek || {});
}

/* goto'dan ONCE cagrilir. kitaplar: dizi veya tam veri nesnesi. ekstra: {lsAnahtari: deger}
   Tohum yalniz ILK yuklemede yazilir (init script her navigasyonda yeniden kosar;
   bayrak olmasa reload testlerinde uygulamanin kaydettigi veri ezilirdi). */
async function tohumla(page, kitaplar, ekstra) {
  const v = Array.isArray(kitaplar) ? { kitaplar, hedef: {} } : kitaplar;
  const ek = {};
  for (const [anahtar, deger] of Object.entries(ekstra || {}))
    ek[anahtar] = typeof deger === 'string' ? deger : JSON.stringify(deger);
  await page.addInitScript(([veriJson, ekObj]) => {
    if (localStorage.getItem('__kk_tohumlandi')) return;
    localStorage.setItem('__kk_tohumlandi', '1');
    localStorage.setItem('kk_kitaplik_v1', veriJson);
    for (const [a, d] of Object.entries(ekObj)) localStorage.setItem(a, d);
  }, [JSON.stringify(v), ek]);
}

/* Ag taklidi. Ayar page.__agAyar uzerinden test sirasinde da degistirilebilir:
   { google: <GB yaniti|'hata'>, worker: <worker yaniti|'hata'>,
     olArama: <OL search yaniti|'hata'>, olKitap: <OL books yaniti|'hata'> }
   Sayaclar page.__agSayac: { google, worker, olArama, olKitap, firebase, sonGoogleUrl } */
async function agTaklit(page, ayar) {
  const sayac = { google: 0, worker: 0, olArama: 0, olKitap: 0, firebase: 0, sonGoogleUrl: '' };
  const beklenmeyen = [];
  page.__agSayac = sayac;
  page.__agBeklenmeyen = beklenmeyen;
  page.__agAyar = ayar || {};
  const json = (route, govde) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(govde) });
  await page.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('http://127.0.0.1:8124')) return route.continue();
    const a = page.__agAyar;
    if (url.includes('googleapis.com/books')) {
      sayac.google++; sayac.sonGoogleUrl = url;
      if (a.google === 'hata') return route.abort('failed');
      return json(route, a.google || { totalItems: 0, items: [] });
    }
    if (url.includes('kitaplik-ara.dessn7.workers.dev')) {
      sayac.worker++;
      if (a.worker === 'hata') return route.abort('failed');
      return json(route, a.worker || { sonuclar: [] });
    }
    if (url.includes('openlibrary.org/search.json')) {
      sayac.olArama++;
      if (a.olArama === 'hata') return route.abort('failed');
      return json(route, a.olArama || { docs: [] });
    }
    if (url.includes('openlibrary.org/api/books')) {
      sayac.olKitap++;
      if (a.olKitap === 'hata') return route.abort('failed');
      return json(route, a.olKitap || {});
    }
    if (url.includes('covers.openlibrary.org') || url.includes('books.google')
        || url.includes('gr-assets') || url.includes('1k-cdn.com')) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: BOS_PNG });
    }
    if (url.includes('identitytoolkit.googleapis.com') || url.includes('securetoken.googleapis.com')
        || url.includes('firebasedatabase.app')) {
      sayac.firebase++;
      return json(route, {});
    }
    beklenmeyen.push(url);
    return route.abort('failed');
  });
}

/* Sahte kamera: window.__sahteKod'a yazilan deger BarcodeDetector.detect ile "okunur".
   Akis durdurulunca window.__akisDurdu true olur. */
async function kameraTaklit(page) {
  await page.addInitScript(() => {
    window.__sahteKod = null;
    window.__akisDurdu = false;
    window.__akisIstendi = false;
    window.BarcodeDetector = class {
      constructor() {}
      static async getSupportedFormats() { return ['ean_13', 'ean_8', 'isbn']; }
      async detect() {
        return window.__sahteKod ? [{ rawValue: window.__sahteKod, format: 'ean_13' }] : [];
      }
    };
    const sahteAkis = () => {
      const tuval = document.createElement('canvas');
      tuval.width = 320; tuval.height = 240;
      tuval.getContext('2d').fillRect(0, 0, 320, 240);
      const akis = tuval.captureStream(5);
      akis.getTracks().forEach(iz => {
        const asilDurdur = iz.stop.bind(iz);
        iz.stop = () => { window.__akisDurdu = true; asilDurdur(); };
      });
      return akis;
    };
    if (!navigator.mediaDevices)
      Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
    navigator.mediaDevices.getUserMedia = async () => {
      window.__akisIstendi = true;
      return sahteAkis();
    };
  });
}

/* Kamera desteksiz cihaz taklidi */
async function kameraYok(page) {
  await page.addInitScript(() => {
    try { delete window.BarcodeDetector; } catch (e) {}
    Object.defineProperty(navigator, 'mediaDevices', { value: undefined, configurable: true });
  });
}

/* confirm/alert diyaloglarini otomatik kabul et */
function onaylariKabulEt(page) {
  page.on('dialog', d => d.accept());
}

function bugunISO(kayma) {
  const d = new Date();
  if (kayma) d.setDate(d.getDate() + kayma);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
}

/* agTaklit'i otomatik kuran ve test sonunda beklenmeyen istekleri denetleyen test tabani */
const test = temel.extend({
  page: async ({ page }, kullan) => {
    await agTaklit(page);
    await kullan(page);
    expect(page.__agBeklenmeyen,
      'Taklit edilmemis dis istek yakalandi (kurala gore test HATA verir)').toEqual([]);
  }
});

module.exports = { test, expect, tohumla, sahteKitap, agTaklit, kameraTaklit, kameraYok,
  onaylariKabulEt, bugunISO };
