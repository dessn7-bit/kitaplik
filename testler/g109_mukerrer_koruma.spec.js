'use strict';
/* G109b — MÜKERRER EKLEME KORUMASI (v116).

   KUSUR: kütüphanede olan bir kitap ikinci kez eklenebiliyordu. Ölçüm yedi
   ekleme yolu buldu; dördünde koruma vardı (barkod ENGEL + yakın kayıt UYARI,
   JSON yedeği ATLA, Goodreads CSV ATLA), üçünde YOKTU:
     · elle form — yalnız ISBN ikizi uyarısı, ISBN yoksa hiçbir şey
     · arama sonucundan ekleme — formu doldurup aynı yoldan kaydediyor
     · Keşfet "İstek listeme ekle" — havuz elenmiş ama EKLEME ANI korumasız
   Kaan'ın dört mükerrer kaydı bu yollardan doğdu.

   ÖLÇÜT (Kaan onaylı): katla(ad)+'|'+katla(yazar), ISBN İKİNCİ KOL.
   · ISBN birincil OLAMAZ: 4 Eylül yedeğinde 299 kitabın 100'ünde ISBN YOK
     (üçte biri boş). Boş kaldığı yerde tek başına hiçbir şey yakalamaz.
   · Ölçüm: katlanmış ad+yazar çakışması 0, ISBN çakışması 0 — iki kol da
     bugünkü veride kusursuz ayırt edici.
   · adTr ENGEL koluna GİRMEZ: "An Actor Prepares" ile "Bir Aktör
     Hazırlanıyor" ayrı fiziksel kitaplardır (v96 kararı korunuyor).

   DAVRANIŞ — üç durum, üç ayrı cevap:
   · ad+yazar aynı (elle form)  → ONAY KARTI: Kitaba git / Yine de ekle / Vazgeç
   · ISBN aynı, ad farklı        → UYARI + KAYDET (mevcut davranış korundu)
   · barkod & Keşfet             → SERT ENGEL (form açılmıyor; seri tarama
                                    onay kartıyla kesilmemeli)

   (Mutasyon 1: form kapısı kalkar → (a) kırmızı.
    Mutasyon 2: katla() düşer → (b) kırmızı.
    Mutasyon 3: "Yine de ekle" ikinci turda yine sorar → (d) kırmızı.
    Mutasyon 4: Keşfet ekleme anı kapısı kalkar → (g) kırmızı.
    Mutasyon 5: onay kartı ISBN kolunda da açılır → (f) kırmızı.) */

const { test, expect, tohumla, sahteKitap, rafAc, ayrintilarAc } = require('./yardim');

const ISBN = '9780132350884';
async function formAc(page) {
  await rafAc(page);
  await page.click('.fab[data-act="yeni"]');
  /* yazar alani "Ayrintilar" katlanir bolumunde (g15 emsali) */
  await ayrintilarAc(page);
}
async function ekle(page, ad, yazar) {
  await page.fill('#f-ad', ad);
  if (yazar !== undefined) await page.fill('#f-yazar', yazar);
  await page.click('[data-act="form-kaydet"]');
}
const sayi = page => page.evaluate(() => veri.kitaplar.length);
const kart = page => page.locator('#ortuIkiz');

