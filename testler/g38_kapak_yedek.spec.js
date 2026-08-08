'use strict';
/* G38 — Kapak yükleme hatası yedeği (v44): TEK yardımcı (window.plateKapakYedek).
   Kusur: SIRADA şeridinde kapağı YÜKLENEMEYEN kitabın levhası bomboş kalıyordu
   (ad/yazar yok) — ızgara doğru davranırken. Vakalar GERÇEK yükleme hatası
   üzerinden kurulur (404 dönen kapak URL'si + error olayı) — "kapak alanı boş"
   senaryosu bu kusuru GÖREMİYORDU (yer tutucu dalı zaten çalışıyordu). */
const { test, expect, tohumla, sahteKitap, rafAc } = require('./yardim');

const BOZUK = 'https://covers.bozuk.example/yok.jpg';
const SAGLAM = 'https://covers.openlibrary.org/b/id/2-M.jpg'; // agTaklit gerçek PNG döndürür

/* agTaklit bilinmeyen dış isteği "beklenmeyen" sayıp testi düşürür — bozuk URL
   için KENDİ route'umuz (sonradan kayıt = öncelikli) gerçek bir 404 üretir:
   img error olayı sahici yoldan tetiklenir. */
async function bozukKapakRotasi(page) {
  await page.route('**/covers.bozuk.example/**', r => r.fulfill({ status: 404, body: '' }));
}

test.describe('G38 kapak hatası yedeği', () => {

  test('(a) bozuk kapak URL\'si: SIRADA levhası kesikli yedeğe döner — ad + yazar GÖRÜNÜR', async ({ page }) => {
    await bozukKapakRotasi(page);
    await tohumla(page, [sahteKitap({ ad: 'Bozuk Kapaklı Kitap', yazar: 'Hatalı Sunucu', kapak: BOZUK })]);
    await rafAc(page);
    const levha = page.locator('#ktSiradaSerit .kt-sira-plate');
    await expect(levha).toHaveCount(1);
    // error işlendi: img kalktı, çerçeve + tipografik içerik geldi
    await expect(levha.locator('img')).toHaveCount(0);
    await expect(levha).toHaveClass(/p-bos/);
    await expect(levha).not.toHaveClass(/kt-sira-kapakli/);
    await expect(levha.locator('.kt-sira-ad')).toHaveText('Bozuk Kapaklı Kitap');
    await expect(levha.locator('.kt-sira-yazar')).toHaveText('Hatalı Sunucu');
    // görünürlük: metin gerçekten boyanıyor (boş levha kusuru geri gelmesin)
    const adKutu = await levha.locator('.kt-sira-ad').boundingBox();
    expect(adKutu && adKutu.height, 'ad görünür yükseklikte').toBeGreaterThan(6);
  });

  test('(b) kapaksız kitap: SIRADA levhasında ad görünür (mevcut davranış)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Kapaksız Sıradaki', yazar: 'Yerli Yazar' })]);
    await rafAc(page);
    const levha = page.locator('#ktSiradaSerit .kt-sira-plate');
    await expect(levha).toHaveClass(/p-bos/);
    await expect(levha.locator('.kt-sira-ad')).toHaveText('Kapaksız Sıradaki');
    await expect(levha.locator('.kt-sira-yazar')).toHaveText('Yerli Yazar');
  });

  test('(c) sağlam kapak: görsel görünür, yer tutucu YOK', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Sağlam Kapaklı', kapak: SAGLAM })]);
    await rafAc(page);
    const levha = page.locator('#ktSiradaSerit .kt-sira-plate');
    await expect(levha.locator('img')).toHaveCount(1);
    await expect(levha).toHaveClass(/kt-sira-kapakli/);
    await expect(levha).not.toHaveClass(/p-bos/);
    await expect(levha.locator('.kt-sira-ad')).toHaveCount(0);
    // görsel gerçekten yüklendi (error yedeği tetiklenmedi)
    const dogal = await levha.locator('img').evaluate(el => el.naturalWidth);
    expect(dogal).toBeGreaterThan(0);
  });

  test('(d) regresyon: bozuk kapak IZGARADA da aynı yardımcıyla yedeğe düşer (tam ad)', async ({ page }) => {
    await bozukKapakRotasi(page);
    await tohumla(page, [sahteKitap({ ad: 'Izgara Bozuk Kapak', kapak: BOZUK })],
      { kk_gorunum_v1: null });   // izgara varsayılanı
    await rafAc(page);
    await expect(page.locator('#liste')).toHaveClass(/izgara/);
    const plate = page.locator('#liste .kart .plate');
    await expect(plate.locator('img')).toHaveCount(0);
    await expect(plate).toHaveClass(/p-bos/);
    await expect(plate.locator('.iz-yedek')).toHaveText('Izgara Bozuk Kapak');
    // liste düzeninde de çerçeveye düşer (metin satırın kendisinde — levha sade)
    await page.click('#duzenListe');
    const mini = page.locator('#liste .kart .plate');
    await expect(mini).toHaveClass(/p-bos/);
    await expect(mini.locator('img')).toHaveCount(0);
  });
});
