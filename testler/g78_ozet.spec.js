'use strict';
/* G78 — KİTAP ÖZETİ alanı (v79).

   KAVRAM: özet, alıntı/nottan AYRI — onlar sayfa düzeyinde ve parçalı, özet
   kitabın BÜTÜNÜNE dair kullanıcı değerlendirmesi; tek kitap = tek özet.

   BU DOSYANIN KİLİTLEDİĞİ KARARLAR (gerekçeler index.html/senkron.js'te):
   - Veri: kitapNormalize.ozet + ozetG (alan damgası, gsG sınıfı);
     ANLIK_SURUM 11 (göç turu damga BASMAZ), SEMA_SURUM 3 (elle yazılan uzun
     metin — eski istemci budaması kalıcı emek kaybı olurdu).
   - Senkron: alan-LWW (kitap-LWW özeti ezemez) + ÇAKIŞMA EKİ (iki cihazda
     aynı kitaba yazılan iki özetten biri sessizce kaybolmaz) + kasıtlı silme
     (yeni damgalı boş) eski metni diriltmez.
   - Arayüz: detaydan DOĞRUDAN yazım (form açılmaz), "Özetin" kicker'ı,
     boşken bölüm yer kaplamaz (ince "+ Özetini yaz" ghost), >600 karakterde
     katlama; yazım k.g + k.ozetG damgası basar (yalnız değer değiştiyse).
   - Erişim: raf araması özet metninde de çalışır (saf süzgeç, sıralama
     etkilenmez); "Özetsiz" sanal çipi (puansiz emsali); istatistik köprüsü;
     md-hepsi'de "### Özet" bölümü (sadece-alıntılar SAF kalır); CSV "Özet"
     sütunu tam metin (RFC 4180 kaçışı, kırpma yok).
   - M4: "Sırayla özet" akışı (hızlı puanlamanın metin hali, zengin.js).
   (Mutasyon: ozet normalize'dan çıkar → kalıcılık vakaları kırmızı;
    md'den özet bloğu çıkar → markdown vakası kırmızı.) */
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc, rafaGec, ayarlarAc } = require('./yardim');

function bitmis(ek) {
  return sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30) }, ek));
}
async function detayAc(page, ad) {
  await page.click('#liste .kart:has-text("' + ad + '")');
  await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
}
/* birlestir SAF çağrı (g26 deseni) */
async function birlestirilmis(page, yerelK, uzakK) {
  return page.evaluate(([y, u]) => {
    const b = window.__senkron.birlestir(
      { kitaplar: [y], silinenler: {} }, { kitaplar: [u], silinenler: {} });
    return b.kitaplar[0];
  }, [yerelK, uzakK]);
}
/* dosyaIndir monkeypatch ile içerik yakalama (g62 CSV deseni) */
async function aktarimYakala(page, cagri) {
  return page.evaluate(fn => {
    const asil = window.dosyaIndir; let yakalanan = null;
    window.dosyaIndir = (icerik, ad) => { yakalanan = { icerik, ad }; };
    try{ new Function(fn)(); }finally{ window.dosyaIndir = asil; }
    return yakalanan;
  }, cagri);
}

