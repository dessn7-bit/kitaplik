'use strict';
/* G109 — GÜNÜN NOTU ve FAVORİLER: v113'te AYRILDI.

   TARİHÇE (kavram iki kez yer değiştirdi, vakalar bunu belgeler):
   · v110 bloğu "Günün favorisi" yaptı, havuz ölçütü TİP yerine FAVORİ oldu,
     varsayılan DAHİL'di → 299 kayıt dolu yıldızla göründü, işaret kullanıcı
     adına beyanda bulundu.
   · v111 varsayılanı çevirdi (işaret POZİTİF) → yıldız dürüstleşti ama havuz
     boş kaldığı için blok yine ölüydü.
   · v113 KÖK NEDENİ kaldırır: yıldız iki iş birden yapıyordu — "bunu beğendim"
     VE "bunu günün havuzuna koy". İki ayrı şey, artık iki ayrı yer.

   v113 SÖZLEŞMELERİ:
   A) GÜNÜN NOTU — başlık "Günün notu"; seçim KOŞULSUZ, bütün notlar ve
      alıntılar arasından; havuz kavramı YOK; favori bu bloğu HİÇ etkilemez.
      Tip BİÇİMİ taşımaya devam eder (alıntı italik+tırnaklı, not dik+tırnaksız,
      g31). Seçim gün boyu SABİT (gün tohumu), ertesi gün değişir.
      Hiç kayıt yoksa blok çizilmez.
   B) FAVORİLER — yıldız YALNIZ favori demek. İşaretliler Defterin'de kendi
      "Favoriler" bölümünde (fvb- ad alanı, .not-kart YENİDEN KULLANILMAZ:
      aynı kayıt hem orada hem listede çizilir, aynı data-nid iki düğümde
      olamaz). Boşken bölüm gizlenmez, DAVET eder — yıldızı öğreten tek yüzey.
   C) SAYAÇ — "N alıntı · M not · K favori · L kitaptan"; favori SIFIRKEN DE
      görünür (satır bir ENVANTER, zaten "0 alıntı" yazıyor).

   TARİH BAĞIMSIZLIĞI: seçim gün tohumuna dayanıyor. İçerik sınayan vakalar
   havuzu TEK kayda indiriyor (g47'de düşülen tuzak).

   (Mutasyon 1: günün notu yine favoriye süzülür → bağımsızlık + 299 kırmızı.
    Mutasyon 2: favori negatif alan olarak yazılır → veri modeli kırmızı.
    Mutasyon 3: Favoriler bölümü boşken gizlenir → davet vakası kırmızı.
    Mutasyon 4: sayaç favoriyi sıfırken gizler → envanter vakası kırmızı.
    Mutasyon 5: favoriCevir damga basmaz → damga vakası kırmızı.) */

const { test, expect, tohumla, sahteKitap, rafAc } = require('./yardim');

let sayac = 0;
function not_(metin, ek) {
  sayac++;
  return Object.assign({ id: 'g109n' + sayac, tip: 'not', metin,
    sayfa: null, tarih: '2026-01-0' + ((sayac % 9) + 1), fikir: [] }, ek || {});
}
function alinti_(metin, ek) {
  sayac++;
  return Object.assign({ id: 'g109a' + sayac, tip: 'alinti', metin,
    sayfa: 42, tarih: '2026-01-0' + ((sayac % 9) + 1), fikir: [] }, ek || {});
}
async function defterAc(page, notlar) {
  await tohumla(page, [sahteKitap({ ad: 'Tek Kitap', yazar: 'Tek Yazar', notlar })]);
  await rafAc(page);
  await page.click('nav [data-act="sekme"][data-v="alinti"]');
}
const blok = page => page.locator('#alBolumGunun');
const favBolum = page => page.locator('#alBolumFavori');
const listeYildiz = (page, metin) =>
  page.locator(`#alintiListe .not-kart:has-text(${JSON.stringify(metin)}) .fv-yildiz`);
