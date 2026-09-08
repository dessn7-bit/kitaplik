'use strict';
/* G110 — TEK KAYIT SİLME (v117).

   ÖLÇÜM (bu sprintin başında): silme YOK sanılıyordu, iki yol VARDI —
   detay ▸ katlanmış "Kapak, düzenle & diğer" ▸ Sil, ve çoklu seçim ▸ Sil.
   Yani asıl sorun görünürlüktü; ama ölçüm üç GERÇEK kusur da buldu:

   1. DETAY YOLU MEZAR TAŞI YAZMIYORDU. `veri.silinenler[id]` yalnız toplu
      yolda yazılıyordu; detay yolu damgala()'nın otomatik ağına güveniyordu
      (kaybolan parmak izi → mezar, senkron.js). O ağ göç turunda ATLANIR
      (`if(!goc)`), yani şema göçüyle aynı ana denk gelen silme öbür cihazdan
      geri dirilirdi. Bu, aynı kuralın iki yerde iki kopya yazılmasının
      bedeliydi — v116'nın `__kopya` dersinin birebir tekrarı.
   2. HİÇBİR YOL ÖZETİ/ONTOLOJİYİ SİLMİYORDU. `__ozet`te `sil()` metodu yoktu;
      yetim kayıt IDB'de kalıyor, JSON yedeğine (hepsiDisa) ve özet senkron
      düğümüne girmeye devam ediyordu.
   3. ONAY ÇIPLAK confirm() İDİ: "Notları ve seansları da silinir" ne KADAR
      olduğunu söylemiyor, özetten/ontolojiden/kapaktan hiç bahsetmiyordu.

   v117 KARARLARI:
   · Tek otorite `window.__sil` (çekirdek); gorunum.js delege eder.
   · Onay penceresi (sd-) v100 kütüphane-dosyası önizlemesinin kalıbı:
     ne gideceği SAYIYLA, yalnız gerçekten var olan kalemler.
   · Geri alma VAR — v100'ün tek adım geri almasının eşi, ama tüm kütüphanenin
     anlık kopyası değil yalnız silinen kayıtların defteri (kk_silgeri_v1):
     kitap gövdesi + özet + kapak blob'u. Cihaz-yereli, senkrona/yedeğe girmez.
   · Toplu silme KALIYOR ("Raf ata" komşusu) ama aynı kapıdan geçiyor ve
     TAM listeyi gösteriyor — çoklu seçimde en korkulan hata yanlış seçimdir.

   (Mutasyon 1: sdUygula'dan mezar taşı satırı kalkar → (c2) kırmızı.
      DENETİMİN KENDİ DERSİ: bu mutasyon önce SAĞ KALDI. (c) tek başına kuralı
      ölçmüyordu, çünkü normal turda damgala() mezarı kendisi yazıyor; kusur
      yalnız göç turunda görünüyor. Vaka oraya taşındı — 'silme sonrası mezar
      var mı' değil, 'AÇIK satır olmadan da var mı' sorulmalıydı.
    Mutasyon 2: __ozet.sil çağrısı kalkar → (e) kırmızı.
    Mutasyon 3: sdSor onay penceresi yerine doğrudan siler → (a) kırmızı.
    Mutasyon 4: geri almada k.g tazelenmez → (g) kırmızı.
    Mutasyon 5: toplu yol eski gövdesine döner → (h) kırmızı.) */

const { test, expect, tohumla, sahteKitap, rafAc, ayarlarAc } = require('./yardim');

const kart = page => page.locator('#ortuSil');
const mezar = (page, id) => page.evaluate(i => (veri.silinenler || {})[i] || 0, id);
const sayi = page => page.evaluate(() => veri.kitaplar.length);

async function detaydaSilAc(page) {
  await rafAc(page);
  await page.click('#liste .kart');
  await page.click('#dDigerKatla summary');
  await page.click('#detayIcerik [data-act="kitap-sil"]');
}
/* Zengin kayıt: her sayım satırının kaynağı ayrı ayrı dolu. */
function zenginKitap(ek) {
  return sahteKitap(Object.assign({
    ad: 'Engel', yazar: 'Mim Kemal Öke', puan: 8, etiketler: ['tarih', 'deneme'],
    notlar: [
      { id: 'n1', tip: 'not', metin: 'birinci not', tarih: '2026-01-01', fikir: ['zaman'] },
      { id: 'n2', tip: 'not', metin: 'ikinci not', tarih: '2026-01-02', fikir: ['zaman', 'engel'] },
      { id: 'n3', tip: 'alinti', metin: 'bir alıntı', tarih: '2026-01-03', fikir: [] }
    ],
    oturumlar: [{ b: 1754000000000, s: 1754003600000, bas: 1, son: 40 }],
    seanslar: [{ t: '2026-01-02', a: 1, b: 40 }],
    okumalar: [{ bas: '2025-01-01', bit: '2025-02-01', puan: 7, not: '' }]
  }, ek || {}));
}

