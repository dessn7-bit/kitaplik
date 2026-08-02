'use strict';
const fs = require('fs');
const { test, expect, tohumla, sahteKitap, kameraTaklit, bugunISO } = require('./yardim');

const YIL = new Date().getFullYear();
const ISBN = '9780132350884';

async function formAc(page) {
  await page.goto('/');
  await page.click('[data-act="yeni"]');
}
function gbIsbnYanit(k) {
  return { totalItems: 1, items: [{ volumeInfo: { title: k.ad, authors: [k.yazar || 'Y'],
    publisher: '', publishedDate: '', pageCount: k.sayfa || 0, imageLinks: null } }] };
}

/* --------- M1: çevirmen ve dil --------- */
test.describe('G15 M1 — çevirmen ve dil', () => {

  test('çevirmen ve dil kaydedilir, yenilemede KORUNUR', async ({ page }) => {
    await formAc(page);
    await page.fill('#f-ad', 'Suç ve Ceza');
    await page.fill('#f-yazar', 'Dostoyevski');
    await page.fill('#f-cevirmen', 'Nihal Yalaza Taluy');
    await page.fill('#f-dil', 'TR');
    await page.click('[data-act="form-kaydet"]');
    let k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.cevirmen).toBe('Nihal Yalaza Taluy');
    expect(k.dil).toBe('tr');                 // küçük harfe normalize
    await page.reload();
    k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.cevirmen).toBe('Nihal Yalaza Taluy');   // kitapNormalize elemedi
    expect(k.dil).toBe('tr');
  });

  test('çevirmene göre raf araması çalışır', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Çevirili Kitap', cevirmen: 'Ahmet Cemal' }),
      sahteKitap({ ad: 'Başka Kitap', cevirmen: '' })
    ]);
    await page.goto('/');
    await page.fill('#arama', 'Ahmet Cemal');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste .kart-baslik')).toHaveText('Çevirili Kitap');
  });

  test('Google Books dil bilgisi forma yazılır, çevirmen uydurulmaz', async ({ page }) => {
    await formAc(page);
    page.__agAyar.google = { totalItems: 1, items: [{ volumeInfo: {
      title: 'Foreign Book', authors: ['An Author'], publisher: 'Pub', publishedDate: '2010',
      pageCount: 250, language: 'en', imageLinks: null } }] };
    await page.fill('#f-ad', 'foreign book');
    await page.click('.ol-item >> nth=0');
    await expect(page.locator('#f-dil')).toHaveValue('en');
    await expect(page.locator('#f-cevirmen')).toHaveValue('');   // API'de yok → boş bırakıldı
  });

  test('CSV dışa aktarımda çevirmen ve dil sütunları çıkar', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'CSV Kitabı', cevirmen: 'Bir Çevirmen', dil: 'tr' })]);
    await page.goto('/');
    await page.click('[data-act="sekme"][data-v="yedek"]');
    const [indirme] = await Promise.all([
      page.waitForEvent('download'),
      page.click('[data-act="csv-aktar"]')
    ]);
    const icerik = fs.readFileSync(await indirme.path(), 'utf8');
    expect(icerik).toContain('Çevirmen');
    expect(icerik).toContain('Dil');
    expect(icerik).toContain('Bir Çevirmen');
  });
});

/* --------- M2: elle eklemede ISBN --------- */
test.describe('G15 M2 — elle ISBN', () => {

  test('elle girilen ISBN kaydedilir ve yenilemede KORUNUR', async ({ page }) => {
    await formAc(page);
    await page.fill('#f-ad', 'ISBN Kitabı');
    await page.fill('#f-isbn', '978-0-13-235088-4');
    await page.click('[data-act="form-kaydet"]');
    expect(await page.evaluate(() => veri.kitaplar[0].isbn)).toBe(ISBN);   // ayraçlar temizlendi
    await page.reload();
    expect(await page.evaluate(() => veri.kitaplar[0].isbn)).toBe(ISBN);
  });

  test('barkod okununca form ISBN alanı dolar', async ({ page }) => {
    await page.goto('/');
    page.__agAyar.google = gbIsbnYanit({ ad: 'Barkodlu Kitap', yazar: 'Y', sayfa: 200 });
    await page.click('[data-act="yeni"]');
    await page.click('[data-act="barkod-ac"]');
    await page.fill('#barkodElle', ISBN);
    await page.click('[data-act="barkod-elle"]');
    await expect(page.locator('#f-ad')).toHaveValue('Barkodlu Kitap');
    await expect(page.locator('#f-isbn')).toHaveValue(ISBN);
    await page.click('[data-act="form-kaydet"]');
    expect(await page.evaluate(() => veri.kitaplar[0].isbn)).toBe(ISBN);
  });

  test('aynı ISBN ikinci kez girilince uyarı çıkar ama kayıt ENGELLENMEZ', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'İlk Baskı', isbn: ISBN })]);
    await page.goto('/');
    await page.click('[data-act="yeni"]');
    await page.fill('#f-ad', 'İkinci Baskı');
    await page.fill('#f-isbn', ISBN);
    await page.click('[data-act="form-kaydet"]');
    await expect(page.locator('#toast')).toContainText('aynı ISBN ile zaten kayıtlı');
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(2);   // engellenmedi
  });
});

