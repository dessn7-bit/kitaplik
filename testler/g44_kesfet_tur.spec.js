'use strict';
/* G44 — KEŞFET B, TÜR kaynağı (v52).
   Kullanıcının en çok okuduğu / en yüksek puan verdiği türler 1000Kitap tür
   slug'larıyla eşleştirilir, o türün en çok okunan kitapları önerilir.

   SÖZLEŞMELER (bu dosyanın koruduğu):
   - Eşik: n ≥ 2 (MIN_TUR_KITAP) VE ort ≥ 7 (SEVILEN_TUR_ORT), sıra ort↓ n↓.
   - Kota: en fazla 2 tür, her birinden ilk sayfa (≤4 aday).
   - Eşleşme 4 kademeli; TUTMAZSA TÜR ATLANIR — uydurma eşleme YOK.
   - Gerekçe iki yarım: kullanıcı verisi + KAYNAK verisi (okur, ★). Etiketler
     farklıysa (Felsefe → Felsefe-Düşünce) bu açıkça yazılır.
   - Eleme (ad+yazar TR-katlamalı) ve kesfetGizli tür adaylarına da uygulanır.
   - Tembellik ve 24s imzalı önbellek korunur; tür sinyali imzaya girer.
   (Mutasyon 1: bElenmis'ten kütüphane elemesi kaldırılır → eleme vakası kırmızı.
    Mutasyon 2: worker'ın boş-sonuç no-store kuralı kaldırılır → g20 kırmızı.)

   BİLİNEN SINIR (bilerek test EDİLMEYEN): 1000Kitap tür kaydında ISBN alanı
   YOK (canlı ölçüm) — bu yüzden tür adayları ISBN taşımaz ve ISBN elemesi bu
   kaynak için devreye giremez; tek savunma ad+yazar katlamasıdır. Aşağıdaki
   "ISBN taşımaz" vakası bunu KİLİTLER: kaynak ileride ISBN verirse vaka
   kırmızıya döner ve elemenin genişletilmesi gerektiğini söyler. */
const { test, expect, tohumla, sahteKitap, bugunISO } = require('./yardim');

function bitmis(ek) {
  return sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30) }, ek));
}
function okunacak(ek) {
  return sahteKitap(Object.assign({ durum: 'okunacak', sahiplik: 'sahip' }, ek));
}
/* Felsefe: (9+8)/2 = 8,5 · n=2 → sevilen tür.
   Roman: (6+5)/2 = 5,5 → eşiğin (7) ALTINDA.
   Gezi: tek kitap 10 → n eşiğinin (2) ALTINDA. */
function turVeri(ek) {
  return [
    bitmis({ ad: 'F1', yazar: 'Yazar A', tur: 'Felsefe', puan: 9 }),
    bitmis({ ad: 'F2', yazar: 'Yazar B', tur: 'Felsefe', puan: 8 }),
    bitmis({ ad: 'R1', yazar: 'Yazar C', tur: 'Roman', puan: 6 }),
    bitmis({ ad: 'R2', yazar: 'Yazar D', tur: 'Roman', puan: 5 }),
    bitmis({ ad: 'G1', yazar: 'Yazar E', tur: 'Gezi', puan: 10 })
  ].concat(ek || []);
}
/* 1000Kitap taksonomisinin gerçek kayıtlarından bir kesit (canlı /turler'den).
   `novella` bilerek 0 kitaplı: havuzdan düşmeli. */
const TURLER = [
  { seo: 'Dunya-Klasikleri', ad: 'Dünya Klasikleri', kitapSayisi: 862 },
  { seo: 'Roman', ad: 'Roman', kitapSayisi: 25393 },
  { seo: 'Felsefe-Dusunce', ad: 'Felsefe-Düşünce', kitapSayisi: 4114 },
  { seo: 'Hikaye-Oyku', ad: 'Hikaye (Öykü)', kitapSayisi: 9508 },
  { seo: 'Gezi', ad: 'Gezi', kitapSayisi: 660 },
  { seo: 'novella', ad: 'Novella', kitapSayisi: 0 }
];
function turYanit(seo, ad, kitaplar) {
  return { tur: { seo, ad }, hasMore: true, sonuclar: kitaplar };
}
const FELSEFE = turYanit('Felsefe-Dusunce', 'Felsefe-Düşünce', [
  { ad: 'Yabancı', yazar: 'Albert Camus', puan: 7.9, okuyan: 138762, kapak: null },
  { ad: 'Ermiş', yazar: 'Halil Cibran', puan: 7.5, okuyan: 86117, kapak: null }
]);

