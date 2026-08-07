/* G30 — Bilgi mimarisi: Ana Sayfa · Kütüphane · Ayarlar penceresi.
   Sözleşme:
   - Uygulama Ana Sayfa'da açılır; kitap listesi ORADA DEĞİL. Son sekme
     HATIRLANMAZ (kalıcı anahtar yok — her açılış Ana Sayfa).
   - Ana Sayfa uydurmaz: verisi olmayan bölüm hiç çizilmez.
   - Ayarlar bir SEKME değil PENCERE; eski Yedek sekmesinin bütün işlevleri
     orada ve çalışır durumda.
   - Kütüphane varsayılanı "Bende olanlar".
   TÜM seçiciler kapsamlı ve görünürlük-bilinçli: #panel-ana / #ortuAyar
   altında, sayımlarda :visible. */
'use strict';
const { test, expect, tohumla, sahteKitap, bugunISO,
  kameraTaklit, onaylariKabulEt, rafAc, ayarlarAc } = require('./yardim');

const YIL = new Date().getFullYear();

function okunanK(ek) {
  return sahteKitap(Object.assign({ ad: 'Okunan Kitap', durum: 'okunuyor',
    sayfa: 300, guncelSayfa: 120, baslamaTarihi: '2026-01-01' }, ek || {}));
}
function bitmisK(ek) {
  return sahteKitap(Object.assign({ ad: 'Bitmiş Kitap', durum: 'bitti', sayfa: 200,
    puan: 8, bitisTarihi: bugunISO() }, ek || {}));
}
/* bugün yapılmış, unutulmamış bir okuma oturumu */
function bugunOturum(dakika, sa, sb) {
  return { b: Date.now() - 3600000, s: dakika * 60000, sa, sb };
}
/* dünden beri tekrar için bekleyen aktif alıntı */
function bekleyenAlinti(i) {
  return { id: 'g30n' + i, tip: 'alinti', metin: 'Alıntı ' + i, tarih: '2026-01-15',
    sayfa: null, fikir: [], tekrarDurum: 'aktif', tekrarAralik: 3,
    tekrarSayisi: 0, tekrarSonraki: bugunISO(-1) };
}

/* ===================================================================== */
test.describe('G30 — açılış Ana Sayfa', () => {

  test('açılışta Ana Sayfa görünür, kitap listesi DEĞİL', async ({ page }) => {
    await tohumla(page, [okunanK(), bitmisK()]);
    await page.goto('/');
    await expect(page.locator('#panel-ana')).toBeVisible();
    await expect(page.locator('#panel-raf')).toBeHidden();
    await expect(page.locator('#liste')).toBeHidden();
    await expect(page.locator('nav [data-v="ana"]')).toHaveClass(/active/);
    await expect(page.locator('nav [data-v="raf"]')).not.toHaveClass(/active/);
    // arama satırı ve + düğmesi Kütüphane'ye ait: Ana Sayfa'da görünmezler
    await expect(page.locator('#aramaSatiri')).toBeHidden();
    await expect(page.locator('.fab')).toBeHidden();
  });

  test('nav dört sekme: Ana Sayfa · Kütüphane · Alıntılar · İstatistik (Yedek YOK)', async ({ page }) => {
    await tohumla(page, []);
    await page.goto('/');
    await expect(page.locator('nav .nav-btn')).toHaveCount(4);
    await expect(page.locator('nav .nav-btn')).toHaveText(
      [/Ana Sayfa/, /Kütüphane/, /Alıntılar/, /İstatistik/]);
    await expect(page.locator('nav [data-v="yedek"]')).toHaveCount(0);
    await expect(page.locator('#panel-yedek')).toHaveCount(0);
  });

  test('son sekme HATIRLANMAZ: başka sekmede bırakıp yenileyince yine Ana Sayfa', async ({ page }) => {
    await tohumla(page, [okunanK()]);
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="ist"]');
    await expect(page.locator('#panel-ist')).toHaveClass(/active/);
    await page.reload();
    await expect(page.locator('#panel-ana')).toHaveClass(/active/);
    await expect(page.locator('#panel-ist')).not.toHaveClass(/active/);
  });

  test('Ana Sayfa dolu kütüphanede sıfır pirinç (g29 sözleşmesi): eylemler çerçeveli', async ({ page }) => {
    await tohumla(page, [okunanK(), bitmisK()]);
    await page.goto('/');
    await expect(page.locator('#panel-ana .btn-brass:visible')).toHaveCount(0);
    await expect(page.locator('#asEylem [data-act="yeni"]')).toHaveClass(/btn-cerceve/);
    await expect(page.locator('#asEylem [data-act="ana-barkod"]')).toHaveClass(/btn-cerceve/);
    await expect(page.locator('#asEylem [data-act="seri-ac"]')).toHaveClass(/btn-cerceve/);
  });
});

