'use strict';
/* G118 (v126) — TARİH KAÇAKLARI: SEKİZ YOL, SEKİZİ DE SESSİZ DEĞİL
 *
 * v125 dışarıda kalan 70 kaydı SÖYLEDİ. v126 boşluğun BÜYÜDÜĞÜ anı söylüyor.
 * Sekiz yol koşularak ölçüldü (keşif probu, 2026-09-09):
 *
 *   TARİHSİZ SESSİZCE GİRİYORDU
 *     1 Goodreads CSV, raf "read" + "Date Read" boş  → bitti / bitisTarihi null
 *     2 JSON yedeği — birleştir                      → bitti / null
 *     3 JSON yedeği — tam değiştir                   → bitti / null
 *     4 Senkron (uzak cihaz)                         → bitti / null
 *   SORULMADAN "BUGÜN" YAZILIYORDU
 *     5 Form: durum=bitti + tarih alanı boş          → bugün (index.html)
 *     6 Toplu durum → bitti                          → bugün (g9 kilidi)
 *     7 ISBN seri tarama, durum=bitti                → bugün (g4 kilidi)
 *     8 Detayda "Bitirdim"                           → bugün
 *
 * KARAR: hiçbir tarih UYDURULMUYOR, hiçbir giriş ENGELLENMİYOR — yalnız o an
 * ne olduğu yazılıyor. 8. yol (senkron) BİLEREK sessiz: kapı kaydı üreten
 * cihazda, gelen kayıt zaten v125 sayacına düşüyor (kaynak kilidiyle
 * belgelendi). Damga cümlesi v127'de yerini SORUYA bırakacak.
 *
 * v127 GÖÇÜ: 5-8 numaralı yollarda "bugün" artık SORULUYOR (g119). Buradaki
 * F, H, I vakaları o sözleşmeye niyet-koruyucu güncellendi — kilitledikleri
 * kural değişmedi: damga sessiz olamaz.
 *
 * MUTASYON DENETİMİ (koşuldu):
 *   M-a  tarihsizGirenCumle → '' sabiti        → A, C kırmızı
 *   M-b  cümle koşulsuz eklensin (0'da da)     → B, D kırmızı
 *   M-c  form damga bayrağı hep false          → F kırmızı
 *   M-d  plan.tarihsiz sayımı kalksın          → E kırmızı
 */
const fs = require('fs');
const path = require('path');
const { test, expect, tohumla, sahteKitap, rafAc, ayarlarAc, ayrintilarAc,
  kameraTaklit, dosyadanYukle, jsonDosya, bugunISO } = require('./yardim');

const GR_BASLIK = 'Title,Author,ISBN13,My Rating,Number of Pages,Year Published,'
  + 'Date Read,Date Added,Bookshelves,Exclusive Shelf,My Review,Publisher';
const csvDosya = (metin, ad) =>
  ({ name: ad || 'goodreads.csv', mimeType: 'text/csv', buffer: Buffer.from(metin, 'utf8') });
const grSatir = (ad, dateRead) =>
  `"${ad}","Bir Yazar",,4,300,1990,${dateRead || ''},2020/05/21,"read",read,,`;

function yedekGovde(kitaplar) {
  return JSON.stringify({ surum: 2, tarih: '2026-09-04T10:00:00.000Z', kitaplar,
    hedef: {}, hedefG: {}, hedefSayfa: {}, hedefSayfaG: {}, silinenler: {},
    kesfetGizli: {}, kesfetGizliGeri: {}, turRed: {}, turRedGeri: {}, ozetler: {} });
}

