'use strict';
/* G111 (v118) — YAZAR ADI VARYANT DENETİMİ + KAPAK WORKER YEDEĞİNİN YAZAR KAPISI
 *
 * NEDEN BU GRUP VAR:
 *  1) Aynı kişinin iki yazımı (Jean-Paul / Jean Paul) v116 mükerrer korumasını
 *     kaçırtıyordu. Denetim bunu bulur ama BİRLEŞTİRMEYİ KULLANICI ONAYLAR —
 *     otomatik birleştirme bilinçli olarak YOK (Levenshtein kütüphane büyüdükçe
 *     yanlış pozitif üretir; yanlış birleştirme geri dönüşü zor).
 *  2) Kapak worker yedeği (Goodreads/1000Kitap) ölçümde 46 kapaksız kaydın 45'ini
 *     buluyordu AMA yalnız-başlık eşleşmesinde 5'i YANLIŞ KİTAPTI. Yazar kapısı
 *     o 5'ini eler. Bu grup kapının AÇIK kaldığını dondurur — kapı düşerse
 *     kullanıcının rafına sessizce yanlış kapak girer.
 */
const { test, expect, tohumla, sahteKitap, rafAc, ayarlarAc } = require('./yardim');

/* Ölçülmüş gerçek vakalar (8 Eylül yedeği) — kapının elemesi GEREKENLER */
const YANLIS_ESLESMELER = [
  ['Alexander Pushkin', 'Stuart MacBride'],              // "The Coffin Maker" -> "...'s Garden"
  ['Alexander Pushkin', 'Ebru Omurcalı'],                // "Atış" -> "Atıştırmalıklar Kitabı"
  ['Jean-Paul Sartre', 'Kristin Harmel'],                // "the room" -> "The Room on Rue Amelie"
  ['Carl Zimmer', 'Frances Ashcroft'],                   // "Yaşamın Kıyısında"
  ['James D. Watson, Andrew Berry', 'Kevin Davies']      // "DNA - Genetik Devrimin Öyküsü"
];
/* Kapının GEÇİRMESİ gerekenler — aynı eser, farklı yazım/eksik ortak yazar */
const DOGRU_ESLESMELER = [
  ['John Gribbin, Mary Gribbin', 'John Gribbin'],        // kayıtta iki yazar, kaynakta bir
  ['Hayrettin ihsan Erkoc', 'Hayrettin İhsan Erkoç'],    // i-ailesi + aksan
  ['Rick Riordan', 'Rick Riordan']
];

