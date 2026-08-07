'use strict';
const { test, expect, tohumla, sahteKitap,
  onaylariKabulEt, bugunISO, rafAc } = require('./yardim');

test.describe('G9 görünüm ve toplu işlem', () => {

  test('ızgara/liste geçişi çalışır, tercih localStorage\'da saklanır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Izgara Kitabı' })]);
    await rafAc(page);
    await expect(page.locator('#liste')).not.toHaveClass(/izgara/);
    await page.click('#izgaraBtn');
    await expect(page.locator('#liste')).toHaveClass(/izgara/);
    expect(await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kk_gorunum_v1')).izgara)).toBe(true);
    await page.click('#izgaraBtn');
    await expect(page.locator('#liste')).not.toHaveClass(/izgara/);
    expect(await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kk_gorunum_v1')).izgara)).toBe(false);
  });

  test('kapaksız kitapta yedek görsel çizilir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Kapaksız Kitap', kapak: null })]);
    await page.addInitScript(() =>
      localStorage.setItem('kk_gorunum_v1', JSON.stringify({ izgara: true })));
    await rafAc(page);
    await expect(page.locator('#liste')).toHaveClass(/izgara/);
    await expect(page.locator('#liste .iz-yedek')).toHaveCount(1);
    await expect(page.locator('#liste .iz-yedek')).toContainText('Kapaksız Kitap');
  });

  test('ızgarada karta tıklayınca detay açılır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Detay Kitabı' })]);
    await page.addInitScript(() =>
      localStorage.setItem('kk_gorunum_v1', JSON.stringify({ izgara: true })));
    await rafAc(page);
    await page.click('#liste .kart');
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await expect(page.locator('#detayIcerik')).toContainText('Detay Kitabı');
  });

  test('seçim modunda karta tıklayınca detay açılmaz, kart seçilir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Seçilecek Kitap' })]);
    await rafAc(page);
    await page.click('#secimBtn');
    await expect(page.locator('#topluCubuk')).toBeVisible();
    await page.click('#liste .kart');
    await expect(page.locator('#ortuDetay')).not.toHaveClass(/acik/); // detay AÇILMADI
    await expect(page.locator('#liste .kart')).toHaveClass(/secili/);
    await expect(page.locator('#topluSayi')).toHaveText('1 seçili');
  });

  test('Tümü düğmesi hepsini seçer, ikinci basışta bırakır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'K1' }), sahteKitap({ ad: 'K2' }), sahteKitap({ ad: 'K3' })]);
    await rafAc(page);
    await page.click('#secimBtn');
    await page.click('[data-act="toplu-tumu"]');
    await expect(page.locator('#topluSayi')).toHaveText('3 seçili');
    await page.click('[data-act="toplu-tumu"]');
    await expect(page.locator('#topluSayi')).toHaveText('0 seçili');
  });

  test('toplu raf atama hepsine yazar; boş değer rafı temizler', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'R1', raf: 'eski raf' }),
      sahteKitap({ ad: 'R2' })
    ]);
    await rafAc(page);
    await page.click('#secimBtn');
    await page.click('[data-act="toplu-tumu"]');
    await page.click('[data-act="toplu-raf"]');
    await page.fill('#topluRafGiris', 'orta raf');
    await page.click('[data-act="toplu-raf-uygula"]');
    await expect(page.locator('#toast')).toContainText('2 kitaba raf yazıldı');
    expect(await page.evaluate(() => veri.kitaplar.map(k => k.raf))).toEqual(['orta raf', 'orta raf']);
    // boş değer rafı temizler
    await page.click('[data-act="toplu-raf"]');
    await page.fill('#topluRafGiris', '');
    await page.click('[data-act="toplu-raf-uygula"]');
    await expect.poll(() => page.evaluate(() => veri.kitaplar.map(k => k.raf))).toEqual(['', '']);
  });

  test('toplu etiket mevcut etiketleri korur, mükerrer eklemez', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'E1', etiketler: ['felsefe', 'çeviri'] })]);
    await rafAc(page);
    await page.click('#secimBtn');
    await page.click('[data-act="toplu-tumu"]');
    await page.click('[data-act="toplu-etiket"]');
    await page.fill('#topluEtiketGiris', 'FELSEFE, #yeni-etiket');
    await page.click('[data-act="toplu-etiket-uygula"]');
    await expect(page.locator('#toast')).toContainText('1 kitaba etiket eklendi');
    const etiketler = await page.evaluate(() => veri.kitaplar[0].etiketler);
    expect(etiketler).toContain('felsefe');       // mevcut korundu
    expect(etiketler).toContain('çeviri');        // mevcut korundu
    expect(etiketler).toContain('yeni-etiket');   // # kırpılıp eklendi
    expect(etiketler.length).toBe(3);             // FELSEFE mükerrer sayıldı (TR küçük eşleşme)
  });

  test('toplu durum değişikliği tarihleri doğru ayarlar', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'D1', durum: 'okunacak', sayfa: 240 })]);
    await rafAc(page);
    await page.click('#secimBtn');
    await page.click('[data-act="toplu-tumu"]');
    await page.click('[data-act="toplu-durum"]');
    await page.selectOption('#topluDurumSec', 'bitti');
    await page.click('[data-act="toplu-durum-uygula"]');
    await expect(page.locator('#toast')).toContainText('durumu değişti');
    let k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.durum).toBe('bitti');
    expect(k.bitisTarihi).toBe(bugunISO());
    expect(k.guncelSayfa).toBe(240);
    // okunacak'a geri: tarihler ve ilerleme sıfırlanır
    await page.click('[data-act="toplu-durum"]');
    await page.selectOption('#topluDurumSec', 'okunacak');
    await page.click('[data-act="toplu-durum-uygula"]');
    await expect.poll(() => page.evaluate(() => veri.kitaplar[0].durum)).toBe('okunacak');
    k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.bitisTarihi).toBeNull();
    expect(k.baslamaTarihi).toBeNull();
    expect(k.guncelSayfa).toBe(0);
  });

  test('toplu silme mezar taşı bırakır', async ({ page }) => {
    onaylariKabulEt(page);
    const a = sahteKitap({ ad: 'Silinecek A' });
    const b = sahteKitap({ ad: 'Silinecek B' });
    await tohumla(page, [a, b]);
    await rafAc(page);
    await page.click('#secimBtn');
    await page.click('[data-act="toplu-tumu"]');
    await page.click('[data-act="toplu-sil"]');
    await expect(page.locator('#toast')).toContainText('2 kitap silindi');
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(0);
    const mezarlar = await page.evaluate(() => Object.keys(veri.silinenler || {}).sort());
    expect(mezarlar).toEqual([a.id, b.id].sort());
  });
});
