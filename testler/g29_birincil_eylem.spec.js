'use strict';
/* G29 — Birincil eylem tekliği: her durumda ve her pencerede aynı anda
   GÖRÜNÜR en fazla BİR .btn-brass. Sayımlar görünürlük-bilinçli (:visible):
   katlanmış <details> içindekiler ve display:none olanlar sayılmaz.
   Eklentiler (oturum/katalog/senkron) kendi düğmelerini enjekte ettiği için
   sayım her vakada enjeksiyon OTURDUKTAN sonra yapılır. */
const { test, expect, tohumla, sahteKitap,
  kameraTaklit, rafAc, ayarlarAc } = require('./yardim');

function okunuyorK(ek) {
  return sahteKitap(Object.assign({ ad: 'Okunan', durum: 'okunuyor', sayfa: 300,
    guncelSayfa: 100, baslamaTarihi: '2026-01-01' }, ek || {}));
}
async function detayAcVeBekle(page) {
  await page.click('#liste .kart');
  await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
  await expect(page.locator('#oturumBlok')).toBeVisible();  // eklenti enjeksiyonu otursun
}
function gorunurBrass(page, kapsam) {
  return page.locator(kapsam + ' .btn-brass:visible');
}

test.describe('G29 — detayda durum başına tek birincil', () => {

  test('okunacak: tek pirinç = "Okumaya başla" (çekirdek); oturum düğmesi çerçeveli', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Bekleyen' })]);
    await rafAc(page);
    await detayAcVeBekle(page);
    await expect(gorunurBrass(page, '#detayIcerik')).toHaveCount(1);
    await expect(gorunurBrass(page, '#detayIcerik').first()).toHaveAttribute('data-act', 'baslat');
    await expect(page.locator('#oturumBlok [data-act="oturum-basla"]')).toHaveClass(/btn-cerceve/);
  });

  /* v45 birincil tablosu: okunuyor → "Sayfa işaretle" (ilerleme-kaydet);
     oturum başlatma artık HER durumda çerçeveli (oturum.js). */
  test('okunuyor (oturum yok): tek pirinç = Sayfa işaretle; oturum/Bitirdim/Ekle çerçeveli', async ({ page }) => {
    await tohumla(page, [okunuyorK()]);
    await rafAc(page);
    await detayAcVeBekle(page);
    await expect(gorunurBrass(page, '#detayIcerik')).toHaveCount(1);
    await expect(gorunurBrass(page, '#detayIcerik').first()).toHaveAttribute('data-act', 'ilerleme-kaydet');
    await expect(page.locator('#oturumBlok [data-act="oturum-basla"]')).toHaveClass(/btn-cerceve/);
    await expect(page.locator('#detayIcerik [data-act="bitir"]')).toHaveClass(/btn-cerceve/);
    await expect(page.locator('#detayIcerik [data-act="not-ekle"]')).toHaveClass(/btn-cerceve/);
  });

  test('okunuyor (oturum açık): tek pirinç = oturum Bitir', async ({ page }) => {
    await tohumla(page, [okunuyorK()]);
    await rafAc(page);
    await detayAcVeBekle(page);
    await page.click('[data-act="oturum-basla"]');
    await expect(page.locator('#oturumBlok [data-act="oturum-bitir"]')).toBeVisible();
    await expect(gorunurBrass(page, '#detayIcerik')).toHaveCount(1);
    await expect(gorunurBrass(page, '#detayIcerik').first()).toHaveAttribute('data-act', 'oturum-bitir');
  });

  test('yarim: tek pirinç = "Devam et"', async ({ page }) => {
    await tohumla(page, [okunuyorK({ durum: 'yarim', bitisTarihi: '2026-02-01' })]);
    await rafAc(page);
    await detayAcVeBekle(page);
    await expect(gorunurBrass(page, '#detayIcerik')).toHaveCount(1);
    await expect(gorunurBrass(page, '#detayIcerik').first()).toHaveAttribute('data-act', 'baslat');
  });

  /* v45 birincil tablosu: bitti → "Yeniden oku" altın kontur; puan şeridi
     yine formsuz puanlama yüzeyi olarak üstte durur. */
  test('bitti: tek pirinç = Yeniden oku; puan şeridi görünür', async ({ page }) => {
    await tohumla(page, [okunuyorK({ durum: 'bitti', guncelSayfa: 300,
      bitisTarihi: '2026-02-01', puan: null })]);
    await rafAc(page);
    await detayAcVeBekle(page);
    await expect(gorunurBrass(page, '#detayIcerik')).toHaveCount(1);
    await expect(gorunurBrass(page, '#detayIcerik').first()).toHaveAttribute('data-act', 'yeniden-oku');
    await expect(page.locator('#dPuan')).toBeVisible();
  });

  test('ödünç VERİSİ olan eski kitapta çökme yok, pirinç sayısı değişmez (ödünç UI v40\'ta yok)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Ödünçte', odunc:
      [{ kisi: 'Ali', verilis: '2026-08-01', donus: null }] })]);
    await rafAc(page);
    await detayAcVeBekle(page);
    await expect(gorunurBrass(page, '#detayIcerik')).toHaveCount(1);   // yalnız baslat
    await expect(page.locator('[data-act="odunc-al"]')).toHaveCount(0); // GÖÇ: UI söküldü
  });
});

