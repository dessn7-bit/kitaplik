'use strict';
/* G76 — YENİ KİTAPLAR kota revizyonu (M2, v78).

   KANIT (v69 canlı): kütüphanede "Romeo and Juliet" + "Hamlet" varken
   kaynaktan gelen Macbeth / Kral Lear listede görünmüyordu — dar kaynak-başı
   dilim (yazar 3) kütüphane elemesinden ÖNCE koşuyor, yuvalar sahip olunan
   kitaplara harcanıyordu (g58 bunu kota-altı fixture ile kilitlemek zorunda
   kalmıştı; kendi yorumunda yazar).

   BU DOSYANIN KİLİTLEDİĞİ KARARLAR (gerekçeler kesfet.js'te):
   - Kütüphane elemesi (birebir ad/adTr/ISBN + başlık varyantı) SORGU ANINDA,
     dilimden ÖNCE de koşar — v53 "eleme dilimden önce" ilkesinin kütüphane
     ayağı.
   - Kaynak başına saklanan aday 8/8/6; B yolunda Google maxResults=20.
     İstek SAYISI değişmedi (koşum başına ≤6; g43'ün kota vakası ayrıca
     yaşıyor).
   - Çizimde ilk B_GOSTER=8 satır + "N öneri daha göster" (B.acik); kısa
     listede KAYNAK DENGESİ (seri > yazar > tür öncelikli taban pay) — bir
     kaynak diğerlerini boğamaz, blok sırası değişmez.
   - AYNI-YAZAR sınırı B'de BİLİNÇLİ YOK (karar): yazar kaynağının amacı
     sevilen yazardan ÇOK kitap göstermek. Rafından'ın yazar≤2 çeşitlilik
     kotası (cesitlilikSec) DEĞİŞMEDİ — g42/g24 kilitleri ayrıca yaşıyor.
   (Mutasyon M2: dilim-öncesi kütüphane elemesi kaldırılır ya da eski 3'lük
    dilime dönülürse (a)/(b) kırmızı; B_GOSTER dengesi ya da "daha" düğmesi
    kaldırılırsa (c)/(d)/(e) kırmızı.) */
const { test, expect, tohumla, sahteKitap, bugunISO } = require('./yardim');

function bitmis(ek) {
  return sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30) }, ek));
}
function okunacak(ek) {
  return sahteKitap(Object.assign({ durum: 'okunacak', sahiplik: 'sahip' }, ek));
}
function sevilen(yazar) {
  return [bitmis({ ad: 'S1 ' + yazar, yazar, puan: 9 }),
          bitmis({ ad: 'S2 ' + yazar, yazar, puan: 10 })];
}
function gItem(ad, yazar, ek) {
  return { volumeInfo: Object.assign({ title: ad, language: 'tr',
    authors: [yazar] }, ek || {}) };
}
async function kesfetAc(page) {
  await page.goto('/');
  await page.click('nav [data-act="sekme"][data-v="kesfet"]');
  await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
}
async function getir(page) {
  await page.click('#ksB [data-act="ks-b-getir"]');
  await expect(page.locator('#ksB')).not.toContainText('Kaynaklara soruluyor',
    { timeout: 15000 });
}
function adlar(page) {
  return page.locator('#ksB .ks-b-ad').allTextContents();
}

/* Üç sinyalli kütüphane (g75 deseni): sevilen tür Bilim-Kurgu, sevilen yazar
   Usta, eksik seri Vakıf (1 bitmiş + 3 rafta → 2 eksik). */
function ucSinyal() {
  return [
    bitmis({ ad: 'Yıldızlara Doğru', yazar: 'Yazar A', tur: 'Bilim-Kurgu', puan: 9 }),
    bitmis({ ad: 'Kızıl Gezegen', yazar: 'Yazar B', tur: 'Bilim-Kurgu', puan: 8 }),
    ...sevilen('Usta'),
    bitmis({ ad: 'Vakıf', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 1,
      tur: 'Bilim-Kurgu', puan: 7 }),
    okunacak({ ad: 'Vakıfın Sınırı', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 3,
      tur: 'Bilim-Kurgu' })
  ];
}
const TURLER = [{ seo: 'Bilim-Kurgu', ad: 'Bilim-Kurgu', kitapSayisi: 5120 }];
const TUR_YANIT = { tur: { seo: 'Bilim-Kurgu', ad: 'Bilim-Kurgu' }, hasMore: true, sonuclar: [
  { ad: 'Dune', yazar: 'Frank Herbert', puan: 8.4, okuyan: 41230, kapak: null },
  { ad: 'Solaris', yazar: 'Stanislaw Lem', puan: 7.8, okuyan: 20114, kapak: null },
  { ad: 'Hiperuzay', yazar: 'Dan Simmons', puan: 7.5, okuyan: 9000, kapak: null },
  { ad: 'Neuromancer', yazar: 'William Gibson', puan: 7.2, okuyan: 8000, kapak: null }
] };
/* TEK Google yanıtı hem seri hem yazar sorgusuna döner (g75 deseni): hangi
   adayın hangi dala düştüğünü uygulamanın kendi denetimleri belirler. */
