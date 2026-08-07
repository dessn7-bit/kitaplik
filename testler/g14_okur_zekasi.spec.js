'use strict';
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc, rafYenile } = require('./yardim');

/* Bu yılın tarihleri — projeksiyon/hedef testleri yıl sınırında da tutsun */
const YIL = new Date().getFullYear();
const buYil = (ay, gun) => `${YIL}-${String(ay).padStart(2, '0')}-${String(gun).padStart(2, '0')}`;

function bitmis(ad, tur, yazar, puan, sayfa) {
  return sahteKitap({ ad, tur, yazar, puan, sayfa: sayfa || 300,
    durum: 'bitti', bitisTarihi: buYil(3, 15), guncelSayfa: sayfa || 300 });
}
async function istAc(page) {
  await rafAc(page);
  await page.click('[data-act="sekme"][data-v="ist"]');
  await expect(page.locator('#zkSarmal')).toBeVisible();
}

/* --------- M1: tür / yazar puan analizi --------- */
test.describe('G14 M1 — tür ve yazar puan analizi', () => {

  test('3+ kitaplı tür ortalaması doğru hesaplanır', async ({ page }) => {
    await tohumla(page, [
      bitmis('F1', 'Felsefe', 'Y1', 8), bitmis('F2', 'Felsefe', 'Y2', 9), bitmis('F3', 'Felsefe', 'Y3', 7)
    ]);
    await istAc(page);
    const t = await page.evaluate(() => window.__zeka.turOrtalamalari());
    expect(t.yeterli).toEqual([{ ad: 'Felsefe', adet: 3, ort: 8 }]);
    await expect(page.locator('#zkPuanKart')).toContainText('Felsefe');
    await expect(page.locator('#zkPuanKart')).toContainText('8.0');
  });

  test('2 kitaplı tür eşiğin altında kalır, "yeterli veri yok" satırında görünür', async ({ page }) => {
    await tohumla(page, [
      bitmis('F1', 'Felsefe', 'Y1', 8), bitmis('F2', 'Felsefe', 'Y2', 9), bitmis('F3', 'Felsefe', 'Y3', 7),
      bitmis('R1', 'Roman', 'Y4', 6), bitmis('R2', 'Roman', 'Y5', 5)
    ]);
    await istAc(page);
    const t = await page.evaluate(() => window.__zeka.turOrtalamalari());
    expect(t.yeterli.map(g => g.ad)).toEqual(['Felsefe']);
    expect(t.zayif.map(g => g.ad)).toContain('Roman');
    await expect(page.locator('#zkZayif')).toContainText('Roman (2)');
  });

  test('puansız bitirilmiş kitap ortalamaya KATILMAZ', async ({ page }) => {
    await tohumla(page, [
      bitmis('F1', 'Felsefe', 'Y1', 10), bitmis('F2', 'Felsefe', 'Y2', 10), bitmis('F3', 'Felsefe', 'Y3', 10),
      sahteKitap({ ad: 'Puansız', tur: 'Felsefe', yazar: 'Y9', durum: 'bitti', bitisTarihi: buYil(4, 1), puan: null })
    ]);
    await istAc(page);
    const t = await page.evaluate(() => window.__zeka.turOrtalamalari());
    expect(t.yeterli[0]).toEqual({ ad: 'Felsefe', adet: 3, ort: 10 });   // 4. kitap sayılmadı
  });

  test('hiç puanlı kitap yoksa kart anlamlı boş mesaj verir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Okunacak Kitap', tur: 'Roman' })]);
    await istAc(page);
    expect(await page.locator('#zkPuanKart').count()).toBe(0);   // hiç veri yok → kart çizilmez
  });
});