/* ===================================================================== */
test.describe('G30 — Ana Sayfa bölümleri gerçek veriyle', () => {

  test('şu an okudukların: ilerleme çubuğu ve yüzde doğru, dokununca detay açılır', async ({ page }) => {
    await tohumla(page, [okunanK(), bitmisK()]);
    await page.goto('/');
    const blok = page.locator('#asOkunuyor');
    await expect(blok).toContainText('Okunan Kitap');
    await expect(blok).toContainText('120 / 300 · %40');
    await expect(blok.locator('.ilerleme > div')).toHaveAttribute('style', 'width:40%');
    await expect(blok).not.toContainText('Bitmiş Kitap');   // yalnız okunuyor
    await blok.locator('.as-satir').first().click();
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await expect(page.locator('#detayIcerik')).toContainText('Okunan Kitap');
  });

  test('en fazla 3 okunan gösterilir, fazlası için "Tümü" Kütüphane\'ye okunuyor filtresiyle götürür', async ({ page }) => {
    await tohumla(page, [1, 2, 3, 4].map(i => okunanK({ ad: 'Okunan ' + i })));
    await page.goto('/');
    await expect(page.locator('#asOkunuyor .as-satir')).toHaveCount(3);
    await expect(page.locator('#asOkunuyor [data-act="ana-okunuyor"]')).toContainText('Tümü (4)');
    await page.click('#asOkunuyor [data-act="ana-okunuyor"]');
    await expect(page.locator('#panel-raf')).toHaveClass(/active/);
    await expect(page.locator('#durumChips .chip.active')).toHaveAttribute('data-v', 'okunuyor');
    await expect(page.locator('#liste .kart')).toHaveCount(4);
  });

  test('okunan kitap yoksa dürüst mesaj, uydurma satır yok', async ({ page }) => {
    await tohumla(page, [bitmisK()]);
    await page.goto('/');
    await expect(page.locator('#asOkunuyor')).toContainText('Şu an okuduğun kitap yok');
    await expect(page.locator('#asOkunuyor .as-satir')).toHaveCount(0);
  });

  test('bugün: tekrar kuyruğu sayısı doğru ve Alıntılar sekmesine götürür', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Alıntılı',
      notlar: [bekleyenAlinti(1), bekleyenAlinti(2), bekleyenAlinti(3)] })]);
    await page.goto('/');
    await expect(page.locator('#asBugun')).toContainText('3 alıntı tekrar için bekliyor');
    await page.click('#asBugun [data-act="ana-tekrar"]');
    await expect(page.locator('#panel-alinti')).toHaveClass(/active/);
    await expect(page.locator('#tkKutu')).toBeVisible();
  });

  test('bugün: okuma süresi ve sayfa özeti bugünkü oturumlardan gelir', async ({ page }) => {
    await tohumla(page, [okunanK({ oturumlar: [bugunOturum(45, 100, 120)] })]);
    await page.goto('/');
    await expect(page.locator('#asBugun')).toContainText('45 dk');
    await expect(page.locator('#asBugun')).toContainText('20');
    await expect(page.locator('#asBugun')).toContainText('sayfa');
  });

  test('bugün hiçbir şey olmadıysa "Bugün" bölümü HİÇ çizilmez (sıfır gösterip suçlamaz)', async ({ page }) => {
    await tohumla(page, [okunanK({ oturumlar: [{ b: Date.parse('2026-01-05T10:00:00'),
      s: 1800000, sa: 10, sb: 30 }] })]);
    await page.goto('/');
    await expect(page.locator('#asBugun')).toHaveCount(0);
  });

  test('tekrar sayısı okunurken depoya YAZILMAZ (planlama yan etkisi yok)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Alıntılı', notlar: [bekleyenAlinti(1)] })]);
    await page.goto('/');
    await expect(page.locator('#asBugun')).toContainText('1 alıntı');
    // Ana Sayfa çizimi planlamaYap/ciz çağırmadığı için not damgası basılmamalı.
    // KUSUR DÜZELTMESİ (v40'ta bulundu): beklenen değer tohumla AYNI yerel-saat
    // hesabından gelmeli — eski toISOString (UTC) kıyası gece 00-03 (UTC+3)
    // penceresinde bir gün kayıp vakayı kırıyordu.
    const damga = await page.evaluate(() => veri.kitaplar[0].notlar[0].tekrarSonraki);
    expect(damga).toBe(bugunISO(-1));
  });

  test('sıradaki: öneri motorundan kitap + neden cümlesi, zar düğmesi çalışır', async ({ page }) => {
    await tohumla(page, [
      bitmisK({ ad: 'Sevilen 1', yazar: 'Aynı Yazar', puan: 9 }),
      bitmisK({ ad: 'Sevilen 2', yazar: 'Aynı Yazar', puan: 9 }),
      bitmisK({ ad: 'Sevilen 3', yazar: 'Aynı Yazar', puan: 8 }),
      sahteKitap({ ad: 'Aday Kitap', yazar: 'Aynı Yazar', durum: 'okunacak' }),
    ]);
    await page.goto('/');
    const blok = page.locator('#asSiradaki');
    await expect(blok).toContainText('Aday Kitap');
    await expect(blok.locator('.as-neden')).not.toHaveText('');   // gerçek-veri gerekçesi
    await expect(blok.locator('.as-satir')).toHaveCount(1);       // en fazla 2
    await blok.locator('[data-act="zar"]').click();
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
  });

  test('okunacak kitap yoksa: dürüst mesaj, zar düğmesi de yok', async ({ page }) => {
    await tohumla(page, [okunanK()]);
    await page.goto('/');
    await expect(page.locator('#asSiradaki')).toContainText('Okunacak listen boş');
    await expect(page.locator('#asSiradaki [data-act="zar"]')).toHaveCount(0);
  });

  test('yıl özeti hedefle birlikte doğru, dokununca İstatistik açılır', async ({ page }) => {
    await tohumla(page, { kitaplar: [bitmisK({ ad: 'A' }), bitmisK({ ad: 'B' }), okunanK()],
      hedef: { [YIL]: 10 } });
    await page.goto('/');
    await expect(page.locator('#asYil')).toContainText(String(YIL));
    await expect(page.locator('#asYil')).toContainText('/ 10');
    await expect(page.locator('#asYil')).toContainText('%20');
    await page.click('#asYil');
    await expect(page.locator('#panel-ist')).toHaveClass(/active/);
  });

  test('yıl sayısı İstatistik sekmesiyle AYNI motordan gelir (yeniden okuma dahil)', async ({ page }) => {
    /* Yeniden okunan kitap: şu an "okunuyor" ama arşivde bu yıl bitmiş bir
       okuması var. istKayit onu sayar; iki yüzey aynı sayıyı göstermeli. */
    await tohumla(page, { kitaplar: [
      bitmisK({ ad: 'Düz Bitmiş' }),
      okunanK({ ad: 'Yeniden Okunan', okumalar: [{ bas: '2026-01-01', bit: bugunISO(), puan: 7 }] }),
    ], hedef: { [YIL]: 10 } });
    await page.goto('/');
    await expect(page.locator('#asYil .as-sayi')).toContainText('2');
    await page.click('nav [data-act="sekme"][data-v="ist"]');
    await expect(page.locator('#istIcerik')).toContainText('2 / 10');
  });

  test('hedef yoksa uydurma yüzde yok, hedefe yönlendiren dürüst not var', async ({ page }) => {
    await tohumla(page, [bitmisK()]);
    await page.goto('/');
    await expect(page.locator('#asYil')).toContainText('Yıllık hedef koymadın');
    await expect(page.locator('#asYil .ilerleme')).toHaveCount(0);
  });
});