test.describe('G110 tekil silme — onay ve mezar taşı', () => {

  test('(a) detay ▸ Sil ONAY PENCERESİ açar, kayıt HENÜZ silinmez', async ({ page }) => {
    await tohumla(page, [zenginKitap()]);
    await detaydaSilAc(page);
    await expect(kart(page)).toBeVisible();
    await expect(kart(page).locator('.sd-ad')).toHaveText('Engel');
    expect(await sayi(page), 'onay beklenirken kayıt duruyor').toBe(1);
    expect(await mezar(page, (await page.evaluate(() => veri.kitaplar[0].id))),
      'onaydan önce mezar taşı YOK').toBe(0);
  });

  test('(b) kart NE GİDECEĞİNİ sayıyla yazar', async ({ page }) => {
    await tohumla(page, [zenginKitap()]);
    await detaydaSilAc(page);
    const metin = await kart(page).locator('#sdNe').innerText();
    expect(metin).toContain('not');
    expect(metin).toContain('alıntı');
    expect(metin).toContain('okuma oturumu');
    /* Sayılar gerçek veriden: 2 not, 1 alıntı, 2 fikir etiketi (zaman+engel,
       tekilleştirilmiş), 1 oturum, 1 sayfa kaydı, 1 arşiv okuma, 2 etiket. */
    const say = await page.evaluate(() =>
      window.__sil.kayip([veri.kitaplar[0]]).say);
    expect(say.not).toBe(2);
    expect(say.alinti).toBe(1);
    expect(say.fikir).toBe(2);
    expect(say.oturum).toBe(1);
    expect(say.seans).toBe(1);
    expect(say.okuma).toBe(1);
    expect(say.etiket).toBe(2);
    expect(say.puan).toBe(1);
  });

  test('(c) onay: kayıt gider ve MEZAR TAŞI yazılır', async ({ page }) => {
    await tohumla(page, [zenginKitap()]);
    await rafAc(page);
    const id = await page.evaluate(() => veri.kitaplar[0].id);
    await page.click('#liste .kart');
    await page.click('#dDigerKatla summary');
    await page.click('#detayIcerik [data-act="kitap-sil"]');
    await page.click('#ortuSil [data-act="sd-onay"]');
    await expect(page.locator('#toast')).toContainText('Kitap silindi');
    expect(await sayi(page)).toBe(0);
    /* v117'nin ÇEKİRDEK DÜZELTMESİ: detay yolu artık mezar taşı bırakıyor.
       Mezarsız silme, senkron göç turunda öbür cihazdan geri dirilirdi. */
    expect(await mezar(page, id), 'detay yolu mezar taşı bırakır').toBeGreaterThan(0);
    const depo = await page.evaluate(() => JSON.parse(localStorage.getItem('kk_kitaplik_v1')));
    expect(depo.kitaplar.length).toBe(0);
    expect(depo.silinenler[id]).toBeGreaterThan(0);
  });

  test('(c2) GÖÇ turunda da mezar taşı yazılır — damgala ağına GÜVENİLMEZ', async ({ page }) => {
    /* MUTASYON DENETİMİNİN BULDUĞU BOŞLUK: (c) tek başına kuralı ölçmüyordu.
       Normal turda senkron.js damgala() kaybolan parmak izini görüp mezarı
       KENDİSİ yazıyor, yani açık satırı silsen bile (c) yeşil kalıyor.
       Kusur yalnız GÖÇ turunda görünür: damgala'nın o ağı `if(!goc)` ile
       atlanır (şema sürümü değişince tüm kütüphane yeniden damgalanmasın diye).
       v117 öncesi detay yolu işte burada mezarsız siliyordu ve kayıt öbür
       cihazdan geri diriliyordu. Bu vaka göç turunu ZORLAR. */
    await tohumla(page, [zenginKitap()]);
    await rafAc(page);
    const id = await page.evaluate(() => veri.kitaplar[0].id);
    await page.click('#liste .kart');
    await page.click('#dDigerKatla summary');
    await page.click('#detayIcerik [data-act="kitap-sil"]');
    // anlık iz defterini ESKİ şema sürümüyle tazele: sıradaki damgala göç turu koşar
    await page.evaluate(i => localStorage.setItem('kk_senkron_anlik_v1',
      JSON.stringify({ s: 1, p: { [i]: 'eski-iz' } })), id);
    expect(await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kk_senkron_anlik_v1')).s), 'göç turu kuruldu').toBe(1);
    await page.click('#ortuSil [data-act="sd-onay"]');
    await expect(page.locator('#toast')).toContainText('Kitap silindi');
    expect(await mezar(page, id), 'göç turunda da mezar taşı var').toBeGreaterThan(0);
  });

  test('(d) Vazgeç: hiçbir şey silinmez, mezar taşı da yazılmaz', async ({ page }) => {
    await tohumla(page, [zenginKitap()]);
    await rafAc(page);
    const id = await page.evaluate(() => veri.kitaplar[0].id);
    await page.click('#liste .kart');
    await page.click('#dDigerKatla summary');
    await page.click('#detayIcerik [data-act="kitap-sil"]');
    await page.click('#ortuSil [data-act="sd-vazgec"]');
    await expect(kart(page)).not.toHaveClass(/acik/);
    expect(await sayi(page)).toBe(1);
    expect(await mezar(page, id)).toBe(0);
  });

  test('(e) özet ve ontoloji IDB\'den de silinir (yetim kalmaz)', async ({ page }) => {
    await tohumla(page, [zenginKitap({ ozetVar: true, ozetUzunluk: 9 })]);
    await rafAc(page);
    const id = await page.evaluate(() => veri.kitaplar[0].id);
    await page.evaluate(async i => {
      await window.__ozet.hazirBekle();
      await window.__ozet.kaydetHam(i, 'özet var', Date.now(), 'ontoloji var');
    }, id);
    expect(await page.evaluate(i => window.__ozet.oku(i), id)).toBe('özet var');
    await page.click('#liste .kart');
    await page.click('#dDigerKatla summary');
    await page.click('#detayIcerik [data-act="kitap-sil"]');
    await page.click('#ortuSil [data-act="sd-onay"]');
    await expect(page.locator('#toast')).toContainText('Kitap silindi');
    await expect.poll(() => page.evaluate(i => window.__ozet.oku(i), id),
      { message: 'özet metni IDB dizininden düşer' }).toBe('');
    expect(await page.evaluate(i => window.__ozet.okuOnto(i), id)).toBe('');
    /* JSON yedeğine de girmemeli — hepsiDisa bellek dizininden üretiliyor. */
    const disa = await page.evaluate(() => window.__ozet.hepsiDisa());
    expect(Object.keys(disa)).not.toContain(id);
  });
});

test.describe('G110 geri alma', () => {

  test('(f) geri alınacak bir şey yokken kart GİZLİ', async ({ page }) => {
    await tohumla(page, [zenginKitap()]);
    await rafAc(page);
    await ayarlarAc(page);
    await expect(page.locator('#sdGeriBolum')).toBeHidden();
  });

  test('(g) tek adım geri alma: kayıt, notlar ve özet geri gelir; mezar taşı kalkar', async ({ page }) => {
    await tohumla(page, [zenginKitap({ ozetVar: true, ozetUzunluk: 9 })]);
    await rafAc(page);
    const id = await page.evaluate(() => veri.kitaplar[0].id);
    await page.evaluate(async i => {
      await window.__ozet.hazirBekle();
      await window.__ozet.kaydetHam(i, 'özet var', Date.now(), '');
    }, id);
    await page.click('#liste .kart');
    await page.click('#dDigerKatla summary');
    await page.click('#detayIcerik [data-act="kitap-sil"]');
    await page.click('#ortuSil [data-act="sd-onay"]');
    await expect(page.locator('#toast')).toContainText('Kitap silindi');
    const silmeAni = await mezar(page, id);
    expect(silmeAni).toBeGreaterThan(0);

    await ayarlarAc(page);
    await expect(page.locator('#sdGeriBolum')).toBeVisible();
    await expect(page.locator('#sdGeriKart')).toContainText('Engel');
    await page.click('#sdGeriKart [data-act="sd-geri"]');
    await expect(page.locator('#toast')).toContainText('geri alındı');

    expect(await sayi(page)).toBe(1);
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.ad).toBe('Engel');
    expect(k.notlar.length, 'notlar da geri geldi').toBe(3);
    expect(k.okumalar.length, 'okuma arşivi de geri geldi').toBe(1);
    /* Mezar taşı YEREL olarak kalkar VE damga tazelenir: odadaki kopyada mezar
       hâlâ durabilir, birleşme `mezar >= k.g` ise kaydı eler (senkron.js). */
    expect(await mezar(page, id), 'yerel mezar taşı kalkar').toBe(0);
    expect(k.g, 'damga mezardan taze').toBeGreaterThan(silmeAni - 1);
    await expect.poll(() => page.evaluate(i => window.__ozet.oku(i), id),
      { message: 'özet de geri gelir' }).toBe('özet var');
    /* Defter tüketildi: kart tekrar gizli. */
    await expect(page.locator('#sdGeriBolum')).toBeHidden();
  });
});

