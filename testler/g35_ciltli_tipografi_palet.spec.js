/* G35 — "Ciltli" tipografi (Cormorant Garamond + Lora, gömülü) + Palet A
   (Soluk Parşömen). YALNIZ token katmanı — düzen/işlev sözleşmeleri diğer
   gruplarda yaşıyor; burada:
   - @font-face yerel, iki aile + italik yüklü, Türkçe glifler TAM (fonts.check
     metin argümanıyla — eksik glif varsa false döner).
   - --serif/--sans yeni ailelere işaret eder (adlar değişmedi).
   - Palet değerleri yeni; TÜM metin/zemin çiftleri 7 ekranda ÖLÇÜLMÜŞ stil
     üzerinden AA (4.5). Rakamlar tabular. */
'use strict';
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc, rafaGec } = require('./yardim');

async function kontrastOrani(page, metinSec, zeminSec) {
  return page.evaluate(([ms, zs]) => {
    function coz(s) {
      const m = String(s).match(/rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:[,/ ]+([\d.]+))?\)/);
      return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
    }
    function zeminBul(el) {
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
async function ciftleriDogrula(page, ciftler, ekran) {
  for (const [m, z, ad] of ciftler) {
    const o = await kontrastOrani(page, m, z);
    expect(o, `${ekran} · ${ad} ölçülemedi (${m})`).not.toBeNull();
    expect(o, `${ekran} · ${ad}: ${o && o.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  }
}
function dolulKitap(ek) {
  return sahteKitap(Object.assign({
    ad: 'Işık Şövalyesi Ğüneş', yazar: 'İğneli Şairoğlu Çölüm', durum: 'bitti', puan: 8,
    sayfa: 320, guncelSayfa: 320, bitisTarihi: bugunISO(), etiketler: ['şiir'],
    notlar: [{ id: 'g35n1', tip: 'alinti', metin: 'Iğdır\'ın şoförü öğünç.', tarih: bugunISO(), fikir: [] }]
  }, ek || {}));
}

test.describe('G35 Ciltli tipografi + Palet A', () => {

  test('fontlar: iki aile + italik yüklü, dosyalar yerel, Türkçe glifler TAM', async ({ page }) => {
    await tohumla(page, [dolulKitap()]);
    await page.goto('/');
    const r = await page.evaluate(async () => {
      await document.fonts.ready;
      const TR = 'ığşİĞŞçöüÇÖÜ';
      // italik yüz sayfada o an kullanılmıyor olabilir — check() yalnız YÜKLÜ
      // yüz için true döner; load() dosyayı çeker (yerel, sw önbellekli)
      await document.fonts.load('italic 16px Lora', TR);
      await document.fonts.load('600 16px "Cormorant Garamond"', TR);
      await document.fonts.load('16px Lora', TR);
      await document.fonts.load('16px "Cormorant Garamond"', TR);
      const span = document.createElement('span');
      span.style.cssText = 'font-family:Lora;position:absolute;visibility:hidden';
      span.textContent = TR;
      document.body.appendChild(span);
      const en = span.getBoundingClientRect().width;
      span.remove();
      // salt-LATIN kapsam da ayrı sınanır (mutasyon sertleştirmesi: latin yüz
      // silinirse latin-ext TR gliflerini hâlâ karşılar — bu iddialar yakalar)
      await document.fonts.load('16px "Cormorant Garamond"', 'Abc');
      await document.fonts.load('16px Lora', 'Abc');
      return {
        loraLatin: document.fonts.check('16px Lora', 'Abc'),
        cormorantLatin: document.fonts.check('16px "Cormorant Garamond"', 'Abc'),
        lora: document.fonts.check('16px Lora'),
        loraTR: document.fonts.check('16px Lora', TR),
        loraItalik: document.fonts.check('italic 16px Lora', TR),
        cormorant: document.fonts.check('16px "Cormorant Garamond"'),
        cormorantTR: document.fonts.check('16px "Cormorant Garamond"', TR),
        cormorant600: document.fonts.check('600 16px "Cormorant Garamond"'),
        trGenislik: en
      };
    });
    expect(r.loraLatin, 'Lora latin kapsamı').toBe(true);
    expect(r.cormorantLatin, 'Cormorant latin kapsamı').toBe(true);
    expect(r.lora).toBe(true);
    expect(r.loraTR, 'Lora Türkçe glifler').toBe(true);
    expect(r.loraItalik, 'Lora italik Türkçe').toBe(true);
    expect(r.cormorant).toBe(true);
    expect(r.cormorantTR, 'Cormorant Türkçe glifler').toBe(true);
    expect(r.cormorant600, 'Cormorant 600 (değişken dosya)').toBe(true);
    expect(r.trGenislik).toBeGreaterThan(0);
  });

  test('--serif ve --sans yeni ailelere işaret eder; başlık Cormorant, gövde Lora', async ({ page }) => {
    await tohumla(page, [dolulKitap()]);
    await rafAc(page);
    const r = await page.evaluate(() => ({
      serifVar: getComputedStyle(document.documentElement).getPropertyValue('--serif'),
      sansVar: getComputedStyle(document.documentElement).getPropertyValue('--sans'),
      govde: getComputedStyle(document.body).fontFamily,
      baslik: getComputedStyle(document.querySelector('.app-title')).fontFamily,
      alintiKutu: null
    }));
    expect(r.serifVar).toContain('Cormorant Garamond');
    expect(r.sansVar).toContain('Lora');
    expect(r.govde.replace(/["']/g, '')).toMatch(/^Lora/);
    expect(r.baslik.replace(/["']/g, '')).toMatch(/^Cormorant Garamond/);
    // alıntı metni gövde İTALİK (Lora italic — sahte eğik değil, gerçek yüz var)
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    const ga = await page.evaluate(() => {
      const c = getComputedStyle(document.querySelector('.ga-metin'));
      return { aile: c.fontFamily, stil: c.fontStyle };
    });
    expect(ga.aile.replace(/["']/g, '')).toMatch(/^Lora/);
    expect(ga.stil).toBe('italic');
  });

  test('palet değerleri yeni: bg/surface/paper/muted/brass + rakamlar tabular', async ({ page }) => {
    await tohumla(page, [dolulKitap()]);
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="ist"]');
    const r = await page.evaluate(() => {
      const kok = getComputedStyle(document.documentElement);
      return {
        bg: kok.getPropertyValue('--bg').trim(),
        surface: kok.getPropertyValue('--surface').trim(),
        paper: kok.getPropertyValue('--paper').trim(),
        muted: kok.getPropertyValue('--muted').trim(),
        brass: kok.getPropertyValue('--brass').trim(),
        govdeZemin: getComputedStyle(document.body).backgroundColor,
        tabular: getComputedStyle(document.querySelector('.ist-sayi')).fontVariantNumeric
      };
    });
    expect(r.bg).toBe('#F2EFE7');
    expect(r.surface).toBe('#FAF8F3');
    expect(r.paper).toBe('#221F19');
    expect(r.muted).toBe('#6B6357');
    expect(r.brass).toBe('#8A6524');
    expect(r.govdeZemin).toBe('rgb(242, 239, 231)');
    expect(r.tabular).toBe('tabular-nums');
  });

  test('kontrast AA — ana sayfa + kütüphane (liste ve izgara)', async ({ page }) => {
    await tohumla(page, [dolulKitap(), sahteKitap({ ad: 'Okunacak Ç', durum: 'okunacak' })]);
    await page.goto('/');
    await ciftleriDogrula(page, [
      // v47: Ana Sayfa Ciltli — kutu/sırt rolleri emekli, yeni metin rolleri ölçülür
      ['#anaIcerik .as-selam', 'body', 'karşılama başlığı'],
      ['#anaIcerik .as-ozet', 'body', 'özet satırı'],
      ['#anaIcerik .kicker', 'body', 'ana sayfa kicker'],
      ['#asEylem .btn-cerceve', null, 'çerçeve düğme']
    ], 'ana');
    await rafaGec(page);   // tohumla varsayılanı: liste
    await ciftleriDogrula(page, [
      ['#liste .kart-baslik', '#liste .kart', 'kart başlığı'],
      ['#liste .kart-yazar', '#liste .kart', 'kart yazarı'],
      ['#liste .etiket-mini', '#liste .kart', 'sessiz etiket'],
      ['#liste .rozet.r-bitti', null, 'durum rozeti (tint %7)'],
      ['#liste .puan-mini', null, 'puan hapı (tint %7)'],
      ['#durumChips .chip.active', null, 'aktif çip'],
      ['#durumChips .chip:not(.active)', null, 'pasif çip'],
      ['.count-label', 'body', 'sayaç'],
      // v42: renkli sırt emekli — yeni Ciltli üst bloğu metin rolleri ölçülür
      ['#ktUst .kt-cilt', 'body', 'cilt sayısı etiketi'],
      ['#ktUst .kicker', 'body', 'kicker (Sırada)'],
      ['#ktUst .kt-adet', 'body', 'şerit adedi']
    ], 'kütüphane-liste');
    await page.click('#duzenIzgara');
    await ciftleriDogrula(page, [
      ['#liste .iz-yedek', null, 'ızgara levha yer tutucusu (tam ad)'],
      ['#liste .kart-baslik', 'body', 'ızgara başlık'],
      ['#liste .iz-durum', 'body', 'ızgara durum satırı (v42)']
    ], 'kütüphane-ızgara');
  });

  test('kontrast AA — alıntılar + istatistik', async ({ page }) => {
    await tohumla(page, [dolulKitap()]);
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    await ciftleriDogrula(page, [
      ['.ga-metin', '.gunun-alintisi', 'günün alıntısı'],
      ['.ga-kaynak', '.gunun-alintisi', 'alıntı kaynağı'],
      ['.ga-etiket', '.gunun-alintisi', 'alıntı etiketi'],
      ['#panel-alinti .not-metin', '#panel-alinti .not-kart', 'not metni'],
      ['#panel-alinti .alinti-git', '#panel-alinti .not-kart', 'kitaba git']
    ], 'alıntılar');
    await page.click('nav [data-act="sekme"][data-v="ist"]');
    await ciftleriDogrula(page, [
      ['#istIcerik .is-hero-sayi', '#istIcerik .is-hero', 'hero sayısı'],
      ['#istIcerik .is-hucre-ad', '#istIcerik .is-hero', 'hero etiketi'],
      ['#istIcerik .ist-sayi', '#istIcerik .is-bolum', 'istatistik sayısı'],
      ['#istIcerik .ist-etiket', '#istIcerik .is-bolum', 'istatistik etiketi'],
      ['#istIcerik .is-payda', '#istIcerik .is-bolum', 'payda'],
      ['#istIcerik .kicker', '#istIcerik .is-bolum', 'bölüm kicker'],
      ['#istIcerik .bar-ad', '#istIcerik .is-bolum', 'çubuk adı'],
      ['#istIcerik .mini-not', '#istIcerik .is-bolum', 'mini not'],
      ['#istIcerik .ist-bolum-baslik', '#istIcerik .is-bolum', 'bölüm başlığı']
    ], 'istatistik');
  });

  test('kontrast AA — ayarlar penceresi + detay + form', async ({ page }) => {
    await tohumla(page, [dolulKitap()]);
    await rafAc(page);
    await page.click('[data-act="ayar-ac"]');
    await ciftleriDogrula(page, [
      ['#ortuAyar .yedek-kart h3', '#ortuAyar .yedek-kart', 'kart başlığı'],
      ['#ortuAyar .yedek-kart p', '#ortuAyar .yedek-kart', 'kart açıklaması'],
      ['#ortuAyar .btn-brass', null, 'pirinç düğme'],
      ['#ortuAyar .tm-dugme:not(.tm-secili)', null, 'tema düğmesi']
    ], 'ayarlar');
    await page.click('[data-act="ayar-kapat"]');
    await page.click('#liste .kart');
    await ciftleriDogrula(page, [
      ['#detayIcerik .sheet-baslik', '#detayIcerik', 'detay başlığı'],
      ['#detayIcerik .detay-yazar', '#detayIcerik', 'detay yazarı'],
      ['#detayIcerik .d-katla summary', '#detayIcerik .d-katla', 'katlanır başlık'],
      ['#detayIcerik .puan-btn:not(.secili)', null, 'puan düğmesi'],
      ['#detayIcerik .mini-not', '#detayIcerik', 'mini not']
    ], 'detay');
    await page.click('[data-act="detay-kapat"]');
    await page.click('.fab[data-act="yeni"]');
    await ciftleriDogrula(page, [
      ['#ortuForm label', '#ortuForm .sheet', 'form etiketi'],
      ['#ortuForm .durum-btn:not(.secili)', null, 'durum düğmesi'],
      ['#ortuForm [data-act="form-kaydet"]', null, 'kaydet düğmesi'],
      ['#fAyrintilar summary', '#fAyrintilar', 'ayrıntı özeti']
    ], 'form');
  });
});
