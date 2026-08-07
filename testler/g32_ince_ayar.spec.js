/* G32 — Görsel ince ayar (412×915 gerçek render bulguları):
   D1 arama placeholder'ı kesilmez (kısa metin + 40px yan düğmeler)
   D2 sahiplik çipleri durum çipi satırının İÇİNDE — üst yığın bir satır kısa,
      ilk kitap kartı ekranın üst yarısında başlar
   D3 liste alt dolgusu FAB'ı temizler — son kartın metni örtülmez
   D4 "Son bitirdiklerin" şeridi: GERÇEK veri (istKayit), bitmiş yoksa çizilmez */
'use strict';
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc } = require('./yardim');

function bitmis(ad, tarih, ek) {
  return sahteKitap(Object.assign({ ad, durum: 'bitti', sayfa: 200, puan: 7,
    bitisTarihi: tarih }, ek || {}));
}

test.describe('G32 ince ayar', () => {

  test('D1: 360px genişlikte arama placeholder metni kutuya sığar', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 700 });
    await tohumla(page, [sahteKitap()]);
    await rafAc(page);
    const olcum = await page.evaluate(() => {
      const el = document.getElementById('arama');
      const c = getComputedStyle(el);
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = `${c.fontStyle} ${c.fontWeight} ${c.fontSize} ${c.fontFamily}`;
      const metinEn = ctx.measureText(el.getAttribute('placeholder')).width;
      const kutuEn = el.clientWidth - parseFloat(c.paddingLeft) - parseFloat(c.paddingRight);
      return { metinEn, kutuEn };
    });
    expect(olcum.metinEn, `placeholder ${olcum.metinEn.toFixed(0)}px / kutu ${olcum.kutuEn.toFixed(0)}px`)
      .toBeLessThanOrEqual(olcum.kutuEn);
  });

  test('D1: zar ve öneri düğmeleri küçüldü ama 40px dokunma hedefi korunur', async ({ page }) => {
    await tohumla(page, [sahteKitap()]);
    await rafAc(page);
    for (const sec of ['.search-row .zar-btn', '.on-ac-btn']) {
      const b = await page.locator(sec).evaluate(el => el.getBoundingClientRect());
      expect(b.width, sec + ' genişlik').toBeGreaterThanOrEqual(40);
      expect(b.width, sec + ' eski 46px değil').toBeLessThan(46);
      expect(b.height, sec + ' yükseklik').toBeGreaterThanOrEqual(40);
    }
  });

  test('D2: 412×915 ekranda ilk kitap kartı üst yarıda başlar', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await tohumla(page, [sahteKitap({ ad: 'İlk Kart Kitabı' })]);
    await rafAc(page);
    const ust = await page.locator('#liste .kart').first()
      .evaluate(el => el.getBoundingClientRect().top);
    expect(ust, `ilk kart top=${ust.toFixed(0)}px (eşik 458)`).toBeLessThan(458);
  });

  test('D2: sahiplik çipleri durum çipleriyle AYNI satırda ve işlev korunur', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await tohumla(page, [sahteKitap({ ad: 'Bendeki', sahiplik: 'sahip' }),
      sahteKitap({ ad: 'İstekteki', sahiplik: 'istek' })]);
    await rafAc(page);
    // aynı yatay satır: iki çip ailesinin üst kenarı hizalı (tek kaydırıcı)
    const d = await page.locator('#durumChips .chip').first().evaluate(el => el.getBoundingClientRect().top);
    const v = await page.locator('#vmSahiplikChips .vm-chip').first().evaluate(el => el.getBoundingClientRect().top);
    expect(Math.abs(d - v), `durum=${d} sahiplik=${v}`).toBeLessThan(8);
    // işlev kaybı yok: istek filtresi çalışıyor (çip kaydırıcı içinde de tıklanır)
    await page.locator('#vmSahiplikChips [data-v="istek"]').scrollIntoViewIfNeeded();
    await page.click('#vmSahiplikChips [data-v="istek"]');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste .kart')).toContainText('İstekteki');
  });

  test('D3: tam kaydırmada son kartın altı FAB üst kenarının üzerinde kalır', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    const kitaplar = [];
    for (let i = 1; i <= 10; i++) kitaplar.push(sahteKitap({ ad: 'Dolgu Kitabı ' + i }));
    await tohumla(page, kitaplar);
    await rafAc(page);
    await expect(page.locator('#liste .kart')).toHaveCount(10);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const g = await page.evaluate(() => {
      const kartlar = document.querySelectorAll('#liste .kart');
      const son = kartlar[kartlar.length - 1].getBoundingClientRect();
      const fab = document.querySelector('.fab').getBoundingClientRect();
      return { kartAlt: son.bottom, fabUst: fab.top };
    });
    expect(g.kartAlt, `kart altı ${g.kartAlt.toFixed(0)} / FAB üstü ${g.fabUst.toFixed(0)}`)
      .toBeLessThanOrEqual(g.fabUst);
  });

  test('D4: son bitirdiklerin şeridi gerçek veriden gelir, en yeni önce, detaya götürür', async ({ page }) => {
    await tohumla(page, [
      bitmis('Eski Bitmiş', '2026-05-01'),
      bitmis('Yeni Bitmiş', bugunISO()),
      sahteKitap({ ad: 'Okunacak Duran' })
    ]);
    await page.goto('/');
    const blok = page.locator('#asSonBiten');
    await expect(blok).toBeVisible();
    await expect(blok).toContainText('Son bitirdiklerin');
    await expect(blok.locator('.as-kapak-btn')).toHaveCount(2);   // okunacak GİRMEZ
    // en yeni bitiş ilk sırada
    await expect(blok.locator('.as-kapak-btn').first()).toHaveAttribute('title', 'Yeni Bitmiş');
    // kapaksız kitap baş-harfli sırt yer tutucusu taşır (liste diliyle aynı)
    await expect(blok.locator('.as-kapak-btn').first().locator('.as-kapak-yok')).toHaveText('YB');
    // dokunuş mevcut detay yoluna gider — yeni mantık yok
    await blok.locator('.as-kapak-btn').first().click();
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await expect(page.locator('#detayIcerik')).toContainText('Yeni Bitmiş');
  });

  test('D4: hiç bitmiş kitap yokken şerit ÇİZİLMEZ (uydurma yok ilkesi)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Sadece Okunacak' })]);
    await page.goto('/');
    await expect(page.locator('#anaIcerik .as-blok').first()).toBeVisible(); // sayfa çizildi
    await expect(page.locator('#asSonBiten')).toHaveCount(0);
  });
});
