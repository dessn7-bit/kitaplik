'use strict';
/* G109 — GÜNÜN FAVORİSİ: havuz ölçütü TİP değil FAVORİ (v110),
   VARSAYILAN HAVUZ DIŞI (v111 — v110'un tersi).

   v110 KAZANIMI (duruyor): blok yalnız tip==='alinti' havuzundan seçiyordu;
   299 not / 0 alıntı olan kütüphanede havuz boştu, özellik fiilen ölüydü.
   Ölçüt TİP değil FAVORİ oldu.

   v110 KUSURU (Kaan'ın tespiti): varsayılan DAHİL'di, işaret negatifti
   (favori:0 yalnız çıkarınca yazılıyordu). Ekrandaki sonuç 299 kaydın
   HEPSİNİN dolu yıldızla görünmesiydi. Dolu yıldız her arayüzde "bunu ben
   seçtim" demektir — kullanıcı hiçbir şey seçmediği hâlde 299 kitabı
   favorilemiş görünüyordu. İşaret YALAN SÖYLÜYORDU.

   v111 SÖZLEŞMELERİ:
   - Havuz = FAVORİ olan kayıtlar; tip'e bakılmaz (v110 kazanımı korunur).
   - VARSAYILAN HAVUZ DIŞI: işaretsiz kayıt havuzda DEĞİL, yıldızı BOŞ (☆).
   - İşaret POZİTİF, yalnız SEÇİLDİĞİNDE yazılır (favori:1); geri alma alanı
     SİLER — "seçmedim" durumu alanın YOKLUĞUDUR, ikinci bir değer değil.
   - GÖÇ: v110'un favori:0 kayıtlarında alan normalize'da DÜŞER. Kayıp yok —
     favori:0 "bunu havuzda istemiyorum" demekti, yeni varsayılan zaten o.
   - BOŞ HAVUZ GİZLENMEZ, DAVET EDER. Gizleseydik varsayılanı boş olan özellik
     ilk günden görünmez olurdu (v110 öncesi kusurun ta kendisi). Havuzu "tüm
     notlara" düşürmek de seçenek değildi: seçilmemiş kaydı "Günün favorisi"
     diye göstermek, kaldırılan yalanı yön değiştirerek geri getirirdi.
     Hiç kayıt YOKKEN blok yine çizilmez (davet gürültü olurdu).
   - Özet satırı artık FAVORİYİ sayar ("N favori"), havuz dışını değil.
   - Üç yüzeyde AYNI düğme ve aynı kural: günün bloğu, Defterin listesi,
     kitap detayı.
   - Favori çevirme KASITLI kullanıcı eylemi: n.ng + k.g damgası basar.

   TARİH BAĞIMSIZLIĞI: seçim gün tohumuna dayanıyor (aynı gün aynı kayıt).
   İçerik sınayan vakalar bu yüzden havuzu TEK kayda indiriyor — yoksa vaka
   yılın bazı günlerinde kırmızı yanardı (g47'de tam bu tuzağa düşülmüştü).

   (Mutasyon 1: favoriMi varsayılanı DAHİL'e döner → varsayılan/göç/299
    vakaları kırmızı.
    Mutasyon 2: işaret yine negatif yazılır → normalize ve geri-alma kırmızı.
    Mutasyon 3: boş havuzda blok gizlenir → davet vakası kırmızı.
    Mutasyon 4: favoriCevir damga basmaz → damga vakası kırmızı.) */

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
const listeYildiz = (page, metin) =>
  page.locator(`#alintiListe .not-kart:has-text(${JSON.stringify(metin)}) .fv-yildiz`);
const stil = (page, sec, ozellik) =>
  page.evaluate(([s, o]) => getComputedStyle(document.querySelector(s))[o], [sec, ozellik]);

