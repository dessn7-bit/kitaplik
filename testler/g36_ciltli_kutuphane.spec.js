'use strict';
/* G36 — Ciltli Kütüphane (v42): tasarım dili + korunan işlevler.
   - DOLGU YOK: görünür hiçbir düğme doygun (pirinç vb.) dolu zemin taşımaz;
     birincil düğme = altın kontur + altın metin. (Mutasyon M1 bunu öldürür.)
   - Kapak levhası (.plate): 6px paspartu + 1px kontur + sepya filtresi;
     kapaksız kitapta kesikli çerçeve. (Mutasyon M2 konturu öldürür.)
   - kicker altın/büyük harf/harf aralıklı; hedef şeridi koşullu; DEVAM EDEN
     OKUMA (sayfa işaretle + kitaba git); SIRADA yatay şeridi; üç düzen
     anahtarı (izgara/liste/yoğun) kalıcı tercih; sahiplik/raf gruplama/çoklu
     seçim/FAB işlevleri KORUNUR; 5 sekme 412px'te sığar; yeni metin rolleri AA. */
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc, rafYenile,
  rafaGec } = require('./yardim');

/* ---- yardımcılar ---- */

// computed backgroundColor → {r,g,b,a} (rgb/rgba/color(srgb …/a) serilemeleri)
const RENK_COZ = `(z => {
  if(!z || z === 'transparent') return { r:0,g:0,b:0,a:0 };
  let m = z.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
  if(m) return { r:+m[1], g:+m[2], b:+m[3], a:m[4] === undefined ? 1 : +m[4] };
  m = z.match(/color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)/);
  if(m) return { r:255*+m[1], g:255*+m[2], b:255*+m[3], a:m[4] === undefined ? 1 : +m[4] };
  return { r:0,g:0,b:0,a:1 };
})`;

/* Kapsamdaki GÖRÜNÜR düğmelerden dolu (alfa ≥ .5) ve NÖTR OLMAYAN zeminli
   olanları döndürür. Nötr = sayfa/kart zeminleri (bg/surface/surface2) —
   FAB'ın zemin diski ve nav gibi yüzeyler dolu sayılmaz; pirinç/mavi/kırmızı
   gibi doygun bir dolgu ise yakalanır (M1 mutasyonunun hedefi). */
async function doluDugmeler(page, kapsam) {
  return await page.evaluate(({ kapsam, renkCozSrc }) => {
    const renkCoz = eval(renkCozSrc);
    const kok = getComputedStyle(document.documentElement);
    const notrler = ['--bg', '--surface', '--surface2'].map(v => {
      const p = document.createElement('div');
      p.style.color = kok.getPropertyValue(v).trim();
      document.body.appendChild(p);
      const c = renkCoz(getComputedStyle(p).color);
      p.remove();
      return c;
    });
    const yakin = (a, b) => Math.abs(a.r-b.r) + Math.abs(a.g-b.g) + Math.abs(a.b-b.b) < 12;
    const doygun = c => { // gri/bej değil, belirgin renkli dolgu
      const maks = Math.max(c.r,c.g,c.b), min = Math.min(c.r,c.g,c.b);
      return (maks - min) > 40 || maks < 120; // renkli VEYA koyu dolgu
    };
    return [...document.querySelectorAll(kapsam + ' button')]
      .filter(b => b.offsetParent !== null)
      .map(b => ({ sinif: b.className, act: b.dataset.act || '',
        zemin: getComputedStyle(b).backgroundColor }))
      .filter(o => {
        const c = renkCoz(o.zemin);
        if(c.a < 0.5) return false;                    // dolgusuz / tint
        if(notrler.some(n => yakin(c, n))) return false; // nötr zemin diski (FAB)
        return doygun(c);
      });
  }, { kapsam, renkCozSrc: RENK_COZ });
}