test.describe('G109b elle form kapısı', () => {

  test('(a) aynı ad+yazar: ONAY KARTI açılır, kayıt HENÜZ oluşmaz', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Suç ve Ceza', yazar: 'Dostoyevski' })]);
    await formAc(page);
    await ekle(page, 'Suç ve Ceza', 'Dostoyevski');
    await expect(kart(page)).toBeVisible();
    await expect(kart(page).locator('.ik-ad')).toHaveText('Suç ve Ceza');
    expect(await sayi(page), 'kayıt sessizce oluşmadı').toBe(1);
    /* üç yol da açıkta */
    await expect(kart(page).locator('[data-act="ik-git"]')).toHaveText('Kitaba git');
    await expect(kart(page).locator('[data-act="ik-yine"]')).toHaveText('Yine de ekle');
    await expect(kart(page).locator('[data-act="ik-vazgec"]').last()).toHaveText('Vazgeç');
  });

  test('(b) katla(): "Istanbul" ile "İstanbul" AYNI kitaptır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'İstanbul Hatırası', yazar: 'Ahmet Ümit' })]);
    await formAc(page);
    await ekle(page, 'Istanbul Hatirasi', 'Ahmet Umit');
    await expect(kart(page), 'TR normalizasyonu olmadan kaçardı').toBeVisible();
    expect(await sayi(page)).toBe(1);
  });

  test('(c) farklı kitap engellenmez — kapı yanlış pozitif üretmez', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Suç ve Ceza', yazar: 'Dostoyevski' })]);
    await formAc(page);
    await ekle(page, 'Budala', 'Dostoyevski');
    await expect(kart(page)).toBeHidden();
    expect(await sayi(page), 'aynı yazarın başka kitabı serbest').toBe(2);
  });

  test('(d) "Yine de ekle": ikinci kayıt oluşur, kart TEKRAR sormaz', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Suç ve Ceza', yazar: 'Dostoyevski' })]);
    await formAc(page);
    await ekle(page, 'Suç ve Ceza', 'Dostoyevski');
    await kart(page).locator('[data-act="ik-yine"]').click();
    await expect(kart(page)).toBeHidden();
    expect(await sayi(page), 'iki baskıya sahip olmak meşru').toBe(2);
    await expect(page.locator('#toast')).toContainText('rafa eklendi');
  });

  test('(e) "Vazgeç" kayıt oluşturmaz; "Kitaba git" mevcut kaydı açar', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Suç ve Ceza', yazar: 'Dostoyevski' })]);
    await formAc(page);
    await ekle(page, 'Suç ve Ceza', 'Dostoyevski');
    await kart(page).locator('[data-act="ik-vazgec"]').last().click();
    await expect(kart(page)).toBeHidden();
    expect(await sayi(page)).toBe(1);
    /* Kitaba git: kart + form kapanır, mevcut kaydın detayı açılır.
       Mükerrer eklemenin sebebi "acaba eklemiş miydim?" belirsizliği. */
    await page.click('[data-act="form-kaydet"]');
    await expect(kart(page)).toBeVisible();
    await kart(page).locator('[data-act="ik-git"]').click();
    await expect(kart(page)).toBeHidden();
    await expect(page.locator('#ortuForm'), 'yarım form arkada kalmaz').not.toHaveClass(/acik/);
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    expect(await sayi(page)).toBe(1);
  });

  test('(f) ISBN aynı ama ad farklı: UYARI + KAYDET (mevcut davranış korundu)',
    async ({ page }) => {
      await tohumla(page, [sahteKitap({ ad: 'İlk Baskı', yazar: 'Y', isbn: ISBN })]);
      await formAc(page);
      await page.fill('#f-ad', 'İkinci Baskı');
      await page.fill('#f-yazar', 'Y');
      await page.fill('#f-isbn', ISBN);
      await page.click('[data-act="form-kaydet"]');
      /* Onay kartı ISBN kolunda AÇILMAZ — ad+yazar farklı. */
      await expect(kart(page), 'ISBN kolu kart açmaz').toBeHidden();
      await expect(page.locator('#toast')).toContainText('aynı ISBN ile zaten kayıtlı');
      expect(await sayi(page), 'engellenmedi').toBe(2);
    });

  test('(g) düzenlemede kart AÇILMAZ — kayıt kendini bulmaz', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Suç ve Ceza', yazar: 'Dostoyevski' })]);
    await rafAc(page);
    await page.click('#liste .kart');
    /* Duzenle dugmesi detayin "Kapak, duzenle & diger" katlanir bolumunde */
    await page.evaluate(() => { const d = document.getElementById('dDigerKatla'); if(d) d.open = true; });
    await page.click('#ortuDetay [data-act="duzenle"]');
    await ayrintilarAc(page);
    await page.click('[data-act="form-kaydet"]');
    await expect(kart(page)).toBeHidden();
    expect(await sayi(page)).toBe(1);
  });

});

