'use strict';
const { test, expect, tohumla, sahteKitap } = require('./yardim');

function alintiliKitap(ad, metin, fikir) {
  return sahteKitap({ ad, notlar: [{ id: 'n' + Math.random().toString(36).slice(2, 8),
    tip: 'alinti', metin, tarih: '2026-08-01', sayfa: null, fikir: fikir || [] }] });
}

async function alintiSekmesi(page) {
  await page.click('[data-act="sekme"][data-v="alinti"]');
  await expect(page.locator('#fikirBulut')).toBeVisible();
}

test.describe('G7 fikir defteri', () => {

  test('alıntıya etiket eklenir, nota işlenir', async ({ page }) => {
    await tohumla(page, [alintiliKitap('Kitap Bir', 'Varlık zamandır.')]);
    await page.goto('/');
    await alintiSekmesi(page);
    await expect(page.locator('.fikir-giris')).toHaveCount(1);
    await page.fill('.fikir-giris', 'varoluş');
    await page.click('[data-act="fikir-ekle"]');
    await expect(page.locator('#toast')).toContainText('Fikir eklendi: #varoluş');
    expect(await page.evaluate(() => veri.kitaplar[0].notlar[0].fikir)).toEqual(['varoluş']);
  });

  test('aynı etiket iki farklı kitapta → bulutta 2 kayıt / 2 kitap görünür', async ({ page }) => {
    await tohumla(page, [
      alintiliKitap('Kitap Bir', 'İlk alıntı metni.', ['ortak-fikir']),
      alintiliKitap('Kitap İki', 'İkinci alıntı metni.', ['ortak-fikir'])
    ]);
    await page.goto('/');
    await alintiSekmesi(page);
    const cip = page.locator('#fikirBulut [data-act="fikir-filtre"][data-v="ortak-fikir"]');
    await expect(cip).toBeVisible();
    await expect(cip).toContainText('2/2'); // 2 kayıt / 2 kitap
  });

  test('"#" ön eki temizlenir, TR büyük/küçük mükerrer engellenir', async ({ page }) => {
    await tohumla(page, [alintiliKitap('Kitap Bir', 'Metin.')]);
    await page.goto('/');
    await alintiSekmesi(page);
    await page.fill('.fikir-giris', '#Varlık');
    await page.click('[data-act="fikir-ekle"]');
    await expect.poll(() => page.evaluate(() => veri.kitaplar[0].notlar[0].fikir)).toEqual(['Varlık']);
    // TR küçük hali mükerrer sayılmalı
    await page.fill('.fikir-giris', 'varlık');
    await page.click('[data-act="fikir-ekle"]');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => veri.kitaplar[0].notlar[0].fikir)).toEqual(['Varlık']);
  });

  test('etikete tıklayınca sadece o etiketli kayıtlar görünür', async ({ page }) => {
    await tohumla(page, [
      alintiliKitap('Kitap Bir', 'Etiketli alıntı.', ['felsefe']),
      alintiliKitap('Kitap İki', 'Etiketsiz alıntı.')
    ]);
    await page.goto('/');
    await alintiSekmesi(page);
    await page.click('[data-act="fikir-filtre"][data-v="felsefe"]');
    await expect(page.locator('#fikirBaslik')).toContainText('Fikir: #felsefe');
    await expect(page.locator('#alintiIcerik .not-kart:visible')).toHaveCount(1);
    await expect(page.locator('#alintiIcerik .not-kart:visible')).toContainText('Etiketli alıntı.');
  });

  test('"Tüm fikirler"e dönünce tüm kartlar geri görünür', async ({ page }) => {
    await tohumla(page, [
      alintiliKitap('Kitap Bir', 'Etiketli alıntı.', ['felsefe']),
      alintiliKitap('Kitap İki', 'Etiketsiz alıntı.')
    ]);
    await page.goto('/');
    await alintiSekmesi(page);
    await page.click('[data-act="fikir-filtre"][data-v="felsefe"]');
    await expect(page.locator('#alintiIcerik .not-kart:visible')).toHaveCount(1);
    await page.click('[data-act="fikir-filtre"][data-v=""]');
    await expect(page.locator('#alintiIcerik .not-kart:visible')).toHaveCount(2); // gizli kalan yok
  });

  test('etiket silinince sayım güncellenir', async ({ page }) => {
    await tohumla(page, [
      alintiliKitap('Kitap Bir', 'Birinci.', ['gecici']),
      alintiliKitap('Kitap İki', 'İkinci.', ['gecici'])
    ]);
    await page.goto('/');
    await alintiSekmesi(page);
    await expect(page.locator('[data-act="fikir-filtre"][data-v="gecici"]')).toContainText('2/2');
    await page.click('[data-act="fikir-sil"] >> nth=0');
    await expect(page.locator('#toast')).toContainText('Fikir etiketi kaldırıldı');
    await expect(page.locator('[data-act="fikir-filtre"][data-v="gecici"]')).not.toContainText('2/2');
    const kalan = await page.evaluate(() =>
      veri.kitaplar.reduce((t, k) => t + k.notlar.reduce((s, n) => s + n.fikir.length, 0), 0));
    expect(kalan).toBe(1);
  });

  test('sayfa yenilendiğinde etiketler korunur', async ({ page }) => {
    await tohumla(page, [alintiliKitap('Kalıcı Kitap', 'Kalıcı metin.')]);
    await page.goto('/');
    await alintiSekmesi(page);
    await page.fill('.fikir-giris', 'kalıcı-fikir');
    await page.click('[data-act="fikir-ekle"]');
    await expect.poll(() => page.evaluate(() => veri.kitaplar[0].notlar[0].fikir.length)).toBe(1);
    await page.reload();
    // kitapNormalize fikir alanını elememeli (index.html'deki koruma yaması)
    expect(await page.evaluate(() => veri.kitaplar[0].notlar[0].fikir)).toEqual(['kalıcı-fikir']);
  });
});