/* ===================================================================== */
test.describe('G30 — boş kütüphane', () => {

  test('boş kütüphanede anlamlı başlangıç, çökme yok, tek pirinç "Kitap ekle"', async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', e => hatalar.push(String(e)));
    await tohumla(page, []);
    await page.goto('/');
    await expect(page.locator('#panel-ana')).toContainText('Kütüphanen henüz boş');
    await expect(page.locator('#panel-ana')).toContainText('Goodreads');
    await expect(page.locator('#panel-ana .btn-brass:visible')).toHaveCount(1);
    await expect(page.locator('#panel-ana .btn-brass')).toHaveAttribute('data-act', 'yeni');
    // uydurma bölüm yok
    await expect(page.locator('#asOkunuyor')).toHaveCount(0);
    await expect(page.locator('#asYil')).toHaveCount(0);
    expect(hatalar, 'boş kütüphanede sayfa hatası').toEqual([]);
  });

  test('boş kütüphanede "Kitap ekle" formu açar, "Goodreads\'ten aktar" Ayarlar\'ı açar', async ({ page }) => {
    await tohumla(page, []);
    await page.goto('/');
    await page.click('#panel-ana [data-act="yeni"]');
    await expect(page.locator('#ortuForm')).toHaveClass(/acik/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#ortuForm')).not.toHaveClass(/acik/);
    await page.click('#panel-ana [data-act="ayar-ac"]');
    await expect(page.locator('#ortuAyar')).toHaveClass(/acik/);
    await expect(page.locator('#ortuAyar')).toContainText("Goodreads'ten aktar");
  });
});

