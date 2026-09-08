'use strict';
/* G114 (v121) — İKİ RAKAMIN AYRIMI
 *
 * NEDEN: İstatistik ekranında komşu bölümlerde duran iki sayı çelişki sanılıyordu:
 *   "yıl sonu projeksiyonu ~17 kitap"  ve  "ortalama bitirme süresi 4 gün".
 * İkisi de doğru ama FARKLI şey ölçüyor — 17 SIKLIK (kitaplar arası aralık),
 * 4 HIZ (kitabı elde tutma süresi). Aradaki fark okunmayan zaman.
 *
 * Kaan'ın verisinde ölçüldü: 251 günde 12 kitap = 21 günde bir; "4 gün" ise
 * 167 bitmişin YALNIZ 4'ünden ve dördü de 18 günlük bir pencerede bitmiş.
 *
 * KURAL (v119 taban doğruluğunun devamı): sayı durabilir, ama neyi kapsadığı
 * ekranda YAZILI olur; kapsam yoksa satır da olmaz.
 */
const { test, expect, tohumla, sahteKitap, rafAc } = require('./yardim');

const yil = new Date().getFullYear();
/* tempoDurum ile AYNI formül — testin sayıyı bağımsız hesaplaması şart,
   yoksa ekrandan okuyup ekrana sorardık. */
const gunNo = Math.floor((new Date() - new Date(yil, 0, 0)) / 86400000);

function bitmis(ad, bitis, baslama) {
  return sahteKitap({ ad, durum: 'bitti', bitisTarihi: bitis, baslamaTarihi: baslama || null, sayfa: 200 });
}
const g = (ay, gun) => `${yil}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;

async function istAc(page) {
  await rafAc(page);
  await page.click('.nav-btn[data-act="sekme"][data-v="ist"]');
}

test.describe('G114 iki rakamın ayrımı (v121)', () => {

  test('A) sıklık satırı ekranda ve sayı bağımsız hesapla uyuyor', async ({ page }) => {
    /* 4 kitap bu yıl bitmiş → sıklık = yuvarla(gunNo / 4) */
    await tohumla(page, [
      bitmis('A', g(1, 10)), bitmis('B', g(2, 10)), bitmis('C', g(3, 10)), bitmis('D', g(4, 10))
    ]);
    await istAc(page);
    const satir = page.locator('#istSiklik');
    await expect(satir).toBeVisible();
    await expect(satir).toContainText(`Yılın ${gunNo} gününde 4 kitap`);
    await expect(satir).toContainText(`${Math.max(1, Math.round(gunNo / 4))} günde bir`);
  });

  test('B) bitirme süresi notu TABANI açıkça yazar (kaç kitaptan, kaç bitmişin içinden, hangi aralıkta)', async ({ page }) => {
    /* 5 bitmiş, yalnız 2'sinde başlama tarihi — Kaan'ın verisinin küçük ölçeği */
    await tohumla(page, [
      bitmis('A', g(3, 1)), bitmis('B', g(4, 1)), bitmis('C', g(5, 1)),
      bitmis('D', g(8, 21), g(8, 18)),      // 3 gün
      bitmis('E', g(8, 31), g(8, 24))       // 7 gün
    ]);
    await istAc(page);
    const not = page.locator('#istSureTaban');
    await expect(not).toContainText('5 gün');                 // (3+7)/2
    await expect(not).toContainText('başlama tarihi girilen');
    await expect(not).toContainText('2 kitaptan');
    await expect(not).toContainText('5 bitmişin içinden');    // TOPLAM da yazılı
    await expect(not).toContainText('21 Ağu');                // aralığın iki ucu
    await expect(not).toContainText('31 Ağu');
  });

  test('C) iki rakamın FARKI aynı yerde adlandırılır', async ({ page }) => {
    await tohumla(page, [
      bitmis('A', g(3, 1)), bitmis('B', g(4, 1)),
      bitmis('C', g(8, 21), g(8, 18))
    ]);
    await istAc(page);
    const ayrim = page.locator('#istSureAyrim');
    await expect(ayrim).toBeVisible();
    await expect(ayrim).toContainText('arasındaki');
    await expect(ayrim).toContainText('dahil değil');
    /* Köprü: bitirme süresinin yanında SIKLIK da yazılı olmalı, yoksa okuyan
       iki sayıyı yine ayrı ayrı okur. */
    await expect(ayrim).toContainText(`${Math.max(1, Math.round(gunNo / 3))} günde bir`);
  });

  test('D) süreli kitap yoksa bitirme süresi bloğu HİÇ çıkmaz (uydurulmaz)', async ({ page }) => {
    await tohumla(page, [bitmis('A', g(3, 1)), bitmis('B', g(4, 1))]);
    await istAc(page);
    await expect(page.locator('#istBitirmeSuresi')).toHaveCount(0);
    await expect(page.locator('#istSureTaban')).toHaveCount(0);
    await expect(page.locator('#istSiklik')).toBeVisible();     // sıklık yine de var
  });

  test('E) bu yıl hiç bitmiş yoksa sıklık satırı ÇIKMAZ', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Eski', durum: 'bitti', bitisTarihi: (yil - 3) + '-05-05', sayfa: 200 })
    ]);
    await istAc(page);
    await expect(page.locator('#istSiklik')).toHaveCount(0);
  });

});