test.describe('G78 özet — veri modeli + senkron', () => {

  test('(a) KALICILIK: ozet + ozetG yenilemede korunur (normalize budamaz)', async ({ page }) => {
    await tohumla(page, [bitmis({ ad: 'Varlık ve Zaman', ozet: 'Varoluş üzerine ana fikir.', ozetG: 1754000000123 })]);
    await rafAc(page);
    await page.reload();
    await rafaGec(page);
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.ozet).toBe('Varoluş üzerine ana fikir.');
    expect(k.ozetG).toBe(1754000000123);
  });

  test('(b) GÖÇ: eski ANLIK sürümüyle açılış damga BASMAZ; sürüm 11', async ({ page }) => {
    await tohumla(page, [bitmis({ ad: 'Göç Kitabı', g: 777, ozet: 'eski özet' })],
      { kk_senkron_anlik_v1: { s: 10, p: {} } });   // eski sürümlü iz deposu → göç turu
    await rafAc(page);
    const sonuc = await page.evaluate(() => {
      depoKaydet();   // sarmalanmış: damgala koşar; göç turunda yeniden damgalama YOK
      return { g: veri.kitaplar[0].g, surum: window.__senkron.ANLIK_SURUM,
        sema: window.__senkron.SEMA_SURUM };
    });
    expect(sonuc.g, 'göç turu tüm kütüphaneyi taze damgalamaz').toBe(777);
    expect(sonuc.surum).toBe(11);
    expect(sonuc.sema).toBe(3);
  });

  test('(c) SENKRON: kitap-LWW kazananı özetsiz olsa da yeni ozetG kazanır (alan damgası)', async ({ page }) => {
    await rafAc(page);
    // B cihazı SONRA puan verdi (kitap g=200 kazanır) ama özeti yok;
    // A'nın özeti alan damgasıyla yaşar — eski davranış spread ile ezerdi.
    const k = await birlestirilmis(page,
      { id: 'x', ad: 'K', g: 200, puan: 9, ozet: '', ozetG: 0 },
      { id: 'x', ad: 'K', g: 100, ozet: 'Emek ürünü özetim', ozetG: 150 });
    expect(k.puan).toBe(9);
    expect(k.ozet).toBe('Emek ürünü özetim');
    expect(k.ozetG).toBe(150);
  });

  test('(d) ÇAKIŞMA EKİ: iki cihazda iki FARKLI özet → ikisi de birleşik metinde, kayıp YOK', async ({ page }) => {
    await rafAc(page);
    const k = await birlestirilmis(page,
      { id: 'x', ad: 'K', g: 200, ozet: 'Yeni cihazın özeti', ozetG: 300 },
      { id: 'x', ad: 'K', g: 100, ozet: 'Eski cihazın özeti', ozetG: 250 });
    expect(k.ozet).toContain('Yeni cihazın özeti');
    expect(k.ozet).toContain('Eski cihazın özeti');
    expect(k.ozet.indexOf('Yeni cihazın özeti'), 'yeni damgalı önde').toBeLessThan(
      k.ozet.indexOf('Eski cihazın özeti'));
    expect(k.ozetG, 'ek üretilince taze damga (yakınsama)').toBeGreaterThan(300);
    // yakınsama: birleşik metinle ikinci tur EK ÜRETMEZ (metin alt-dize)
    const k2 = await birlestirilmis(page,
      { id: 'x', ad: 'K', g: 200, ozet: k.ozet, ozetG: k.ozetG },
      { id: 'x', ad: 'K', g: 100, ozet: 'Eski cihazın özeti', ozetG: 250 });
    expect(k2.ozet).toBe(k.ozet);
  });

  test('(e) KASITLI SİLME: yeni damgalı boş özet eski metni DİRİLTMEZ', async ({ page }) => {
    await rafAc(page);
    const k = await birlestirilmis(page,
      { id: 'x', ad: 'K', g: 200, ozet: '', ozetG: 300 },        // silme daha yeni
      { id: 'x', ad: 'K', g: 100, ozet: 'Silinen özet', ozetG: 250 });
    expect(k.ozet).toBe('');
    // iki taraf da DAMGASIZ (dış yedek) → dolu metin taşınır, silme iddiası yok
    const k2 = await birlestirilmis(page,
      { id: 'y', ad: 'K2', g: 200, ozet: '', ozetG: 0 },
      { id: 'y', ad: 'K2', g: 100, ozet: 'Dış yedekten metin', ozetG: 0 });
    expect(k2.ozet).toBe('Dış yedekten metin');
  });
});

