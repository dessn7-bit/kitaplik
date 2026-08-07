'use strict';
const { test, expect, tohumla, sahteKitap,
  kameraTaklit, rafAc, rafYenile, ayarlarAc } = require('./yardim');

/* ---- kontrast yardımcıları (WCAG 2.x nispi parlaklık) ---- */
function rgbCoz(s) {
  const m = String(s).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  const h = String(s).replace('#', '');
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}
function parlaklik(renk) {
  const [r, g, b] = rgbCoz(renk).map(v => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function kontrast(a, b) {
  const l1 = parlaklik(a), l2 = parlaklik(b);
  return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100;
}
async function degiskenler(page) {
  return page.evaluate(() => {
    const s = getComputedStyle(document.documentElement);
    const al = a => s.getPropertyValue(a).trim();
    return { bg: al('--bg'), surface: al('--surface'), surface2: al('--surface2'),
      paper: al('--paper'), muted: al('--muted'), muted2: al('--muted2'),
      brass: al('--brass'), ok: al('--ok'), drop: al('--drop'), mavi: al('--mavi'),
      uzeri: al('--uzeri'), tema: document.documentElement.getAttribute('data-tema') };
  });
}

/* ================= M1: karanlık tema ================= */
test.describe('G21 M1 — karanlık tema', () => {

  test('varsayılan sistem: koyu tercih eden ortamda karanlık açılır', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await rafAc(page);
    const d = await degiskenler(page);
    expect(d.tema).toBe('karanlik');
    expect(parlaklik(d.bg)).toBeLessThan(0.1);          // zemin gerçekten koyu
    expect(parlaklik(d.paper)).toBeGreaterThan(0.5);    // metin açık
  });

  test('sistem açıkken açık tema kullanılır', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await rafAc(page);
    const d = await degiskenler(page);
    expect(d.tema).toBe('acik');
    expect(parlaklik(d.bg)).toBeGreaterThan(0.7);
  });

  test('elle karanlık seçimi kaydedilir ve yenilemede korunur', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await tohumla(page, [sahteKitap({ ad: 'K' })]);
    await rafAc(page);
    await ayarlarAc(page);
    await page.click('#tmSecim [data-act="tm-tema"][data-v="karanlik"]');
    await expect(page.locator('#toast')).toContainText('Karanlık tema');
    expect((await degiskenler(page)).tema).toBe('karanlik');
    await rafYenile(page);
    expect((await degiskenler(page)).tema).toBe('karanlik');   // sistem açık olsa da karanlık
    await ayarlarAc(page);
    await expect(page.locator('#tmSecim [data-v="karanlik"]')).toHaveClass(/tm-secili/);
  });

  test('sisteme dönünce tercih silinir', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await rafAc(page);
    await ayarlarAc(page);
    await page.click('#tmSecim [data-act="tm-tema"][data-v="karanlik"]');
    await page.click('#tmSecim [data-act="tm-tema"][data-v="sistem"]');
    expect((await degiskenler(page)).tema).toBe('acik');
    expect(await page.evaluate(() => localStorage.getItem('kk_tema_v1'))).toBeNull();
  });

  test('theme-color meta etiketi temayı izler', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await rafAc(page);
    expect(await page.getAttribute('#temaRengi', 'content')).toBe('#171512');
    await ayarlarAc(page);
    await page.click('#tmSecim [data-act="tm-tema"][data-v="acik"]');
    expect(await page.getAttribute('#temaRengi', 'content')).toBe('#F5EFE3');
  });

  test('karanlık temada metin kontrastları AA (4.5) eşiğini geçer', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await rafAc(page);
    const d = await degiskenler(page);
    const zeminler = [['bg', d.bg], ['surface', d.surface], ['surface2', d.surface2]];
    for (const metin of ['paper', 'muted', 'muted2', 'brass', 'ok', 'drop', 'mavi']) {
      for (const [zad, z] of zeminler) {
        const o = kontrast(d[metin], z);
        expect(o, `karanlık ${metin}/${zad} = ${o}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    // pirinç ZEMİN üzerindeki metin de okunur olmalı (karanlıkta ters çevrilir)
    expect(kontrast(d.uzeri, d.brass)).toBeGreaterThanOrEqual(4.5);
  });

  test('karanlık temada gerçek kart metni okunur (hesaplanmış stiller)', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await tohumla(page, [sahteKitap({ ad: 'Karanlık Kitap', yazar: 'Y', durum: 'okunuyor',
      sayfa: 200, guncelSayfa: 50 })]);
    await rafAc(page);
    const olcum = await page.evaluate(() => {
      const kart = document.querySelector('#liste .kart');
      const baslik = kart.querySelector('.kart-baslik');
      const yazar = kart.querySelector('.kart-yazar');
      const zemin = getComputedStyle(kart).backgroundColor;
      return { baslikRenk: getComputedStyle(baslik).color, kartZemin: zemin,
        yazarRenk: yazar ? getComputedStyle(yazar).color : null,
        govdeZemin: getComputedStyle(document.body).backgroundColor };
    });
    expect(kontrast(olcum.baslikRenk, olcum.kartZemin)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(olcum.yazarRenk, olcum.kartZemin),
      `kart yazar rengi ${olcum.yazarRenk} / ${olcum.kartZemin}`).toBeGreaterThanOrEqual(4.5);
    /* SABİT RENK KAÇAĞI DENETİMİ: pirinç ZEMİN üzerindeki metin. Karanlıkta pirinç
       açık renge döndüğü için sabit beyaz (#FFFDF7) metin okunmaz hale gelir —
       değişkene (--uzeri) bağlı olmayan her kural burada yakalanır. */
    const pirincUstu = await page.evaluate(() => {
      const oge = [...document.querySelectorAll('.chip.active, .btn-brass, .durum-btn.secili, .mini-chip.secili, .tm-dugme.tm-secili')]
        .filter(e => e.offsetParent !== null);
      return oge.map(e => ({ sinif: e.className, metin: getComputedStyle(e).color,
        zemin: getComputedStyle(e).backgroundColor }));
    });
    expect(pirincUstu.length).toBeGreaterThan(0);
    for (const o of pirincUstu) {
      expect(kontrast(o.metin, o.zemin),
        `pirinç zeminli öğe (${o.sinif}): ${o.metin} / ${o.zemin}`).toBeGreaterThanOrEqual(4.5);
    }
    expect(parlaklik(olcum.govdeZemin)).toBeLessThan(0.1);
  });

  test('ALTIN KURAL: alıntı kartı PNG karanlık temada da KREM kalır', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await tohumla(page, [sahteKitap({ id: 'kk', ad: 'Kartlık Kitap', yazar: 'Y', notlar: [
      { id: 'n1', tip: 'alinti', metin: 'Paylaşılacak alıntı.', tarih: '2026-08-01', sayfa: 10, fikir: [] }] })]);
    await rafAc(page);
    await page.click('[data-act="sekme"][data-v="alinti"]');
    await page.click('#alintiIcerik [data-act="alinti-kart"]');
    await expect(page.locator('#kartOrtu')).toHaveClass(/acik/);
    const piksel = await page.evaluate(() => {
      const t = document.getElementById('kartTuval');
      const d = t.getContext('2d').getImageData(5, 5, 1, 1).data;   // sol üst köşe = zemin
      return { r: d[0], g: d[1], b: d[2] };
    });
    // #F5EFE3 kremi: ekran teması değil, paylaşılan görselin kimliği
    expect(piksel).toEqual({ r: 245, g: 239, b: 227 });
  });
});

/* ================= M2: açık tema kontrast ================= */
test.describe('G21 M2 — açık tema kontrast düzeltmesi', () => {

  test('açık temada tüm metin renkleri AA eşiğini geçer', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await rafAc(page);
    const d = await degiskenler(page);
    for (const metin of ['paper', 'muted', 'muted2', 'brass', 'ok', 'drop', 'mavi']) {
      for (const [zad, z] of [['bg', d.bg], ['surface', d.surface], ['surface2', d.surface2]]) {
        const o = kontrast(d[metin], z);
        expect(o, `açık ${metin}/${zad} = ${o}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  test('ikincil metin (muted2) artık 4.5 üstünde — eski değer 2.88 idi', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await rafAc(page);
    const d = await degiskenler(page);
    expect(kontrast(d.muted2, d.surface)).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(d.muted2, d.surface2)).toBeGreaterThanOrEqual(4.5);
  });
});

