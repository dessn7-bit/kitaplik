'use strict';
/* G54 — (D1) Keşfet YALNIZ TÜRKÇE önerir + (D2) yeni kitaba OTOMATİK TÜR (v65).

   D1 SÖZLEŞMELERİ:
   - Keşfet-B Google sorguları langRestrict=tr taşır (ucuz ön eleme) AMA tek
     savunma DEĞİL (canlı ölçüm 2026-08-13: Carl Sagan langRestrict=tr'ye
     rağmen 6/6 İngilizce döndü) — dönen adayın volumeInfo.language alanı
     kesfet.js bDilUygun ile ayrıca denetlenir.
   - dil ≠ 'tr' olan aday ELENİR; dil alanı OLMAYAN aday da ELENİR (ölçülen
     karar: 114 canlı adayın 0'ı dilsizdi — kayıp riski ~0, dili bilinmeyeni
     geçirmek uydurma olur).
   - Eleme sonrası kaynak boşsa ATLANIR: doldurma satırı yok, dürüst mesaj var.
   - 1000Kitap tür adayları MUAF (kaynak zaten Türkçe, dil alanı taşımaz).
   - Süzgeç hem sorguda hem ÇİZİMDE (bElenmis) yaşar: 24 saatlik bayat
     önbellekte kalmış yabancı adaylar da düşer.
   - Canlı arama (kendi kitabını arama) langRestrict TAŞIMAZ: raftaki yabancı
     kitap da aranabilmeli.

   D2 SÖZLEŞMELERİ:
   - Yeni kitapta tür boşsa zengin.js otoTur motoru doldurur (turCevir +
     canlı taksonomi — İKİ KAPI, uydurma tür imkânsız). Akışlar: canlı arama
     seçimi, barkod/ISBN, seri tarama, elle kayıt, Keşfet istek-ekle.
   - Ekleme akışının kendi yanıtındaki categories eşlenirse EK İSTEK YOK;
     yoksa kitap başına EN FAZLA 1 Google isteği.
   - Kayıt tür sorgusunu BEKLEMEZ; tür gelince alan + k.g damgası güncellenir.
   - Bulunamazsa boş kalır; elle girilen tür HİÇBİR yolda ezilmez.
   - Kuyruk: iki Google isteği arasında en az ARALIK_MS (650) — seri taramada
     kota patlamaz.

   (Mutasyon 1: kesfet.js bDilUygun gövdesi `return true` yapılır → İngilizce,
    dilsiz ve bayat-önbellek vakaları kırmızı.
    Mutasyon 2: index.html formKaydet'teki otoTur çağrısı kaldırılır →
    kategoriden-tür, tek-istek ve gecikmesiz-kayıt vakaları kırmızı.) */
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc, ayarlarAc,
  ayrintilarAc, kameraYok } = require('./yardim');

function bitmis(ek) {
  return sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30) }, ek));
}
function taban() {   // puanlar < 8: sevilen yazar üretmez (g43 deseni)
  return [
    bitmis({ ad: 'Taban 1', yazar: 'Taban Yazar 1', tur: 'Deneme', puan: 6 }),
    bitmis({ ad: 'Taban 2', yazar: 'Taban Yazar 2', tur: 'Anı', puan: 5 }),
    bitmis({ ad: 'Taban 3', yazar: 'Taban Yazar 3', tur: 'Gezi', puan: 6 })
  ];
}
function sevilenYazarVeri() {   // Usta: (9+10)/2 = 9,5 → sevilen yazar
  return [...taban(),
    bitmis({ ad: 'Sevilen 1', yazar: 'Usta', puan: 9 }),
    bitmis({ ad: 'Sevilen 2', yazar: 'Usta', puan: 10 })];
}
/* dil parametresi AÇIK: bu grubun konusu tam da dil alanı. null → alan HİÇ yok. */
function gItem(ad, yazar, dil, ek) {
  const v = Object.assign({ title: ad, authors: [yazar] }, ek || {});
  if (dil !== null) v.language = dil;
  return { volumeInfo: v };
}
const TURLER = [
  { seo: 'Roman', ad: 'Roman', kitapSayisi: 25393 },
  { seo: 'Siir', ad: 'Şiir', kitapSayisi: 5000 },
  { seo: 'Felsefe-Dusunce', ad: 'Felsefe-Düşünce', kitapSayisi: 4114 }
];
async function kesfetAc(page) {
  await page.goto('/');
  await page.click('nav [data-act="sekme"][data-v="kesfet"]');
  await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
}
async function formAc(page) {
  await rafAc(page);
  await page.click('.fab[data-act="yeni"]');
}