test.describe('G109 havuz: tip değil favori', () => {

  test('ALINTI YOKKEN de not seçilebilir — havuza alınan not blokta çıkar', async ({ page }) => {
    await defterAc(page, [not_('Anlatıcının sesi ikinci bölümde değişiyor.')]);
    await listeYildiz(page, 'Anlatıcının sesi').click();
    await expect(blok(page)).toBeVisible();
    await expect(blok(page).locator('.ga-metin'))
      .toHaveText('Anlatıcının sesi ikinci bölümde değişiyor.');
    /* v110 öncesi kod burada bloğu HİÇ çizmiyordu (havuz yalnız alıntı) */
    const alintiSayisi = await page.evaluate(() =>
      veri.kitaplar.flatMap(k => k.notlar).filter(n => n.tip === 'alinti').length);
    expect(alintiSayisi, 'havuz alıntısız').toBe(0);
  });

  test('başlık tip bağımsız: "Günün favorisi"', async ({ page }) => {
    await defterAc(page, [not_('Yalnız bir not.', { favori: 1 })]);
    await expect(blok(page).locator('.kicker')).toHaveText('Günün favorisi');
  });

  test('NOT dik ve tırnaksız dizilir (not alıntı değildir)', async ({ page }) => {
    await defterAc(page, [not_('Dik dizilmeli.', { favori: 1 })]);
    expect(await stil(page, '#alBolumGunun .ga-metin', 'fontStyle')).toBe('normal');
    const m = await blok(page).locator('.ga-metin').textContent();
    expect(m).not.toContain('“');
    expect(m).not.toContain('”');
  });

  test('ALINTI italik ve tırnaklı kalır (g31 sözleşmesi bozulmadı)', async ({ page }) => {
    await defterAc(page, [alinti_('Eğik dizilmeli.', { favori: 1 })]);
    expect(await stil(page, '#alBolumGunun .ga-metin', 'fontStyle')).toBe('italic');
    const m = await blok(page).locator('.ga-metin').textContent();
    expect(m).toContain('“');
    expect(m).toContain('”');
  });

  test('uzun metin kırpılır ve tamamına giden yol görünür', async ({ page }) => {
    await defterAc(page, [not_('Uzun bir Goodreads yorumu. '.repeat(120), { favori: 1 })]);
    const k = await page.evaluate(() => {
      const e = document.querySelector('#alBolumGunun .ga-metin');
      return { tasiyor: e.scrollHeight > e.clientHeight + 2, satir: getComputedStyle(e).webkitLineClamp };
    });
    expect(k.tasiyor, 'kırpma çalışıyor').toBe(true);
    expect(k.satir).toBe('10');
    await expect(blok(page).locator('.ga-git')).toHaveText(/kitaba git/);
  });

});

