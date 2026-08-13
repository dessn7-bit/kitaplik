'use strict';
/* G57 — GENİŞ EKRAN DÜZENİ (v68): tablet/masaüstü kırılımları.

   SÖZLEŞMELER (bu dosyanın koruduğu):
   - İçerik ≥700'de en çok 1100px ve içerik alanında ortalı — BEŞ ekranın
     (Ana Sayfa, Kütüphane, Keşfet, Alıntılar, İstatistik) ana konteynerleri.
   - Eksen satırı TEK PARÇA: sol grup (Durum/Tür/Yazar/Raf) ile sağ grup
     (Seç + düzen) arası boşluk eşik altında (ölçülen taban: 820'de 457px,
     1440'ta 1077px İDİ).
   - Sıralama menüsü ≥700'de kendi satırında asılı DEĞİL — eksen satırına biner.
   - İzgara kapak genişliği masaüstünde 150-200px bandında (taban: 96px),
     levha oranı mobil oranın (96:150) korunmuş hali.
   - Alt menü KARARI: ≥1100 solda dikey kenar çubuğu (fare ergonomisi; ölü sol
     boşluğu kullanır); 700-1100 dokunmatik alt bar (560px SABİT — right:auto
     kusur onarımı); içerik çubukla ÇAKIŞMAZ.
   - 390px mobil düzen PİKSEL-BİREBİR korunur (ölçümle).
   - Pencereler geniş ekranda ≤560px ve ortalı.
   - Kontrast AA dikey çubukta da korunur.

   (Mutasyon 1: ≥700 max-width kuralı kaldırılır → içerik-sınırı vakaları
    kırmızı. Mutasyon 2: kt-arac flex-start kuralı kaldırılır (space-between'e
    döner) → eksen-boşluğu vakası kırmızı.) */
const { test, expect, tohumla, sahteKitap, rafAc } = require('./yardim');

const kitaplar = () => Array.from({ length: 12 }, (_, i) =>
  sahteKitap({ ad: 'Genis Kitap ' + (i + 1), yazar: 'Yazar ' + (i % 4),
    tur: ['Roman', 'Gezi'][i % 2], raf: 'raf ' + (i % 2),
    notlar: i === 0 ? [{ id: 'gn1', tip: 'alinti', metin: 'geniş alıntı', t: 1754000000000 }] : [] }));

async function kutu(page, sec) {
  return page.evaluate(s => {
    const el = document.querySelector(s);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.x, w: r.width, y: r.y, h: r.height,
      ortaY: r.y + r.height / 2, sag: r.x + r.width };
  }, sec);
}
async function ekranAc(page, sekme, bekle) {
  await page.click('nav [data-act="sekme"][data-v="' + sekme + '"]');
  if (bekle) await page.waitForSelector(bekle);
}

