/* G31 — Görsel dil sprinti: tipografi, ikon dili, derinlik, çip/rozet, boş durumlar.
   Sözleşme:
   - İtalik yalnız bilinçli alıntı yüzeylerinde (.ga-metin, .not-kart.alinti);
     gövde, nav, çip, düğme, placeholder HER ZAMAN normal — cihazın font teması
     eğik olsa bile (körük testi: :where ile sıfır-özgüllük cihaz taklidi).
   - İkon dili tek: nav + header + boş durumlar inline SVG (.ikon), piktografik
     emoji yok. ✕ ▾ ★ → ✎ › ince tipografik glifleri bilinçli metin.
   - Yükselti dili tek: kart rolü = surface + 1px kenarlık + --yukselti-1.
   - Kapaksız kitap listede ve detayda baş harfli sırt yer tutucusu taşır.
   - Sıfır aylar .bar-sifir ile sessizleşir; "fikir etiketi yok" mesajı TEK.
   - Kontrast: kritik metin/zemin çiftleri iki temada da AA (4.5) üstü. */
'use strict';
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc, rafaGec } = require('./yardim');

/* Piktografik emoji + eski ikon glifleri (⚙☀☾⚠✓☰▦▤▶⏸↩❝🔁). ★ ✕ ▾ → ✎ › serbest. */
const YASAK_IKON = /[\u{1F000}-\u{1FAFF}]|\u{FE0F}|[⚙☀☾⚠✓☰▦▤▶⏸↩❝]/u;

function kitapAlinti(ek) {
  return sahteKitap(Object.assign({
    ad: 'Alıntılı Kitap', durum: 'bitti', puan: 8, sayfa: 200,
    bitisTarihi: bugunISO(),
    notlar: [{ id: 'n1', tip: 'alinti', metin: 'Denemek, yenilmenin yarısıdır.', tarih: bugunISO(), fikir: [] }]
  }, ek || {}));
}

/* WCAG kontrast: hesaplanmış rgb()/rgba() değerlerinden oran */
async function kontrastOrani(page, metinSec, zeminSec) {
  return page.evaluate(([ms, zs]) => {
    function coz(s) {
      const m = String(s).match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)/);
      return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
    }
    function zeminBul(el) { // ilk opak olmayan atadan zemin topla, alfa karışımı uygula
      let renk = { r: 255, g: 255, b: 255 };
      const zincir = [];
      for (let n = el; n; n = n.parentElement) {
        const c = coz(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0) zincir.push(c);
        if (c && c.a >= 1) break;
      }
      for (let i = zincir.length - 1; i >= 0; i--) {
        const c = zincir[i];
        renk = { r: c.r * c.a + renk.r * (1 - c.a), g: c.g * c.a + renk.g * (1 - c.a), b: c.b * c.a + renk.b * (1 - c.a) };
      }
      return renk;
    }
    function lum(c) {
      const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    }
    const metinEl = document.querySelector(ms);
    const zeminEl = zs ? document.querySelector(zs) : metinEl;
    if (!metinEl || !zeminEl) return null;
    const m = coz(getComputedStyle(metinEl).color);
    const z = zeminBul(zeminEl);
    const [l1, l2] = [lum(m), lum(z)].sort((a, b) => b - a);
    return (l1 + 0.05) / (l2 + 0.05);
  }, [metinSec, zeminSec]);
}