test.describe('G109 varsayılan HAVUZ DIŞI (v111)', () => {

  test('işaretsiz kayıtların HİÇBİRİ havuzda değil', async ({ page }) => {
    await defterAc(page, [not_('bir'), not_('iki'), alinti_('üç')]);
    const d = await page.evaluate(() =>
      veri.kitaplar.flatMap(k => k.notlar).map(n => favoriMi(n)));
    expect(d, 'v110 burada [true,true,true] veriyordu').toEqual([false, false, false]);
    await expect(page.locator('#alOzet'), 'favori yokken satır sessiz')
      .not.toContainText('favori');
  });

  test('BOŞ HAVUZ: blok gizlenmez, davet eder', async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', e => hatalar.push(String(e)));
    await defterAc(page, [not_('Seçilmemiş kayıt.')]);
    await expect(blok(page)).toBeVisible();
    await expect(blok(page).locator('.kicker')).toHaveText('Günün favorisi');
    await expect(blok(page).locator('.ga-davet')).toContainText('Henüz favori seçmedin');
    await expect(blok(page).locator('.ga-metin'), 'seçilmemiş kayıt GÖSTERİLMEZ').toHaveCount(0);
    await expect(page.locator('#alintiListe .not-kart'), 'liste dokunulmaz').toHaveCount(1);
    expect(hatalar, 'çökme yok').toEqual([]);
  });

  test('HİÇ KAYIT YOKKEN blok çizilmez — davet gürültü olmaz', async ({ page }) => {
    await defterAc(page, []);
    await expect(blok(page)).toHaveCount(0);
  });

  test('ÜÇ YÜZEY TUTARLI: işaretsizken boş yıldız, seçilince dolu', async ({ page }) => {
    await defterAc(page, [not_('Tek kayıt.')]);
    const listede = page.locator('#alintiListe .not-kart .fv-yildiz');
    await expect(listede).toHaveText('☆');
    await expect(listede).toHaveAttribute('aria-pressed', 'false');
    await expect(listede).toHaveAttribute('aria-label', 'Favorilere ekle');
    await page.click('#alintiListe [data-act="alinti-git"]');
    const detayda = page.locator('#ortuDetay .not-kart .fv-yildiz');
    await expect(detayda).toHaveText('☆');
    await expect(detayda).toHaveAttribute('aria-pressed', 'false');
    // seçimi DETAYDAN yap: üç yüzey aynı düğmeyi paylaşıyor mu, çevirme her yerden mi işliyor
    await detayda.click();
    await expect(detayda).toHaveText('★');
    await expect(detayda).toHaveAttribute('aria-pressed', 'true');
    await expect(detayda).toHaveAttribute('aria-label', 'Favorilerden çıkar');
    await page.click('#ortuDetay .sheet-kapat');
    await expect(page.locator('#alintiListe .not-kart .fv-yildiz')).toHaveText('★');
    await expect(blok(page).locator('.fv-yildiz'), 'blokta da dolu').toHaveText('★');
  });

  test('seçim havuzu KURAR: blok o kaydı gösterir, özet "1 favori" der', async ({ page }) => {
    await defterAc(page, [not_('Seçilen.'), not_('Seçilmeyen.')]);
    await listeYildiz(page, 'Seçilen.').click();
    /* havuz tek kayda indi → seçim belirlendi, gün tohumundan bağımsız */
    await expect(blok(page).locator('.ga-metin')).toHaveText('Seçilen.');
    await expect(page.locator('#alOzet')).toContainText('1 favori');
    const d = await page.evaluate(() => veri.kitaplar[0].notlar.map(n => n.favori));
    expect(d).toEqual([1, undefined]);
  });

  test('geri alınabilir: ikinci tık alanı SİLER, blok davete döner', async ({ page }) => {
    await defterAc(page, [not_('Tek kayıt.')]);
    const yildiz = page.locator('#alintiListe .not-kart .fv-yildiz');
    await yildiz.click();
    await expect(page.locator('#alOzet')).toContainText('1 favori');
    await yildiz.click();
    await expect(page.locator('#alOzet')).not.toContainText('favori');
    await expect(blok(page).locator('.ga-davet')).toBeVisible();
    expect(await page.evaluate(() =>
      'favori' in veri.kitaplar[0].notlar[0]), 'işaret SİLİNİR, 0 yazılmaz').toBe(false);
  });

});