test.describe('G118 tarih kaçakları (v126)', () => {

  /* ---- 1) Goodreads CSV ---- */
  test('A) Goodreads: "Date Read" boş gelen bitmişler SAYILIR, tarih uydurulmaz', async ({ page }) => {
    await rafAc(page);
    await ayarlarAc(page);
    await dosyadanYukle(page, csvDosya([GR_BASLIK,
      grSatir('Tarihsiz Bir'), grSatir('Tarihsiz İki'),
      grSatir('Tarihli', '2021/03/04')].join('\n')));
    await expect(page.locator('#toast')).toContainText('3 kitap aktarıldı');
    await expect(page.locator('#toast')).toContainText('2 tanesinde bitiş tarihi yok');
    // UYDURMA YOK: gelen kayıt tarihsiz kaldı, tarihli olan korundu
    const d = await page.evaluate(() => ({
      bir: veri.kitaplar.find(k => k.ad === 'Tarihsiz Bir').bitisTarihi,
      tarihli: veri.kitaplar.find(k => k.ad === 'Tarihli').bitisTarihi
    }));
    expect(d.bir).toBe(null);
    expect(d.tarihli).toBe('2021-03-04');
  });

  test('B) Goodreads: hepsi tarihliyse cümle ÇIKMAZ', async ({ page }) => {
    await rafAc(page);
    await ayarlarAc(page);
    await dosyadanYukle(page, csvDosya([GR_BASLIK, grSatir('Tarihli', '2021/03/04')].join('\n')));
    await expect(page.locator('#toast')).toContainText('1 kitap aktarıldı');
    await expect(page.locator('#toast')).not.toContainText('bitiş tarihi yok');
  });

  /* ---- 2) JSON yedeği — birleştir ---- */
  test('C) JSON birleştir: tarihsiz gelen bitmişler SAYILIR', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Mevcut' })]);
    await rafAc(page);
    await ayarlarAc(page);
    await dosyadanYukle(page, jsonDosya(yedekGovde([
      { ad: 'Dosyadan Tarihsiz', yazar: 'Y', durum: 'bitti', puan: 8, sayfa: 100 },
      { ad: 'Dosyadan Tarihli', yazar: 'Y', durum: 'bitti', puan: 7, sayfa: 100, bitisTarihi: '2022-05-05' }
    ]), 'yedek.json'), 'birlestir');
    await expect(page.locator('#toast')).toContainText('2 kitap geri yüklendi');
    await expect(page.locator('#toast')).toContainText('1 tanesinde bitiş tarihi yok');
    expect(await page.evaluate(() =>
      veri.kitaplar.find(k => k.ad === 'Dosyadan Tarihsiz').bitisTarihi)).toBe(null);
  });

  test('D) JSON birleştir: hepsi tarihliyse cümle ÇIKMAZ', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Mevcut' })]);
    await rafAc(page);
    await ayarlarAc(page);
    await dosyadanYukle(page, jsonDosya(yedekGovde([
      { ad: 'Dosyadan Tarihli', yazar: 'Y', durum: 'bitti', puan: 7, sayfa: 100, bitisTarihi: '2022-05-05' }
    ]), 'yedek.json'), 'birlestir');
    await expect(page.locator('#toast')).toContainText('1 kitap geri yüklendi');
    await expect(page.locator('#toast')).not.toContainText('bitiş tarihi yok');
  });

  /* ---- 3) JSON yedeği — tam değiştir: ONAYDAN ÖNCE ---- */
  test('E) Tam değiştirme önizlemesi tarihsizleri UYGULAMADAN ÖNCE yazar', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Mevcut' })]);
    await rafAc(page);
    await ayarlarAc(page);
    await dosyadanYukle(page, jsonDosya(yedekGovde([
      { ad: 'Değişen Tarihsiz', yazar: 'Y', durum: 'bitti', puan: 8, sayfa: 100 },
      { ad: 'Değişen Tarihli', yazar: 'Y', durum: 'bitti', puan: 7, sayfa: 100, bitisTarihi: '2022-05-05' }
    ]), 'kutuphane.json'), 'degistir');
    await expect(page.locator('#kyTarihsiz')).toHaveText('1');
    await expect(page.locator('#kyOrtuGovde')).toContainText('bitmiş kayıtta bitiş tarihi yok');
    // henüz UYGULANMADI: kütüphane değişmedi
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(1);
    await page.click('#kyOrtu [data-act="ky-uygula"]');
    await expect(page.locator('#kyOrtu')).not.toHaveClass(/acik/);
    expect(await page.evaluate(() =>
      veri.kitaplar.find(k => k.ad === 'Değişen Tarihsiz').bitisTarihi)).toBe(null);
  });

  /* ---- 5) Form ----
     v127 GÖÇÜ (niyet-koruyucu): bu vaka v126'da "alan boşken bugün yazılır ve
     SÖYLENİR" diyordu. v127 sözleşmeyi bilerek değiştirdi — tarih artık
     "Bitti"ye basılınca ALANA yazılıyor, yani kaydetmeden ÖNCE görülüyor;
     alanın boş kalması ise kullanıcının cevabı sayılıyor (g119-G/H).
     Vakanın NİYETİ aynı kaldı: form yolunda SESSİZ damga yok. */
  test('F) Form: damga sessiz değil — tarih kaydetmeden önce alanda görünür', async ({ page }) => {
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await ayrintilarAc(page);
    await page.fill('#f-ad', 'Formdan Bitmiş');
    await page.click('[data-act="f-durum"][data-v="bitti"]');
    await expect(page.locator('#f-bit')).toHaveValue(bugunISO());   // GÖRÜNÜR
    await page.click('[data-act="form-kaydet"]');
    await expect(page.locator('#toast')).toContainText('Kitap rafa eklendi');
    expect(await page.evaluate(() =>
      veri.kitaplar.find(k => k.ad === 'Formdan Bitmiş').bitisTarihi)).toBe(bugunISO());
  });

  test('G) Form: tarih GİRİLDİYSE damga cümlesi çıkmaz, girilen tarih durur', async ({ page }) => {
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await ayrintilarAc(page);
    await page.fill('#f-ad', 'Eski Okuma');
    await page.click('[data-act="f-durum"][data-v="bitti"]');
    await page.fill('#f-bit', '2019-04-04');
    await page.click('[data-act="form-kaydet"]');
    await expect(page.locator('#toast')).toContainText('Kitap rafa eklendi');
    await expect(page.locator('#toast')).not.toContainText('bugün olarak yazıldı');
    expect(await page.evaluate(() =>
      veri.kitaplar.find(k => k.ad === 'Eski Okuma').bitisTarihi)).toBe('2019-04-04');
  });

  /* ---- 6) Toplu durum ---- */
  test('H) Toplu "bitti": kaç kitaba bugün yazıldığı söylenir, tarihli olan sayılmaz', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Tarihsiz Eski', durum: 'okunacak', sayfa: 100 }),
      sahteKitap({ ad: 'Zaten Tarihli', durum: 'bitti', sayfa: 100, bitisTarihi: '2018-01-01' })
    ]);
    await rafAc(page);
    await page.click('#secimBtn');
    await page.click('[data-act="toplu-tumu"]');
    await page.click('[data-act="toplu-durum"]');
    await page.selectOption('#topluDurumSec', 'bitti');
    await page.click('[data-act="toplu-durum-uygula"]');
    await expect(page.locator('#toast')).toContainText('2 kitabın durumu değişti');
    // v127: cümle artık YAZILAN tarihi taşıyor (varsayılan bugün) — g119-J
    await expect(page.locator('#toast')).toContainText('1 kitaba bitiş tarihi');
    await expect(page.locator('#toast')).toContainText('yazıldı');
    const d = await page.evaluate(() => ({
      yeni: veri.kitaplar.find(k => k.ad === 'Tarihsiz Eski').bitisTarihi,
      eski: veri.kitaplar.find(k => k.ad === 'Zaten Tarihli').bitisTarihi
    }));
    expect(d.yeni).toBe(bugunISO());
    expect(d.eski).toBe('2018-01-01');   // mevcut tarih EZİLMEZ
  });

  /* ---- 7) Seri tarama: kural SEÇİMİN yanında ---- */
  test('I) Seri tarama panelinde "bitti" kuralı taramadan ÖNCE yazıyor', async ({ page }) => {
    await kameraTaklit(page);
    await rafAc(page);
    await ayarlarAc(page);
    await page.click('#ortuAyar [data-act="seri-ac"]');
    await expect(page.locator('#seriOrtu')).toHaveClass(/acik/);
    await expect(page.locator('#seriDurumNot')).toContainText('BUGÜN');
    // v127: kural artık "seçilebilir tarih" kuralı (g119-M)
    await expect(page.locator('#seriDurumNot')).toContainText('ekleyebilirsin');
  });

  /* ---- 8) Detayda "Bitirdim" ---- */
  test('J) "Bitirdim" bugünü yazdığını söyler', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Sürüyor', durum: 'okunuyor', sayfa: 100, guncelSayfa: 40 })]);
    await rafAc(page);
    await page.click('#liste .kart');
    await page.click('[data-act="bitir"]');
    await expect(page.locator('#toast')).toContainText('Bitiş tarihi bugün olarak yazıldı');
    expect(await page.evaluate(() =>
      veri.kitaplar[0].bitisTarihi)).toBe(bugunISO());
  });

  /* ---- 4) Senkron: bilerek sessiz — KARAR kaynakta belgeli ---- */
  test('K) Senkron kolu: uyarı basmaz ama gerekçe kaynakta yazılı (kaynak kilidi)', async () => {
    const s = fs.readFileSync(path.join(__dirname, '..', 'senkron.js'), 'utf8');
    expect(s).toContain('SEKİZİNCİ TARİH KAÇAĞI');
    expect(s).toContain('v125 sayacına');
    // senkron birleşmesi bu iş için KENDİ uyarısını basmaz (gürültü kararı):
    // çekirdeğin içe-aktarım cümlesi burada çağrılmıyor
    expect(s).not.toContain('tarihsizGirenCumle');
    expect(s).not.toContain('__tarihKacak');
  });
});
