'use strict';
/* G43 — KEŞFET B aşaması (v51): kütüphanede OLMAYAN kitaplar (yazar + seri).
   - TEMBEL: Keşfet açılışı sorgu ATMAZ; "Yeni kitapları getir" ile atar.
   - Kaynak: window.__ara (canliAra ile AYNI yol); sinyaller __oneri.sevilenYazarlar
     (ort≥8) + __oneri.eksikSeriler (bitmiş cilt şartlı).
   - Eleme: kütüphanede olan (ad+yazar TR-katlamalı, ISBN) + kesfetGizli.
   - Gizleme kalıcı: veri.kesfetGizli — depoYukle taşır, senkron union'lar,
     damga basmaz. Önbellek 24s + imza; sayaçla kanıtlanır.
   (Mutasyon 1: kütüphanede-var elemesi kaldırılır → eleme vakası kırmızı.
    Mutasyon 2: depoYukle kesfetGizli taşımayı bırakır → kalıcılık vakası kırmızı.) */
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc } = require('./yardim');

function bitmis(ek) {
  return sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30) }, ek));
}
function okunacak(ek) {
  return sahteKitap(Object.assign({ durum: 'okunacak', sahiplik: 'sahip' }, ek));
}
function taban() {   // puanlar < 8: sevilen yazar üretmez
  return [
    bitmis({ ad: 'Taban 1', yazar: 'Taban Yazar 1', tur: 'Deneme', puan: 6 }),
    bitmis({ ad: 'Taban 2', yazar: 'Taban Yazar 2', tur: 'Anı', puan: 5 }),
    bitmis({ ad: 'Taban 3', yazar: 'Taban Yazar 3', tur: 'Gezi', puan: 6 })
  ];
}
function sevilenYazarVeri() {   // Usta: (9+10)/2 = 9,5
  return [...taban(),
    bitmis({ ad: 'Sevilen 1', yazar: 'Usta', puan: 9 }),
    bitmis({ ad: 'Sevilen 2', yazar: 'Usta', puan: 10 })];
}
function gItem(ad, yazar, ek) {
  return { volumeInfo: Object.assign({ title: ad, authors: [yazar], publisher: 'Yayınevi A',
    publishedDate: '2021', pageCount: 320, language: 'tr' }, ek || {}) };
}
async function kesfetAc(page) {
  await page.goto('/');
  await page.click('nav [data-act="sekme"][data-v="kesfet"]');
  await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
}
async function bKicker(page) {
  return page.locator('#ksB .kicker').evaluate(el => el.textContent);
}