test.describe('G109 veri modeli ve göç', () => {

  test('işaretsiz notta favori anahtarı YOK; seçili notta favori:1', async ({ page }) => {
    await defterAc(page, [not_('İşaretsiz.')]);
    const d = await page.evaluate(() => {
      const k = veri.kitaplar[0];
      const temiz = kitapNormalize(k).notlar[0];
      const secili = kitapNormalize({ ...k, notlar: [{ ...k.notlar[0], favori: 1 }] }).notlar[0];
      return { temizdeVar: 'favori' in temiz, secilideVar: 'favori' in secili,
        seciliDeger: secili.favori };
    });
    /* İşaretsiz notun çıktısı v110'daki ile BAYT BAYT AYNI: varsayılanı
       değiştirmek 299 notun parmak izine dokunmadı. Değişen tek şey favori:0
       taşıyan kayıtlar — ANLIK_SURUM 13 turu onlar için. */
    expect(d.temizdeVar, 'işaretsiz not v110 ile aynı').toBe(false);
    expect(d.secilideVar).toBe(true);
    expect(d.seciliDeger).toBe(1);
  });

  test('GÖÇ: v110 favori:0 kaydında alan DÜŞER, kayıt havuz dışı kalır', async ({ page }) => {
    await defterAc(page, [not_('v110 çıkarılmışı.', { favori: 0 }), not_('Dokunulmamış.')]);
    const d = await page.evaluate(() => {
      const n = veri.kitaplar.flatMap(k => k.notlar);
      return { alanVar: n.map(x => 'favori' in x), havuzda: n.map(favoriMi),
        metinKorundu: n.map(x => x.metin) };
    });
    expect(d.alanVar, 'favori:0 normalize\'da düşer').toEqual([false, false]);
    /* KAYIP YOK: favori:0 "bunu havuzda istemiyorum" demekti; yeni varsayılan
       zaten o. Kullanıcının ifade ettiği tek tercih aynen korunuyor. */
    expect(d.havuzda, 'çıkarılmış kayıt yine havuz dışı').toEqual([false, false]);
    expect(d.metinKorundu, 'notun kendisine dokunulmadı')
      .toEqual(['v110 çıkarılmışı.', 'Dokunulmamış.']);
    await expect(blok(page).locator('.ga-davet')).toBeVisible();
  });

  test('299 NOT: hiçbirinde favori alanı yok, hepsi havuz dışı', async ({ page }) => {
    /* Kaan'ın doğrulama şartı. Fikstür onun kütüphanesinin şeklini taklit
       ediyor: 299 not, 0 alıntı; aralarında v110'dan kalma 3 favori:0. */
    const notlar = [];
    for(let i = 1; i <= 299; i++)
      notlar.push(not_('Goodreads yorumu ' + i, (i % 100 === 0) ? { favori: 0 } : null));
    await defterAc(page, notlar);
    const d = await page.evaluate(() => {
      const n = veri.kitaplar.flatMap(k => k.notlar);
      /* depoKaydet: tohumla HAM tohumu depoya yazar, uygulama onu bellekte
         normalize eder ama kullanıcı bir şey değiştirene kadar geri YAZMAZ —
         ham tohumdaki favori:0 bu yüzden diskte durur. Gerçek yolu (ilk
         yazım) burada tetikliyoruz: göç diske de inmeli. */
      depoKaydet();
      return { toplam: n.length, alaniOlan: n.filter(x => 'favori' in x).length,
        havuzda: n.filter(favoriMi).length,
        depodaGecen: (localStorage.getItem('kk_kitaplik_v1') || '').includes('"favori"') };
    });
    expect(d.toplam).toBe(299);
    expect(d.alaniOlan, 'hiçbir notta favori alanı yok').toBe(0);
    expect(d.havuzda, 'hepsi havuz dışı').toBe(0);
    expect(d.depodaGecen, 'depoya da yazılmadı').toBe(false);
    await expect(blok(page).locator('.ga-davet'), 'blok davet gösterir').toBeVisible();
    await expect(page.locator('#alOzet')).not.toContainText('favori');
    const yildizlar = await page.locator('#alintiListe .fv-yildiz').evaluateAll(
      els => [...new Set(els.map(e => e.textContent.trim()))]);
    expect(yildizlar, '299 yıldızın hepsi BOŞ — v110\'da hepsi doluydu').toEqual(['☆']);
  });

  test('favori:1 yenilemede KORUNUR (yeni not alanı kuralı)', async ({ page }) => {
    await defterAc(page, [not_('Seçili.', { favori: 1 }), not_('Duran.')]);
    await expect(page.locator('#alOzet')).toContainText('1 favori');
    await page.reload();
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    await expect(page.locator('#alOzet'), 'yenilemede silinmedi').toContainText('1 favori');
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
