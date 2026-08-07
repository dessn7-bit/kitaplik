/* G33 — Barkod yedeği + form katlama + gömülü font + şerit yedeği.
   Sözleşme:
   - Barkod: BarcodeDetector YOK ya da ean_13 desteklemiyor → ZXing YEREL yedeği
     devreye girer; kamera hatası NET adla raporlanır; yedek tarayıcı sahte
     EAN-13 karesini GERÇEKTEN çözer (görsel testte üretilir).
     (v38'e kadarki kök kusur: formats listesindeki 'isbn' geçersiz enum değeri
     constructor'ı her gerçek cihazda düşürüyordu — artık formatlar
     getSupportedFormats ile doğrulanıyor.)
   - Form: birincil yüzey ad+durum+kaydet; kalan alanlar #fAyrintilar'da
     varsayılan KAPALI, aramadan dolar, özet dolu alanları söyler; kaydet tüm
     alanları yazar. Düzenlemede AÇIK gelir.
   - Font: 'Kitaplik Sans' yerel woff2 (latin+latin-ext), --sans'ın ilk öğesi,
     sw önbellek listesinde.
   - Şerit: bozuk kapakta baş-harfli alt katman görünür, boş kart kalmaz. */
'use strict';
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc, ayrintilarAc } = require('./yardim');

/* Kamera sahtesi (yardim.kameraTaklit'ten farkı: BarcodeDetector'ı YOK ya da
   format-eksik kurabilir — yedek tarayıcı yolları ancak böyle sınanır). */
async function kameraSahte(page, sec) {
  await page.addInitScript(s => {
    const akisVer = () => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 480;
      const x = c.getContext('2d'); x.fillStyle = '#999'; x.fillRect(0, 0, 640, 480);
      return c.captureStream(5);   // gerçek MediaStream: video.play() çalışır
    };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: s.izinYok
        ? () => Promise.reject(new DOMException('izin reddedildi', 'NotAllowedError'))
        : () => Promise.resolve(akisVer())
    } });
    if (s.dedektor === 'formatsiz') {
      window.BarcodeDetector = class {
        constructor() { throw new TypeError('format desteklenmiyor — kurulmamalıydı'); }
        static async getSupportedFormats() { return ['qr_code']; }
      };
    }
    // s.dedektor === 'yok': masaüstü Chromium'da zaten yok — dokunma
  }, sec);
}

async function barkodAc(page) {
  await rafAc(page);
  await page.click('.fab[data-act="yeni"]');
  await page.click('#barkodBtn');
}

/* Test içinde EAN-13 çizimi: L/G/R desenleri türetilir (el yazımı tablo hatasız) */
const EAN13_CIZ = `(kod) => {
  const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const R = L.map(p => [...p].map(b => b === '1' ? '0' : '1').join(''));
  const G = R.map(p => [...p].reverse().join(''));
  const PAR = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
  let bits = '101';
  const ilk = +kod[0], sol = kod.slice(1, 7), sag = kod.slice(7);
  for (let i = 0; i < 6; i++) bits += (PAR[ilk][i] === 'L' ? L : G)[+sol[i]];
  bits += '01010';
  for (let i = 0; i < 6; i++) bits += R[+sag[i]];
  bits += '101';
  const m = 4, sessiz = 60, boy = 140;
  const c = document.createElement('canvas');
  c.width = bits.length * m + sessiz * 2; c.height = boy + 40;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#000';
  for (let i = 0; i < bits.length; i++) if (bits[i] === '1') x.fillRect(sessiz + i * m, 20, m, boy);
  return c;
}`;
function kontrolHane(d12) {
  let t = 0;
  for (let i = 0; i < 12; i++) t += (+d12[i]) * (i % 2 ? 3 : 1);
  return String((10 - (t % 10)) % 10);
}