test.describe('G109b tek otorite ve öteki yollar', () => {

  test('(h) kural ÇEKİRDEKTE, katalog.js kendi kopyasını kullanmaz', async ({ page }) => {
    await rafAc(page);
    const d = await page.evaluate(() => ({
      cekirdek: !!(window.__kopya && window.__kopya.zatenVar && window.__kopya.adYazarVar),
      /* katalog.js sarmalayıcısı çekirdeğe DELEGE eder — iki yerde iki kopya
         kural, v112'de mutasyonun sağ kalmasına yol açan hatanın aynısıydı. */
      katalogDelege: (window.__katalog && window.__katalog.zatenVar)
        ? String(window.__katalog.zatenVar).indexOf('__kopya') > -1 : null
    }));
    expect(d.cekirdek, 'zatenVar + adYazarVar çekirdekte').toBe(true);
    expect(d.katalogDelege, 'katalog.js çekirdeğe delege ediyor').toBe(true);
  });

  test('(i) iki kol: ad+yazar VE ISBN — ikisi de yakalar', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Kitap A', yazar: 'Yazar A', isbn: ISBN })]);
    await rafAc(page);
    const d = await page.evaluate(isbn => ({
      adYazar: !!window.__kopya.zatenVar('Kitap A', 'Yazar A', '', null),
      isbnKolu: !!window.__kopya.zatenVar('Bambaşka Ad', 'Bambaşka Yazar', isbn, null),
      alakasiz: !!window.__kopya.zatenVar('Yok Böyle', 'Kimse', '', null),
      /* adYazarVar ISBN'e BAKMAZ — form yolunun dar kolu */
      darKolIsbn: !!window.__kopya.adYazarVar('Bambaşka Ad', 'Bambaşka Yazar', null)
    }), ISBN);
    expect(d.adYazar).toBe(true);
    expect(d.isbnKolu, 'ISBN ikinci kol olarak yakalar').toBe(true);
    expect(d.alakasiz).toBe(false);
    expect(d.darKolIsbn, 'dar kol yalnız ad+yazar').toBe(false);
  });

  test('(j) adTr ENGEL koluna girmez — çeviri baskısı eklenebilir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'An Actor Prepares', adTr: 'Bir Aktör Hazırlanıyor',
      yazar: 'Stanislavski' })]);
    await formAc(page);
    await ekle(page, 'Bir Aktör Hazırlanıyor', 'Stanislavski');
    await expect(kart(page), 'adTr eşleşmesi ENGEL değil (v96 kararı)').toBeHidden();
    expect(await sayi(page), 'çeviri baskısı ayrı fiziksel kitap').toBe(2);
  });

  test('(k) Keşfet "İstek listeme ekle" ekleme ANINDA da korunur', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Zaten Var', yazar: 'Bir Yazar' })]);
    await rafAc(page);
    const d = await page.evaluate(() => {
      /* Bayat düğme senaryosu: liste açıkken kitap başka yoldan eklendi.
         Ekleme anı kapısı olmasaydı sessizce ikinci kayıt oluşurdu. */
      const eski = window.__kopya.zatenVar('Zaten Var', 'Bir Yazar', '', null);
      return { bulundu: !!eski, sayi: veri.kitaplar.length };
    });
    expect(d.bulundu).toBe(true);
    /* DAVRANIŞLA sınanır, kaynak dizgisiyle DEĞİL: ilk yazımda `fn.includes
       ('__kopya')` kontrolü vardı ve mutasyon (koşulu false yapmak) onu
       YAKALAYAMADI — ad gövdede duruyordu. Ders: "kod şu ismi içeriyor mu"
       bir davranış iddiası değildir. */
    const sonuc = await page.evaluate(() => {
      const K = window.__kesfet;
      K.B.gorunen = [{ ad: 'Zaten Var', yazar: 'Bir Yazar', isbn: '' }];
      K.bEkle(0);
      return { sayi: veri.kitaplar.length,
        adlar: veri.kitaplar.map(k => k.ad) };
    });
    expect(sonuc.sayi, 'bayat düğme ikinci kayıt üretmez').toBe(1);
    await expect(page.locator('#toast')).toContainText('Zaten kütüphanende');
    /* Yeni bir aday NORMAL eklenir — kapı yanlış pozitif üretmiyor */
    const yeni = await page.evaluate(() => {
      const K = window.__kesfet;
      K.B.gorunen = [{ ad: 'Bambaşka Kitap', yazar: 'Başka Yazar', isbn: '' }];
      K.bEkle(0);
      return veri.kitaplar.length;
    });
    expect(yeni, 'gerçekten yeni kitap eklenir').toBe(2);
  });

});