/* ===================================================================== */
test.describe('G30 — Ayarlar penceresi', () => {

  test('⚙ her sekmeden erişilebilir ve eski Yedek işlevlerinin HEPSİ orada', async ({ page }) => {
    await tohumla(page, [bitmisK()]);
    await page.goto('/');
    for (const sekme of ['raf', 'alinti', 'ist', 'ana']) {
      await page.click(`nav [data-act="sekme"][data-v="${sekme}"]`);
      await expect(page.locator('header [data-act="ayar-ac"]')).toBeVisible();
    }
    await ayarlarAc(page);
    const p = page.locator('#ortuAyar');
    for (const act of ['disa-aktar', 'csv-aktar', 'md-alinti', 'md-hepsi',
      'gr-aktar', 'ice-aktar', 'kp-tum-sil', 'tumunu-sil', 'seri-ac']) {
      await expect(p.locator(`[data-act="${act}"]`), act + ' düğmesi').toBeVisible();
    }
    await expect(p.locator('#tmSecim .tm-dugme')).toHaveCount(3);   // tema
    await expect(p.locator('#senkronKart')).toBeVisible();          // senkron eklentisi
    await expect(p.locator('#katalogKart')).toBeVisible();          // seri tarama eklentisi
    await expect(p.locator('#kpDepoBilgi')).toBeVisible();          // kapak fotoğraf yönetimi
  });

  test('pencere sözleşmesi: ARIA dialog + Esc + odak geri döner', async ({ page }) => {
    await tohumla(page, [bitmisK()]);
    await page.goto('/');
    await ayarlarAc(page);
    const sheet = page.locator('#ortuAyar .sheet');
    await expect(sheet).toHaveAttribute('role', 'dialog');
    await expect(sheet).toHaveAttribute('aria-modal', 'true');
    await expect(sheet).toHaveAttribute('aria-labelledby', 'ortuAyarBaslik');
    // arka plan ekran okuyucudan ve odaktan çekilir
    await expect(page.locator('#panel-ana')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('nav')).toHaveAttribute('inert', '');
    await page.keyboard.press('Escape');
    await expect(page.locator('#ortuAyar')).not.toHaveClass(/acik/);
    await expect(page.locator('#panel-ana')).not.toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('header [data-act="ayar-ac"]')).toBeFocused();
  });

  test('tek pirinç = JSON indir (md/CSV/seri/senkron çerçeveli)', async ({ page }) => {
    await tohumla(page, [bitmisK()]);
    await page.goto('/');
    await ayarlarAc(page);
    await expect(page.locator('#senkronKart')).toBeVisible();
    await expect(page.locator('#katalogKart')).toBeVisible();
    await expect(page.locator('#ortuAyar .btn-brass:visible')).toHaveCount(1);
    await expect(page.locator('#ortuAyar .btn-brass:visible').first())
      .toHaveAttribute('data-act', 'disa-aktar');
  });

  test('yedek al gerçekten iner ve içerik geçerli JSON', async ({ page }) => {
    await tohumla(page, [bitmisK({ ad: 'Yedeklenen' })]);
    await page.goto('/');
    await ayarlarAc(page);
    const [indirme] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#ortuAyar [data-act="disa-aktar"]'),
    ]);
    const akis = await indirme.createReadStream();
    let govde = '';
    for await (const p of akis) govde += p;
    const j = JSON.parse(govde);
    expect(j.kitaplar.map(k => k.ad)).toContain('Yedeklenen');
  });

  test('gizli dosya girdileri pencerenin DIŞINDA: Goodreads ve geri yükleme tıklanabilir', async ({ page }) => {
    /* Regresyon kilidi: girdiler pencere içinde kalsaydı üstlerine ikinci bir
       pencere açıldığında inert kapsayıcıya düşer ve .click() sessizce
       yutulurdu. Girdilerin örtü ağacında OLMADIĞINI doğruluyoruz. */
    await tohumla(page, [bitmisK()]);
    await page.goto('/');
    await expect(page.locator('.ortu #grDosya')).toHaveCount(0);
    await expect(page.locator('.ortu #iceDosya')).toHaveCount(0);
    await ayarlarAc(page);
    for (const [act, id] of [['gr-aktar', '#grDosya'], ['ice-aktar', '#iceDosya']]) {
      const [secici] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.click(`#ortuAyar [data-act="${act}"]`),
      ]);
      expect(await secici.element().evaluate(e => e.id)).toBe(id.slice(1));
    }
  });

  test('tema düğmeleri Ayarlar penceresinden çalışır ve yenilemede korunur', async ({ page }) => {
    await tohumla(page, [bitmisK()]);
    await page.goto('/');
    await ayarlarAc(page);
    await page.click('#ortuAyar [data-act="tm-tema"][data-v="karanlik"]');
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'karanlik');
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'karanlik');
  });

  test('seri tarama penceresi Ayarlar\'ın ÜSTÜNDE açılır, Esc yalnız onu kapatır', async ({ page }) => {
    await kameraTaklit(page);
    await tohumla(page, []);
    await page.goto('/');
    await ayarlarAc(page);
    await page.click('#ortuAyar [data-act="seri-ac"]');
    await expect(page.locator('#seriOrtu')).toHaveClass(/acik/);
    await expect(page.locator('#seriOrtu .sheet')).toHaveAttribute('role', 'dialog');
    await page.keyboard.press('Escape');
    await expect(page.locator('#seriOrtu')).not.toHaveClass(/acik/);
    await expect(page.locator('#ortuAyar')).toHaveClass(/acik/);   // alttaki açık kalır
    await expect(page.evaluate(() => window.__akisDurdu)).resolves.toBe(true);
  });

  test('kütüphaneyi boşalt Ayarlar\'dan çalışır, Ana Sayfa boş duruma döner', async ({ page }) => {
    onaylariKabulEt(page);
    await tohumla(page, [bitmisK(), okunanK()]);
    await page.goto('/');
    await ayarlarAc(page);
    await page.click('#ortuAyar [data-act="tumunu-sil"]');
    await expect(page.locator('#ortuAyar')).toHaveClass(/acik/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#panel-ana')).toContainText('Kütüphanen henüz boş');
  });

  test('eski ?sekme=yedek yer imi Ayarlar penceresini açar (sessizce kaybolmaz)', async ({ page }) => {
    await tohumla(page, [bitmisK()]);
    await page.goto('/index.html?sekme=yedek');
    await expect(page.locator('#ortuAyar')).toHaveClass(/acik/);
    await expect(page.locator('#panel-ana')).toHaveClass(/active/);
  });
});

