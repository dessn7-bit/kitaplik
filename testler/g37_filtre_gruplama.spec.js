'use strict';
/* G37 — Kütüphane filtre satırı + şerit düzeltmeleri (v43, tasarım karşılaştırması).
   D1: araç satırı TEK satır (solda eksenler, sağda Seç+düzen anahtarı); üst yığın
       kontrolleri liste kartlarına BİNMEZ (geometri — mutasyon hedefi); sayaç
       başlıktaki "N cilt" ile tekrar üretmez; çip satırı tek satır kalır.
   D2: gruplama boyutu tek yerde (Durum · Tür · Yazar · Raf) — liste VE ızgara
       gruplanır; veri yoksa boyut seçilebilir ama dürüst not (gruplama zorlanmaz).
   D3: SIRADA levhaları sabit 2:3 oran — kapaklı/kapaksız aynı yükseklik,
       görsel mutlak katman + object-fit:cover (mutasyon hedefi).
   D4: tam kaydırmada son satır karoları FAB ile örtüşmez (üç düzende). */
const { test, expect, tohumla, sahteKitap, rafAc, rafYenile } = require('./yardim');

const KAPAK = 'https://covers.openlibrary.org/b/id/1-M.jpg';

function kume(){
  return [
    sahteKitap({ ad: 'Kapaklı Roman', kapak: KAPAK, tur: 'roman' }),
    sahteKitap({ ad: 'Deneme Bir', tur: 'deneme', yazar: 'Ayşe Yazar', raf: 'üst raf' }),
    sahteKitap({ ad: 'Deneme İki', tur: 'deneme', yazar: 'Ayşe Yazar' }),
    sahteKitap({ ad: 'Tursuz Kitap', tur: '', yazar: 'Veli Kalem', raf: 'alt raf' }),
    sahteKitap({ ad: 'Okunan Şey', durum: 'okunuyor', sayfa: 200, guncelSayfa: 60 })
  ];
}