const stil = (page, sec, ozellik) =>
  page.evaluate(([s, o]) => getComputedStyle(document.querySelector(s))[o], [sec, ozellik]);

test.describe('G109-A Günün notu: KOŞULSUZ seçim', () => {

  test('FAVORİ YOKKEN de çizilir — v112\'de blok burada ölüydü', async ({ page }) => {
    await defterAc(page, [not_('Anlatıcının sesi ikinci bölümde değişiyor.')]);
    await expect(blok(page)).toBeVisible();
    await expect(blok(page).locator('.ga-metin'))
      .toHaveText('Anlatıcının sesi ikinci bölümde değişiyor.');
    const fav = await page.evaluate(() =>
      veri.kitaplar.flatMap(k => k.notlar).filter(n => n.favori === 1).length);
    expect(fav, 'hiç favori yok, blok yine de dolu').toBe(0);
  });

  test('başlık "Günün notu" — favori sözcüğü kalktı', async ({ page }) => {
    await defterAc(page, [not_('Yalnız bir not.')]);
    await expect(blok(page).locator('.kicker')).toHaveText('Günün notu');
  });

  test('FAVORİDEN BAĞIMSIZ: yıldız çevirmek günün notunu DEĞİŞTİRMEZ', async ({ page }) => {
    await defterAc(page, [not_('bir'), not_('iki'), alinti_('üç')]);
    const once = await blok(page).locator('.ga-metin').textContent();
    await listeYildiz(page, 'bir').click();
    expect(await blok(page).locator('.ga-metin').textContent(), 'favorileme etkilemez').toBe(once);
    await listeYildiz(page, 'iki').click();
    await listeYildiz(page, 'bir').click();   // geri al
    expect(await blok(page).locator('.ga-metin').textContent()).toBe(once);
    /* asıl kanıt: havuz kavramı yok — seçim TÜM kayıtlar üzerinden */
    const secimHavuzu = await page.evaluate(() => veri.kitaplar.flatMap(k => k.notlar).length);
    expect(secimHavuzu).toBe(3);
  });

  test('GÜN BOYU SABİT: yenilemede aynı kayıt gelir', async ({ page }) => {
    await defterAc(page, [not_('bir'), not_('iki'), alinti_('üç'), not_('dört')]);
    const once = await blok(page).locator('.ga-metin').textContent();
    await page.reload();
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    await expect(blok(page).locator('.ga-metin')).toHaveText(once);
  });

  test('NOT dik ve tırnaksız dizilir (not alıntı değildir)', async ({ page }) => {
    await defterAc(page, [not_('Dik dizilmeli.')]);
    expect(await stil(page, '#alBolumGunun .ga-metin', 'fontStyle')).toBe('normal');
    const m = await blok(page).locator('.ga-metin').textContent();
    expect(m).not.toContain('“');
    expect(m).not.toContain('”');
  });

  test('ALINTI italik ve tırnaklı kalır (g31 sözleşmesi bozulmadı)', async ({ page }) => {
    await defterAc(page, [alinti_('Eğik dizilmeli.')]);
    expect(await stil(page, '#alBolumGunun .ga-metin', 'fontStyle')).toBe('italic');
    const m = await blok(page).locator('.ga-metin').textContent();
    expect(m).toContain('“');
    expect(m).toContain('”');
  });

  test('uzun metin kırpılır ve tamamına giden yol görünür', async ({ page }) => {
    await defterAc(page, [not_('Uzun bir Goodreads yorumu. '.repeat(120))]);
    const k = await page.evaluate(() => {
      const e = document.querySelector('#alBolumGunun .ga-metin');
      return { tasiyor: e.scrollHeight > e.clientHeight + 2, satir: getComputedStyle(e).webkitLineClamp };
    });
    expect(k.tasiyor, 'kırpma çalışıyor').toBe(true);
    expect(k.satir).toBe('10');
    await expect(blok(page).locator('.ga-git')).toHaveText(/kitaba git/);
  });

  test('HİÇ KAYIT YOKKEN blok çizilmez', async ({ page }) => {
    await defterAc(page, []);
    await expect(blok(page)).toHaveCount(0);
  });

});

