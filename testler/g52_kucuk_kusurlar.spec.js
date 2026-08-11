'use strict';
/* G52 — birikmiş küçük kusurların temizliği (v62). Altı madde:
   D1 gizlenen öneri GERİ ALINABİLİR — senkron semantiği: kesfetGizli union'dan
      kayıt silinemez (öbür cihazdan dirilir); geri alma AYRI öz-damgalı
      kesfetGizliGeri haritasında (silinenler mezar taşı deseninin dengi);
      etkin gizlilik = gizli damgası > geri damgası.
   D2 mononim yazar kuralı → vakaları g45'te (alaka denetiminin evi).
   D3 seçili-durum yüzeyleri iki temada AA — çipler ks-chip reçetesi (paper
      metin), rozetler %86 renk karışımı (renk = anlam, korunur). Ölçüm
      GERÇEK render + alfa-karışımlı efektif zemin (tint hesaba katılır).
   D4 "Yeter, duraklat" — etiket davranışı söyler; geri başlatma keşfedilebilir.
   D5 çeşitlilik kotası aday elediyse sayım bunu SÖYLER; elemediğinde ek metin yok.
   D6 .hiz-kutu emekli → .d-oturum-canli (altın sol hat, kutu/dolgu/yuvarlak yok).
   (Mutasyon D3: bir seçili yüzey eski renge döndürülür → AA vakası kırmızı.
    Mutasyon D2: g45'teki yeni mononim vakası kırmızı.) */
const { test, expect, tohumla, sahteKitap, rafAc, bugunISO } = require('./yardim');

function okunacak(ek) {
  return sahteKitap(Object.assign({ durum: 'okunacak', sahiplik: 'sahip' }, ek));
}
function bitmis(ek) {
  return sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30), puan: 9 }, ek));
}
async function kesfetAc(page) {
  await page.goto('/');
  await page.click('nav [data-act="sekme"][data-v="kesfet"]');
  await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
}
/* B bölümü fikstürü: sevilen yazar + sahte google adayı → getir → İlgilenmiyorum */
function bTaban() {
  return [bitmis({ ad: 'S1', yazar: 'Ahmet Ümit' }), bitmis({ ad: 'S2', yazar: 'Ahmet Ümit', puan: 10 })];
}
function gItem(ad, yazar) {
  return { volumeInfo: { title: ad, authors: [yazar] } };
}
async function bGetir(page) {
  await page.click('#ksB [data-act="ks-b-getir"]');
  await expect(page.locator('#ksB')).not.toContainText('Kaynaklara soruluyor', { timeout: 15000 });
}

/* ---- renk yardımcıları (g42/g36 RENK_COZ + alfa-karışım deseni) ---- */
const OLCUM_EK = `
  const COZ = z => {
    let m = String(z).match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    m = String(z).match(/color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)/);
    if (m) return { r: 255 * +m[1], g: 255 * +m[2], b: 255 * +m[3], a: m[4] === undefined ? 1 : +m[4] };
    return null;
  };
  const zeminBul = el => {
    let zemin = { r: 255, g: 255, b: 255 }, kat = [], p = el;
    while (p && p !== document.documentElement) {
      const c = COZ(getComputedStyle(p).backgroundColor);
      if (c && c.a > 0) { kat.push(c); if (c.a >= 1) break; }
      p = p.parentElement;
    }
    const kok = COZ(getComputedStyle(document.documentElement).backgroundColor);
    if (kok && kok.a >= 1) kat.push(kok);
    for (let i = kat.length - 1; i >= 0; i--) {
      const c = kat[i];
      zemin = { r: c.r * c.a + zemin.r * (1 - c.a), g: c.g * c.a + zemin.g * (1 - c.a),
        b: c.b * c.a + zemin.b * (1 - c.a) };
    }
    return zemin;
  };
  const L = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const oran = el => {
    const s = getComputedStyle(el);
    const metin = COZ(s.color), zemin = zeminBul(el);
    if (!metin) return null;
    const ef = metin.a >= 1 ? metin : { r: metin.r * metin.a + zemin.r * (1 - metin.a),
      g: metin.g * metin.a + zemin.g * (1 - metin.a), b: metin.b * metin.a + zemin.b * (1 - metin.a) };
    const l1 = L(ef), l2 = L(zemin);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
`;