const DENGE_GOOGLE = { items: [
  gItem('İkinci Vakıf', 'Isaac Asimov', { pageCount: 250 }),
  gItem('Vakıf ve İmparatorluk', 'Isaac Asimov', { pageCount: 240 }),
  gItem('Usta Kitap 1', 'Usta'), gItem('Usta Kitap 2', 'Usta'),
  gItem('Usta Kitap 3', 'Usta'), gItem('Usta Kitap 4', 'Usta'),
  gItem('Usta Kitap 5', 'Usta'), gItem('Usta Kitap 6', 'Usta'),
  gItem('Usta Kitap 7', 'Usta'), gItem('Usta Kitap 8', 'Usta'),
  gItem('Usta Kitap 9', 'Usta')] };
async function dengeGetir(page) {
  page.__agAyar.google = DENGE_GOOGLE;
  page.__agAyar.turler = TURLER;
  page.__agAyar.tur = { 'Bilim-Kurgu': TUR_YANIT };
  await getir(page);
}

test.describe('G76 Keşfet-B kota revizyonu', () => {

  test('(a) tek yazardan 5 aday görünür: sahip olunan kitap yuva yemez, aynı-yazar sınırı yok', async ({ page }) => {
    await tohumla(page, sevilen('Usta'));
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('S1 Usta', 'Usta'),          // kütüphanede → SORGU ANINDA elenir (yuva işgal etmez)
      gItem('Yeni Roman 1', 'Usta'),
      gItem('Yeni Roman 2', 'Usta'),
      gItem('Yeni Roman 3', 'Usta'),
      gItem('Yeni Roman 4', 'Usta'),
      gItem('Yeni Roman 5', 'Usta')] };
    await getir(page);
    // ESKİ davranış: dilim(3) [S1, YR1, YR2] saklar, çizim S1'i düşürür → 2 satır
    expect(await adlar(page)).toEqual(['Yeni Roman 1', 'Yeni Roman 2',
      'Yeni Roman 3', 'Yeni Roman 4', 'Yeni Roman 5']);
    await expect(page.locator('#ksB .ks-b-daha')).toHaveCount(0);   // 5 ≤ 8: kısaltma yok
  });

  test('(b) v69 kanıtının kapanışı: Macbeth / Kral Lear artık görünür', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Romeo and Juliet', yazar: 'William Shakespeare', puan: 9 }),
      bitmis({ ad: 'Hamlet', yazar: 'William Shakespeare', puan: 10 })]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Hamlet', 'William Shakespeare'),             // birebir kütüphanede
      gItem('Romeo ve Juliet', 'William Shakespeare'),    // başlık varyantı (adBenzer)
      gItem('Romeo and Juliet', 'William Shakespeare'),   // birebir kütüphanede
      gItem('Macbeth', 'William Shakespeare'),
      gItem('Kral Lear', 'William Shakespeare'),
      gItem('Fırtına', 'William Shakespeare')] };
    await getir(page);
    // ESKİ davranış: dilim(3) ilk üçü saklar, çizim elemesi hepsini düşürür → BOŞ liste
    expect(await adlar(page)).toEqual(['Macbeth', 'Kral Lear', 'Fırtına']);
  });

  test('(c) kaynak dengesi: kısa listede üç kaynak da temsil edilir; istek sayısı ve derinlik', async ({ page }) => {
    await tohumla(page, ucSinyal());
    await kesfetAc(page);
    await dengeGetir(page);
    // havuz: seri 2 + yazar 8 (9 uygun, dilim 8) + tür 4 = 14 → kısa liste 8
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(8);
    const kaynaklar = await page.locator('#ksB .ks-b-kaynak').allTextContents();
    expect(kaynaklar.filter(k => k === 'Seri').length, 'seri temsil').toBe(2);
    expect(kaynaklar.filter(k => k === 'Yazar').length, 'yazar payı (taban+artık)').toBe(4);
    expect(kaynaklar.filter(k => k === 'Tür').length, 'tür temsil').toBe(2);
    await expect(page.locator('#ksB .ks-b-daha')).toHaveText('6 öneri daha göster');
    // istek bütçesi DEĞİŞMEDİ: 1 seri + 1 yazar sorgusu; derinlik 20
    expect(page.__agSayac.google, 'istek sayısı').toBe(2);
    expect(page.__agSayac.sonGoogleUrl).toContain('maxResults=20');
  });

  test('(d) "daha fazla" çalışır: tam liste iner, düğme kalkar', async ({ page }) => {
    await tohumla(page, ucSinyal());
    await kesfetAc(page);
    await dengeGetir(page);
    await page.click('#ksB [data-act="ks-b-daha"]');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(14);
    await expect(page.locator('#ksB .ks-b-daha')).toHaveCount(0);
  });

  test('(e) kısaltılmış görünümde data-i kayması yok: eklenen aday doğru kitap', async ({ page }) => {
    await tohumla(page, ucSinyal());
    await kesfetAc(page);
    await dengeGetir(page);
    // kısa listedeki BİR yazar satırı (blok sırası: seri, yazar, tür) — görünen
    // sıra ile B.gorunen indeksi farklıdır; ekle yine doğru adayı yazmalı
    const satir = page.locator('#ksB .ks-b-item', { hasText: 'Usta Kitap 4' });
    await expect(satir).toHaveCount(1);
    await satir.locator('[data-act="ks-b-ekle"]').click();
    const eklendi = await page.evaluate(() =>
      (veri.kitaplar || []).some(k => k.ad === 'Usta Kitap 4' && k.sahiplik === 'istek'));
    expect(eklendi, 'kısa görünümden eklenen aday birebir o kitap').toBe(true);
  });
});
