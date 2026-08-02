'use strict';
const fs = require('fs');
const path = require('path');
const { test, expect, tohumla, sahteKitap } = require('./yardim');

let sayac = 0;
function not(metin, fikir) {
  sayac++;
  return { id: 'gn' + sayac, tip: 'alinti', metin, tarih: '2026-08-01', sayfa: null, fikir: fikir || [] };
}

/* --------- D1: kaynak dosyada kontrol karakteri yok --------- */
test.describe('G18 D1 — fikirag.js kaynak temizliği', () => {

  test('dosyada NUL (0x00) baytı yok', async () => {
    const bayt = fs.readFileSync(path.join(__dirname, '..', 'fikirag.js'));
    const nul = bayt.filter(b => b === 0).length;
    expect(nul).toBe(0);
  });

  test('eş-geçim anahtarı hâlâ doğru çalışıyor (boşluklu etiketler karışmaz)', async ({ page }) => {
    // "a b" + "c" ile "a" + "b c" ayrımı: ayraç belirsizliği olsa bu ikisi çakışırdı
    await tohumla(page, [
      sahteKitap({ ad: 'K1', notlar: [not('n1', ['a b', 'c'])] }),
      sahteKitap({ ad: 'K2', notlar: [not('n2', ['a', 'b c'])] })
    ]);
    await page.goto('/');
    await page.click('[data-act="sekme"][data-v="alinti"]');
    const c = await page.evaluate(() => window.__fikirag.esGecim());
    expect(c.length).toBe(2);                       // iki AYRI çift
    const cift1 = c.find(x => x.a === 'a b' && x.b === 'c');
    const cift2 = c.find(x => x.a === 'a' && x.b === 'b c');
    expect(cift1.notlar).toBe(1);
    expect(cift2.notlar).toBe(1);
  });
});

/* --------- D2: kesişim alttaki listeyi de süzer --------- */
function kesisimKitaplari() {
  return [
    sahteKitap({ ad: 'Irmak Kitabı', notlar: [not('Irmak alıntısı', ['surec', 'olus'])] }),
    sahteKitap({ ad: 'Ateş Kitabı', notlar: [not('Ateş alıntısı', ['surec', 'olus'])] }),
    sahteKitap({ ad: 'Bengi Kitabı', notlar: [not('Bengi dönüş alıntısı', ['surec'])] })
  ];
}
async function surecSec(page) {
  await page.goto('/');
  await page.click('[data-act="sekme"][data-v="alinti"]');
  await page.click('#panel-alinti #fikirBulut [data-act="fikir-filtre"][data-v="surec"]');
  await expect(page.locator('#panel-alinti #faKomsuKart')).toBeVisible();
}

test.describe('G18 D2 — kesişim alt listeyi süzer', () => {

  test('kesişim açıkken alttaki listede yalnız iki etiketli notlar kalır', async ({ page }) => {
    await tohumla(page, kesisimKitaplari());
    await surecSec(page);
    await expect(page.locator('#alintiIcerik .not-kart:visible')).toHaveCount(3);   // yalnız #surec filtresi
    await page.click('#panel-alinti [data-act="fa-kesisim"][data-v="olus"]');
    await expect(page.locator('#panel-alinti #faKesisimKart')).toContainText('2 not, 2 kitap');
    await expect(page.locator('#alintiIcerik .not-kart:visible')).toHaveCount(2);   // alt liste de süzüldü
    // gizlenen kart DOM'da kalır (display:none) — görünürlükle doğrula
    await expect(page.locator('#alintiIcerik .not-kart', { hasText: 'Bengi dönüş alıntısı' })).toBeHidden();
  });

  test('kesişim kapanınca alt liste eski filtreye döner', async ({ page }) => {
    await tohumla(page, kesisimKitaplari());
    await surecSec(page);
    await page.click('#panel-alinti [data-act="fa-kesisim"][data-v="olus"]');
    await expect(page.locator('#alintiIcerik .not-kart:visible')).toHaveCount(2);
    await page.click('#panel-alinti [data-act="fa-kesisim-kapat"]');
    await expect(page.locator('#alintiIcerik .not-kart:visible')).toHaveCount(3);   // #surec filtresi geri geldi
    await expect(page.locator('#alintiIcerik')).toContainText('Bengi dönüş alıntısı');
    await expect(page.locator('#panel-alinti #fikirBaslik')).toContainText('surec');
  });

  test('fikir.js kendi filtresi bozulmadan çalışmaya devam eder', async ({ page }) => {
    await tohumla(page, kesisimKitaplari());
    await surecSec(page);
    await page.click('#panel-alinti [data-act="fa-kesisim"][data-v="olus"]');
    await expect(page.locator('#alintiIcerik .not-kart:visible')).toHaveCount(2);
    // kesişim açıkken başka bir fikre geçiş: fikir.js filtresi devralır
    await page.click('#panel-alinti #fikirBulut [data-act="fikir-filtre"][data-v="olus"]');
    await expect(page.locator('#alintiIcerik .not-kart:visible')).toHaveCount(2);   // #olus 2 notta
    await expect(page.locator('#panel-alinti #faKesisimKart')).toHaveCount(0);      // kesişim sıfırlandı
    // "Tüm fikirler"e dön: hepsi görünür
    await page.click('#panel-alinti #fikirBulut [data-act="fikir-filtre"][data-v=""]');
    await expect(page.locator('#alintiIcerik .not-kart:visible')).toHaveCount(3);
  });
});
