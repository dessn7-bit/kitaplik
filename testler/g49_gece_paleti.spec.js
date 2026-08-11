'use strict';
/* G49 — PALET A GECE "Amber kâğıt" (v57).
   KUSUR: karanlık blok v25'ten (a81f31d) kalmıştı; Palet A v41'de (93f4bee)
   geldiği için 16 sürüm bayattı — tabanı nötre yakın #141210 idi, parşömen
   kimliğinin gece hâli değildi. Ayrıca `surface` ve `surface2` açıklık sırası
   açık temanın tersineydi (kuyu, kabarık yüzeyden parlaktı).

   YENİ TABAN: #1E1A15 (saf siyah DEĞİL, luminans 0.0107; sıcak, R−B=9).
   AYRAÇ / KONTROL AYRIMI: `--cizgi` bölüm ayracıdır (dekoratif, kıl payı);
   `--kontur` form/düğme sınırıdır ve WCAG 1.4.11 gereği 3:1 ister. Karanlıkta
   ikisi ayrıldı (%22 / %38). Açık temada ikisi AYNI değerde bırakıldı —
   görünüm birebir korundu; açık temanın kontrol konturu 1.37 ile eşiğin
   altında (ÖLÇÜLDÜ, ayrı karar).

   Bu dosyanın ana kanıtı ELLE SEÇİLMİŞ ÇİFT LİSTESİ DEĞİL: her yüzeyde
   TreeWalker ile GÖRÜNEN her metin düğümü taranır, efektif zemini alfa
   karışımıyla hesaplanır, punto/kalınlığa göre 4.5 veya 3.0 eşiğine vurulur.
   (Mutasyon 1: bir metin rengini AA altına çek → süpürme vakaları kırmızı.
    Mutasyon 2: PNG'yi temaya bağla → krem vakası kırmızı.) */
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc, ayarlarAc } = require('./yardim');

const BUGUN = bugunISO(), DUN = bugunISO(-1);
let sayac = 0;
function kitap(ek) {
  sayac++;
  return sahteKitap(Object.assign({ ad: 'Kitap ' + sayac, yazar: 'Yazar ' + sayac,
    yayinevi: 'Yayınevi', yil: 2020, sayfa: 300, tur: 'Roman', durum: 'bitti', puan: 8,
    baslamaTarihi: '2026-01-01', bitisTarihi: BUGUN, etiketler: ['etiket'], raf: 'A1' }, ek));
}
const OTURUM = Date.now() - 3 * 86400000;
function defter() {
  return [
    kitap({ ad: 'Tutunamayanlar', yazar: 'Oğuz Atay', puan: 10, sayfa: 724,
      notlar: [
        { id: 'n1', tip: 'alinti', metin: 'Ben buradayım sevgili okuyucum.', sayfa: 12,
          tarih: DUN, fikir: ['yalnızlık', 'ironi'], tekrarSonraki: BUGUN,
          tekrarAralik: 4, tekrarSayisi: 2 },
        { id: 'n2', tip: 'not', metin: 'Anlatıcının sesi değişiyor.', sayfa: 140,
          tarih: DUN, fikir: ['ironi'] }],
      oturumlar: [{ b: OTURUM, s: 3600000, sa: 0, sb: 60 }] }),
    kitap({ ad: 'Beş Şehir', yazar: 'Ahmet Hamdi Tanpınar', tur: 'Deneme', puan: 9, sayfa: 240,
      notlar: [{ id: 'n3', tip: 'alinti', metin: 'Zaman bir alışkanlıktır.', sayfa: 55,
        tarih: DUN, fikir: ['zaman', 'ironi'] }] }),
    kitap({ ad: 'Okunan Kitap', durum: 'okunuyor', guncelSayfa: 120, puan: null, bitisTarihi: null }),
    kitap({ ad: 'Yarım Kalan', durum: 'yarim', guncelSayfa: 80, puan: null, bitisTarihi: null }),
    kitap({ ad: 'Okunacak Kitap', durum: 'okunacak', puan: null, bitisTarihi: null })
  ];
}
function veriPaketi() {
  const y = new Date().getFullYear();
  return { kitaplar: defter(), hedef: { [y]: 10 }, hedefSayfa: { [y]: 3000 } };
}

