'use strict';
const { test, expect, tohumla, sahteKitap, rafAc, rafYenile } = require('./yardim');

/* G8 — saf birleştirme mantığı testleri (window.__senkron.birlestir).
   Ağ yok: birlestir yerel bir fonksiyondur, Firebase çağrısı yapılmaz. */

const kitap = (id, ad, g) => ({ id, ad, yazar: 'Y', g });

test.describe('G8 senkron birleştirme', () => {

  test('iki tarafta farklı kitaplar → ikisi de kalır', async ({ page }) => {
    await rafAc(page);
    const sonuc = await page.evaluate(k => {
      const b = window.__senkron.birlestir(
        { kitaplar: [k.a], silinenler: {} },
        { kitaplar: [k.b], silinenler: {} });
      return b.kitaplar.map(x => x.ad).sort();
    }, { a: kitap('x1', 'Yerel Kitap', 100), b: kitap('x2', 'Uzak Kitap', 100) });
    expect(sonuc).toEqual(['Uzak Kitap', 'Yerel Kitap']);
  });

  test('aynı id, yerel damga daha yeni → yerel kazanır', async ({ page }) => {
    await rafAc(page);
    const sonuc = await page.evaluate(k => {
      const b = window.__senkron.birlestir(
        { kitaplar: [k.yerel], silinenler: {} },
        { kitaplar: [k.uzak], silinenler: {} });
      return { adet: b.kitaplar.length, ad: b.kitaplar[0].ad, g: b.kitaplar[0].g };
    }, { yerel: kitap('ayni', 'Yerel Sürüm', 200), uzak: kitap('ayni', 'Uzak Sürüm', 100) });
    expect(sonuc).toEqual({ adet: 1, ad: 'Yerel Sürüm', g: 200 });
  });

  test('aynı id, uzak damga daha yeni → uzak kazanır', async ({ page }) => {
    await rafAc(page);
    const sonuc = await page.evaluate(k => {
      const b = window.__senkron.birlestir(
        { kitaplar: [k.yerel], silinenler: {} },
        { kitaplar: [k.uzak], silinenler: {} });
      return { adet: b.kitaplar.length, ad: b.kitaplar[0].ad };
    }, { yerel: kitap('ayni', 'Yerel Sürüm', 100), uzak: kitap('ayni', 'Uzak Sürüm', 300) });
    expect(sonuc).toEqual({ adet: 1, ad: 'Uzak Sürüm' });
  });

  test('mezar taşı kitaptan yeniyse kitap silinir', async ({ page }) => {
    await rafAc(page);
    const sonuc = await page.evaluate(k => {
      const b = window.__senkron.birlestir(
        { kitaplar: [k.k], silinenler: {} },
        { kitaplar: [], silinenler: { silinen: 500 } });
      return { adet: b.kitaplar.length, mezar: b.silinenler.silinen };
    }, { k: kitap('silinen', 'Silinmiş Kitap', 200) });
    expect(sonuc).toEqual({ adet: 0, mezar: 500 });
  });

  test('kitap mezar taşından yeniyse kitap geri gelir', async ({ page }) => {
    await rafAc(page);
    const sonuc = await page.evaluate(k => {
      const b = window.__senkron.birlestir(
        { kitaplar: [k.k], silinenler: {} },
        { kitaplar: [], silinenler: { dirilen: 300 } });
      return { adet: b.kitaplar.length, ad: b.kitaplar[0] && b.kitaplar[0].ad };
    }, { k: kitap('dirilen', 'Geri Gelen Kitap', 400) });
    expect(sonuc).toEqual({ adet: 1, ad: 'Geri Gelen Kitap' });
  });

  test('hedef birleştirme: damgası yeni olan kazanır', async ({ page }) => {
    await rafAc(page);
    const sonuc = await page.evaluate(() => {
      const yerelYeni = window.__senkron.birlestir(
        { kitaplar: [], silinenler: {}, hedef: { 2026: 30 }, hedefG: { 2026: 200 } },
        { kitaplar: [], silinenler: {}, hedef: { 2026: 20 }, hedefG: { 2026: 100 } });
      const uzakYeni = window.__senkron.birlestir(
        { kitaplar: [], silinenler: {}, hedef: { 2026: 30 }, hedefG: { 2026: 100 } },
        { kitaplar: [], silinenler: {}, hedef: { 2026: 20 }, hedefG: { 2026: 300 } });
      return { yerelKazandi: yerelYeni.hedef[2026], uzakKazandi: uzakYeni.hedef[2026] };
    });
    expect(sonuc).toEqual({ yerelKazandi: 30, uzakKazandi: 20 });
  });

  test('damgasız eski kayıt kaybolmaz', async ({ page }) => {
    await rafAc(page);
    const sonuc = await page.evaluate(() => {
      const b = window.__senkron.birlestir(
        { kitaplar: [{ id: 'eski', ad: 'Damgasız Kitap', yazar: 'Y' }], silinenler: {} },
        { kitaplar: [], silinenler: {} });
      return { adet: b.kitaplar.length, ad: b.kitaplar[0] && b.kitaplar[0].ad, g: b.kitaplar[0] && b.kitaplar[0].g };
    });
    expect(sonuc.adet).toBe(1);
    expect(sonuc.ad).toBe('Damgasız Kitap');
    expect(sonuc.g).toBe(0); // g yoksa 0 kabul edilir, kayıt yine de yaşar
  });

  test('KRİTİK: sayfa yenilendiğinde kitap damgaları (g) sıfırlanmaz', async ({ page }) => {
    // Senaryo: kitap g:12345 ile depoda; İLK yüklemede damgala anlık görüntüyü yazar.
    // İkinci yüklemede (reload) parmak izi eşleşir → g DEĞİŞMEMELİ.
    // Normalize'daki `g: parseInt(k.g) || 0` yaması olmadan g her yüklemede tazelenirdi.
    await tohumla(page, [sahteKitap({ ad: 'Damgalı Kitap', g: 12345 })]);
    await rafAc(page); // 1. yükleme: anlık görüntü (kk_senkron_anlik_v1) yazılır
    await rafYenile(page);  // 2. yükleme: doğru anlık görüntü varken...
    expect(await page.evaluate(() => veri.kitaplar[0].g)).toBe(12345); // ...g korunur
    // depodan okunan ham değer de korunmuş olmalı
    const depo = await page.evaluate(() => JSON.parse(localStorage.getItem('kk_kitaplik_v1')));
    expect(depo.kitaplar[0].g).toBe(12345);
  });
});
