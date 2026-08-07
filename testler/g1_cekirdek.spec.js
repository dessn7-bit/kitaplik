'use strict';
const { test, expect, tohumla, sahteKitap,
  onaylariKabulEt, bugunISO, rafAc, ayrintilarAc } = require('./yardim');

test.describe('G1 çekirdek', () => {

  test('boş raf mesajı görünür', async ({ page }) => {
    await rafAc(page);
    await expect(page.locator('#liste')).toContainText('Raf henüz boş.');
  });

  test('boş adla kaydetme reddedilir', async ({ page }) => {
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await page.click('[data-act="form-kaydet"]');
    await expect(page.locator('#toast')).toContainText('Kitap adı boş olamaz');
    await expect(page.locator('#ortuForm')).toHaveClass(/acik/); // form kapanmadı
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(0);
  });

  test('kitap ekleme: listede görünür ve localStorage\'a yazılır', async ({ page }) => {
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await ayrintilarAc(page);
    await page.fill('#f-ad', 'Varlık ve Zaman');
    await page.fill('#f-yazar', 'Martin Heidegger');
    await page.click('[data-act="form-kaydet"]');
    await expect(page.locator('#toast')).toContainText('Kitap rafa eklendi');
    await expect(page.locator('#liste .kart-baslik')).toHaveText('Varlık ve Zaman');
    const depo = await page.evaluate(() => JSON.parse(localStorage.getItem('kk_kitaplik_v1')));
    expect(depo.kitaplar.length).toBe(1);
    expect(depo.kitaplar[0].ad).toBe('Varlık ve Zaman');
  });

  test('XSS: kitap adındaki HTML kaçışlanır, çalışmaz', async ({ page }) => {
    await rafAc(page);
    const saldiri = '<img src=x onerror="window.__xss=1">';
    await page.click('.fab[data-act="yeni"]');
    await page.fill('#f-ad', saldiri);
    await page.click('[data-act="form-kaydet"]');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    // metin olarak aynen görünmeli, HTML olarak yorumlanmamalı
    await expect(page.locator('#liste .kart-baslik')).toHaveText(saldiri);
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(await page.locator('#liste .kart-baslik img').count()).toBe(0);
  });

  test('düzenleme: alanlar dolu gelir, kayıt güncellenir', async ({ page }) => {
    const k = sahteKitap({ ad: 'Eski Ad', yazar: 'Yazar A', sayfa: 200 });
    await tohumla(page, [k]);
    await rafAc(page);
    await page.click('#liste .kart');
    await page.click('#dDigerKatla summary');  // Düzenle/Sil nadir bölümde katlı
    await page.click('[data-act="duzenle"]');
    // M3'ten beri 'duzenle' detay örtüsünü kapatıyor; form doğrudan erişilebilir.
    await expect(page.locator('#f-ad')).toHaveValue('Eski Ad');
    await expect(page.locator('#f-yazar')).toHaveValue('Yazar A');
    await expect(page.locator('#f-sayfa')).toHaveValue('200');
    await page.fill('#f-ad', 'Yeni Ad');
    await page.click('[data-act="form-kaydet"]');
    await expect(page.locator('#toast')).toContainText('Kitap güncellendi');
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(1);
    expect(await page.evaluate(() => veri.kitaplar[0].ad)).toBe('Yeni Ad');
  });

  test('silme: kitap listeden ve depodan gider', async ({ page }) => {
    onaylariKabulEt(page);
    await tohumla(page, [sahteKitap({ ad: 'Silinecek' })]);
    await rafAc(page);
    await page.click('#liste .kart');
    await page.click('#dDigerKatla summary');  // Sil nadir bölümde katlı
    await page.click('[data-act="kitap-sil"]');
    await expect(page.locator('#toast')).toContainText('Kitap silindi');
    await expect(page.locator('#liste')).toContainText('Raf henüz boş.');
    const depo = await page.evaluate(() => JSON.parse(localStorage.getItem('kk_kitaplik_v1')));
    expect(depo.kitaplar.length).toBe(0);
  });

  test('TR arama: büyük/küçük harf TR kurallarıyla eşleşir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Varlık ve Zaman', yazar: 'Martin Heidegger' })]);
    await rafAc(page);
    // küçük harf
    await page.fill('#arama', 'heidegger');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    // TR büyük harf (İ noktalı — TR klavyede büyük i budur)
    await page.fill('#arama', 'HEİDEGGER');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    // ASCII büyük I ile de bulunur (G19 M1'den beri katla() i-ailesini birleştiriyor).
    // Eskiden tr-locale küçültme "I"yı "ı" yaptığı için bu arama BOŞ dönüyordu.
    await page.fill('#arama', 'HEIDEGGER');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
  });

  test('yayınevi ve raf üzerinden arama çalışır', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Kitap Bir', yayinevi: 'Can Yayınları', raf: 'üst raf sol' }),
      sahteKitap({ ad: 'Kitap İki', yayinevi: 'İletişim', raf: 'alt raf' })
    ]);
    await rafAc(page);
    await page.fill('#arama', 'Can Yayınları');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste .kart-baslik')).toHaveText('Kitap Bir');
    await page.fill('#arama', 'üst raf');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste .kart-baslik')).toHaveText('Kitap Bir');
  });

  test('durum filtreleri doğru süzer', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Okunuyor Kitabı', durum: 'okunuyor', baslamaTarihi: bugunISO(-3) }),
      sahteKitap({ ad: 'Okunacak Kitabı', durum: 'okunacak' }),
      sahteKitap({ ad: 'Biten Kitap', durum: 'bitti', bitisTarihi: bugunISO(-1) }),
      sahteKitap({ ad: 'Yarım Kitap', durum: 'yarim' })
    ]);
    await rafAc(page);
    await expect(page.locator('#liste .kart')).toHaveCount(4);
    const beklenen = { okunuyor: 'Okunuyor Kitabı', okunacak: 'Okunacak Kitabı', bitti: 'Biten Kitap', yarim: 'Yarım Kitap' };
    for (const [filtre, ad] of Object.entries(beklenen)) {
      await page.click(`[data-act="filtre"][data-v="${filtre}"]`);
      await expect(page.locator('#liste .kart')).toHaveCount(1);
      await expect(page.locator('#liste .kart-baslik')).toHaveText(ad);
    }
    await page.click('[data-act="filtre"][data-v="hepsi"]');
    await expect(page.locator('#liste .kart')).toHaveCount(4);
  });

  test('bitiş tarihi başlamadan önceyse kayıt reddedilir', async ({ page }) => {
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await ayrintilarAc(page);
    await page.fill('#f-ad', 'Tarih Testi');
    await page.click('[data-act="f-durum"][data-v="bitti"]');
    await page.fill('#f-bas', '2026-08-02');
    await page.fill('#f-bit', '2026-08-01');
    await page.click('[data-act="form-kaydet"]');
    await expect(page.locator('#toast')).toContainText('Bitiş tarihi başlamadan önce olamaz');
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(0);
  });
});