/* ================= M3: geniş ekran ================= */
test.describe('G21 M3 — geniş ekran düzeni', () => {

  const besKitap = () => Array.from({ length: 5 }, (_, i) =>
    sahteKitap({ ad: 'Kitap ' + (i + 1) }));

  test('1200px: içerik maksimum genişliği aşmıyor ve ortalanmış', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await tohumla(page, besKitap());
    await rafAc(page);
    const k = await page.locator('#liste').boundingBox();
    expect(k.width).toBeLessThanOrEqual(1100);
    const bosluk = { sol: k.x, sag: 1200 - (k.x + k.width) };
    expect(Math.abs(bosluk.sol - bosluk.sag)).toBeLessThan(20);   // ortalanmış
  });

  test('800px: liste iki sütun', async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 900 });
    await tohumla(page, besKitap());
    await rafAc(page);
    const kolon = await page.evaluate(() =>
      getComputedStyle(document.getElementById('liste')).gridTemplateColumns.split(' ').length);
    expect(kolon).toBe(2);
  });

  test('390px: tek sütun, mobil düzen bozulmadı', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 780 });
    await tohumla(page, besKitap());
    await rafAc(page);
    const d = await page.evaluate(() => {
      const l = getComputedStyle(document.getElementById('liste'));
      return { display: l.display, kolon: l.gridTemplateColumns };
    });
    expect(d.display).toBe('flex');            // mobilde eski akış korundu
    await expect(page.locator('#liste .kart')).toHaveCount(5);
  });

  test('modal geniş ekranda ortalanmış ve sınırlı genişlikte', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 900 });
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    const s = await page.locator('#ortuForm .sheet').boundingBox();
    expect(s.width).toBeLessThanOrEqual(560);
    expect(Math.abs((s.x + s.width / 2) - 600)).toBeLessThan(20);   // yatayda ortalı
    expect(s.y).toBeGreaterThan(10);                                 // dibe yapışmamış
  });
});