/* --------- M2: bırakma analizi --------- */
test.describe('G14 M2 — bırakma analizi', () => {

  test('bitirme oranı ve ortalama bırakma noktası doğru', async ({ page }) => {
    await tohumla(page, [
      bitmis('B1', 'Roman', 'Y1', 8), bitmis('B2', 'Roman', 'Y2', 7), bitmis('B3', 'Roman', 'Y3', 9),
      sahteKitap({ ad: 'Yarım Bir', durum: 'yarim', sayfa: 200, guncelSayfa: 40 }),   // %20
      sahteKitap({ ad: 'Yarım İki', durum: 'yarim', sayfa: 100, guncelSayfa: 60 })    // %60
    ]);
    await istAc(page);
    const b = await page.evaluate(() => window.__zeka.birakmaAnalizi());
    expect(b.bitti).toBe(3);
    expect(b.yarim).toBe(2);
    expect(b.oran).toBe(60);        // 3 / 5
    expect(b.ortNokta).toBe(40);    // (20 + 60) / 2
    await expect(page.locator('#zkBirakmaKart')).toContainText('%60');
    await expect(page.locator('#zkBirakmaKart')).toContainText('Yarım İki');
  });

  test('sayfa bilgisi olmayan yarım kitap ortalama noktaya katılmaz', async ({ page }) => {
    await tohumla(page, [
      bitmis('B1', 'Roman', 'Y1', 8),
      sahteKitap({ ad: 'Ölçülebilir', durum: 'yarim', sayfa: 200, guncelSayfa: 100 }),  // %50
      sahteKitap({ ad: 'Sayfasız', durum: 'yarim', sayfa: null, guncelSayfa: 0 })
    ]);
    await istAc(page);
    const b = await page.evaluate(() => window.__zeka.birakmaAnalizi());
    expect(b.yarim).toBe(2);
    expect(b.olculebilirAdet).toBe(1);
    expect(b.ortNokta).toBe(50);
    expect(b.liste.map(x => x.ad)).toEqual(['Ölçülebilir']);
  });

  test('hiç yarım kitap yoksa kart uygun mesaj verir', async ({ page }) => {
    await tohumla(page, [bitmis('B1', 'Roman', 'Y1', 8)]);
    await istAc(page);
    await expect(page.locator('#zkBirakmaKart')).toContainText('%100');
    await expect(page.locator('#zkBirakmaKart')).toContainText('Yarım bıraktığın kitap yok');
  });
});

/* --------- M3: oturumlardan gerçek aylık sayfa --------- */
const AY_ONCE = new Date(); AY_ONCE.setDate(15); AY_ONCE.setMonth(AY_ONCE.getMonth() - 1);
const BU_AY = new Date(); BU_AY.setDate(10);

test.describe('G14 M3 — fiilen okunan aylık sayfa', () => {

  test('iki farklı ayda oturumu olan tek kitap iki aya BÖLÜNÜR', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Bölünen Kitap', durum: 'okunuyor', sayfa: 400,
      guncelSayfa: 150, baslamaTarihi: bugunISO(-40), oturumlar: [
        { b: AY_ONCE.getTime(), s: 3600000, sa: 0, sb: 60 },
        { b: BU_AY.getTime(), s: 3600000, sa: 60, sb: 150 }
      ] })]);
    await istAc(page);
    const a = await page.evaluate(() => window.__zeka.aylikSayfa());
    const anahtar = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const [gecenAy, buAy] = await page.evaluate(([g, b]) => [g, b],
      [anahtar(AY_ONCE), anahtar(BU_AY)]);
    expect(a.harita[gecenAy]).toBe(60);    // tümü bitiş ayına yığılmadı
    expect(a.harita[buAy]).toBe(90);
    expect(a.toplam).toBe(150);
    await expect(page.locator('#zkAylikKart')).toBeVisible();
  });

  test('oturumsuz kütüphanede kart çizilmez', async ({ page }) => {
    await tohumla(page, [bitmis('Oturumsuz', 'Roman', 'Y1', 8)]);
    await istAc(page);
    expect(await page.locator('#zkAylikKart').count()).toBe(0);
  });

  test('sup:true (unutulmuş) oturumlar sayılmaz', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Unutulmuş', durum: 'okunuyor', sayfa: 300,
      baslamaTarihi: bugunISO(-5), oturumlar: [
        { b: BU_AY.getTime(), s: 1800000, sa: 0, sb: 25 },
        { b: BU_AY.getTime(), s: 4 * 3600000, sa: 25, sb: 999, sup: true }
      ] })]);
    await istAc(page);
    const a = await page.evaluate(() => window.__zeka.aylikSayfa());
    expect(a.toplam).toBe(25);          // sup'lu oturum katılmadı
    expect(a.oturumSayisi).toBe(1);
  });
});