test.describe('G31 görsel dil', () => {

  /* ---------- M1 tipografi ---------- */
  test('gövde, nav, çip, düğme, girdi ve placeholder font-style normal; alıntı metni italik', async ({ page }) => {
    await tohumla(page, [kitapAlinti()]);
    await rafAc(page);
    const stil = async (sec) => page.evaluate(s => getComputedStyle(document.querySelector(s)).fontStyle, sec);
    expect(await stil('body')).toBe('normal');
    expect(await stil('nav .nav-btn')).toBe('normal');
    expect(await stil('#liste .kart-yazar')).toBe('normal');
    expect(await stil('#durumChips .chip')).toBe('normal');
    expect(await stil('#arama')).toBe('normal');
    expect(await page.evaluate(() =>
      getComputedStyle(document.querySelector('#arama'), '::placeholder').fontStyle)).toBe('normal');
    // bilinçli italik: günün alıntısı + alıntı not kartı
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    expect(await stil('.ga-metin')).toBe('italic');
    expect(await stil('#panel-alinti .not-kart.alinti .not-metin')).toBe('italic');
  });

  test('cihaz font teması eğik olsa bile arayüz normal kalır (körük: :where taklidi)', async ({ page }) => {
    await tohumla(page, [kitapAlinti()]);
    await rafAc(page);
    /* Cihaz-italik taklidi: html'e kalıtsal italik + form öğelerine SIFIR
       özgüllüklü italik. Uygulamanın açık font-style:normal kuralları bunları
       yenmeli; kural silinirse (mutasyon) bu vaka kırmızıya döner. */
    await page.addStyleTag({ content:
      'html{font-style:italic} :where(button,input,select,textarea){font-style:italic}' });
    const stil = async (sec) => page.evaluate(s => getComputedStyle(document.querySelector(s)).fontStyle, sec);
    expect(await stil('nav .nav-btn')).toBe('normal');
    expect(await stil('#liste .kart-yazar')).toBe('normal');
    expect(await stil('#durumChips .chip')).toBe('normal');
    expect(await stil('#arama')).toBe('normal');
    expect(await stil('.fab')).toBe('normal');
    // bilinçli italik taklit altında da yaşar
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    expect(await stil('.ga-metin')).toBe('italic');
  });

  test('--sans yığını cihaz temasına düşmez: system-ui / -apple-system yok', async ({ page }) => {
    await tohumla(page, []);
    await page.goto('/');
    const aile = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(aile).not.toMatch(/system-ui|-apple-system/);
    // GÖÇ (v41): gövde artık gömülü Lora (Ciltli tipografi)
    expect(aile).toMatch(/Lora/);
  });

  /* ---------- M2 ikon dili ---------- */
  test('nav: 5 sekmenin hepsinde SVG ikon var, emoji/eski glif yok, metinler duruyor', async ({ page }) => {
    await tohumla(page, []);
    await page.goto('/');
    await expect(page.locator('nav .nav-btn svg.ikon')).toHaveCount(5);
    const navMetin = await page.locator('nav').innerText();
    expect(YASAK_IKON.test(navMetin)).toBe(false);
    await expect(page.locator('nav .nav-btn')).toHaveText(
      [/Ana Sayfa/i, /Kütüphane/i, /Keşfet/i, /Alıntılar/i, /İstatistik/i]);
    // SVG'ler dekoratif: hepsi aria-hidden
    expect(await page.locator('nav svg.ikon:not([aria-hidden="true"])').count()).toBe(0);
  });

  test('header: ayar/zar/öneri düğmeleri SVG taşır, aria-label korunur', async ({ page }) => {
    await tohumla(page, [sahteKitap()]);
    await rafAc(page);
    for (const sec of ['.ayar-btn', '.search-row .zar-btn', '.on-ac-btn']) {
      await expect(page.locator(sec + ' svg.ikon')).toHaveCount(1);
    }
    await expect(page.locator('.ayar-btn')).toHaveAttribute('aria-label', 'Ayarlar');
    await expect(page.locator('.search-row .zar-btn')).toHaveAttribute('aria-label', /rastgele/i);
    await expect(page.locator('.on-ac-btn')).toHaveAttribute('aria-label', /Ne okusam/i);
  });

  test('görünen yüzeylerde piktografik emoji kalmadı (kod noktası taraması)', async ({ page }) => {
    await tohumla(page, [kitapAlinti(), sahteKitap({ durum: 'okunuyor', sayfa: 100, guncelSayfa: 40 })]);
    await page.goto('/');
    const tara = async (etiket) => {
      const metin = await page.evaluate(() => document.body.innerText);
      const es = metin.match(YASAK_IKON);
      expect(es, etiket + ' yüzeyinde yasak glif: ' + (es && es[0])).toBeNull();
    };
    await tara('ana sayfa');
    await rafaGec(page); await tara('kütüphane');
    await page.click('nav [data-act="sekme"][data-v="kesfet"]'); await tara('keşfet');
    await page.click('nav [data-act="sekme"][data-v="alinti"]'); await tara('alıntılar');
    await page.click('nav [data-act="sekme"][data-v="ist"]'); await tara('istatistik');
    await page.click('[data-act="ayar-ac"]'); await tara('ayarlar penceresi');
  });

  /* ---------- M3 derinlik + kapaksız yer tutucu ---------- */
  /* v42 KARAR: Kütüphane satırları KART değil ÇİZGİ dilinde — kutu/gölge/yarıçap
     yok, satırlar 1px ayraçla ayrılır. Kart dili henüz Ciltli'ye geçmeyen
     ekranlarda (Ana Sayfa, İstatistik) kendi içinde tutarlı kalır. */
  test('Kütüphane satırı çizgi dilinde; kart kalan yüzeyler kendi içinde tutarlı', async ({ page }) => {
    await tohumla(page, [kitapAlinti()]);
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="ist"]');
    await rafaGec(page);
    const oku = (sec) => page.evaluate(s => {
      const el = document.querySelector(s);
      const c = getComputedStyle(el);
      return { golge: c.boxShadow, r: c.borderRadius, altCizgi: c.borderBottomWidth,
        zemin: c.backgroundColor };
    }, sec);
    const kart = await oku('#liste .kart');
    expect(kart.golge, 'satırda gölge yok').toBe('none');
    expect(kart.r, 'satırda yarıçap yok').toBe('0px');
    expect(kart.altCizgi, 'satır 1px ayraçla biter').toBe('1px');
    expect(kart.zemin, 'satır dolgusuz').toBe('rgba(0, 0, 0, 0)');
    // kart dilinde kalan iki yüzey birbiriyle aynı gölge + yarıçapı taşır
    const asBlok = await oku('#anaIcerik .as-blok');
    const istKart = await oku('#istIcerik .ist-kart');
    expect(asBlok.golge).not.toBe('none');
    expect(istKart.golge).toBe(asBlok.golge);
    expect(istKart.r).toBe(asBlok.r);
  });

  /* v42 KARAR: renkli sırt/baş-harf yer tutucusu Kütüphane'de emekli — kapak
     levhası (plate) içinde kesikli çerçeve "kapak yok" der; ad satırın kendisinde. */
  test('kapaksız kitap listede kesikli levha yer tutucusu alır (v42 Ciltli)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Suç ve Ceza', kapak: null })]);
    await rafAc(page);
    const levha = page.locator('#liste .kart .plate.p-bos');
    await expect(levha).toHaveCount(1);
    const olcum = await levha.evaluate(el => {
      const c = getComputedStyle(el);
      const sonra = getComputedStyle(el, '::after');
      return { en: el.getBoundingClientRect().width, paspartu: c.borderTopWidth,
        kesikli: sonra.borderTopStyle, filtre: c.filter };
    });
    expect(olcum.en).toBeGreaterThan(30);              // görünür levha, kör şerit değil
    expect(olcum.paspartu).toBe('4px');                // mini levha paspartusu
    expect(olcum.kesikli).toBe('dashed');              // kesikli "Kapak" yer tutucu deseni
    expect(olcum.filtre).toContain('sepia');           // levha sepya filtresi
  });

  test('kapaksız kitap detayda da aynı yer tutucu dilini taşır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Suç ve Ceza', kapak: null })]);
    await rafAc(page);
    await page.click('#liste .kart');
    const yok = page.locator('#detayIcerik .d-kapak-yok');
    await expect(yok).toHaveText('SVC');
    expect(await yok.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  });

  /* ---------- M4 çip satırları + rozet hiyerarşisi ---------- */
  test('çip satırı taşarken kaydırma işareti (kayar-son) belirir, sonda kaybolur', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 700 });
    await tohumla(page, [sahteKitap()]);
    await rafAc(page);
    const chips = page.locator('#durumChips');
    await expect(chips).toHaveClass(/kayar-son/);       // sağda gizli içerik var
    await expect(chips).not.toHaveClass(/kayar-bas/);   // başta soldurulacak şey yok
    await chips.evaluate(el => { el.scrollLeft = el.scrollWidth; });
    await expect(chips).not.toHaveClass(/kayar-son/);   // sona gelindi
    await expect(chips).toHaveClass(/kayar-bas/);
  });

  test('rozet hiyerarşisi: durum tint hap, puan ★ hapı (payda yok), etiket sessiz metin', async ({ page }) => {
    await tohumla(page, [kitapAlinti({ etiketler: ['felsefe'] })]);
    await rafAc(page);
    const rozet = page.locator('#liste .rozet.r-bitti');
    expect(await rozet.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    const puan = page.locator('#liste .puan-mini');
    await expect(puan).toHaveText('★ 8');
    await expect(puan).not.toContainText('/10');        // payda sabit — hap gösterimi
    expect(await puan.evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    expect(await page.locator('#liste .etiket-mini').last()
      .evaluate(el => getComputedStyle(el).backgroundColor)).toBe('rgba(0, 0, 0, 0)');
  });

  /* ---------- M5 istatistik + boş durum ---------- */
  test('sıfır aylar sessizleşir: bar-sifir sınıfı, ray çizilmez; dolu ay ray taşır', async ({ page }) => {
    await tohumla(page, [kitapAlinti()]);   // yalnız bu ay bitmiş 200 sayfa
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="ist"]');
    const kartlar = page.locator('#istIcerik .ist-kart', { hasText: 'Aylık sayfa' });
    await expect(kartlar.locator('.bar-satir')).toHaveCount(12);
    await expect(kartlar.locator('.bar-satir.bar-sifir')).toHaveCount(11);
    expect(await kartlar.locator('.bar-satir.bar-sifir .bar-govde > div').count()).toBe(0);
    await expect(kartlar.locator('.bar-satir:not(.bar-sifir) .bar-govde > div')).toHaveCount(1);
  });

  test('"fikir etiketi yok" boş mesajı Alıntılar sekmesinde TEK', async ({ page }) => {
    await tohumla(page, [kitapAlinti()]);   // alıntı var, fikir etiketi yok
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    await expect(page.locator('#panel-alinti')).toContainText('Henüz fikir etiketi yok');
    const metin = await page.evaluate(() => document.body.innerText);
    expect(metin.split('Henüz fikir etiketi yok').length - 1).toBe(1);
    await expect(page.locator('#faBos')).toHaveCount(0); // fikirag boşken kart çizmez
  });

  /* ---------- Kontrast (AA 4.5) — iki temada ---------- */
  for (const tema of ['acik', 'karanlik']) {
    test('kontrast eşikleri korunur (' + tema + ' tema)', async ({ page }) => {
      await tohumla(page, [kitapAlinti({ etiketler: ['felsefe'] })], { kk_tema_v1: tema });
      await rafAc(page);
      const ciftler = [
        ['#liste .kart-baslik', '#liste .kart', 'kart başlığı'],
        ['#liste .kart-yazar', '#liste .kart', 'kart yazarı'],
        ['#liste .etiket-mini', '#liste .kart', 'sessiz etiket'],
        ['#durumChips .chip.active', null, 'aktif çip'],
        ['#durumChips .chip:not(.active)', null, 'pasif çip'],
        ['.count-label', 'body', 'sayaç etiketi'],
        ['#liste .rozet.r-bitti', null, 'durum rozeti (tint)'],
        ['#liste .puan-mini', null, 'puan hapı (tint)']
      ];
      for (const [m, z, ad] of ciftler) {
        const o = await kontrastOrani(page, m, z);
        expect(o, ad + ' çifti ölçülemedi').not.toBeNull();
        expect(o, ad + ' kontrastı: ' + (o && o.toFixed(2))).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
