'use strict';
/* G117 (v125) — TARİHSİZ BİTMİŞLER: SESSİZ DEĞİL, SÖYLENİR
 *
 * NEDEN: Bitmiş ama bitiş tarihi olmayan kitap hiçbir YIL'a ait değildir —
 * yıl sayımına, tempoya, aylık şeride ve yıl raporuna giremez. Bu doğru;
 * kusur onların dışarıda kalması DEĞİL, bunun SESSİZ olmasıydı. Kaan'ın
 * 2026-09-08 yedeğinde ölçüldü: 237 bitmişin 70'i tarihsiz (%29,5) ve
 * 22.185 sayfa hiçbir yıl-bazlı sayıda görünmüyor; ekran yine de "2026 · 12
 * kitap" ve "12 / 30" diyordu, neyi saymadığını söylemeden.
 *
 * KURAL (v63/v119 emsali): sayı UYDURULMAZ, veri DEĞİŞMEZ, eksik AÇIKÇA
 * yazılır; eksik yoksa satır GÖRÜNMEZ. Sayan yer TEK olmalı (v63 dersi:
 * iki kopya iki farklı sayı söyler).
 *
 * MUTASYON DENETİMİ (koşuldu, dördü de öldürüldü):
 *   M-a  tarihsizOzet().adet → 0 sabiti          → 7 vaka kırmızı (yalnız B ayakta)
 *   M-b  hero notu koşulsuz basılsın (0'da da)   → B kırmızı
 *   M-c  şerit notu kendi sayımını yapsın (+1)   → C kırmızı
 *   M-d  "yıl ata" düğmesi hero notundan kalksın → G kırmızı
 */
const { test, expect, tohumla, sahteKitap, rafAc, bugunISO } = require('./yardim');

const YIL = new Date().getFullYear();

/* 2 tarihli + 3 tarihsiz bitmiş (tarihsizlerin toplamı 450 sayfa) */
function karisikRaf() {
  return [
    sahteKitap({ ad: 'Tarihli Bir', durum: 'bitti', puan: 8, sayfa: 100, bitisTarihi: bugunISO() }),
    sahteKitap({ ad: 'Tarihli İki', durum: 'bitti', puan: 7, sayfa: 100, bitisTarihi: bugunISO() }),
    sahteKitap({ ad: 'Tarihsiz Bir', durum: 'bitti', puan: 9, sayfa: 200, bitisTarihi: null }),
    sahteKitap({ ad: 'Tarihsiz İki', durum: 'bitti', puan: 6, sayfa: 150, bitisTarihi: null }),
    sahteKitap({ ad: 'Tarihsiz Üç', durum: 'bitti', puan: 5, sayfa: 100, bitisTarihi: null })
  ];
}
function hepsiTarihli() {
  return [
    sahteKitap({ ad: 'Tarihli Bir', durum: 'bitti', puan: 8, sayfa: 100, bitisTarihi: bugunISO() }),
    sahteKitap({ ad: 'Tarihli İki', durum: 'bitti', puan: 7, sayfa: 100, bitisTarihi: bugunISO() })
  ];
}
async function istAc(page) {
  await rafAc(page);
  await page.click('nav [data-act="sekme"][data-v="ist"]');
}

