'use strict';
/* G116 (v124) — SAYFA HEDEFİ PROJEKSİYONU
 *
 * NEDEN: zeka.js'teki sayfa hedefi, kitap hedefinin v122'de düzeltilen kusurunun
 * İKİZİNİ taşıyordu — `ilerleme / gunNo * 365`, yani okunmayan günler paydada.
 * Kart bugün çizilmiyor (Kaan'ın sayfa hedefi boş) ama hedef konulduğu an aynı
 * yanlış öğüdü verecekti: "tempo artmalı".
 *
 * TEK KAYNAK: pencere ve Poisson aralığı çekirdekten (`window.__tempo`) okunur.
 * v63 dersi — iki kopya iki farklı "yıl sonunda ~N" üretir.
 *
 * SAYFADA BELİRSİZLİĞİN KAYNAĞI KİTAP SAYISI: sayfalar bağımsız olay değil,
 * kitap uzunluğu taşıyor. Poisson aralığı kitap sayımına uygulanıp pencerenin
 * ortalama kitap kalınlığıyla ölçeklenir.
 */
const { test, expect, tohumla, sahteKitap, rafAc } = require('./yardim');

const SAAT = '2026-09-08T12:00:00';
const bitmis = (ad, bitis, sayfa) => sahteKitap({ ad, durum: 'bitti', bitisTarihi: bitis, sayfa });

/* Kaan'ın 2026 şekli: ilk yarı boş, son 60 günde 6 kitap (her biri 300 sayfa) */
const RAF = [
  bitmis('E1', '2026-06-23', 300), bitmis('E2', '2026-06-24', 300),
  bitmis('E3', '2026-06-25', 300), bitmis('E4', '2026-06-25', 300),
  bitmis('E5', '2026-07-07', 300), bitmis('E6', '2026-07-08', 300),
  bitmis('Y1', '2026-08-14', 300), bitmis('Y2', '2026-08-21', 300),
  bitmis('Y3', '2026-08-31', 300), bitmis('Y4', '2026-09-01', 300),
  bitmis('Y5', '2026-09-04', 300), bitmis('Y6', '2026-09-07', 300)
];

async function kur(page, hedefSayfa) {
  await page.clock.setFixedTime(new Date(SAAT));
  await tohumla(page, { kitaplar: RAF, hedef: {}, hedefSayfa: hedefSayfa ? { 2026: hedefSayfa } : {} });
  await rafAc(page);
  await page.click('.nav-btn[data-act="sekme"][data-v="ist"]');
}
const durum = page => page.evaluate(() => window.__zeka.sayfaHedefDurum
  ? window.__zeka.sayfaHedefDurum() : null);

test.describe('G116 sayfa hedefi tempo (v124)', () => {

  test('A) ölü dönem paydaya GİRMEZ — eski formülden farklı sayı üretir', async ({ page }) => {
    await kur(page, 6000);
    const t = await page.evaluate(() => {
      const el = document.getElementById('zkSayfaTempo');
      return el ? el.textContent.replace(/\s+/g, ' ') : null;
    });
    /* 12 kitap x 300 = 3.600 sayfa. Eski formül: 3600/251*365 = 5.235.
       Yeni: 3600 + (6x300/60)x114 = 3600 + 3420 = 7.020. */
    expect(t).toContain('3.600 / 6.000');
    expect(t).toContain('Son 60 günde 1.800 sayfa');
    expect(t).toContain('günde 30');
    expect(t).toContain('~7.020');
    expect(t).not.toContain('5.235');
  });

  test('B) pencere ve aralık ÇEKİRDEKTEN okunur (kopya matematik yok)', async ({ page }) => {
    await kur(page, 6000);
    const paylasim = await page.evaluate(() => ({
      varMi: !!window.__tempo,
      gun: window.__tempo ? window.__tempo.pencereGun() : null,
      pencereKitap: window.__tempo ? window.__tempo.pencereKitaplari().length : null,
      /* çekirdeğin kitap hedefi de AYNI pencereyi görmeli */
      cekirdekPencere: tempoDurum().pencereN
    }));
    expect(paylasim.varMi).toBe(true);
    expect(paylasim.gun).toBe(60);
    expect(paylasim.pencereKitap).toBe(6);
    expect(paylasim.cekirdekPencere).toBe(6);
  });

  test('C) üç durum: üstünde / belirsiz / altında', async ({ page }) => {
    /* zeka.js kartı yuvaya istCiz() SONRASI dolduruyor — metin anlık okunursa
       bir önceki hedefin cümlesi yakalanabiliyor (tam pakette kırmızı verdi).
       expect.poll yeni cümleyi bekler. */
    const oku = () => page.evaluate(() => {
      const el = document.getElementById('zkSayfaTempo');
      return el ? el.textContent.replace(/\s+/g, ' ') : '';
    });
    await kur(page, 3000);                       // zaten 3.600 okunmuş
    await expect.poll(oku).toContain('hedefin üstünde');

    await page.evaluate(() => { veri.hedefSayfa[2026] = 7000; depoKaydet(); istCiz(); });
    await expect.poll(oku).toContain('~7.020');
    const bel = await oku();
    expect(bel).not.toContain('hedefin üstünde');
    expect(bel).not.toContain('yetişmez');

    await page.evaluate(() => { veri.hedefSayfa[2026] = 40000; depoKaydet(); istCiz(); });
    await expect.poll(oku).toContain('yetişmez');
  });

  test('D) "tempo artmalı" emri KALKTI, yerine gerekli günlük sayfa', async ({ page }) => {
    await kur(page, 7000);
    const t = await page.evaluate(() => {
      const el = document.getElementById('zkSayfaTempo');
      return el ? el.textContent.replace(/\s+/g, ' ') : '';
    });
    expect(t).not.toContain('tempo artmalı');
    expect(t).toContain('kalan 114 günde');
    expect(t).toContain('3.400 sayfa');          // 7000 - 3600
    expect(t).toContain('günde 30');
  });

  test('E) hedefin üstündeyken gerekli satır ÇIKMAZ', async ({ page }) => {
    await kur(page, 3000);
    await expect(page.locator('#zkSayfaGerekBr')).toHaveCount(0);
  });

  test('F) sayfa hedefi yoksa kart davet metnini korur (davranış değişmedi)', async ({ page }) => {
    await kur(page, 0);
    await expect(page.locator('#zkSayfaHedefKart')).toContainText('Sayfa hedefi koyarsan');
    await expect(page.locator('#zkSayfaTempo')).toHaveCount(0);
  });

});
