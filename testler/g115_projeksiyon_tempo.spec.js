'use strict';
/* G115 (v122) — PROJEKSİYON GÜNCEL TEMPOYU KULLANIR
 *
 * NEDEN: "Bu tempoyla yıl sonu projeksiyonu ~17 kitap — tempo artmalı" aritmetik
 * olarak doğruydu ama YANLIŞ ŞEYİ ölçüyordu: payda yılın başından bugüne
 * (12 ÷ 251). Kaan 2026'nın ilk 173 gününde hiç kitap bitirmemişti (ilk kayıt
 * 23 Haziran), yani projeksiyon hiç okunmayan 173 günü paydaya katıyordu.
 * Üstelik tavanı da oydu: o formülle bu yıl 17,5'in üstü İMKÂNSIZDI — hiçbir
 * okuma temposu göstergeyi "yolunda" yapamazdı.
 *
 * PENCERE SEÇİMİ (76 gün boyunca günlük yeniden hesaplanarak ölçüldü):
 *   yıl başı 7,8 aralık ama 76/76 gün "geride" · son 30 g 35,4 aralık ve hedef
 *   kararını 34 kez değiştirdi · son 60 g 11,5 · son 90 g 12,4 · "ilk kayıttan
 *   say" 320'ye fırladı (payda ~1 güne düşüyor) · "son N kitap" 477'ye.
 * İLKE: pencere normal bir sessiz dönemden UZUN olmalı. Kaan'ın 2026'daki en
 * uzun arası 38 gün (7 Tem → 14 Ağu); 60 onu kesin aşan EN KISA pencere.
 *
 * ÜÇ DURUM: eski iki durumun kesinliği kusurun kendisinden geliyordu — güncel
 * tempoyu ölçen hiçbir pencere "hedefi kaçıracaksın" diyemiyor (son 60 g için
 * %95 aralık [16,2 .. 36,8], hedef 30 İÇİNDE); yalnız bozuk yıl-başı penceresi
 * [14,8 .. 21,5] ile kesin konuşuyordu.
 *
 * Saat SABİTLENİR: aksi halde vakalar yıl içindeki güne göre kayardı.
 */
const { test, expect, tohumla, sahteKitap, rafAc } = require('./yardim');

const SAAT = '2026-09-08T12:00:00';
/* Kaan'ın gerçek 2026 bitişleri (pinakes-yedek-2026-09-08.json'dan) */
const BITISLER = ['2026-06-23', '2026-06-23', '2026-06-23', '2026-06-24', '2026-06-25',
  '2026-07-07', '2026-08-14', '2026-08-21', '2026-08-31', '2026-09-01', '2026-09-04', '2026-09-07'];

const bitmis = (ad, bitis) => sahteKitap({ ad, durum: 'bitti', bitisTarihi: bitis, sayfa: 200 });
const kaanRafi = (hedef, saat) => ({
  kitaplar: BITISLER.map((b, i) => bitmis('K' + i, b)),
  hedef: hedef ? { 2026: hedef } : {}
});

async function kur(page, veri, saat) {
  await page.clock.setFixedTime(new Date(saat || SAAT));
  await tohumla(page, veri);
  await rafAc(page);
}
async function istAc(page) { await page.click('.nav-btn[data-act="sekme"][data-v="ist"]'); }
const tempo = page => page.evaluate(() => tempoDurum());