test.describe('G43 Keşfet B — yeni kitaplar', () => {

  test('TEMBEL yükleme: açılış sorgu atmaz; "getir" deyince atar', async ({ page }) => {
    await tohumla(page, [...sevilenYazarVeri()]);
    await kesfetAc(page);
    expect(await bKicker(page)).toBe('Yeni kitaplar');
    await expect(page.locator('#ksB [data-act="ks-b-getir"]')).toBeVisible();
    expect(page.__agSayac.google, 'açılışta sorgu YOK').toBe(0);
    page.__agAyar.google = { items: [gItem('Yepyeni Kitap', 'Usta')] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item')).toContainText('Yepyeni Kitap');
    expect(page.__agSayac.google, 'getir sorgu attı').toBeGreaterThan(0);
  });

  test('eksik seri cildi listede, gerekçesi seriyi ve bitirilen ciltleri anar', async ({ page }) => {
    await tohumla(page, [...taban(),
      bitmis({ ad: 'Vakıf', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 1, puan: 7 }),
      bitmis({ ad: 'Vakıf ve İmparatorluk', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 2, puan: 7 }),
      okunacak({ ad: 'Vakıfın Sınırı', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 4 })]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [gItem('İkinci Vakıf', 'Isaac Asimov')] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    const satir = page.locator('#ksB .ks-b-item', { hasText: 'İkinci Vakıf' });
    await expect(satir).toBeVisible();
    await expect(satir.locator('.ks-b-neden'))
      .toContainText('Vakıf serisinin 3. cildi eksik — 1 ve 2. cildi bitirdin');
    expect(page.__agSayac.sonGoogleUrl, 'seri sorgusu yazarla daraltıldı').toContain('inauthor');
  });

  test('sevilen yazarın eksik kitabı listede, gerekçesi yazarı ve ortalamayı anar', async ({ page }) => {
    await tohumla(page, [...sevilenYazarVeri()]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [gItem('Ustanın Yeni Romanı', 'Usta')] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    const satir = page.locator('#ksB .ks-b-item', { hasText: 'Ustanın Yeni Romanı' });
    // bağımsız hesap: (9+10)/2 = 9,5 — cümledeki sayı uydurma değil
    await expect(satir.locator('.ks-b-neden'))
      .toContainText('Usta: bitirdiğin 2 kitaba ortalama 9,5 verdin');
    expect(page.__agSayac.sonGoogleUrl).toContain('inauthor');
  });

  test('kütüphanede ZATEN OLAN kitap önerilmez (ad+yazar TR-katlamalı)', async ({ page }) => {
    await tohumla(page, [...sevilenYazarVeri(),
      okunacak({ ad: 'Mevcut Kitap', yazar: 'Usta' })]);
    await kesfetAc(page);
    // kaynak BÜYÜK harfle döndürse de TR-katlama eşleştirir
    page.__agAyar.google = { items: [
      gItem('MEVCUT KİTAP', 'USTA'),
      gItem('Gerçekten Yeni', 'Usta')] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);
    await expect(page.locator('#ksB .ks-b-item')).toContainText('Gerçekten Yeni');
  });

  test('kütüphanede ZATEN OLAN kitap önerilmez (ISBN ile — ad farklı olsa bile)', async ({ page }) => {
    await tohumla(page, [...sevilenYazarVeri(),
      okunacak({ ad: 'Yerli Basım Adı', yazar: 'Usta', isbn: '978-1-234-56789-7' })]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Farklı Basım Adı', 'Usta',
        { industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781234567897' }] }),
      gItem('Temiz Yeni', 'Usta')] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);
    await expect(page.locator('#ksB .ks-b-item')).toContainText('Temiz Yeni');
  });

  test('"İstek listeme ekle": sahiplik=istek kaydeder, künye dolar, liste yenilenir', async ({ page }) => {
    await tohumla(page, [...sevilenYazarVeri()]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [gItem('Eklenecek Kitap', 'Usta',
      { industryIdentifiers: [{ type: 'ISBN_13', identifier: '9789750736742' }] })] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    await page.click('#ksB [data-act="ks-b-ekle"]');
    await expect(page.locator('#toast')).toContainText('İstek listene eklendi');
    const k = await page.evaluate(() => veri.kitaplar.find(x => x.ad === 'Eklenecek Kitap'));
    expect(k.sahiplik).toBe('istek');
    expect(k.durum).toBe('okunacak');
    expect(k.yazar).toBe('Usta');
    expect(k.sayfa).toBe(320);
    expect(k.yil).toBe(2021);
    expect(k.isbn).toBe('9789750736742');
    // artık kütüphanede → önerilmez
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(0);
  });

  test('"İlgilenmiyorum" KALICI: yeniden yüklemede gizli, senkronda union, damga basmaz', async ({ page }) => {
    await tohumla(page, [...sevilenYazarVeri()]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [gItem('İstenmeyen Kitap', 'Usta')] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    const onceDamgalar = await page.evaluate(() => veri.kitaplar.map(k => k.g));
    await page.click('#ksB [data-act="ks-b-gizle"]');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(0);
    const d = await page.evaluate(() => ({
      anahtarlar: Object.keys(veri.kesfetGizli || {}),
      damgalar: veri.kitaplar.map(k => k.g) }));
    expect(d.anahtarlar.length).toBe(1);
    expect(d.damgalar, 'gizleme kitap damgası BASMAZ').toEqual(onceDamgalar);
    // yeniden yükleme: kesfetGizli depoYukle'den döner, önbellek adayı yine elenir
    await page.reload();
    await page.click('nav [data-act="sekme"][data-v="kesfet"]');
    await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
    expect(await page.evaluate(() => Object.keys(veri.kesfetGizli || {}).length)).toBe(1);
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(0);
    // senkron birleşimi UNION: iki cihazın gizlemeleri birleşir, silinmez
    const bir = await page.evaluate(() => window.__senkron.birlestir(
      { kitaplar: [], kesfetGizli: { 'a|x': 5 } },
      { kitaplar: [], kesfetGizli: { 'b|y': 7 } }));
    expect(bir.kesfetGizli).toEqual({ 'a|x': 5, 'b|y': 7 });
  });

  test('aynı kitabın iki EDİSYONU tek satır; gizleme edisyondan bağımsız tutar (K1/K2 kilidi)', async ({ page }) => {
    await tohumla(page, [...sevilenYazarVeri()]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Çift Basımlı', 'Usta',
        { industryIdentifiers: [{ type: 'ISBN_13', identifier: '9781111111113' }] }),
      gItem('Çift Basımlı', 'Usta',
        { industryIdentifiers: [{ type: 'ISBN_13', identifier: '9782222222227' }] })] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);   // ad|yazar dedup
    await page.click('#ksB [data-act="ks-b-gizle"]');
    // anahtar ad|yazar: İKİ edisyon da gizli kalır — ISBN değişimi gizlemeyi delmez
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(0);
  });

  test('ağ hatasında dürüst mesaj; "Rafından" bölümü ETKİLENMEZ', async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', e => hatalar.push(String(e)));
    await tohumla(page, [...sevilenYazarVeri(), okunacak({ ad: 'Rafta Duran', yazar: 'RD' })]);
    await kesfetAc(page);
    page.__agAyar.google = 'hata';
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-not')).toContainText('İnternete ulaşılamadı');
    await expect(page.locator('#ksB [data-act="ks-b-getir"]')).toBeVisible();   // yeniden dene
    await expect(page.locator('#ksIcerik .ks-item')).toContainText('Rafta Duran'); // A yaşıyor
    expect(hatalar, 'çökme yok').toEqual([]);
  });

  test('önbellek: ikinci açılışta yeni istek ATILMAZ, liste önbellekten gelir', async ({ page }) => {
    await tohumla(page, [...sevilenYazarVeri()]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [gItem('Önbelleklenen', 'Usta')] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item')).toContainText('Önbelleklenen');
    const sorguSayisi = page.__agSayac.google;
    expect(sorguSayisi).toBeGreaterThan(0);
    // sayfa yeniden yüklenir (sayaç Node tarafında YAŞAR) — liste önbellekten, sorgu yok
    await page.reload();
    await page.click('nav [data-act="sekme"][data-v="kesfet"]');
    await expect(page.locator('#ksB .ks-b-item')).toContainText('Önbelleklenen');
    expect(page.__agSayac.google, 'ikinci açılış sorgu atmadı').toBe(sorguSayisi);
  });

  test('yetersiz veri: sinyal yoksa dürüst mesaj, getir düğmesi YOK, sorgu 0', async ({ page }) => {
    await tohumla(page, [...taban()]);   // 8+ yazar yok, seri yok
    await kesfetAc(page);
    await expect(page.locator('#ksB .ks-b-not')).toContainText('önce sinyal gerek');
    await expect(page.locator('#ksB [data-act="ks-b-getir"]')).toHaveCount(0);
    expect(page.__agSayac.google).toBe(0);
    expect(await page.locator('#ksB').textContent()).not.toMatch(/\d,\d/);   // uydurma sayı yok
  });

  test('Ciltli: B bölümü dolu düğmesiz, yuvarlak kartsız, gölgesiz', async ({ page }) => {
    await tohumla(page, [...sevilenYazarVeri()]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [gItem('Ciltli Aday', 'Usta')] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);
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
    test(`B bölümü metin rolleri AA (${tema} tema)`, async ({ page }) => {
      await tohumla(page, [...sevilenYazarVeri()], { kk_tema_v1: tema });
      await kesfetAc(page);
      page.__agAyar.google = { items: [gItem('AA Aday', 'Usta')] };
      await page.click('#ksB [data-act="ks-b-getir"]');
      await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);
      const ciftler = ['#ksB .kicker', '#ksB .ks-b-ad', '#ksB .ks-b-yazar',
        '#ksB .ks-b-neden', '#ksB .ks-b-ekle', '#ksB .ks-b-gizle'];
      for (const sec of ciftler) {
        const o = await page.evaluate(s => {
          const el = document.querySelector(s);
          if(!el) return null;
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
        }, sec);
        expect(o, sec + ' ölçülemedi').not.toBeNull();
        expect(o, `${sec} (${tema}): ${o && o.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
