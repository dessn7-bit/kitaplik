'use strict';
/* G58 — üç iş paketi (v69):
   M1 BOŞ KAPAK LEVHASI: OpenLibrary "kapak yok" için 200 + 1×1 boş GIF döndürür,
      error tetiklenmez, levha sessizce boş kalırdı (canlı ölçüm: 242 kitabın
      37'si). Çözüm ikili: (a) OpenLibrary URL'sine İSTEK ANINDA ?default=false
      (kayıtlı URL değişmez) → kapak yoksa 404 → mevcut plateKapakYedek;
      (b) yük SONRASI naturalWidth<=1 denetimi → kaynaktan bağımsız boş görsel
      de aynı TEK yedek yoluna düşer. Tembel yükleme (loading="lazy") korunur.
   M2 BAŞLIK VARYANTI: "Romeo and Juliet — William Shakespeare" raftayken Keşfet
      "Romeo ve Juliet — William Shakespeare" öneriyordu (birebir eleme vardı,
      varyant eleme yoktu). Kural: yazar eşleşiyorsa bağlaç/edat atılıp KISA
      başlığın uzunda bulunma oranı >= 0.8 ise aynı kitap (adBenzer, bElenmis'te
      — yazar/seri/tür ÜÇ kaynağı tek noktadan kapsar). BİLİNÇLİ SINIR: hiç
      ortak sözcük taşımayan çeviri başlıkları ("Suç ve Ceza"/"Crime and
      Punishment") bu yöntemle yakalanmaz.
   M3 RAFINDAN HAVUZU: 'yarim' durumu da aday havuzuna girer (rozet "Yarım
      bıraktığın", düğme "Devam et", ilerleme korunur); aday azken dürüst
      yönlendirme notu (bitti sayısı gerçek veriden), aday çokken not yok.
   (Mutasyon M1: ktPlateHata'daki naturalWidth<=1 yük denetimi kaldırılır →
      1×1 vakaları kırmızı. Mutasyon M2: bElenmis'teki adBenzer elemesi
      kaldırılır → Romeo vakası kırmızı. Mutasyon M3: hesaplaHam'dan 'yarim'
      çıkarılır → havuz/rozet vakaları kırmızı.) */
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc } = require('./yardim');

/* eski BOS_PNG: geçerli 1×1 PNG — OpenLibrary'nin "boş kapak" imzasının taklidi */
const BIR_PIKSEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64');
const OL_KAPAK = 'https://covers.openlibrary.org/b/isbn/9990000000001-M.jpg';
const BOS_KAPAK = 'https://covers.bos.example/bir-piksel.png';

/* OpenLibrary'nin GERÇEK davranışı: parametresiz istek 200 + 1×1; ?default=false
   isteği kapak yoksa 404. (sonradan kayıt = agTaklit'ten öncelikli) */
async function openLibraryTaklidi(page, kayit) {
  await page.route('**/covers.openlibrary.org/**', r => {
    const url = r.request().url();
    kayit.push(url);
    if (url.includes('default=false')) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'image/png', body: BIR_PIKSEL });
  });
}
async function birPikselRotasi(page) {
  await page.route('**/covers.bos.example/**', r =>
    r.fulfill({ status: 200, contentType: 'image/png', body: BIR_PIKSEL }));
}

function bitmis(ek) {
  return sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30) }, ek));
}
function okunacak(ek) {
  return sahteKitap(Object.assign({ durum: 'okunacak', sahiplik: 'sahip' }, ek));
}
function taban() {   // 3 puanlı bitmiş = skor modu eşiği; puanlar < 8 → sevilen yazar yok
  return [
    bitmis({ ad: 'Taban 1', yazar: 'Taban Yazar 1', tur: 'Deneme', puan: 6 }),
    bitmis({ ad: 'Taban 2', yazar: 'Taban Yazar 2', tur: 'Anı', puan: 5 }),
    bitmis({ ad: 'Taban 3', yazar: 'Taban Yazar 3', tur: 'Gezi', puan: 6 })
  ];
}
function gItem(ad, yazar, ek) {
  return { volumeInfo: Object.assign({ title: ad, authors: [yazar], publisher: 'Yayınevi A',
    publishedDate: '2021', pageCount: 320, language: 'tr' }, ek || {}) };
}
async function kesfetAc(page) {
  await page.goto('/');
  await page.click('nav [data-act="sekme"][data-v="kesfet"]');
  await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
}

