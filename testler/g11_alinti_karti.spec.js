'use strict';
const { test, expect, tohumla, sahteKitap, rafAc } = require('./yardim');

function alintiliKitap(ek) {
  const notEk = (ek && ek.not) || {};
  return sahteKitap(Object.assign({
    ad: 'Varlık ve Zaman', yazar: 'Martin Heidegger',
    notlar: [Object.assign({ id: 'kn' + Math.random().toString(36).slice(2, 8),
      tip: 'alinti', metin: 'Dil, varlığın evidir.', tarih: '2026-08-01',
      sayfa: 42, fikir: [] }, notEk)]
  }, (ek && ek.kitap) || {}));
}

async function kartAc(page, kitaplar) {
  await tohumla(page, kitaplar || [alintiliKitap()]);
  await rafAc(page);
  await page.click('[data-act="sekme"][data-v="alinti"]');
  await page.click('[data-act="alinti-kart"] >> nth=0');
  await expect(page.locator('#kartOrtu')).toHaveClass(/acik/);
}

function pikselOzeti(page) {
  return page.evaluate(() => {
    const t = document.getElementById('kartTuval');
    const d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data;
    let koyu = 0;
    for (let i = 0; i < d.length; i += 40)
      if (d[i] < 100 && d[i + 1] < 100 && d[i + 2] < 100) koyu++;
    return { w: t.width, h: t.height, koyu };
  });
}

test.describe('G11 alıntı kartı', () => {

  test('alıntılar sekmesindeki karttan önizleme açılır', async ({ page }) => {
    await kartAc(page);
    await expect(page.locator('#kartTuval')).toBeVisible();
    await expect(page.locator('[data-act="kart-indir"]')).toBeVisible();
  });

  test('kitap detayındaki nottan önizleme açılır', async ({ page }) => {
    await tohumla(page, [alintiliKitap()]);
    await rafAc(page);
    await page.click('#liste .kart');
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await page.click('#detayIcerik [data-act="alinti-kart"]');
    await expect(page.locator('#kartOrtu')).toHaveClass(/acik/);
  });

  test('canvas 1080x1350 üretilir ve boş değildir', async ({ page }) => {
    await kartAc(page);
    const p = await pikselOzeti(page);
    expect(p.w).toBe(1080);
    expect(p.h).toBe(1350);
    expect(p.koyu).toBeGreaterThan(0); // zemin dışında koyu (mürekkep) piksel var
  });

  test('kare seçeneği 1080x1080 üretir', async ({ page }) => {
    await kartAc(page);
    await page.click('[data-act="kart-boyut"][data-v="kare"]');
    const p = await pikselOzeti(page);
    expect(p.w).toBe(1080);
    expect(p.h).toBe(1080);
    expect(p.koyu).toBeGreaterThan(0);
    const m = await page.evaluate(() => window.__kart.sonCizim());
    expect(m.boyut).toBe('kare');
  });

  test('1500 karakterlik alıntı taşmaz: son satır metin alanının içinde kalır', async ({ page }) => {
    const uzun = 'Varlık sorusu bugün unutulmuş bir sorudur ve yeniden sorulması gerekir. '.repeat(21); // ~1512 kr
    await kartAc(page, [alintiliKitap({ not: { metin: uzun } })]);
    const m = await page.evaluate(() => window.__kart.sonCizim());
    expect(m.sonSatirAlt).toBeLessThanOrEqual(m.metinAlt); // canvas ölçüsüyle: taşma YOK
    expect(m.fontBoyu).toBe(34);       // alt sınıra kadar küçüldü
    expect(m.kirpildi).toBe(true);     // yine sığmadı → kırpıldı + …
  });

  test('Türkçe karakterli alıntıda çizim hatasız tamamlanır', async ({ page }) => {
    const sayfaHatalari = [];
    const trMetin = 'Düşüncenin ışığında gölgeler çığlık atar; ölçüsüz öfke, şüphe ve umut iç içedir. ĞÜŞİÖÇ ğüşıöç.';
    await tohumla(page, [alintiliKitap({ not: { metin: trMetin } })]);
    page.on('pageerror', h => sayfaHatalari.push(String(h)));
    await rafAc(page);
    await page.click('[data-act="sekme"][data-v="alinti"]');
    await page.click('[data-act="alinti-kart"] >> nth=0');
    await expect(page.locator('#kartOrtu')).toHaveClass(/acik/);
    const p = await pikselOzeti(page);
    expect(p.koyu).toBeGreaterThan(0);
    expect(sayfaHatalari).toEqual([]);
    const m = await page.evaluate(() => window.__kart.sonCizim());
    expect(m.satirSayisi).toBeGreaterThan(0);
  });

  test('kitap adı, yazar ve sayfa numarası görselde yer alır', async ({ page }) => {
    await kartAc(page);
    const m = await page.evaluate(() => window.__kart.sonCizim());
    expect(m.altBilgi[0]).toBe('Varlık ve Zaman');
    expect(m.altBilgi[1]).toContain('Martin Heidegger');
    expect(m.altBilgi[1]).toContain('sf. 42');
  });

  test('PNG indirme tetiklenir', async ({ page }) => {
    await kartAc(page);
    const [indirme] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-act="kart-indir"]')
    ]);
    expect(indirme.suggestedFilename()).toBe('alinti-karti.png');
  });

  test('navigator.share yoksa Paylaş düğmesi görünmez', async ({ page }) => {
    await kartAc(page); // başsız Chromium'da navigator.share yok
    expect(await page.evaluate(() => !!navigator.share)).toBe(false); // ortam varsayımı doğrula
    await expect(page.locator('#kartPaylas')).toBeHidden();
    await expect(page.locator('[data-act="kart-indir"]')).toBeVisible(); // indirme her zaman var
  });

  test('sayfasız alıntıda "sf." yazmaz', async ({ page }) => {
    await kartAc(page, [alintiliKitap({ not: { sayfa: null } })]);
    const m = await page.evaluate(() => window.__kart.sonCizim());
    expect(m.altBilgi.join(' ')).not.toContain('sf.');
    expect(m.altBilgi[1]).toBe('Martin Heidegger'); // yazar tek başına kalır
  });
});
