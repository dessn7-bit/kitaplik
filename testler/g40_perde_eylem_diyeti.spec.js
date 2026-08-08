'use strict';
/* G40 — v46: (D1) pencere perdesi sıcak kağıt gölgesi — nötr gri DEĞİL, tüm
   pencere tiplerinde AYNI değer (tek --ortu-perde değişkeni). (D2) detay eylem
   diyeti: İLERLEME→künye arası ≤110px, ana eylem alanında ≤2 görünür düğme,
   oturum kapalıyken tam genişlik başlatma düğmesi YOK (ghost bağlantı). */
const { test, expect, tohumla, sahteKitap, rafAc } = require('./yardim');

function perdeCoz(s) {
  const m = String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
}

function okunanK(ek) {
  return sahteKitap(Object.assign({ ad: 'Diyet Kitabı', yazar: 'Y', durum: 'okunuyor',
    sayfa: 400, guncelSayfa: 100, baslamaTarihi: '2026-01-01', yil: 1990, tur: 'roman',
    raf: 'üst raf' }, ek || {}));
}

test.describe('G40 perde + eylem diyeti', () => {

  /* ---------- D1 perde ---------- */

  for (const tema of ['acik', 'karanlik']) {
    test(`perde sıcak kağıt gölgesi, tüm pencerelerde AYNI (${tema})`, async ({ page }) => {
      await tohumla(page, [okunanK()], { kk_tema_v1: tema });
      await rafAc(page);
      // dinamik bir örtü de üretilsin (gorunum.js toplu penceresi)
      await page.click('#secimBtn');
      await page.click('#liste .kart');
      await page.click('[data-act="toplu-raf"]');
      await expect(page.locator('#topluOrtu')).toHaveClass(/acik/);
      const o = await page.evaluate(() => {
        const renkler = [...document.querySelectorAll('.ortu')].map(e =>
          ({ id: e.id, z: getComputedStyle(e).backgroundColor }));
        return { renkler, adet: renkler.length };
      });
      expect(o.adet, 'statik + dinamik örtüler ölçüldü').toBeGreaterThanOrEqual(6);
      const ilk = o.renkler[0].z;
      for (const r of o.renkler)
        expect(r.z, `${r.id || '(dinamik)'} perdesi farklı`).toBe(ilk);
      const c = perdeCoz(ilk);
      expect(c, 'perde çözümlenemedi: ' + ilk).not.toBeNull();
      // SICAK: nötr gri değil — kanallar R > G > B, kırmızı-mavi farkı belirgin
      expect(c.r, `R>G değil (${ilk})`).toBeGreaterThan(c.g);
      expect(c.g, `G>B değil (${ilk})`).toBeGreaterThan(c.b);
      expect(c.r - c.b, `sıcak fark zayıf (${ilk})`).toBeGreaterThanOrEqual(15);
      // ayrım: perde yeterince koyu (alfa) — pencere/arka plan ayrımı net
      expect(c.a).toBeGreaterThanOrEqual(0.45);
    });
  }

  /* ---------- D2 yükseklik + düğme sayısı ---------- */

  test('İLERLEME ile künye tablosu arası ≤110px (eşik: iki tasarım satırı + nefes)', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await tohumla(page, [okunanK()]);
    await rafAc(page);
    await page.click('#liste .kart');
    await expect(page.locator('#oturumBlok')).toBeVisible();
    const aralik = await page.evaluate(() => {
      const alt = document.getElementById('dIlerlemeBolum').getBoundingClientRect().bottom;
      const ust = document.getElementById('dKunyeBlok').getBoundingClientRect().top;
      return Math.round(ust - alt);
    });
    expect(aralik, `İlerleme→künye ${aralik}px`).toBeLessThanOrEqual(110);
  });

  const eylemAlaniDugme = async (page) =>
    await page.evaluate(() => {
      const say = kap => kap
        ? [...kap.querySelectorAll('.btn')].filter(e => e.offsetParent !== null &&
            e.getBoundingClientRect().height > 0).length : 0;
      return say(document.querySelector('#detayIcerik .d-eylem'))
        + say(document.getElementById('oturumBlok'));
    });

  for (const [durum, beklenen, ek] of [
    ['okunuyor', 2, {}],
    ['okunacak', 1, { durum: 'okunacak', guncelSayfa: 0, baslamaTarihi: null }],
    ['yarim', 1, { durum: 'yarim', bitisTarihi: '2026-02-01' }],
    ['bitti', 1, { durum: 'bitti', guncelSayfa: 400, bitisTarihi: '2026-02-01' }]
  ]) {
    test(`${durum}: ana eylem alanında görünür düğme ≤2 (=${beklenen})`, async ({ page }) => {
      await tohumla(page, [okunanK(ek)]);
      await rafAc(page);
      await page.click('#liste .kart');
      await expect(page.locator('#oturumBlok')).toBeVisible();
      expect(await eylemAlaniDugme(page)).toBe(beklenen);
      expect(await eylemAlaniDugme(page)).toBeLessThanOrEqual(2);
    });
  }

  /* ---------- D2 oturum erişimi ---------- */

  test('oturum kapalıyken tam genişlik başlatma düğmesi YOK; ghost ile başlar', async ({ page }) => {
    await tohumla(page, [okunanK()]);
    await rafAc(page);
    await page.click('#liste .kart');
    await expect(page.locator('#oturumBlok')).toBeVisible();
    // blokta .btn yok; başlatma ghost bağlantı
    expect(await page.locator('#oturumBlok .btn:visible').count()).toBe(0);
    const ghost = page.locator('#oturumBlok [data-act="oturum-basla"]');
    await expect(ghost).toHaveClass(/d-ghost/);
    await ghost.click();
    // açıkken: sayaç + Bitir (tek görünür pirinç) görünür
    await expect(page.locator('#oturumSayac')).toBeVisible();
    await expect(page.locator('#oturumBlok [data-act="oturum-bitir"]')).toBeVisible();
    await expect(page.locator('#oturumBlok [data-act="oturum-bitir"]')).toHaveClass(/btn-brass/);
    // g19/g20 kuralı: çekirdek sayfa girişi gizli
    await expect(page.locator('#dIlerlemeKutu')).toBeHidden();
  });

  test('okunacak kitapta da süre tutma erişilebilir (ghost) ve durumu okunuyor yapar', async ({ page }) => {
    await tohumla(page, [okunanK({ durum: 'okunacak', guncelSayfa: 0, baslamaTarihi: null })]);
    await rafAc(page);
    await page.click('#liste .kart');
    await expect(page.locator('#oturumBlok [data-act="oturum-basla"]')).toBeVisible();
    await page.click('#oturumBlok [data-act="oturum-basla"]');
    await expect(page.locator('#oturumSayac')).toBeVisible();
    expect(await page.evaluate(() => veri.kitaplar[0].durum)).toBe('okunuyor');
  });

  /* ---------- D2 sayfa işaretleme akışı ---------- */

  test('sayfa işaretleme: Sayfa işaretle → giriş açılır → Kaydet yazar; yeniden çizimde kapalı döner', async ({ page }) => {
    await tohumla(page, [okunanK()]);
    await rafAc(page);
    await page.click('#liste .kart');
    await expect(page.locator('#dSayfaSatir')).toBeHidden();
    await page.click('[data-act="d-sayfa-ac"]');
    await expect(page.locator('#dSayfaSatir')).toBeVisible();
    await page.fill('#d-sayfa', '160');
    await page.click('[data-act="ilerleme-kaydet"]');
    expect(await page.evaluate(() => veri.kitaplar[0].guncelSayfa)).toBe(160);
    // detay yeniden çizildi: ilerleme güncel, giriş satırı yine kapalı
    await expect(page.locator('#dIlerlemeBolum .ilerleme-txt')).toContainText('160 / 400');
    await expect(page.locator('#dSayfaSatir')).toBeHidden();
  });

  test('hız analizi İLERLEME içinde sessiz satır (ayrı kutu değil)', async ({ page }) => {
    await tohumla(page, [okunanK({ seanslar: [
      { t: '2026-08-01', a: 0, b: 40 }, { t: '2026-08-05', a: 40, b: 100 }] })]);
    await rafAc(page);
    await page.click('#liste .kart');
    await expect(page.locator('#dIlerlemeBolum .d-hiz-not')).toContainText('sayfa/gün');
    // eylem alanında hız kutusu yok
    expect(await page.locator('#detayIcerik .d-eylem .hiz-kutu').count()).toBe(0);
  });
});
