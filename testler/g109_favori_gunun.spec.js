'use strict';
/* G109 — GÜNÜN FAVORİSİ: havuz ölçütü TİP değil FAVORİ (v110).

   KUSUR: günün bloğu yalnız tip==='alinti' havuzundan seçiyordu. Kaan'ın
   kütüphanesinde 299 not ve 0 alıntı var — havuz boş olduğu için blok hiç
   çizilmiyordu, özellik fiilen ölüydü.

   SÖZLEŞMELER:
   - Havuz = FAVORİ olan kayıtlar; tip'e bakılmaz.
   - VARSAYILAN DAHİL (Kaan kararı "hep 299 favori"): işaret koymadan da
     çalışır. Bu yüzden saklanan işaret NEGATİF — yalnız ÇIKARILDIĞINDA
     yazılır (favori: 0). İşaretsiz notun normalize çıktısında `favori`
     anahtarı HİÇ YOKTUR: parmak izi değişmez, ANLIK_SURUM turu ve toplu
     yeniden damgalama gerekmez (kayn kalıbı; tekrar* bunu yapamadığı için
     sürüm 5'e çıkmıştı).
   - Tip ayrımını BİÇİM taşır: alıntı italik + tırnaklı, not dik + tırnaksız
     (g31: italik yalnız bilinçli alıntı yüzeylerinde).
   - Uzun metin kırpılır; tamamı "kitaba git" ile bir tık ötede.
   - Favori çevirme KASITLI kullanıcı eylemi: n.ng + k.g damgası basar.

   TARİH BAĞIMSIZLIĞI: seçim gün tohumuna dayanıyor (aynı gün aynı kayıt).
   İçerik sınayan vakalar bu yüzden havuzu TEK kayda indiriyor — yoksa vaka
   yılın bazı günlerinde kırmızı yanardı (g47'de tam bu tuzağa düşülmüştü).

   (Mutasyon 1: havuz yine tip==='alinti' süzülür → 6 vaka kırmızı.
    Mutasyon 2: favori pozitif alan olarak yazılır → parmak izi vakası kırmızı.
    Mutasyon 3: favoriCevir damga basmaz → damga vakası kırmızı.) */

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
const stil = (page, sec, ozellik) =>
  page.evaluate(([s, o]) => getComputedStyle(document.querySelector(s))[o], [sec, ozellik]);