/* --------- M4: saat bazlı alışkanlık --------- */
function saatte(saat, gunKayma) {
  const d = new Date(); d.setDate(d.getDate() - (gunKayma || 0));
  d.setHours(saat, 0, 0, 0);
  return d.getTime();
}

test.describe('G14 M4 — saat bazlı okuma alışkanlığı', () => {

  test('dağılım doğru dilimlere yazılır ve zirve doğru', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Saatli', durum: 'okunuyor', sayfa: 400,
      baslamaTarihi: bugunISO(-10), oturumlar: [
        { b: saatte(21, 1), s: 3600000, sa: 0, sb: 30 },    // akşam
        { b: saatte(20, 2), s: 3600000, sa: 30, sb: 60 },   // akşam
        { b: saatte(9, 3), s: 1800000, sa: 60, sb: 75 },    // sabah
        { b: saatte(14, 4), s: 600000, sa: 75, sb: 80 },    // öğleden sonra
        { b: saatte(2, 5), s: 600000, sa: 80, sb: 85 }      // gece
      ] })]);
    await istAc(page);
    const s = await page.evaluate(() => window.__zeka.saatDagilimi());
    expect(s.yeterli).toBe(true);
    const kova = ad => s.kovalar.find(k => k.ad === ad);
    expect(kova('Akşam').adet).toBe(2);
    expect(kova('Sabah').adet).toBe(1);
    expect(kova('Öğleden sonra').adet).toBe(1);
    expect(kova('Gece').adet).toBe(1);
    expect(s.zirve.ad).toBe('Akşam');
    await expect(page.locator('#zkSaatOzet')).toContainText('Akşam');
    await expect(page.locator('#zkSaatOzet')).toContainText('18–24');
  });

  test('5 oturumun altında kart "yeterli veri yok" der', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Az Oturum', durum: 'okunuyor', sayfa: 200,
      baslamaTarihi: bugunISO(-3), oturumlar: [
        { b: saatte(21, 1), s: 3600000, sa: 0, sb: 20 },
        { b: saatte(21, 2), s: 3600000, sa: 20, sb: 40 }
      ] })]);
    await istAc(page);
    const s = await page.evaluate(() => window.__zeka.saatDagilimi());
    expect(s.yeterli).toBe(false);
    await expect(page.locator('#zkSaatYetersiz')).toContainText('Yeterli veri yok');
    expect(await page.locator('#zkSaatOzet').count()).toBe(0);
  });

  test('sup:true oturumlar saat dağılımına girmez', async ({ page }) => {
    const oturumlar = [1, 2, 3, 4, 5].map(g => ({ b: saatte(21, g), s: 3600000, sa: g * 10, sb: g * 10 + 10 }));
    oturumlar.push({ b: saatte(3, 6), s: 4 * 3600000, sa: 0, sb: 0, sup: true });
    await tohumla(page, [sahteKitap({ ad: 'Suplu', durum: 'okunuyor', sayfa: 400,
      baslamaTarihi: bugunISO(-8), oturumlar })]);
    await istAc(page);
    const s = await page.evaluate(() => window.__zeka.saatDagilimi());
    expect(s.toplamOturum).toBe(5);
    expect(s.kovalar.find(k => k.ad === 'Gece').adet).toBe(0);
  });
});