/* ================= M4: klavye ve erişilebilirlik ================= */
test.describe('G21 M4 — klavye ve erişilebilirlik', () => {

  test('Esc: form penceresini kapatır', async ({ page }) => {
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await expect(page.locator('#ortuForm')).toHaveClass(/acik/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#ortuForm')).not.toHaveClass(/acik/);
  });

  test('Esc: detay penceresini kapatır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Detaylı' })]);
    await rafAc(page);
    await page.click('#liste .kart');
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#ortuDetay')).not.toHaveClass(/acik/);
  });

  test('Esc: barkod penceresini kapatır', async ({ page }) => {
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await page.click('[data-act="barkod-ac"]');
    await expect(page.locator('#barkodOrtu')).toHaveClass(/acik/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#barkodOrtu')).not.toHaveClass(/acik/);
    await expect(page.locator('#ortuForm')).toHaveClass(/acik/);   // alttaki form açık kaldı
  });

  test('Esc: seri tarama penceresini kapatır ve kamera akışı durur', async ({ page }) => {
    await kameraTaklit(page);
    await rafAc(page);
    await ayarlarAc(page);
    await page.click('#ortuAyar [data-act="seri-ac"]');
    await expect(page.locator('#seriOrtu')).toHaveClass(/acik/);
    await expect.poll(() => page.evaluate(() => window.__akisIstendi)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(page.locator('#seriOrtu')).not.toHaveClass(/acik/);
    expect(await page.evaluate(() => window.__akisDurdu)).toBe(true);   // kendi kapanışı çalıştı
  });

  test('Esc: gelen alıntı penceresini kapatır ve URL temizlenir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Hedef' })]);
    await page.goto('/index.html?text=' + encodeURIComponent('Paylaşılan.'));
    await expect(page.locator('#ortuGelen')).toHaveClass(/acik/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#ortuGelen')).not.toHaveClass(/acik/);
    expect(new URL(page.url()).search).toBe('');
  });

  test('Esc: alıntı kartı önizlemesini kapatır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Kartlı', notlar: [
      { id: 'n1', tip: 'alinti', metin: 'Alıntı.', tarih: '2026-08-01', sayfa: null, fikir: [] }] })]);
    await rafAc(page);
    await page.click('[data-act="sekme"][data-v="alinti"]');
    await page.click('#alintiIcerik [data-act="alinti-kart"]');
    await expect(page.locator('#kartOrtu')).toHaveClass(/acik/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#kartOrtu')).not.toHaveClass(/acik/);
  });

  test('Esc: toplu işlem penceresini kapatır, sonra seçim modundan çıkar', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'K1' })]);
    await rafAc(page);
    await page.click('#secimBtn');
    await page.click('[data-act="toplu-tumu"]');
    await page.click('[data-act="toplu-raf"]');
    await expect(page.locator('#topluOrtu')).toHaveClass(/acik/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#topluOrtu')).not.toHaveClass(/acik/);
    await expect(page.locator('#topluCubuk')).toBeVisible();       // seçim modu duruyor
    await page.keyboard.press('Escape');
    await expect(page.locator('#topluCubuk')).toHaveCount(0);      // ikinci Esc seçimden çıkardı
  });

  test('iç içe pencerede EN ÜSTTEKİ kapanır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'İç içe' })]);
    await rafAc(page);
    await page.click('#liste .kart');          // detay
    await page.click('#dDigerKatla summary');  // Düzenle nadir bölümde katlı
    await page.click('[data-act="duzenle"]');  // form (detay kapanır)
    await page.click('[data-act="barkod-ac"]');// barkod (form üstünde)
    await expect(page.locator('#barkodOrtu')).toHaveClass(/acik/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#barkodOrtu')).not.toHaveClass(/acik/);
    await expect(page.locator('#ortuForm')).toHaveClass(/acik/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#ortuForm')).not.toHaveClass(/acik/);
  });

  test('odak pencere içinde kalır ve kapanınca geri döner', async ({ page }) => {
    await rafAc(page);
    const fab = page.locator('.fab');
    await fab.focus();
    await page.keyboard.press('Enter');                 // form açıldı
    await expect(page.locator('#ortuForm')).toHaveClass(/acik/);
    const iceride = await page.evaluate(() =>
      document.getElementById('ortuForm').contains(document.activeElement));
    expect(iceride).toBe(true);                          // odak içeri taşındı
    for (let i = 0; i < 30; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() =>
      document.getElementById('ortuForm').contains(document.activeElement))).toBe(true);  // kaçmadı
    await page.keyboard.press('Escape');
    // odak geri dönüşü bir sonraki tik'te olur (setTimeout 0) — bekleyerek doğrula
    await expect.poll(() => page.evaluate(() =>
      !!(document.activeElement && document.activeElement.classList.contains('fab')))).toBe(true);
  });

  test('toast ekran okuyucuya duyurulur (aria-live)', async ({ page }) => {
    await rafAc(page);
    await expect(page.locator('#toast')).toHaveAttribute('aria-live', 'polite');
    await expect(page.locator('#toast')).toHaveAttribute('role', 'status');
  });

  test('ikon-only düğmelerin erişilebilir adı var', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'K', notlar: [
      { id: 'n1', tip: 'not', metin: 'Not', tarih: '2026-08-01', sayfa: null, fikir: [] }] })]);
    await rafAc(page);
    // Ana Sayfa'da ikinci bir zar var (aynı eylem, aynı ad); ikisi de adlandırılmış olmalı
    await expect(page.locator('.zar-btn')).toHaveCount(2);
    await expect(page.locator('.search-row .zar-btn')).toHaveAttribute('aria-label', /rastgele/i);
    await expect(page.locator('#asSiradaki .zar-btn')).toHaveAttribute('aria-label', /rastgele/i);
    await expect(page.locator('.fab')).toHaveAttribute('aria-label', /ekle/i);
    await page.click('#liste .kart');
    await expect(page.locator('#detayIcerik .not-sil')).toHaveAttribute('aria-label', /sil/i);
    await expect(page.locator('#ortuDetay .sheet-kapat')).toHaveAttribute('aria-label', /kapat/i);
  });

  test('dokunma hedefleri: not-sil ve fikir × en az 40px', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'K', notlar: [
      { id: 'n1', tip: 'alinti', metin: 'Alıntı', tarih: '2026-08-01', sayfa: null, fikir: ['etiket'] }] })]);
    await rafAc(page);
    await page.click('#liste .kart');
    const nk = await page.locator('#detayIcerik .not-sil').boundingBox();
    expect(nk.width).toBeGreaterThanOrEqual(40);
    expect(nk.height).toBeGreaterThanOrEqual(40);
    // fikir × : görsel küçük, dokunma alanı ::after ile genişletildi
    await page.keyboard.press('Escape');   // detay penceresi sekmeyi örtmesin
    await expect(page.locator('#ortuDetay')).not.toHaveClass(/acik/);
    await page.click('[data-act="sekme"][data-v="alinti"]');
    await expect(page.locator('#alintiIcerik [data-act="fikir-sil"]')).toBeVisible();
    const alan = await page.evaluate(() => {
      const b = document.querySelector('#alintiIcerik [data-act="fikir-sil"]');
      const s = getComputedStyle(b, '::after');
      const kutu = b.getBoundingClientRect();
      const tasma = Math.abs(parseFloat(s.top || '0'));
      return { genislik: kutu.width + tasma * 2, yukseklik: kutu.height + tasma * 2 };
    });
    expect(alan.genislik).toBeGreaterThanOrEqual(40);
    expect(alan.yukseklik).toBeGreaterThanOrEqual(40);
  });

  test('fikir etiketi silme GERİ ALINABİLİR', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'K', notlar: [
      { id: 'n1', tip: 'alinti', metin: 'Alıntı', tarih: '2026-08-01', sayfa: null, fikir: ['kıymetli'] }] })]);
    await rafAc(page);
    await page.click('[data-act="sekme"][data-v="alinti"]');
    await page.click('#alintiIcerik [data-act="fikir-sil"]');
    expect(await page.evaluate(() => veri.kitaplar[0].notlar[0].fikir)).toEqual([]);
    await expect(page.locator('#toast')).toContainText('geri almak için dokun');
    await page.click('#toast');
    await expect(page.locator('#toast')).toContainText('Geri alındı');
    expect(await page.evaluate(() => veri.kitaplar[0].notlar[0].fikir)).toEqual(['kıymetli']);
  });
});