/* --------- M3: yeniden okuma --------- */
function bitmisKitap(ek) {
  return sahteKitap(Object.assign({ ad: 'Bitmiş Kitap', durum: 'bitti', sayfa: 300,
    guncelSayfa: 300, puan: 9, baslamaTarihi: `${YIL}-01-10`, bitisTarihi: `${YIL}-02-20` }, ek || {}));
}

test.describe('G15 M3 — yeniden okuma', () => {

  test('yeniden oku: eski okuma arşivlenir, veri kaybı YOK', async ({ page }) => {
    await tohumla(page, [bitmisKitap()]);
    await page.goto('/');
    await page.click('#liste .kart');
    await page.click('[data-act="yeniden-oku"]');
    await expect(page.locator('#toast')).toContainText('geçmişe kaydedildi');
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.okumalar.length).toBe(1);
    expect(k.okumalar[0]).toMatchObject({ bas: `${YIL}-01-10`, bit: `${YIL}-02-20`, puan: 9 });
    expect(k.durum).toBe('okunuyor');
    expect(k.guncelSayfa).toBe(0);
    expect(k.baslamaTarihi).toBe(bugunISO());
    expect(k.bitisTarihi).toBeNull();
    // istatistik: kitap "bitirilen" sayımından DÜŞMEZ (arşivdeki okuma temsil eder)
    const ist = await page.evaluate(() => {
      const r = veri.kitaplar.map(istKayit).filter(Boolean);
      return { adet: r.length, bitis: r[0] && r[0].bitisTarihi, puan: r[0] && r[0].puan };
    });
    expect(ist).toEqual({ adet: 1, bitis: `${YIL}-02-20`, puan: 9 });
  });

  test('okumalar dizisi yenilemede KORUNUR', async ({ page }) => {
    await tohumla(page, [bitmisKitap({ okumalar: [
      { bas: '2024-03-01', bit: '2024-04-01', puan: 7, not: '' }] })]);
    await page.goto('/');
    expect(await page.evaluate(() => veri.kitaplar[0].okumalar.length)).toBe(1);
    await page.reload();
    const o = await page.evaluate(() => veri.kitaplar[0].okumalar[0]);
    expect(o).toMatchObject({ bas: '2024-03-01', bit: '2024-04-01', puan: 7 });
  });

  test('okuma geçmişi detayda görünür', async ({ page }) => {
    await tohumla(page, [bitmisKitap({ okumalar: [
      { bas: '2024-03-01', bit: '2024-04-05', puan: 7, not: '' }] })]);
    await page.goto('/');
    await page.click('#liste .kart');
    await expect(page.locator('#detayIcerik')).toContainText('Okuma geçmişi');
    await expect(page.locator('.vm-okuma-satir').first()).toContainText('1. okuma');
    await expect(page.locator('.vm-okuma-satir').first()).toContainText('★ 7');
    await expect(page.locator('.vm-okuma-satir').nth(1)).toContainText('2. okuma');
  });

  test('eski kayıt (okumalar alanı yok) açılınca çökme olmaz', async ({ page }) => {
    const hatalar = [];
    await tohumla(page, [{ id: 'eski1', ad: 'Eski Kayıt', yazar: 'Y', durum: 'bitti',
      bitisTarihi: `${YIL}-05-05`, puan: 8, eklenme: 1 }]);
    page.on('pageerror', h => hatalar.push(String(h)));
    await page.goto('/');
    await page.click('#liste .kart');
    await expect(page.locator('#detayIcerik')).toContainText('Eski Kayıt');
    expect(await page.evaluate(() => veri.kitaplar[0].okumalar)).toEqual([]);
    await page.click('[data-act="yeniden-oku"]');
    expect(await page.evaluate(() => veri.kitaplar[0].okumalar.length)).toBe(1);
    expect(hatalar).toEqual([]);
  });
});