// g35 ile aynı yaklaşım: metin rengi / etkin zemin (ata zinciri alfa-karışımı)
async function kontrastOrani(page, metinSec, zeminSec) {
  return await page.evaluate(({ metinSec, zeminSec, renkCozSrc }) => {
    const renkCoz = eval(renkCozSrc);
    const el = document.querySelector(metinSec);
    if(!el) return null;
    const metin = renkCoz(getComputedStyle(el).color);
    let zemin = { r:255,g:255,b:255 };
    let kat = [];
    let p = zeminSec ? document.querySelector(zeminSec) : el;
    while(p && p !== document.documentElement){
      const c = renkCoz(getComputedStyle(p).backgroundColor);
      if(c.a > 0){ kat.push(c); if(c.a >= 1) break; }
      p = p.parentElement;
    }
    for(let i = kat.length - 1; i >= 0; i--){
      const c = kat[i];
      zemin = { r: c.r*c.a + zemin.r*(1-c.a), g: c.g*c.a + zemin.g*(1-c.a),
        b: c.b*c.a + zemin.b*(1-c.a) };
    }
    const L = c => {
      const f = v => { v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
      return .2126*f(c.r) + .7152*f(c.g) + .0722*f(c.b);
    };
    const l1 = L(metin), l2 = L(zemin);
    return (Math.max(l1,l2) + .05) / (Math.min(l1,l2) + .05);
  }, { metinSec, zeminSec, renkCozSrc: RENK_COZ });
}

function okunanK(ek) {
  return sahteKitap(Object.assign({ ad: 'Okunan Roman', yazar: 'Usta Yazar',
    durum: 'okunuyor', sayfa: 400, guncelSayfa: 100,
    baslamaTarihi: '2026-01-01', gsG: 5 }, ek || {}));
}

test.describe('G36 Ciltli Kütüphane', () => {

  /* ---------- 1. DOLGU YOK ---------- */

  test('Kütüphane + header + nav + FAB: dolu (doygun zeminli) düğme YOK', async ({ page }) => {
    await tohumla(page, [okunanK(), sahteKitap({ ad: 'Sırada Bir' })]);
    await rafAc(page);
    const dolu = await doluDugmeler(page, 'body');
    expect(dolu, 'dolu düğmeler: ' + JSON.stringify(dolu)).toEqual([]);
  });

  test('detay + form + ayarlar pencerelerinde de dolu düğme YOK', async ({ page }) => {
    await tohumla(page, [okunanK()]);
    await rafAc(page);
    await page.click('#liste .kart');
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    expect(await doluDugmeler(page, '#ortuDetay')).toEqual([]);
    await page.click('[data-act="detay-kapat"]');
    await page.click('.fab[data-act="yeni"]');
    await expect(page.locator('#ortuForm')).toHaveClass(/acik/);
    expect(await doluDugmeler(page, '#ortuForm')).toEqual([]);
    await page.click('[data-act="form-kapat"]');
    await page.click('header [data-act="ayar-ac"]');
    await expect(page.locator('#ortuAyar')).toHaveClass(/acik/);
    expect(await doluDugmeler(page, '#ortuAyar')).toEqual([]);
  });

  test('birincil düğme = altın kontur + altın metin (dolgusuz)', async ({ page }) => {
    await tohumla(page, [sahteKitap()]);
    await rafAc(page);
    await page.click('header [data-act="ayar-ac"]');
    const r = await page.evaluate((renkCozSrc) => {
      const renkCoz = eval(renkCozSrc);
      const b = document.querySelector('#ortuAyar .btn-brass');
      const c = getComputedStyle(b);
      const brass = getComputedStyle(document.documentElement).getPropertyValue('--brass').trim();
      const p = document.createElement('div');
      p.style.color = brass; document.body.appendChild(p);
      const brassRgb = getComputedStyle(p).color; p.remove();
      return { kenar: c.borderTopColor, metin: c.color, brass: brassRgb,
        kenarEn: c.borderTopWidth, zeminAlfa: renkCoz(c.backgroundColor).a };
    }, RENK_COZ);
    expect(r.kenar).toBe(r.brass);
    expect(r.metin).toBe(r.brass);
    expect(r.kenarEn).toBe('1px');
    expect(r.zeminAlfa, 'birincil düğme dolgusuz').toBeLessThan(0.25);
  });

  /* ---------- 2. Kapak levhası ---------- */

  test('kapak levhası: 6px paspartu + 1px kontur + sepya filtresi (ızgara)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Levhalı Kitap' })], { kk_gorunum_v1: null });
    await rafAc(page);
    const r = await page.locator('#liste .kart .plate').first().evaluate(el => {
      const c = getComputedStyle(el);
      return { paspartu: c.borderTopWidth, paspartuStil: c.borderTopStyle,
        kontur: c.outlineWidth, konturStil: c.outlineStyle, filtre: c.filter };
    });
    expect(r.paspartu).toBe('6px');
    expect(r.paspartuStil).toBe('solid');
    expect(r.kontur, 'levha konturu 1px (M2 mutasyonunun hedefi)').toBe('1px');
    expect(r.konturStil).toBe('solid');
    expect(r.filtre).toContain('sepia');
  });

  test('kapaksız kitap ızgarada: levha içinde kesikli çerçeve + tam ad', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Kapaksız Eser', kapak: null })], { kk_gorunum_v1: null });
    await rafAc(page);
    const plate = page.locator('#liste .kart .plate.p-bos');
    await expect(plate).toHaveCount(1);
    await expect(plate.locator('.iz-yedek')).toHaveText('Kapaksız Eser');
    const kesikli = await plate.evaluate(el => getComputedStyle(el, '::after').borderTopStyle);
    expect(kesikli).toBe('dashed');
  });

  /* ---------- 3. kicker + Lora küçük punto ---------- */

  test('kicker: altın, büyük harf, harf aralıklı, küçük punto (Lora ayarı)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Sıradaki' })]);
    await rafAc(page);
    const r = await page.locator('#ktUst .kicker').first().evaluate(el => {
      const c = getComputedStyle(el);
      const brass = (() => {
        const p = document.createElement('div');
        p.style.color = getComputedStyle(document.documentElement).getPropertyValue('--brass').trim();
        document.body.appendChild(p);
        const x = getComputedStyle(p).color; p.remove(); return x;
      })();
      return { renk: c.color, brass, buyuk: c.textTransform,
        aralik: parseFloat(c.letterSpacing), punto: parseFloat(c.fontSize) };
    });
    expect(r.renk).toBe(r.brass);
    expect(r.buyuk).toBe('uppercase');
    expect(r.aralik, 'harf aralığı açık').toBeGreaterThan(0.8);
    expect(r.punto, 'küçük punto').toBeLessThan(12);
  });

  test('nav etiketi: küçük punto + harf aralığı (Lora ayarı) — 5 sekme 412px\'te sığar', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    await tohumla(page, []);
    await page.goto('/');
    const r = await page.evaluate(() => {
      const dugmeler = [...document.querySelectorAll('nav .nav-btn')];
      const c = getComputedStyle(dugmeler[0]);
      return {
        adet: dugmeler.length,
        punto: parseFloat(c.fontSize),
        aralik: parseFloat(c.letterSpacing),
        taskan: dugmeler.filter(b => {
          const e = b.querySelector('.n-etiket');
          return e && e.getBoundingClientRect().width > b.getBoundingClientRect().width;
        }).map(b => b.textContent.trim()),
        toplamEn: dugmeler.reduce((t, b) => t + b.getBoundingClientRect().width, 0)
      };
    });
    expect(r.adet).toBe(5);
    expect(r.punto).toBeLessThan(11.5);
    expect(r.aralik).toBeGreaterThan(0.3);
    expect(r.taskan, 'taşan etiket yok').toEqual([]);
    expect(r.toplamEn).toBeLessThanOrEqual(413);
  });

  /* ---------- 4. Yıl hedefi şeridi ---------- */

  test('hedef şeridi: hedef varken görünür (doğru sayı), dokununca İstatistik', async ({ page }) => {
    const yil = new Date().getFullYear();
    const hedefler = {}; hedefler[yil] = 12;
    await tohumla(page, {
      kitaplar: [sahteKitap({ ad: 'Bitti Bir', durum: 'bitti', bitisTarihi: bugunISO() }),
        sahteKitap({ ad: 'Duran' })],
      hedef: hedefler
    });
    await rafAc(page);
    await expect(page.locator('#ktHedef')).toBeVisible();
    await expect(page.locator('#ktHedef .kicker')).toContainText(String(yil));
    await expect(page.locator('#ktHedef .kt-hedef-sayi')).toHaveText('1 / 12');
    await page.click('#ktHedef .kt-hedef');
    await expect(page.locator('#panel-ist')).toBeVisible();
    await expect(page.locator('nav [data-v="ist"]')).toHaveClass(/active/);
  });

  test('hedef yokken şerit çizilmez', async ({ page }) => {
    await tohumla(page, [sahteKitap()]);
    await rafAc(page);
    await expect(page.locator('#ktUst')).toBeVisible();
    await expect(page.locator('#ktHedef')).toHaveCount(0);
  });

  /* ---------- 5. Devam eden okuma ---------- */

  test('devam eden okuma: okunan kitap varken görünür; sayfa işaretle ilerleme kaydı yazar', async ({ page }) => {
    await tohumla(page, [okunanK()]);
    await rafAc(page);
    const blok = page.locator('#ktDevam');
    await expect(blok).toBeVisible();
    await expect(blok).toContainText('Okunan Roman');
    await expect(blok).toContainText('100 / 400 sayfa');
    await expect(blok).toContainText('%25');
    // sayfa işaretle: kutu açılır → değer → kaydet → veri + seans + damga
    await expect(page.locator('.kt-sayfa-satir')).toBeHidden();
    await page.click('[data-act="kt-sayfa-ac"]');
    const kutu = page.locator('.kt-sayfa-satir');
    await expect(kutu).toBeVisible();
    await kutu.locator('input').fill('160');
    await page.click('[data-act="kt-sayfa-kaydet"]');
    await expect(page.locator('#ktDevam')).toContainText('160 / 400 sayfa');
    const v = await page.evaluate(() => {
      const k = veri.kitaplar[0];
      return { g: k.guncelSayfa, seans: (k.seanslar||[]).length, damga: k.gsG };
    });
    expect(v.g).toBe(160);
    expect(v.seans, 'seans kaydı düştü').toBeGreaterThan(0);
    expect(v.damga, 'gsG damgası basıldı').toBeGreaterThan(1000);
  });

  test('sayfa işaretle sınırı aşan girişte toplam sayfaya kırpar', async ({ page }) => {
    await tohumla(page, [okunanK()]);
    await rafAc(page);
    await page.click('[data-act="kt-sayfa-ac"]');
    await page.locator('.kt-sayfa-satir input').fill('9999');
    await page.click('[data-act="kt-sayfa-kaydet"]');
    expect(await page.evaluate(() => veri.kitaplar[0].guncelSayfa)).toBe(400);
  });

  test('kitaba git detayı açar; okunan kitap yoksa blok çizilmez', async ({ page }) => {
    await tohumla(page, [okunanK(), sahteKitap({ ad: 'Duran Kitap' })]);
    await rafAc(page);
    await page.click('[data-act="kt-git"]');
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await expect(page.locator('#detayIcerik')).toContainText('Okunan Roman');
    await page.click('[data-act="detay-kapat"]');
    // blok koşulu: okunan kalmayınca kaybolur
    await page.evaluate(() => { veri.kitaplar[0].durum = 'bitti'; depoKaydet(); listeCiz(); });
    await expect(page.locator('#ktDevam')).toHaveCount(0);
  });

  test('birden fazla okunan kitap: devam bölümü yatay şerit olur', async ({ page }) => {
    await tohumla(page, [okunanK(), okunanK({ ad: 'İkinci Roman' })]);
    await rafAc(page);
    await expect(page.locator('#ktDevam .kt-serit')).toHaveCount(1);
    await expect(page.locator('#ktDevam .kt-devam-kart')).toHaveCount(2);
  });

  /* ---------- 6. Sırada şeridi ---------- */

  test('sırada: okunacaklardan beslenir, istek listesi dışlanır, yatay kaydırılabilir', async ({ page }) => {
    await page.setViewportSize({ width: 412, height: 915 });
    const kitaplar = [];
    for (let i = 1; i <= 8; i++) kitaplar.push(sahteKitap({ ad: 'Sıradaki ' + i }));
    kitaplar.push(sahteKitap({ ad: 'İstekteki', sahiplik: 'istek' }));
    kitaplar.push(sahteKitap({ ad: 'Bitmiş', durum: 'bitti', bitisTarihi: bugunISO() }));
    await tohumla(page, kitaplar);
    await rafAc(page);
    await expect(page.locator('#ktSirada')).toBeVisible();
    await expect(page.locator('#ktSirada .kt-adet')).toHaveText('8 kitap');
    await expect(page.locator('#ktSiradaSerit .kt-sira-plate')).toHaveCount(8);
    await expect(page.locator('#ktSirada')).not.toContainText('İstekteki');
    const kayar = await page.locator('#ktSiradaSerit').evaluate(el =>
      ({ ic: el.scrollWidth, dis: el.clientWidth }));
    expect(kayar.ic, `şerit kaydırılabilir (${kayar.ic} > ${kayar.dis})`).toBeGreaterThan(kayar.dis);
    // şerit levhasına dokunmak detayı açar
    await page.click('#ktSiradaSerit .kt-sira-plate');
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
  });

  test('arama yazılınca devam/sırada blokları gizlenir (sonuç öne gelir), başlık kalır', async ({ page }) => {
    await tohumla(page, [okunanK(), sahteKitap({ ad: 'Aranan Kitap' })]);
    await rafAc(page);
    await expect(page.locator('#ktDevam')).toBeVisible();
    await page.fill('#arama', 'Aranan');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#ktDevam')).toHaveCount(0);
    await expect(page.locator('#ktSirada')).toHaveCount(0);
    await expect(page.locator('.kt-baslik')).toHaveText('Kütüphanem');
    await page.fill('#arama', '');
    await expect(page.locator('#ktDevam')).toBeVisible();
  });

  test('başlık satırı: Kütüphanem + cilt sayısı (istek dışlanır) + tarih satırı', async ({ page }) => {
    await tohumla(page, [sahteKitap(), sahteKitap(), sahteKitap({ sahiplik: 'istek' })]);
    await rafAc(page);
    await expect(page.locator('.kt-baslik')).toHaveText('Kütüphanem');
    await expect(page.locator('.kt-cilt')).toHaveText('2 cilt');
    const s = new Date();
    await expect(page.locator('.kt-tarih')).toContainText(String(s.getFullYear()));
    const buyuk = await page.locator('.kt-cilt').evaluate(el => getComputedStyle(el).textTransform);
    expect(buyuk).toBe('uppercase');
  });

  /* ---------- 7. Üç düzen anahtarı ---------- */

  test('yoğun düzen: küçük levhalı sık satırlar; tercih yenilemede korunur', async ({ page }) => {
    const kitaplar = [];
    for (let i = 1; i <= 6; i++) kitaplar.push(sahteKitap({ ad: 'Yoğun Kitap ' + i }));
    await tohumla(page, kitaplar);
    await rafAc(page);
    await page.click('#duzenYogun');
    await expect(page.locator('#liste')).toHaveClass(/yogun/);
    await expect(page.locator('#liste .yg-plate')).toHaveCount(6);
    await expect(page.locator('#duzenYogun')).toHaveClass(/aktif/);
    // yoğunluk: satır yüksekliği liste satırından belirgin kısa
    const satirBoy = await page.locator('#liste .kart').first()
      .evaluate(el => el.getBoundingClientRect().height);
    expect(satirBoy, 'yoğun satır < 56px').toBeLessThan(56);
    // tercih kalıcı
    await rafYenile(page);
    await expect(page.locator('#liste')).toHaveClass(/yogun/);
    await expect(page.locator('#duzenYogun')).toHaveClass(/aktif/);
  });

  test('yoğun düzende rafa göre gruplama çalışır (raf başlıkları)', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'A', raf: 'üst raf' }), sahteKitap({ ad: 'B', raf: 'üst raf' }),
      sahteKitap({ ad: 'C', raf: 'alt raf' })
    ]);
    await rafAc(page);
    await page.click('#duzenYogun');
    await expect(page.locator('#rafGrupBtn')).toBeVisible();
    await page.click('#rafGrupBtn');
    await expect(page.locator('#liste .raf-basligi')).toHaveCount(2);
    await expect(page.locator('#liste .kart')).toHaveCount(3);
  });

  /* ---------- 8. Korunan işlevler ---------- */

  test('sahiplik süzgeci korunur: istek çipi yalnız istek listesini gösterir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Bende' }), sahteKitap({ ad: 'İstenen', sahiplik: 'istek' })]);
    await rafAc(page);
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await page.click('#vmSahiplikChips [data-v="istek"]');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste .kart')).toContainText('İstenen');
  });

  test('çoklu seçim + toplu çubuk korunur; çubuk düğmeleri kontur dilinde', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Seçilecek' }), sahteKitap({ ad: 'İkinci' })]);
    await rafAc(page);
    await page.click('#secimBtn');
    await page.click('#liste .kart');
    await expect(page.locator('#topluSayi')).toHaveText('1 seçili');
    const cubukDolu = await doluDugmeler(page, '.toplu-cubuk');
    expect(cubukDolu, 'toplu çubukta dolu düğme yok').toEqual([]);
    await page.click('[data-act="toplu-cik"]');
    await expect(page.locator('#topluCubuk')).toHaveCount(0);
  });

  test('FAB: altın konturlu zemin diski; kitap ekleme formunu açar', async ({ page }) => {
    await tohumla(page, [sahteKitap()]);
    await rafAc(page);
    const r = await page.evaluate((renkCozSrc) => {
      const renkCoz = eval(renkCozSrc);
      const f = document.querySelector('.fab');
      const c = getComputedStyle(f);
      const kok = getComputedStyle(document.documentElement);
      const p = document.createElement('div');
      p.style.color = kok.getPropertyValue('--brass').trim();
      document.body.appendChild(p);
      const brass = getComputedStyle(p).color; p.remove();
      p.style.color = kok.getPropertyValue('--bg').trim();
      document.body.appendChild(p);
      const bg = getComputedStyle(p).color; p.remove();
      return { kenar: c.borderTopColor, kenarEn: c.borderTopWidth,
        zemin: c.backgroundColor, metin: c.color, brass, bg,
        zeminAlfa: renkCoz(c.backgroundColor).a };
    }, RENK_COZ);
    expect(r.kenar).toBe(r.brass);
    expect(r.kenarEn).toBe('1px');
    expect(r.metin).toBe(r.brass);
    expect(r.zemin).toBe(r.bg);      // dolgu değil: sayfa zemininde disk
    await page.click('.fab[data-act="yeni"]');
    await expect(page.locator('#ortuForm')).toHaveClass(/acik/);
  });

  /* ---------- 9. Kontrast AA (yeni metin rolleri, gerçek render) ---------- */

  for (const tema of ['acik', 'karanlik']) {
    test(`yeni metin rolleri AA (${tema} tema)`, async ({ page }) => {
      await tohumla(page, [okunanK(), sahteKitap({ ad: 'Sırada Kitap' })],
        { kk_tema_v1: tema });
      await rafAc(page);
      const ciftler = [
        ['#ktUst .kicker', null, 'kicker'],
        ['.kt-cilt', null, 'cilt sayısı'],
        ['.kt-tarih', null, 'tarih satırı'],
        ['.kt-devam-ad', null, 'devam kitap adı'],
        ['.kt-devam-yazar', null, 'devam yazar'],
        ['.kt-devam-sayfa span', null, 'sayfa sayacı'],
        ['#ktDevam .btn-brass', null, 'birincil düğme metni'],
        ['#ktDevam .btn-cerceve', null, 'ikincil düğme metni'],
        ['.kt-adet', null, 'şerit adedi'],
        ['nav .nav-btn.active', null, 'aktif sekme'],
        ['nav .nav-btn:not(.active)', null, 'pasif sekme']
      ];
      for (const [m, z, ad] of ciftler) {
        const o = await kontrastOrani(page, m, z);
        expect(o, `${ad} ölçülemedi (${m})`).not.toBeNull();
        expect(o, `${ad} (${tema}): ${o && o.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
      // ızgara durum satırı
      await page.click('#duzenIzgara');
      const izDurum = await kontrastOrani(page, '#liste .iz-durum', null);
      expect(izDurum, `ızgara durum satırı (${tema})`).toBeGreaterThanOrEqual(4.5);
    });
  }
});
