'use strict';
/* G61 — HIZLI PUANLAMA AKIŞ REVİZYONU (v72): 195 puansız kitaplık gerçek iş
   için sürtünme giderme (canlı 412px ölçümüyle).

   SÖZLEŞMELER (bu dosyanın koruduğu):
   - Puan verilince OTOMATİK sonraki kitap + SATIR İÇİ onay ("✓ Ad → N · Geri").
   - GERİ salt konum: puan silinmez, önceki kitabın bu-oturum puanı VURGULU
     gelir ve yeni basış üzerine yazar; dışarıdan gelen puan ezilmez.
   - Son kitaptan sonra bitti ekranı.
   - Kapak ktPlate iz-plate dalıyla görünür; kapaksızda AD-KAROSU (iz-yedek).
   - Puan şeridi 412px'te TEK SATIR, düğme başına >=40px dokunma hedefi.
   - "HATIRLAMIYORUM" = puanYok (kitapNormalize alanı, senkronlu): kuyruktan
     KALICI düşer, bitti ekranındaki listeden geri alınabilir.
   - ATLA GEÇİCİ: puan yazılmaz, sonraki açılışta yine sorulur (karar).
   - puanYok yenilemede korunur + senkron birleşiminde taşınır (ANLIK_SURUM 9).
   - Ciltli: puan düğmeleri dolgusuz (kontur dili); seçili durum kontur + tint.
   (Mutasyon 1: puanVer'den otomatik geçiş kaldırılır → (a) kırmızı.
    Mutasyon 2: puanYokVer puanYok işaretini yazmaz → (f) kırmızı.) */
const { test, expect, tohumla, sahteKitap } = require('./yardim');

function puansiz(ad, ek) {
  return sahteKitap(Object.assign({ ad, durum: 'bitti', puan: null }, ek));
}
function ucKitap() {   // bitisTarihi DESC sıra: Bir, İki, Üç
  return [
    puansiz('K Bir', { bitisTarihi: '2024-05-01', yazar: 'Y1', sayfa: 320, tur: 'Roman' }),
    puansiz('K İki', { bitisTarihi: '2023-05-01', yazar: 'Y2' }),
    puansiz('K Üç', { bitisTarihi: '2022-05-01', yazar: 'Y3' })];
}
async function panelAc(page) {
  await page.click('nav [data-act="sekme"][data-v="ist"]');
  await page.click('#istPuansiz [data-act="zg-puanla"]');
  await expect(page.locator('#zgPuanOrtu')).toHaveClass(/acik/);
}
const govde = '#zgPuanOrtuGovde';