async function kesfetAc(page) {
  await page.goto('/');
  await page.click('nav [data-act="sekme"][data-v="kesfet"]');
  await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
}
async function getir(page) {
  await page.click('#ksB [data-act="ks-b-getir"]');
}
function satir(page, ad) {
  return page.locator('#ksB .ks-b-item', { hasText: ad });
}

test.describe('G44 Keşfet-B tür kaynağı', () => {

  test('tür önerisi listede; gerekçe KULLANICI verisini ve KAYNAK sayılarını anar', async ({ page }) => {
    await tohumla(page, turVeri());
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.tur = { 'Felsefe-Dusunce': FELSEFE };
    await getir(page);
    const s = satir(page, 'Yabancı');
    await expect(s).toBeVisible();
    await expect(s.locator('.ks-b-kaynak'), 'kaynak farkı görünür').toHaveText('Tür');
    // bağımsız hesap: (9+8)/2 = 8,5 · n=2 — cümledeki sayı uydurma değil
    await expect(s.locator('.ks-b-neden'))
      .toContainText('Felsefe türünde 2 kitap bitirdin, ortalama 8,5 verdin');
    // kaynak yarısı: okur adedi ve puan KAYNAKTAN, Türkçe biçimde
    await expect(s.locator('.ks-b-neden')).toContainText('138.762 okur');
    await expect(s.locator('.ks-b-neden')).toContainText('★7,9');
    // etiketler FARKLI (Felsefe ≠ Felsefe-Düşünce) → eşleştirme açıkça yazılır
    await expect(s.locator('.ks-b-neden')).toContainText('Felsefe-Düşünce içinde');
    expect(page.__agSayac.sonTurUrl).toContain('slug=Felsefe-Dusunce');
  });

  test('etiketler AYNIYSA eşleştirme cümlesi tekrar etmez', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'G1', yazar: 'Y1', tur: 'Gezi', puan: 9 }),
      bitmis({ ad: 'G2', yazar: 'Y2', tur: 'Gezi', puan: 8 })]);
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.tur = { Gezi: turYanit('Gezi', 'Gezi',
      [{ ad: 'Yolculuk', yazar: 'Gezgin', puan: 8, okuyan: 4210, kapak: null }]) };
    await getir(page);
    const n = satir(page, 'Yolculuk').locator('.ks-b-neden');
    await expect(n).toContainText('Gezi türünde 2 kitap bitirdin, ortalama 8,5 verdin');
    await expect(n).toContainText('1000Kitap\'ta 4.210 okur, ★8,0');
    expect(await n.textContent(), 'aynı etiket iki kez yazılmaz').not.toContain('içinde');
  });

  test('EŞİKLER: n<2 tür ve ort<7 tür sorulmaz; yalnız geçen tür sorulur', async ({ page }) => {
    await tohumla(page, turVeri());
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.tur = {
      'Felsefe-Dusunce': FELSEFE,
      Roman: turYanit('Roman', 'Roman', [{ ad: 'OLMAMALI Roman', yazar: 'X', puan: 9, okuyan: 9, kapak: null }]),
      Gezi: turYanit('Gezi', 'Gezi', [{ ad: 'OLMAMALI Gezi', yazar: 'Y', puan: 9, okuyan: 9, kapak: null }]) };
    await getir(page);
    await expect(satir(page, 'Yabancı')).toBeVisible();
    expect(page.__agSayac.tur, 'yalnız 1 tür eşiği geçti').toBe(1);
    await expect(page.locator('#ksB')).not.toContainText('OLMAMALI');
  });

  test('KOTA: eşiği geçen 3 tür olsa da en fazla 2 sorgu atılır (ort↓ sırasıyla)', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'A1', yazar: 'a', tur: 'Felsefe', puan: 10 }),
      bitmis({ ad: 'A2', yazar: 'b', tur: 'Felsefe', puan: 10 }),   // ort 10
      bitmis({ ad: 'B1', yazar: 'c', tur: 'Gezi', puan: 9 }),
      bitmis({ ad: 'B2', yazar: 'd', tur: 'Gezi', puan: 9 }),       // ort 9
      bitmis({ ad: 'C1', yazar: 'e', tur: 'Öykü', puan: 8 }),
      bitmis({ ad: 'C2', yazar: 'f', tur: 'Öykü', puan: 8 })]);     // ort 8 → kota dışı
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.tur = {
      'Felsefe-Dusunce': FELSEFE,
      Gezi: turYanit('Gezi', 'Gezi', [{ ad: 'Gezi Kitabı', yazar: 'G', puan: 8, okuyan: 100, kapak: null }]),
      'Hikaye-Oyku': turYanit('Hikaye-Oyku', 'Hikaye (Öykü)',
        [{ ad: 'OLMAMALI Öykü', yazar: 'O', puan: 8, okuyan: 100, kapak: null }]) };
    await getir(page);
    await expect(satir(page, 'Yabancı')).toBeVisible();
    await expect(satir(page, 'Gezi Kitabı')).toBeVisible();
    expect(page.__agSayac.tur, 'kota 2').toBe(2);
    await expect(page.locator('#ksB')).not.toContainText('OLMAMALI');
  });

  test('EŞLEŞME KADEMELERİ: sözcük eşleşmesi tutar, tutmayan tür ATLANIR (uydurma yok)', async ({ page }) => {
    // "Öykü" hiçbir slug/ad ile TAM eşleşmez; yalnız "Hikaye (Öykü)" adının
    // SÖZCÜĞÜ olarak tutar. "Distopya" hiçbir kademede tutmaz → atlanır.
    await tohumla(page, [
      bitmis({ ad: 'O1', yazar: 'a', tur: 'Öykü', puan: 9 }),
      bitmis({ ad: 'O2', yazar: 'b', tur: 'Öykü', puan: 9 }),
      bitmis({ ad: 'D1', yazar: 'c', tur: 'Distopya', puan: 10 }),
      bitmis({ ad: 'D2', yazar: 'd', tur: 'Distopya', puan: 10 })]);
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.tur = { 'Hikaye-Oyku': turYanit('Hikaye-Oyku', 'Hikaye (Öykü)',
      [{ ad: 'Öykü Kitabı', yazar: 'Ö', puan: 8, okuyan: 500, kapak: null }]) };
    await getir(page);
    await expect(satir(page, 'Öykü Kitabı')).toBeVisible();
    // Distopya daha yüksek ortalamaya (10) sahip ama eşleşmediği için HİÇ sorulmadı
    expect(page.__agSayac.tur, 'yalnız eşleşen tür soruldu').toBe(1);
    expect(page.__agSayac.sonTurUrl).toContain('slug=Hikaye-Oyku');
    await expect(page.locator('#ksB')).not.toContainText('Distopya');
  });

  test('HİÇ tür eşleşmezse tek istek bile atılmaz (bölüm sessizce yazar/seriye düşer)', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'D1', yazar: 'c', tur: 'Distopya', puan: 10 }),
      bitmis({ ad: 'D2', yazar: 'd', tur: 'Distopya', puan: 10 })]);
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    await getir(page);
    await expect(page.locator('#ksB .ks-b-not')).toContainText('bulunamadı');
    expect(page.__agSayac.turler, 'taksonomi bir kez soruldu').toBe(1);
    expect(page.__agSayac.tur, 'eşleşme yok → tür sorgusu yok').toBe(0);
  });

  test('0 kitaplı tür (novella) havuzdan düşer — boş türe sorgu atılmaz', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'N1', yazar: 'a', tur: 'Novella', puan: 9 }),
      bitmis({ ad: 'N2', yazar: 'b', tur: 'Novella', puan: 9 })]);
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    await getir(page);
    expect(page.__agSayac.tur).toBe(0);
  });

  test('kütüphanede ZATEN OLAN tür önerisi elenir (ad+yazar TR-katlamalı)', async ({ page }) => {
    await tohumla(page, turVeri([okunacak({ ad: 'YABANCI', yazar: 'ALBERT CAMUS' })]));
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.tur = { 'Felsefe-Dusunce': FELSEFE };
    await getir(page);
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);
    await expect(page.locator('#ksB .ks-b-item')).toContainText('Ermiş');
  });

  test('kütüphanede olan kitap ISBN\'li olsa da tür adayı ad+yazarla elenir', async ({ page }) => {
    // Tür kaynağı ISBN vermiyor: bu adayın tek savunması ad+yazar katlaması.
    await tohumla(page, turVeri([
      okunacak({ ad: 'Yabancı', yazar: 'Albert Camus', isbn: '978-975-07-0708-0' })]));
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.tur = { 'Felsefe-Dusunce': FELSEFE };
    await getir(page);
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);
    await expect(page.locator('#ksB .ks-b-item')).toContainText('Ermiş');
  });

  test('SINIR KİLİDİ: tür adayı ISBN taşımaz (kaynakta alan yok)', async ({ page }) => {
    await tohumla(page, turVeri());
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.tur = { 'Felsefe-Dusunce': FELSEFE };
    await getir(page);
    await page.click('#ksB .ks-b-item:has-text("Yabancı") [data-act="ks-b-ekle"]');
    const k = await page.evaluate(() => veri.kitaplar.find(x => x.ad === 'Yabancı'));
    expect(k.sahiplik).toBe('istek');
    expect(k.isbn, 'kaynak ISBN vermiyor — eleme yalnız ad+yazar').toBe('');
  });

  test('"İlgilenmiyorum" tür önerisini de kalıcı gizler', async ({ page }) => {
    await tohumla(page, turVeri());
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.tur = { 'Felsefe-Dusunce': FELSEFE };
    await getir(page);
    await page.click('#ksB .ks-b-item:has-text("Yabancı") [data-act="ks-b-gizle"]');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);
    await expect(page.locator('#ksB .ks-b-item')).toContainText('Ermiş');
    expect(await page.evaluate(() => Object.keys(veri.kesfetGizli || {}).length)).toBe(1);
    await page.reload();
    await page.click('nav [data-act="sekme"][data-v="kesfet"]');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);
    await expect(page.locator('#ksB .ks-b-item')).toContainText('Ermiş');
  });

  test('AĞ HATASI: tür kaynağı düşerse yazar önerileri ve "Rafından" etkilenmez', async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', e => hatalar.push(String(e)));
    await tohumla(page, turVeri([
      bitmis({ ad: 'U1', yazar: 'Usta', puan: 9 }),
      bitmis({ ad: 'U2', yazar: 'Usta', puan: 10 }),
      okunacak({ ad: 'Rafta Duran', yazar: 'RD' })]));
    await kesfetAc(page);
    page.__agAyar.turler = 'hata';
    page.__agAyar.google = { items: [{ volumeInfo: { title: 'Ustanın Kitabı',
      authors: ['Usta'], language: 'tr' } }] };   // dil süzgeci (v65) konu dışı — Türkçe sahte
    await getir(page);
    // yazar dalı yaşıyor
    await expect(satir(page, 'Ustanın Kitabı')).toBeVisible();
    await expect(satir(page, 'Ustanın Kitabı').locator('.ks-b-kaynak')).toHaveText('Yazar');
    // Rafından bölümü yaşıyor
    await expect(page.locator('#ksIcerik .ks-item')).toContainText('Rafta Duran');
    expect(page.__agSayac.tur, 'taksonomi düştü → tür sorgusu yok').toBe(0);
    expect(hatalar, 'çökme yok').toEqual([]);
  });

  test('AĞ HATASI: yalnız tür kaynağı ve başka sonuç yoksa DÜRÜST hata mesajı', async ({ page }) => {
    await tohumla(page, turVeri());
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.tur = 'hata';
    await getir(page);
    await expect(page.locator('#ksB .ks-b-not')).toContainText('İnternete ulaşılamadı');
    await expect(page.locator('#ksB [data-act="ks-b-getir"]')).toBeVisible();
  });

  test('TEMBEL: Keşfet açılışı tür isteği ATMAZ', async ({ page }) => {
    await tohumla(page, turVeri());
    await kesfetAc(page);
    expect(page.__agSayac.turler).toBe(0);
    expect(page.__agSayac.tur).toBe(0);
    await expect(page.locator('#ksB [data-act="ks-b-getir"]')).toBeVisible();
  });

  test('ÖNBELLEK: ikinci açılışta tür isteği yok; tür sinyali değişince önbellek düşer', async ({ page }) => {
    await tohumla(page, turVeri());
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.tur = { 'Felsefe-Dusunce': FELSEFE };
    await getir(page);
    await expect(satir(page, 'Yabancı')).toBeVisible();
    const once = { turler: page.__agSayac.turler, tur: page.__agSayac.tur };
    expect(once.tur).toBe(1);
    await page.reload();
    await page.click('nav [data-act="sekme"][data-v="kesfet"]');
    await expect(satir(page, 'Yabancı')).toBeVisible();
    expect(page.__agSayac.turler, 'ikinci açılışta yeni dış istek yok').toBe(once.turler);
    expect(page.__agSayac.tur).toBe(once.tur);
    /* Tür sinyali DEĞİŞİR → imza tutmaz. İmza kapısı KALICI önbelleği korur,
       oturum içindeki hazır listeyi değil (v51 sözleşmesi: kullanıcının önüne
       getirdiği liste altından çekilmez; eleme zaten her çizimde tazedir).
       Bu yüzden ölçüm YÜKLEMEDE yapılır: bayat imzalı önbellek geri gelmez ve
       kendiliğinden yeni sorgu da atılmaz — düğme yeniden çıkar. */
    await page.evaluate(() => {
      [1, 2].forEach(i => veri.kitaplar.push({ id: 'yeni' + i, ad: 'Yeni Gezi ' + i,
        yazar: 'g' + i, tur: 'Gezi', durum: 'bitti', puan: 10,
        eklenme: Date.now(), g: 0, etiketler: [], notlar: [] }));
      depoKaydet();
    });
    await page.reload();
    await page.click('nav [data-act="sekme"][data-v="kesfet"]');
    await expect(page.locator('#ksB [data-act="ks-b-getir"]'),
      'bayat imzalı önbellek servis edilmiyor').toBeVisible();
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(0);
    expect(page.__agSayac.tur, 'önbellek düştü ama kendiliğinden sorgu da atılmadı')
      .toBe(once.tur);
  });

  test('Ciltli: tür satırı dolu düğmesiz, yuvarlak kartsız, gölgesiz', async ({ page }) => {
    await tohumla(page, turVeri());
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.tur = { 'Felsefe-Dusunce': FELSEFE };
    await getir(page);
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(2);
    expect(await page.locator('#ksB .kicker').textContent()).toBe('Yeni kitaplar');
    const kacaklar = await page.evaluate(() => {
      const RENK = z => { const m = z.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
        return m ? { a: m[4] === undefined ? 1 : +m[4] } : { a: 1 }; };
      return [...document.querySelectorAll('#ksB *')]
        .filter(el => el.offsetParent !== null)
        .map(el => { const c = getComputedStyle(el);
          return { r: parseFloat(c.borderRadius) || 0, golge: c.boxShadow,
            dolu: el.tagName === 'BUTTON' && RENK(c.backgroundColor).a >= 0.5 }; })
        .filter(o => o.r > 7 || o.golge !== 'none' || o.dolu);
    });
    expect(kacaklar).toEqual([]);
  });

  for (const tema of ['acik', 'karanlik']) {
    test(`tür kaynak etiketi AA (${tema} tema)`, async ({ page }) => {
      await tohumla(page, turVeri(), { kk_tema_v1: tema });
      await kesfetAc(page);
      page.__agAyar.turler = TURLER;
      page.__agAyar.tur = { 'Felsefe-Dusunce': FELSEFE };
      await getir(page);
      await expect(page.locator('#ksB .ks-b-kaynak').first()).toBeVisible();
      const oran = await page.evaluate(() => {
        const el = document.querySelector('#ksB .ks-b-kaynak');
        const COZ = z => { let m = z.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
          if(m) return { r:+m[1], g:+m[2], b:+m[3], a:m[4] === undefined ? 1 : +m[4] };
          m = z.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
          if(m) return { r:255*+m[1], g:255*+m[2], b:255*+m[3], a:m[4] === undefined ? 1 : +m[4] };
          return { r:0,g:0,b:0,a:1 }; };
        const metin = COZ(getComputedStyle(el).color);
        let zemin = { r:255,g:255,b:255 }, kat = [], p = el;
        while(p && p !== document.documentElement){
          const c = COZ(getComputedStyle(p).backgroundColor);
          if(c.a > 0){ kat.push(c); if(c.a >= 1) break; }
          p = p.parentElement;
        }
        for(let i = kat.length - 1; i >= 0; i--){
          const c = kat[i];
          zemin = { r: c.r*c.a + zemin.r*(1-c.a), g: c.g*c.a + zemin.g*(1-c.a),
            b: c.b*c.a + zemin.b*(1-c.a) };
        }
        const L = c => { const f = v => { v /= 255;
          return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
          return .2126*f(c.r) + .7152*f(c.g) + .0722*f(c.b); };
        const l1 = L(metin), l2 = L(zemin);
        return (Math.max(l1,l2) + .05) / (Math.min(l1,l2) + .05);
      });
      expect(oran, `.ks-b-kaynak (${tema}): ${oran && oran.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
