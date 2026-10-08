'use strict';
/* G124 (v133) — "BİTTİ"YE GEÇİŞ = BUGÜN (Europe/Istanbul), ELLE SEÇİM EZİLMEZ
 *
 * Kural (Kaan, 2026-10-08):
 *   · Herhangi bir yoldan BAŞKA durumdan "bitti"ye geçiş → bitisTarihi = o anın
 *     İstanbul günü (YYYY-AA-GG). Zaten "bitti" olan kitapta HİÇBİR ŞEY değişmez.
 *   · Detayda tarih her zaman elle seçilebilir; elle seçilen tarih sonradan
 *     otomatik ezilmez.
 *   · bitti → başka durum → bitti: yeni günün tarihi; okumalar[] arşivi bozulmaz.
 *   · KESİN YASAK: içe aktarma (JSON yedek, Goodreads CSV, özet/not dosyası) ve
 *     senkron hiçbir kitaba otomatik bitiş tarihi yazmaz (62 tarihsiz eski
 *     kitap bilerek boş).
 *
 * Yollar: detay "Bitirdim" · form (yeni / düzenleme) · toplu durum ·
 *         yeniden oku döngüsü · bayat düğme.
 *
 * MUTASYON DENETİMİ (koşuldu):
 *   M1  bugun() eski yerel-gün koduna dönsün           → S1, S2 kırmızı
 *   M2  f-durum'da "zaten bitti" kapısı kalksın         → F3, F4 kırmızı
 *   M3  toplu'da zatenBitti atlaması kalksın            → T1 kırmızı
 *   M4  bitir'de durum kapısı kalksın                   → D3 kırmızı
 *   M5  v134: boş alanda bırakma tarihi silinmesin       → Y1 kırmızı
 */
const { test, expect, tohumla, sahteKitap, rafAc, rafYenile, ayarlarAc,
  ayrintilarAc, dosyadanYukle, jsonDosya, bugunISO } = require('./yardim');

/* Test makinesi İstanbul saatinde değilse bugunISO (Node yerel) yanılır —
   beklenen günü de İstanbul'dan hesapla. */
function istGun(kayma) {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  const d = new Date(p.year + '-' + p.month + '-' + p.day + 'T12:00:00Z');
  if (kayma) d.setUTCDate(d.getUTCDate() + kayma);
  return d.toISOString().slice(0, 10);
}
async function detayAc(page, ad) {
  /* form kaydı detayı açık bırakabilir (form detayın üstünde açılır) */
  if (ad && await page.locator('#ortuDetay.acik').count()
      && await page.evaluate(a => (kitapBul(durum.detayId) || {}).ad === a, ad)) return;
  await page.click(ad ? `#liste .kart:has-text("${ad}")` : '#liste .kart');
  await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
}
async function duzenleAc(page) {
  await page.click('#dDigerKatla summary');
  await page.click('[data-act="duzenle"]');
  await ayrintilarAc(page);
}
const kitap = (page, ad) => page.evaluate(a => {
  const k = veri.kitaplar.find(x => x.ad === a);
  return k && JSON.parse(JSON.stringify(k));
}, ad);

test.describe('G124 detay yolu', () => {

  test('D1) okunuyor → "Bitirdim" = bugün (İstanbul)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Sürüyor', durum: 'okunuyor', sayfa: 100, baslamaTarihi: '2026-01-01' })]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="bitir"]');
    const k = await kitap(page, 'Sürüyor');
    expect(k.durum).toBe('bitti');
    expect(k.bitisTarihi).toBe(istGun());
  });

  test('D2) detayda tarih seçiciyle elle seçilen tarih yenilemede ve form kaydında EZİLMEZ', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Elle', durum: 'okunuyor', sayfa: 100, baslamaTarihi: '2026-01-01' })]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="bitir"]');
    await page.click('[data-act="bt-ac"]');
    await expect(page.locator('#dBitisTarih')).toHaveAttribute('type', 'date');
    await page.fill('#dBitisTarih', '2026-02-14');
    await page.click('[data-act="bt-kaydet"]');
    expect((await kitap(page, 'Elle')).bitisTarihi).toBe('2026-02-14');
    // yenile, detayı aç, düzenle formunu kaydet → hep aynı
    await rafYenile(page);
    await detayAc(page);
    await duzenleAc(page);
    await expect(page.locator('#f-bit')).toHaveValue('2026-02-14');
    await page.click('[data-act="form-kaydet"]');
    expect((await kitap(page, 'Elle')).bitisTarihi).toBe('2026-02-14');
  });

  test('D3) bayat "Bitirdim" (kitap bu arada zaten bitmiş) hiçbir şey değiştirmez', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Bayat', durum: 'okunuyor', sayfa: 100 })]);
    await rafAc(page);
    await detayAc(page);
    // başka bir yoldan (ör. senkron) kitap tarihsiz "bitti" olmuş; düğme ekranda kalmış
    const g0 = await page.evaluate(() => { const k = veri.kitaplar[0]; k.durum = 'bitti'; k.bitisTarihi = null; k.g = 123; return k.g; });
    await page.click('[data-act="bitir"]');
    const k = await kitap(page, 'Bayat');
    expect(k.bitisTarihi).toBe(null);
    expect(k.g).toBe(g0);
  });
});

