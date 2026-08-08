'use strict';
const { test, expect, tohumla, sahteKitap,
  onaylariKabulEt, rafAc, rafYenile, ayarlarAc, ayrintilarAc } = require('./yardim');

/* G23 — kendi kapak fotoğrafı (kapak.js, kp- ad alanı)
   Fotoğraflar IndexedDB'de (kk_kapak_v1), localStorage ve senkron gövdesine girmez;
   kitap kaydında yalnız kapakYerel işareti durur. Öncelik: yerel > uzak > sırt. */

const UZAK_KAPAK = 'https://covers.openlibrary.org/b/id/240727-M.jpg';

/* Sayfada küçük bir JPEG blob üretip doğrudan IndexedDB'ye yazar (fixture). */
async function blobEk(page, id) {
  await page.evaluate(async kid => {
    const c = document.createElement('canvas'); c.width = 40; c.height = 60;
    const x = c.getContext('2d'); x.fillStyle = '#833355'; x.fillRect(0, 0, 40, 60);
    const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.7));
    await window.__kapak.yaz(kid, b);
  }, id);
}

/* Telefon çekimini taklit eden BÜYÜK sahte görsel (gradyan + yazı) — base64 JPEG. */
async function buyukGorselB64(page, w, h) {
  return page.evaluate(([gw, gh]) => {
    const c = document.createElement('canvas'); c.width = gw; c.height = gh;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, gw, gh);
    g.addColorStop(0, '#8a2b1a'); g.addColorStop(0.5, '#e8d9a0'); g.addColorStop(1, '#1a3a5c');
    x.fillStyle = g; x.fillRect(0, 0, gw, gh);
    x.fillStyle = '#fff'; x.font = 'bold 220px serif';
    x.fillText('KAPAK', 80, Math.round(gh / 2));
    return c.toDataURL('image/jpeg', 0.92).split(',')[1];
  }, [w, h]);
}

