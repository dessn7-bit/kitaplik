'use strict';
/* G119 (v127) — İLERİYE DÖNÜK TARİH SORUSU
 *
 * v125 dışarıda kalanı söyledi, v126 kaçakları görünür yaptı. Geriye asıl
 * asimetri kalmıştı: YANLIŞ tarih bedava (tek dokunuş "Bitirdim"), DOĞRU
 * tarih friksiyonlu (Düzenle formunu aç, ayrıntıları genişlet, alanı bul).
 * v127 bunu tersine çevirir:
 *   · bitmiş kitabın tarihi kendi ekranında GÖRÜNÜR ve tek dokunuşla değişir
 *     (Bugün / Dün / elle tarih / tarihi kaldır)
 *   · formda "Bitti" seçmek tarihi ALANA yazar — kaydetmeden önce görülür
 *   · toplu işaretleme ve seri tarama tarihi SORAR (varsayılan bugün)
 *   · her yerde: gelecek tarih ve başlamadan önceki tarih REDDEDİLİR,
 *     boş bırakmak geçerli bir CEVAPtır (uydurma tarih yerine tarihsiz kayıt)
 *
 * Aynı satır 70 eski kaydın per-kitap onarım yolu: tarihsiz bitmişte
 * "tarih ekle" der.
 *
 * MUTASYON DENETİMİ (koşuldu, dördü de öldürüldü):
 *   M-a  btYaz gelecek kapısını kaldır            → C kırmızı
 *   M-b  btYaz başlama kapısını kaldır            → D kırmızı
 *   M-c  f-durum ön doldurması kalksın            → G + g118-F kırmızı
 *   M-d  toplu tarih alanı yerine bugun() kullan  → J, K kırmızı
 */
const { test, expect, tohumla, sahteKitap, rafAc, ayarlarAc, ayrintilarAc,
  kameraTaklit, bugunISO } = require('./yardim');

async function detayAc(page) {
  await page.click('#liste .kart');
  await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
}
const oku = page => page.evaluate(() => veri.kitaplar[0].bitisTarihi);

test.describe('G119 bitiş tarihi satırı — detay (v127)', () => {

  test('A) "Bitirdim" sonrası tarih GÖRÜNÜR ve bugünü söyler', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Sürüyor', durum: 'okunuyor', sayfa: 100, guncelSayfa: 40 })]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="bitir"]');
    await expect(page.locator('#dBitisMetin')).toContainText('Bitiş tarihi');
    await expect(page.locator('#dBitisMetin')).toContainText('(bugün)');
    // satır KAPALI başlar: gürültü yok, tek dokunuş uzakta
    await expect(page.locator('#dBitisGiris')).toBeHidden();
  });

  test('B) "Dün" tek dokunuşta yazar', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Bitmiş', durum: 'bitti', sayfa: 100, bitisTarihi: bugunISO() })]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="bt-ac"]');
    await expect(page.locator('#dBitisGiris')).toBeVisible();
    await page.click('[data-act="bt-hizli"][data-v="' + bugunISO(-1) + '"]');
    expect(await oku(page)).toBe(bugunISO(-1));
    await expect(page.locator('#dBitisMetin')).not.toContainText('(bugün)');
  });

  test('C) gelecek tarih REDDEDİLİR, veri değişmez', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Bitmiş', durum: 'bitti', sayfa: 100, bitisTarihi: '2020-05-05' })]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="bt-ac"]');
    await page.fill('#dBitisTarih', bugunISO(3));
    await page.click('[data-act="bt-kaydet"]');
    await expect(page.locator('#toast')).toContainText('gelecekte olamaz');
    expect(await oku(page)).toBe('2020-05-05');
  });

  test('D) başlama tarihinden ÖNCE olamaz', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Bitmiş', durum: 'bitti', sayfa: 100,
      baslamaTarihi: '2021-03-01', bitisTarihi: '2021-03-20' })]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="bt-ac"]');
    await page.fill('#dBitisTarih', '2021-02-01');
    await page.click('[data-act="bt-kaydet"]');
    await expect(page.locator('#toast')).toContainText('başlamadan önce olamaz');
    expect(await oku(page)).toBe('2021-03-20');
  });

  test('E) "tarihi kaldır" bilinçli bir cevaptır: kayıt tarihsize döner ve SAYILIR', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Bitmiş', durum: 'bitti', sayfa: 100, bitisTarihi: '2020-05-05' })]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="bt-ac"]');
    await page.click('[data-act="bt-sil"]');
    await expect(page.locator('#toast')).toContainText('yıl sayımlarına girmez');
    expect(await oku(page)).toBe(null);
    // v125 sayacı anında görüyor
    expect(await page.evaluate(() => window.__tarihsiz.ozet().adet)).toBe(1);
  });

  test('F) TARİHSİZ bitmişte satır "tarih ekle" der — 70 eski kaydın onarım yolu', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Eski Okuma', durum: 'bitti', sayfa: 100, bitisTarihi: null })]);
    await rafAc(page);
    await detayAc(page);
    await expect(page.locator('#dBitisMetin')).toContainText('Bitiş tarihi yok');
    await expect(page.locator('[data-act="bt-ac"]')).toHaveText('tarih ekle');
    await page.click('[data-act="bt-ac"]');
    await page.fill('#dBitisTarih', '2019-07-07');
    await page.click('[data-act="bt-kaydet"]');
    expect(await oku(page)).toBe('2019-07-07');
    expect(await page.evaluate(() => window.__tarihsiz.ozet().adet)).toBe(0);
    // tarih yazıldıktan sonra satır "tarihi kaldır" yolunu da açar
    await page.click('[data-act="bt-ac"]');
    await expect(page.locator('[data-act="bt-sil"]')).toHaveCount(1);
  });
});

