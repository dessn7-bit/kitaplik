'use strict';
/* G45 — Keşfet-B ALAKA DENETİMİ (v53).
   KUSUR (canlı v52 render'ı): kütüphanede "Yazar 0" varken YENİ KİTAPLAR >
   YAZAR bölümü "YOLCU — Metin Yazar", "İç ses — Meçhul yazar", "Baharla gelen
   — Erhan Bener (Türk yazar)" önerdi ve hepsine "Yazar 0: bitirdiğin 3 kitaba
   ortalama 9,0 verdin" gerekçesini astı. Kaynak, adında o kelime GEÇEN yazarları
   döndürüyordu; dönenin gerçekten o yazar olduğu hiç denetlenmiyordu.

   SÖZLEŞMELER (bu dosyanın koruduğu):
   - Çok sözcüklü ad: adayın SON sözcüğü tam eşleşmeli + sorgunun ≥2 harfli tüm
     sözcükleri adayda geçmeli. Yalnız soyadı eşleşmesi YETMEZ (vaka c).
   - Tek sözcüklü ad (mononim, v62): adayın İLK sözcüğü tam eşit olmalı ve
     aday bağlaç ("ve/and/ile") içermemeli. Birebir-tam-eşitlik klasikleri
     kaybettiriyordu ("Homeros Homer", "Konfüçyüs Confucius" biçimleri);
     ilk-sözcük kuralı "Ali" → "Sabahattin Ali"yi yine eler (tek ad Türk
     düzeninde SOYAD olur ve sonda durur), "Homeros ve Hesiodos"u bağlaç eler.
   - Anlamlı sözcüğü olmayan ad ("Yazar 0", "Anonim", "Kolektif") kaynağa HİÇ
     sorulmaz (vaka d).
   - Seride İKİ denetim: seri adı başlıkta geçmeli VE yazar eşleşmeli (vaka e).
   - Eleme kotadan ÖNCE; eşleşen kalmazsa yazar/seri ATLANIR, doldurma YOK.
   (Mutasyon: yazarEslesir süzgeci kaldırılır → (a) ve türevleri kırmızı.) */
const { test, expect, tohumla, sahteKitap, bugunISO } = require('./yardim');

function bitmis(ek) {
  return sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30) }, ek));
}
function okunacak(ek) {
  return sahteKitap(Object.assign({ durum: 'okunacak', sahiplik: 'sahip' }, ek));
}
/* Puanı 8+ olan iki kitap → sevilen yazar. Yazar adı parametrik. */
function sevilen(yazar) {
  return [bitmis({ ad: 'S1 ' + yazar, yazar, puan: 9 }),
          bitmis({ ad: 'S2 ' + yazar, yazar, puan: 10 })];
}
function gItem(ad, yazarlar, ek) {
  // language:'tr' varsayılan (v65): bu grubun konusu YAZAR alaka denetimi —
  // dil süzgeci (g54) adayları ayrıca elemesin diye sahte kayıtlar Türkçe gelir.
  return { volumeInfo: Object.assign({ title: ad, language: 'tr',
    authors: Array.isArray(yazarlar) ? yazarlar : [yazarlar] }, ek || {}) };
}
async function kesfetAc(page) {
  await page.goto('/');
  await page.click('nav [data-act="sekme"][data-v="kesfet"]');
  await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
}
/* Tıklama TEK BAŞINA yeterli değil: bGetir sıralı sorgular yapıyor ve
   allTextContents()/__agSayac okumaları YENİDEN DENEMEZ (bu projenin bilinen
   yarış deseni). Yükleme metni kaybolana kadar bekle — hem dolu hem boş
   sonuçta doğru bekleme noktası burası. */
async function getir(page) {
  await page.click('#ksB [data-act="ks-b-getir"]');
  await expect(page.locator('#ksB')).not.toContainText('Kaynaklara soruluyor',
    { timeout: 15000 });
}
function adlar(page) {
  return page.locator('#ksB .ks-b-ad').allTextContents();
}