test.describe('G29 — pencere başına tek birincil', () => {

  test('form: tek pirinç = Kaydet', async ({ page }) => {
    await tohumla(page, []);
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await expect(page.locator('#ortuForm')).toHaveClass(/acik/);
    await expect(gorunurBrass(page, '#ortuForm')).toHaveCount(1);
    await expect(gorunurBrass(page, '#ortuForm').first()).toHaveAttribute('data-act', 'form-kaydet');
  });

  test('barkod penceresi: tek pirinç = Bul', async ({ page }) => {
    await kameraTaklit(page);
    await tohumla(page, []);
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await page.click('[data-act="barkod-ac"]');
    await expect(page.locator('#barkodOrtu')).toHaveClass(/acik/);
    await expect(gorunurBrass(page, '#barkodOrtu')).toHaveCount(1);
    await expect(gorunurBrass(page, '#barkodOrtu').first()).toHaveAttribute('data-act', 'barkod-elle');
  });

  test('seri tarama penceresi: tek pirinç = Taramayı bitir', async ({ page }) => {
    await kameraTaklit(page);
    await tohumla(page, []);
    await rafAc(page);
    await ayarlarAc(page);
    await page.click('#ortuAyar [data-act="seri-ac"]');
    await expect(page.locator('#seriOrtu')).toHaveClass(/acik/);
    await expect(gorunurBrass(page, '#seriOrtu')).toHaveCount(1);
    await expect(gorunurBrass(page, '#seriOrtu').first()).toHaveAttribute('data-act', 'seri-kapat');
  });

  test('toplu işlem penceresi: tek pirinç = Uygula', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Toplu Kitap' })]);
    await rafAc(page);
    await page.click('#secimBtn');
    await page.click('[data-act="toplu-tumu"]');
    await page.click('[data-act="toplu-durum"]');
    await expect(page.locator('#topluOrtu')).toBeVisible();
    await expect(gorunurBrass(page, '#topluOrtu')).toHaveCount(1);
    await expect(gorunurBrass(page, '#topluOrtu').first()).toHaveAttribute('data-act', 'toplu-durum-uygula');
  });

  test('gelen alıntı penceresi: tek pirinç = Kitaba kaydet', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Hedef' })]);
    await page.goto('/index.html?text=' + encodeURIComponent('Paylaşılan cümle.'));
    await expect(page.locator('#ortuGelen')).toHaveClass(/acik/);
    await expect(gorunurBrass(page, '#ortuGelen')).toHaveCount(1);
    await expect(gorunurBrass(page, '#ortuGelen').first()).toHaveAttribute('data-act', 'gelen-kaydet');
  });

  test('alıntı kartı önizleme: tek pirinç = PNG indir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Alıntılı', notlar:
      [{ id: 'n1', tip: 'alinti', metin: 'Bir cümle.', tarih: '2026-08-01', sayfa: 5 }] })]);
    await rafAc(page);
    await page.click('#liste .kart');
    await page.click('#detayIcerik [data-act="alinti-kart"]');
    await expect(page.locator('#kartOrtu')).toHaveClass(/acik/);
    await expect(gorunurBrass(page, '#kartOrtu')).toHaveCount(1);
    await expect(gorunurBrass(page, '#kartOrtu').first()).toHaveAttribute('data-act', 'kart-indir');
  });

  test('öneri paneli: .btn-brass yok (kendi on-btn sınıfları)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Önerilecek' })]);
    await rafAc(page);
    await page.click('[data-act="on-ac"]');
    await expect(page.locator('#ortuOneri')).toHaveClass(/acik/);
    await expect(gorunurBrass(page, '#ortuOneri')).toHaveCount(0);
  });

  test('yedek sekmesi: tek pirinç = JSON indir (md/CSV/seri/senkron çerçeveli)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Yedeklik' })]);
    await rafAc(page);
    await ayarlarAc(page);
    // eklenti kartları (senkron + katalog) enjekte olsun
    await expect(page.locator('#senkronKart')).toBeVisible();
    await expect(page.locator('#katalogKart')).toBeVisible();
    await expect(gorunurBrass(page, '#ortuAyar')).toHaveCount(1);
    await expect(gorunurBrass(page, '#ortuAyar').first()).toHaveAttribute('data-act', 'disa-aktar');
  });
});