/* ===================================================================== */
test.describe('G30 — Kütüphane sekmesi', () => {

  test('varsayılan görünüm "Bende olanlar": istek listesi dışarıda', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Bendeki 1' }), sahteKitap({ ad: 'Bendeki 2' }),
      sahteKitap({ ad: 'İstenen', sahiplik: 'istek' }),
    ]);
    await rafAc(page);
    await expect(page.locator('#vmSahiplikChips .vm-secili')).toHaveCount(1);
    await expect(page.locator('#vmSahiplikChips .vm-secili')).toHaveAttribute('data-v', 'sahip');
    await expect(page.locator('#liste .kart')).toHaveCount(2);
    await expect(page.locator('#liste')).not.toContainText('İstenen');
  });

  test('sahiplik alanı olmayan eski kayıtlar varsayılanda GÖRÜNÜR (kayıp yok)', async ({ page }) => {
    const eski = sahteKitap({ ad: 'Alan Yok Kitabı' });
    delete eski.sahiplik;
    await tohumla(page, [eski]);
    await rafAc(page);
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste')).toContainText('Alan Yok Kitabı');
  });

  test('çipler çalışmaya devam ediyor: sahiplik ve durum filtreleri', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Bendeki', durum: 'okunacak' }),
      okunanK({ ad: 'Okunan' }),
      sahteKitap({ ad: 'İstenen', sahiplik: 'istek' }),
    ]);
    await rafAc(page);
    await page.click('[data-act="vm-sahiplik"][data-v="hepsi"]');
    await expect(page.locator('#liste .kart')).toHaveCount(3);
    await page.click('[data-act="vm-sahiplik"][data-v="istek"]');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste')).toContainText('İstenen');
    await page.click('[data-act="vm-sahiplik"][data-v="sahip"]');
    await expect(page.locator('#liste .kart')).toHaveCount(2);
    await page.click('[data-act="filtre"][data-v="okunuyor"]');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste')).toContainText('Okunan');
  });

  test('sayaç dururken anlamlı: kitap · raf konumu · gizlenen istek', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'A', raf: 'Salon-1' }), sahteKitap({ ad: 'B', raf: 'Salon-1' }),
      sahteKitap({ ad: 'C', raf: 'Yatak Odası' }), sahteKitap({ ad: 'D', raf: '' }),
      sahteKitap({ ad: 'İstenen', sahiplik: 'istek' }),
    ]);
    await rafAc(page);
    await expect(page.locator('#sayac')).toHaveText('4 kitap · 2 raf konumu · 1 istek listesinde');
    // gizlenen yoksa üçüncü parça HİÇ yazılmaz (uydurma yok)
    await page.click('[data-act="vm-sahiplik"][data-v="hepsi"]');
    await expect(page.locator('#sayac')).toHaveText('5 kitap · 2 raf konumu');
  });

  test('raf konumu liste kartında görünür (fiziksel envanter hissi)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Rafta', raf: 'Salon-3' }),
      sahteKitap({ ad: 'Rafsız' })]);
    await rafAc(page);
    const rafli = page.locator('#liste .kart', { hasText: 'Rafta' });
    const rafsiz = page.locator('#liste .kart', { hasText: 'Rafsız' });
    // GÖÇ (görsel dil sprinti): emoji ikon dili kalktı — raf metin öneki taşır
    await expect(rafli).toContainText('Raf: Salon-3');
    await expect(page.locator('#liste')).not.toContainText('Raf: undefined');
    // rafı olmayan kitapta boş rozet çıkmaz
    await expect(rafsiz.locator('.etiket-mini')).toHaveCount(0);
  });
});

