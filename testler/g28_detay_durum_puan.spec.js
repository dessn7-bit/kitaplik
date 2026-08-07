'use strict';
/* G28 — Detay ekranı yeniden tasarımı: hiyerarşi (M1), durum eylemleri (M2),
   uygulama içi puanlama (M3), istatistik dürüstlüğü (M4).
   Sözleşme: birincil eylem üstte tek blok; ilerleme çubuğu detayda BİR kez;
   Sil/Düzenle + seri + geçmiş + ödünç katlanır nadir bölümlerde; puan şeridi
   form açmadan yazar; "en çok" iddiaları n>=2 eşiğine, ortalamalar görünür
   paydaya bağlı. */
const { test, expect, tohumla, sahteKitap,
  onaylariKabulEt, bugunISO, rafAc } = require('./yardim');

const YIL = new Date().getFullYear();

function okunuyorKitap(ek) {
  return sahteKitap(Object.assign({ ad: 'Sürüyor', durum: 'okunuyor', sayfa: 300,
    guncelSayfa: 120, baslamaTarihi: bugunISO(-10), g: 5 }, ek || {}));
}
function bittiKitap(ek) {
  return sahteKitap(Object.assign({ ad: 'Bitti Kitabı', durum: 'bitti', sayfa: 200,
    guncelSayfa: 200, baslamaTarihi: bugunISO(-30), bitisTarihi: bugunISO(-1), g: 5 }, ek || {}));
}
async function detayAc(page, id) {
  await page.click(id ? `#liste .kart[data-id="${id}"]` : '#liste .kart');
  await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
}

/* ==================== M1 — hiyerarşi ==================== */
test.describe('G28 M1 — detay hiyerarşisi', () => {

  test('ilerleme çubuğu detayda tam BİR kez çizilir', async ({ page }) => {
    await tohumla(page, [okunuyorKitap()]);
    await rafAc(page);
    await detayAc(page);
    await expect(page.locator('#detayIcerik .ilerleme')).toHaveCount(1);
    await expect(page.locator('#detayIcerik .ilerleme-txt')).toContainText('%40');
  });

  test('Sil ana yüzeyde değil: katlanır bölüm kapalı başlar, açınca çalışır', async ({ page }) => {
    onaylariKabulEt(page);
    await tohumla(page, [sahteKitap({ ad: 'Saklı Silinecek' })]);
    await rafAc(page);
    await detayAc(page);
    // kapalı: sil düğmesi görünmez ama DOM'da (nadir katman)
    await expect(page.locator('#detayIcerik [data-act="kitap-sil"]')).toBeHidden();
    expect(await page.locator('#dDigerKatla[open]').count()).toBe(0);
    await page.click('#dDigerKatla summary');
    await expect(page.locator('#detayIcerik [data-act="kitap-sil"]')).toBeVisible();
    await page.click('#detayIcerik [data-act="kitap-sil"]');
    await expect(page.locator('#toast')).toContainText('Kitap silindi');
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(0);
  });

  test('nadir bölümler (ödünç, düzenle) katlı başlar; ödünç formu sürekli açık değil', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Katlı' })]);
    await rafAc(page);
    await detayAc(page);
    expect(await page.locator('#dOduncKatla[open]').count()).toBe(0);
    await expect(page.locator('#d-odunc-kisi')).toBeHidden();
    // açınca ödünç verilebilir
    await page.click('#dOduncKatla summary');
    await page.fill('#d-odunc-kisi', 'Ali');
    await page.click('[data-act="odunc-ver"]');
    await expect(page.locator('#toast')).toContainText('Ali kitabı aldı');
    // aktif ödünç künye rozetinde ve katlanır başlıkta görünür (bilgi kaybolmaz)
    await expect(page.locator('#detayIcerik .detay-meta .r-odunc')).toContainText('Ali');
    await expect(page.locator('#dOduncKatla summary')).toContainText('Ödünçte: Ali');
  });

  test('kapak eylemi künyenin parçası: 📷 düğmesi kapak sütununda', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Kapaksız' })]);
    await rafAc(page);
    await detayAc(page);
    await expect(page.locator('#detayIcerik .d-kapak-sutun [data-act="kp-cek"]')).toBeVisible();
    // kapaksız kitapta yer tutucu var, künye boş kalmaz
    await expect(page.locator('#detayIcerik .d-kapak-yok')).toBeVisible();
  });
});

