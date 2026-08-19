'use strict';
/* G75 — KEŞFET süzgeci YENİ KİTAPLAR bölümüne de uygulanır (v77).

   KUSUR (canlı kanıt): Tür çipi "Bilim-Teknoloji-Mühendislik" seçiliyken
   "Rafından" doğru süzülüyor, YENİ KİTAPLAR bölümü "Biyografi türünde 3 kitap
   bitirdin" gerekçeli önerileri göstermeyi sürdürüyordu.

   BU DOSYANIN KİLİTLEDİĞİ KARARLAR (gerekçeler kesfet.js'te yazılı):
   - Tür + Uzunluk süzgeçleri YENİ KİTAPLAR'a uygulanır.
   - Bende / İstek listem (sahiplik) ve Raf UYGULANMAZ: aday tanımı gereği
     kütüphanede olmayan kitaptır; ikisi de "sahiplik/yer" kavramıdır.
   - Adayın türü: tur kaynağı → sorgu anında mühürlenen kullanıcı türü;
     seri → kütüphanedeki ciltlerin türü, yoksa Google kategorileri;
     yazar → yalnız adayın KENDİ Google kategorileri (yazarın öbür
     kitaplarından çıkarım YOK).
   - TÜRÜ BİLİNMEYEN aday süzgeç açıkken ELENİR.
   - SERİ MUAFİYETİ YOK.
   - Süzgeç değişimi SORGU ATMAZ (kota); eleme yerel havuzda çalışır.
   - Süzgeç listeyi boşaltırsa DÜRÜST mesaj + kaç önerinin geri geleceği.

   (Mutasyon: bBolumHtml'de `ham.filter(bSuzgectenGecer)` yerine `ham` konur →
    "yalnız o türden" ve "türü bilinmeyen elenir" vakaları kırmızı.) */
const { test, expect, tohumla, sahteKitap, bugunISO } = require('./yardim');

function bitmis(ek) {
  return sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30) }, ek));
}
function okunacak(ek) {
  return sahteKitap(Object.assign({ durum: 'okunacak', sahiplik: 'sahip' }, ek));
}

/* Kütüphane:
   - Bilim-Kurgu türü: 9 + 8 + 7 → ort 8,0 · n=3 → sevilen tür (eşik n≥2, ort≥7)
   - Usta: 9 + 10 → ort 9,5 → sevilen yazar (eşik 8). "Yazar A/B" tek harfli
     ikinci sözcük yüzünden SORGULANAMAZ sayılır (sorulabilirYazar) — kotayı
     işgal etmezler.
   - Vakıf serisi: 1. cilt bitmiş, 3. cilt rafta → 2. cilt EKSİK.
   - Okunacak türleri çipleri üretir: Bilim-Kurgu (Vakıfın Sınırı) + Şiir. */
function kutuphane() {
  return [
    bitmis({ ad: 'Yıldızlara Doğru', yazar: 'Yazar A', tur: 'Bilim-Kurgu', puan: 9 }),
    bitmis({ ad: 'Kızıl Gezegen', yazar: 'Yazar B', tur: 'Bilim-Kurgu', puan: 8 }),
    bitmis({ ad: 'Ustanın İlk Kitabı', yazar: 'Usta', puan: 9 }),
    bitmis({ ad: 'Ustanın İkinci Kitabı', yazar: 'Usta', puan: 10 }),
    bitmis({ ad: 'Vakıf', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 1,
      tur: 'Bilim-Kurgu', puan: 7 }),
    okunacak({ ad: 'Vakıfın Sınırı', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 3,
      tur: 'Bilim-Kurgu' }),
    okunacak({ ad: 'Şiir Defteri', yazar: 'Şair Biri', tur: 'Şiir', raf: 'Salon' })
  ];
}

function gItem(ad, yazar, ek) {
  return { volumeInfo: Object.assign({ title: ad, authors: [yazar], language: 'tr' }, ek || {}) };
}
/* TEK Google yanıtı hem seri hem yazar sorgusuna döner; hangi adayın hangi
   dala düştüğünü uygulamanın kendi denetimleri (seriEslesir / yazarEslesir)
   belirler — taklit bunu zorlamaz. */