test.describe('G52 D1 — gizlenen öneri geri alınabilir', () => {

  test('gizle → liste görünür → geri al → öneri tekrar çıkar; yenilemede kalıcı', async ({ page }) => {
    await tohumla(page, bTaban());
    await kesfetAc(page);
    page.__agAyar.google = { items: [gItem('Sis ve Gece', 'Ahmet Ümit')] };
    await bGetir(page);
    await page.click('#ksB [data-act="ks-b-gizle"]');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(0);
    // gizlenenler bölümü (erteleme deseninin dengi): sayaç + göster + geri al
    const gizli = page.locator('#ksB .ks-gizli');
    await expect(gizli).toContainText('1 öneri gizledin');
    await page.click('#ksB [data-act="ks-gizli"]');
    await expect(gizli.locator('.ks-gizli-item')).toContainText('Sis ve Gece');
    await page.click('#ksB [data-act="ks-gizli-geri"]');
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);       // öneri geri geldi
    await expect(page.locator('#ksB .ks-gizli')).toHaveCount(0);        // boşken bölüm çizilmez
    // geri alma YENİLEMEDE kalıcı (kesfetGizliGeri depoYukle'den döner)
    await page.reload();
    await page.click('nav [data-act="sekme"][data-v="kesfet"]');
    await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
    expect(await page.evaluate(() => Object.keys(veri.kesfetGizliGeri || {}).length)).toBe(1);
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);       // önbellek adayı yine görünür
  });

  test('senkron semantiği: geri alma mezar taşı UNION ile taşınır, yeniden gizleme onu yener', async ({ page }) => {
    await tohumla(page, []);
    await rafAc(page);
    const bir = await page.evaluate(() => window.__senkron.birlestir(
      { kitaplar: [], kesfetGizli: { 'a|x': 5 }, kesfetGizliGeri: { 'a|x': 9 } },
      { kitaplar: [], kesfetGizli: { 'a|x': 5, 'b|y': 7 }, kesfetGizliGeri: {} }));
    // gizli haritası UNION kalır (g43 sözleşmesi bozulmadı), geri almalar da union
    expect(bir.kesfetGizli).toEqual({ 'a|x': 5, 'b|y': 7 });
    expect(bir.kesfetGizliGeri).toEqual({ 'a|x': 9 });
    // etkin gizlilik: a|x geri alındı (9 > 5) → elenmez; b|y gizli kalır
    // yeniden gizleme daha yeni damgayla geri almayı yener:
    const iki = await page.evaluate(() => window.__senkron.birlestir(
      { kitaplar: [], kesfetGizli: { 'a|x': 12 }, kesfetGizliGeri: { 'a|x': 9 } },
      { kitaplar: [], kesfetGizli: { 'a|x': 5 }, kesfetGizliGeri: { 'a|x': 9 } }));
    expect(iki.kesfetGizli['a|x']).toBe(12);   // 12 > 9 → yine gizli
  });
});