test.describe('G33 barkod + form + font', () => {

  /* ---------- D1 barkod ---------- */
  test('D1a: BarcodeDetector yokken yedek tarayıcı devreye girer (ZXing yerel)', async ({ page }) => {
    await kameraSahte(page, { dedektor: 'yok' });
    await tohumla(page, []);
    await barkodAc(page);
    await expect(page.locator('#barkodNot')).toContainText('yedek tarayıcı', { timeout: 10000 });
    await expect.poll(() => page.evaluate(() => !!window.ZXing), { timeout: 10000 }).toBe(true);
    await expect(page.locator('#barkodNot')).toContainText('barkod aranıyor');
    await page.click('[data-act="barkod-kapat"]');
  });

  test('D1b: nesne var ama ean_13 desteği yoksa yedeğe düşer (getSupportedFormats doğrulaması)', async ({ page }) => {
    await kameraSahte(page, { dedektor: 'formatsiz' });
    await tohumla(page, []);
    await barkodAc(page);
    // format-eksik constructor'a hiç gidilmez (TypeError atardı) → yedek yolu
    await expect(page.locator('#barkodNot')).toContainText('yedek tarayıcı', { timeout: 10000 });
    await expect(page.locator('#barkodNot')).toContainText('barkod aranıyor');
    await page.click('[data-act="barkod-kapat"]');
  });

  test('D1c: kamera izni reddedilince durum satırı SEBEBİ söyler', async ({ page }) => {
    await kameraSahte(page, { dedektor: 'yok', izinYok: true });
    await tohumla(page, []);
    await barkodAc(page);
    await expect(page.locator('#barkodNot')).toContainText('Kamera açılamadı: izin verilmedi');
    await expect(page.locator('#barkodNot')).toContainText('elle yazabilirsin');
  });

  test('D1d: yedek tarayıcı üretilen EAN-13 karesini GERÇEKTEN çözer', async ({ page }) => {
    await tohumla(page, []);
    await rafAc(page);
    const govde = '978975071853';
    const kod = govde + kontrolHane(govde);
    const okunan = await page.evaluate(async ([ciz, k]) => {
      const ok = await window.__barkod.yedekYukle();
      if (!ok) return 'YEDEK-YUKLENEMEDI';
      const tuval = eval(ciz)(k);
      return window.__barkod.yedekKareCoz(tuval);
    }, [EAN13_CIZ, kod]);
    expect(okunan).toBe(kod);
    expect(await page.evaluate(k => window.__barkod.isbnGecerli(k), kod)).toBe(true);
  });

  /* ---------- D2 form katlama ---------- */
  test('D2a: yeni kitap formunda görünür alan sayısı ≤ 4, ayrıntılar kapalı', async ({ page }) => {
    await tohumla(page, []);
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await expect(page.locator('#ortuForm')).toHaveClass(/acik/);
    expect(await page.locator('#fAyrintilar').evaluate(e => e.open)).toBe(false);
    const gorunur = await page.locator('#ortuForm input:visible, #ortuForm select:visible, #ortuForm textarea:visible').count();
    expect(gorunur, 'görünür girdi sayısı').toBeLessThanOrEqual(4);
    // birincil yüzey duruyor: ad + durum + kaydet
    await expect(page.locator('#f-ad')).toBeVisible();
    await expect(page.locator('#fDurum')).toBeVisible();
    await expect(page.locator('[data-act="form-kaydet"]')).toBeVisible();
  });

  test('D2b+c: arama seçimi kapalı ayrıntıları doldurur, özet dolu alanları sayar', async ({ page }) => {
    await tohumla(page, []);
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await page.evaluate(() => {
      document.getElementById('olSonuc')._adaylar = [{ ad: 'Körlük', yazar: 'José Saramago',
        yayinevi: 'Kırmızı Kedi', yil: 2015, sayfa: 352, dil: 'TR', kapak: null }];
      olSec(0);
    });
    // ayrıntılar HÂLÂ kapalı ama alanlar doldu
    expect(await page.locator('#fAyrintilar').evaluate(e => e.open)).toBe(false);
    await expect(page.locator('#f-yazar')).toHaveValue('José Saramago');
    await expect(page.locator('#f-sayfa')).toHaveValue('352');
    // özet dolu alanları söylüyor
    await expect(page.locator('#fAyrintiOzet')).toContainText('Ayrıntılar ·');
    await expect(page.locator('#fAyrintiOzet')).toContainText('yazar');
    await expect(page.locator('#fAyrintiOzet')).toContainText('sayfa');
    await expect(page.locator('#fAyrintiOzet')).toContainText('dolu');
  });

  test('D2d: kaydet tüm alanları yazar — işlev kaybı yok', async ({ page }) => {
    await tohumla(page, []);
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await page.fill('#f-ad', 'Katlama Testi');
    await ayrintilarAc(page);
    await page.fill('#f-yazar', 'Yazar K');
    await page.fill('#f-sayfa', '240');
    await page.fill('#f-isbn', '9789750718533');
    await page.fill('#f-etiket', 'deneme');
    await page.click('[data-act="form-kaydet"]');
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.ad).toBe('Katlama Testi');
    expect(k.yazar).toBe('Yazar K');
    expect(k.sayfa).toBe(240);
    expect(k.isbn).toBe('9789750718533');
    expect(k.etiketler).toEqual(['deneme']);
  });

  test('D2: düzenleme modunda ayrıntılar AÇIK gelir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Düzenlenecek', yazar: 'Mevcut Yazar' })]);
    await rafAc(page);
    await page.click('#liste .kart');
    await page.click('#dDigerKatla summary');
    await page.click('[data-act="duzenle"]');
    await expect(page.locator('#ortuForm')).toHaveClass(/acik/);
    expect(await page.locator('#fAyrintilar').evaluate(e => e.open)).toBe(true);
    await expect(page.locator('#f-yazar')).toBeVisible();
  });

  /* ---------- D3 gömülü font ---------- */
  test('D3a+b: @font-face yerel dosyaya işaret eder, --sans ilk öğesi gömülü aile', async ({ page }) => {
    await tohumla(page, []);
    await page.goto('/');
    const ff = await page.evaluate(() => {
      const yuzler = [];
      for (const sayfa of document.styleSheets) {
        try {
          for (const kural of sayfa.cssRules)
            if (kural instanceof CSSFontFaceRule) yuzler.push({
              aile: kural.style.getPropertyValue('font-family'),
              src: kural.style.getPropertyValue('src') });
        } catch (e) {}
      }
      return { yuzler, govdeFont: getComputedStyle(document.body).fontFamily };
    });
    const bizim = ff.yuzler.filter(y => y.aile.includes('Kitaplik Sans'));
    expect(bizim.length).toBe(2);   // latin + latin-ext
    for (const y of bizim) expect(y.src).toContain('font/inter-');
    for (const y of bizim) expect(y.src).not.toContain('http');   // dış istek YOK
    expect(ff.govdeFont.replace(/["']/g, '').startsWith('Kitaplik Sans')).toBe(true);
  });

  test('D3c: font dosyaları sunuluyor ve tarayıcıya yüklendi', async ({ page }) => {
    await tohumla(page, []);
    await page.goto('/');
    const r = await page.evaluate(async () => {
      const yanit = await fetch('./font/inter-latin.woff2');
      const boyut = (await yanit.arrayBuffer()).byteLength;
      const yanit2 = await fetch('./font/inter-latin-ext.woff2');
      const boyut2 = (await yanit2.arrayBuffer()).byteLength;
      await document.fonts.ready;
      return { ok: yanit.ok, boyut, ok2: yanit2.ok, boyut2,
        yuklu: document.fonts.check('16px "Kitaplik Sans"') };
    });
    expect(r.ok).toBe(true);
    expect(r.ok2).toBe(true);
    expect(r.boyut).toBeGreaterThan(10000);
    expect(r.boyut2).toBeGreaterThan(10000);
    expect(r.yuklu).toBe(true);
  });

  test('D3d: sw önbellek listesi font + zxing dosyalarını içeriyor', async ({ page }) => {
    await tohumla(page, []);
    await page.goto('/');
    const sw = await page.evaluate(async () => (await fetch('./sw.js')).text());
    expect(sw).toContain('./font/inter-latin.woff2');
    expect(sw).toContain('./font/inter-latin-ext.woff2');
    expect(sw).toContain('./zxing.min.js');
  });

  /* ---------- D4 şerit yedeği ---------- */
  test('D4: bozuk kapakta şeritte baş-harfli yedek görünür — boş kart YOK', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Bozuk Kapaklı', durum: 'bitti', sayfa: 100,
      puan: 6, bitisTarihi: bugunISO(), kapak: 'data:image/png;base64,Qk9aVUs=' })]);
    await page.goto('/');
    const dugme = page.locator('#asSonBiten .as-kapak-btn');
    await expect(dugme).toHaveCount(1);
    await expect(dugme.locator('.as-kapak-yok')).toBeVisible();
    await expect(dugme.locator('.as-kapak-yok')).toHaveText('BK');
    // bozuk img üst katmandan KALDIRILDI — altta yedek, boş beyaz kart yok
    await expect(dugme.locator('img.as-kapak-ust')).toHaveCount(0);
  });
});