test.describe('G110 toplu silme aynı kapıdan geçer', () => {

  test('(h) çoklu seçim ▸ Sil: onay penceresi TAM listeyi gösterir, mezar taşı yazar', async ({ page }) => {
    await tohumla(page, [
      zenginKitap({ ad: 'Birinci' }),
      zenginKitap({ ad: 'İkinci' }),
      sahteKitap({ ad: 'Dokunulmayan' })
    ]);
    await rafAc(page);
    const idler = await page.evaluate(() => veri.kitaplar.slice(0, 2).map(k => k.id));
    await page.click('[data-act="secim-ac"]');
    await page.click('#liste .kart[data-id="' + idler[0] + '"]');
    await page.click('#liste .kart[data-id="' + idler[1] + '"]');
    await page.click('[data-act="toplu-sil"]');
    /* TAM liste: "2 kitap" deyip neyin gittiğini göstermemek, çoklu seçimde
       en korkulan hatayı (yanlış kart seçili) görünmez kılardı. */
    await expect(kart(page)).toBeVisible();
    await expect(kart(page).locator('.sd-kunye')).toContainText('Birinci');
    await expect(kart(page).locator('.sd-kunye')).toContainText('İkinci');
    await expect(kart(page).locator('#sdOnayBtn')).toHaveText('2 kaydı sil');
    expect(await sayi(page), 'onay beklenirken hiçbiri silinmedi').toBe(3);
    await page.click('#ortuSil [data-act="sd-onay"]');
    await expect(page.locator('#toast')).toContainText('2 kitap silindi');
    expect(await sayi(page)).toBe(1);
    expect(await mezar(page, idler[0])).toBeGreaterThan(0);
    expect(await mezar(page, idler[1])).toBeGreaterThan(0);
    expect(await page.evaluate(() => veri.kitaplar[0].ad)).toBe('Dokunulmayan');
  });

  test('(i) toplu silme de geri alma defterine yazar', async ({ page }) => {
    await tohumla(page, [zenginKitap({ ad: 'Birinci' }), zenginKitap({ ad: 'İkinci' })]);
    await rafAc(page);
    await page.click('[data-act="secim-ac"]');
    await page.click('[data-act="toplu-tumu"]');
    await page.click('[data-act="toplu-sil"]');
    await page.click('#ortuSil [data-act="sd-onay"]');
    await expect(page.locator('#toast')).toContainText('2 kitap silindi');
    await ayarlarAc(page);
    await expect(page.locator('#sdGeriKart')).toContainText('2 kayıt');
    await page.click('#sdGeriKart [data-act="sd-geri"]');
    await expect(page.locator('#toast')).toContainText('2 kayıt geri alındı');
    expect(await sayi(page)).toBe(2);
  });
});

test.describe('G110 görünürlük', () => {

  test('(j) detay katlama başlığı "sil" sözcüğünü taşır', async ({ page }) => {
    /* Ölçümün asıl bulgusu: silme VARDI ama "Kapak, düzenle & diğer" başlığının
       arkasındaydı — tarayan göz "sil" sözcüğünü bulamıyordu. */
    await tohumla(page, [zenginKitap()]);
    await rafAc(page);
    await page.click('#liste .kart');
    await expect(page.locator('#dDigerKatla summary')).toContainText('sil');
  });
});