test.describe('G119 form: tarih kaydetmeden ÖNCE görünür (v127)', () => {

  test('G) "Bitti" seçilince tarih alanı BUGÜNle dolar', async ({ page }) => {
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await ayrintilarAc(page);
    await page.fill('#f-ad', 'Yeni Bitmiş');
    await expect(page.locator('#f-bit')).toHaveValue('');
    await page.click('[data-act="f-durum"][data-v="bitti"]');
    await expect(page.locator('#f-bit')).toHaveValue(bugunISO());   // GÖRÜNÜR
    await page.click('[data-act="form-kaydet"]');
    expect(await oku(page)).toBe(bugunISO());
  });

  test('H) alan BOŞALTILIRSA tarih yazılmaz ve bu söylenir', async ({ page }) => {
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await ayrintilarAc(page);
    await page.fill('#f-ad', 'Tarihini Bilmiyorum');
    await page.click('[data-act="f-durum"][data-v="bitti"]');
    await page.fill('#f-bit', '');           // kullanıcının CEVABI
    await page.click('[data-act="form-kaydet"]');
    await expect(page.locator('#toast')).toContainText('Bitiş tarihi boş');
    await expect(page.locator('#toast')).toContainText('yıl sayımlarına girmez');
    expect(await oku(page)).toBe(null);
  });

  test('I) formu AÇMAK eski kaydın tarihini bugüne çekmez', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Eski', durum: 'bitti', sayfa: 100, bitisTarihi: null })]);
    await rafAc(page);
    await detayAc(page);
    await page.click('#dDigerKatla summary');   // Düzenle nadir bölümde katlı
    await page.click('[data-act="duzenle"]');
    await ayrintilarAc(page);
    await expect(page.locator('#f-bit')).toHaveValue('');   // dokunulmadı
    await page.click('[data-act="form-kaydet"]');
    expect(await oku(page)).toBe(null);
  });
});

test.describe('G119 toplu ve seri: tarih SORULUR (v127)', () => {

  async function topluBitti(page, tarih) {
    await page.click('#secimBtn');
    await page.click('[data-act="toplu-tumu"]');
    await page.click('[data-act="toplu-durum"]');
    await page.selectOption('#topluDurumSec', 'bitti');
    await expect(page.locator('#topluBitTarih')).toHaveValue(bugunISO());   // varsayılan
    await page.fill('#topluBitTarih', tarih);
    await page.click('[data-act="toplu-durum-uygula"]');
  }

  test('J) toplu: SEÇİLEN tarih yazılır ve mesajda geçer', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Eski Kitap', durum: 'okunacak', sayfa: 100 })]);
    await rafAc(page);
    await topluBitti(page, '2015-06-06');
    await expect(page.locator('#toast')).toContainText('1 kitaba bitiş tarihi 6 Haz 2015 yazıldı');
    expect(await oku(page)).toBe('2015-06-06');
  });

  test('K) toplu: alan boşsa tarih YAZILMAZ, tarihsiz bırakıldığı söylenir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Eski Kitap', durum: 'okunacak', sayfa: 100 })]);
    await rafAc(page);
    await topluBitti(page, '');
    await expect(page.locator('#toast')).toContainText('1 kitap tarihsiz bırakıldı');
    expect(await oku(page)).toBe(null);
    expect(await page.evaluate(() => window.__tarihsiz.ozet().adet)).toBe(1);
  });

  test('L) toplu: gelecek tarih reddedilir, HİÇBİR kayıt değişmez', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Eski Kitap', durum: 'okunacak', sayfa: 100 })]);
    await rafAc(page);
    await topluBitti(page, bugunISO(5));
    await expect(page.locator('#toast')).toContainText('gelecekte olamaz');
    expect(await page.evaluate(() => veri.kitaplar[0].durum)).toBe('okunacak');
    expect(await oku(page)).toBe(null);
  });

  test('M) seri tarama panelinde tarih alanı var, varsayılanı bugün', async ({ page }) => {
    await kameraTaklit(page);
    await rafAc(page);
    await ayarlarAc(page);
    await page.click('#ortuAyar [data-act="seri-ac"]');
    await expect(page.locator('#seriOrtu')).toHaveClass(/acik/);
    await expect(page.locator('#seriBitTarih')).toHaveValue(bugunISO());
    await expect(page.locator('#seriDurumNot')).toContainText('varsayılan BUGÜN');
    await expect(page.locator('#seriDurumNot')).toContainText('boşaltırsan tarih yazılmaz');
  });
});