test.describe('G109-B Favoriler bölümü', () => {

  test('BOŞKEN gizlenmez, davet eder — yıldızı öğreten tek yüzey', async ({ page }) => {
    await defterAc(page, [not_('Seçilmemiş kayıt.')]);
    await expect(favBolum(page)).toBeVisible();
    await expect(favBolum(page).locator('.kicker')).toHaveText('Favoriler');
    await expect(favBolum(page).locator('.ga-davet')).toContainText('Henüz favori seçmedin');
    await expect(favBolum(page).locator('.fvb-kart')).toHaveCount(0);
  });

  test('HİÇ KAYIT YOKKEN bölüm çizilmez — davet gürültü olmaz', async ({ page }) => {
    await defterAc(page, []);
    await expect(favBolum(page)).toHaveCount(0);
  });

  test('yıldız işaretlenen kayıt bölüme girer, sayı rozeti çıkar', async ({ page }) => {
    await defterAc(page, [not_('Seçilen.'), not_('Seçilmeyen.')]);
    await listeYildiz(page, 'Seçilen.').click();
    await expect(favBolum(page).locator('.fvb-kart')).toHaveCount(1);
    await expect(favBolum(page).locator('.fvb-metin')).toHaveText('Seçilen.');
    await expect(favBolum(page).locator('.al-sayi')).toHaveText('1');
    await expect(favBolum(page).locator('.ga-davet')).toHaveCount(0);
    /* alttaki liste DOKUNULMAZ: favoriler kürasyon, liste envanter */
    await expect(page.locator('#alintiListe .not-kart')).toHaveCount(2);
  });

  test('geri alınabilir: ikinci tık bölümden çıkarır, davet döner', async ({ page }) => {
    await defterAc(page, [not_('Tek kayıt.')]);
    const yildiz = page.locator('#alintiListe .not-kart .fv-yildiz');
    await yildiz.click();
    await expect(favBolum(page).locator('.fvb-kart')).toHaveCount(1);
    await yildiz.click();
    await expect(favBolum(page).locator('.fvb-kart')).toHaveCount(0);
    await expect(favBolum(page).locator('.ga-davet')).toBeVisible();
    expect(await page.evaluate(() =>
      'favori' in veri.kitaplar[0].notlar[0]), 'işaret SİLİNİR, 0 yazılmaz').toBe(false);
  });

  test('favoriler bölümünden de çıkarılabilir (aynı düğme, kendi ad alanı)', async ({ page }) => {
    await defterAc(page, [not_('Tek kayıt.', { favori: 1 })]);
    await expect(favBolum(page).locator('.fvb-kart')).toHaveCount(1);
    await favBolum(page).locator('.fv-yildiz').click();
    await expect(favBolum(page).locator('.fvb-kart')).toHaveCount(0);
    /* fvb- kendi öneki: aynı kayıt iki yerde çiziliyor, .not-kart yeniden
       kullanılsaydı aynı data-nid iki düğümde olur, seçiciler gölgelenirdi */
    await expect(page.locator('#alBolumFavori .not-kart')).toHaveCount(0);
  });

  test('favoride de tip biçimi taşır: alıntı italik, not dik (g31)', async ({ page }) => {
    await defterAc(page, [alinti_('Eğik.', { favori: 1 }), not_('Dik.', { favori: 1 })]);
    const d = await page.evaluate(() => [...document.querySelectorAll('#alBolumFavori .fvb-kart')]
      .map(k => ({ metin: k.querySelector('.fvb-metin').textContent.trim(),
        stil: getComputedStyle(k.querySelector('.fvb-metin')).fontStyle })));
    expect(d.find(x => x.metin === 'Eğik.').stil).toBe('italic');
    expect(d.find(x => x.metin === 'Dik.').stil).toBe('normal');
  });

  test('DÖRT YÜZEY tutarlı: liste, detay, günün notu, favoriler bölümü', async ({ page }) => {
    await defterAc(page, [not_('Tek kayıt.')]);
    const listede = page.locator('#alintiListe .not-kart .fv-yildiz');
    await expect(listede).toHaveText('☆');
    await expect(listede).toHaveAttribute('aria-label', 'Favorilere ekle');
    await expect(blok(page).locator('.fv-yildiz'), 'günün notunda da boş').toHaveText('☆');
    await page.click('#alintiListe [data-act="alinti-git"]');
    const detayda = page.locator('#ortuDetay .not-kart .fv-yildiz');
    await expect(detayda).toHaveText('☆');
    await detayda.click();                       // seçimi DETAYDAN yap
    await expect(detayda).toHaveText('★');
    await expect(detayda).toHaveAttribute('aria-label', 'Favorilerden çıkar');
    await page.click('#ortuDetay .sheet-kapat');
    await expect(page.locator('#alintiListe .not-kart .fv-yildiz')).toHaveText('★');
    await expect(blok(page).locator('.fv-yildiz')).toHaveText('★');
    await expect(favBolum(page).locator('.fv-yildiz')).toHaveText('★');
  });

});

