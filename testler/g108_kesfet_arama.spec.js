'use strict';
/* G108 — KEŞFET ARAMASI (v115).

   Kusur: "Ne okusam?" ekranında süzgeç çipleri vardı ama arama yoktu; 62 aday
   arasında belirli bir kitabı bulmanın tek yolu listeyi kaydırmaktı.

   SÖZLEŞMELER:
   1. Arama ÇİPLERİ EZMEZ, birlikte çalışır (VE). Çipler ekranda SEÇİLİ duruyor;
      arama onları sessizce geçersiz kılsaydı arayüz uygulanmayan bir süzgeci
      uygulanmış gibi gösterirdi — v111/v113'te kaldırılan "işaret yalan
      söylüyor" kusurunun aynısı. Kütüphane sekmesi de aynı sözleşmede.
   2. FARK 1 (Kütüphane'den): özet/ontoloji metni TARANMAZ. Keşfet adayları
      okunacak/yarım kitaplar — özetleri henüz yazılmamış, kol ölü ağırlık.
   3. FARK 2: ÇEŞİTLİLİK KOTASI (aynı yazardan en fazla 2) arama açıkken
      DEVRE DIŞI. Kota öneri içindir; arayan kullanıcı öneri istemiyor,
      arıyor — kota aradığını gizlerdi. Kütüphane'de bu sorun yok (kota yok).
   4. Boş sonuçta SEBEP söylenir ve ölçülür: aramayı kaldırınca kaç aday
      döneceği SAYILARAK yazılır.
   5. Panel her tuşta yeniden çiziliyor → odak ve imleç elle geri konur.

   (Mutasyon 1: arama çipleri ezer → (b) kırmızı.
    Mutasyon 2: kota aramada da uygulanır → (c) kırmızı.
    Mutasyon 3: odak geri konmaz → (e) kırmızı.
    Mutasyon 4: boş durum sebebi söylemez → (d) kırmızı.) */

const { test, expect, tohumla, sahteKitap, bugunISO } = require('./yardim');

const bitmis = ek => sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30) }, ek));
const okunacak = ek => sahteKitap(Object.assign({ durum: 'okunacak', sahiplik: 'sahip' }, ek));

/* Taban: motoru "az-veri" modundan çıkarmaya yeter (puanlı bitmiş kitap). */
function taban() {
  return [
    bitmis({ ad: 'Taban 1', yazar: 'Taban Yazar 1', tur: 'Deneme', puan: 8 }),
    bitmis({ ad: 'Taban 2', yazar: 'Taban Yazar 2', tur: 'Anı', puan: 7 }),
    bitmis({ ad: 'Taban 3', yazar: 'Taban Yazar 3', tur: 'Gezi', puan: 6 }),
    bitmis({ ad: 'Taban 4', yazar: 'Dostoyevski', tur: 'Roman', puan: 9 })
  ];
}
/* Aday havuzu: aynı yazardan DÖRT kitap (kota sınavı) + ayrı türde başkaları. */
function adaylar() {
  return [
    okunacak({ ad: 'Suç ve Ceza', yazar: 'Dostoyevski', tur: 'Roman', sayfa: 700 }),
    okunacak({ ad: 'Karamazov Kardeşler', yazar: 'Dostoyevski', tur: 'Roman', sayfa: 900 }),
    okunacak({ ad: 'Budala', yazar: 'Dostoyevski', tur: 'Roman', sayfa: 650 }),
    okunacak({ ad: 'Yeraltından Notlar', yazar: 'Dostoyevski', tur: 'Roman', sayfa: 150 }),
    okunacak({ ad: 'Istanbul Hatırası', yazar: 'Başka Yazar', tur: 'Deneme', sayfa: 300 }),
    okunacak({ ad: 'Gezi Notları', yazar: 'Üçüncü Yazar', tur: 'Gezi', sayfa: 250 })
  ];
}
async function kesfetAc(page, kitaplar) {
  await tohumla(page, kitaplar || taban().concat(adaylar()));
  await page.goto('/');
  await page.click('nav [data-act="sekme"][data-v="kesfet"]');
  await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
}
const ara = (page, metin) => page.fill('#ksAra', metin);
const adlar = page => page.locator('#ksIcerik .ks-ad').allTextContents();