/* --------- M4: seri / dizi --------- */
function seriKitap(ad, ciltNo) {
  return sahteKitap({ ad, seri: 'Kayıp Zamanın İzinde', ciltNo });
}

test.describe('G15 M4 — seri ve cilt takibi', () => {

  test('seri ve cilt kaydedilir, yenilemede KORUNUR', async ({ page }) => {
    await formAc(page);
    await page.fill('#f-ad', 'Swann’ların Tarafı');
    await page.fill('#f-seri', 'Kayıp Zamanın İzinde');
    await page.fill('#f-cilt', '1');
    await page.click('[data-act="form-kaydet"]');
    await page.reload();
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.seri).toBe('Kayıp Zamanın İzinde');
    expect(k.ciltNo).toBe(1);
  });

  test('detayda aynı serinin kitapları listelenir ve gezinilebilir', async ({ page }) => {
    await tohumla(page, [seriKitap('Birinci Cilt', 1), seriKitap('İkinci Cilt', 2),
      sahteKitap({ ad: 'Alakasız Kitap' })]);
    await page.goto('/');
    await page.click('#liste .kart[data-id="' + await page.evaluate(() => veri.kitaplar[0].id) + '"]');
    await expect(page.locator('.vm-seri-liste .vm-seri-oge')).toHaveCount(2);
    await expect(page.locator('.vm-seri-oge.vm-bu')).toContainText('Birinci Cilt');
    await page.click('.vm-seri-oge:not(.vm-bu)');
    await expect(page.locator('#detayIcerik .sheet-baslik')).toContainText('İkinci Cilt');
  });

  test('eksik cilt doğru tespit edilir (1,2,4 → 3 eksik)', async ({ page }) => {
    await tohumla(page, [seriKitap('C1', 1), seriKitap('C2', 2), seriKitap('C4', 4)]);
    await page.goto('/');
    await page.click('#liste .kart >> nth=0');
    await expect(page.locator('.vm-eksik')).toContainText('Eksik cilt: 3');
  });

  test('tek ciltli seride eksik uyarısı ÇIKMAZ', async ({ page }) => {
    await tohumla(page, [seriKitap('Tek Cilt', 1)]);
    await page.goto('/');
    await page.click('#liste .kart');
    await expect(page.locator('.vm-seri-kutu')).toBeVisible();
    expect(await page.locator('.vm-eksik').count()).toBe(0);
  });

  test('"Bu seriyi rafta göster" listeyi seriye göre süzer', async ({ page }) => {
    const kitaplar = [seriKitap('C1', 1), seriKitap('C2', 2), sahteKitap({ ad: 'Alakasız' })];
    await tohumla(page, kitaplar);
    await page.goto('/');
    await page.click(`#liste .kart[data-id="${kitaplar[0].id}"]`);   // seri kartı olan kitabı aç
    await page.click('[data-act="vm-seri-filtre"]');
    await expect(page.locator('#liste .kart')).toHaveCount(2);
    await expect(page.locator('#arama')).toHaveValue('Kayıp Zamanın İzinde');
  });
});