test.describe('G54 D1 — Keşfet yalnız Türkçe', () => {

  test('İngilizce aday ELENİR, Türkçe KALIR; sorgu langRestrict=tr taşır', async ({ page }) => {
    await tohumla(page, [...sevilenYazarVeri()]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Pale Blue Dot Baskısı', 'Usta', 'en'),
      gItem('Ustanın Türkçe Romanı', 'Usta', 'tr')] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);
    await expect(page.locator('#ksB .ks-b-item')).toContainText('Ustanın Türkçe Romanı');
    await expect(page.locator('#ksB')).not.toContainText('Pale Blue Dot');
    expect(page.__agSayac.sonGoogleUrl, 'Keşfet sorgusu langRestrict taşır')
      .toContain('langRestrict=tr');
  });

  test('dil alanı OLMAYAN aday ELENİR (ölçülen karar: dilsiz oranı %0)', async ({ page }) => {
    await tohumla(page, [...sevilenYazarVeri()]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Dili Bilinmeyen', 'Usta', null),
      gItem('Dili Belli', 'Usta', 'tr')] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);
    await expect(page.locator('#ksB .ks-b-item')).toContainText('Dili Belli');
  });

  test('eleme sonrası kaynak BOŞ kalırsa atlanır: uydurma satır yok, dürüst mesaj', async ({ page }) => {
    await tohumla(page, [...sevilenYazarVeri()]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('English Only One', 'Usta', 'en'),
      gItem('English Only Two', 'Usta', 'en')] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-not')).toContainText('bulunamadı');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(0);
    // boşluk ağ arızasından değil ELEMEDEN geldi: sorgu gerçekten atıldı
    expect(page.__agSayac.google, 'sorgu atıldı, sonuç elendi').toBeGreaterThan(0);
  });

  test('1000Kitap tür adayları dil alanı taşımadan GÖRÜNÜR (muafiyet)', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'F1', yazar: 'a', tur: 'Felsefe', puan: 9 }),
      bitmis({ ad: 'F2', yazar: 'b', tur: 'Felsefe', puan: 8 })]);
    await kesfetAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.tur = { 'Felsefe-Dusunce': { tur: { seo: 'Felsefe-Dusunce', ad: 'Felsefe-Düşünce' },
      hasMore: false, sonuclar: [{ ad: 'Ermiş', yazar: 'Halil Cibran', puan: 7.5, okuyan: 86117, kapak: null }] } };
    await page.click('#ksB [data-act="ks-b-getir"]');
    const satir = page.locator('#ksB .ks-b-item', { hasText: 'Ermiş' });
    await expect(satir).toBeVisible();
    await expect(satir.locator('.ks-b-kaynak')).toHaveText('Tür');
  });

  test('BAYAT önbellekteki yabancı aday çizimde düşer (24s penceresi sızdırmaz)', async ({ page }) => {
    // ANAHTAR v77'de v1 -> v2 (kesfet.js: adaylara tür mührü eklendi). Vakanın
    // niyeti değişmedi: BAYAT önbellekten gelen yabancı aday çizimde düşer.
    await tohumla(page, [...sevilenYazarVeri()], {
      kk_kesfet_b_v2: { imza: '[["usta"],[],[]]', t: Date.now(), adaylar: [
        { ad: 'Yabancı Bayat', yazar: 'Usta', dil: 'EN', kaynakTip: 'yazar', neden: 'x', kapak: null },
        { ad: 'Türkçe Bayat', yazar: 'Usta', dil: 'TR', kaynakTip: 'yazar', neden: 'x', kapak: null }] } });
    await kesfetAc(page);
    // liste önbellekten geldi (sorgu yok) ama yabancı aday yine de elenmiş
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);
    await expect(page.locator('#ksB .ks-b-item')).toContainText('Türkçe Bayat');
    await expect(page.locator('#ksB')).not.toContainText('Yabancı Bayat');
    expect(page.__agSayac.google, 'önbellek isabeti — sorgu atılmadı').toBe(0);
  });
});