const GOOGLE = { items: [
  // seri dalı: "Vakıf" başlıkta geçer + yazar tutar. KENDİ kategorisi Fantastik'e
  // eşlenir; kütüphanedeki ciltlerin türü (Bilim-Kurgu) ÖNCELİKLİDİR.
  gItem('İkinci Vakıf', 'Isaac Asimov', { categories: ['Fantasy'], pageCount: 250 }),
  // yazar dalı, türü BİLİNEN (Science Fiction → Bilim-Kurgu), kısa
  gItem('Ustanın Yeni Romanı', 'Usta', { categories: ['Science Fiction'], pageCount: 150 }),
  // yazar dalı, türü BİLİNMEYEN (kategori yok), uzun
  gItem('Ustanın Anıları', 'Usta', { pageCount: 500 }),
  // yazar dalı, BAŞKA tür (Poetry → Şiir), kısa
  gItem('Ustanın Şiirleri', 'Usta', { categories: ['Poetry'], pageCount: 90 })
] };
const TURLER = [
  { seo: 'Bilim-Kurgu', ad: 'Bilim-Kurgu', kitapSayisi: 5120 },
  { seo: 'Roman', ad: 'Roman', kitapSayisi: 25393 }
];
/* 1000Kitap tür kaydı SAYFA taşımaz (canlı sözleşme) — uzunluk vakası bunu kullanır. */
const TUR_YANIT = { tur: { seo: 'Bilim-Kurgu', ad: 'Bilim-Kurgu' }, hasMore: true, sonuclar: [
  { ad: 'Dune', yazar: 'Frank Herbert', puan: 8.4, okuyan: 41230, kapak: null },
  { ad: 'Solaris', yazar: 'Stanislaw Lem', puan: 7.8, okuyan: 20114, kapak: null }
] };

async function kesfetAc(page) {
  await page.goto('/');
  await page.click('nav [data-act="sekme"][data-v="kesfet"]');
  await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
}
async function getir(page) {
  page.__agAyar.google = GOOGLE;
  page.__agAyar.turler = TURLER;
  page.__agAyar.tur = { 'Bilim-Kurgu': TUR_YANIT };
  await page.click('#ksB [data-act="ks-b-getir"]');
  await expect(page.locator('#ksB .ks-b-item')).toHaveCount(6);
}
function bAdlar(page) {
  return page.locator('#ksB .ks-b-item .ks-b-ad').allTextContents();
}
async function cip(page, grup, deger) {
  await page.click('#ksIcerik .ks-chip[data-g="' + grup + '"][data-v="' + deger + '"]');
}