test.describe('G124 form yolu', () => {

  test('F1) düzenleme: okunuyor → Bitti = bugün', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Form1', durum: 'okunuyor', sayfa: 100, baslamaTarihi: '2026-01-01' })]);
    await rafAc(page);
    await detayAc(page);
    await duzenleAc(page);
    await page.click('[data-act="f-durum"][data-v="bitti"]');
    await expect(page.locator('#f-bit')).toHaveValue(istGun());
    await page.click('[data-act="form-kaydet"]');
    expect((await kitap(page, 'Form1')).bitisTarihi).toBe(istGun());
  });

  test('F2) düzenleme: yarım (bırakma tarihli) → Bitti = BUGÜN (bırakma tarihi kalmaz)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Yarım', durum: 'yarim', sayfa: 100, baslamaTarihi: '2025-12-01', bitisTarihi: '2026-01-05' })]);
    await rafAc(page);
    await detayAc(page);
    await duzenleAc(page);
    await expect(page.locator('#f-bit')).toHaveValue('2026-01-05');
    await page.click('[data-act="f-durum"][data-v="bitti"]');
    await expect(page.locator('#f-bit')).toHaveValue(istGun());
    await page.click('[data-act="form-kaydet"]');
    expect((await kitap(page, 'Yarım')).bitisTarihi).toBe(istGun());
  });

  test('F3) zaten bitti + TARİHSİZ: "Bitti"ye yeniden basmak tarih YAZMAZ', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Eski', durum: 'bitti', sayfa: 100, bitisTarihi: null })]);
    await rafAc(page);
    await detayAc(page);
    await duzenleAc(page);
    await page.click('[data-act="f-durum"][data-v="bitti"]');
    await expect(page.locator('#f-bit')).toHaveValue('');
    await page.click('[data-act="form-kaydet"]');
    expect((await kitap(page, 'Eski')).bitisTarihi).toBe(null);
  });

  test('F4) zaten bitti + tarihli: formda okunuyor↔bitti gidip gelmek tarihi değiştirmez', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Eski2', durum: 'bitti', sayfa: 100, bitisTarihi: '2019-03-03' })]);
    await rafAc(page);
    await detayAc(page);
    await duzenleAc(page);
    await page.click('[data-act="f-durum"][data-v="okunuyor"]');
    await page.click('[data-act="f-durum"][data-v="bitti"]');
    await expect(page.locator('#f-bit')).toHaveValue('2019-03-03');
    await page.click('[data-act="form-kaydet"]');
    expect((await kitap(page, 'Eski2')).bitisTarihi).toBe('2019-03-03');
  });

  test('F5) formda Bitti sonrası ELLE seçilen tarih kaydedilir, otomatik ezilmez', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Form5', durum: 'okunuyor', sayfa: 100, baslamaTarihi: '2026-01-01' })]);
    await rafAc(page);
    await detayAc(page);
    await duzenleAc(page);
    await page.click('[data-act="f-durum"][data-v="bitti"]');
    await page.fill('#f-bit', '2026-03-10');
    await page.click('[data-act="form-kaydet"]');
    expect((await kitap(page, 'Form5')).bitisTarihi).toBe('2026-03-10');
  });
});

