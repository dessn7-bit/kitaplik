'use strict';
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc } = require('./yardim');

/* Tarayıcı içinde gün anahtarı üretimi — oturum.js'in gunStr'ı ile aynı biçim */
const gunHaritasi = kaymalar => {
  const h = {};
  for (const kayma of kaymalar) {
    const d = new Date(); d.setDate(d.getDate() + kayma);
    const g = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
    h[g] = 30 * 60000;
  }
  return h;
};

test.describe('G6 seri ve istatistik', () => {

  test('üst üste okunan gün sayısı doğru (bugün+dün+önceki = 3)', async ({ page }) => {
    await rafAc(page);
    const seri = await page.evaluate(h => window.__oturum.seriHesapla(h), gunHaritasi([0, -1, -2]));
    expect(seri).toBe(3);
  });

  test('bugün okunmadıysa seri dünden sayılır', async ({ page }) => {
    await rafAc(page);
    const seri = await page.evaluate(h => window.__oturum.seriHesapla(h), gunHaritasi([-1, -2]));
    expect(seri).toBe(2); // bugün boş → ceza yok, dünden geriye 2
    const kirik = await page.evaluate(h => window.__oturum.seriHesapla(h), gunHaritasi([-1, -3]));
    expect(kirik).toBe(1); // araya boş gün girince seri kırılır
  });

  test('30 günlük ısı şeridi 30 kutu çizer', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Isı Kitabı', durum: 'okunuyor', baslamaTarihi: bugunISO(-5),
      oturumlar: [{ b: Date.now() - 86400000, s: 25 * 60000, sa: 0, sb: 30 }] })]);
    await rafAc(page);
    await page.click('[data-act="sekme"][data-v="ist"]');
    await expect(page.locator('#oturumIst')).toBeVisible();
    await expect(page.locator('#oturumIst [title]')).toHaveCount(30);
  });

  test('yıllık hedef kaydedilir, ilerleme ve projeksiyon görünür', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Hedef Kitabı', durum: 'bitti', bitisTarihi: bugunISO(-10) })]);
    await rafAc(page);
    await page.click('[data-act="sekme"][data-v="ist"]');
    await page.fill('#hedefInput', '24');
    await page.click('[data-act="hedef-kaydet"]');
    await expect(page.locator('#toast')).toContainText('hedefi: 24 kitap');
    const yil = new Date().getFullYear();
    expect(await page.evaluate(y => veri.hedef[y], yil)).toBe(24);
    await expect(page.locator('#istIcerik')).toContainText('1 / 24');
    await expect(page.locator('#istIcerik')).toContainText('Bu tempoyla'); // projeksiyon cümlesi
  });

  test('hedef kaydedilince okuma alışkanlığı kartı kaybolmaz', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Alışkanlık Kitabı', durum: 'okunuyor', baslamaTarihi: bugunISO(-5),
      oturumlar: [{ b: Date.now() - 2 * 86400000, s: 40 * 60000, sa: 0, sb: 50 }] })]);
    await rafAc(page);
    await page.click('[data-act="sekme"][data-v="ist"]');
    await expect(page.locator('#oturumIst')).toBeVisible();
    await page.fill('#hedefInput', '12');
    await page.click('[data-act="hedef-kaydet"]');
    // istCiz yeniden çizer; MutationObserver şeridi geri koymalı
    await expect(page.locator('#oturumIst')).toBeVisible();
    await expect(page.locator('#oturumIst')).toContainText('Okuma alışkanlığı');
  });
});