test.describe('G75 Keşfet süzgeci — YENİ KİTAPLAR', () => {

  test('(a) TÜR çipi seçiliyken YENİ KİTAPLAR yalnız o türden öneri gösterir', async ({ page }) => {
    await tohumla(page, kutuphane());
    await kesfetAc(page);
    await getir(page);
    // süzgeçsiz: üç kaynağın altı adayı da listede
    expect(await bAdlar(page)).toEqual(['İkinci Vakıf', 'Ustanın Yeni Romanı',
      'Ustanın Anıları', 'Ustanın Şiirleri', 'Dune', 'Solaris']);
    await cip(page, 'tur', 'Bilim-Kurgu');
    expect(await bAdlar(page)).toEqual(['İkinci Vakıf', 'Ustanın Yeni Romanı',
      'Dune', 'Solaris']);
    // gerekçesi başka türü anan satır EKRANDA YOK (canlı kusurun birebir dengi)
    await expect(page.locator('#ksB')).not.toContainText('Şiir');
  });

  test('(a2) tür kaynaklı aday KENDİ türünde kalır, başka tür çipinde elenir', async ({ page }) => {
    await tohumla(page, kutuphane());
    await kesfetAc(page);
    await getir(page);
    await cip(page, 'tur', 'Şiir');
    // Dune/Solaris tür kaynaklıdır ve sinyali Bilim-Kurgu'dur → Şiir'de yok
    expect(await bAdlar(page)).toEqual(['Ustanın Şiirleri']);
  });

  test('(b) türü BİLİNMEYEN aday süzgeç açıkken elenir, süzgeçsizken listede', async ({ page }) => {
    await tohumla(page, kutuphane());
    await kesfetAc(page);
    await getir(page);
    // "Ustanın Anıları" kategorisizdir: süzgeçsiz listede DURUYOR
    expect(await bAdlar(page)).toContain('Ustanın Anıları');
    await cip(page, 'tur', 'Bilim-Kurgu');
    expect(await bAdlar(page)).not.toContain('Ustanın Anıları');
    // aynı dalın türü BİLİNEN adayı geçer → eleme "yazar kaynağını kapatmak" değil
    expect(await bAdlar(page)).toContain('Ustanın Yeni Romanı');
  });

  test('(c) SERİ adayı: türü kütüphanedeki ciltlerden okunur, muafiyet YOK', async ({ page }) => {
    await tohumla(page, kutuphane());
    await kesfetAc(page);
    await getir(page);
    // Google kategorisi Fantasy; kütüphanedeki Vakıf ciltleri Bilim-Kurgu → GEÇER
    await cip(page, 'tur', 'Bilim-Kurgu');
    expect(await bAdlar(page)).toContain('İkinci Vakıf');
    await cip(page, 'tur', 'Bilim-Kurgu');   // kaldır
    await cip(page, 'tur', 'Şiir');
    // en güçlü sinyal olsa da başka tür çipinde ELENİR (görünüm sözleşmesi)
    expect(await bAdlar(page)).not.toContain('İkinci Vakıf');
  });

  test('(d) süzgeç kaldırılınca tüm öneriler geri gelir', async ({ page }) => {
    await tohumla(page, kutuphane());
    await kesfetAc(page);
    await getir(page);
    await cip(page, 'tur', 'Bilim-Kurgu');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(4);
    await cip(page, 'tur', 'Bilim-Kurgu');   // aynı çipe ikinci basış = kaldır
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(6);
    expect(await bAdlar(page)).toContain('Ustanın Anıları');
  });

  test('(e) süzgeç listeyi boşaltırsa DÜRÜST mesaj — uydurma satır yok', async ({ page }) => {
    await tohumla(page, kutuphane());
    await kesfetAc(page);
    await getir(page);
    await cip(page, 'tur', 'Şiir');
    await cip(page, 'uzunluk', 'uzun');       // Ustanın Şiirleri 90 sayfa → kısa
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(0);
    await expect(page.locator('#ksB .ks-b-not'))
      .toContainText('Bu süzgeçle eşleşen yeni öneri yok');
    // sayı GERÇEK havuzdan: 6 aday geri gelecek
    await expect(page.locator('#ksB .ks-b-not')).toContainText('6 öneri geri gelir');
  });

  test('(e2) süzgeç aday elediyse sayım satırı GERÇEK sayıları söyler', async ({ page }) => {
    await tohumla(page, kutuphane());
    await kesfetAc(page);
    await getir(page);
    await expect(page.locator('#ksB .ks-b-sayim'), 'süzgeçsizken sayım YOK').toHaveCount(0);
    await cip(page, 'tur', 'Bilim-Kurgu');
    await expect(page.locator('#ksB .ks-b-sayim'))
      .toHaveText('6 yeni aday · süzgeçten geçen: 4');
  });

  test('(f) RAFINDAN bölümünün süzgeç davranışı BOZULMADI', async ({ page }) => {
    await tohumla(page, kutuphane());
    await kesfetAc(page);
    await getir(page);
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(2);
    await cip(page, 'tur', 'Bilim-Kurgu');
    const raf = page.locator('#ksIcerik .ks-item');
    await expect(raf).toHaveCount(1);
    await expect(raf).toContainText('Vakıfın Sınırı');
    await expect(page.locator('#ksIcerik .ks-acilis')).toContainText('süzgeçten geçen: 1');
  });

  test('(g) KOTA: süzgeç değişimi yeni sorgu ATMAZ', async ({ page }) => {
    await tohumla(page, kutuphane());
    await kesfetAc(page);
    await getir(page);
    const once = { google: page.__agSayac.google, turler: page.__agSayac.turler,
      tur: page.__agSayac.tur };
    expect(once.google, 'seri + yazar sorgusu atıldı').toBeGreaterThan(0);
    await cip(page, 'tur', 'Bilim-Kurgu');
    await cip(page, 'tur', 'Bilim-Kurgu');
    await cip(page, 'tur', 'Şiir');
    await cip(page, 'uzunluk', 'kisa');
    await cip(page, 'uzunluk', 'kisa');
    await expect(page.locator('#ksB .ks-b-item').first()).toBeVisible();
    expect(page.__agSayac.google, 'çip dokunuşu Google sorgusu atmaz').toBe(once.google);
    expect(page.__agSayac.turler).toBe(once.turler);
    expect(page.__agSayac.tur).toBe(once.tur);
  });

  test('(h) KARAR: Bende / İstek listem çipi YENİ KİTAPLAR\'ı süzmez', async ({ page }) => {
    await tohumla(page, kutuphane());
    await kesfetAc(page);
    await getir(page);
    await cip(page, 'sahiplik', 'istek');
    await expect(page.locator('#ksB .ks-b-item'), 'istek kipinde de tam liste').toHaveCount(6);
    await cip(page, 'sahiplik', 'sahip');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(6);
  });

  test('(i) KARAR: Raf çipi Rafından\'ı süzer, YENİ KİTAPLAR\'ı süzmez', async ({ page }) => {
    await tohumla(page, kutuphane());
    await kesfetAc(page);
    await getir(page);
    await cip(page, 'raf', 'Salon');
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(1);
    await expect(page.locator('#ksIcerik .ks-item')).toContainText('Şiir Defteri');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(6);
  });

  test('(j) UZUNLUK süzgeci uygulanır; sayfası bilinmeyen aday elenir', async ({ page }) => {
    await tohumla(page, kutuphane());
    await kesfetAc(page);
    await getir(page);
    await cip(page, 'uzunluk', 'kisa');
    // 150 ve 90 sayfa geçer; 250/500 kovaya girmez; tür kaynağı sayfa taşımaz
    expect(await bAdlar(page)).toEqual(['Ustanın Yeni Romanı', 'Ustanın Şiirleri']);
  });

  test('ÖNBELLEK GÖÇÜ: mühürsüz v1 kovası okunmaz ve silinir', async ({ page }) => {
    /* v77 anahtar bumpı: v1'deki adaylarda tür mührü yok — okunsalardı tür
       süzgeci onları "türü bilinmeyen" sayıp elerdi. Kova okunmaz, silinir;
       bölüm dürüstçe "getir" düğmesine döner (uydurma liste yok). */
    await tohumla(page, kutuphane(), {
      kk_kesfet_b_v1: { imza: '[["usta"],[],[]]', t: Date.now(), adaylar: [
        { ad: 'Eski Kovadan', yazar: 'Usta', dil: 'TR', kaynakTip: 'yazar', neden: 'x' }] } });
    await kesfetAc(page);
    await expect(page.locator('#ksB')).not.toContainText('Eski Kovadan');
    await expect(page.locator('#ksB [data-act="ks-b-getir"]')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('kk_kesfet_b_v1'))).toBeNull();
    expect(page.__agSayac.google, 'göç kendiliğinden sorgu atmaz').toBe(0);
  });

  test('süzgeç açıkken "İstek listeme ekle" DOĞRU adayı ekler (indis kayması yok)',
    async ({ page }) => {
      await tohumla(page, kutuphane());
      await kesfetAc(page);
      await getir(page);
      await cip(page, 'tur', 'Şiir');
      const satir = page.locator('#ksB .ks-b-item', { hasText: 'Ustanın Şiirleri' });
      await satir.locator('[data-act="ks-b-ekle"]').click();
      const eklenen = await page.evaluate(() =>
        (veri.kitaplar || []).filter(k => k.sahiplik === 'istek').map(k => k.ad));
      expect(eklenen).toEqual(['Ustanın Şiirleri']);
    });
});
