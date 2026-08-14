'use strict';
/* G59 — YERLEŞİK TÜR LİSTESİ (v70): Kaan'ın 242 kayıtlık listesi uygulamayla
   gelir (veri/turler-yerlesik.json), Ayarlar'daki "Hazır listeyi uygula" onu
   v67 dosya-seçici borusunun AYNISINDAN geçirir (turIceOku'ya fetch Response
   verilir — kopya mantık yok).

   SÖZLEŞMELER (bu dosyanın koruduğu):
   - Yerleşik dosya: {surum:1, tur:[{ad,yazar,tur}]}, tam 242 kayıt, alanlar
     birebir korunmuş (çoklu boşluk dahil — kullanıcının verisi böyle).
   - Dosya sw ASSETS'te (çevrimdışı okunur) ve sunucudan servis edilir.
   - "Hazır listeyi uygula" ÖNİZLEME açar; onaysız TEK BAYT yazılmaz.
   - Onay → eşleşen kitapların türü yazılır + k.g damgası; YALNIZ tür değişir.
   - Taksonomi kapısı ve eşleşmeyen-rapor dosya-seçicidekiyle birebir çalışır.
   - Dosya erişilemezse dürüst mesaj, sıfır yazım.
   (Mutasyon: önizleme atlanıp doğrudan yazılırsa → "onaysız tek bayt yok"
    vakası kırmızı.) */
const { test, expect, tohumla, sahteKitap, ayarlarAc } = require('./yardim');
const YERLESIK = require('../veri/turler-yerlesik.json');

const TIYATRO_TAKSONOMI = [{ seo: 'Tiyatro', ad: 'Tiyatro', kitapSayisi: 1200 }];

async function hazirUygulaAc(page) {
  await ayarlarAc(page);
  await page.click('[data-act="zg-tur-hazir"]');
}