/* ===================================================================== */
test.describe('G30 — geçiş ve tutarlılık', () => {

  test('paylaşılan metin hâlâ gelen alıntı panelini açar (share_target)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Hedef Kitap' })]);
    await page.goto('/index.html?text=' + encodeURIComponent('Paylaşılan cümle.'));
    await expect(page.locator('#ortuGelen')).toHaveClass(/acik/);
    await expect(page.locator('#gelen-metin')).toHaveValue('Paylaşılan cümle.');
  });

  test('?sekme=alinti kısayolu hâlâ Alıntılar sekmesini açar', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'K',
      notlar: [{ id: 'n1', tip: 'alinti', metin: 'Cümle.', tarih: '2026-01-01', sayfa: 1 }] })]);
    await page.goto('/index.html?sekme=alinti');
    await expect(page.locator('#panel-alinti')).toHaveClass(/active/);
    await expect(page.locator('#alintiIcerik')).toContainText('Cümle.');
  });

  test('eklenti zeka.js + rapor.js İstatistik sekmesinde tetiklenir', async ({ page }) => {
    await tohumla(page, [bitmisK({ ad: 'A' }), bitmisK({ ad: 'B', puan: 6 })]);
    await page.goto('/');
    await expect(page.locator('#zkSarmal')).toHaveCount(0);   // Ana Sayfa'da yok
    await expect(page.locator('#rpKart')).toHaveCount(0);
    await page.click('nav [data-act="sekme"][data-v="ist"]');
    await expect(page.locator('#panel-ist #zkSarmal')).toBeVisible();
    await expect(page.locator('#panel-ist #rpKart')).toBeVisible();
  });

  test('eklenti fikir.js + fikirag.js + tekrar.js Alıntılar sekmesinde tetiklenir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Alıntılı', notlar: [
      Object.assign(bekleyenAlinti(1), { fikir: ['zaman'] }),
      Object.assign(bekleyenAlinti(2), { fikir: ['zaman'] }),
    ] })]);
    await page.goto('/');
    await expect(page.locator('#fikirBulut')).toHaveCount(0);   // Ana Sayfa'da yok
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    await expect(page.locator('#panel-alinti #tkKutu')).toContainText('bekliyor');
    await expect(page.locator('#panel-alinti #fikirBulut')).toBeVisible();
    await expect(page.locator('#panel-alinti #faPanel')).toHaveCount(1);
  });

  test('eklenti gorunum.js Kütüphane sekmesinde tetiklenir (ızgara/seçim düğmeleri)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'A', raf: 'Salon-1' })]);
    await rafAc(page);
    await expect(page.locator('#panel-raf #izgaraBtn')).toBeVisible();
    await expect(page.locator('#panel-raf #secimBtn')).toBeVisible();
    // ızgara ve raf gruplama Kütüphane'de kalır, Ana Sayfa'ya sızmaz
    await page.click('nav [data-act="sekme"][data-v="ana"]');
    await expect(page.locator('#panel-ana #izgaraBtn')).toHaveCount(0);
  });

  test('eklenti senkron.js + katalog.js + kapak.js Ayarlar penceresinde tetiklenir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'A' })]);
    await page.goto('/');
    await ayarlarAc(page);
    await expect(page.locator('#ortuAyar #senkronKart')).toBeVisible();
    await expect(page.locator('#ortuAyar #katalogKart')).toBeVisible();
    await expect(page.locator('#ortuAyar #kpDepoBilgi')).not.toHaveText('Hesaplanıyor…');
  });

  test('Ana Sayfa "Barkod tara" önce formu açar, sonra tarayıcıyı (okunan kitap görünmeyen forma yazılmaz)', async ({ page }) => {
    await kameraTaklit(page);
    await tohumla(page, [okunanK()]);   // dolu kütüphane: hızlı eylem şeridi ancak orada var
    await page.goto('/');
    await page.click('#asEylem [data-act="ana-barkod"]');
    await expect(page.locator('#ortuForm')).toHaveClass(/acik/);
    await expect(page.locator('#barkodOrtu')).toHaveClass(/acik/);
  });

  test('Ana Sayfa "Seri tarama" doğrudan çalışır (Ayarlar\'a girmeden)', async ({ page }) => {
    await kameraTaklit(page);
    await tohumla(page, [okunanK()]);
    await page.goto('/');
    await page.click('#asEylem [data-act="seri-ac"]');
    await expect(page.locator('#seriOrtu')).toHaveClass(/acik/);
  });

  test('Ana Sayfa veri değişince tazelenir (bayat kalmaz)', async ({ page }) => {
    await tohumla(page, [okunanK({ ad: 'İlk Kitap' })]);
    await page.goto('/');
    await expect(page.locator('#asOkunuyor')).toContainText('İlk Kitap');
    await page.click('nav [data-act="sekme"][data-v="raf"]');
    await page.click('#liste .kart');
    await page.click('#detayIcerik [data-act="bitir"]');
    await page.keyboard.press('Escape');   // detay bitirdikten sonra puan şeridiyle açık kalır
    await expect(page.locator('#ortuDetay')).not.toHaveClass(/acik/);
    await page.click('nav [data-act="sekme"][data-v="ana"]');
    await expect(page.locator('#asOkunuyor')).toContainText('Şu an okuduğun kitap yok');
    await expect(page.locator('#asYil .as-sayi')).toContainText('1');
  });
});