test.describe('G109-C Sayaç', () => {

  test('envanter: "N alıntı · M not · K favori · L kitaptan"', async ({ page }) => {
    await defterAc(page, [alinti_('a'), not_('b'), not_('c', { favori: 1 })]);
    await expect(page.locator('#alOzet')).toHaveText('1 alıntı · 2 not · 1 favori · 1 kitaptan');
  });

  test('favori SIFIRKEN DE görünür — satır envanter, zaten "0 alıntı" yazıyor', async ({ page }) => {
    await defterAc(page, [not_('b'), not_('c')]);
    await expect(page.locator('#alOzet')).toHaveText('0 alıntı · 2 not · 0 favori · 1 kitaptan');
  });

  test('hiç kayıt yokken "Henüz kayıt yok"', async ({ page }) => {
    await defterAc(page, []);
    await expect(page.locator('#alOzet')).toHaveText('Henüz kayıt yok');
  });

});

test.describe('G109-D Veri modeli ve göç', () => {

  test('işaretsiz notta favori anahtarı YOK; seçili notta favori:1', async ({ page }) => {
    await defterAc(page, [not_('İşaretsiz.')]);
    const d = await page.evaluate(() => {
      const k = veri.kitaplar[0];
      const temiz = kitapNormalize(k).notlar[0];
      const secili = kitapNormalize({ ...k, notlar: [{ ...k.notlar[0], favori: 1 }] }).notlar[0];
      return { temizdeVar: 'favori' in temiz, secilideVar: 'favori' in secili,
        seciliDeger: secili.favori };
    });
    expect(d.temizdeVar, 'işaretsiz kaydın izi değişmez').toBe(false);
    expect(d.secilideVar).toBe(true);
    expect(d.seciliDeger).toBe(1);
  });

  test('PARMAK İZİ: işaretsizler damga ÜRETMEZ, işaretleme damga BASAR', async ({ page }) => {
    /* Kaan'ın sorusu: pozitif saklama damgalama açısından sorun çıkarır mı?
       İki ayrı iddia: (1) işaretsiz kayıtlarda alan YOK → 299 kaydın izi
       kıpırdamaz, depo yazımı damga üretmez; (2) yıldız çevirmek GERÇEK bir
       kullanıcı düzenlemesidir, favori kitapParmak'ta (tekrar* gibi dışlanmaz)
       ve favoriCevir zaten ng + g basar — LWW'nin çözmesi gereken tam bu. */
    const cok = [];
    for (let i = 0; i < 60; i++) cok.push(not_('Not ' + i));
    await tohumla(page, [sahteKitap({ ad: 'Çok Notlu', notlar: cok, g: 777 })]);
    await rafAc(page);
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    const durgun = await page.evaluate(() => { depoKaydet(); return veri.kitaplar[0].g; });
    expect(durgun, 'işaretsiz kütüphane yazımı damga üretmez').toBe(777);
    await page.locator('#alintiListe .not-kart').first().locator('.fv-yildiz').click();
    const sonra = await page.evaluate(() => veri.kitaplar[0].g);
    expect(sonra, 'işaretleme kasıtlı düzenleme: damga basar').toBeGreaterThan(777);
  });

  test('GÖÇ: v110 favori:0 kaydında alan DÜŞER, favori sayılmaz', async ({ page }) => {
    await defterAc(page, [not_('v110 çıkarılmışı.', { favori: 0 }), not_('Dokunulmamış.')]);
    const d = await page.evaluate(() => {
      const n = veri.kitaplar.flatMap(k => k.notlar);
      return { alanVar: n.map(x => 'favori' in x), favori: n.map(favoriMi),
        metin: n.map(x => x.metin) };
    });
    expect(d.alanVar, 'favori:0 normalize\'da düşer').toEqual([false, false]);
    expect(d.favori).toEqual([false, false]);
    expect(d.metin, 'notun kendisine dokunulmadı')
      .toEqual(['v110 çıkarılmışı.', 'Dokunulmamış.']);
    await expect(favBolum(page).locator('.ga-davet')).toBeVisible();
    /* ama GÜNÜN NOTU yine de çizilir — v113'ün özü: ikisi bağımsız */
    await expect(blok(page).locator('.ga-metin')).toBeVisible();
  });

  test('299 NOT: favori alanı yok, Favoriler boş — ama GÜNÜN NOTU DOLU', async ({ page }) => {
    const notlar = [];
    for (let i = 1; i <= 299; i++)
      notlar.push(not_('Goodreads yorumu ' + i, (i % 100 === 0) ? { favori: 0 } : null));
    await defterAc(page, notlar);
    const d = await page.evaluate(() => {
      const n = veri.kitaplar.flatMap(k => k.notlar);
      return { toplam: n.length, alaniOlan: n.filter(x => 'favori' in x).length,
        favori: n.filter(favoriMi).length };
    });
    expect(d.toplam).toBe(299);
    expect(d.alaniOlan, 'hiçbir notta favori alanı yok').toBe(0);
    expect(d.favori, 'hiç favori yok').toBe(0);
    await expect(favBolum(page).locator('.ga-davet'), 'Favoriler davet gösterir').toBeVisible();
    /* v112'de burada blok HİÇ çizilmiyordu — v113'ün çözdüğü kusur budur */
    await expect(blok(page).locator('.ga-metin'), 'günün notu DOLU').not.toHaveText('');
    await expect(page.locator('#alOzet')).toHaveText('0 alıntı · 299 not · 0 favori · 1 kitaptan');
  });

  test('favori:1 yenilemede KORUNUR (yeni not alanı kuralı)', async ({ page }) => {
    await defterAc(page, [not_('Seçili.', { favori: 1 }), not_('Duran.')]);
    await expect(favBolum(page).locator('.fvb-kart')).toHaveCount(1);
    await page.reload();
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    await expect(favBolum(page).locator('.fvb-kart'), 'yenilemede silinmedi').toHaveCount(1);
    expect(await page.evaluate(() => veri.kitaplar[0].notlar[0].favori)).toBe(1);
  });

  test('çevirme KASITLI eylem: not damgası (ng) ve kitap damgası (g) basılır', async ({ page }) => {
    await defterAc(page, [not_('Damga.')]);
    const once = await page.evaluate(() =>
      ({ ng: veri.kitaplar[0].notlar[0].ng || 0, g: veri.kitaplar[0].g || 0 }));
    await page.click('#alintiListe .not-kart .fv-yildiz');
    const sonra = await page.evaluate(() =>
      ({ ng: veri.kitaplar[0].notlar[0].ng || 0, g: veri.kitaplar[0].g || 0 }));
    expect(sonra.ng, 'senkron not birleşimi ng ile LWW çözüyor').toBeGreaterThan(once.ng);
    expect(sonra.g, 'kitap damgası senkronu taşır').toBeGreaterThan(once.g);
  });

});