test.describe('G78 özet — detay arayüzü', () => {

  test('(f) detaydan yazılır: form AÇILMAZ, kicker gelir, k.g + k.ozetG damgalanır', async ({ page }) => {
    await tohumla(page, [bitmis({ ad: 'Denemeler', g: 500 })]);
    await rafAc(page);
    await detayAc(page, 'Denemeler');
    // boşken: kicker YOK, ince ghost VAR
    await expect(page.locator('#dOzetBlok')).toHaveCount(0);
    await expect(page.locator('.oz-bos .oz-ghost')).toHaveText('+ Özetini yaz');
    await page.click('[data-act="oz-ac"]');
    await page.fill('#ozMetin', 'İnsan doğası üzerine kalıcı gözlemler.');
    await page.click('[data-act="oz-kaydet"]');
    await expect(page.locator('#dOzetBlok .kicker')).toHaveText('Özetin');
    await expect(page.locator('.oz-metin')).toContainText('İnsan doğası üzerine');
    await expect(page.locator('#ortuForm'), 'form hiç açılmadı').not.toHaveClass(/acik/);
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.ozet).toBe('İnsan doğası üzerine kalıcı gözlemler.');
    expect(k.ozetG, 'alan damgası basıldı').toBeGreaterThan(0);
    expect(k.g, 'kitap damgası tazelendi').toBeGreaterThan(500);
  });

  test('(g) düzenle + boşaltıp kaydet = silinir; bölüm ince ghost hâline döner', async ({ page }) => {
    await tohumla(page, [bitmis({ ad: 'Silinecek', ozet: 'eski metin', ozetG: 100 })]);
    await rafAc(page);
    await detayAc(page, 'Silinecek');
    await page.click('#dOzetBlok [data-act="oz-ac"]');
    await expect(page.locator('#ozMetin')).toHaveValue('eski metin');
    await page.fill('#ozMetin', '');
    await page.click('[data-act="oz-kaydet"]');
    await expect(page.locator('#dOzetBlok')).toHaveCount(0);
    await expect(page.locator('.oz-bos .oz-ghost')).toBeVisible();
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.ozet).toBe('');
    expect(k.ozetG, 'silme de kasıtlı yazımdır — damga basılır').toBeGreaterThan(100);
  });

  test('(h) uzun özet katlanır, "Devamını göster" tamamını açar', async ({ page }) => {
    const uzunMetin = 'Başlangıç cümlesi. ' + 'dolgu sözcük '.repeat(80) + 'SON İŞARET';
    await tohumla(page, [bitmis({ ad: 'Uzun Özetli', ozet: uzunMetin, ozetG: 100 })]);
    await rafAc(page);
    await detayAc(page, 'Uzun Özetli');
    await expect(page.locator('.oz-metin')).toContainText('Başlangıç cümlesi');
    await expect(page.locator('.oz-metin')).not.toContainText('SON İŞARET');
    await page.click('[data-act="oz-devam"]');
    await expect(page.locator('.oz-metin')).toContainText('SON İŞARET');
    await expect(page.locator('[data-act="oz-devam"]')).toHaveCount(0);
  });
});