/* ===================================================================== */
test.describe('G30 — ölçüm', () => {

  test('500 kitapta Ana Sayfa açılışı ölçülür ve ağır hesap yapmaz', async ({ page }) => {
    const cok = [];
    for (let i = 0; i < 500; i++) {
      const d = ['okunacak', 'okunuyor', 'bitti'][i % 3];
      cok.push(sahteKitap({ ad: 'Kitap ' + i, yazar: 'Yazar ' + (i % 40),
        durum: d, sayfa: 200 + i, guncelSayfa: d === 'okunuyor' ? 50 : 0,
        puan: d === 'bitti' ? (i % 10) + 1 : null,
        bitisTarihi: d === 'bitti' ? bugunISO() : null,
        raf: 'Raf-' + (i % 12) }));
    }
    await tohumla(page, { kitaplar: cok, hedef: { [YIL]: 50 } });
    const t0 = Date.now();
    await page.goto('/');
    await expect(page.locator('#asYil')).toBeVisible();
    const acilisMs = Date.now() - t0;

    // Ana Sayfa'nın KENDİ çizim maliyeti (ağ/yükleme hariç)
    const cizimMs = await page.evaluate(() => {
      const t = performance.now();
      for (let i = 0; i < 10; i++) anaCiz();
      return (performance.now() - t) / 10;
    });
    console.log(`[ÖLÇÜM] 500 kitap · açılış ${acilisMs} ms · anaCiz ortalama ${cizimMs.toFixed(1)} ms`);

    await expect(page.locator('#asOkunuyor .as-satir')).toHaveCount(3);   // 167 okunan → 3
    expect(cizimMs, 'anaCiz tek çizim 150 ms altında kalmalı').toBeLessThan(150);
    expect(acilisMs, '500 kitapta açılış 5 sn altında kalmalı').toBeLessThan(5000);
  });
});
