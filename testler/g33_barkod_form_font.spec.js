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
    // GÖÇ (v41 "Ciltli"): gövde Lora (2 normal + 2 italik yüz), başlık Cormorant
    // Garamond (2 yüz — Google değişken dosyası 400-600'ü tek woff2'de taşır)
    const lora = ff.yuzler.filter(y => y.aile.includes('Lora'));
    const cormorant = ff.yuzler.filter(y => y.aile.includes('Cormorant Garamond'));
    expect(lora.length).toBe(4);
    expect(cormorant.length).toBe(2);
    for (const y of [...lora, ...cormorant]){
      expect(y.src).toContain('font/');
      expect(y.src).not.toContain('http');   // dış istek YOK
    }
    expect(ff.govdeFont.replace(/["']/g, '').startsWith('Lora')).toBe(true);
  });

  test('D3c: font dosyaları sunuluyor ve iki aile de tarayıcıya yüklendi', async ({ page }) => {
    await tohumla(page, []);
    await page.goto('/');
    const r = await page.evaluate(async () => {
      const oku = async (yol) => { const y = await fetch(yol); return { ok: y.ok, boyut: (await y.arrayBuffer()).byteLength }; };
      const lora = await oku('./font/lora-latin.woff2');
      const cormorant = await oku('./font/cormorant-latin.woff2');
      const italik = await oku('./font/lora-italik-latin-ext.woff2');
      await document.fonts.ready;
      // italik o sayfada kullanılmıyor — load() ile çek, sonra check()
      await document.fonts.load('italic 16px Lora', 'ığş');
      return { lora, cormorant, italik,
        loraYuklu: document.fonts.check('16px Lora'),
        cormorantYuklu: document.fonts.check('16px "Cormorant Garamond"'),
        italikYuklu: document.fonts.check('italic 16px Lora') };
    });
    for (const d of [r.lora, r.cormorant, r.italik]){
      expect(d.ok).toBe(true);
      expect(d.boyut).toBeGreaterThan(5000);
    }
    expect(r.loraYuklu).toBe(true);
    expect(r.cormorantYuklu).toBe(true);
    expect(r.italikYuklu).toBe(true);
  });

  test('D3d: sw önbellek listesi güncel — yeni fontlar var, Inter yok', async ({ page }) => {
    await tohumla(page, []);
    await page.goto('/');
    const sw = await page.evaluate(async () => (await fetch('./sw.js')).text());
    for (const f of ['cormorant-latin', 'cormorant-latin-ext', 'lora-latin',
      'lora-latin-ext', 'lora-italik-latin', 'lora-italik-latin-ext'])
      expect(sw).toContain('./font/' + f + '.woff2');
    expect(sw).not.toContain('inter-');
    expect(sw).toContain('./zxing.min.js');
  });

  /* ---------- D4 şerit yedeği ---------- */
  test('D4: bozuk kapakta şeritte ortak levha yedeği görünür — boş kart YOK', async ({ page }) => {
    /* v47 GÖÇ: şerit SIRADA ile AYNI üreticiye geçti — yedek artık baş-harfli
       sırt değil, plateKapakYedek'in tipografik yüzü (p-bos + ad/yazar). */
    await tohumla(page, [sahteKitap({ ad: 'Bozuk Kapaklı', durum: 'bitti', sayfa: 100,
      puan: 6, bitisTarihi: bugunISO(), kapak: 'data:image/png;base64,Qk9aVUs=' })]);
    await page.goto('/');
    const levha = page.locator('#asSonBiten .kt-sira-plate');
    await expect(levha).toHaveCount(1);
    await expect(levha).toHaveClass(/p-bos/);
    await expect(levha).not.toHaveClass(/kt-sira-kapakli/);
    await expect(levha.locator('.kt-sira-ad')).toHaveText('Bozuk Kapaklı');
    // bozuk img levhadan KALDIRILDI — kesikli çerçeve + ad, boş beyaz kart yok
    await expect(levha.locator('img')).toHaveCount(0);
    const adKutu = await levha.locator('.kt-sira-ad').boundingBox();
    expect(adKutu.height, 'yedek metin gerçekten boyanıyor').toBeGreaterThan(6);
  });
});