/* --------- M5: sayfa bazlı yıllık hedef --------- */
test.describe('G14 M5 — sayfa bazlı yıllık hedef', () => {

  test('sayfa hedefi kaydedilir ve ilerleme doğru hesaplanır', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Kalın Kitap', durum: 'bitti', sayfa: 900, bitisTarihi: buYil(2, 10), puan: 9, tur: 'Felsefe' }),
      sahteKitap({ ad: 'İnce Kitap', durum: 'bitti', sayfa: 100, bitisTarihi: buYil(3, 5), puan: 7, tur: 'Roman' }),
      sahteKitap({ ad: 'Geçen Yıl', durum: 'bitti', sayfa: 500, bitisTarihi: (YIL - 1) + '-06-01', puan: 8 })
    ]);
    await istAc(page);
    await page.fill('#zkHedefSayfaGiris', '5000');
    await page.click('[data-act="zk-hedef-kaydet"]');
    await expect(page.locator('#toast')).toContainText('sayfa hedefi');
    const d = await page.evaluate(() => window.__zeka.sayfaHedefDurum());
    expect(d.hedef).toBe(5000);
    expect(d.ilerleme).toBe(1000);      // yalnız BU yıl bitenler: 900 + 100
    expect(d.kitapSayisi).toBe(2);
    expect(d.yuzde).toBe(20);
    await expect(page.locator('#zkSayfaBar')).toBeVisible();
    await expect(page.locator('#zkSayfaHedefKart')).toContainText('1.000 / 5.000');
  });

  test('sayfa yenilendiğinde hedefSayfa ve damgası KORUNUR', async ({ page }) => {
    await tohumla(page, { kitaplar: [bitmis('K1', 'Roman', 'Y1', 8, 200)],
      hedef: {}, hedefG: {}, silinenler: {},
      hedefSayfa: { [YIL]: 12000 }, hedefSayfaG: { [YIL]: 4242 } });
    await rafAc(page);
    expect(await page.evaluate(y => veri.hedefSayfa[y], YIL)).toBe(12000);
    await rafYenile(page);
    const s = await page.evaluate(y => ({ h: veri.hedefSayfa[y], g: veri.hedefSayfaG[y] }), YIL);
    expect(s.h).toBe(12000);
    expect(s.g).toBe(4242);            // yeniden damgalanmadı
  });

  test('senkron birleştirmede damgası yeni olan kazanır', async ({ page }) => {
    await tohumla(page, { kitaplar: [bitmis('K1', 'Roman', 'Y1', 8, 200)],
      hedef: {}, hedefG: {}, silinenler: {},
      hedefSayfa: { [YIL]: 9000 }, hedefSayfaG: { [YIL]: 5000 } });
    await rafAc(page);
    const sonuc = await page.evaluate(y => {
      const yerelYeni = window.__senkron.birlestir(veri,
        { kitaplar: [], silinenler: {}, hedefSayfa: { [y]: 3000 }, hedefSayfaG: { [y]: 1000 } });
      const uzakYeni = window.__senkron.birlestir(veri,
        { kitaplar: [], silinenler: {}, hedefSayfa: { [y]: 3000 }, hedefSayfaG: { [y]: 9999 } });
      return { yerel: yerelYeni.hedefSayfa[y], uzak: uzakYeni.hedefSayfa[y] };
    }, YIL);
    expect(sonuc.yerel).toBe(9000);   // yerel damga daha yeni
    expect(sonuc.uzak).toBe(3000);    // uzak damga daha yeni
  });

  test('hedef girilmemişse ilerleme çubuğu ve projeksiyon yer kaplamaz', async ({ page }) => {
    await tohumla(page, [bitmis('K1', 'Roman', 'Y1', 8, 200)]);
    await istAc(page);
    await expect(page.locator('#zkSayfaHedefKart')).toBeVisible();
    expect(await page.locator('#zkSayfaBar').count()).toBe(0);       // çubuk yok
    await expect(page.locator('#zkSayfaHedefKart')).not.toContainText('projeksiyon');
    await expect(page.locator('#zkHedefSayfaGiris')).toHaveValue('');
  });
});