test.describe('G109 havuz: tip değil favori', () => {

  test('ALINTI YOKKEN not gösterilir — Kaan\'ın kütüphanesi (299 not, 0 alıntı)', async ({ page }) => {
    await defterAc(page, [not_('Anlatıcının sesi ikinci bölümde değişiyor.')]);
    await expect(blok(page)).toBeVisible();
    await expect(blok(page).locator('.ga-metin'))
      .toHaveText('Anlatıcının sesi ikinci bölümde değişiyor.');
    /* eski kod burada bloğu HİÇ çizmiyordu */
    const alintiSayisi = await page.evaluate(() =>
      veri.kitaplar.flatMap(k => k.notlar).filter(n => n.tip === 'alinti').length);
    expect(alintiSayisi, 'havuz alıntısız').toBe(0);
  });

  test('başlık tip bağımsız: "Günün favorisi"', async ({ page }) => {
    await defterAc(page, [not_('Yalnız bir not.')]);
    await expect(blok(page).locator('.kicker')).toHaveText('Günün favorisi');
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

});

test.describe('G109 favori işareti', () => {

  test('VARSAYILAN DAHİL: işaretsiz notların hepsi havuzda', async ({ page }) => {
    await defterAc(page, [not_('bir'), not_('iki'), alinti_('üç')]);
    const d = await page.evaluate(() =>
      veri.kitaplar.flatMap(k => k.notlar).map(n => favoriMi(n)));
    expect(d).toEqual([true, true, true]);
    await expect(page.locator('#alOzet'), 'havuz dışı yokken satır sessiz')
      .not.toContainText('havuz dışı');
  });

  test('üç yüzeyde de yıldız var: günün bloğu, Defterin listesi, kitap detayı', async ({ page }) => {
    await defterAc(page, [not_('Tek kayıt.')]);
    await expect(blok(page).locator('.fv-yildiz')).toHaveCount(1);
    await expect(page.locator('#alintiListe .not-kart .fv-yildiz')).toHaveCount(1);
    await page.click('#alintiListe [data-act="alinti-git"]');
    await expect(page.locator('#ortuDetay .not-kart .fv-yildiz')).toHaveCount(1);
  });

  test('çıkarma havuzu daraltır: blok öteki kayda geçer, özet sayıyı söyler', async ({ page }) => {
    await defterAc(page, [not_('Kalacak olan.'), not_('Çıkarılacak olan.')]);
    /* havuzu tek kayda indirmek için ÖTEKİNİ çıkarıyoruz — hangisinin
       gösterildiği gün tohumuna bağlı, bu yüzden içeriği çıkarmadan SONRA
       sınıyoruz (havuz 1 kayıt kalınca seçim belirlenir) */
    await page.click('#alintiListe .not-kart:has-text("Çıkarılacak olan.") .fv-yildiz');
    await expect(blok(page).locator('.ga-metin')).toHaveText('Kalacak olan.');
    await expect(page.locator('#alOzet')).toContainText('1 havuz dışı');
    const d = await page.evaluate(() => veri.kitaplar[0].notlar.map(n => n.favori));
    expect(d).toEqual([undefined, 0]);
  });

  test('geri alınabilir: ikinci tık kaydı havuza döndürür', async ({ page }) => {
    await defterAc(page, [not_('Kalacak olan.'), not_('Çıkarılacak olan.')]);
    const yildiz = page.locator('#alintiListe .not-kart:has-text("Çıkarılacak olan.") .fv-yildiz');
    await yildiz.click();
    await expect(page.locator('#alOzet')).toContainText('1 havuz dışı');
    await yildiz.click();
    await expect(page.locator('#alOzet')).not.toContainText('havuz dışı');
    expect(await page.evaluate(() =>
      'favori' in veri.kitaplar[0].notlar[1]), 'işaret SİLİNİR, false yazılmaz').toBe(false);
  });

  test('hepsi çıkarılırsa blok gizlenir — dürüst boşluk, çökme yok', async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', e => hatalar.push(String(e)));
    await defterAc(page, [not_('Tek kayıt.')]);
    await page.click('#alintiListe .not-kart .fv-yildiz');
    await expect(blok(page)).toHaveCount(0);
    await expect(page.locator('#alintiListe .not-kart'), 'liste dokunulmaz').toHaveCount(1);
    expect(hatalar, 'çökme yok').toEqual([]);
  });

});

test.describe('G109 veri modeli', () => {

  test('işaretsiz notun normalize çıktısında favori anahtarı YOK (parmak izi değişmez)', async ({ page }) => {
    await defterAc(page, [not_('İşaretsiz.')]);
    const d = await page.evaluate(() => {
      const k = veri.kitaplar[0];
      const temiz = kitapNormalize(k).notlar[0];
      const isaretli = kitapNormalize({ ...k, notlar: [{ ...k.notlar[0], favori: 0 }] }).notlar[0];
      return { temizdeVar: 'favori' in temiz, isaretlideVar: 'favori' in isaretli,
        isaretliDeger: isaretli.favori };
    });
    /* ASIL KANIT: bu yüzden ANLIK_SURUM turu ve toplu yeniden damgalama
       gerekmedi. Alan POZİTİF yazılsaydı 299 notun hepsi damgalanacak,
       bayat cihaz günceli ezebilecekti. */
    expect(d.temizdeVar, 'işaretsiz not v109 ile bayt bayt aynı').toBe(false);
    expect(d.isaretlideVar).toBe(true);
    expect(d.isaretliDeger).toBe(0);
  });

  test('favori: 0 yenilemede KORUNUR (yeni not alanı kuralı)', async ({ page }) => {
    await defterAc(page, [not_('Çıkarılmış.', { favori: 0 }), not_('Duran.')]);
    await expect(page.locator('#alOzet')).toContainText('1 havuz dışı');
    await page.reload();
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    await expect(page.locator('#alOzet'), 'yenilemede silinmedi').toContainText('1 havuz dışı');
    expect(await page.evaluate(() => veri.kitaplar[0].notlar[0].favori)).toBe(0);
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