/* ==================== M2 — durum eylemleri ==================== */
test.describe('G28 M2 — durum eylemleri (form açmadan)', () => {

  test('(a) yarım bıraktım: sayfa KORUNUR, durum yarim, bırakma tarihi bugün', async ({ page }) => {
    await tohumla(page, [okunuyorKitap()]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="yarim-birak"]');
    await expect(page.locator('#toast')).toContainText('sf. 120');
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.durum).toBe('yarim');
    expect(k.guncelSayfa).toBe(120);            // nerede bıraktığı kaybolmaz
    expect(k.bitisTarihi).toBe(bugunISO());     // bırakma tarihi
    // detay yeni duruma döner: kaldığı yer + Devam et
    await expect(page.locator('#detayIcerik')).toContainText('Kaldığın yer: sf. 120');
    await expect(page.locator('#detayIcerik [data-act="baslat"]')).toContainText('Devam et');
    await expect(page.locator('#detayIcerik')).toContainText('Bırakma:');
  });

  test('(b) okunacağa geri al: onaylı; ilerleme/tarihler temizlenir, gsG basılır', async ({ page }) => {
    onaylariKabulEt(page);
    await tohumla(page, [okunuyorKitap()]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="okunacak-al"]');
    await expect(page.locator('#toast')).toContainText('Okunacaklara alındı');
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.durum).toBe('okunacak');
    expect(k.guncelSayfa).toBe(0);
    expect(k.baslamaTarihi).toBeNull();
    expect(k.bitisTarihi).toBeNull();
    expect(k.gsG).toBeGreaterThan(0);           // sayfa sıfırlama kasıtlı giriş
    await expect(page.locator('#detayIcerik [data-act="baslat"]')).toContainText('Okumaya başla');
  });

  test('(b2) yarımdan da okunacağa geri alınır, puan da temizlenir', async ({ page }) => {
    onaylariKabulEt(page);
    await tohumla(page, [okunuyorKitap({ durum: 'yarim', puan: 4, bitisTarihi: bugunISO(-2) })]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="okunacak-al"]');
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.durum).toBe('okunacak');
    expect(k.puan).toBeNull();
    expect(k.guncelSayfa).toBe(0);
  });

  test('(c) istatistik: detaydan yarım bırakılan kitap bırakma analizine düşer', async ({ page }) => {
    await tohumla(page, [bittiKitap(), okunuyorKitap({ ad: 'Bırakılacak' })]);
    await rafAc(page);
    await detayAc(page, await page.evaluate(() => veri.kitaplar[1].id));
    await page.click('[data-act="yarim-birak"]');
    await page.click('[data-act="detay-kapat"]');
    await page.click('[data-act="sekme"][data-v="ist"]');
    await expect(page.locator('#zkBirakmaKart')).toContainText('%50');
    await expect(page.locator('#zkBirakmaKart')).toContainText('1 bitti, 1 yarım kaldı');
    await expect(page.locator('#zkBirakmaKart')).toContainText('Bırakılacak');
    // rafta yarım filtresi de bulur
    await page.click('[data-act="sekme"][data-v="raf"]');
    await page.click('[data-act="filtre"][data-v="yarim"]');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste .kart')).toContainText('Bırakılacak');
  });

  test('(d) durum değişimi senkron damgası (k.g) basar', async ({ page }) => {
    await tohumla(page, [okunuyorKitap()]);
    await rafAc(page);
    await detayAc(page);
    const gOnce = await page.evaluate(() => veri.kitaplar[0].g);
    await page.click('[data-act="yarim-birak"]');
    const gSonra = await page.evaluate(() => veri.kitaplar[0].g);
    expect(gSonra).toBeGreaterThan(gOnce);
    // depoya da yazıldı
    const depo = await page.evaluate(() => JSON.parse(localStorage.getItem('kk_kitaplik_v1')));
    expect(depo.kitaplar[0].g).toBe(gSonra);
  });

  test('açık oturum varken yarım bırakılırsa oturum KAYDEDİLEREK kapanır', async ({ page }) => {
    await tohumla(page, [okunuyorKitap()]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="oturum-basla"]');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kk_oturum_v1')))).not.toBeNull();
    await page.click('[data-act="yarim-birak"]');
    // oturum kapandı, süre gerçek oturum olarak yazıldı, sayfa korundu
    expect(await page.evaluate(() => localStorage.getItem('kk_oturum_v1'))).toBeNull();
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect((k.oturumlar || []).length).toBe(1);
    expect(k.oturumlar[0].sup).toBeUndefined();  // süprüntü DEĞİL, gerçek oturum
    expect(k.guncelSayfa).toBe(120);
    expect(k.durum).toBe('yarim');
  });

  test('açık oturum varken okunacağa geri alınırsa oturum kaydedilmeden atılır', async ({ page }) => {
    onaylariKabulEt(page);
    await tohumla(page, [okunuyorKitap()]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="oturum-basla"]');
    await page.click('[data-act="okunacak-al"]');
    expect(await page.evaluate(() => localStorage.getItem('kk_oturum_v1'))).toBeNull();
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect((k.oturumlar || []).length).toBe(0);  // geri alma jesti: oturum sayılmaz
    expect(k.durum).toBe('okunacak');
  });

  test('bitir de açık oturumu kaydederek kapatır (eski boşluk)', async ({ page }) => {
    await tohumla(page, [okunuyorKitap()]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="oturum-basla"]');
    await page.click('[data-act="bitir"]');
    expect(await page.evaluate(() => localStorage.getItem('kk_oturum_v1'))).toBeNull();
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.durum).toBe('bitti');
    expect((k.oturumlar || []).length).toBe(1);
    expect(k.oturumlar[0].sb).toBe(300);         // bitirince sayfa sona çekilmişti
  });
});