test.describe('G115 projeksiyon güncel tempo (v122)', () => {

  test('A) ölü dönem paydaya GİRMEZ — Kaan\'ın gerçek verisi', async ({ page }) => {
    await kur(page, kaanRafi(30));
    const t = await tempo(page);

    expect(t.gunNo).toBe(251);
    expect(t.kalanGun).toBe(114);
    expect(t.bitti).toBe(12);
    /* Eski formül bu veriyle 17 veriyordu; testin bunu BAĞIMSIZ hesaplaması şart
       ki düzeltmenin gerçekten neyi değiştirdiği kilitli kalsın. */
    expect(Math.round(12 / 251 * 365)).toBe(17);
    expect(t.projeksiyon).toBe(23);

    expect(t.pencereGun).toBe(60);
    expect(t.pencereN).toBe(6);                 // 14 Ağu – 7 Eyl arası altı kitap
    expect(t.mevcutGun).toBeCloseTo(10, 5);     // 60 / 6
    expect(t.gerekliGun).toBeCloseTo(114 / 18, 5);
  });

  test('B) pencere 60 gün: eski bitişler TEMPOYA girmez ama SAYIMA girer', async ({ page }) => {
    await kur(page, kaanRafi(30));
    const t = await tempo(page);
    expect(t.bitti).toBe(12);      // yılın tamamı sayılır
    expect(t.pencereN).toBe(6);    // tempo yalnız son 60 günden
  });

  test('C) üç durum: üstünde / belirsiz / altında', async ({ page }) => {
    await kur(page, kaanRafi(12));
    expect((await tempo(page)).durum).toBe('ustunde');   // hedef zaten tutmuş

    await page.evaluate(() => { veri.hedef[2026] = 30; depoKaydet(); istCiz(); });
    const belirsiz = await tempo(page);
    expect(belirsiz.durum).toBe('belirsiz');             // [16,2 .. 36,8] içinde 30 var
    expect(belirsiz.tahminAlt).toBeLessThan(30);
    expect(belirsiz.tahminUst).toBeGreaterThan(30);

    await page.evaluate(() => { veri.hedef[2026] = 60; depoKaydet(); istCiz(); });
    expect((await tempo(page)).durum).toBe('altinda');   // 36,8 < 60
  });

  test('D) BELİRSİZ durumda emir kipi YOK, yerine gerekli hız yazılı', async ({ page }) => {
    await kur(page, kaanRafi(30));
    await istAc(page);

    const t = page.locator('#istTempo');
    await expect(t).toContainText('12 / 30');
    await expect(t).toContainText('Son 60 günde 6 kitap');
    await expect(t).toContainText('10 günde bir');
    await expect(t).toContainText('~23 kitap');
    /* Emir kipi kalktı: veri "kaçıracaksın" demeyi desteklemiyor. */
    await expect(t).not.toContainText('tempo artmalı');
    await expect(t).not.toContainText('yetişmez');
    await expect(t).not.toContainText('hedefin üstünde');

    const gerek = page.locator('#istGerekliHiz');
    await expect(gerek).toContainText('kalan 114 günde');
    await expect(gerek).toContainText('18 kitap');
    await expect(gerek).toContainText('6,3 günde bir');
  });

  test('E) hedefin üstündeyken gerekli hız satırı ÇIKMAZ (gürültü yapmaz)', async ({ page }) => {
    await kur(page, kaanRafi(12));
    await istAc(page);
    await expect(page.locator('#istTempo')).toContainText('hedefin üstünde');
    await expect(page.locator('#istGerekliHiz')).toHaveCount(0);
  });

  test('F) son 60 günde hiç kitap yoksa DÜRÜST cümle, uydurma tempo yok', async ({ page }) => {
    await kur(page, {
      kitaplar: ['2026-06-23', '2026-06-24', '2026-07-07'].map((b, i) => bitmis('E' + i, b)),
      hedef: { 2026: 30 }
    });
    const t = await tempo(page);
    expect(t.pencereN).toBe(0);
    expect(t.mevcutGun).toBeNull();
    expect(t.projeksiyon).toBe(3);          // biten kadar; kalan için tempo YOK
    await istAc(page);
    await expect(page.locator('#istTempo')).toContainText('Son 60 günde hiç kitap bitirmedin');
  });

  test('G) tempo penceresi YIL SINIRINI aşar', async ({ page }) => {
    /* 15 Ocak 2027: son 60 gün 16 Kasım 2026'ya uzanır. Tempo okurun özelliği,
       takvimin değil — Aralık'ta okunanlar Ocak temposu hakkında kanıttır.
       Pencere yıla hapsedilseydi pencereN 1 olurdu ve Ocak yine saçmalardı. */
    await kur(page, {
      kitaplar: [bitmis('X', '2026-12-20'), bitmis('Y', '2026-12-28'), bitmis('Z', '2027-01-05')],
      hedef: { 2027: 30 }
    }, '2027-01-15T12:00:00');
    const t = await tempo(page);
    expect(t.yil).toBe(2027);
    expect(t.bitti).toBe(1);        // taban YILA ÖZGÜ
    expect(t.pencereN).toBe(3);     // tempo yıl sınırını AŞAR
  });

  test('H) Ocak saçmalığı bitti — 45 gün muafiyeti olmadan da patlamıyor', async ({ page }) => {
    /* Eski formül: 1 kitap ÷ 10 gün × 365 = 37. Bu yüzden gunNo>=45 muafiyeti
       vardı. Pencere tabanlı hesapta muafiyet gereksiz: 1 kitap / 60 gün. */
    await kur(page, {
      kitaplar: [bitmis('T', '2027-01-05')], hedef: { 2027: 30 }
    }, '2027-01-10T12:00:00');
    const t = await tempo(page);
    expect(Math.round(1 / 10 * 365)).toBe(37);      // eski formülün ürettiği saçmalık
    expect(t.projeksiyon).toBeLessThanOrEqual(12);
  });

  test('I) geride bayrağı YALNIZ açık ara altındayken kalkar (bildirim sessizliği)', async ({ page }) => {
    await kur(page, kaanRafi(30));
    expect((await tempo(page)).geride).toBe(false);   // belirsizde tetik SESSİZ

    await page.evaluate(() => { veri.hedef[2026] = 60; depoKaydet(); });
    expect((await tempo(page)).geride).toBe(true);    // açık ara altında
  });

});