test.describe('G37 filtre satırı + gruplama + şerit', () => {

  /* ---------- D1 ---------- */

  test('D1: araç satırı TEK satır — eksenler solda, Seç + düzen anahtarı sağda', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await tohumla(page, kume());
    await rafAc(page);
    const o = await page.evaluate(() => {
      const r = s => document.querySelector(s).getBoundingClientRect();
      const arac = r('#ktArac'), eksen = r('#grupEksen'), sag = r('#ktAracSag');
      return { aracH: arac.height,
        dikeyFark: Math.abs((eksen.top + eksen.height / 2) - (sag.top + sag.height / 2)),
        eksenSol: eksen.left < sag.left, sagKenar: sag.right <= arac.right };
    });
    expect(o.aracH, 'tek satır (yükseklik < 56)').toBeLessThan(56);
    expect(o.dikeyFark, 'eksenler ve anahtarlar aynı satır ekseninde').toBeLessThan(10);
    expect(o.eksenSol).toBe(true);
    expect(o.sagKenar).toBe(true);
    // dört eksen + Seç + üç düzen düğmesi görünür
    for (const sec of ['#grupDurum', '#grupTur', '#grupYazar', '#grupRaf',
      '#secimBtn', '#duzenIzgara', '#duzenListe', '#duzenYogun'])
      await expect(page.locator(sec)).toBeVisible();
  });

  test('D1: üst yığın kontrolleri liste kartlarına binmez (geometri)', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await tohumla(page, kume());
    await rafAc(page);
    const o = await page.evaluate(() => {
      const kutu = s => { const e = document.querySelector(s); return e && e.getBoundingClientRect(); };
      const kartlar = [...document.querySelectorAll('#liste .kart')].map(k => k.getBoundingClientRect());
      const kontroller = ['#durumChips', '#ktArac', '.sort-row', '#sirala', '#sayac', '#etiketFiltre']
        .map(s => ({ s, b: kutu(s) }))
        .filter(x => x.b && x.b.width > 0 && x.b.height > 0);
      const kesisen = [];
      for (const k of kontroller)
        for (const kart of kartlar)
          if (!(k.b.right <= kart.left || k.b.left >= kart.right ||
                k.b.bottom <= kart.top || k.b.top >= kart.bottom))
            kesisen.push(k.s);
      const sirala = kutu('#sirala');
      const ilkKart = kartlar[0];
      return { kesisen, aralik: ilkKart.top - sirala.bottom };
    });
    expect(o.kesisen, 'binme yok: ' + o.kesisen.join(',')).toEqual([]);
    expect(o.aralik, 'sıralama ile ilk kart arasında nefes payı').toBeGreaterThanOrEqual(4);
  });

  test('D1: sayaç varsayılanda başlıkla tekrar üretmez, süzgeç daraltınca sayım verir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'A', raf: 'Salon' }), sahteKitap({ ad: 'B' })]);
    await rafAc(page);
    await expect(page.locator('.kt-cilt')).toHaveText('2 cilt');
    await expect(page.locator('#sayac')).toHaveText('');   // gizlenen istek de yok → tamamen boş
    await page.click('[data-act="filtre"][data-v="okunacak"]');
    await expect(page.locator('#sayac')).toHaveText('2 kitap · 1 raf konumu');
  });

  test('D1: çip satırı tek satır kalır ve taşan içerik kaydırma işaretiyle gezilir', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 700 });
    await tohumla(page, [sahteKitap({ ad: 'K', sahiplik: 'istek' }), sahteKitap({ ad: 'L' })]);
    await rafAc(page);
    const o = await page.locator('#durumChips').evaluate(el => ({
      h: el.getBoundingClientRect().height,
      kayar: el.scrollWidth > el.clientWidth,
      sinif: el.className
    }));
    expect(o.h, 'tek satır çip yüksekliği').toBeLessThan(56);
    expect(o.kayar, 'dar ekranda içerik kaydırılabilir').toBe(true);
    expect(o.sinif).toContain('kayar-son');   // "devamı var" solması
  });

  /* ---------- D2 ---------- */

  test('D2a: Tür ekseni — liste VE ızgara türe göre gruplanır', async ({ page }) => {
    await tohumla(page, kume());
    await rafAc(page);   // tohum varsayılanı: liste düzeni
    await page.click('#grupTur');
    // liste modunda başlıklar (çekirdek satırlar korunur, araya başlık girer)
    await expect(page.locator('#liste .raf-basligi')).toHaveCount(3);
    await expect(page.locator('#liste .raf-basligi').first()).toContainText('tür belirtilmemiş');
    await expect(page.locator('#liste')).toContainText('deneme · 2');
    await expect(page.locator('#liste')).toContainText('roman · 1');
    await expect(page.locator('#liste .kart')).toHaveCount(5);
    // ızgarada da aynı gruplar
    await page.click('#duzenIzgara');
    await expect(page.locator('#liste .raf-basligi')).toHaveCount(3);
    await expect(page.locator('#liste')).toContainText('deneme · 2');
  });

  test('D2b: Yazar ekseni yazara göre gruplar', async ({ page }) => {
    await tohumla(page, kume());
    await rafAc(page);
    await page.click('#grupYazar');
    await expect(page.locator('#liste')).toContainText('Ayşe Yazar · 2');
    await expect(page.locator('#liste')).toContainText('Veli Kalem · 1');
    // Durum eksenine geçmek yazar gruplamasını değiştirir (tek boyut kuralı)
    await page.click('#grupDurum');
    await expect(page.locator('#grupYazar')).not.toHaveClass(/aktif/);
    await expect(page.locator('#liste')).toContainText('Okunuyor · 1');
    await expect(page.locator('#liste')).toContainText('Okunacak · 4');
  });

  test('D2c: Raf ekseni eski davranışı korur; tercih yenilemede yaşar', async ({ page }) => {
    await tohumla(page, kume());
    await rafAc(page);
    await page.click('#grupRaf');
    await expect(page.locator('#liste .raf-basligi').first()).toContainText('raf belirtilmemiş');
    await expect(page.locator('#liste')).toContainText('üst raf · 1');
    await rafYenile(page);
    await expect(page.locator('#grupRaf')).toHaveClass(/aktif/);
    await expect(page.locator('#liste .raf-basligi').first()).toContainText('raf belirtilmemiş');
  });

  test('D2d: veri olmayan boyut seçilebilir — gruplama zorlanmaz, dürüst not çıkar', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Verisiz Bir' }), sahteKitap({ ad: 'Verisiz İki' })]);
    await rafAc(page);
    await page.click('#grupTur');
    await expect(page.locator('#grupTur')).toHaveClass(/aktif/);
    await expect(page.locator('#grupBosNot')).toBeVisible();
    await expect(page.locator('#grupBosNot')).toContainText('Tür');
    await expect(page.locator('#liste .raf-basligi')).toHaveCount(0);
    // kitaplar yine görünür (işlev kaybı yok)
    await expect(page.locator('#liste .kart')).toHaveCount(2);
    // veri gelince not kaybolur, gruplar belirir
    await page.evaluate(() => { veri.kitaplar[0].tur = 'şiir'; depoKaydet(); listeCiz(); });
    await expect(page.locator('#grupBosNot')).toBeHidden();
    await expect(page.locator('#liste .raf-basligi')).toHaveCount(2);
  });

  /* ---------- D3 ---------- */

  test('D3: SIRADA levhaları sabit 2:3 — kapaklı/kapaksız aynı yükseklik, görsel cover', async ({ page }) => {
    await tohumla(page, kume());
    await rafAc(page);
    await expect(page.locator('#ktSiradaSerit .kt-sira-plate')).toHaveCount(4);
    const o = await page.evaluate(() => {
      const plakalar = [...document.querySelectorAll('#ktSiradaSerit .kt-sira-plate')].map(e => {
        const b = e.getBoundingClientRect();
        const img = e.querySelector('img');
        const ib = img && img.getBoundingClientRect();
        return { w: b.width, h: b.height, oran: b.height / b.width,
          kapakli: !!img,
          fit: img ? getComputedStyle(img).objectFit : null,
          konum: img ? getComputedStyle(img).position : null,
          imgSigar: img ? (Math.abs(ib.width - (b.width - 12)) < 3 && Math.abs(ib.height - (b.height - 12)) < 3) : null };
      });
      return { plakalar, yukseklikler: [...new Set(plakalar.map(p => Math.round(p.h)))] };
    });
    expect(o.plakalar.some(p => p.kapakli), 'kümede kapaklı levha var').toBe(true);
    expect(o.yukseklikler.length, 'TÜM levhalar aynı yükseklikte: ' + o.yukseklikler.join(','))
      .toBe(1);
    for (const p of o.plakalar) {
      expect(p.oran, `2:3 oran (${p.oran.toFixed(2)})`).toBeGreaterThan(1.42);
      expect(p.oran, `2:3 oran (${p.oran.toFixed(2)})`).toBeLessThan(1.58);
      if (p.kapakli) {
        expect(p.fit).toBe('cover');
        expect(p.konum, 'görsel mutlak katman — kutuyu esnetemez').toBe('absolute');
        expect(p.imgSigar, 'görsel levha iç kutusunu doldurur').toBe(true);
      }
    }
  });

  /* ---------- D4 ---------- */

  for (const [duzenBtn, ad] of [['#duzenIzgara', 'ızgara'], ['#duzenListe', 'liste'], ['#duzenYogun', 'yoğun']]) {
    test(`D4: tam kaydırmada son satır ${ad} düzeninde FAB ile örtüşmez`, async ({ page }) => {
      await page.setViewportSize({ width: 412, height: 915 });
      const kitaplar = [];
      for (let i = 1; i <= 14; i++) kitaplar.push(sahteKitap({ ad: 'Raf Dolgusu ' + i }));
      await tohumla(page, kitaplar);
      await rafAc(page);
      await page.click(duzenBtn);
      await expect(page.locator('#liste .kart')).toHaveCount(14);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(150);
      const o = await page.evaluate(() => {
        const fab = document.querySelector('.fab').getBoundingClientRect();
        const kartlar = [...document.querySelectorAll('#liste .kart')].map(k => k.getBoundingClientRect());
        const kesisen = kartlar.filter(k => !(k.right <= fab.left || k.left >= fab.right ||
          k.bottom <= fab.top || k.top >= fab.bottom));
        return { kesisen: kesisen.length,
          sonKartAlt: Math.max(...kartlar.map(k => k.bottom)), fabUst: fab.top };
      });
      expect(o.kesisen, 'FAB karoya binmiyor').toBe(0);
      expect(o.sonKartAlt, 'son satır FAB üst kenarının üzerinde').toBeLessThanOrEqual(o.fabUst);
    });
  }
});
