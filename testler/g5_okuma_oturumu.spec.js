'use strict';
const { test, expect, tohumla, sahteKitap, onaylariKabulEt, bugunISO } = require('./yardim');

test.describe('G5 okuma oturumu', () => {

  test('oturum başlatınca durum "okunuyor" olur, başlama tarihi yazılır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Oturum Kitabı', durum: 'okunacak', sayfa: 300 })]);
    await page.goto('/');
    await page.click('#liste .kart');
    await page.click('[data-act="oturum-basla"]');
    await expect(page.locator('#toast')).toContainText('Süre başladı');
    expect(await page.evaluate(() => veri.kitaplar[0].durum)).toBe('okunuyor');
    expect(await page.evaluate(() => veri.kitaplar[0].baslamaTarihi)).toBe(bugunISO());
    const acik = await page.evaluate(() => window.__oturum.acikOturum());
    expect(acik).not.toBeNull();
    expect(acik.kitapId).toBe(await page.evaluate(() => veri.kitaplar[0].id));
  });

  test('bitirince süre ve sayfa aralığı kaydedilir, guncelSayfa ilerler', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Biten Oturum', durum: 'okunuyor',
      sayfa: 300, guncelSayfa: 40, baslamaTarihi: bugunISO(-2) })]);
    await page.goto('/');
    await page.click('#liste .kart');
    await page.click('[data-act="oturum-basla"]');
    await expect(page.locator('#oturumSayfa')).toBeVisible();
    await page.fill('#oturumSayfa', '120');
    await page.click('[data-act="oturum-bitir"]');
    await expect(page.locator('#toast')).toContainText('okudun');
    const o = await page.evaluate(() => veri.kitaplar[0].oturumlar[0]);
    expect(o.sa).toBe(40);
    expect(o.sb).toBe(120);
    expect(o.s).toBeGreaterThanOrEqual(0);
    expect(o.b).toBeGreaterThan(0);
    expect(o.sup).toBeUndefined();
    expect(await page.evaluate(() => veri.kitaplar[0].guncelSayfa)).toBe(120);
    expect(await page.evaluate(() => window.__oturum.acikOturum())).toBeNull();
  });

  test('hız hesabı doğru: 50 dk\'da 120 sayfa → 144 sayfa/saat', async ({ page }) => {
    await page.goto('/');
    const hiz = await page.evaluate(() =>
      window.__oturum.hizSayfaSaat({ oturumlar: [{ b: 1754000000000, s: 50 * 60000, sa: 0, sb: 120 }] }));
    expect(hiz).toBe(144);
  });

  test('başka kitapta açık oturum varken ikinci kitapta başlatılamaz', async ({ page }) => {
    const a = sahteKitap({ ad: 'Açık Oturumlu', durum: 'okunuyor', baslamaTarihi: bugunISO(-1) });
    const b = sahteKitap({ ad: 'İkinci Kitap', durum: 'okunacak' });
    await tohumla(page, [a, b], { kk_oturum_v1: { kitapId: a.id, b: Date.now() - 60000, sa: 0 } });
    await page.goto('/');
    await page.click(`#liste .kart[data-id="${b.id}"]`);
    await expect(page.locator('#oturumBlok')).toContainText('Başka bir kitapta açık oturum var');
    expect(await page.locator('#oturumBlok [data-act="oturum-basla"]').count()).toBe(0);
  });

  test('iptal edilen oturum kaydedilmez', async ({ page }) => {
    onaylariKabulEt(page);
    await tohumla(page, [sahteKitap({ ad: 'İptal Kitabı', durum: 'okunuyor', baslamaTarihi: bugunISO(-1) })]);
    await page.goto('/');
    await page.click('#liste .kart');
    await page.click('[data-act="oturum-basla"]');
    await page.click('[data-act="oturum-iptal"]');
    await expect(page.locator('#toast')).toContainText('Oturum iptal edildi');
    expect(await page.evaluate(() => window.__oturum.acikOturum())).toBeNull();
    expect(await page.evaluate(() => veri.kitaplar[0].oturumlar.length)).toBe(0);
  });

  test('4 saatten uzun açık oturum otomatik kapanır, sup:true, istatistiğe katılmaz', async ({ page }) => {
    const k = sahteKitap({ ad: 'Unutulan Oturum', durum: 'okunuyor', baslamaTarihi: bugunISO(-1) });
    await tohumla(page, [k],
      { kk_oturum_v1: { kitapId: k.id, b: Date.now() - 5 * 3600000, sa: 10 } });
    await page.goto('/');
    await expect.poll(() => page.evaluate(() => veri.kitaplar[0].oturumlar.length)).toBe(1);
    const o = await page.evaluate(() => veri.kitaplar[0].oturumlar[0]);
    expect(o.sup).toBe(true);
    expect(o.s).toBe(4 * 3600000); // 4 saatlik sınırla kırpıldı
    expect(o.sa).toBe(10);
    expect(o.sb).toBe(10); // sayfa ilerletilmedi
    expect(await page.evaluate(() => window.__oturum.acikOturum())).toBeNull();
    // istatistiğe katılmaz
    expect(await page.evaluate(() => window.__oturum.toplamSure(veri.kitaplar[0]))).toBe(0);
  });

  test('sayfa yenilendiğinde oturum kayıtları korunur', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Kalıcı Oturum', durum: 'okunuyor', sayfa: 200,
      baslamaTarihi: bugunISO(-3),
      oturumlar: [{ b: Date.now() - 86400000, s: 30 * 60000, sa: 0, sb: 45 }] })]);
    await page.goto('/');
    expect(await page.evaluate(() => veri.kitaplar[0].oturumlar.length)).toBe(1);
    await page.reload();
    const o = await page.evaluate(() => veri.kitaplar[0].oturumlar[0]);
    expect(o.sb).toBe(45); // kitapNormalize elemedi
    expect(await page.evaluate(() => window.__oturum.toplamSure(veri.kitaplar[0]))).toBe(30 * 60000);
  });
});