test.describe('G52 D3 — seçili durumlar iki temada AA', () => {

  /* Yüzeyler ekran ekran gezilerek GERÇEK render'da ölçülür; tint zemini
     alfa-karışımla hesaba katılır (katılmayan ölçüm 4.61 gösterip aldatıyordu).
     (Mutasyon D3 kilidi: tek yüzey eski renge dönse ilgili satır kırmızı.) */
  for (const tema of ['acik', 'karanlik']) {
    test(`tüm seçili-durum yüzeyleri AA (${tema})`, async ({ page }) => {
      const k1 = sahteKitap({ ad: 'Okunan', durum: 'okunuyor', sayfa: 300, guncelSayfa: 50 });
      const k2 = sahteKitap({ ad: 'Biten', durum: 'bitti', puan: 8, bitisTarihi: bugunISO(-10),
        notlar: [{ id: 'n1', tip: 'alinti', metin: 'Deneme alıntısı.', tarih: '2026-08-01', fikir: ['fikir'] }] });
      const k3 = sahteKitap({ ad: 'Yarım Kalan', durum: 'yarim' });
      const k4 = sahteKitap({ ad: 'İstekteki', durum: 'okunacak', sahiplik: 'istek' });
      await tohumla(page, [k1, k2, k3, k4], { kk_tema_v1: tema });
      await rafAc(page);
      const sonuc = [];
      const olc = async (secici, ad) => {
        const oranlar = await page.evaluate(({ sec, ek }) => {
          const oran = new Function(ek + ';return oran;')();
          return [...document.querySelectorAll(sec)].map(el => oran(el));
        }, { sec: secici, ek: OLCUM_EK });
        if (!oranlar.length) { sonuc.push(ad + ': BULUNAMADI'); return; }
        oranlar.forEach(o => { if (!(o >= 4.5)) sonuc.push(ad + ': ' + (o && o.toFixed(2))); });
      };
      // Kütüphane: aktif çip + rozetler + puan hapı + istek rozeti
      // (istek kitapları varsayılan görünümde gizli — "Tüm raf" süzgecine geç)
      await page.click('#vmSahiplikChips [data-act="vm-sahiplik"][data-v="hepsi"]');
      await expect(page.locator('#liste .vm-rozet')).toHaveCount(1);
      await olc('#durumChips .chip.active', 'chip.active');
      await olc('#liste .rozet', 'rozet.r-*');
      await olc('#liste .puan-mini', 'puan-mini');
      await olc('#liste .vm-rozet', 'vm-rozet');
      /* fa-cip.fa-secili: fikir ağı panelinin render koşulları veri-bağımlı —
         gerçek CSS'le boyanmış geçici örnek ölçülür (g50 AA vakası emsali). */
      await page.click('nav [data-act="sekme"][data-v="alinti"]');
      const faOran = await page.evaluate((ek) => {
        const oran = new Function(ek + ';return oran;')();
        const c = document.createElement('button');
        c.className = 'fa-cip fa-secili'; c.textContent = 'ölçüm';
        document.getElementById('panel-alinti').appendChild(c);
        const o = oran(c); c.remove(); return o;
      }, OLCUM_EK);
      if (!(faOran >= 4.5)) sonuc.push('fa-cip.fa-secili: ' + (faOran && faOran.toFixed(2)));
      // Detay: seçili puan düğmesi + durum rozeti (detay override)
      await page.click('nav [data-act="sekme"][data-v="raf"]');
      await page.click('#liste .kart[data-id="' + k2.id + '"]');
      await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
      await olc('#dPuan .puan-btn.secili', 'puan-btn.secili');
      await page.click('#detayIcerik [data-act="detay-kapat"]');
      // Ayarlar: seçili tema düğmesi
      await page.click('header [data-act="ayar-ac"]');
      await expect(page.locator('#ortuAyar')).toHaveClass(/acik/);
      await olc('#tmSecim .tm-dugme.tm-secili', 'tm-dugme.tm-secili');
      await page.click('#ortuAyar [data-act="ayar-kapat"]');
      // Form: durum + mini-chip seçilileri
      await page.click('.fab[data-act="yeni"]');
      await expect(page.locator('#ortuForm')).toHaveClass(/acik/);
      await olc('#ortuForm .durum-btn.secili', 'durum-btn.secili');
      expect(sonuc, tema + ' temasında AA altı / eksik yüzey').toEqual([]);
    });
  }

  test('rozet ve puan hapı TINT zeminini korur (görsel dil bozulmadı)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Biten', durum: 'bitti', puan: 8, bitisTarihi: bugunISO(-5) })]);
    await rafAc(page);
    const zeminler = await page.evaluate(() =>
      ['#liste .rozet', '#liste .puan-mini'].map(s =>
        getComputedStyle(document.querySelector(s)).backgroundColor));
    for (const z of zeminler) expect(z).not.toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('G52 D4 — "Yeter, duraklat"', () => {

  test('etiket davranışı söyler; duraklatılan karttan yeniden başlatılabilir', async ({ page }) => {
    const n = { id: 'nd4', tip: 'alinti', metin: 'Tekrar alıntısı.', tarih: '2026-08-01',
      tekrarDurum: 'aktif', tekrarAralik: 3, tekrarSayisi: 1, tekrarSonraki: bugunISO(0) };
    await tohumla(page, [sahteKitap({ ad: 'Kitap', notlar: [n] })]);
    await rafAc(page);
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    const yeter = page.locator('#tkKutu [data-act="tk-yeter"]');
    await expect(yeter).toContainText('duraklat');            // yalnız "Yeter" değil
    await expect(yeter).toHaveAttribute('title', /silinmez/); // geri alma yolu söyleniyor
    await yeter.click();
    // davranış aynı: duraklatıldı + karttan geri başlatma yolu görünür
    await expect(page.locator('#alintiListe .not-kart .tk-durum')).toContainText('duraklatıldı');
    await page.locator('#alintiListe [data-act="tk-baslat"]').click();
    expect(await page.evaluate(() =>
      veri.kitaplar[0].notlar[0].tekrarDurum)).toBe('aktif');
  });
});