test.describe('G45 Keşfet-B alaka denetimi', () => {

  test('(a) sorgulanan yazarla eşleşmeyen aday ELENİR', async ({ page }) => {
    await tohumla(page, sevilen('Ahmet Ümit'));
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Alakasız 1', 'Metin Yazar'),          // hiç ilgisi yok
      gItem('Alakasız 2', 'Mehmet Ümitoğlu'),      // soyadı farklı (Ümitoğlu)
      gItem('Gerçek Kitap', 'Ahmet Ümit'),         // TAM eşleşme
      gItem('Alakasız 3', 'Meçhul yazar')] };
    await getir(page);
    expect(await adlar(page)).toEqual(['Gerçek Kitap']);
  });

  test('(a2) canlı kusurun aynısı: adında kelime GEÇEN yazarlar elenir', async ({ page }) => {
    // "Yazar 01" sorgulanabilir (anlamlı sözcük "01"), ama canlıda dönen
    // adayların hiçbiri bu yazar değil — tamamı elenmeli.
    await tohumla(page, sevilen('Yazar 01'));
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('YOLCU', 'Metin Yazar'),
      gItem('İç ses', 'Meçhul yazar'),
      gItem('Baharla gelen', 'Erhan Bener (Türk yazar)'),
      gItem('Die Erlösung der Seele 1', 'Tamer Yazar')] };
    await getir(page);
    expect(await adlar(page)).toEqual([]);
    await expect(page.locator('#ksB .ks-b-not')).toContainText('bulunamadı');
  });

  test('(b) eşleşme sonrası boş kalan yazar atlanır; uydurma satır YOK', async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', e => hatalar.push(String(e)));
    await tohumla(page, sevilen('Ahmet Ümit'));
    await kesfetAc(page);
    page.__agAyar.google = { items: [gItem('Hepsi Çöp', 'Bambaşka Kişi')] };
    await getir(page);
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(0);
    await expect(page.locator('#ksB .ks-b-not')).toContainText('bulunamadı');
    expect(page.__agSayac.google, 'sorgu atıldı ama sonuç elendi').toBeGreaterThan(0);
    expect(hatalar).toEqual([]);
  });

  test('(c) KARAR: soyadı eşleşiyor ama ad farklıysa ELENİR', async ({ page }) => {
    await tohumla(page, sevilen('Isaac Asimov'));
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Robotlar', 'Janet Asimov'),           // soyadı aynı, ad farklı → elenir
      gItem('Ben Robot', 'Isaac Asimov')] };
    await getir(page);
    expect(await adlar(page)).toEqual(['Ben Robot']);
  });

  test('(c2) adayın FAZLADAN soyadı varsa elenir, göbek adı varsa geçer', async ({ page }) => {
    await tohumla(page, [...sevilen('Ali Kemal'), ...sevilen('Fyodor Dostoyevski')]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Gülüşü', 'Ali Kemal Sunal'),          // BAŞKA kişi → elenir
      gItem('Ömrüm', 'Ali Kemal'),
      gItem('Suç ve Ceza', 'Fyodor Mihayloviç Dostoyevski')] };   // göbek adı → geçer
    await getir(page);
    const l = await adlar(page);
    expect(l).toContain('Ömrüm');
    expect(l).toContain('Suç ve Ceza');
    expect(l).not.toContain('Gülüşü');
  });

  test('(d) anlamlı sözcüğü olmayan yazar adında sorgu ATILMAZ', async ({ page }) => {
    for (const ad of ['Yazar 0', 'Anonim', 'Kolektif']) {
      await tohumla(page, sevilen(ad));
      await kesfetAc(page);
      // sinyal yok sayılır: getir düğmesi bile çıkmaz
      await expect(page.locator('#ksB [data-act="ks-b-getir"]'), ad).toHaveCount(0);
      await expect(page.locator('#ksB .ks-b-not')).toContainText('önce sinyal gerek');
      expect(page.__agSayac.google, ad + ' için sorgu atılmamalı').toBe(0);
      await page.evaluate(() => localStorage.removeItem('__kk_tohumlandi'));
    }
  });

  test('(d2) sorgulanamaz yazar KOTA yuvasını işgal etmez', async ({ page }) => {
    // "Anonim" en yüksek ortalamaya sahip; kota 3 ise 3 gerçek yazar sorulmalı
    await tohumla(page, [
      ...sevilen('Anonim'),
      bitmis({ ad: 'A1', yazar: 'Ahmet Ümit', puan: 9 }),
      bitmis({ ad: 'B1', yazar: 'Orhan Pamuk', puan: 9 }),
      bitmis({ ad: 'C1', yazar: 'Sabahattin Ali', puan: 9 }),
      bitmis({ ad: 'D1', yazar: 'Yaşar Kemal', puan: 9 })]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [] };
    await getir(page);
    expect(page.__agSayac.google, 'kota 3 gerçek yazara harcandı').toBe(3);
  });

  test('mononim: kapsayan ad ve bağlaçlı derleme elenir', async ({ page }) => {
    await tohumla(page, sevilen('Homeros'));
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Derleme', 'Homeros ve Hesiodos'),     // bağlaç = birden çok kişi → elenir
      gItem('Odysseia', 'Homeros'),
      gItem('Başkası', 'Sabahattin Homeros')] };   // tek ad sonda = soyad düzeni → elenir
    await getir(page);
    expect(await adlar(page)).toEqual(['Odysseia']);
  });

  /* v62 D2 — mononim yazarlar (Homeros, Aristoteles...) kaynak varyantlarında
     KAYBOLUYORDU: eski kural adayın TAMAMININ tek sözcük olmasını istiyordu.
     (Mutasyon D2: ilk-sözcük kuralı geri alınırsa bu vaka kırmızı.) */
  test('mononim v62: parantezli ve çift-ad varyantları KABUL, soyad-biçimi RED', async ({ page }) => {
    await tohumla(page, sevilen('Homeros'));
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('İlyada', 'Homeros (Homer)'),          // parantezli varyant → KABUL
      gItem('Odysseia', 'Homeros Homer'),          // çift-ad varyantı → KABUL (v62 kazanımı)
      gItem('Sahte', 'Homer Homeros'),             // ilk sözcük farklı → RED
      gItem('Denemeler', 'Başka Yazar')] };        // alakasız → RED (görev d vakası)
    await getir(page);
    expect(await adlar(page)).toEqual(['İlyada', 'Odysseia']);
  });

  test('mononim v62: "Ali" sorgusu "Sabahattin Ali"yi HÂLÂ KABUL ETMEZ (koruma sürüyor)', async ({ page }) => {
    await tohumla(page, sevilen('Ali'));
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Kürk Mantolu Madonna', 'Sabahattin Ali'),   // tek ad sonda = soyad → RED
      gItem('Ali Kitabı', 'Ali')] };                     // birebir mononim → KABUL
    await getir(page);
    expect(await adlar(page)).toEqual(['Ali Kitabı']);
  });

  test('mononim v62: birebir tek-ad eşleşmesi çalışmaya devam eder (Aristoteles)', async ({ page }) => {
    await tohumla(page, sevilen('Aristoteles'));
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Poetika', 'Aristoteles'),
      gItem('Retorik', 'Aristoteles, Ari'),        // virgüllü alan: ilk parça eşit → KABUL
      gItem('Sokrates Kitabı', 'Sokrates')] };     // farklı mononim → RED
    await getir(page);
    expect(await adlar(page)).toEqual(['Poetika', 'Retorik']);
  });

  test('çok yazarlı ve parantezli aday alanları doğru çözülür', async ({ page }) => {
    await tohumla(page, [...sevilen('Isaac Asimov'), ...sevilen('Halil Cibran')]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Vakıf Dizisi', ['Isaac Asimov', 'Ali Kaftan']),   // çok yazarlı → geçer
      gItem('Ermiş', 'Halil Cibran (Kahlil Gibran)')] };       // parantezli → geçer
    await getir(page);
    const l = await adlar(page);
    expect(l).toContain('Vakıf Dizisi');
    expect(l).toContain('Ermiş');
  });

  test('eleme KOTADAN ÖNCE: baştaki çöp gerçek kitabı listeden atmaz', async ({ page }) => {
    await tohumla(page, sevilen('Ahmet Ümit'));
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Cop 1', 'Metin Yazar'), gItem('Cop 2', 'Metin Yazar'),
      gItem('Cop 3', 'Metin Yazar'), gItem('Cop 4', 'Metin Yazar'),
      gItem('Beşinci Sıradaki Gerçek', 'Ahmet Ümit')] };
    await getir(page);
    expect(await adlar(page)).toEqual(['Beşinci Sıradaki Gerçek']);
  });

  test('(e) SERİ: seri adı başlıkta geçmeyen aday elenir', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Harry Potter ve Felsefe Taşı', yazar: 'J.K. Rowling',
        seri: 'Harry Potter', ciltNo: 1, puan: 7 }),
      bitmis({ ad: 'Harry Potter ve Sırlar Odası', yazar: 'J.K. Rowling',
        seri: 'Harry Potter', ciltNo: 2, puan: 7 }),
      okunacak({ ad: 'Harry Potter ve Ateş Kadehi', yazar: 'J.K. Rowling',
        seri: 'Harry Potter', ciltNo: 4 })]);
    await kesfetAc(page);
    // canlı ölçümden: bu sorgu Rowling'in seri DIŞI kitaplarını da döndürüyor
    page.__agAyar.google = { items: [
      gItem('Çağlar Boyu Quidditch', 'J.K. Rowling'),
      gItem('Ozan Beedle’ın Hikâyeleri', 'J.K. Rowling'),
      gItem('Harry Potter ve Azkaban Tutsağı', 'J.K. Rowling')] };
    await getir(page);
    expect(await adlar(page)).toEqual(['Harry Potter ve Azkaban Tutsağı']);
    await expect(page.locator('#ksB .ks-b-neden')).toContainText('Harry Potter serisinin');
  });

  test('(e2) SERİ: seri adı geçse de yazarı tutmayan aday elenir', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Vakıf', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 1, puan: 7 }),
      bitmis({ ad: 'Vakıf ve İmparatorluk', yazar: 'Isaac Asimov',
        seri: 'Vakıf', ciltNo: 2, puan: 7 }),
      okunacak({ ad: 'Vakıfın Sınırı', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 4 })]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Vakıf Hukuku El Kitabı', 'Bambaşka Hukukçu'),   // seri adı geçiyor, yazar değil
      gItem('İkinci Vakıf', 'Isaac Asimov')] };
    await getir(page);
    expect(await adlar(page)).toEqual(['İkinci Vakıf']);
  });

  test('(e3) SERİ yazarı denetlenemiyorsa yalnız seri adı bağlar', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Dede Korkut 1', yazar: 'Anonim', seri: 'Dede Korkut', ciltNo: 1, puan: 7 }),
      bitmis({ ad: 'Dede Korkut 2', yazar: 'Anonim', seri: 'Dede Korkut', ciltNo: 2, puan: 7 }),
      okunacak({ ad: 'Dede Korkut 4', yazar: 'Anonim', seri: 'Dede Korkut', ciltNo: 4 })]);
    await kesfetAc(page);
    page.__agAyar.google = { items: [
      gItem('Dede Korkut Hikâyeleri 3', 'Muharrem Ergin'),   // yazar denetlenmez → geçer
      gItem('Başka Bir Destan', 'Muharrem Ergin')] };        // seri adı yok → elenir
    await getir(page);
    expect(await adlar(page)).toEqual(['Dede Korkut Hikâyeleri 3']);
  });

  test('TÜR adayları alaka denetiminden ETKİLENMEZ (kaynak tür üyeliğini garanti eder)',
    async ({ page }) => {
      await tohumla(page, [
        bitmis({ ad: 'F1', yazar: 'Bir Yazar', tur: 'Felsefe', puan: 9 }),
        bitmis({ ad: 'F2', yazar: 'Başka Yazar', tur: 'Felsefe', puan: 8 })]);
      await kesfetAc(page);
      page.__agAyar.turler = [{ seo: 'Felsefe-Dusunce', ad: 'Felsefe-Düşünce', kitapSayisi: 4114 }];
      page.__agAyar.tur = { 'Felsefe-Dusunce': { tur: { seo: 'Felsefe-Dusunce', ad: 'Felsefe-Düşünce' },
        hasMore: false, sonuclar: [
          { ad: 'Yabancı', yazar: 'Albert Camus', puan: 7.9, okuyan: 138762, kapak: null }] } };
      await getir(page);
      expect(await adlar(page)).toContain('Yabancı');
    });
});
