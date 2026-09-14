'use strict';
/* G120 (v128) — KAPAK EKSİĞİNİN ÜÇ SESSİZ KUSURU
 *
 * NEDEN BU GRUP VAR (hepsi 14 Eylül'de GERÇEK veri üzerinde ölçüldü):
 *  M1) Google Books bu uçta isteklerin %32'sine HTTP 503 veriyor. Kod 503'ü
 *      kalıcı hata sayıyordu; başlık sorgusu fırlayınca kitapSorgula komple
 *      düşüyor, kitap v118 worker yedeğine HİÇ gelmiyordu — kapaksız 69 kaydın
 *      28'i (%40,6) böyle düştü.
 *  M2) Hata alan kitap catch'ten SONRA koşulsuz "işlendi" damgalanıyordu:
 *      "Devam et" onu bir daha denemiyor, kuyruk "bitti" diyordu. Tarama
 *      bitmiş görünürken kitapların %40'ı hiç sorulmamış oluyordu.
 *  M3) Goodreads "kapak yok" plasebosu (…/nophoto/…) v118'in İKİ kapısını da
 *      geçiyordu — worker'ın geçirdiği 52 kapağın 8'i buydu. Yazılsaydı 8 kitap
 *      kalıcı gri kutu alır, alanBos "dolu" der, bir daha hiç sorulmazlardı.
 *  M4) Ölü kapaklı 24 kaydın 18'inin altı alanı da dolu → tarama kuyruğuna
 *      HİÇ giremiyorlardı; kaç kez taransa da düzelmiyordu.
 *  M5) baslikUyar kesme işaretini katlamıyordu: "Romanin" ≠ "Roma'nın".
 */
const { test, expect, tohumla, sahteKitap, rafAc, ayarlarAc } = require('./yardim');

/* Google'ın 503 gövdesi — mock 'hata' (route.abort) ağ DÜŞMESİDİR, bu değil.
   Ayrım kasıtlı: 503 tekrarlanır, ağ düşmesi anında fırlar. */
const GB_503 = { error: { code: 503, message: 'The service is currently unavailable.' } };
const NOPHOTO = 'https://i.gr-assets.com/images/S/compressed.photo.goodreads.com/nophoto/book/111x148.png';
const TURLER = [{ seo: 'roman', ad: 'Roman', kitapSayisi: 10 }];