/* GÖRÜNEN her metin düğümünü süpürür; eşiği geçemeyenleri döndürür. */
const SUPUR = () => {
  const COZ = z => {
    let m = String(z).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    m = String(z).match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
    if (m) return { r: 255 * +m[1], g: 255 * +m[2], b: 255 * +m[3], a: m[4] === undefined ? 1 : +m[4] };
    return null;
  };
  const L = c => { const f = v => { v /= 255;
    return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); };
    return .2126 * f(c.r) + .7152 * f(c.g) + .0722 * f(c.b); };
  const zeminBul = el => {
    let zemin = { r: 255, g: 255, b: 255 }, kat = [], p = el;
    while (p && p !== document.documentElement) {
      const c = COZ(getComputedStyle(p).backgroundColor);
      if (c && c.a > 0) { kat.push(c); if (c.a >= 1) break; }
      p = p.parentElement;
    }
    const kok = COZ(getComputedStyle(document.documentElement).backgroundColor);
    if (kok && kok.a >= 1) kat.push(kok);
    for (let i = kat.length - 1; i >= 0; i--) {
      const c = kat[i];
      zemin = { r: c.r * c.a + zemin.r * (1 - c.a), g: c.g * c.a + zemin.g * (1 - c.a),
        b: c.b * c.a + zemin.b * (1 - c.a) };
    }
    return zemin;
  };
  const gorunur = el => {
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none') return false;
    if (!el.offsetParent && s.position !== 'fixed') return false;
    let p = el;
    while (p) { const ps = getComputedStyle(p);
      if (parseFloat(ps.opacity) < 0.5) return false;
      if (p.hasAttribute && p.hasAttribute('inert')) return false;
      p = p.parentElement; }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const kacak = [];
  const yur = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let el;
  while ((el = yur.nextNode())) {
    if (['SCRIPT', 'STYLE', 'SVG', 'PATH', 'CIRCLE'].includes(el.tagName)) continue;
    const kendi = [...el.childNodes]
      .filter(x => x.nodeType === 3 && x.textContent.trim().length > 1)
      .map(x => x.textContent.trim()).join(' ');
    if (!kendi || !gorunur(el)) continue;
    const s = getComputedStyle(el);
    const metin = COZ(s.color);
    if (!metin || metin.a === 0) continue;
    const zemin = zeminBul(el);
    const ef = metin.a >= 1 ? metin : {
      r: metin.r * metin.a + zemin.r * (1 - metin.a),
      g: metin.g * metin.a + zemin.g * (1 - metin.a),
      b: metin.b * metin.a + zemin.b * (1 - metin.a) };
    const l1 = L(ef), l2 = L(zemin);
    const oran = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05);
    const px = parseFloat(s.fontSize), kalin = parseInt(s.fontWeight) >= 700;
    const esik = (px >= 24 || (px >= 18.66 && kalin)) ? 3.0 : 4.5;
    if (oran < esik) kacak.push((el.tagName + '.' + (typeof el.className === 'string'
      ? el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : ''))
      + ' "' + kendi.slice(0, 34) + '" ' + oran.toFixed(2) + '<' + esik);
  }
  return kacak;
};

async function gece(page, ek) {
  await tohumla(page, veriPaketi(), Object.assign({ kk_tema_v1: 'karanlik' }, ek || {}));
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-tema', 'karanlik');
}

/* ---- ekran ekran süpürme ---- */
const EKRANLAR = [
  ['Ana Sayfa', async p => { await p.click('nav [data-v="ana"]');
    await expect(p.locator('#panel-ana')).toBeVisible(); }],
  ['Kütüphane', async p => { await p.click('nav [data-v="raf"]');
    await expect(p.locator('#liste')).toBeVisible(); }],
  ['Keşfet', async p => { await p.click('nav [data-v="kesfet"]');
    await expect(p.locator('#ksIcerik .ks-ust')).toBeVisible(); }],
  ['Alıntılar', async p => { await p.click('nav [data-v="alinti"]');
    await expect(p.locator('#alBolumListe')).toBeVisible(); }],
  ['İstatistik', async p => { await p.click('nav [data-v="ist"]');
    await expect(p.locator('#rpKart')).toBeVisible(); }],
  ['Kitap detayı', async p => { await p.click('nav [data-v="raf"]');
    await p.locator('#liste .kart').first().click();
    await expect(p.locator('#ortuDetay')).toHaveClass(/acik/); }],
  ['Form penceresi', async p => { await p.click('nav [data-v="raf"]');
    await p.click('.fab'); await expect(p.locator('#ortuForm')).toHaveClass(/acik/); }],
  ['Ayarlar penceresi', async p => { await ayarlarAc(p);
    await p.click('#ayBolumTehlike summary'); }],
  ['Kart önizleme', async p => { await p.click('nav [data-v="alinti"]');
    await p.click('#alintiListe [data-act="alinti-kart"] >> nth=0');
    await expect(p.locator('#kartOrtu')).toHaveClass(/acik/); }]
];