/* --------- M5: istek listesi / sahiplik --------- */
test.describe('G15 M5 — sahiplik ve istek listesi', () => {

  test('sahiplik kaydedilir ve yenilemede KORUNUR', async ({ page }) => {
    await formAc(page);
    await page.fill('#f-ad', 'Alınacak Kitap');
    await page.selectOption('#f-sahiplik', 'istek');
    await page.click('[data-act="form-kaydet"]');
    expect(await page.evaluate(() => veri.kitaplar[0].sahiplik)).toBe('istek');
    await page.reload();
    expect(await page.evaluate(() => veri.kitaplar[0].sahiplik)).toBe('istek');
  });

  test('filtre doğru süzer, istek rozeti görünür', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Bendeki Kitap', sahiplik: 'sahip' }),
      sahteKitap({ ad: 'İstediğim Kitap', sahiplik: 'istek' })
    ]);
    await page.goto('/');
    await expect(page.locator('#liste .kart')).toHaveCount(2);   // varsayılan: ikisi de görünür
    await page.click('[data-act="vm-sahiplik"][data-v="istek"]');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste .kart-baslik')).toHaveText('İstediğim Kitap');
    await page.click('[data-act="vm-sahiplik"][data-v="sahip"]');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste .kart-baslik')).toHaveText('Bendeki Kitap');
    await page.click('[data-act="vm-sahiplik"][data-v="hepsi"]');
    await expect(page.locator('#liste .kart')).toHaveCount(2);
    // rozet detayda
    await page.click('#liste .kart[data-id="' + await page.evaluate(() =>
      veri.kitaplar.find(k => k.sahiplik === 'istek').id) + '"]');
    await expect(page.locator('.vm-rozet')).toContainText('İstek listesi');
  });

  test('seri taramadan gelen kitap "sahip" işaretlenir', async ({ page }) => {
    await kameraTaklit(page);
    await page.goto('/');
    page.__agAyar.google = gbIsbnYanit({ ad: 'Taranan Kitap', yazar: 'Y' });
    await page.click('[data-act="sekme"][data-v="yedek"]');
    await page.click('[data-act="seri-ac"]');
    await page.evaluate(kod => { window.__sahteKod = kod; }, ISBN);
    await expect(page.locator('#seriNot')).toContainText('Eklendi', { timeout: 10000 });
    await page.evaluate(() => { window.__sahteKod = null; });
    expect(await page.evaluate(() => veri.kitaplar[0].sahiplik)).toBe('sahip');
  });

  test('eski kayıtlar (alan yok) varsayılan "sahip" sayılır', async ({ page }) => {
    await tohumla(page, [{ id: 'eski', ad: 'Alansız Kayıt', yazar: 'Y', durum: 'okunacak', eklenme: 1 }]);
    await page.goto('/');
    expect(await page.evaluate(() => veri.kitaplar[0].sahiplik)).toBe('sahip');
    await page.click('[data-act="vm-sahiplik"][data-v="sahip"]');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
  });
});

/* --------- M6: hedefG damgalama --------- */
test.describe('G15 M6 — hedef damgası', () => {

  test('hedef değişince hedefG TAZELENİR', async ({ page }) => {
    await tohumla(page, { kitaplar: [sahteKitap({ ad: 'K' })],
      hedef: { [YIL]: 20 }, hedefG: { [YIL]: 1000 }, silinenler: {} });
    await page.goto('/');
    await page.click('[data-act="sekme"][data-v="ist"]');
    await page.fill('#hedefInput', '30');
    await page.click('[data-act="hedef-kaydet"]');
    const s = await page.evaluate(y => ({ h: veri.hedef[y], g: veri.hedefG[y] }), YIL);
    expect(s.h).toBe(30);
    expect(s.g).toBeGreaterThan(1000);   // damga tazelendi
  });

  test('hedef değişmeden kaydedilince hedefG SABİT kalır', async ({ page }) => {
    await tohumla(page, { kitaplar: [sahteKitap({ ad: 'K' })],
      hedef: { [YIL]: 20 }, hedefG: { [YIL]: 1000 }, silinenler: {} });
    await page.goto('/');
    await page.click('[data-act="sekme"][data-v="ist"]');
    await page.fill('#hedefInput', '20');           // aynı değer
    await page.click('[data-act="hedef-kaydet"]');
    expect(await page.evaluate(y => veri.hedefG[y], YIL)).toBe(1000);
  });

  test('senkron birleştirmede değiştirilmiş hedef eski uzak değeri yener', async ({ page }) => {
    await tohumla(page, { kitaplar: [sahteKitap({ ad: 'K' })],
      hedef: { [YIL]: 20 }, hedefG: { [YIL]: 1000 }, silinenler: {} });
    await page.goto('/');
    await page.click('[data-act="sekme"][data-v="ist"]');
    await page.fill('#hedefInput', '35');
    await page.click('[data-act="hedef-kaydet"]');
    const kazanan = await page.evaluate(y => window.__senkron.birlestir(veri,
      { kitaplar: [], silinenler: {}, hedef: { [y]: 20 }, hedefG: { [y]: 9000 } }).hedef[y], YIL);
    expect(kazanan).toBe(35);   // yerel damga Date.now() → uzak 9000'i yener
  });
});
