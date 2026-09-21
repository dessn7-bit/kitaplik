'use strict';
/* G121 (v130) — 1000KİTAP TÜR LİSTESİ + ÖNİZLEMEDE SEÇİM
 *
 * NEDEN BU GRUP VAR (21 Eylül, türü boş 45 GERÇEK kayıt üzerinde ölçüldü):
 *  M1) Google bu 45'in yalnız 1'ine tür veriyor: 27'sinde baskı bulunuyor ama
 *      `categories` yok, 9'unda kayıt bile yok, 7'sinde kategori taksonomiye
 *      girmiyor. 1000Kitap 45'in 45'ine tür veriyor (kitapCek → kidDizi) ve
 *      verdiği adlar KENDİ taksonomisinden — /turler'in 78'lik listesi.
 *      Eşleme sözlüğü gerekmiyor, eşlenemeyen tür sayısı 0.
 *  M2) Gelen şey TEK DEĞER DEĞİL LİSTE (ortalama 2,7 tür). Listeden tek tür
 *      seçen EN İYİ kural Kaan'ın kendi 254 kararıyla yalnız %43 örtüştü;
 *      doğru tür listenin içinde %73. Astronomi sistematik: Kaan ayrı tür
 *      sayıyor, 1000Kitap 4 vakanın 4'ünde Bilim-Teknoloji-Mühendislik diyor.
 *      KARAR: otomatik yazım YOK — önizlemede çip, seçim kullanıcının.
 *  M3) Kimlik kapısı İKİ YOLLU. ISBN birebir eşleşiyorsa kimlik kanıtlıdır:
 *      Karl/Carl Kerenyi, "Troilos"/"Troilus", "Ploutos Servet"/"Ploutos
 *      (Servet)" üç GERÇEK kayıt ad kapısından düşüyor ama doğru kitaplar.
 *      ISBN yoksa v118 kapısı (baslikUyar + yazarUyar) ZORUNLU — "Atış"
 *      (Puşkin) → "Atıştırmalıklar Kitabı" vakasının tür karşılığı.
 *  M4) /turler düşünce toplu tarama tür adımını SESSİZCE atlıyordu
 *      (zengin.js:2429 taksonomi=null, tarama devam). Ölçüm sırasında canlı
 *      görüldü: 1000Kitap worker'ı 403'ledi, /turler kaynak-403 döndü.
 *      Artık atlama SAYILIR ve ekranda YAZAR.
 *  M5) Google sözlüğüne 3 ölçülmüş eşleme (Turks/Acting/Cressida); ölçümün
 *      ÇÜRÜTTÜĞÜ ikisi (Human beings, Physicists) ve Kaan'ın yanlış dediği
 *      ikisi (Antiques, Knights) BİLEREK yok — burada kilitleniyor.
 */
const { test, expect, tohumla, sahteKitap, rafAc, ayarlarAc } = require('./yardim');

const TURLER = [
  { seo: 'Tiyatro', ad: 'Tiyatro', kitapSayisi: 10 },
  { seo: 'Tarih', ad: 'Tarih', kitapSayisi: 10 },
  { seo: 'Roman', ad: 'Roman', kitapSayisi: 10 },
  { seo: 'Bilim-Teknoloji-Muhendislik', ad: 'Bilim-Teknoloji-Mühendislik', kitapSayisi: 10 },
  { seo: 'Biyografi', ad: 'Biyografi', kitapSayisi: 10 },
  { seo: 'Antropoloji-Etnoloji', ad: 'Antropoloji-Etnoloji', kitapSayisi: 10 }
];
/* worker /isbn yanıtı — v130'da `turler` alanı taşıyor */
const isbnYanit = (o) => ({ sonuclar: [Object.assign({
  ad: 'Kitap', yazar: 'Yazar', yayinevi: 'Yayın', yil: 2000, sayfa: 100,
  kapak: null, isbn: '9786051066752', kaynak: '1000Kitap', cevirmen: '', dil: 'tr',
  turler: [] }, o)] });