test.describe('G59 yerleşik tür listesi', () => {

  test('yerleşik dosya sözleşmesi: 242 kayıt, biçim geçerli, alanlar birebir korunmuş', async () => {
    expect(YERLESIK.surum).toBe(1);
    expect(Array.isArray(YERLESIK.tur)).toBe(true);
    expect(YERLESIK.tur.length).toBe(242);
    for (const r of YERLESIK.tur) {
      expect(typeof r.ad, r.ad).toBe('string');
      expect(r.ad.trim().length).toBeGreaterThan(0);
      expect(typeof r.yazar).toBe('string');
      expect(r.yazar.trim().length).toBeGreaterThan(0);
      expect(typeof r.tur).toBe('string');
      expect(r.tur.trim().length).toBeGreaterThan(0);
    }
    // kullanıcının verisindeki çoklu boşluk AYNEN duruyor (normalize edilmedi)
    const webster = YERLESIK.tur.find(r => r.yazar.includes('Webster'));
    expect(webster.yazar).toBe('John      Webster');
    // örnekleme: bilinen kayıtlar bilinen türde
    expect(YERLESIK.tur.find(r => r.ad === 'Hamlet').tur).toBe('Tiyatro');
    expect(YERLESIK.tur.find(r => r.ad === 'Bira').tur).toBe('Hobi');
  });

  test('dosya sw ASSETS listesinde ve sunucudan servis ediliyor', async ({ page }) => {
    const fs = require('fs'), path = require('path');
    const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
    expect(sw).toContain("'./veri/turler-yerlesik.json'");
    await tohumla(page, []);
    await page.goto('/');
    const sonuc = await page.evaluate(() =>
      fetch('veri/turler-yerlesik.json').then(r => r.ok ? r.json() : null).catch(() => null));
    expect(sonuc && sonuc.tur.length, 'sunucu dosyayı servis ediyor').toBe(242);
  });

  test('"Hazır listeyi uygula" önizleme açar; onaysız TEK BAYT yazılmaz', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Hamlet', yazar: 'William Shakespeare' }),
      sahteKitap({ ad: 'Persler', yazar: 'Aeschylus' })]);
    page.__agAyar.turler = TIYATRO_TAKSONOMI;
    await page.goto('/');
    await hazirUygulaAc(page);
    // önizleme açık, özet dosyadan türetilen GERÇEK sayıları söylüyor
    await expect(page.locator('#zgTurIceOrtu .zg-ozet')).toContainText('2');
    await expect(page.locator('#zgTurIceOrtu .zg-ozet')).toContainText('boş tür dolacak');
    // onay YOKKEN bellek + depo el değmemiş
    const turler = await page.evaluate(() => veri.kitaplar.map(k => k.tur));
    expect(turler).toEqual(['', '']);
    const depo = await page.evaluate(() => JSON.parse(localStorage.getItem('kk_kitaplik_v1')));
    expect(depo.kitaplar.map(k => k.tur)).toEqual(['', '']);
  });

  test('onaydan sonra eşleşenlerin türü yazılır + damga; YALNIZ tür değişir', async ({ page }) => {
    const persler = sahteKitap({ ad: 'Persler', yazar: 'Aeschylus', durum: 'bitti', puan: 8,
      sayfa: 90, bitisTarihi: '2026-04-01', guncelSayfa: 90,
      notlar: [{ id: 'n1', tip: 'alinti', metin: 'koro', t: 1754000000000 }] });
    await tohumla(page, [persler, sahteKitap({ ad: 'Hamlet', yazar: 'William Shakespeare' })]);
    page.__agAyar.turler = TIYATRO_TAKSONOMI;
    await page.goto('/');
    const once = await page.evaluate(() => JSON.parse(JSON.stringify(veri.kitaplar[0])));
    await hazirUygulaAc(page);
    await page.click('[data-act="zg-tur-uygula"]');
    await expect(page.locator('#toast')).toContainText('2 kitabın türü dosyadan yazıldı');
    const sonra = await page.evaluate(() => JSON.parse(JSON.stringify(veri.kitaplar[0])));
    expect(sonra.tur).toBe('Tiyatro');
    expect(sonra.g, 'senkron damgası').toBeGreaterThan(0);
    // tur + g dışında HER alan birebir (puan/sayfa/durum/notlar/bitisTarihi korundu)
    for (const alan of Object.keys(once)) {
      if (alan === 'tur' || alan === 'g') continue;
      expect(JSON.stringify(sonra[alan]), 'alan bozulmadı: ' + alan).toBe(JSON.stringify(once[alan]));
    }
  });

  test('taksonomi kapısı + eşleşmeyen raporu dosya-seçici borusuyla birebir', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Hamlet', yazar: 'William Shakespeare' }),
      sahteKitap({ ad: 'Persler', yazar: 'Aeschylus' })]);
    page.__agAyar.turler = TIYATRO_TAKSONOMI;   // yalnız Tiyatro tanınıyor
    await page.goto('/');
    await hazirUygulaAc(page);
    // dosyadan bağımsız hesap: beklentiler yerleşik dosyanın kendisinden türetilir
    const tiyatroN = YERLESIK.tur.filter(r => r.tur === 'Tiyatro').length;
    const ozet = page.locator('#zgTurIceOrtu .zg-ozet');
    await expect(ozet).toContainText((tiyatroN - 2) + ' kayıt kütüphanede bulunamadı');
    await expect(ozet).toContainText((YERLESIK.tur.length - tiyatroN) + ' kayıt taksonomi dışı');
    // rapor ayrıntısı: tanınmayan tür adıyla listelenir ("Hobi" taksonomide yok)
    await page.click('#zgTurIceOrtu details:has-text("Taksonomi dışı") summary');
    await expect(page.locator('#zgTurIceOrtu')).toContainText('tanınmayan tür: Hobi');
  });

  test('dosya erişilemezse dürüst mesaj, sıfır yazım', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Hamlet', yazar: 'William Shakespeare' })]);
    page.__agAyar.turler = TIYATRO_TAKSONOMI;
    await page.route('**/veri/turler-yerlesik.json', r => r.fulfill({ status: 404, body: '' }));
    await page.goto('/');
    await hazirUygulaAc(page);
    await expect(page.locator('#toast')).toContainText('Hazır liste okunamadı');
    await expect(page.locator('#zgTurIceOrtu')).toHaveCount(0);
    const tur = await page.evaluate(() => veri.kitaplar[0].tur);
    expect(tur).toBe('');
  });
});