test.describe('G120 ölü kapak + 503 dayanıklılığı (v128)', () => {

  /* ---------- M1: 503 TEKRARI ---------- */

  /* Kapaksız, ISBN'siz kayıt: tek sorgu yolu (başlık) — 503 sayımı kesin okunur */
  const KAPAKSIZ = { id: 'x', ad: 'Sonunda Geldi', yazar: 'Yazar', tur: 'Roman',
    isbn: '', sayfa: 10, yayinevi: 'Yayın', yil: 2000, kapak: '' };

  test('A) 503 TEKRARLANIR: iki düşüşten sonra kapak yine de bulunur', async ({ page }) => {
    await rafAc(page);
    await page.evaluate(() => { window.__KK_GB_BEKLE = 5; });   // test hızı (üründe 1200ms)
    let n = 0;
    page.__agAyar.google = () => (++n <= 2) ? GB_503 : { totalItems: 1, items: [{ volumeInfo: {
      title: 'Sonunda Geldi', authors: ['Yazar'],
      imageLinks: { thumbnail: 'http://books.google.com/x.jpg?edge=curl' } } }] };
    const s = await page.evaluate(k => window.__zengin.kitapSorgula(k), KAPAKSIZ);
    expect(s.b).toBeTruthy();
    expect(s.b.kapak).toBe('https://books.google.com/x.jpg');   // kapakTemizle de koştu
    expect(page.__agSayac.google).toBe(3);                      // 503, 503, sonuç
  });

  test('A2) TAVAN: art arda 503 sonsuza kadar denenmez, sonunda fırlar', async ({ page }) => {
    await rafAc(page);
    await page.evaluate(() => { window.__KK_GB_BEKLE = 5; });
    page.__agAyar.google = () => GB_503;
    const hata = await page.evaluate(async k => {
      try{ await window.__zengin.kitapSorgula(k); return 'fırlamadı'; }
      catch(e){ return String(e.message || e); }
    }, KAPAKSIZ);
    expect(hata).toContain('503');
    expect(page.__agSayac.google).toBe(3);                      // GB_TEKRAR kadar, fazlası değil
  });

  test('B) 503 DIŞINDAKİ hata ANINDA fırlar (teşhis gizlenmez)', async ({ page }) => {
    await rafAc(page);
    await page.evaluate(() => { window.__KK_GB_BEKLE = 5; });
    page.__agAyar.google = { error: { code: 403, message: 'quota' } };
    const hata = await page.evaluate(async k => {
      try{ await window.__zengin.kitapSorgula(k); return 'fırlamadı'; }
      catch(e){ return String(e.message || e); }
    }, KAPAKSIZ);
    expect(hata).toContain('403');
    expect(page.__agSayac.google).toBe(1);                      // TEKRARLANMADI
  });

  /* ---------- M2: HATA ALAN KİTAP "İŞLENDİ" SAYILMAZ ---------- */

  test('C) kaynak hatası alan kitap işlenmiş SAYILMAZ; kuyruk "bitti" demez', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Hatalı Bir', yazar: 'Y', tur: '', isbn: '' }),
      sahteKitap({ ad: 'Hatalı İki', yazar: 'Y', tur: '', isbn: '' })
    ]);
    await rafAc(page);
    await ayarlarAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.google = 'hata';                    // ağ düşmesi: tekrarsız fırlar
    await page.click('#ortuAyar [data-act="zg-tara"]');
    await expect(page.locator('#zgTaramaGovde')).toContainText('kaynak hatası', { timeout: 30000 });
    const d = await page.evaluate(() => window.__zengin.kuyrukYukle());
    expect(d.bitti).toBe(false);
    expect(Object.keys(d.islenen)).toHaveLength(0);   // HİÇBİRİ işlenmiş sayılmadı
    expect(Object.values(d.hata)).toEqual([1, 1]);    // sayaç 1 (eskiden sabit 1'di, artık artıyor)
  });

  test('D) TAVAN: aynı kitap HATA_TAVAN denemeden sonra kuyruktan düşer (sonsuz döngü yok)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Hep Hatalı', yazar: 'Y', tur: '', isbn: '' })]);
    await rafAc(page);
    await ayarlarAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.google = 'hata';
    const tavan = await page.evaluate(() => window.__zengin.HATA_TAVAN);
    for (let i = 0; i < tavan; i++) {
      await page.click(i === 0 ? '#ortuAyar [data-act="zg-tara"]'
                              : '#zgTaramaGovde [data-act="zg-tara"]');
      await expect(page.locator('#zgTaramaGovde')).toContainText('kaynak hatası', { timeout: 30000 });
    }
    const d = await page.evaluate(() => window.__zengin.kuyrukYukle());
    expect(d).toBe(null);                              // bitti → kuyruk temizlendi
  });

  /* ---------- M3: PLASEBO ---------- */

  test('E) plaseboKapak: nophoto adresi TANINIR, gerçek kapak tanınmaz', async ({ page }) => {
    await rafAc(page);
    const s = await page.evaluate(nop => [
      window.__zengin.plaseboKapak(nop),
      window.__zengin.plaseboKapak('https://i.gr-assets.com/images/S/x/1234.jpg'),
      window.__zengin.plaseboKapak(''),
      window.__zengin.plaseboKapak(null)
    ], NOPHOTO);
    expect(s).toEqual([true, false, false, false]);
  });

  test('F) workerKapakSessiz plaseboyu YAZMAZ ve SONRAKİ ADAYA DÜŞMEZ (Kaan kararı)', async ({ page }) => {
    await rafAc(page);
    const kpk = await page.evaluate(async nop => {
      /* Gerçek ölçülmüş desen: kaynak eseri TANIYOR ("Bir Evlenme"/Gogol) ama
         kapağı yok; ikinci sırada aynı yazarın DERLEMESİ var. Düşülseydi
         ekranda "Bir Evlenme" yazıp "Müfettiş…" kapağı görünürdü. */
      window.__ara.worker = async () => [
        { ad: 'Bir Evlenme', yazar: 'Nikolai Gogol', kapak: nop },
        { ad: 'Müfettiş - Tiyatrodan Çıkış - Bir Evlenme', yazar: 'Nikolai Gogol',
          kapak: 'https://1k-cdn.com/derleme.jpg' }
      ];
      return window.__zengin.workerKapakSessiz({ ad: 'Bir Evlenme', yazar: 'Nikolai Gogol' });
    }, NOPHOTO);
    expect(kpk).toBe('');
  });

  test('G) plasebo TAŞIYAN kayıt ağ sorulmadan ölü sayılır', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Plasebolu', yazar: 'Y', kapak: NOPHOTO }),
      sahteKitap({ ad: 'Gerçek Kapaklı', yazar: 'Y', kapak: 'https://1k-cdn.com/a.jpg' })
    ]);
    await rafAc(page);
    const adlar = await page.evaluate(() => {
      const s = window.__zengin.oluKapakIdler();
      return veri.kitaplar.filter(k => s.has(k.id)).map(k => k.ad);
    });
    expect(adlar).toEqual(['Plasebolu']);
  });

  /* ---------- M4: ÖLÜ KAPAKLI KAYIT KUYRUĞA GİRER ---------- */

  test('H) altı alanı da DOLU ama kapağı ölü kayıt tarama kuyruğuna GİRER', async ({ page }) => {
    /* v118 tabanında bu kayıt kuyruğa hiç giremiyordu: ALANLAR.some(alanBos)
       false. 8 Eylül yedeğinde ölü kapaklı 24 kaydın 18'i tam olarak böyleydi. */
    const tamKayit = sahteKitap({ ad: 'Altısı Dolu', yazar: 'Y', tur: 'Roman', isbn: '9789750718533',
      sayfa: 200, yayinevi: 'Yayın', yil: 2010,
      kapak: 'https://covers.openlibrary.org/b/isbn/9789750718533-M.jpg' });
    await tohumla(page, [tamKayit]);
    await rafAc(page);
    const oncesi = await page.evaluate(() =>
      veri.kitaplar.filter(k => window.__zengin.ALANLAR.some(a => window.__zengin.alanBos(k, a))).length);
    expect(oncesi).toBe(0);                            // eski süzgeç bunu görmüyordu
    // denetim bulgusunu deftere yaz (ağ yerine doğrudan — kuyruk süzgecini sınıyoruz)
    await page.evaluate(() => {
      const k = veri.kitaplar[0];
      localStorage.setItem(window.__zengin.OLU_KAPAK_ANAHTAR, JSON.stringify({ [k.id]: k.kapak }));
    });
    const kuyrukta = await page.evaluate(() => window.__zengin.oluKapakIdler().size);
    expect(kuyrukta).toBe(1);
    await ayarlarAc(page);
    page.__agAyar.turler = TURLER;
    page.__agAyar.google = { totalItems: 0, items: [] };
    await page.click('#ortuAyar [data-act="zg-tara"]');
    await expect(page.locator('#zgTaramaGovde')).toContainText('1 / 1', { timeout: 30000 });
  });

  test('I) defter KENDİ KENDİNİ temizler: kapak değişince bulgu düşer', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Tazelendi', yazar: 'Y',
      kapak: 'https://covers.openlibrary.org/b/isbn/111-M.jpg' })]);
    await rafAc(page);
    await page.evaluate(() => {
      const k = veri.kitaplar[0];
      localStorage.setItem(window.__zengin.OLU_KAPAK_ANAHTAR, JSON.stringify({ [k.id]: k.kapak }));
    });
    expect(await page.evaluate(() => window.__zengin.oluKapakIdler().size)).toBe(1);
    await page.evaluate(() => { veri.kitaplar[0].kapak = 'https://1k-cdn.com/yeni.jpg'; });
    expect(await page.evaluate(() => window.__zengin.oluKapakIdler().size)).toBe(0);
    // bayat giriş defterden de silinmiş olmalı (asılı damga kalmaz)
    expect(await page.evaluate(() => Object.keys(window.__zengin.oluKapakOku()).length)).toBe(0);
  });

  test('J) DENETİM TEK BAŞINA HİÇBİR KAYDI DEĞİŞTİRMEZ', async ({ page }) => {
    /* g111-H dersi: savunmanın testi, savunmanın gerçekten koştuğu yolda
       kurulur — bu vaka GERÇEK UI yolundan (düğmeye tıklayarak) geçer. */
    await tohumla(page, [sahteKitap({ ad: 'Denenen', yazar: 'Y', g: 1000,
      kapak: 'https://covers.openlibrary.org/b/isbn/222-M.jpg' })]);
    await rafAc(page);
    await ayarlarAc(page);
    await page.click('#ortuAyar [data-act="zgo-denetle"]');
    await expect(page.locator('#zgoDenetimGovde')).toContainText('denetlendi', { timeout: 30000 });
    const son = await page.evaluate(() => veri.kitaplar.map(k => ({ kapak: k.kapak, g: k.g })));
    expect(son[0].kapak).toBe('https://covers.openlibrary.org/b/isbn/222-M.jpg');
    expect(son[0].g).toBe(1000);                       // tek damga bile atılmadı
  });

  test('K) denetim 404\'ü bulur, sayaç ARTIK söyler', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Ölü Kapaklı', yazar: 'Y', tur: 'Roman',
      isbn: '333', sayfa: 10, yayinevi: 'Y', yil: 2000,
      kapak: 'https://covers.openlibrary.org/b/isbn/333-M.jpg' })]);
    await rafAc(page);
    await ayarlarAc(page);
    await page.route('**/covers.openlibrary.org/**', r => r.fulfill({ status: 404, body: '' }));
    await page.click('#ortuAyar [data-act="zgo-denetle"]');
    await expect(page.locator('#zgoDenetimGovde')).toContainText('1 ölü', { timeout: 30000 });
    await expect(page.locator('#zgDurum')).toContainText('görsel yüklenmiyor');
  });

  test('L) denetim koşmadıysa sayaç bunu SÖYLER (sessiz iyimserlik yok)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Bilinmiyor', yazar: 'Y', tur: 'Roman',
      isbn: '444', sayfa: 10, yayinevi: 'Y', yil: 2000,
      kapak: 'https://covers.openlibrary.org/b/isbn/444-M.jpg' })]);
    await rafAc(page);
    await ayarlarAc(page);
    await expect(page.locator('#zgDurum')).toContainText('denetlenmedi');
  });

  /* ---------- M5: KESME İŞARETİ ---------- */

  test('M) baslikUyar kesme işaretini katlar; kapsamayan başlık yine eşleşmez', async ({ page }) => {
    await rafAc(page);
    const s = await page.evaluate(() => [
      /* ölçülmüş iki gerçek vaka: kayıtta kesme yok, kaynakta var */
      window.__zengin.baslikUyar('Antik Yunan ve Romanin Mitleri ve Efsaneleri',
        "Antik Yunan ve Roma'nın Mitleri ve Efsaneleri"),
      window.__zengin.baslikUyar('Tanrinin Evrimi', 'Tanrı’nın Evrimi'),
      /* kapı GEVŞEMEDİ: hiçbiri diğerini kapsamıyor */
      window.__zengin.baslikUyar('Tanrinin Evrimi', 'Tanrıların Savaşı'),
      window.__zengin.baslikUyar("Büyük Petro'nun Arabı", 'Yüzbaşının Kızı')
    ]);
    expect(s).toEqual([true, true, false, false]);
  });

  /* Başlık kapısı TEK BAŞINA yeterli değildir ve hiç olmadı — "Atış" ölçülmüş
     yanlış eşleşmesi kapsama kuralını (önek) GEÇER, onu eleyen yazar kapısıdır.
     Bu vaka o iş bölümünü dondurur: M5 kesme katlaması başlık kapısını
     gevşetirken yazar kapısının yükü artmadı, aynı yerde duruyor. */
  test('M2) kapsama kuralı "Atış"ı geçirir; onu YAZAR kapısı eler (v118 ölçümü)', async ({ page }) => {
    await rafAc(page);
    const s = await page.evaluate(() => ({
      baslik: window.__zengin.baslikUyar('Atış', 'Atıştırmalıklar Kitabı'),
      yazar: window.__zengin.yazarUyar('Alexander Pushkin', 'Ebru Omurcalı')
    }));
    expect(s.baslik).toBe(true);    // başlık kapısı bunu ELEMİYOR (v118'de de elemiyordu)
    expect(s.yazar).toBe(false);    // eleyen kapı bu
  });

  /* ---------- AYARLAR KİLİDİ ---------- */

  test('N) Ayarlar: denetim düğmesi var, YENİ .ay-bolum açılmamış (g48 kilidi)', async ({ page }) => {
    await tohumla(page, [sahteKitap({})]);
    await rafAc(page);
    await ayarlarAc(page);
    await expect(page.locator('#ayBolumZengin [data-act="zgo-denetle"]')).toHaveCount(1);
    await expect(page.locator('#ortuAyar .ay-bolum')).toHaveCount(9);
    await expect(page.locator('#ortuAyar .kicker')).toHaveCount(9);
  });
});