test.describe('G58-M1 boş kapak levhası', () => {

  test('(a) OpenLibrary: istek ?default=false taşır, 404 yedeğe düşer, KAYITLI URL değişmez', async ({ page }) => {
    const istekler = [];
    await openLibraryTaklidi(page, istekler);
    await tohumla(page, [sahteKitap({ ad: 'Kapağı Olmayan', yazar: 'Açık Kitaplık', kapak: OL_KAPAK })]);
    await rafAc(page);
    const levha = page.locator('#ktSiradaSerit .kt-sira-plate');
    // 404 → error → plateKapakYedek: tipografik yedek (boş çerçeve DEĞİL)
    await expect(levha).toHaveClass(/p-bos/);
    await expect(levha.locator('img')).toHaveCount(0);
    await expect(levha.locator('.kt-sira-ad')).toHaveText('Kapağı Olmayan');
    // istek parametreli gitti (kaynakta çözüm)…
    expect(istekler.length).toBeGreaterThan(0);
    expect(istekler.every(u => u.includes('default=false')), 'tüm OL istekleri parametreli').toBe(true);
    // …ama VERİDEKİ URL olduğu gibi (istek-anı dönüşüm kararı)
    const kayitli = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kk_kitaplik_v1')).kitaplar[0].kapak);
    expect(kayitli).toBe(OL_KAPAK);
  });

  test('(b) 200 + 1×1 boş görsel (kaynak fark etmez): DÖRT yüzeyde de ad-karoya düşer', async ({ page }) => {
    await birPikselRotasi(page);
    await tohumla(page, [sahteKitap({ ad: 'Boş Görselli', yazar: 'Sessiz Sunucu', kapak: BOS_KAPAK })],
      { kk_gorunum_v1: null });   // ızgara varsayılanı
    await rafAc(page);
    // 1) ŞERİT (SIRADA levhası)
    const serit = page.locator('#ktSiradaSerit .kt-sira-plate');
    await expect(serit).toHaveClass(/p-bos/);
    await expect(serit.locator('img')).toHaveCount(0);
    await expect(serit.locator('.kt-sira-ad')).toHaveText('Boş Görselli');
    // 2) IZGARA (tam ad karosu)
    await expect(page.locator('#liste')).toHaveClass(/izgara/);
    const kart = page.locator('#liste .kart .plate');
    await expect(kart).toHaveClass(/p-bos/);
    await expect(kart.locator('img')).toHaveCount(0);
    await expect(kart.locator('.iz-yedek')).toHaveText('Boş Görselli');
    // 3) DETAY (künye levhası)
    await page.click('#liste .kart');
    const dPlate = page.locator('#ortuDetay .d-plate');
    await expect(dPlate).toHaveClass(/p-bos/);
    await expect(dPlate.locator('img')).toHaveCount(0);
    await expect(dPlate.locator('.d-plate-ad')).toHaveText('Boş Görselli');
    await page.keyboard.press('Escape');
    // 4) LİSTE (mini levha — metin satırın kendisinde, levha sade çerçeve)
    await page.click('#duzenListe');
    const mini = page.locator('#liste .kart .plate');
    await expect(mini).toHaveClass(/p-bos/);
    await expect(mini.locator('img')).toHaveCount(0);
  });

  test('(c) GERÇEK kapak: görsel kalır, yedek TETİKLENMEZ, tembel yükleme niteliği yerinde', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Sağlam Kapaklı', yazar: 'İyi Sunucu',
      kapak: 'https://covers.openlibrary.org/b/id/2-M.jpg' })], { kk_gorunum_v1: null });
    await rafAc(page);
    const img = page.locator('#liste .kart .plate img');
    await expect(img).toHaveCount(1);
    const dogal = await img.evaluate(el => el.naturalWidth);
    expect(dogal, 'taklit kapak >1px yüklendi').toBeGreaterThan(1);
    await expect(page.locator('#liste .kart .plate')).not.toHaveClass(/p-bos/);
    // tembel yükleme bozulmadı: nitelik üreticide duruyor
    expect(await img.getAttribute('loading')).toBe('lazy');
    // şeritte de aynı: kapaklı levha kapaklı kalır
    await expect(page.locator('#ktSiradaSerit .kt-sira-plate')).toHaveClass(/kt-sira-kapakli/);
  });
});

