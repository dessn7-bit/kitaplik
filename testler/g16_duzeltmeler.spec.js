'use strict';
const { test, expect, tohumla, sahteKitap,
  onaylariKabulEt, rafAc, rafYenile, ayarlarAc, tehlikeAc } = require('./yardim');

const YIL = new Date().getFullYear();

/* --------- D1: istek rozeti listede --------- */
test.describe('G16 D1 — istek listesi rozeti liste kartlarında', () => {

  test('liste görünümü: istek kitabında rozet var, sahip olunanda yok', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ id: 'sh', ad: 'Bendeki Kitap', sahiplik: 'sahip' }),
      sahteKitap({ id: 'is', ad: 'İstediğim Kitap', sahiplik: 'istek' })
    ]);
    await rafAc(page);
    // Sprint IA: varsayılan "Bende olanlar" — istek kitabını görmek için tüm rafa geç
    await page.click('[data-act="vm-sahiplik"][data-v="hepsi"]');
    await expect(page.locator('#liste .kart[data-id="is"] .vm-rozet')).toHaveCount(1);
    await expect(page.locator('#liste .kart[data-id="is"] .vm-rozet')).toContainText('İstek');
    await expect(page.locator('#liste .kart[data-id="sh"] .vm-rozet')).toHaveCount(0);
  });

  test('ızgara görünümü: istek kitabı köşe işaretiyle ayırt edilir', async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem('kk_gorunum_v1', JSON.stringify({ izgara: true })));
    await tohumla(page, [
      sahteKitap({ id: 'sh', ad: 'Bendeki Kitap', sahiplik: 'sahip' }),
      sahteKitap({ id: 'is', ad: 'İstediğim Kitap', sahiplik: 'istek' })
    ]);
    await rafAc(page);
    // Sprint IA: varsayılan "Bende olanlar" — istek kitabını görmek için tüm rafa geç
    await page.click('[data-act="vm-sahiplik"][data-v="hepsi"]');
    await expect(page.locator('#liste')).toHaveClass(/izgara/);
    await expect(page.locator('#liste .kart[data-id="is"] .vm-iz-istek')).toBeVisible();
    await expect(page.locator('#liste .kart[data-id="sh"] .vm-iz-istek')).toHaveCount(0);
  });
});

/* --------- D2: tümünü sil üst düzey alanları korur --------- */
test.describe('G16 D2 — kütüphaneyi boşalt', () => {

  test('mezar taşları doğru üretilir, hedefler korunur', async ({ page }) => {
    onaylariKabulEt(page);
    const a = sahteKitap({ id: 'ka', ad: 'Kitap A' });
    const b = sahteKitap({ id: 'kb', ad: 'Kitap B' });
    await tohumla(page, { kitaplar: [a, b], hedef: { [YIL]: 24 }, hedefG: { [YIL]: 111 },
      hedefSayfa: { [YIL]: 9000 }, hedefSayfaG: { [YIL]: 222 }, silinenler: { eski: 55 } });
    await rafAc(page);
    await page.evaluate(() => depoKaydet());        // anlık görüntü tabanı
    await ayarlarAc(page);
    await tehlikeAc(page);
    await page.click('[data-act="tumunu-sil"]');
    await expect(page.locator('#toast')).toContainText('boşaltıldı');
    const s = await page.evaluate(() => ({
      kitap: veri.kitaplar.length,
      mezar: Object.keys(veri.silinenler || {}).sort(),
      hedef: veri.hedef, hedefG: veri.hedefG,
      hedefSayfa: veri.hedefSayfa, hedefSayfaG: veri.hedefSayfaG
    }));
    expect(s.kitap).toBe(0);
    expect(s.mezar).toEqual(['eski', 'ka', 'kb']);   // eski taş korundu + iki yeni taş
    expect(s.hedef[YIL]).toBe(24);
    expect(s.hedefSayfa[YIL]).toBe(9000);
    expect(s.hedefG[YIL]).toBe(111);
    expect(s.hedefSayfaG[YIL]).toBe(222);
  });

  test('yenileme sonrası tutarlı: mezar taşları ve hedefler yerinde', async ({ page }) => {
    onaylariKabulEt(page);
    await tohumla(page, { kitaplar: [sahteKitap({ id: 'kx', ad: 'Kitap X' })],
      hedef: { [YIL]: 12 }, hedefG: { [YIL]: 111 }, hedefSayfa: { [YIL]: 3000 },
      hedefSayfaG: { [YIL]: 222 }, silinenler: {} });
    await rafAc(page);
    await page.evaluate(() => depoKaydet());
    await ayarlarAc(page);
    await tehlikeAc(page);
    await page.click('[data-act="tumunu-sil"]');
    await rafYenile(page);
    const s = await page.evaluate(() => ({
      kitap: veri.kitaplar.length, mezarVar: !!(veri.silinenler || {}).kx,
      hedef: veri.hedef[String(new Date().getFullYear())],
      hedefSayfa: veri.hedefSayfa[String(new Date().getFullYear())]
    }));
    expect(s.kitap).toBe(0);
    expect(s.mezarVar).toBe(true);       // silinen kitap senkronda geri dirilmez
    expect(s.hedef).toBe(12);
    expect(s.hedefSayfa).toBe(3000);
  });
});

/* --------- D3: eksik cilt gürültüsü --------- */
function seriKitap(ad, ciltNo) {
  return sahteKitap({ ad, seri: 'Seri X', ciltNo });
}
async function seriDetayAc(page, kitaplar) {
  await tohumla(page, kitaplar);
  await rafAc(page);
  await page.click(`#liste .kart[data-id="${kitaplar[0].id}"]`);
  await page.click('#dSeriKatla summary');   // seri nadir bölümde katlı
  await expect(page.locator('#detayIcerik .vm-seri-kutu')).toBeVisible();
}

test.describe('G16 D3 — eksik cilt yalnız aradaki boşluklar', () => {

  test('3,4,6 → yalnız 5 eksik (1 ve 2 sayılmaz)', async ({ page }) => {
    await seriDetayAc(page, [seriKitap('C3', 3), seriKitap('C4', 4), seriKitap('C6', 6)]);
    await expect(page.locator('#detayIcerik .vm-eksik')).toContainText('Eksik cilt: 5');
    await expect(page.locator('#detayIcerik .vm-eksik')).not.toContainText('1');
    await expect(page.locator('#detayIcerik .vm-eksik')).not.toContainText('2');
  });

  test('1,2,4 → 3 eksik (davranış korundu)', async ({ page }) => {
    await seriDetayAc(page, [seriKitap('C1', 1), seriKitap('C2', 2), seriKitap('C4', 4)]);
    await expect(page.locator('#detayIcerik .vm-eksik')).toContainText('Eksik cilt: 3');
  });

  test('ardışık seride uyarı yok', async ({ page }) => {
    await seriDetayAc(page, [seriKitap('C2', 2), seriKitap('C3', 3), seriKitap('C4', 4)]);
    expect(await page.locator('#detayIcerik .vm-eksik').count()).toBe(0);
  });
});