test.describe('G61 hızlı puanlama akışı', () => {

  test('(a) puan → SONRAKİ kitap + satır içi onay + yazım + damga; kalan azalır', async ({ page }) => {
    await tohumla(page, ucKitap());
    await page.goto('/');
    await panelAc(page);
    await expect(page.locator(govde + ' .zg-kitap-ad')).toHaveText('K Bir');
    await expect(page.locator(govde + ' .zg-kalan')).toHaveText('kalan 3');
    // yardımcı bilgi: yıl + sayfa + tür tek satırda
    await expect(page.locator(govde + ' .zg-kitap-alt')).toHaveText('2024 yılında bitti · 320 sayfa · Roman');
    await page.click(govde + ' [data-act="zg-puan"][data-v="9"]');
    await expect(page.locator(govde + ' .zg-kitap-ad')).toHaveText('K İki');
    await expect(page.locator(govde + ' .zg-onay')).toContainText('✓ K Bir → 9');
    await expect(page.locator(govde + ' .zg-kalan')).toHaveText('kalan 2');
    const k = await page.evaluate(() => veri.kitaplar.find(x => x.ad === 'K Bir'));
    expect(k.puan).toBe(9);
    expect(k.g, 'kullanıcı eylemi damgası').toBeGreaterThan(0);
  });

  test('(b) GERİ: önceki kitaba döner, puan SİLİNMEZ + vurgulu, yeni basış düzeltir', async ({ page }) => {
    await tohumla(page, ucKitap());
    await page.goto('/');
    await panelAc(page);
    await page.click(govde + ' [data-act="zg-puan"][data-v="9"]');
    await page.click(govde + ' [data-act="zg-puan-geri"]');
    await expect(page.locator(govde + ' .zg-kitap-ad')).toHaveText('K Bir');
    // puan yerinde ve 9 düğmesi vurgulu (yanlışlıkla kapatınca kayıp yok)
    expect(await page.evaluate(() => veri.kitaplar.find(x => x.ad === 'K Bir').puan)).toBe(9);
    await expect(page.locator(govde + ' .zg-puan-btn.zg-secili')).toHaveText('9');
    await page.click(govde + ' [data-act="zg-puan"][data-v="7"]');
    await expect(page.locator(govde + ' .zg-kitap-ad')).toHaveText('K İki');
    await expect(page.locator(govde + ' .zg-onay')).toContainText('✓ K Bir → 7');
    expect(await page.evaluate(() => veri.kitaplar.find(x => x.ad === 'K Bir').puan)).toBe(7);
  });

  test('(c) son kitaptan sonra bitti ekranı; oradan da Geri çalışır', async ({ page }) => {
    await tohumla(page, ucKitap().slice(0, 2));
    await page.goto('/');
    await panelAc(page);
    await page.click(govde + ' [data-act="zg-puan"][data-v="8"]');
    await page.click(govde + ' [data-act="zg-puan"][data-v="6"]');
    await expect(page.locator(govde)).toContainText('2 kitabın tümü gözden geçirildi');
    await expect(page.locator(govde + ' [data-act="zg-kapat"]')).toBeVisible();
    // bitti ekranından geri: son kitaba döner, 6 vurgulu
    await page.click(govde + ' [data-act="zg-puan-geri"]');
    await expect(page.locator(govde + ' .zg-kitap-ad')).toHaveText('K İki');
    await expect(page.locator(govde + ' .zg-puan-btn.zg-secili')).toHaveText('6');
  });

  test('(d) kapak görünür; kapaksızda AD-KAROSU yedeği', async ({ page }) => {
    await tohumla(page, [
      puansiz('Kapaklı Kitap', { bitisTarihi: '2024-05-01',
        kapak: 'https://covers.openlibrary.org/b/id/9-M.jpg' }),
      puansiz('Kapaksız Kitap', { bitisTarihi: '2023-05-01' })]);
    await page.goto('/');
    await panelAc(page);
    const img = page.locator(govde + ' .zg-pkapak img');
    await expect(img).toHaveCount(1);
    expect(await img.evaluate(el => el.naturalWidth), 'kapak gerçekten yüklendi').toBeGreaterThan(1);
    await page.click(govde + ' [data-act="zg-puan"][data-v="5"]');
    // kapaksız: ızgara ad-karosu yedeği (tek yedek yolu — plateKapakYedek)
    const plate = page.locator(govde + ' .zg-pkapak');
    await expect(plate).toHaveClass(/p-bos/);
    await expect(plate.locator('.iz-yedek')).toHaveText('Kapaksız Kitap');
  });

  test('(f) HATIRLAMIYORUM: kalıcı düşer, ikinci açılışta ve yenilemede çıkmaz, geri alınabilir', async ({ page }) => {
    await tohumla(page, ucKitap());
    await page.goto('/');
    await panelAc(page);
    await page.click(govde + ' [data-act="zg-puan-yok"]');
    await expect(page.locator(govde + ' .zg-onay')).toContainText('✓ K Bir → hatırlamıyorum');
    const k = await page.evaluate(() => veri.kitaplar.find(x => x.ad === 'K Bir'));
    expect(k.puanYok).toBe(true);
    expect(k.g).toBeGreaterThan(0);
    // ikinci açılış: kuyrukta yok
    await page.keyboard.press('Escape');
    await page.click('#istPuansiz [data-act="zg-puanla"]');
    await expect(page.locator(govde + ' .zg-kitap-ad')).toHaveText('K İki');
    await expect(page.locator(govde + ' .zg-kalan')).toHaveText('kalan 2');
    // yenilemede de kalıcı (depoya düştü)
    await page.reload();
    await panelAc(page);
    await expect(page.locator(govde + ' .zg-kitap-ad')).toHaveText('K İki');
    // bitti ekranındaki listeden GERİ ALINABİLİR
    await page.click(govde + ' [data-act="zg-atla"]');
    await page.click(govde + ' [data-act="zg-atla"]');
    await page.click(govde + ' summary');
    await page.click(govde + ' [data-act="zg-puanyok-geri"]');
    expect(await page.evaluate(() => veri.kitaplar.find(x => x.ad === 'K Bir').puanYok)).toBe(false);
    // sonraki başlatmada kuyruğa döner
    await page.keyboard.press('Escape');
    await page.click('#istPuansiz [data-act="zg-puanla"]');
    await expect(page.locator(govde + ' .zg-kitap-ad')).toHaveText('K Bir');
  });

  test('(g) ATLA geçici: puan yazılmaz, sonraki açılışta yine sorulur (karar)', async ({ page }) => {
    await tohumla(page, ucKitap());
    await page.goto('/');
    await panelAc(page);
    await page.click(govde + ' [data-act="zg-atla"]');
    await expect(page.locator(govde + ' .zg-kitap-ad')).toHaveText('K İki');
    // onay satırı atlananı DÜRÜST söyler (✓ yok)
    await expect(page.locator(govde + ' .zg-onay')).toContainText('K Bir → atlandı');
    expect(await page.evaluate(() => veri.kitaplar.find(x => x.ad === 'K Bir').puan)).toBe(null);
    await page.keyboard.press('Escape');
    await page.click('#istPuansiz [data-act="zg-puanla"]');
    await expect(page.locator(govde + ' .zg-kitap-ad')).toHaveText('K Bir');
  });

  test('(K1) son puansız da işaretlenince İstatistik köprüsü KAYBOLMAZ: geri alma kapısı yaşar', async ({ page }) => {
    await tohumla(page, [puansiz('Tek Kitap', { bitisTarihi: '2024-05-01' })]);
    await page.goto('/');
    await panelAc(page);
    await page.click(govde + ' [data-act="zg-puan-yok"]');
    await page.keyboard.press('Escape');
    // istatistik yeniden çizilir: köprü "işaretledin" metniyle DURUR
    await page.click('nav [data-act="sekme"][data-v="raf"]');
    await page.click('nav [data-act="sekme"][data-v="ist"]');
    await expect(page.locator('#istPuansiz')).toContainText('1 bitmiş kitabı “hatırlamıyorum” işaretledin');
    // kapıdan girilip GERİ ALINABİLİR
    await page.click('#istPuansiz [data-act="zg-puanla"]');
    await page.click(govde + ' summary');
    await page.click(govde + ' [data-act="zg-puanyok-geri"]');
    expect(await page.evaluate(() => veri.kitaplar[0].puanYok)).toBe(false);
  });

  test('(K2) panel dışı puan yazımı işareti düşürür: detay şeridi + normalize mutabakat kapısı', async ({ page }) => {
    await tohumla(page, [
      puansiz('İşaretli Ama Puanlanacak', { bitisTarihi: '2024-05-01', puanYok: true }),
      // normalize kapısı: puanlı kitapta işaret İMKÂNSIZ — açılışta düşer
      sahteKitap({ ad: 'Çelişik Tohum', durum: 'bitti', puan: 8, puanYok: true, bitisTarihi: '2023-01-01' })]);
    await page.goto('/');
    expect(await page.evaluate(() =>
      veri.kitaplar.find(k => k.ad === 'Çelişik Tohum').puanYok), 'normalize kapısı').toBe(false);
    // detay şeridinden puan → işaret düşer (bitti ekranı listesine puanlı kitap sızmaz)
    await page.click('nav [data-act="sekme"][data-v="raf"]');
    await page.locator('#liste .kart', { hasText: 'İşaretli Ama Puanlanacak' }).click();
    await page.click('#ortuDetay [data-act="d-puan"][data-v="7"]');
    const k = await page.evaluate(() => veri.kitaplar.find(x => x.ad === 'İşaretli Ama Puanlanacak'));
    expect(k.puan).toBe(7);
    expect(k.puanYok, 'd-puan işareti düşürdü').toBe(false);
  });

  test('(K3) yeniden-oku: "hatırlamıyorum" eski okumanın hükmü — yeni döngüye miras kalmaz', async ({ page }) => {
    await tohumla(page, [puansiz('Yeniden Okunan', { bitisTarihi: '2022-05-01', puanYok: true })]);
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="raf"]');
    await page.click('#liste .kart >> nth=0');
    await page.click('#ortuDetay [data-act="yeniden-oku"]');
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.durum).toBe('okunuyor');
    expect(k.puanYok, 'işaret yeni okuma döngüsüne taşınmadı').toBe(false);
  });

  test('(h) puanYok: yenilemede korunur, senkron birleşiminde taşınır, ANLIK_SURUM 9', async ({ page }) => {
    await tohumla(page, [puansiz('İşaretli', { bitisTarihi: '2024-01-01', puanYok: true })]);
    await page.goto('/');
    await page.reload();
    // normalize alanı yenilemede söKMEDİ (g15 kuralı)
    expect(await page.evaluate(() => veri.kitaplar[0].puanYok)).toBe(true);
    // şema sürümü arttı (göç turu damga basmaz — anlikYukle v3'ten beri aynı
    // desen). ">= 9": sabit eşitlik sonraki şema artışında kırılırdı (v50 dersi
    // — v73 adTr artışı tam bunu ısırdı, eşiğe çevrildi)
    expect(await page.evaluate(() => window.__senkron.ANLIK_SURUM)).toBeGreaterThanOrEqual(9);
    // kitap-LWW birleşiminde alan taşınır: uzak yeni damgalı puanYok kazanır
    const b = await page.evaluate(() => {
      const yerel = { ...veri.kitaplar[0], puanYok: false, g: 100 };
      const uzak = { ...veri.kitaplar[0], puanYok: true, g: 200 };
      return window.__senkron.birlestir(
        { kitaplar: [yerel], silinenler: {} }, { kitaplar: [uzak], silinenler: {} }).kitaplar[0];
    });
    expect(b.puanYok).toBe(true);
  });

  test('(i) Ciltli: puan düğmeleri dolgusuz; seçili durum kontur + tint (dolu düğme yok)', async ({ page }) => {
    await tohumla(page, ucKitap());
    await page.goto('/');
    await panelAc(page);
    const bg = await page.locator(govde + ' .zg-puan-btn[data-v="5"]')
      .evaluate(el => getComputedStyle(el).backgroundColor);
    expect(bg, 'dolgusuz kontur düğmesi').toBe('rgba(0, 0, 0, 0)');
    await page.click(govde + ' [data-act="zg-puan"][data-v="5"]');
    await page.click(govde + ' [data-act="zg-puan-geri"]');
    const secili = page.locator(govde + ' .zg-puan-btn.zg-secili');
    await expect(secili).toHaveAttribute('aria-pressed', 'true');
    const seciliBg = await secili.evaluate(el => getComputedStyle(el).backgroundColor);
    expect(seciliBg, 'seçili durum tam dolgu DEĞİL (tint)').not.toBe('rgba(0, 0, 0, 0)');
  });
});

/* 412px ölçümü AYRI describe: viewport sözleşmesi yalnız bu vaka için */
test.describe('G61-e puan şeridi 412px', () => {
  test.use({ viewport: { width: 412, height: 900 } });

  test('(e) TEK satır + düğme başına >=40px dokunma hedefi', async ({ page }) => {
    await tohumla(page, [
      puansiz('Şerit Kitabı', { bitisTarihi: '2024-05-01' })]);
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="ist"]');
    await page.click('#istPuansiz [data-act="zg-puanla"]');
    const kutular = await page.locator('#zgPuanOrtuGovde .zg-puan-btn')
      .evaluateAll(els => els.map(e => {
        const r = e.getBoundingClientRect();
        return { x: r.x, y: Math.round(r.y), w: r.width, h: r.height };
      }));
    expect(kutular.length).toBe(10);
    const satirlar = [...new Set(kutular.map(k => k.y))];
    expect(satirlar.length, 'TEK satır').toBe(1);
    for (const k of kutular) {
      expect(k.w, 'dokunma hedefi genişlik').toBeGreaterThanOrEqual(40);
      expect(k.h, 'dokunma hedefi yükseklik').toBeGreaterThanOrEqual(40);
    }
  });
});