test.describe('G57 geniş ekran düzeni', () => {

  test('1440px: BEŞ ekranın içeriği ≤1100px ve çubukla çakışmıyor', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await tohumla(page, kitaplar(), { kk_gorunum_v1: null });   // varsayılan görünüm: İZGARA
    await page.goto('/');
    const navK = await kutu(page, 'nav');
    const ekranlar = [
      ['ana', '.as-wrap', null],
      ['raf', '#liste', null],
      ['kesfet', '#ksIcerik', '#ksIcerik .ks-ust'],
      ['alinti', '.alinti-wrap', null],
      ['ist', '.ist-wrap', null]
    ];
    for (const [sekme, sec, bekle] of ekranlar) {
      await ekranAc(page, sekme, bekle);
      const k = await kutu(page, sec);
      expect(k, sekme + ' konteyneri bulunamadı').not.toBeNull();
      expect(k.w, sekme + ' genişliği').toBeLessThanOrEqual(1100);
      expect(k.x, sekme + ' çubukla çakışmasın').toBeGreaterThanOrEqual(navK.sag);
      // içerik alanı içinde ortalı (çubuk düşüldükten sonra sol=sağ ±20)
      const sol = k.x - navK.sag, sag = 1440 - k.sag;
      expect(Math.abs(sol - sag), sekme + ' içerik alanında ortalı').toBeLessThan(20);
    }
  });

  for (const [w, h, esik] of [[1440, 900, 80], [820, 1180, 80]]) {
    test(w + 'px: eksen satırı TEK PARÇA (sol/sağ grup boşluğu < ' + esik + 'px)', async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await tohumla(page, kitaplar(), { kk_gorunum_v1: null });   // varsayılan görünüm: İZGARA
      await rafAc(page);
      const sol = await kutu(page, '#grupEksen');
      const sag = await kutu(page, '#ktAracSag');
      const bosluk = sag.x - sol.sag;
      // ölçülen taban: 820'de 457px, 1440'ta 1077px — artık bitişik
      expect(bosluk).toBeGreaterThanOrEqual(0);
      expect(bosluk).toBeLessThan(esik);
    });
  }

  test('≥700: sıralama menüsü kendi satırında DEĞİL — eksen satırıyla aynı hizada', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await tohumla(page, kitaplar(), { kk_gorunum_v1: null });   // varsayılan görünüm: İZGARA
    await rafAc(page);
    const eksen = await kutu(page, '#grupEksen');
    const sirala = await kutu(page, '#sirala');
    expect(Math.abs(sirala.ortaY - eksen.ortaY), 'aynı görsel satır').toBeLessThan(15);
    // ve sağ uçta: sıralama, eksen sağ grubundan sonra gelir
    const sag = await kutu(page, '#ktAracSag');
    expect(sirala.x).toBeGreaterThan(sag.sag);
    /* Taze-göz kusuru kilidi: etiketsiz kütüphanede (bu fixture etiketsiz)
       max-width:46% içerik-boyutlu satırda menüyü 55px'e çökertiyordu —
       "Son eklenen" metni kırpılmadan sığmalı. */
    expect(sirala.w, 'sıralama menüsü çökmedi (taban: 55px idi)').toBeGreaterThanOrEqual(100);
  });

  test('izgara: masaüstünde kapak 150-200px bandında, oran korunur; tablet 130-200', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await tohumla(page, kitaplar(), { kk_gorunum_v1: null });   // varsayılan görünüm: İZGARA
    await rafAc(page);
    const olc = () => page.evaluate(() => {
      const l = document.getElementById('liste');
      const kolonlar = getComputedStyle(l).gridTemplateColumns.split(' ').filter(Boolean);
      const p = document.querySelector('#liste .iz-plate').getBoundingClientRect();
      return { kolon: kolonlar.length, kapakW: p.width, kapakH: p.height };
    });
    const m = await olc();
    expect(m.kapakW, 'masaüstü kapak ≥150 (taban 96 idi)').toBeGreaterThanOrEqual(150);
    expect(m.kapakW).toBeLessThanOrEqual(200);
    expect(m.kolon).toBeLessThanOrEqual(7);
    // levha oranı mobil oranın korunmuş hali (150/96 = 1.5625)
    expect(Math.abs(m.kapakH / m.kapakW - 1.5625)).toBeLessThan(0.06);
    await page.setViewportSize({ width: 820, height: 1180 });
    const t = await olc();
    expect(t.kapakW, 'tablet kapak bandı').toBeGreaterThanOrEqual(130);
    expect(t.kapakW).toBeLessThanOrEqual(200);
  });

  test('ALT MENÜ KARARI: ≥1100 solda dikey çubuk; 700-1100 altta 560px bar; 390 mobil bar', async ({ page }) => {
    await tohumla(page, kitaplar(), { kk_gorunum_v1: null });   // varsayılan görünüm: İZGARA
    // masaüstü: sol dikey
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    let n = await kutu(page, 'nav');
    expect(n.x, 'sol kenara yaslı').toBe(0);
    expect(n.w, 'dar dikey çubuk').toBeLessThan(200);
    expect(n.h, 'tam boy').toBeGreaterThanOrEqual(890);
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('nav')).flexDirection)).toBe('column');
    await expect(page.locator('nav .nav-btn')).toHaveCount(5);   // beş sekme duruyor
    // tablet: alt bar 560 SABİT (kusur onarımı: right:0 kalınca 410'a düşüyordu)
    await page.setViewportSize({ width: 820, height: 1180 });
    n = await kutu(page, 'nav');
    expect(Math.round(n.w), 'tablet alt bar 560px sabit').toBe(560);
    expect(n.y, 'altta').toBeGreaterThan(1000);
    expect(Math.abs((n.x + n.w / 2) - 410), 'yatay ortalı').toBeLessThan(10);
    // mobil: tam genişlik alt bar (birebir)
    await page.setViewportSize({ width: 390, height: 844 });
    n = await kutu(page, 'nav');
    expect(Math.round(n.w)).toBe(390);
    expect(n.y).toBeGreaterThan(700);
  });

  test('390px: mobil düzen PİKSEL-BİREBİR (eksen, sıralama satırı, ızgara, tam genişlik)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await tohumla(page, kitaplar(), { kk_gorunum_v1: null });   // varsayılan görünüm: İZGARA
    await rafAc(page);
    // v68 ÖNCESİ ölçülen mobil taban aynen: kt-arac tam genişlik + space-between,
    // sort-row KENDİ satırında, ızgara 96px kovası (3 sütun), sarmalayıcı akış-dışı
    const d = await page.evaluate(() => {
      const arac = document.querySelector('.kt-arac').getBoundingClientRect();
      const sira = getComputedStyle(document.querySelector('.kt-arac-sira'));
      const sort = document.querySelector('.sort-row').getBoundingClientRect();
      const l = document.getElementById('liste');
      return { aracW: arac.width, aracAlt: arac.y + arac.height, sortY: sort.y,
        sarmal: sira.display,
        justify: getComputedStyle(document.querySelector('.kt-arac')).justifyContent,
        kolon: getComputedStyle(l).gridTemplateColumns.split(' ').length,
        listeW: l.getBoundingClientRect().width };
    });
    expect(d.sarmal, 'sarmalayıcı mobilde akıştan silinir').toBe('contents');
    expect(d.aracW).toBe(390);
    expect(d.justify, 'mobil eksen düzeni değişmedi').toBe('space-between');
    expect(d.sortY, 'sıralama mobilde KENDİ satırında (eski davranış)').toBeGreaterThanOrEqual(d.aracAlt - 2);
    expect(d.kolon, 'mobil ızgara 3 sütun').toBe(3);
    expect(d.listeW).toBe(390);
  });

  test('pencereler 1440px\'te ortalanmış ve ≤560px (detay penceresi)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await tohumla(page, kitaplar(), { kk_gorunum_v1: null });   // varsayılan görünüm: İZGARA
    await rafAc(page);
    await page.click('#liste [data-act="detay"] >> nth=0');
    const s = await kutu(page, '#ortuDetay .sheet');
    expect(s.w).toBeLessThanOrEqual(560);
    expect(Math.abs((s.x + s.w / 2) - 720), 'yatay ortalı').toBeLessThan(20);
  });

  test('dikey çubukta kontrast AA (aktif + pasif sekme metni)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await tohumla(page, kitaplar(), { kk_gorunum_v1: null });   // varsayılan görünüm: İZGARA
    await page.goto('/');
    for (const sec of ['nav .nav-btn.active', 'nav .nav-btn:not(.active)']) {
      const oran = await page.evaluate(s => {
        const el = document.querySelector(s);
        const COZ = z => { let m = z.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
          if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
          m = z.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
          if (m) return { r: 255 * +m[1], g: 255 * +m[2], b: 255 * +m[3], a: m[4] === undefined ? 1 : +m[4] };
          return { r: 0, g: 0, b: 0, a: 1 }; };
        const metin = COZ(getComputedStyle(el).color);
        let zemin = { r: 255, g: 255, b: 255 }, kat = [], p = el;
        while (p && p !== document.documentElement) {
          const c = COZ(getComputedStyle(p).backgroundColor);
          if (c.a > 0) { kat.push(c); if (c.a >= 1) break; }
          p = p.parentElement;
        }
        for (let i = kat.length - 1; i >= 0; i--) {
          const c = kat[i];
          zemin = { r: c.r * c.a + zemin.r * (1 - c.a), g: c.g * c.a + zemin.g * (1 - c.a),
            b: c.b * c.a + zemin.b * (1 - c.a) };
        }
        const L = c => { const f = v => { v /= 255;
          return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
          return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
        const l1 = L(metin), l2 = L(zemin);
        return (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
      }, sec);
      expect(oran, sec + ': ' + oran.toFixed(2)).toBeGreaterThanOrEqual(4.5);
    }
  });

  test('900-1100 ara bandı (1000px): eksen bitişik, ızgara ~150px, içerik taşmıyor', async ({ page }) => {
    await page.setViewportSize({ width: 1000, height: 800 });
    await tohumla(page, kitaplar(), { kk_gorunum_v1: null });   // varsayılan görünüm: İZGARA
    await rafAc(page);
    const sol = await kutu(page, '#grupEksen');
    const sag = await kutu(page, '#ktAracSag');
    expect(sag.x - sol.sag, 'ara bantta da eksen tek parça').toBeLessThan(80);
    const kapak = await page.evaluate(() =>
      document.querySelector('#liste .iz-plate').getBoundingClientRect().width);
    expect(kapak).toBeGreaterThanOrEqual(130);
    expect(kapak).toBeLessThanOrEqual(200);
    // ara bantta çubuk YOK (dokunmatik varsayımı ≥1100'e kadar): alt bar
    const n = await kutu(page, 'nav');
    expect(n.y, 'alt bar').toBeGreaterThan(700);
  });
});