/* ==================== M3 — puanlama ==================== */
test.describe('G28 M3 — uygulama içi puanlama', () => {

  test('(a) detaydan puan ver/değiştir/kaldır — form hiç açılmaz', async ({ page }) => {
    await tohumla(page, [bittiKitap({ puan: null })]);
    await rafAc(page);
    await detayAc(page);
    await expect(page.locator('#dPuan')).toBeVisible();
    await page.click('#dPuan [data-act="d-puan"][data-v="7"]');
    await expect(page.locator('#toast')).toContainText('★ 7/10');
    expect(await page.evaluate(() => veri.kitaplar[0].puan)).toBe(7);
    await expect(page.locator('#ortuForm')).not.toHaveClass(/acik/);
    await expect(page.locator('#dPuan .puan-btn.secili')).toHaveText('7');
    // değiştir
    await page.click('#dPuan [data-act="d-puan"][data-v="9"]');
    expect(await page.evaluate(() => veri.kitaplar[0].puan)).toBe(9);
    // kaldır
    await page.click('[data-act="d-puan-sil"]');
    await expect(page.locator('#toast')).toContainText('Puan kaldırıldı');
    expect(await page.evaluate(() => veri.kitaplar[0].puan)).toBeNull();
    expect(await page.locator('#dPuan .puan-btn.secili').count()).toBe(0);
    await expect(page.locator('#ortuForm')).not.toHaveClass(/acik/);
  });

  test('bitirme akışı: bitir → detayda kal, puan sorusu birincil blokta', async ({ page }) => {
    await tohumla(page, [okunuyorKitap()]);
    await rafAc(page);
    await detayAc(page);
    await page.click('[data-act="bitir"]');
    await expect(page.locator('#toast')).toContainText('Tebrikler');
    await expect(page.locator('#ortuForm')).not.toHaveClass(/acik/);
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await expect(page.locator('#dPuan')).toBeVisible();
    await page.click('#dPuan [data-act="d-puan"][data-v="8"]');
    expect(await page.evaluate(() => veri.kitaplar[0].puan)).toBe(8);
  });

  test('(b) puansız bitmişler çiple bulunur', async ({ page }) => {
    await tohumla(page, [bittiKitap({ ad: 'Puanlı', puan: 9 }),
      bittiKitap({ ad: 'Puansız Kalan', puan: null }),
      sahteKitap({ ad: 'Alakasız Okunacak' })]);
    await rafAc(page);
    await page.click('[data-act="filtre"][data-v="puansiz"]');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste .kart')).toContainText('Puansız Kalan');
  });

  test('(b2) istatistikteki köprü rafa götürür ve puansız filtresini kurar', async ({ page }) => {
    await tohumla(page, [bittiKitap({ ad: 'Puanlı', puan: 9 }),
      bittiKitap({ ad: 'Puansız Kalan', puan: null })]);
    await rafAc(page);
    await page.click('[data-act="sekme"][data-v="ist"]');
    await expect(page.locator('#istPuansiz')).toContainText('1 bitmiş kitap henüz puansız');
    await page.click('#istPuansiz [data-act="puansiz-git"]');
    await expect(page.locator('#panel-raf')).toHaveClass(/active/);
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste .kart')).toContainText('Puansız Kalan');
    await expect(page.locator('#durumChips [data-v="puansiz"]')).toHaveClass(/active/);
  });

  test('(c) istatistik yeni puanı anında yansıtır (görünür paydayla)', async ({ page }) => {
    await tohumla(page, [bittiKitap({ ad: 'Şimdi Puanlanacak', puan: null })]);
    await rafAc(page);
    await detayAc(page);
    await page.click('#dPuan [data-act="d-puan"][data-v="10"]');
    await page.click('[data-act="detay-kapat"]');
    await page.click('[data-act="sekme"][data-v="ist"]');
    await expect(page.locator('#istIcerik')).toContainText('Ortalama puan (1 kitaptan)');
    await expect(page.locator('#istIcerik .ist-sayi').nth(3)).toHaveText('10.0');
    // artık puansız bitmiş köprüsü yok
    expect(await page.locator('#istPuansiz').count()).toBe(0);
  });

  test('(d) puan yazımı kullanıcı eylemi: k.g damgası basar', async ({ page }) => {
    await tohumla(page, [bittiKitap({ puan: null })]);
    await rafAc(page);
    await detayAc(page);
    const gOnce = await page.evaluate(() => veri.kitaplar[0].g);
    await page.click('#dPuan [data-act="d-puan"][data-v="6"]');
    expect(await page.evaluate(() => veri.kitaplar[0].g)).toBeGreaterThan(gOnce);
  });

  test('yarım kitaba puan verilebilir; form kaydetmesi puanı SİLMEZ', async ({ page }) => {
    await tohumla(page, [okunuyorKitap({ durum: 'yarim', ad: 'Yarım Puanlı', bitisTarihi: bugunISO(-1) })]);
    await rafAc(page);
    await detayAc(page);
    await expect(page.locator('#dPuan')).toBeVisible();
    await page.click('#dPuan [data-act="d-puan"][data-v="4"]');
    expect(await page.evaluate(() => veri.kitaplar[0].puan)).toBe(4);
    // kartta ve künyede görünür
    await expect(page.locator('#detayIcerik .puan-mini')).toContainText('4/10');
    // düzenle-kaydet turu puanı korur (formKaydet yarim koruması)
    await page.click('#dDigerKatla summary');
    await page.click('[data-act="duzenle"]');
    await page.click('[data-act="form-kaydet"]');
    expect(await page.evaluate(() => veri.kitaplar[0].puan)).toBe(4);
    expect(await page.evaluate(() => veri.kitaplar[0].durum)).toBe('yarim');
  });
});