test.describe('G49 Palet A Gece — karanlık tema', () => {

  for (const [ad, git] of EKRANLAR) {
    test(`karanlıkta TÜM metinler eşiği geçiyor — ${ad}`, async ({ page }) => {
      await gece(page);
      await git(page);
      await page.waitForTimeout(250);
      const kacak = await page.evaluate(SUPUR);
      expect(kacak, ad + ' kaçakları').toEqual([]);
    });
  }

  /* AÇIK TEMA KAÇAK GEÇMİŞİ: v57'de 7 seçili-durum yüzeyi AA altı ölçülmüştü
     (kök neden: `color:var(--accent)` + accent %7 tint zemini metne DOĞRU
     kayıyor, 4.61 → 4.23) ve BILINEN_ACIK listesiyle dondurulmuştu.
     v62'DE TAMAMI ONARILDI (Kaan'ın D3 emriyle): çip/düğme türevleri ks-chip
     reçetesine geçti (seçili metin --paper; seçililiği kontur + tint + ağırlık
     taşır), rozet/puan-mini/vm-rozet ise renk ANLAM taşıdığı için %86 renk +
     %14 paper KARIŞIMINA koyulaştırıldı (iki temada da AA — ölçümler g52'de).
     Bu vaka artık açık temada SIFIR kaçak bekler — yeni kaçak = kırmızı. */
  const ESKI_KACAKLAR = ['chip.active', 'mini-chip.secili', 'fa-cip.fa-secili',
    'durum-btn.secili', 'tm-dugme.tm-secili', 'rozet.r-', 'puan-mini'];

  test('AÇIK tema süpürmesi TEMİZ: v57 kaçakları onarıldı, yenisi yok', async ({ page }) => {
    await tohumla(page, veriPaketi(), { kk_tema_v1: 'acik' });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'acik');
    const kacaklar = [];
    for (const [ad, git] of EKRANLAR.slice(0, 5)) {
      await git(page);
      await page.waitForTimeout(200);
      (await page.evaluate(SUPUR)).forEach(k => kacaklar.push(ad + ' → ' + k));
    }
    expect(kacaklar, 'açık temada kaçak').toEqual([]);
  });

  test('aynı desen KARANLIKTA da güvenli: seçili çipler eşiği geçiyor', async ({ page }) => {
    await gece(page);
    await page.click('nav [data-v="raf"]');
    await expect(page.locator('#liste')).toBeVisible();
    const kacak = await page.evaluate(SUPUR);
    expect(kacak.filter(k => ESKI_KACAKLAR.some(b => k.includes(b))),
      'gece paletinde seçili-durum yüzeyleri temiz kalır').toEqual([]);
  });

  /* ---- palet sözleşmeleri ---- */
  test('gece tabanı: saf siyah DEĞİL, sıcak, yüzey düzeni açık temayla aynı yönde',
    async ({ page }) => {
      await gece(page);
      const p = await page.evaluate(() => {
        const k = getComputedStyle(document.documentElement);
        const al = ad => k.getPropertyValue(ad).trim();
        const rgb = h => { h = h.replace('#',''); return { r: parseInt(h.slice(0,2),16),
          g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) }; };
        const L = c => { const f = v => { v /= 255;
          return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
          return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b); };
        const bg = rgb(al('--bg')), s = rgb(al('--surface')), s2 = rgb(al('--surface2'));
        return { bg: al('--bg'), lum: L(bg), sicaklik: bg.r - bg.b,
          paperSicaklik: (c => c.r - c.b)(rgb(al('--paper'))),
          duzen: L(bg) < L(s2) && L(s2) < L(s) };
      });
      expect(p.lum, 'saf siyah değil').toBeGreaterThan(0.006);
      expect(p.lum, 'gece olarak yeterince koyu').toBeLessThan(0.030);
      expect(p.sicaklik, 'taban SICAK (nötr gri değil)').toBeGreaterThanOrEqual(6);
      expect(p.paperSicaklik, 'metin rengi de sıcak').toBeGreaterThanOrEqual(12);
      expect(p.duzen, 'bg < surface2 < surface (açık temayla aynı yön)').toBe(true);
    });

  test('grafik rolleri 3.0; ayraç görünür; kontrol konturu 3.0', async ({ page }) => {
    await gece(page);
    await rafAc(page);
    const o = await page.evaluate(() => {
      const L = c => { const f = v => { v /= 255;
        return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
        return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b); };
      /* Hesaplanmış renk rgb()/rgba() DIŞINDA da gelebilir (color(srgb …),
         currentcolor, anahtar sözcük) — çözülemeyen değeri null döndürüp
         çağıranda AÇIKÇA elemek, sessizce 0'a düşmekten iyidir. */
      const COZ = z => {
        let m = String(z).match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
        if (m) return { r:+m[1], g:+m[2], b:+m[3], a:m[4]===undefined?1:+m[4] };
        m = String(z).match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
        if (m) return { r:255*+m[1], g:255*+m[2], b:255*+m[3], a:m[4]===undefined?1:+m[4] };
        return null; };
      const kar = (u, z) => ({ r:u.r*u.a+z.r*(1-u.a), g:u.g*u.a+z.g*(1-u.a), b:u.b*u.a+z.b*(1-u.a) });
      const K = (a,b) => { const l1=L(a), l2=L(b);
        return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); };
      const oku = ad => { const p = document.createElement('span');
        p.style.color = getComputedStyle(document.documentElement).getPropertyValue(ad).trim();
        document.body.appendChild(p); const c = COZ(getComputedStyle(p).color); p.remove(); return c; };
      const bg = oku('--bg');
      const cizgiRenk = COZ(getComputedStyle(document.querySelector('.kt-bolum')).borderBottomColor);
      const konturEl = document.querySelector('#arama');
      const konturRenk = COZ(getComputedStyle(konturEl).borderTopColor);
      return {
        brassDim: K(oku('--brass-dim'), bg),
        cizgi: K(cizgiRenk.a < 1 ? kar(cizgiRenk, bg) : cizgiRenk, bg),
        kontur: K(konturRenk.a < 1 ? kar(konturRenk, bg) : konturRenk, bg)
      };
    });
    expect(o.brassDim, 'brass-dim grafik eşiği').toBeGreaterThanOrEqual(3.0);
    expect(o.cizgi, 'ayraç GÖRÜNÜR').toBeGreaterThanOrEqual(1.6);
    expect(o.cizgi, 'ayraç BAĞIRMIYOR (kıl payı kalıyor)').toBeLessThan(2.6);
    expect(o.kontur, 'kontrol konturu WCAG 1.4.11 (3:1)').toBeGreaterThanOrEqual(3.0);
  });

  test('kapaksız levha karanlıkta ayırt edilebilir (paspartu + kontur + kesikli çerçeve)',
    async ({ page }) => {
      await gece(page);
      await rafAc(page);
      const o = await page.evaluate(() => {
        const L = c => { const f = v => { v /= 255;
          return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
          return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b); };
        const COZ = z => { const m = String(z).match(
          /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
          return m ? { r:+m[1], g:+m[2], b:+m[3], a:m[4]===undefined?1:+m[4] } : null; };
        const kar = (u,z) => ({ r:u.r*u.a+z.r*(1-u.a), g:u.g*u.a+z.g*(1-u.a), b:u.b*u.a+z.b*(1-u.a) });
        const K = (a,b) => { const l1=L(a), l2=L(b);
          return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); };
        const lev = document.querySelector('#liste .plate');
        if (!lev) return null;
        const s = getComputedStyle(lev);
        const bg = COZ(getComputedStyle(document.body).backgroundColor);
        const mat = COZ(s.backgroundColor);
        /* outline-color / ::after border-color çözülemezse (currentcolor vb.)
           öğenin `color`'ına düşülür — kesikli çerçeve zaten currentColor. */
        const kontur = COZ(s.outlineColor) || COZ(s.color);
        const cerceve = COZ(getComputedStyle(lev, '::after').borderTopColor) || COZ(s.color);
        const cz = c => (c && c.a < 1) ? kar(c, bg) : c;
        return { kesikli: lev.classList.contains('p-bos'),
          matKontrast: mat && bg ? K(mat, bg) : null,
          konturKontrast: kontur && bg ? K(cz(kontur), bg) : null,
          cerceveKontrast: cerceve && mat
            ? K(cerceve.a < 1 ? kar(cerceve, mat) : cerceve, mat) : null,
          filtre: s.filter };
      });
      expect(o, 'levha bulunamadı').not.toBeNull();
      expect(o.kesikli, 'kapaksız levha p-bos').toBe(true);
      /* Paspartu tek başına düşük (açık temada da öyle) — levhanın KENARINI
         kontur çizer; kapak yokluğunu kesikli çerçeve söyler. İkisi de ölçülür. */
      expect(o.konturKontrast, 'levha konturu görünür').toBeGreaterThanOrEqual(1.6);
      expect(o.cerceveKontrast, 'kesikli çerçeve levha üstünde görünür')
        .toBeGreaterThanOrEqual(1.6);
      expect(o.filtre, 'sepya kimliği korunuyor (tema bağımsız)').toContain('sepia');
    });

  /* ---- tema mekaniği ---- */
  test('theme-color karanlıkta palet tabanıyla AYNI', async ({ page }) => {
    await gece(page);
    const meta = await page.getAttribute('#temaRengi', 'content');
    const bg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
    expect(meta).toBe('#1E1A15');
    expect(meta, 'meta ile --bg dikişsiz').toBe(bg);
  });

  test('"Sistem" seçiliyken prefers-color-scheme izlenir', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await tohumla(page, veriPaketi(), { kk_tema_v1: null });   // kalıcı tercih YOK
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'karanlik');
    expect(await page.getAttribute('#temaRengi', 'content')).toBe('#1E1A15');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(page.locator('html')).toHaveAttribute('data-tema', 'acik');
    expect(await page.getAttribute('#temaRengi', 'content')).toBe('#F2EFE7');
  });

  test('alıntı kartı PNG karanlıkta da KREM (tema bağımsız)', async ({ page }) => {
    await gece(page);
    await page.click('nav [data-v="alinti"]');
    await page.click('#alintiListe [data-act="alinti-kart"] >> nth=0');
    await expect(page.locator('#kartOrtu')).toHaveClass(/acik/);
    const z = await page.evaluate(() => {
      const t = document.getElementById('kartTuval');
      const d = t.getContext('2d').getImageData(4, 4, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2] };
    });
    expect(z, 'PNG zemini KREM').toEqual({ r: 245, g: 239, b: 227 });
  });

  test('Ciltli sözleşmeleri karanlıkta da geçerli: dolu düğme ve yuvarlak kart yok',
    async ({ page }) => {
      await gece(page);
      for (const [ad, git] of EKRANLAR.slice(0, 5)) {
        await git(page);
        await page.waitForTimeout(150);
        /* "Dolu düğme" ölçütü g36'nın yerleşik tanımıyla AYNI: yüzey
           belirteçlerine (bg/surface/surface2) YAKIN dolgu nötrdür ve sayılmaz
           — kapak levhası (.plate) bir <button> ama dolgusu kâğıt paspartudur,
           eylem dolgusu değil. Yalnız DOYGUN ya da KOYU dolgu kaçaktır. */
        const kacak = await page.evaluate(() => {
          const COZ = z => { const m = String(z).match(
            /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
            return m ? { r:+m[1], g:+m[2], b:+m[3], a:m[4]===undefined?1:+m[4] } : null; };
          const kok = getComputedStyle(document.documentElement);
          const notrler = ['--bg','--surface','--surface2'].map(v => {
            const p = document.createElement('div');
            p.style.color = kok.getPropertyValue(v).trim();
            document.body.appendChild(p);
            const c = COZ(getComputedStyle(p).color); p.remove(); return c; });
          const yakin = (a,b) => b && Math.abs(a.r-b.r)+Math.abs(a.g-b.g)+Math.abs(a.b-b.b) < 12;
          const doygun = c => { const mx = Math.max(c.r,c.g,c.b), mn = Math.min(c.r,c.g,c.b);
            return (mx - mn) > 40 || mx < 120; };
          const panel = document.querySelector('.panel.active');
          if (!panel) return ['aktif panel yok'];
          return [...panel.querySelectorAll('*')]
            .filter(el => el.offsetParent !== null && el.tagName !== 'INPUT')
            .filter(el => { const s = getComputedStyle(el);
              if ((parseFloat(s.borderRadius) || 0) > 7 || s.boxShadow !== 'none') return true;
              if (el.tagName !== 'BUTTON') return false;
              const c = COZ(s.backgroundColor);
              if (!c || c.a < 0.5) return false;
              if (notrler.some(n => yakin(c, n))) return false;   // kâğıt yüzey
              return doygun(c);
            })
            .map(el => el.tagName + '.' + (typeof el.className === 'string' ? el.className : ''));
        });
        expect(kacak, ad + ' (karanlık) Ciltli kaçağı').toEqual([]);
      }
    });
});