test.describe('G124 toplu yol', () => {

  test('T1) toplu "bitti": geçenler bugünü alır (yarımın bırakma tarihi dahil), zaten bitmişlere DOKUNULMAZ', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Okunacak', durum: 'okunacak', sayfa: 100 }),
      sahteKitap({ ad: 'YarımT', durum: 'yarim', sayfa: 100, guncelSayfa: 30, bitisTarihi: '2026-01-05' }),
      sahteKitap({ ad: 'TarihsizBitmiş', durum: 'bitti', sayfa: 200, guncelSayfa: 50, bitisTarihi: null, g: 777 }),
      sahteKitap({ ad: 'TarihliBitmiş', durum: 'bitti', sayfa: 200, bitisTarihi: '2018-08-08', g: 888 })
    ]);
    await rafAc(page);
    await page.click('#secimBtn');
    await page.click('[data-act="toplu-tumu"]');
    await page.click('[data-act="toplu-durum"]');
    await page.selectOption('#topluDurumSec', 'bitti');
    await expect(page.locator('#topluBitTarih')).toHaveValue(istGun());
    await page.click('[data-act="toplu-durum-uygula"]');
    await expect(page.locator('#toast')).toContainText('2 kitabın durumu değişti');
    await expect(page.locator('#toast')).toContainText('2 kitap zaten bitmişti, dokunulmadı');
    expect((await kitap(page, 'Okunacak')).bitisTarihi).toBe(istGun());
    expect((await kitap(page, 'YarımT')).bitisTarihi).toBe(istGun());
    const t1 = await kitap(page, 'TarihsizBitmiş');
    expect([t1.bitisTarihi, t1.guncelSayfa, t1.g]).toEqual([null, 50, 777]);
    const t2 = await kitap(page, 'TarihliBitmiş');
    expect([t2.bitisTarihi, t2.g]).toEqual(['2018-08-08', 888]);
  });
});

test.describe('G124 toplu: yarım kitap + tarih alanı (v134, Kaan kararı)', () => {
  /* Bırakma tarihi bitiş tarihi DEĞİLDİR: geçişte ya seçilen tarih yazılır
     ya da (alan boşsa) bitiş BOŞ kalır. Zaten bitmiş kitap her iki durumda
     değişmez. */
  async function topluBittiTarih(page, tarih) {
    await page.click('#secimBtn');
    await page.click('[data-act="toplu-tumu"]');
    await page.click('[data-act="toplu-durum"]');
    await page.selectOption('#topluDurumSec', 'bitti');
    await page.fill('#topluBitTarih', tarih);
    await page.click('[data-act="toplu-durum-uygula"]');
  }
  const tohum = () => [
    sahteKitap({ ad: 'YarımK', durum: 'yarim', sayfa: 100, guncelSayfa: 30,
      baslamaTarihi: '2025-11-01', bitisTarihi: '2026-01-05' }),
    sahteKitap({ ad: 'BitmişTarihsiz', durum: 'bitti', sayfa: 200, guncelSayfa: 50, bitisTarihi: null, g: 777 }),
    sahteKitap({ ad: 'BitmişTarihli', durum: 'bitti', sayfa: 200, guncelSayfa: 200, bitisTarihi: '2018-08-08', g: 888 })
  ];
  async function bitmislerDegismedi(page) {
    const a = await kitap(page, 'BitmişTarihsiz');
    expect([a.durum, a.bitisTarihi, a.guncelSayfa, a.g]).toEqual(['bitti', null, 50, 777]);
    const b = await kitap(page, 'BitmişTarihli');
    expect([b.durum, b.bitisTarihi, b.guncelSayfa, b.g]).toEqual(['bitti', '2018-08-08', 200, 888]);
  }

  test('Y1) yarım + BOŞ tarih → bitisTarihi boş (bırakma tarihi silinir); bitmişler değişmez', async ({ page }) => {
    await tohumla(page, tohum());
    await rafAc(page);
    await topluBittiTarih(page, '');
    await expect(page.locator('#toast')).toContainText('1 kitabın durumu değişti');
    await expect(page.locator('#toast')).toContainText('1 kitap tarihsiz bırakıldı');
    await expect(page.locator('#toast')).toContainText('2 kitap zaten bitmişti, dokunulmadı');
    const y = await kitap(page, 'YarımK');
    expect([y.durum, y.bitisTarihi]).toEqual(['bitti', null]);
    await bitmislerDegismedi(page);
    await rafYenile(page);
    expect((await kitap(page, 'YarımK')).bitisTarihi).toBe(null);
  });

  test('Y2) yarım + SEÇİLİ tarih → seçilen tarih; bitmişler değişmez', async ({ page }) => {
    await tohumla(page, tohum());
    await rafAc(page);
    await topluBittiTarih(page, '2026-02-20');
    await expect(page.locator('#toast')).toContainText('1 kitaba bitiş tarihi 20 Şub 2026 yazıldı');
    const y = await kitap(page, 'YarımK');
    expect([y.durum, y.bitisTarihi]).toEqual(['bitti', '2026-02-20']);
    await bitmislerDegismedi(page);
  });
});