test.describe('G78 özet — görünürlük ve erişim', () => {

  test('(i) raf araması özet metninde çalışır', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Bulantı', yazar: 'Sartre', ozet: 'Varoluşçuluk ve özgürlük üzerine.', ozetG: 100 }),
      bitmis({ ad: 'Başka Kitap', yazar: 'Biri' })]);
    await rafAc(page);
    await page.fill('#arama', 'varoluşçuluk');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste .kart')).toContainText('Bulantı');
  });

  test('(j) Özetsiz çipi süzer; istatistik köprüsü rafa süzgeçli götürür', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Özetli Kitap', ozet: 'var', ozetG: 100 }),
      bitmis({ ad: 'Özetsiz Kitap' }),
      sahteKitap({ ad: 'Okunacak Kitap', durum: 'okunacak' })]);
    await rafAc(page);
    await page.click('#durumChips .chip[data-v="ozetsiz"]');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste .kart')).toContainText('Özetsiz Kitap');
    // istatistik köprüsü (puansiz-git eşi)
    await page.click('nav [data-act="sekme"][data-v="ist"]');
    await expect(page.locator('#istOzet')).toContainText('1 bitmiş kitabında özetin var');
    await expect(page.locator('#istOzet')).toContainText('1 kitabın özeti yok');
    await page.click('#istOzet [data-act="ozetsiz-git"]');
    await expect(page.locator('#panel-raf')).toHaveClass(/active/);
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#durumChips .chip[data-v="ozetsiz"]')).toHaveClass(/active/);
  });

  test('(k) markdown: md-hepsi "### Özet" içerir, sadece-alıntılar SAF kalır, özetli-notsuz kitap dosyada', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Notsuz Ama Özetli', yazar: 'Yazar A', ozet: 'Kitabın ana fikri budur.', ozetG: 100 }),
      bitmis({ ad: 'Alıntılı Kitap', yazar: 'Yazar B',
        notlar: [{ id: 'n1', tip: 'alinti', metin: 'Bir alıntı.', tarih: '2026-01-01', sayfa: null, fikir: [], ng: 1 }] })]);
    await rafAc(page);
    const hepsi = await aktarimYakala(page, 'notlariMdAktar(false)');
    expect(hepsi.ad).toMatch(/^kitaplik-alinti-not-.*\.md$/);
    expect(hepsi.icerik).toContain('## Notsuz Ama Özetli — Yazar A');
    expect(hepsi.icerik).toContain('### Özet');
    expect(hepsi.icerik).toContain('Kitabın ana fikri budur.');
    expect(hepsi.icerik).toContain('1 özet');
    const alintilar = await aktarimYakala(page, 'notlariMdAktar(true)');
    expect(alintilar.icerik).not.toContain('### Özet');
    expect(alintilar.icerik).not.toContain('Kitabın ana fikri budur.');
  });

  test('(l) CSV: Özet sütunu var, çok satırlı metin tırnak içinde bozulmaz', async ({ page }) => {
    await tohumla(page, [bitmis({ ad: 'CSV Kitabı',
      ozet: 'İlk satır; noktalı virgüllü.\nİkinci satır "tırnaklı".', ozetG: 100 })]);
    await rafAc(page);
    const csv = await aktarimYakala(page, 'csvAktar()');
    const baslik = csv.icerik.replace(/^﻿/, '').split('\r\n')[0].split(';');
    expect(baslik[baslik.length - 1]).toBe('Özet');
    expect(csv.icerik).toContain('"İlk satır; noktalı virgüllü.\nİkinci satır ""tırnaklı""."');
  });

  test('(m) DEPO BÜTÇESİ: 240 dolu özetle gerçek yük yazılır; kota hatasında şerit çıkar (taklit)', async ({ page }) => {
    const kitaplar = Array.from({ length: 240 }, (_, i) =>
      bitmis({ ad: 'Kitap ' + i, ozet: ('Özet metni ' + i + ' — ').padEnd(2500, 'dolgu yazı '), ozetG: 100 + i }));
    await tohumla(page, kitaplar);
    await rafAc(page);
    const yuk = await page.evaluate(() => {
      depoKaydet();   // ~700 KB gerçek yük: kota DOLMAZ, yazım başarılı
      return { boyut: localStorage.getItem('kk_kitaplik_v1').length,
        seritAcik: document.getElementById('kotaUyari').classList.contains('acik') };
    });
    expect(yuk.boyut).toBeGreaterThan(500000);
    expect(yuk.seritAcik, 'gerçek yükte şerit YOK').toBe(false);
    // kota taklidi: depo anahtarına yazım fırlatır → şerit açılır (v17 mekanizması)
    const sonra = await page.evaluate(() => {
      const asil = Storage.prototype.setItem;
      Storage.prototype.setItem = function(k, v){
        if(k === 'kk_kitaplik_v1') throw new DOMException('taklit', 'QuotaExceededError');
        return asil.call(this, k, v);
      };
      const tamam = depoKaydet();
      Storage.prototype.setItem = asil;
      return { tamam, seritAcik: document.getElementById('kotaUyari').classList.contains('acik') };
    });
    expect(sonra.tamam).toBe(false);
    expect(sonra.seritAcik, 'kota şeridi açıldı').toBe(true);
  });
});