/* ==================== M4 — istatistik dürüstlüğü ==================== */
test.describe('G28 M4 — istatistik dürüstlüğü', () => {

  test('(a) tek kitaplık yazar "en çok" İLAN EDİLMEZ (rapor)', async ({ page }) => {
    await tohumla(page, [bittiKitap({ ad: 'Tek Kitap', yazar: 'Yalnız Yazar',
      tur: 'Roman', puan: 8, bitisTarihi: `${YIL}-03-05` })]);
    await rafAc(page);
    await page.click('[data-act="sekme"][data-v="ist"]');
    const o = await page.evaluate(y => window.__rapor.yilOzeti(y), YIL);
    expect(o.enCokYazar).toBeNull();
    expect(o.enCokTur).toBeNull();
    await expect(page.locator('#istIcerik #rpKart')).toBeVisible();
    await expect(page.locator('#istIcerik #rpKart')).not.toContainText('En çok okuduğun yazar');
    await expect(page.locator('#istIcerik #rpKart')).not.toContainText('En çok tür');
  });

  test('(b) 2+ kitaplı yazar "en çok" olur ve sayısı görünür', async ({ page }) => {
    await tohumla(page, [
      bittiKitap({ ad: 'K1', yazar: 'Çift Yazar', tur: 'Roman', puan: 8, bitisTarihi: `${YIL}-02-01` }),
      bittiKitap({ ad: 'K2', yazar: 'Çift Yazar', tur: 'Deneme', puan: 7, bitisTarihi: `${YIL}-04-01` })]);
    await rafAc(page);
    await page.click('[data-act="sekme"][data-v="ist"]');
    const o = await page.evaluate(y => window.__rapor.yilOzeti(y), YIL);
    expect(o.enCokYazar).toEqual(['Çift Yazar', 2]);
    expect(o.enCokTur).toBeNull();               // türlerin her biri n=1
    await expect(page.locator('#istIcerik #rpKart')).toContainText('Çift Yazar (2)');
  });

  test('(b2) ortalama puanın TABANI görünür: rapor + çekirdek istatistik', async ({ page }) => {
    // 3 bitmiş, yalnız 1'i puanlı: "10 ortalama puan" tek başına yanıltıcıydı
    await tohumla(page, [
      bittiKitap({ ad: 'P1', puan: 10, bitisTarihi: `${YIL}-01-10` }),
      bittiKitap({ ad: 'P2', puan: null, bitisTarihi: `${YIL}-02-10` }),
      bittiKitap({ ad: 'P3', puan: null, bitisTarihi: `${YIL}-03-10` })]);
    await rafAc(page);
    await page.click('[data-act="sekme"][data-v="ist"]');
    const o = await page.evaluate(y => window.__rapor.yilOzeti(y), YIL);
    expect(o.ortPuan).toBe(10);
    expect(o.puanliSayisi).toBe(1);
    await expect(page.locator('#istIcerik #rpKart')).toContainText('ortalama puan (1 kitaptan)');
    await expect(page.locator('#istIcerik')).toContainText('Ortalama puan (1 kitaptan)');
    await expect(page.locator('#istPuansiz')).toContainText('2 bitmiş kitap henüz puansız');
  });

  test('(c) zeka sayfa hedefi paydası: sayfasız kitap N sayımına girmez', async ({ page }) => {
    await tohumla(page, { kitaplar: [
      bittiKitap({ ad: 'Sayfalı', sayfa: 300, bitisTarihi: `${YIL}-05-01` }),
      bittiKitap({ ad: 'Sayfasız', sayfa: null, guncelSayfa: 0, bitisTarihi: `${YIL}-05-02` })],
      hedef: {}, hedefG: {}, hedefSayfa: { [YIL]: 5000 }, hedefSayfaG: { [YIL]: 1 }, silinenler: {} });
    await rafAc(page);
    await page.click('[data-act="sekme"][data-v="ist"]');
    const d = await page.evaluate(() => window.__zeka.sayfaHedefDurum());
    expect(d.ilerleme).toBe(300);
    expect(d.kitapSayisi).toBe(1);               // sayfasız kitap paydada değil
    await expect(page.locator('#zkSayfaHedefKart')).toContainText('Bitirdiğin 1 kitabın sayfa toplamı');
  });

  test('(c2) saat zirvesi tek oturumluk dilimle ilan edilmez, barlar kalır', async ({ page }) => {
    const saatte = (saat, gun) => { const d = new Date(); d.setDate(d.getDate() - gun);
      d.setHours(saat, 0, 0, 0); return d.getTime(); };
    // gece dilimi süre şampiyonu ama TEK oturum; iddia susmalı, dağılım çizilmeli
    await tohumla(page, [sahteKitap({ ad: 'Gece Tek', durum: 'okunuyor', sayfa: 400,
      baslamaTarihi: bugunISO(-9), oturumlar: [
        { b: saatte(2, 1), s: 4 * 3600000, sa: 0, sb: 100 },
        { b: saatte(21, 2), s: 600000, sa: 100, sb: 110 },
        { b: saatte(9, 3), s: 600000, sa: 110, sb: 120 },
        { b: saatte(14, 4), s: 600000, sa: 120, sb: 130 },
        { b: saatte(15, 5), s: 300000, sa: 130, sb: 135 }
      ] })]);
    await rafAc(page);
    await page.click('[data-act="sekme"][data-v="ist"]');
    const s = await page.evaluate(() => window.__zeka.saatDagilimi());
    expect(s.yeterli).toBe(true);
    expect(s.zirve).toBeNull();                  // süre lideri Gece ama adet=1 → iddia yok
    await expect(page.locator('#zkSaatKart')).toBeVisible();
    expect(await page.locator('#zkSaatOzet').count()).toBe(0);
  });
});