test.describe('G124 döngü: bitti → başka → bitti', () => {

  test('C1) yeniden oku: eski okuma okumalar[]da korunur, yeni bitiş bugünün tarihi', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Tekrar', durum: 'bitti', sayfa: 100, puan: 8,
      baslamaTarihi: '2020-01-01', bitisTarihi: '2020-02-02' })]);
    await rafAc(page);
    await detayAc(page);
    await page.click('#dDigerKatla summary');
    await page.click('[data-act="yeniden-oku"]');
    let k = await kitap(page, 'Tekrar');
    expect(k.durum).toBe('okunuyor');
    expect(k.bitisTarihi).toBe(null);
    expect(k.okumalar).toEqual([{ bas: '2020-01-01', bit: '2020-02-02', puan: 8, not: '' }]);
    await page.click('[data-act="bitir"]');
    k = await kitap(page, 'Tekrar');
    expect(k.bitisTarihi).toBe(istGun());
    expect(k.okumalar).toEqual([{ bas: '2020-01-01', bit: '2020-02-02', puan: 8, not: '' }]);
  });

  test('C2) formla bitti → okunuyor → (Bitirdim) bitti: yeni günün tarihi', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Döngü', durum: 'bitti', sayfa: 100, bitisTarihi: '2021-05-05' })]);
    await rafAc(page);
    await detayAc(page);
    await duzenleAc(page);
    await page.click('[data-act="f-durum"][data-v="okunuyor"]');
    await page.click('[data-act="form-kaydet"]');
    expect((await kitap(page, 'Döngü')).bitisTarihi).toBe(null);
    await detayAc(page, 'Döngü');
    await page.click('[data-act="bitir"]');
    expect((await kitap(page, 'Döngü')).bitisTarihi).toBe(istGun());
  });
});

test.describe('G124 saat: 00:30 İstanbul, cihaz UTC', () => {
  /* Cihaz UTC'de: 2026-03-14T21:30Z = İstanbul 2026-03-15 00:30. Yerel gün
     mantığı 14'ünü yazardı; doğru cevap 15. Yıl sınırı da sınanır. */
  test.use({ timezoneId: 'UTC' });

  test('S1) detay "Bitirdim" 00:30 İstanbul → İstanbul günü (cihazın UTC günü DEĞİL)', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-03-14T21:30:00Z'));
    await tohumla(page, [sahteKitap({ ad: 'Gece', durum: 'okunuyor', sayfa: 100, baslamaTarihi: '2026-03-01' })]);
    await rafAc(page);
    expect(await page.evaluate(() => new Date().getDate())).toBe(14);   // cihaz gerçekten UTC günü görüyor
    await detayAc(page);
    await page.click('[data-act="bitir"]');
    expect((await kitap(page, 'Gece')).bitisTarihi).toBe('2026-03-15');
    await expect(page.locator('#dBitisMetin')).toContainText('(bugün)');
  });

  test('S2) yıl sınırı: 31 Ara 21:30Z = 1 Oca 00:30 İstanbul — form ve "Dün" düğmesi', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-12-31T21:30:00Z'));
    await tohumla(page, [sahteKitap({ ad: 'Yılbaşı', durum: 'okunuyor', sayfa: 100, baslamaTarihi: '2026-12-01' })]);
    await rafAc(page);
    await detayAc(page);
    await duzenleAc(page);
    await page.click('[data-act="f-durum"][data-v="bitti"]');
    await expect(page.locator('#f-bit')).toHaveValue('2027-01-01');
    await page.click('[data-act="form-kaydet"]');
    expect((await kitap(page, 'Yılbaşı')).bitisTarihi).toBe('2027-01-01');
    await detayAc(page, 'Yılbaşı');
    await page.click('[data-act="bt-ac"]');
    await expect(page.locator('[data-act="bt-hizli"]').nth(1)).toHaveAttribute('data-v', '2026-12-31');
    await expect(page.locator('#dBitisTarih')).toHaveAttribute('max', '2027-01-01');
  });
});