test.describe('G78 özet — sırayla yazma akışı (M4)', () => {

  async function akisAc(page) {
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="ist"]');
    await page.click('#istOzet [data-act="zg-ozetle"]');
    await expect(page.locator('#zgOzetOrtu')).toHaveClass(/acik/);
  }

  test('(n) akış: kaydet-ve-sonraki damgayla yazar, atla yazmaz, geri metni geri getirir, bitti ekranı', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Akış Bir', bitisTarihi: '2026-03-01', g: 10 }),
      bitmis({ ad: 'Akış İki', bitisTarihi: '2026-02-01', g: 10 })]);
    await akisAc(page);
    await expect(page.locator('.zg-sayac')).toHaveText('1 / 2');
    await expect(page.locator('.zg-kitap-ad')).toHaveText('Akış Bir');   // yeni bitten eskiye
    await page.fill('#zgOzMetin', 'Birinci kitabın özeti.');
    await page.click('[data-act="zg-oz-kaydet"]');
    await expect(page.locator('.zg-onay-metin')).toContainText('Akış Bir → kaydedildi');
    await expect(page.locator('.zg-kitap-ad')).toHaveText('Akış İki');
    // geri: bu-oturum yazdığım metin kutuya döner (düzeltilebilir)
    await page.click('[data-act="zg-oz-geri"]');
    await expect(page.locator('#zgOzMetin')).toHaveValue('Birinci kitabın özeti.');
    await page.click('[data-act="zg-oz-kaydet"]');   // değişmeden ilerle
    await page.click('[data-act="zg-oz-atla"]');     // ikinciyi atla — yazılmaz
    await expect(page.locator('#zgOzetOrtuGovde')).toContainText('Bitti — bu oturumda 2 kitap');
    const veriSon = await page.evaluate(() => veri.kitaplar.map(k => ({ ad: k.ad, ozet: k.ozet, ozetG: k.ozetG, g: k.g })));
    const bir = veriSon.find(k => k.ad === 'Akış Bir'), iki = veriSon.find(k => k.ad === 'Akış İki');
    expect(bir.ozet).toBe('Birinci kitabın özeti.');
    expect(bir.ozetG).toBeGreaterThan(0);
    expect(bir.g, 'kullanıcı eylemi damgası').toBeGreaterThan(10);
    expect(iki.ozet, 'atlanan kitaba yazılmaz').toBe('');
    // form hiç açılmadı (akış da form-suz)
    await expect(page.locator('#ortuForm')).not.toHaveClass(/acik/);
  });

  test('(o) akış kuyruğu yalnız özetsizler; hepsi bitince düğme dürüst mesaj verir', async ({ page }) => {
    await tohumla(page, [bitmis({ ad: 'Zaten Özetli', ozet: 'var', ozetG: 5 })]);
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="ist"]');
    // özetsiz kalmayınca köprünün "sırayla yaz" ayağı hiç ÇİZİLMEZ — dürüst durum satırı kalır
    await expect(page.locator('#istOzet')).toContainText('hepsinde özetin var');
    await expect(page.locator('#istOzet [data-act="zg-ozetle"]')).toHaveCount(0);
  });
});

/* ---- Ciltli + AA (g49/g77 SUPUR birebir kopyası — ölçüm aleti üretimle aynı) ---- */
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

test.describe('G78 özet — Ciltli sözleşmeleri', () => {

  for(const tema of ['acik', 'karanlik']){
    test(`(p) ${tema} temada özet bölümü + akış paneli AA; dolu düğme yok`, async ({ page }) => {
      await tohumla(page, [
        bitmis({ ad: 'Tema Kitabı', ozet: 'Kontrast ölçümü için dolu özet metni.', ozetG: 100 }),
        bitmis({ ad: 'Özetsiz Tema' })],
        { kk_tema_v1: tema });
      await rafAc(page);
      await expect(page.locator('html')).toHaveAttribute('data-tema', tema);
      await detayAc(page, 'Tema Kitabı');
      await page.waitForTimeout(250);
      expect(await page.evaluate(SUPUR), 'detay + özet bölümü AA').toEqual([]);
      // dolu düğme yok: özet bölümünün eylemleri şeffaf zeminli
      const dolu = await page.evaluate(() => {
        const alan = [...document.querySelectorAll('#dOzetBlok button, .oz-bos button')];
        return alan.filter(b => {
          const c = getComputedStyle(b).backgroundColor;
          return c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent';
        }).map(b => b.className);
      });
      expect(dolu, 'özet eylemlerinde dolu düğme yok').toEqual([]);
      // akış paneli aynı temada
      await page.click('#ortuDetay .sheet-kapat');
      await page.click('nav [data-act="sekme"][data-v="ist"]');
      await page.click('#istOzet [data-act="zg-ozetle"]');
      await expect(page.locator('#zgOzetOrtu')).toHaveClass(/acik/);
      await page.waitForTimeout(250);
      expect(await page.evaluate(SUPUR), 'sırayla özet paneli AA').toEqual([]);
    });
  }
});