/* Tarama önizlemesine kadar götüren tek yol (gerçek UI) */
async function tara(page) {
  await page.click('#ortuAyar [data-act="zg-tara"]');
  await expect(page.locator('#zgTaramaGovde')).toContainText('kitap tarandı', { timeout: 30000 });
}
const turu = (page, ad) => page.evaluate(a =>
  veri.kitaplar.find(k => k.ad === a).tur, ad);

test.describe('G121 tür listesi + seçim (v130)', () => {

  /* ---------- M1/M3: KAYNAK ve KİMLİK KAPILARI ---------- */

  test('A) ISBN yolu: 1000Kitap türleri LİSTE olarak gelir, tur alanı YAZILMAZ', async ({ page }) => {
    await rafAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.isbn = isbnYanit({ turler: ['Bilim-Teknoloji-Mühendislik', 'Biyografi'] });
    const s = await page.evaluate(k => window.__zengin.kitapSorgula(k),
      { id: 'a', ad: 'Eminim Şaka Yapıyorsunuz Bay Feynman', yazar: 'Richard Phillips Feynman',
        tur: '', isbn: '9786051066752', sayfa: 350, yayinevi: 'Alfa', yil: 2013, kapak: 'x' });
    expect(s.b.__turListe).toEqual(['Bilim-Teknoloji-Mühendislik', 'Biyografi']);
    expect(s.b.tur).toBeUndefined();          // tek değer YAZILMAZ — seçim bekliyor
    expect(s.b.__turKapi).toBe('isbn');
  });

  test('B) ISBN KİMLİĞİ ad kapısını GEREKTİRMEZ (Karl/Carl Kerenyi vakası)', async ({ page }) => {
    await rafAc(page);
    page.__agAyar.turler = TURLER;
    /* Kaynak "Yunan Mitolojisi / Carl Kerenyi", kayıt "… 2 Cilt Bir Arada /
       Karl Kerenyi": v118 ad+yazar kapısı bunu ELER, ISBN birebir tutuyor. */
    page.__agAyar.isbn = isbnYanit({ ad: 'Yunan Mitolojisi', yazar: 'Carl Kerenyi',
      turler: ['Diğer İnançlar', 'Mitolojiler'] });
    const s = await page.evaluate(k => window.__zengin.kitapSorgula(k),
      { id: 'b', ad: 'Yunan Mitolojisi 2 Cilt Bir Arada', yazar: 'Karl Kerenyi',
        tur: '', isbn: '9786050206272', sayfa: 400, yayinevi: 'Say', yil: 2018, kapak: 'x' });
    expect(s.b.__turListe).toEqual(['Diğer İnançlar', 'Mitolojiler']);
    expect(page.__agSayac.kitapTur).toBe(0);  // ISBN tuttu, ad yoluna DÜŞÜLMEDİ
  });

  test('C) ISBN yoksa /kitap-tur kullanılır ve v118 kapısı GEÇERSE liste gelir', async ({ page }) => {
    await rafAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.kitapTur = { turler: ['Araştırma-İnceleme', 'Sağlık-Tıp'],
      eslesen: { ad: 'Kokuların Gücü Adına', yazar: 'Hülya Kayhan' } };
    const s = await page.evaluate(k => window.__zengin.kitapSorgula(k),
      { id: 'c', ad: 'Kokuların Gücü Adına', yazar: 'Hülya Kayhan',
        tur: '', isbn: '', sayfa: 200, yayinevi: 'Y', yil: 2020, kapak: 'x' });
    expect(s.b.__turListe).toEqual(['Araştırma-İnceleme', 'Sağlık-Tıp']);
    expect(s.b.__turKapi).toBe('ad+yazar');
    expect(page.__agSayac.kitapTur).toBe(1);
  });

  test('D) v118 KAPISI: yazarı tutmayan eşleşmenin türü ALINMAZ', async ({ page }) => {
    await rafAc(page);
    page.__agAyar.turler = TURLER;
    /* "Atış" (Puşkin) → "Atıştırmalıklar Kitabı" (Ebru Ömürcalı) — v118'in
       kapak vakasının tür karşılığı. Kaynak tür döndürüyor, kapı eliyor. */
    page.__agAyar.kitapTur = { turler: ['Yemek'],
      eslesen: { ad: 'Atıştırmalıklar Kitabı', yazar: 'Ebru Ömürcalı' } };
    const s = await page.evaluate(k => window.__zengin.kitapSorgula(k),
      { id: 'd', ad: 'Atış', yazar: 'Puşkin', tur: '', isbn: '',
        sayfa: 50, yayinevi: 'Y', yil: 2000, kapak: 'x' });
    expect(s.b === null || s.b.__turListe === undefined).toBe(true);
  });

  test('E) yazarı BOŞ kayıtta kapı kurulamaz → /kitap-tur HİÇ sorulmaz', async ({ page }) => {
    await rafAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.kitapTur = { turler: ['Roman'], eslesen: { ad: 'Adsız', yazar: '' } };
    await page.evaluate(k => window.__zengin.kitapSorgula(k),
      { id: 'e', ad: 'Adsız', yazar: '', tur: '', isbn: '',
        sayfa: 50, yayinevi: 'Y', yil: 2000, kapak: 'x' });
    expect(page.__agSayac.kitapTur).toBe(0);
  });

  /* CANLI KANIT (21-22 Eylül): 1000Kitap'ın ISBN araması worker'dan aralıklı
     olarak 0 aday dönüyor (aynı anda BAŞLIK araması çalışıyor — /saglik
     "iki kaynak da calisiyor" derken /isbn boş geldi). Paris Sıkıntısı,
     Oyuncuya ve A'dan Z'ye Astronomi tam da bu pencerede ISBN'le
     bulunamadı, ad yoluyla bulundu. Düşüş bu yüzden süs değil, taşıyıcı. */
  test('F1) ISBN tür VERMEZSE ad yoluna düşülür (kapı yine kurulur)', async ({ page }) => {
    await rafAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.isbn = { sonuclar: [] };                     // 1000Kitap ISBN'i tanımadı
    page.__agAyar.kitapTur = { turler: ['Dünya Klasikleri', 'Şiir'],
      eslesen: { ad: 'Paris Sıkıntısı', yazar: 'Charles Baudelaire' } };
    const s = await page.evaluate(k => window.__zengin.kitapSorgula(k),
      { id: 'f1', ad: 'Paris Sikintisi', yazar: 'Charles Baudelaire', tur: '',
        isbn: '9789754588033', sayfa: 100, yayinevi: 'Y', yil: 2013, kapak: 'x' });
    expect(s.b.__turListe).toEqual(['Dünya Klasikleri', 'Şiir']);
    expect(s.b.__turKapi).toBe('ad+yazar');
    expect(page.__agSayac.kitapTur).toBe(1);
  });

  test('F2) BAYAT önbellek: turler alanı OLMAYAN /isbn yanıtı çökertmez, ad yoluna düşer', async ({ page }) => {
    await rafAc(page);
    page.__agAyar.turler = TURLER;
    /* v130 öncesi kenar önbelleğinde duran yanıtlar `turler` taşımıyor (24 saat
       yaşıyorlar) — alan yokluğu "tür yok" demektir, hata değil. */
    page.__agAyar.isbn = { sonuclar: [{ ad: 'Eski', yazar: 'Yazar', yayinevi: 'Y', yil: 2000,
      sayfa: 10, kapak: null, isbn: '9786051066752', kaynak: '1000Kitap', cevirmen: '', dil: 'tr' }] };
    page.__agAyar.kitapTur = { turler: ['Roman'], eslesen: { ad: 'Eski', yazar: 'Yazar' } };
    const s = await page.evaluate(k => window.__zengin.kitapSorgula(k),
      { id: 'f2', ad: 'Eski', yazar: 'Yazar', tur: '', isbn: '9786051066752',
        sayfa: 10, yayinevi: 'Y', yil: 2000, kapak: 'x' });
    expect(s.b.__turListe).toEqual(['Roman']);
  });

  test('F) TEK KAYNAK: 1000Kitap listesi varsa Google türü o kitaba yazılmaz', async ({ page }) => {
    await rafAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.isbn = isbnYanit({ turler: ['Tiyatro', 'Roman'] });
    page.__agAyar.google = { totalItems: 1, items: [{ volumeInfo: {
      title: 'İki Kaynak', authors: ['Yazar'], categories: ['History'] } }] };
    const s = await page.evaluate(k => window.__zengin.kitapSorgula(k),
      { id: 'f', ad: 'İki Kaynak', yazar: 'Yazar', tur: '', isbn: '9786051066752',
        sayfa: 100, yayinevi: 'Y', yil: 2000, kapak: 'x' });
    expect(s.b.__turListe).toEqual(['Tiyatro', 'Roman']);
    expect(s.b.tur).toBeUndefined();          // Google 'Tarih' derdi — yazılmadı
  });

  /* ---------- SIRA: tür listesi GOOGLE'DAN ÖNCE ---------- */

  test('F3) yalnız türü eksik kitapta liste gelirse Google a HİÇ gidilmez (bütçe)', async ({ page }) => {
    await rafAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.isbn = isbnYanit({ turler: ['Tiyatro', 'Roman'] });
    const s = await page.evaluate(k => window.__zengin.kitapSorgula(k),
      { id: 'f3', ad: 'Yalnız Tür', yazar: 'Yazar', tur: '', isbn: '9786051066752',
        sayfa: 100, yayinevi: 'Y', yil: 2000, kapak: 'https://1k-cdn.com/x.jpg' });
    expect(s.b.__turListe).toEqual(['Tiyatro', 'Roman']);
    expect(page.__agSayac.google).toBe(0);        // eski akışta 1-2 istek giderdi
    expect(page.__agSayac.isbn).toBe(1);          // kitap başına tek worker isteği
  });

  test('F4) DAYANIKLILIK: Google düşse bile tür listesi gelir', async ({ page }) => {
    await rafAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.google = 'hata';                // v128: fırlayan istek kitabı komple düşürürdü
    page.__agAyar.isbn = isbnYanit({ turler: ['Tiyatro'] });
    const s = await page.evaluate(k => window.__zengin.kitapSorgula(k),
      { id: 'f4', ad: 'Google Düştü', yazar: 'Yazar', tur: '', isbn: '9786051066752',
        sayfa: 100, yayinevi: 'Y', yil: 2000, kapak: 'https://1k-cdn.com/x.jpg' });
    expect(s.b.__turListe).toEqual(['Tiyatro']);
  });

  /* ---------- M2: SEÇİM KAPISI (Kaan'ın üç maddesi) ---------- */

  test('G) SEÇİLMEYEN kitaba tür YAZILMAZ (önizleme çizildi, çipe dokunulmadı)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Seçilmeyen', yazar: 'Yazar', tur: '',
      isbn: '9786051066752', sayfa: 100, yayinevi: 'Y', yil: 2000, kapak: 'x' })]);
    await rafAc(page); await ayarlarAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.isbn = isbnYanit({ turler: ['Tiyatro', 'Roman'] });
    await tara(page);
    /* çipler ÇİZİLDİ ve HİÇBİRİ seçili değil */
    await expect(page.locator('#zgTaramaGovde .zgt-cip')).toHaveCount(2);
    await expect(page.locator('#zgTaramaGovde .zgt-cip.secili')).toHaveCount(0);
    await expect(page.locator('#zgTaramaGovde .zgt-basi')).toContainText('0 / 1');
    /* Uygula kuyruğu temizler: seçilmemiş liste kaybolacak — kullanıcı
       kararı vermeden ÖNCE bunu okuyor (gizli friksiyon yok). */
    await expect(page.locator('#zgTaramaGovde .zgt-kalan')).toContainText('yeniden taraman gerekir');
    await page.click('#zgTaramaGovde [data-act="zg-uygula"]');
    expect(await turu(page, 'Seçilmeyen')).toBe('');
  });

  test('H) SEÇİLEN tür yazılır — ve yalnız seçilen', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Seçilen', yazar: 'Yazar', tur: '',
      isbn: '9786051066752', sayfa: 100, yayinevi: 'Y', yil: 2000, kapak: 'x' })]);
    await rafAc(page); await ayarlarAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.isbn = isbnYanit({ turler: ['Tiyatro', 'Roman'] });
    await tara(page);
    await page.click('#zgTaramaGovde .zgt-cip[data-tur="Roman"]');
    await expect(page.locator('#zgTaramaGovde .zgt-cip.secili')).toHaveCount(1);
    await expect(page.locator('#zgTaramaGovde .zgt-basi')).toContainText('1 / 1');
    await expect(page.locator('#zgTaramaGovde .zgt-kalan')).toHaveCount(0);   // kalan yoksa uyarı da yok
    await page.click('#zgTaramaGovde [data-act="zg-uygula"]');
    expect(await turu(page, 'Seçilen')).toBe('Roman');
  });

  test('I) TEK SEÇİM: ikinci çip birincinin yerine geçer, ikisi birden olmaz', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Tek Seçim', yazar: 'Yazar', tur: '',
      isbn: '9786051066752', sayfa: 100, yayinevi: 'Y', yil: 2000, kapak: 'x' })]);
    await rafAc(page); await ayarlarAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.isbn = isbnYanit({ turler: ['Tiyatro', 'Roman', 'Tarih'] });
    await tara(page);
    await page.click('#zgTaramaGovde .zgt-cip[data-tur="Tiyatro"]');
    await page.click('#zgTaramaGovde .zgt-cip[data-tur="Tarih"]');
    await expect(page.locator('#zgTaramaGovde .zgt-cip.secili')).toHaveCount(1);
    const d = await page.evaluate(() => window.__zengin.kuyrukYukle().turSec);
    expect(Object.values(d)).toEqual(['Tarih']);      // skaler — dizi DEĞİL
    await page.click('#zgTaramaGovde [data-act="zg-uygula"]');
    expect(await turu(page, 'Tek Seçim')).toBe('Tarih');
  });

  test('J) seçiliye TEKRAR dokunmak seçimi kaldırır → yine yazılmaz', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Geri Alınan', yazar: 'Yazar', tur: '',
      isbn: '9786051066752', sayfa: 100, yayinevi: 'Y', yil: 2000, kapak: 'x' })]);
    await rafAc(page); await ayarlarAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.isbn = isbnYanit({ turler: ['Tiyatro', 'Roman'] });
    await tara(page);
    await page.click('#zgTaramaGovde .zgt-cip[data-tur="Tiyatro"]');
    await page.click('#zgTaramaGovde .zgt-cip[data-tur="Tiyatro"]');
    await expect(page.locator('#zgTaramaGovde .zgt-cip.secili')).toHaveCount(0);
    await page.click('#zgTaramaGovde [data-act="zg-uygula"]');
    expect(await turu(page, 'Geri Alınan')).toBe('');
  });

  test('K) LİSTE DIŞI seçim yazılmaz (bayat kuyruk / kurcalanmış değer)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Liste Dışı', yazar: 'Yazar', tur: '',
      isbn: '9786051066752', sayfa: 100, yayinevi: 'Y', yil: 2000, kapak: 'x' })]);
    await rafAc(page); await ayarlarAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.isbn = isbnYanit({ turler: ['Tiyatro', 'Roman'] });
    await tara(page);
    const yazildi = await page.evaluate(() => {
      const d = window.__zengin.kuyrukYukle();
      const id = Object.keys(d.bulunan)[0];
      d.turSec[id] = 'Polisiye';                      // listede YOK
      window.__zengin.kuyrukKaydet(d);
      window.__zengin.uygula(window.__zengin.kuyrukYukle());
      return true;
    });
    expect(yazildi).toBe(true);
    expect(await turu(page, 'Liste Dışı')).toBe('');
  });

  test('L) DOLU tür alanı seçimle de EZİLMEZ', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Zaten Dolu', yazar: 'Yazar', tur: '',
      isbn: '9786051066752', sayfa: 100, yayinevi: 'Y', yil: 2000, kapak: 'x' })]);
    await rafAc(page); await ayarlarAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.isbn = isbnYanit({ turler: ['Tiyatro', 'Roman'] });
    await tara(page);
    await page.click('#zgTaramaGovde .zgt-cip[data-tur="Roman"]');
    /* tarama ile uygulama arasında kullanıcı elle doldurdu */
    await page.evaluate(() => {
      veri.kitaplar.find(k => k.ad === 'Zaten Dolu').tur = 'Şiir';
    });
    await page.click('#zgTaramaGovde [data-act="zg-uygula"]');
    expect(await turu(page, 'Zaten Dolu')).toBe('Şiir');
  });

  /* ---------- M4: TAKSONOMİ DÜŞTÜ, SESSİZ GEÇME YOK ---------- */

  test('M) /turler düşerse tür adımı ATLANIR ve ekranda YAZAR', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Taksonomisiz', yazar: 'Yazar', tur: '',
      isbn: '', sayfa: 0, yayinevi: 'Y', yil: 2000, kapak: 'x' })]);
    await rafAc(page); await ayarlarAc(page);
    page.__agAyar.turler = 'hata';                    // /turler düştü
    page.__agAyar.kitapTur = { turler: [], eslesen: null };   // 1000Kitap da vermedi
    page.__agAyar.google = { totalItems: 1, items: [{ volumeInfo: {
      title: 'Taksonomisiz', authors: ['Yazar'], categories: ['Drama'], pageCount: 120 } }] };
    await tara(page);
    await expect(page.locator('#zgTaramaGovde .zgt-uyari')).toContainText('tür adımı ATLANDI');
    const d = await page.evaluate(() => window.__zengin.kuyrukYukle());
    expect(Object.keys(d.turAtlanan)).toHaveLength(1);
    /* diğer alanlar tarandı — atlama YALNIZ türe ait */
    expect(Object.values(d.bulunan)[0].sayfa).toBe(120);
    expect(Object.values(d.bulunan)[0].tur).toBeUndefined();
  });

  test('N) taksonomi VARKEN Google yolu aynen çalışır (regresyon yok)', async ({ page }) => {
    await rafAc(page);
    page.__agAyar.turler = TURLER;
    /* kitapSorgula doğrudan çağrıldığında taksonomiyi taramaBaslat yüklemez */
    await page.evaluate(t => window.__zengin.taksonomiKur(t), TURLER);
    page.__agAyar.google = { totalItems: 1, items: [{ volumeInfo: {
      title: 'Normal Yol', authors: ['Yazar'], categories: ['Drama'] } }] };
    const s = await page.evaluate(k => window.__zengin.kitapSorgula(k),
      { id: 'n', ad: 'Normal Yol', yazar: 'Yazar', tur: '', isbn: '',
        sayfa: 10, yayinevi: 'Y', yil: 2000, kapak: 'x' });
    expect(s.b.tur).toBe('Tiyatro');
    expect(s.b.__turListe).toBeUndefined();
    expect(s.turAtlandi).toBe(false);
  });

  /* ---------- M5: ÜÇ EŞLEME VAR, DÖRT EŞLEME YOK ---------- */

  test('O) ölçülmüş 3 eşleme çalışır', async ({ page }) => {
    await rafAc(page);
    await page.evaluate(t => window.__zengin.taksonomiKur(t), TURLER);
    const c = (k) => page.evaluate(x => window.__zengin.turCevir(x), k);
    expect(await c(['Turks'])).toBe('Tarih');
    expect(await c(['Acting'])).toBe('Tiyatro');
    expect(await c(['Cressida (Fictitious character)'])).toBe('Tiyatro');
  });

  test('P) ölçümün çürüttüğü / Kaan ın elediği 4 kategori BOŞ kalır', async ({ page }) => {
    await rafAc(page);
    await page.evaluate(t => window.__zengin.taksonomiKur(t), TURLER);
    const c = (k) => page.evaluate(x => window.__zengin.turCevir(x), k);
    expect(await c(['Human beings'])).toBe('');        // 1000Kitap çürüttü
    expect(await c(['Physicists'])).toBe('');          // kişi kategorisi ilkesi
    expect(await c(['Antiques & Collectibles'])).toBe('');
    expect(await c(['Knights and knighthood'])).toBe('');
    expect(await c(['Turkey'])).toBe('');              // ülke ≠ tür ('turks' onu yakalamaz)
  });
});