test.describe('G124 KESİN YASAK: içe aktarma ve senkron tarih YAZMAZ', () => {

  test('I1) JSON yedek (birleştir + tam değiştir): tarihsiz bitmiş tarihsiz kalır', async ({ page }) => {
    for (const secim of ['birlestir', 'degistir']) {
      await tohumla(page, [sahteKitap({ ad: 'Var Olan', yazar: 'A' })]);
      await rafAc(page);
      await ayarlarAc(page);
      const yedek = { surum: 2, hedef: {}, kitaplar: [
        { id: 'y1', ad: 'Yedekten Tarihsiz', yazar: 'B', durum: 'bitti', bitisTarihi: null },
        { id: 'y2', ad: 'Yedekten Tarihli', yazar: 'C', durum: 'bitti', bitisTarihi: '2017-07-07' }] };
      await dosyadanYukle(page, jsonDosya(yedek, 'yedek.json'), secim);
      await expect.poll(() => page.evaluate(() => veri.kitaplar.some(k => k.ad === 'Yedekten Tarihsiz'))).toBe(true);
      expect((await kitap(page, 'Yedekten Tarihsiz')).bitisTarihi, secim).toBe(null);
      expect((await kitap(page, 'Yedekten Tarihli')).bitisTarihi, secim).toBe('2017-07-07');
      await rafYenile(page);
      expect((await kitap(page, 'Yedekten Tarihsiz')).bitisTarihi, secim + ' yenileme').toBe(null);
    }
  });

  test('I2) Goodreads CSV: "read" rafı Date Read boşsa tarihsiz kalır', async ({ page }) => {
    await rafAc(page);
    await ayarlarAc(page);
    const csv = [
      'Title,Author,ISBN13,My Rating,Number of Pages,Year Published,Date Read,Date Added,Bookshelves,Exclusive Shelf,My Review,Publisher',
      '"Tarihsiz Okunmuş","Yazar X",,4,300,1990,,2026/06/01,"read",read,,'
    ].join('\n');
    await dosyadanYukle(page, { name: 'goodreads.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf8') });
    await expect.poll(() => page.evaluate(() => veri.kitaplar.length)).toBe(1);
    const k = await kitap(page, 'Tarihsiz Okunmuş');
    expect(k.durum).toBe('bitti');
    expect(k.bitisTarihi).toBe(null);
  });

  test('I3) özet ve not dosyası: tarihsiz bitmiş kitaba tarih yazılmaz, kitap damgası değişmez', async ({ page }) => {
    await tohumla(page, [sahteKitap({ id: 'oz1', ad: 'Özetli Eski', yazar: 'Yazar A', durum: 'bitti', bitisTarihi: null, g: 555 })]);
    await rafAc(page);
    await page.evaluate(() => window.__ozet.hazirBekle());
    await ayarlarAc(page);
    await dosyadanYukle(page, jsonDosya({ ozet: [{ ad: 'Özetli Eski', yazar: 'Yazar A', ozet: 'Bir özet.' }] }, 'o.json'));
    await page.click('[data-act="zg-ozet-uygula"]');
    await expect(page.locator('#toast')).toContainText('dosyadan yazıldı');
    let k = await kitap(page, 'Özetli Eski');
    expect([k.durum, k.bitisTarihi]).toEqual(['bitti', null]);
    if (!await page.locator('#ortuAyar.acik').count()) await ayarlarAc(page);
    await dosyadanYukle(page, jsonDosya({ surum: 1, not: [
      { ad: 'Özetli Eski', yazar: 'Yazar A', tip: 'not', metin: 'Dosyadan not.' }] }, 'notlar.json'));
    await page.click('[data-act="zg-not-uygula"]');
    await expect(page.locator('#toast')).toContainText('not dosyadan yazıldı');
    k = await kitap(page, 'Özetli Eski');
    expect([k.durum, k.bitisTarihi]).toEqual(['bitti', null]);
  });

  test('I4) senkron birleşimi: tarihsiz bitmiş iki tarafta da tarihsizse tarihsiz kalır', async ({ page }) => {
    await rafAc(page);
    const sonuc = await page.evaluate(() => {
      const yerel = { id: 's1', ad: 'Senk', durum: 'bitti', bitisTarihi: null, g: 1000, notlar: [] };
      const uzak = { id: 's1', ad: 'Senk', durum: 'bitti', bitisTarihi: null, g: 2000, notlar: [] };
      const uzakYeni = { id: 's2', ad: 'Uzaktan Gelen', durum: 'bitti', bitisTarihi: null, g: 3000, notlar: [] };
      const b = window.__senkron.birlestir({ kitaplar: [yerel], silinenler: {} },
        { kitaplar: [uzak, uzakYeni], silinenler: {} });
      return b.kitaplar.map(k => [k.id, k.bitisTarihi]);
    });
    expect(sonuc.sort()).toEqual([['s1', null], ['s2', null]]);
  });
});
