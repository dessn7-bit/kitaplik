'use strict';
/* G113 (v120) — GERİ TUŞU
 *
 * NEDEN: Android'de geri tuşu nerede olunursa olunsun uygulamayı kapatıyordu.
 * Ölçüldü: depoda tek history çağrısı vardı (urlTemizle'nin replaceState'i),
 * hiç pushState yoktu — iki sekme geçişinden sonra history.length 2 → 2, artış 0.
 * Yani geri tuşunun tüketebileceği hiçbir uygulama-içi adım yoktu.
 *
 * KATMAN SIRASI (Esc ile aynı niyet, bir katman fazlası):
 *   1) açık pencere (AÇILIŞ sırasına göre en üstteki)
 *   2) çoklu seçim kipi
 *   3) sekme geçişi — KAAN KARARI: HER geçiş geçmişe yazılır
 *   4) çıkış — "tekrar bas" onayı
 *
 * Bu grup davranışı DONDURUR: özellikle (B) sekme yığınının tam olması ve
 * (E) UI kapanışından sonra ölü geri basışı OLMAMASI kilitli.
 */
const { test, expect, tohumla, sahteKitap, rafAc } = require('./yardim');

/* rafAc Ana Sayfa'dan Kütüphane'ye geçer → yığında zaten 1 sekme katmanı var. */
const derinlik = page => page.evaluate(() => window.__geri.derinlik());
const aktifSekme = page => page.evaluate(() => document.querySelector('.nav-btn.active').dataset.v);

test.describe('G113 geri tuşu (v120)', () => {

  test('A) sekme geçişi geçmişe yazılır, geri önceki sekmeye döner', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Geri Kitabı' })]);
    await rafAc(page);
    expect(await aktifSekme(page)).toBe('raf');

    await page.click('.nav-btn[data-act="sekme"][data-v="ist"]');
    expect(await aktifSekme(page)).toBe('ist');

    await page.goBack();
    await expect.poll(() => aktifSekme(page)).toBe('raf');
  });

  test('B) beş sekme gezildiğinde beş geri basışı sırayla geri alır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Geri Kitabı' })]);
    await page.goto('/');                       // Ana Sayfa, hiç katman yok
    expect(await derinlik(page)).toBe(0);

    const sira = ['raf', 'kesfet', 'alinti', 'ist'];
    for (const s of sira) await page.click(`.nav-btn[data-act="sekme"][data-v="${s}"]`);
    expect(await derinlik(page)).toBe(4);
    expect(await aktifSekme(page)).toBe('ist');

    /* Kaan'ın kararının bedeli burada donduruluyor: 4 geçiş = 4 geri basışı. */
    const geriSira = ['alinti', 'kesfet', 'raf', 'ana'];
    for (const beklenen of geriSira) {
      await page.goBack();
      await expect.poll(() => aktifSekme(page)).toBe(beklenen);
    }
    expect(await derinlik(page)).toBe(0);
  });

  test('C) açık pencere varken geri pencereyi kapatır, sekmeyi DEĞİŞTİRMEZ', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Geri Kitabı' })]);
    await rafAc(page);
    await page.click('.kart');
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);

    await page.goBack();
    await expect(page.locator('#ortuDetay')).not.toHaveClass(/acik/);
    expect(await aktifSekme(page)).toBe('raf');          // sekme korundu
  });

  test('D) iç içe pencerede geri yalnız ÜSTTEKİNİ kapatır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Geri Kitabı' })]);
    await rafAc(page);
    await page.click('.kart');
    /* Uygulamanın kendi yolu da tam olarak bu: o.classList.add('acik').
       MutationObserver'ı tetikler, yani gerçek açılış yoluyla aynı. */
    await page.evaluate(() => document.getElementById('ortuKapak').classList.add('acik'));
    await expect(page.locator('#ortuKapak')).toHaveClass(/acik/);

    await page.goBack();
    await expect(page.locator('#ortuKapak')).not.toHaveClass(/acik/);
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);   // alttaki DURUYOR
  });

  test('E) pencere ✕ ile kapandıktan sonra geri basışı ÖLÜ değildir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Geri Kitabı' })]);
    await rafAc(page);                                   // yığın: [sekme:ana]
    await page.click('.kart');
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    expect(await derinlik(page)).toBe(2);

    await page.click('#ortuDetay .sheet-kapat');         // UI kendi kapattı
    await expect(page.locator('#ortuDetay')).not.toHaveClass(/acik/);
    await expect.poll(() => derinlik(page)).toBe(1);     // nöbetçi tüketildi

    /* Nöbetçi tüketilmeseydi bu basış hiçbir şey yapmazdı. */
    await page.goBack();
    await expect.poll(() => aktifSekme(page)).toBe('ana');
  });

  test('F) çoklu seçim geri ile iptal olur, sekme değişmez', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Geri Kitabı' })]);
    await rafAc(page);
    await page.click('[data-act="secim-ac"]');
    await expect(page.locator('.toplu-cubuk')).toHaveCount(1);

    await page.goBack();
    await expect(page.locator('.toplu-cubuk')).toHaveCount(0);
    expect(await aktifSekme(page)).toBe('raf');
  });

  test('G) Ana Sayfa\'da geri önce ONAY ister, uygulama açık kalır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Geri Kitabı' })]);
    await page.goto('/');
    expect(await derinlik(page)).toBe(0);

    await page.goBack();
    await expect(page.locator('#toast')).toContainText(/tekrar bas/);
    await expect(page.locator('#liste, #panel-ana')).not.toHaveCount(0);   // hâlâ ayaktayız
  });

  test('H) en üstteki pencere AÇILIŞ sırasına göre seçilir, belge sırasına göre değil', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Geri Kitabı' })]);
    await rafAc(page);
    /* ortuAyar belgede ortuDetay'dan ÖNCE geliyor. Önce Detay, sonra Ayarlar
       açılırsa belge sırası "üst = Detay" der — yanlış. Açılış sırası Ayarlar der. */
    await page.click('.kart');
    await page.evaluate(() => ayarAc());
    await expect(page.locator('#ortuAyar')).toHaveClass(/acik/);

    const ust = await page.evaluate(() => { const o = ustOrtu(); return o ? o.id : null; });
    expect(ust).toBe('ortuAyar');
  });

  test('I) açılış ve derin bağlantı geri yığınını DOLDURMAZ', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Geri Kitabı' })]);
    await page.goto('/index.html?sekme=ist');
    await expect.poll(() => aktifSekme(page)).toBe('ist');
    expect(await derinlik(page)).toBe(0);       // programatik geçiş katman üretmez
  });

});