test.describe('G58-M2 başlık varyantı elemesi', () => {

  test('YAZAR kaynağı: varyant ELENİR, kardeş eserler KALIR', async ({ page }) => {
    await tohumla(page, [...taban(),
      bitmis({ ad: 'Romeo and Juliet', yazar: 'William Shakespeare', puan: 9 }),
      bitmis({ ad: 'Hamlet', yazar: 'William Shakespeare', puan: 10 })]);
    await kesfetAc(page);
    // kaynak kotası (yazar başına ilk 3) ÇİZİM-anı elemeden önce yaşar (v51
    // tasarımı) — bu vaka kotayı aşmayan 3 adayla eleme davranışını kilitler
    page.__agAyar.google = { items: [
      gItem('Romeo ve Juliet', 'William Shakespeare'),      // ÇEVİRİ VARYANTI → elenmeli
      gItem('Macbeth', 'William Shakespeare'),              // kardeş eser → kalmalı
      gItem('Kral Lear', 'William Shakespeare')] };         // kardeş eser → kalmalı
    await page.click('#ksB [data-act="ks-b-getir"]');
    // gerçek olanlar KALIYOR (v53 dersi: boş liste yanlış sebeple yeşil olmasın)
    await expect(page.locator('#ksB .ks-b-item', { hasText: 'Macbeth' })).toBeVisible();
    await expect(page.locator('#ksB .ks-b-item', { hasText: 'Kral Lear' })).toBeVisible();
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(2);
    await expect(page.locator('#ksB .ks-b-item', { hasText: 'Romeo ve Juliet' })).toHaveCount(0);
  });

  test('YAZAR kaynağı: KISMİ örtüşme (0,5) aşırı-elemeye kaçmaz', async ({ page }) => {
    await tohumla(page, [...taban(),
      bitmis({ ad: 'Romeo and Juliet', yazar: 'William Shakespeare', puan: 9 }),
      bitmis({ ad: 'Hamlet', yazar: 'William Shakespeare', puan: 10 })]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem("Juliet'in Günlüğü", 'William Shakespeare'),    // örtüşme 1/2 = 0,5 → kalmalı
      gItem('Macbeth', 'William Shakespeare')] };
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item', { hasText: "Juliet'in Günlüğü" })).toBeVisible();
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(2);
  });

  test('SERİ kaynağı: sahip olunan cildin baskı varyantı ELENİR, eksik cilt KALIR', async ({ page }) => {
    await tohumla(page, [...taban(),
      bitmis({ ad: 'Vakıf', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 1, puan: 7 }),
      bitmis({ ad: 'Vakıf ve İmparatorluk', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 2, puan: 7 }),
      okunacak({ ad: 'Vakıfın Sınırı', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 4 })]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Vakıf (Özel Baskı)', 'Isaac Asimov'),   // 1. cildin varyantı → elenmeli
      gItem('İkinci Vakıf', 'Isaac Asimov')] };       // gerçek eksik cilt → kalmalı
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item', { hasText: 'İkinci Vakıf' })).toBeVisible();
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);
  });

  test('CİLT KORUMASI: numarasız ilk cilt raftayken numaralı/romen devam cildi ELENMEZ; baskı varyantı ELENİR', async ({ page }) => {
    // taze-göz kusuru: "İnce Memed" alt-küme oranı 1.0 ile "İnce Memed 2"yi
    // yutuyordu — eksik-seri önerisinin tam hedefi sessizce bastırılırdı
    await tohumla(page, [...taban(),
      bitmis({ ad: 'İnce Memed', yazar: 'Yaşar Kemal', puan: 9 })]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('İnce Memed 2', 'Yaşar Kemal'),             // rakamlı devam cildi → KALMALI
      gItem('İnce Memed II', 'Yaşar Kemal'),            // romen rakamlı → KALMALI
      gItem('İnce Memed (Özel Baskı)', 'Yaşar Kemal')] };// baskı varyantı → elenmeli
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item', { hasText: 'İnce Memed 2' })).toBeVisible();
    await expect(page.locator('#ksB .ks-b-item', { hasText: 'İnce Memed II' })).toBeVisible();
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(2);
    await expect(page.locator('#ksB .ks-b-item', { hasText: 'Özel Baskı' })).toHaveCount(0);
  });

  test('TÜR kaynağı: alt başlıklı varyant ELENİR; FARKLI yazarın aynı adlısı KALIR', async ({ page }) => {
    await tohumla(page, [...taban(),
      bitmis({ ad: 'Dinozorların Yükselişi ve Çöküşü', yazar: 'Steve Brusatte', tur: 'Bilim', puan: 9 }),
      bitmis({ ad: 'Evren Kitabı', yazar: 'Ayşe Bilgin', tur: 'Bilim', puan: 8 })]);
    await kesfetAc(page);
    page.__agAyar.turler = [{ seo: 'Bilim', ad: 'Bilim', kitapSayisi: 5000 }];
    page.__agAyar.tur = { Bilim: { tur: { seo: 'Bilim', ad: 'Bilim' }, hasMore: true, sonuclar: [
      { ad: 'Dinozorların Yükselişi ve Çöküşü: Kayıp Dünyanın Yepyeni Bir Tarihi',
        yazar: 'Steve Brusatte', puan: 8.1, okuyan: 12000, kapak: null },      // alt başlık varyantı → elenmeli
      { ad: 'Dinozorların Yükselişi ve Çöküşü', yazar: 'Bambaşka Derlemeci',
        puan: 7.4, okuyan: 900, kapak: null },                                 // farklı yazar, aynı ad → kalmalı
      { ad: 'Evrenin Dokusu', yazar: 'Brian Greene', puan: 8.6, okuyan: 30000, kapak: null }
    ] } };
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item', { hasText: 'Evrenin Dokusu' })).toBeVisible();
    await expect(page.locator('#ksB .ks-b-item', { hasText: 'Bambaşka Derlemeci' })).toBeVisible();
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(2);
    await expect(page.locator('#ksB .ks-b-item', { hasText: 'Kayıp Dünyanın' })).toHaveCount(0);
  });
});