test.describe('G54 D2 — yeni kitaba otomatik tür', () => {

  test('canlı aramadan eklenen kitapta tür KATEGORİDEN dolar: ek Google isteği YOK, damga basılır', async ({ page }) => {
    await formAc(page);
    page.__agAyar.google = { items: [gItem('Suç ve Ceza', 'Dostoyevski', 'tr',
      { categories: ['Fiction'], pageCount: 500 })] };
    page.__agAyar.turler = TURLER;
    await page.fill('#f-ad', 'suç ve ceza');
    await page.click('#olSonuc .ol-item >> nth=0');
    // D1 sınırı: KENDİ kitabını arama dil kısıtı TAŞIMAZ (rafta yabancı kitap olabilir)
    expect(page.__agSayac.sonGoogleUrl, 'canlı arama langRestrict taşımaz')
      .not.toContain('langRestrict');
    const aramaSorgusu = page.__agSayac.google;
    await page.click('[data-act="form-kaydet"]');
    await expect(page.locator('#toast')).toContainText('Kitap rafa eklendi');
    await expect.poll(() => page.evaluate(() =>
      (veri.kitaplar.find(x => x.ad === 'Suç ve Ceza') || {}).tur)).toBe('Roman');
    const k = await page.evaluate(() => veri.kitaplar.find(x => x.ad === 'Suç ve Ceza'));
    expect(k.g, 'tür yazımı damga basar (senkron taşır)').toBeGreaterThan(0);
    expect(page.__agSayac.google, 'kategoriler bedava — EK Google isteği yok').toBe(aramaSorgusu);
    expect(page.__agSayac.turler, 'taksonomi bir kez soruldu').toBe(1);
  });

  test('kategorisiz kitapta EN FAZLA 1 ek istek; tür DÜRÜSTÇE boş kalır, çökme yok', async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', e => hatalar.push(String(e)));
    await formAc(page);
    page.__agAyar.google = { items: [gItem('Kategorisiz Kitap', 'Y', 'tr')] };
    page.__agAyar.turler = TURLER;
    await page.fill('#f-ad', 'kategorisiz kitap');
    await page.click('#olSonuc .ol-item >> nth=0');
    const aramaSorgusu = page.__agSayac.google;
    await page.click('[data-act="form-kaydet"]');
    await expect(page.locator('#toast')).toContainText('Kitap rafa eklendi');
    // tek ek istek atılır (kategori yok → motor kendi sorgusunu dener)...
    await expect.poll(() => page.__agSayac.google).toBe(aramaSorgusu + 1);
    await page.waitForTimeout(400);
    // ...ve İKİNCİSİ atılmaz (gevşek 2. sorgu bilerek yok — bütçe kitap başına ≤1)
    expect(page.__agSayac.google, 'kitap başına en fazla 1 ek istek').toBe(aramaSorgusu + 1);
    expect(await page.evaluate(() =>
      (veri.kitaplar.find(x => x.ad === 'Kategorisiz Kitap') || {}).tur)).toBe('');
    expect(hatalar, 'çökme yok').toEqual([]);
  });

  test('kayıt tür sorgusunu BEKLEMEZ; tür sonradan gelir, alan + damga güncellenir', async ({ page }) => {
    await formAc(page);
    // taksonomi yanıtı 1200ms geciktirilir: kayıt anında tür isteği hâlâ yolda
    // (predicate eşleştirici — glob'un host tuzağı g20 dersi)
    await page.route(u => u.href.includes('/turler'), async route => {
      await new Promise(coz => setTimeout(coz, 1200));
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ turler: TURLER }) });
    });
    page.__agAyar.google = { items: [gItem('Şiir Kitabı', 'Ş', 'tr', { categories: ['Poetry'] })] };
    await page.fill('#f-ad', 'şiir kitabı');
    await page.click('#olSonuc .ol-item >> nth=0');
    await page.click('[data-act="form-kaydet"]');
    // tür isteği 1,2 sn yolda — kitap ŞİMDİDEN kayıtlı: kayıt beklemedi
    const aninda = await page.evaluate(() => {
      const k = veri.kitaplar.find(x => x.ad === 'Şiir Kitabı');
      return k ? { var: true, tur: k.tur, g: k.g } : { var: false };
    });
    expect(aninda.var, 'kitap tür beklenmeden kaydedildi').toBe(true);
    expect(aninda.tur, 'tür henüz yolda').toBe('');
    await expect.poll(() => page.evaluate(() =>
      (veri.kitaplar.find(x => x.ad === 'Şiir Kitabı') || {}).tur),
      { timeout: 8000 }).toBe('Şiir');
    const sonra = await page.evaluate(() =>
      veri.kitaplar.find(x => x.ad === 'Şiir Kitabı').g);
    expect(sonra, 'tür gelince damga tazelendi').toBeGreaterThan(aninda.g);
  });

  test('elle girilen tür EZİLMEZ: dolu türle kayıtta motor hiç çalışmaz', async ({ page }) => {
    await formAc(page);
    await page.fill('#f-ad', 'Elle Girilen Kitap');
    await ayrintilarAc(page);
    await page.fill('#f-tur', 'Anı');
    await page.click('[data-act="form-kaydet"]');
    await expect(page.locator('#toast')).toContainText('Kitap rafa eklendi');
    await page.waitForTimeout(600);
    expect(await page.evaluate(() =>
      veri.kitaplar.find(x => x.ad === 'Elle Girilen Kitap').tur)).toBe('Anı');
    expect(page.__agSayac.turler, 'tür dolu — motor hiç koşmadı').toBe(0);
  });

  test('YARIŞ: arka plan yanıtı dönmeden elle doldurulan tür EZİLMEZ', async ({ page }) => {
    await formAc(page);
    // motorun intitle sorgusu 1000ms geciktirilir; bu arada kullanıcı türü doldurur
    await page.route(u => u.href.includes('googleapis.com/books'), async route => {
      const url = route.request().url();
      if (url.includes('intitle')) {
        await new Promise(coz => setTimeout(coz, 1500));
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ totalItems: 1,
            items: [gItem('Yarış Kitabı', 'Y', 'tr', { categories: ['Fiction'] })] }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ totalItems: 0, items: [] }) });
    });
    page.__agAyar.turler = TURLER;
    await page.fill('#f-ad', 'Yarış Kitabı');
    await page.click('[data-act="form-kaydet"]');   // tür boş → motor kuyruğa girdi
    await expect(page.locator('#toast')).toContainText('Kitap rafa eklendi');
    // yanıt yoldayken kullanıcı türü elle doldurdu (detay/düzenleme yolunun durum eşdeğeri)
    await page.evaluate(() => {
      const k = veri.kitaplar.find(x => x.ad === 'Yarış Kitabı');
      k.tur = 'Elle Seçim'; k.g = Date.now(); depoKaydet();
    });
    await page.waitForTimeout(2100);   // motorun yanıtı geldi ve yazMAmalıydı
    expect(await page.evaluate(() =>
      veri.kitaplar.find(x => x.ad === 'Yarış Kitabı').tur),
      'arka plan elle girilen türü ezmedi').toBe('Elle Seçim');
  });

  test('seri taramada kuyruk: iki Google isteği arası en az ~ARALIK_MS (kota nezaketi)', async ({ page }) => {
    const ISBN_A = '9780132350884', ISBN_B = '9789750736742';
    const zamanlar = [];
    await kameraYok(page);   // elle ISBN yolu — kamera gerekmez
    await rafAc(page);
    await page.route(u => u.href.includes('googleapis.com/books'), async route => {
      const url = route.request().url();
      let govde = { totalItems: 0, items: [] };
      if (url.includes('isbn')) {
        const ad = url.includes(ISBN_A) ? 'Seri Bir' : 'Seri İki';
        govde = { totalItems: 1, items: [gItem(ad, 'Seri Yazar', 'tr')] };   // kategorisiz → motor sorgusu şart
      } else if (url.includes('intitle')) {
        zamanlar.push(Date.now());
      }
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(govde) });
    });
    await ayarlarAc(page);
    await page.click('#ortuAyar [data-act="seri-ac"]');
    await expect(page.locator('#seriOrtu')).toHaveClass(/acik/);
    await page.fill('#seriElle', ISBN_A);
    await page.click('[data-act="seri-elle"]');
    await expect(page.locator('#seriNot')).toContainText('Eklendi: Seri Bir');
    await page.fill('#seriElle', ISBN_B);
    await page.click('[data-act="seri-elle"]');
    await expect(page.locator('#seriNot')).toContainText('Eklendi: Seri İki');
    // kayıtlar ANINDA düştü (yukarıdaki iki iddia); tür sorguları arkadan ARALIKLI gelir
    await expect.poll(() => zamanlar.length, { timeout: 8000 }).toBe(2);
    expect(zamanlar[1] - zamanlar[0],
      'iki motor isteği arası en az ~650ms').toBeGreaterThanOrEqual(600);
  });
});