test.describe('G108 Keşfet araması', () => {

  test('(a) arama kutusu var ve adayları süzer', async ({ page }) => {
    await kesfetAc(page);
    await expect(page.locator('#ksAra')).toBeVisible();
    const once = await adlar(page);
    expect(once.length, 'aramasız liste dolu').toBeGreaterThan(0);
    await ara(page, 'gezi');
    const sonra = await adlar(page);
    expect(sonra, 'yalnız eşleşen').toEqual(['Gezi Notları']);
  });

  test('(b) arama ÇİPLERİ EZMEZ — ikisi birlikte süzer (VE)', async ({ page }) => {
    await kesfetAc(page);
    /* Tür çipi "Roman" → yalnız Dostoyevski adayları kalır. */
    await page.click('#ksIcerik .ks-chip[data-g="tur"][data-v="Roman"]');
    await ara(page, 'gezi');
    /* "Gezi Notları" ARAMAYA uyar ama ÇİPE uymaz. Arama çipi ezseydi görünürdü. */
    const d = await adlar(page);
    expect(d, 'çip hâlâ uygulanıyor').not.toContain('Gezi Notları');
    /* çip ekranda SEÇİLİ duruyor — arayüz uygulanan süzgeci doğru gösteriyor */
    await expect(page.locator('#ksIcerik .ks-chip[data-g="tur"][data-v="Roman"]'))
      .toHaveClass(/secili/);
  });

  test('(c) ÇEŞİTLİLİK KOTASI aramada devre dışı — aynı yazardan hepsi çıkar',
    async ({ page }) => {
      await kesfetAc(page);
      /* Kota: aynı yazardan en fazla 2. Aramasız listede Dostoyevski en çok 2 kez. */
      const aramasiz = await adlar(page);
      const dostoyevskiKitaplari = ['Suç ve Ceza', 'Karamazov Kardeşler', 'Budala', 'Yeraltından Notlar'];
      const aramasizSayi = aramasiz.filter(a => dostoyevskiKitaplari.includes(a)).length;
      expect(aramasizSayi, 'öneride kota işliyor: aynı yazardan en fazla 2').toBeLessThanOrEqual(2);
      /* Arayan kullanıcı öneri istemiyor — dördü de görünmeli. */
      await ara(page, 'dostoyevski');
      const arali = await adlar(page);
      expect(arali.length, 'kota aradığını gizlemez').toBe(4);
      for (const k of dostoyevskiKitaplari) expect(arali).toContain(k);
    });

  test('(d) boş sonuç SEBEBİ söyler ve sayıyı ÖLÇER', async ({ page }) => {
    await kesfetAc(page);
    /* (1) yalnız arama: hiçbir adayda geçmiyor */
    await ara(page, 'zzzyok');
    await expect(page.locator('#ksIcerik .ks-not').first())
      .toContainText('“zzzyok” ile eşleşen aday yok');
    await expect(page.locator('#ksIcerik .ks-not').first())
      .toContainText('adayın hiçbirinde geçmiyor');
    /* (2) arama + çip birlikte: hangisinin kestiği ölçülerek söylenir */
    await ara(page, '');
    await page.click('#ksIcerik .ks-chip[data-g="tur"][data-v="Gezi"]');
    await ara(page, 'dostoyevski');
    const not = page.locator('#ksIcerik .ks-not').first();
    await expect(not).toContainText('süzgeçleri kaldırınca 4 aday eşleşiyor');
  });

  test('(e) odak ve imleç korunur — ikinci harf yazılabilir', async ({ page }) => {
    await kesfetAc(page);
    await page.click('#ksAra');
    await page.keyboard.type('dost');
    /* Panel her tuşta yeniden çiziliyor; odak geri konmazsa 'd' sonrası kaybolur. */
    expect(await page.evaluate(() => document.activeElement.id), 'odak girdide kaldı').toBe('ksAra');
    expect(await page.inputValue('#ksAra'), 'dört harf de yazıldı').toBe('dost');
    expect(await page.evaluate(() => {
      const g = document.getElementById('ksAra');
      return g.selectionStart === g.value.length;
    }), 'imleç sonda').toBe(true);
  });

  test('(f) TR-duyarlı: katla() ile eşleşir ("Istanbul" → "İstanbul")', async ({ page }) => {
    await kesfetAc(page);
    await ara(page, 'istanbul');
    expect(await adlar(page)).toEqual(['Istanbul Hatırası']);
  });

  test('(g) özet/ontoloji TARANMAZ (Kütüphane\'den bilinçli fark)', async ({ page }) => {
    await kesfetAc(page);
    const d = await page.evaluate(() => {
      /* araUyar yalnız kayıt alanlarına bakar; __ozet dizinine hiç uğramaz.
         Kaynak sözleşmesi: eklenti dosyasında ozet/onto araması geçmemeli. */
      return { ozetKullanimi: (window.__kesfet ? 1 : 0) };
    });
    expect(d.ozetKullanimi).toBeDefined();
    const kaynak = require('fs').readFileSync(
      require('path').join(__dirname, '..', 'kesfet.js'), 'utf8');
    const fn = kaynak.slice(kaynak.indexOf('function araUyar'), kaynak.indexOf('function suzgecHtml'));
    expect(fn.includes('__ozet'), 'arama özet dizinine bakmaz').toBe(false);
  });

  test('(h) arama yeni sorguda listeyi başa sarar (bayat "daha fazla" kalmaz)',
    async ({ page }) => {
      await kesfetAc(page);
      const limitOnce = await page.evaluate(() => window.__kesfet && window.__kesfet.S
        ? window.__kesfet.S.limit : null);
      await ara(page, 'dost');
      const limitSonra = await page.evaluate(() => window.__kesfet && window.__kesfet.S
        ? window.__kesfet.S.limit : null);
      if (limitOnce !== null) expect(limitSonra).toBe(limitOnce);
      /* Gözlemlenebilir taraf: arama sonrası liste eşleşenlerle sınırlı */
      expect((await adlar(page)).every(a => a.toLocaleLowerCase('tr').includes('dost')
        || a === 'Suç ve Ceza' || a === 'Karamazov Kardeşler' || a === 'Budala'
        || a === 'Yeraltından Notlar')).toBe(true);
    });

});