test.describe('G58-M3 rafından havuzu: yarım kalanlar', () => {

  test('yarım kitap havuzda: rozet + "Devam et" + açılış bileşimi; okunuyor/bitti yine dışarıda', async ({ page }) => {
    await tohumla(page, [...taban(),
      okunacak({ ad: 'Okunacak Bir', yazar: 'Yazar Bir', puan: null }),
      sahteKitap({ ad: 'Yarım Kalan', yazar: 'Yazar İki', durum: 'yarim', sayfa: 200,
        guncelSayfa: 40, baslamaTarihi: bugunISO(-60), bitisTarihi: bugunISO(-10) }),
      sahteKitap({ ad: 'Şu An Okunan', yazar: 'Yazar Üç', durum: 'okunuyor', baslamaTarihi: bugunISO(-5) })]);
    await kesfetAc(page);
    await expect(page.locator('.ks-acilis'))
      .toContainText('2 aday (1 okunacak · 1 yarım kalan) arasından');
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(2);
    const yarimSatir = page.locator('#ksIcerik .ks-item', { hasText: 'Yarım Kalan' });
    await expect(yarimSatir.locator('.ks-yarim')).toHaveText('Yarım bıraktığın');
    await expect(yarimSatir.locator('.ks-basla')).toHaveText('Devam et');
    const dizSatir = page.locator('#ksIcerik .ks-item', { hasText: 'Okunacak Bir' });
    await expect(dizSatir.locator('.ks-yarim')).toHaveCount(0);
    await expect(dizSatir.locator('.ks-basla')).toHaveText('Okumaya başla');
    // okunuyor/bitti havuza girmedi
    await expect(page.locator('#ksIcerik .ks-item', { hasText: 'Şu An Okunan' })).toHaveCount(0);
  });

  test('"Devam et": durum okunuyor olur, İLERLEME KORUNUR, bırakma tarihi temizlenir', async ({ page }) => {
    await tohumla(page, [...taban(),
      sahteKitap({ ad: 'Yarım Kalan', yazar: 'Yazar İki', durum: 'yarim', sayfa: 200,
        guncelSayfa: 40, baslamaTarihi: bugunISO(-60), bitisTarihi: bugunISO(-10) })]);
    await kesfetAc(page);
    await page.locator('#ksIcerik .ks-item', { hasText: 'Yarım Kalan' })
      .locator('.ks-basla').click();
    const k = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kk_kitaplik_v1')).kitaplar.find(x => x.ad === 'Yarım Kalan'));
    expect(k.durum).toBe('okunuyor');
    expect(k.guncelSayfa, 'kaldığı sayfa korunur').toBe(40);
    expect(k.bitisTarihi, 'bırakma tarihi temizlenir').toBe(null);
  });

  test('yarım satırında "Şimdi değil" çalışır: satır düşer, ertelenenlerde görünür', async ({ page }) => {
    await tohumla(page, [...taban(),
      sahteKitap({ ad: 'Yarım Ertelenen', yazar: 'Yazar İki', durum: 'yarim',
        guncelSayfa: 10, baslamaTarihi: bugunISO(-60), bitisTarihi: bugunISO(-10) })]);
    await kesfetAc(page);
    await page.locator('#ksIcerik .ks-item', { hasText: 'Yarım Ertelenen' })
      .locator('[data-act="ks-ertele"]').click();
    await expect(page.locator('#ksIcerik .ks-item', { hasText: 'Yarım Ertelenen' })).toHaveCount(0);
    await expect(page.locator('.ks-erteli')).toContainText('1 kitabı ertelemiştin');
  });

  test('az-aday notu: havuz küçük + bitti çoksa GÖRÜNÜR; sayı SAHİP kümesinden (istek sayılmaz)', async ({ page }) => {
    const onBitmis = [];
    for (let i = 1; i <= 10; i++)
      onBitmis.push(bitmis({ ad: 'Biten ' + i, yazar: 'Yazar ' + i, puan: 6 }));
    await tohumla(page, [...onBitmis,
      okunacak({ ad: 'Tek Okunacak', yazar: 'Yalnız Yazar' }),
      // istek-listesi okunacağı SAYIYA GİRMEZ (taze-göz kusuru: girseydi "2" derdi)
      sahteKitap({ ad: 'İstekteki', yazar: 'Dış Yazar', durum: 'okunacak', sahiplik: 'istek' })]);
    await kesfetAc(page);
    const not = page.locator('.ks-az-aday');
    await expect(not).toContainText('Yalnızca 1 okunacak kitabın var');
    await expect(not).toContainText('10 kitap “bitti” işaretli');
    await expect(not).toContainText('Okunacak yapabilirsin');
  });

  test('az-aday notu aday yeterliyken GÖRÜNMEZ', async ({ page }) => {
    const onBitmis = [];
    for (let i = 1; i <= 10; i++)
      onBitmis.push(bitmis({ ad: 'Biten ' + i, yazar: 'Yazar ' + i, puan: 6 }));
    const altiAday = [];
    for (let i = 1; i <= 6; i++)
      altiAday.push(okunacak({ ad: 'Aday ' + i, yazar: 'Aday Yazar ' + i }));
    await tohumla(page, [...onBitmis, ...altiAday]);
    await kesfetAc(page);
    await expect(page.locator('#ksIcerik .ks-item').first()).toBeVisible();
    await expect(page.locator('.ks-az-aday')).toHaveCount(0);
  });

  test('yarım adayın gerekçesinde "rafta bekliyor" KURULMAZ (kitap beklemedi, okunuyordu)', async ({ page }) => {
    const eskiEklenme = Date.now() - 200 * 86400000;   // bekleme eşiği (90g) fazlasıyla aşılır
    await tohumla(page, [...taban(),
      sahteKitap({ ad: 'Eski Yarım', yazar: 'Yazar İki', durum: 'yarim', eklenme: eskiEklenme,
        guncelSayfa: 10, baslamaTarihi: bugunISO(-120), bitisTarihi: bugunISO(-60) })]);
    await kesfetAc(page);
    const satir = page.locator('#ksIcerik .ks-item', { hasText: 'Eski Yarım' });
    await expect(satir).toBeVisible();
    await expect(satir.locator('.ks-neden')).not.toContainText('rafta bekliyor');
  });

  test('Ana Sayfa "Sıradaki": yarım aday rozetle ayrılır (motor tek — kopya mantık yok)', async ({ page }) => {
    await tohumla(page, [...taban(),
      sahteKitap({ ad: 'Yarım Kalan', yazar: 'Yazar İki', durum: 'yarim', sayfa: 200,
        guncelSayfa: 40, baslamaTarihi: bugunISO(-60), bitisTarihi: bugunISO(-10) })]);
    await page.goto('/');
    const oneri = page.locator('#asSiradaki .as-oneri', { hasText: 'Yarım Kalan' });
    await expect(oneri).toBeVisible();
    await expect(oneri.locator('.as-yarim')).toHaveText('Yarım bıraktığın');
  });
});