test.describe('G111 yazar varyantı + kapak yedeği kapısı (v118)', () => {

  test('A) yazarUyar: ölçülmüş 5 YANLIŞ eşleşmenin hepsi reddedilir', async ({ page }) => {
    await rafAc(page);
    const sonuc = await page.evaluate(ciftler =>
      ciftler.map(([a, b]) => window.__zengin.yazarUyar(a, b)), YANLIS_ESLESMELER);
    expect(sonuc).toEqual([false, false, false, false, false]);
  });

  test('B) yazarUyar: aynı eserin meşru yazım farkları kabul edilir', async ({ page }) => {
    await rafAc(page);
    const sonuc = await page.evaluate(ciftler =>
      ciftler.map(([a, b]) => window.__zengin.yazarUyar(a, b)), DOGRU_ESLESMELER);
    expect(sonuc).toEqual([true, true, true]);
  });

  test('C) yazarUyar: yazar boşsa kapı kurulamaz → reddeder (uydurma kapak yok)', async ({ page }) => {
    await rafAc(page);
    const sonuc = await page.evaluate(() => [
      window.__zengin.yazarUyar('', 'Biri'),
      window.__zengin.yazarUyar('Biri', ''),
      window.__zengin.yazarUyar('Carl Sagan', null)
    ]);
    expect(sonuc).toEqual([false, false, false]);
  });

  test('D) workerKapakSessiz: yazar tutmayan sonuçtan kapak ALMAZ', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Atış', yazar: 'Alexander Pushkin', kapak: '' })]);
    await rafAc(page);
    const kpk = await page.evaluate(async () => {
      window.__ara.worker = async () => [
        { ad: 'Atıştırmalıklar Kitabı', yazar: 'Ebru Omurcalı', kapak: 'https://ornek/yanlis.jpg' }
      ];
      return window.__zengin.workerKapakSessiz({ ad: 'Atış', yazar: 'Alexander Pushkin' });
    });
    expect(kpk).toBe('');   // kapı tuttu: yanlış kapak yazılmadı
  });

  test('E) workerKapakSessiz: başlık VE yazar uyunca kapağı alır', async ({ page }) => {
    await rafAc(page);
    const kpk = await page.evaluate(async () => {
      window.__ara.worker = async () => [
        { ad: 'Atış', yazar: 'Alexander Pushkin', kapak: 'https://ornek/dogru.jpg' }
      ];
      return window.__zengin.workerKapakSessiz({ ad: 'Atış', yazar: 'Alexander Pushkin' });
    });
    expect(kpk).toContain('ornek/dogru.jpg');
  });

  test('F) varyant bulunur: noktalama farkı VE harf çevirisi', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Bulantı', yazar: 'Jean-Paul Sartre' }),
      sahteKitap({ ad: 'Duvar', yazar: 'Jean-Paul Sartre' }),
      sahteKitap({ ad: 'Toplu Oyunlar 2', yazar: 'Jean Paul Sartre' }),
      sahteKitap({ ad: 'Yüzbaşının Kızı', yazar: 'Alexander Pushkin' }),
      sahteKitap({ ad: 'Mektuplarla Roman', yazar: 'Alexandr Puškin' }),
      sahteKitap({ ad: 'Körlük', yazar: 'José Saramago' })          // ilgisiz: gruplanmamalı
    ]);
    await rafAc(page);
    const gruplar = await page.evaluate(() => window.__yv.gruplar());
    expect(gruplar).toHaveLength(2);
    const duz = gruplar.map(g => g.adlar.slice().sort().join('|')).sort();
    expect(duz.some(s => s.includes('Jean-Paul Sartre') && s.includes('Jean Paul Sartre'))).toBe(true);
    expect(duz.some(s => s.includes('Alexander Pushkin') && s.includes('Puškin'))).toBe(true);
    expect(JSON.stringify(gruplar)).not.toContain('Saramago');
  });

  test('G) hedef ÇOĞUNLUKTUR; eşitlik ayrıca işaretlenir', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'A', yazar: 'Jean-Paul Sartre' }),
      sahteKitap({ ad: 'B', yazar: 'Jean-Paul Sartre' }),
      sahteKitap({ ad: 'C', yazar: 'Jean Paul Sartre' })
    ]);
    await rafAc(page);
    const g = await page.evaluate(() => window.__yv.gruplar()[0]);
    expect(g.hedef).toBe('Jean-Paul Sartre');
    expect(g.esitlik).toBe(false);
    expect(g.say[0]).toBe(2);
  });

  /* H) DENETİM TEK BAŞINA HİÇBİR ŞEYİ DEĞİŞTİRMEZ.
     Bu vaka GERÇEK UI YOLUNDAN geçer (düğmeye tıklar, panel çizilir): ilk
     yazımında yalnız __yv.gruplar() çağırıyordu ve "denetim çizerken
     kendiliğinden birleştirsin" mutasyonu HAYATTA KALDI — çizim yolu hiç
     koşmuyordu. Savunmanın testi, savunmanın gerçekten koştuğu yolda kurulur. */
  test('H) DENETİM TEK BAŞINA HİÇBİR ŞEYİ DEĞİŞTİRMEZ (otomatik birleştirme yok)', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'A', yazar: 'Jean-Paul Sartre', g: 1000 }),
      sahteKitap({ ad: 'C', yazar: 'Jean Paul Sartre', g: 1000 })
    ]);
    await rafAc(page);
    await ayarlarAc(page);
    await page.click('#ayBolumZengin [data-act="yv-denetle"]');
    await expect(page.locator('#yvDenetimGovde')).toContainText('olası varyant bulundu');
    /* panel çizildi, gruplar listelendi — kayıtlar HÂLÂ dokunulmamış olmalı */
    const son = await page.evaluate(() => veri.kitaplar.map(k => ({ y: k.yazar, g: k.g })));
    expect(son.map(x => x.y).sort()).toEqual(['Jean Paul Sartre', 'Jean-Paul Sartre']);
    expect(son.every(x => x.g === 1000)).toBe(true);   // tek bir damga bile atılmadı
    /* birleştirme düğmeleri SUNULUR ama kendiliğinden basılmaz */
    await expect(page.locator('#yvDenetimGovde [data-act="yv-birlestir"]')).toHaveCount(2);
  });

  test('I) birleştirme: azınlık hedefe döner, k.g damgalanır, öbür kayıtlar bozulmaz', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'A', yazar: 'Jean-Paul Sartre', g: 1000 }),
      sahteKitap({ ad: 'B', yazar: 'Jean-Paul Sartre', g: 1000 }),
      sahteKitap({ ad: 'C', yazar: 'Jean Paul Sartre', g: 1000 }),
      sahteKitap({ ad: 'D', yazar: 'José Saramago', g: 1000 })
    ]);
    await rafAc(page);
    const n = await page.evaluate(() => {
      const g = window.__yv.gruplar()[0];
      return window.__yv.birlestir('Jean-Paul Sartre', g.adlar);
    });
    expect(n).toBe(1);   // yalnız azınlık kayıt değişti
    const son = await page.evaluate(() => veri.kitaplar.map(k => ({ ad: k.ad, y: k.yazar, g: k.g })));
    expect(son.find(x => x.ad === 'C').y).toBe('Jean-Paul Sartre');
    expect(son.find(x => x.ad === 'C').g).toBeGreaterThan(1000);       // senkron damgası
    expect(son.find(x => x.ad === 'A').g).toBe(1000);                  // dokunulmadı
    expect(son.find(x => x.ad === 'D').y).toBe('José Saramago');       // ilgisiz yazar bozulmadı
    const kalan = await page.evaluate(() => window.__yv.gruplar().length);
    expect(kalan).toBe(0);
  });

  test('J) Ayarlar: denetim düğmesi var ve YENİ .ay-bolum açılmamış (g48 kilidi)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ yazar: 'Jean-Paul Sartre' })]);
    await rafAc(page);
    await ayarlarAc(page);
    await expect(page.locator('#ayBolumZengin [data-act="yv-denetle"]')).toHaveCount(1);
    /* Bölüm envanteri g48'in değişmezi (#ortuAyar kapsamı, 9 bölüm); burada
       yalnız "yeni bölüm AÇILMADI" tekrar doğrulanır — belge geneli seçici
       ayarlar dışındaki .ay-bolum'ü de sayardı. */
    await expect(page.locator('#ortuAyar .ay-bolum')).toHaveCount(9);
  });

  test('K) denetim penceresi grupları listeler; boşken dürüst mesaj verir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Tek', yazar: 'José Saramago' })]);
    await rafAc(page);
    await ayarlarAc(page);
    await page.click('#ayBolumZengin [data-act="yv-denetle"]');
    await expect(page.locator('#yvDenetimGovde')).toContainText('varyant bulunamadı');
  });
});