test.describe('G52 D5 — Keşfet sayım şeffaflığı', () => {

  test('çeşitlilik kotası aday elediyse açılış cümlesi bunu söyler', async ({ page }) => {
    // 12 aynı-yazar + 1 tekil → kota 3 satır gösterir, 10 aday elenir
    const kitaplar = [];
    for (let i = 0; i < 12; i++) kitaplar.push(okunacak({ ad: 'Kitap ' + i, yazar: 'Üretken Yazar' }));
    kitaplar.push(okunacak({ ad: 'Tekil', yazar: 'Yalnız Yazar' }));
    for (let i = 0; i < 3; i++) kitaplar.push(bitmis({ ad: 'B' + i, yazar: 'Puanlı ' + i }));
    await tohumla(page, kitaplar);
    await kesfetAc(page);
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(3);
    const acilis = page.locator('#ksIcerik .ks-acilis');
    await expect(acilis).toContainText('13 okunacak aday');
    await expect(acilis).toContainText('10 aday gösterilmiyor: aynı yazardan en fazla 2');
  });

  test('eleme yokken gereksiz metin çıkmaz', async ({ page }) => {
    const kitaplar = [okunacak({ ad: 'A', yazar: 'Y1' }), okunacak({ ad: 'B', yazar: 'Y2' })];
    for (let i = 0; i < 3; i++) kitaplar.push(bitmis({ ad: 'B' + i, yazar: 'Puanlı ' + i }));
    await tohumla(page, kitaplar);
    await kesfetAc(page);
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(2);
    await expect(page.locator('#ksIcerik .ks-acilis')).toContainText('2 okunacak aday');
    await expect(page.locator('#ksIcerik .ks-acilis')).not.toContainText('gösterilmiyor');
  });
});

test.describe('G52 D6 — canlı oturum satırı Ciltli', () => {

  test('.hiz-kutu emekli; .d-oturum-canli kutusuz, AA ve sayaç çalışıyor', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Okunan', durum: 'okunuyor', sayfa: 300 })]);
    await rafAc(page);
    await page.click('#liste .kart');
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await page.click('#oturumBlok [data-act="oturum-basla"]');
    const satir = page.locator('#detayIcerik .d-oturum-canli');
    await expect(satir).toBeVisible();
    await expect(page.locator('#oturumSayac')).toBeVisible();   // g40 sözleşmesi yaşıyor
    expect(await page.locator('#detayIcerik .hiz-kutu').count()).toBe(0);
    const stil = await satir.evaluate(el => {
      const s = getComputedStyle(el);
      return { radius: s.borderRadius, golge: s.boxShadow, zemin: s.backgroundColor,
        solHat: s.borderLeftWidth, ustHat: s.borderTopWidth };
    });
    expect(parseFloat(stil.radius) || 0).toBeLessThanOrEqual(7);
    expect(stil.golge).toBe('none');
    expect(stil.zemin).toBe('rgba(0, 0, 0, 0)');   // kuyu dolgusu emekli
    expect(stil.solHat).toBe('1px');               // altın sol hat (alıntı bloğu dili)
    expect(stil.ustHat).toBe('0px');               // kutu değil
    // AA: satır metni + sayaç iki rolü de eşiği geçer
    const oranlar = await page.evaluate((ek) => {
      const oran = new Function(ek + ';return oran;')();
      return [oran(document.querySelector('.d-oturum-canli')),
        oran(document.getElementById('oturumSayac'))];
    }, OLCUM_EK);
    for (const o of oranlar) expect(o).toBeGreaterThanOrEqual(4.5);
  });
});