/* data-act tetikleyicisine tıklayıp dosya seçiciye sahte fotoğrafı verir. */
async function fotoSec(page, tetikSecici, b64) {
  const [secici] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click(tetikSecici)
  ]);
  await secici.setFiles({ name: 'kapak.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(b64, 'base64') });
  await expect(page.locator('#ortuKapak')).toHaveClass(/acik/);
}

async function idbAnahtarlari(page) {
  return page.evaluate(() => window.__kapak.anahtarlar());
}

test.describe('G23 kendi kapak fotoğrafı', () => {

  test('kapakYerel alanı yenilemede KORUNUR; eski kayıtta false varsayılır', async ({ page }) => {
    const a = sahteKitap({ ad: 'Yerel Kapaklı', kapakYerel: true });
    const eski = sahteKitap({ ad: 'Eski Kayıt' });
    delete eski.kapakYerel; // alanı hiç görmemiş eski kayıt
    await tohumla(page, [a, eski]);
    await rafAc(page);
    let d = await page.evaluate(() => veri.kitaplar.map(k => k.kapakYerel));
    expect(d).toEqual([true, false]);
    await rafYenile(page);
    d = await page.evaluate(() => veri.kitaplar.map(k => k.kapakYerel)); // kitapNormalize elemedi
    expect(d).toEqual([true, false]);
  });

  test('fotoğraf IndexedDB\'ye yazılır, localStorage BÜYÜMEZ (ölçümle)', async ({ page }) => {
    const k = sahteKitap({ ad: 'Barkodsuz Eski Baskı' });
    await tohumla(page, [k]);
    await rafAc(page);
    // ölçümden önce bir kayıt turu: normalize edilmiş halin uzunluğu taban olsun
    await page.evaluate(() => depoKaydet());
    const ls1 = await page.evaluate(() => localStorage.getItem('kk_kitaplik_v1').length);

    await page.click('#liste .kart');
    const b64 = await buyukGorselB64(page, 3000, 2000);
    await fotoSec(page, '#detayIcerik [data-act="kp-cek"]', b64);
    await page.click('#ortuKapak [data-act="kp-onay"]');
    await expect(page.locator('#toast')).toContainText('Kapak fotoğrafı kaydedildi');

    const blobBoyu = await page.evaluate(async kid =>
      (await window.__kapak.oku(kid)).size, k.id);
    expect(blobBoyu).toBeGreaterThan(1000); // fotoğraf gerçekten IndexedDB'de
    const ls2 = await page.evaluate(() => localStorage.getItem('kk_kitaplik_v1').length);
    console.log(`[ÖLÇÜM] localStorage: önce ${ls1} B, sonra ${ls2} B (fark ${ls2 - ls1} B) — IDB blob ${blobBoyu} B`);
    expect(ls2 - ls1).toBeLessThan(500);           // yalnız işaret + damga; fotoğraf değil
    expect(ls2 - ls1).toBeLessThan(blobBoyu / 10); // LS büyümesi fotoğrafın kırıntısı bile değil
    expect(await page.evaluate(() => veri.kitaplar[0].kapakYerel)).toBe(true);
  });

  test('işlenmiş fotoğraf 60 KB altında ve en uzun kenar ≤600px (3000×2000 girdi)', async ({ page }) => {
    await tohumla(page, []);
    await rafAc(page);
    const b64 = await buyukGorselB64(page, 3000, 2000);
    const s = await page.evaluate(async veriB64 => {
      const cevap = await fetch('data:image/jpeg;base64,' + veriB64);
      const ham = await cevap.blob();
      const sonuc = await window.__kapak.islet(ham);
      const bmp = await createImageBitmap(sonuc.blob);
      return { hamBoyut: ham.size, boyut: sonuc.blob.size, en: sonuc.en, boy: sonuc.boy,
        gercekEn: bmp.width, gercekBoy: bmp.height, tip: sonuc.blob.type };
    }, b64);
    console.log(`[ÖLÇÜM] işleme: ${s.hamBoyut} B (3000×2000) → ${s.boyut} B (${s.en}×${s.boy}, ${s.tip})`);
    expect(s.boyut).toBeLessThan(60 * 1024);
    expect(Math.max(s.en, s.boy)).toBeLessThanOrEqual(600);
    expect(s.gercekEn).toBe(s.en);
    expect(s.gercekBoy).toBe(s.boy);
    expect(s.tip).toBe('image/jpeg');
    expect(Math.abs(s.en / s.boy - 1.5)).toBeLessThan(0.02); // en-boy oranı korunur
  });

  test('kapak önceliği: yerel fotoğraf > uzak URL > sırt (ızgara)', async ({ page }) => {
    const a = sahteKitap({ ad: 'Yerel Öncelikli', kapakYerel: true, kapak: UZAK_KAPAK });
    const b = sahteKitap({ ad: 'Yalnız Uzak', kapak: UZAK_KAPAK });
    const c = sahteKitap({ ad: 'Kapaksız Sırtlı' });
    await tohumla(page, [a, b, c], { kk_gorunum_v1: { izgara: true, rafGrupla: false } });
    await rafAc(page);
    await blobEk(page, a.id);
    await page.evaluate(() => hepsiniCiz()); // blob artık hazır — kartları tazele
    // A: yerel blob kazanır (uzak URL'si de olduğu hâlde)
    await expect(page.locator(`#liste .kart[data-id="${a.id}"] img[data-kp-id]`))
      .toHaveAttribute('src', /^blob:/);
    // B: yerel yok → uzak URL
    await expect(page.locator(`#liste .kart[data-id="${b.id}"] img.iz-kapak`))
      .toHaveAttribute('src', /covers\.openlibrary\.org/);
    // C: ikisi de yok → sırt görseli
    await expect(page.locator(`#liste .kart[data-id="${c.id}"] .iz-yedek`)).toHaveCount(1);
  });

  test('yerel işaret var ama blob yok → uzağa, o da yoksa sırta düşer', async ({ page }) => {
    const d = sahteKitap({ ad: 'İşaretli Uzaklı', kapakYerel: true, kapak: UZAK_KAPAK });
    const e = sahteKitap({ ad: 'İşaretli Çıplak', kapakYerel: true });
    await tohumla(page, [d, e], { kk_gorunum_v1: { izgara: true, rafGrupla: false } });
    await rafAc(page);
    // D: IndexedDB boş → data-kp-yedek (uzak) devreye girer
    await expect(page.locator(`#liste .kart[data-id="${d.id}"] img[data-kp-id]`))
      .toHaveAttribute('src', /covers\.openlibrary\.org/);
    // E: uzak da yok → hata zinciri sırt görseline düşürür
    await expect(page.locator(`#liste .kart[data-id="${e.id}"] .iz-yedek`)).toHaveCount(1);
  });

  test('kitap silinince fotoğrafı da silinir (IndexedDB\'de kalmaz)', async ({ page }) => {
    onaylariKabulEt(page);
    const k = sahteKitap({ ad: 'Silinecek Fotoğraflı', kapakYerel: true });
    await tohumla(page, [k]);
    await rafAc(page);
    await blobEk(page, k.id);
    expect(await idbAnahtarlari(page)).toEqual([k.id]);
    await page.click('#liste .kart');
    await page.click('#dDigerKatla summary');  // Sil nadir bölümde katlı
    await page.click('#detayIcerik [data-act="kitap-sil"]');
    await expect(page.locator('#toast')).toContainText('Kitap silindi');
    await expect.poll(() => idbAnahtarlari(page)).toEqual([]);
  });

  test('toplu silmede fotoğraflar da silinir', async ({ page }) => {
    onaylariKabulEt(page);
    const a = sahteKitap({ ad: 'Toplu Silinen A', kapakYerel: true });
    const b = sahteKitap({ ad: 'Toplu Silinen B', kapakYerel: true });
    await tohumla(page, [a, b]);
    await rafAc(page);
    await blobEk(page, a.id);
    await blobEk(page, b.id);
    expect((await idbAnahtarlari(page)).length).toBe(2);
    await page.click('#secimBtn');
    await page.click('[data-act="toplu-tumu"]');
    await page.click('[data-act="toplu-sil"]');
    await expect(page.locator('#toast')).toContainText('2 kitap silindi');
    await expect.poll(() => idbAnahtarlari(page)).toEqual([]);
  });

  test('fotoğraf senkron PUT gövdesine girmez; kapakYerel işareti girer (ölçümle)', async ({ page }) => {
    let putGovde = null;
    // agTaklit'ten SONRA kayıt: bu adresler için bu yönlendirici kazanır
    await page.route('**/identitytoolkit.googleapis.com/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ idToken: 'sahte-token', refreshToken: 'sahte-yenile' }) }));
    await page.route('**/*firebasedatabase.app/**', route => {
      if (route.request().method() === 'PUT') putGovde = route.request().postData();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    const k = sahteKitap({ ad: 'Senkronlu Fotoğraflı', kapakYerel: true, g: 5 });
    await tohumla(page, [k]);
    await rafAc(page);
    await blobEk(page, k.id);
    const sonuc = await page.evaluate(() => {
      window.__senkron.ayarKaydet({ oda: 'g23-test-odasi', cihaz: 'testcihaz', sonSenkron: null });
      return window.__senkron.senkronEt(true);
    });
    expect(sonuc).toBe(true);
    expect(putGovde).not.toBeNull();
    console.log(`[ÖLÇÜM] senkron PUT gövdesi: ${putGovde.length} B (1 kitap + 1 yerel fotoğraf varken)`);
    expect(putGovde).not.toContain('data:image');   // ikili veri yok
    expect(putGovde).not.toContain('blob:');
    expect(putGovde.length).toBeLessThan(3000);     // fotoğraf (~binlerce KB) sızsa patlardı
    const govde = JSON.parse(putGovde);
    expect(govde.kitaplar[0].kapakYerel).toBe(true); // işaret senkronlanır (birleşmede kaybolmasın)
    // birleşme sonrası bellekte de işaret durur
    expect(await page.evaluate(() => veri.kitaplar[0].kapakYerel)).toBe(true);
  });

  test('IndexedDB yoksa uygulama ÇÖKMEZ: liste çalışır, net mesaj görünür', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'indexedDB', { get: () => undefined, configurable: true });
    });
    const k = sahteKitap({ ad: 'Depo Bozukken Kitap' });
    await tohumla(page, [k]);
    await rafAc(page);
    await expect(page.locator('#liste .kart')).toHaveCount(1); // uygulama ayakta
    // yedek sekmesi: sayaç yerine net durum
    await ayarlarAc(page);
    await expect(page.locator('#kpDepoBilgi')).toContainText('Fotoğraf deposu açılamadı');
    // çekim akışı: işleme çalışır, kayıt anında net hata; uygulama yaşamaya devam eder
    await page.keyboard.press('Escape');   // Ayarlar penceresi: sekmeye dönmeden önce kapat
    await expect(page.locator('#ortuAyar')).not.toHaveClass(/acik/);
    await page.click('[data-act="sekme"][data-v="raf"]');
    await page.click('#liste .kart');
    const b64 = await buyukGorselB64(page, 800, 1200);
    await fotoSec(page, '#detayIcerik [data-act="kp-cek"]', b64);
    await page.click('#ortuKapak [data-act="kp-onay"]');
    await expect(page.locator('#toast')).toContainText('Fotoğraf kaydedilemedi');
    expect(await page.evaluate(() => veri.kitaplar[0].kapakYerel)).toBe(false); // işaret yazılmadı
    await expect(page.locator('#detayIcerik')).toBeVisible(); // detay hâlâ yerinde
  });

  test('"Tüm fotoğrafları sil" çalışır, sayaç sıfırlanır, işaretler düşer', async ({ page }) => {
    onaylariKabulEt(page);
    const a = sahteKitap({ ad: 'Temizlenecek A', kapakYerel: true });
    const b = sahteKitap({ ad: 'Temizlenecek B', kapakYerel: true });
    await tohumla(page, [a, b]);
    await rafAc(page);
    await blobEk(page, a.id);
    await blobEk(page, b.id);
    await ayarlarAc(page); // sekmeye geçiş sayacı tazeler
    await expect(page.locator('#kpDepoBilgi')).toContainText('2 fotoğraf');
    await page.click('#ortuAyar [data-act="kp-tum-sil"]');
    await expect(page.locator('#toast')).toContainText('Tüm kapak fotoğrafları silindi');
    await expect(page.locator('#kpDepoBilgi')).toContainText('0 fotoğraf');
    expect(await idbAnahtarlari(page)).toEqual([]);
    expect(await page.evaluate(() => veri.kitaplar.map(k => k.kapakYerel))).toEqual([false, false]);
    // işaret düşüşü kalıcı (localStorage'a da yazıldı)
    await rafYenile(page);
    expect(await page.evaluate(() => veri.kitaplar.map(k => k.kapakYerel))).toEqual([false, false]);
  });

  test('fotoğrafsız kitapta mevcut davranış değişmedi (regresyon)', async ({ page }) => {
    const uzakli = sahteKitap({ ad: 'Uzak Kapaklı', kapak: UZAK_KAPAK });
    const ciplak = sahteKitap({ ad: 'Kapaksız Kitap' });
    await tohumla(page, [uzakli, ciplak]);
    await rafAc(page);
    // liste görünümü (v42 Ciltli): uzak kapak levha içinde <img>, kapaksız
    // kitapta kesikli yer tutucu (p-bos) — kp izi YOK
    const uzakImg = page.locator(`#liste .kart[data-id="${uzakli.id}"] .plate > img`);
    await expect(uzakImg).toHaveAttribute('src', /covers\.openlibrary\.org/);
    expect(await uzakImg.getAttribute('data-kp-id')).toBeNull();
    await expect(page.locator(`#liste .kart[data-id="${ciplak.id}"] .plate.p-bos`)).toHaveCount(1);
    // detay: uzak kapak img'si eski davranışıyla durur
    await page.click(`#liste .kart[data-id="${uzakli.id}"]`);
    await expect(page.locator('#detayIcerik img.detay-kapak')).toHaveAttribute('src', /covers\.openlibrary\.org/);
    expect(await page.evaluate(() => veri.kitaplar.map(k => k.kapakYerel))).toEqual([false, false]);
  });

  test('JSON yedek fotoğrafı içermez, kapakYerel işaretini korur (KARAR: yedek küçük kalır)', async ({ page }) => {
    const fs = require('fs');
    const k = sahteKitap({ ad: 'Yedekli Fotoğraflı', kapakYerel: true });
    await tohumla(page, [k]);
    await rafAc(page);
    await blobEk(page, k.id);
    await ayarlarAc(page);
    const [indirme] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#ortuAyar .yedek-kart [data-act="disa-aktar"]')
    ]);
    const metin = fs.readFileSync(await indirme.path(), 'utf8');
    const icerik = JSON.parse(metin);
    expect(icerik.kitaplar[0].kapakYerel).toBe(true); // işaret yedekte (geri yüklemede korunur)
    expect(metin).not.toContain('data:image');        // fotoğrafın kendisi yedekte DEĞİL
    expect(metin.length).toBeLessThan(10000);
  });

  test('formdan fotoğraf: önizleme → onay → kayıtla birlikte yeni kitaba bağlanır', async ({ page }) => {
    await tohumla(page, []);
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await ayrintilarAc(page);
    await page.fill('#f-ad', 'Formdan Fotoğraflı');
    const b64 = await buyukGorselB64(page, 1600, 2400);
    await fotoSec(page, '#ortuForm [data-act="kp-form-cek"]', b64);
    await expect(page.locator('#kpOnizle')).toHaveAttribute('src', /^blob:/); // önizleme gösterildi
    await expect(page.locator('#kpBilgi')).toContainText('KB');
    await page.click('#ortuKapak [data-act="kp-onay"]');
    // onay kaydetmez: fotoğraf beklemede, şeritte görünür
    await expect(page.locator('#kpFormDurum')).toContainText('Fotoğraf hazır');
    expect(await idbAnahtarlari(page)).toEqual([]);
    await page.click('#ortuForm [data-act="form-kaydet"]');
    await expect(page.locator('#toast')).toContainText('Kitap rafa eklendi');
    await expect.poll(async () => page.evaluate(() =>
      veri.kitaplar[0] && veri.kitaplar[0].kapakYerel)).toBe(true);
    const id = await page.evaluate(() => veri.kitaplar[0].id);
    expect(await idbAnahtarlari(page)).toEqual([id]);
  });

  test('önizlemede Vazgeç hiçbir şey kaydetmez', async ({ page }) => {
    const k = sahteKitap({ ad: 'Vazgeçilen Kitap' });
    await tohumla(page, [k]);
    await rafAc(page);
    await page.click('#liste .kart');
    const b64 = await buyukGorselB64(page, 800, 1200);
    await fotoSec(page, '#detayIcerik [data-act="kp-cek"]', b64);
    await page.click('#ortuKapak [data-act="kp-vazgec"]');
    await expect(page.locator('#ortuKapak')).not.toHaveClass(/acik/);
    expect(await idbAnahtarlari(page)).toEqual([]);
    expect(await page.evaluate(() => veri.kitaplar[0].kapakYerel)).toBe(false);
  });

  test('detaydan "Fotoğrafı kaldır" hem işareti hem blobu siler', async ({ page }) => {
    onaylariKabulEt(page);
    const k = sahteKitap({ ad: 'Kaldırılacak Fotoğraflı', kapakYerel: true });
    await tohumla(page, [k]);
    await rafAc(page);
    await blobEk(page, k.id);
    await page.click('#liste .kart');
    await page.click('#detayIcerik [data-act="kp-detay-kaldir"]');
    await expect(page.locator('#toast')).toContainText('Kapak fotoğrafı silindi');
    await expect.poll(() => idbAnahtarlari(page)).toEqual([]);
    expect(await page.evaluate(() => veri.kitaplar[0].kapakYerel)).toBe(false);
    await rafYenile(page);
    expect(await page.evaluate(() => veri.kitaplar[0].kapakYerel)).toBe(false); // kalıcı
  });

  test('liste ve detay görünümünde yerel kapak blob olarak yüklenir', async ({ page }) => {
    const k = sahteKitap({ ad: 'Liste Detay Yerel', kapakYerel: true, kapak: UZAK_KAPAK });
    await tohumla(page, [k]); // varsayılan LİSTE görünümü (ızgara değil)
    await rafAc(page);
    await blobEk(page, k.id);
    await page.evaluate(() => hepsiniCiz());
    // liste kartı: yerel blob uzak URL'yi yener
    await expect(page.locator(`#liste .kart[data-id="${k.id}"] img[data-kp-id]`))
      .toHaveAttribute('src', /^blob:/);
    // detay: aynı öncelik
    await page.click(`#liste .kart[data-id="${k.id}"]`);
    await expect(page.locator('#detayIcerik img[data-kp-id]'))
      .toHaveAttribute('src', /^blob:/);
  });

  test('başka cihazın fotoğraf işareti bu cihazdan söndürülemez', async ({ page }) => {
    onaylariKabulEt(page);
    // senkrondan gelmiş durum: işaret true ama blob BU cihazda yok
    const k = sahteKitap({ ad: 'Uzak Cihaz Fotoğraflı', kapakYerel: true });
    await tohumla(page, [k]);
    await rafAc(page);
    await page.click('#liste .kart');
    await page.click('#detayIcerik [data-act="kp-detay-kaldir"]');
    await expect(page.locator('#toast')).toContainText('Fotoğraf bu cihazda değil');
    expect(await page.evaluate(() => veri.kitaplar[0].kapakYerel)).toBe(true); // işaret KORUNDU
    // formda da "fotoğrafı var" şeridi çıkmaz (Kaldır sunulmaz)
    await page.click('#dDigerKatla summary');  // Düzenle nadir bölümde katlı
    await page.click('#detayIcerik [data-act="duzenle"]');
    await page.waitForTimeout(150); // blob denetimi otursun
    await expect(page.locator('#kpFormDurum')).toBeHidden();
  });

  test('senkron göçü: yeni normalize alanı tüm kütüphaneyi yeniden damgalamaz (ANLIK_SURUM)', async ({ page }) => {
    // eski sürüm (s:2) parmak izi anlığıyla açılış = sürüm göçü: damga BASILMAZ,
    // yoksa bayat cihaz g=şimdi ile güncel cihazın düzenlemelerini ezerdi
    const k = sahteKitap({ ad: 'Göç Kitabı', g: 5 });
    await tohumla(page, [k], { kk_senkron_anlik_v1: { s: 2, p: { eskiId: 'x-yz' } } });
    await rafAc(page);
    await page.evaluate(() => depoKaydet()); // damgala göç turunda koşsun
    expect(await page.evaluate(() => veri.kitaplar[0].g)).toBe(5); // damga korundu
    const anlik = await page.evaluate(() => JSON.parse(localStorage.getItem('kk_senkron_anlik_v1')));
    expect(anlik.s).toBe(await page.evaluate(() => window.__senkron.ANLIK_SURUM)); // yeni sürümle yazıldı
    // ikinci tur (aynı sürüm): içerik değişmedi → damga yine değişmez
    await rafYenile(page);
    await page.evaluate(() => depoKaydet());
    expect(await page.evaluate(() => veri.kitaplar[0].g)).toBe(5);
  });

  test('500 kitaplık ızgarada kapaklar TEMBEL yüklenir: yalnız görünenler (ölçümle)', async ({ page }) => {
    test.slow(); // 500 blob tohumu + ölçüm
    const kitaplar = [];
    for (let i = 0; i < 500; i++) kitaplar.push(sahteKitap({ ad: 'Raf Kitabı ' + (i + 1), kapakYerel: true }));
    await tohumla(page, kitaplar, { kk_gorunum_v1: { izgara: true, rafGrupla: false } });
    await rafAc(page);
    // hepsine aynı küçük blobu yaz (tek tuval, 500 put)
    await page.evaluate(async idler => {
      const c = document.createElement('canvas'); c.width = 40; c.height = 60;
      c.getContext('2d').fillRect(0, 0, 40, 60);
      const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.7));
      for (const id of idler) await window.__kapak.yaz(id, b);
    }, kitaplar.map(k => k.id));
    const sure = await page.evaluate(() => {
      const t0 = performance.now();
      hepsiniCiz();
      return Math.round(performance.now() - t0);
    });
    await expect(page.locator('#liste .kart')).toHaveCount(500);
    await page.waitForTimeout(1500); // IntersectionObserver + IndexedDB okumaları otursun
    const say = await page.evaluate(() => ({
      toplam: document.querySelectorAll('img[data-kp-id]').length,
      dolu: document.querySelectorAll('img[data-kp-id][data-kp-dolu]').length,
      onbellek: window.__kapak.onbellekBoyu()
    }));
    console.log(`[ÖLÇÜM] 500 kitaplık ızgara: çizim ${sure} ms · ${say.toplam} karttan ${say.dolu} kapak yüklendi (önbellek ${say.onbellek})`);
    expect(say.toplam).toBeGreaterThanOrEqual(480);
    expect(say.dolu).toBeGreaterThan(0);        // görünürler yüklendi
    expect(say.dolu).toBeLessThan(300);         // ama HEPSİ BİRDEN değil
    expect(sure).toBeLessThan(3000);            // çizim bloklamıyor
  });
});