test.describe('G117 tarihsiz bitmişler — dürüstlük (v125)', () => {

  test('A) İstatistik hero notu sayıyı, sayfayı ve NEYİN dışında kaldığını yazar', async ({ page }) => {
    await tohumla(page, { kitaplar: karisikRaf(), hedef: { [YIL]: 10 } });
    await istAc(page);
    const not = page.locator('#tzHeroNot');
    await expect(not).toContainText('3 bitmiş kitapta bitiş tarihi yok');
    await expect(not).toContainText('450 sayfa');
    await expect(not).toContainText(String(YIL));
    await expect(not).toContainText('yıl raporuna girmiyorlar');
  });

  test('B) tarihsiz YOKKEN hiçbir taban satırı çıkmaz (gürültü yok)', async ({ page }) => {
    await tohumla(page, { kitaplar: hepsiTarihli(), hedef: { [YIL]: 10 } });
    await istAc(page);
    await expect(page.locator('#tzHeroNot')).toHaveCount(0);
    await expect(page.locator('#istTarihsiz')).toHaveCount(0);
    await expect(page.locator('#tzTempoTaban')).toHaveText('');
    await expect(page.locator('#rpTarihsiz')).toHaveCount(0);
    // ana sayfadaki şerit notu da yok
    await page.goto('/');
    await expect(page.locator('.kt-hedef-not')).toHaveCount(0);
  });

  test('C) ÜÇ yüzey de AYNI sayıyı söyler (tek sayaç)', async ({ page }) => {
    await tohumla(page, { kitaplar: karisikRaf(), hedef: { [YIL]: 10 } });
    await page.goto('/');
    // ana sayfa şeridi
    await expect(page.locator('#asYil .kt-hedef-not')).toContainText('3 bitmiş kitapta tarih yok');
    await istAc(page);
    await expect(page.locator('#tzHeroNot')).toContainText('3 bitmiş kitapta');
    await expect(page.locator('#istTarihsiz')).toContainText('3 bitmiş kitapta');
    // çekirdek API'si de aynı sayıyı verir — eklentiler buradan okur
    const ozet = await page.evaluate(() => window.__tarihsiz.ozet());
    expect(ozet.adet).toBe(3);
    expect(ozet.sayfa).toBe(450);
  });

  test('D) yıl hedefi şeridi tabanını söyler, sayıyı DEĞİŞTİRMEZ', async ({ page }) => {
    await tohumla(page, { kitaplar: karisikRaf(), hedef: { [YIL]: 10 } });
    await page.goto('/');
    // sayı yalnız tarihli bitişlerden: 2 / 10 (değişmedi)
    await expect(page.locator('#ktHedef .kt-hedef-sayi')).toHaveText('2 / 10');
    await expect(page.locator('#ktHedef .kt-hedef-not')).toContainText('bu sayıya girmiyorlar');
  });

  test('E) tempo cümlesi tabanını AYNI satırda söyler (yeni rakam yığmaz)', async ({ page }) => {
    await tohumla(page, { kitaplar: karisikRaf(), hedef: { [YIL]: 10 } });
    await istAc(page);
    const tempo = page.locator('#istTempo');
    await expect(tempo).toContainText('2 / 10');
    await expect(tempo).toContainText('3 tarihsiz bitmiş bu orana da tempoya da girmiyor');
    // taban ayrı bir mini-not satırı DEĞİL, aynı cümlenin içinde
    await expect(page.locator('#istTempo #tzTempoTaban')).toHaveCount(1);
  });

  test('F) yıl raporu da tarihsizleri göremediğini söyler', async ({ page }) => {
    await tohumla(page, { kitaplar: karisikRaf(), hedef: { [YIL]: 10 } });
    await istAc(page);
    await expect(page.locator('#rpTarihsiz')).toContainText('3 bitmiş kitapta bitiş tarihi yok');
    await expect(page.locator('#rpTarihsiz')).toContainText('hiçbir yılın raporunda');
  });

  test('G) not EYLEMLİ: hero notundan yıl atama akışı açılır, veri kendiliğinden DEĞİŞMEZ', async ({ page }) => {
    await tohumla(page, { kitaplar: karisikRaf(), hedef: { [YIL]: 10 } });
    await istAc(page);
    // otomatik doldurma YOK
    expect(await page.evaluate(() =>
      veri.kitaplar.filter(k => k.durum === 'bitti' && !k.bitisTarihi).length)).toBe(3);
    await page.click('#tzHeroNot [data-act="zg-tarih"]');
    await expect(page.locator('#zgTarihOrtu')).toHaveClass(/acik/);
    await expect(page.locator('#zgTarihOrtuGovde .zg-sayac')).toHaveText('1 / 3');
  });

  test('H) tarih girilince taban satırları kendiliğinden küçülür', async ({ page }) => {
    await tohumla(page, { kitaplar: karisikRaf(), hedef: { [YIL]: 10 } });
    await istAc(page);
    await expect(page.locator('#tzHeroNot')).toContainText('3 bitmiş kitapta');
    await page.evaluate(() => {
      const k = veri.kitaplar.find(x => x.ad === 'Tarihsiz Bir');
      k.bitisTarihi = '2022-01-01'; k.g = Date.now();
      depoKaydet(); hepsiniCiz();
    });
    await expect(page.locator('#tzHeroNot')).toContainText('2 bitmiş kitapta');
    await expect(page.locator('#tzHeroNot')).toContainText('250 sayfa');
  });
});
