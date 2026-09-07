'use strict';
/* G107 — TİPOGRAFİ GENİŞLETMESİ (v114).

   v104'te Brewmaster'dan bilinçli SAPMALAR yapılmıştı; v105'te kapsam tüm
   uygulamaya açılınca bir kısmının gerekçesi geçersiz kaldı. v114 listeyi
   yeniden gözden geçirip dördünü aldı, beşini gerekçesiyle reddetti.

   ALINANLAR (bu grup onları donduruyor):
   1. Okuma harf aralığı (`ls`) — WCAG 1.4.12 metin aralığı ölçütünün dördüncü
      kaldıracı; v104'te lh + pb alınmış, bu gerekçesiz atlanmıştı.
   2. BAŞLIK KATMANI — boyut/ağırlık/harf aralığı. AİLE DEĞİL: --serif
      (Cormorant) kimliktir, kullanıcıya açılmaz (Kaan kararı, v114'te teyit).
      Katmanın sınırı: Cormorant ile dizilen ve ≥1rem olan yüzeyler.
   3. SIFIR BAYT font seçenekleri (Geniş / Eski stil) — sistem yığınları,
      diske dosya EKLENMEDİ. Brewmaster 190 ad için 415 woff2 / 11 MB taşıyor;
      Pinakes'in tüm font yükü 156 KB.
   4. HAZIR AYARLAR — Brewmaster'ın 5 teması FONT EŞLEŞTİRMESİ (orada 190 aile
      var, burada 2). Buradaki karşılığı OKUMA DURUMU: 3 ayar + Varsayılan.

   REDDEDİLENLER (gerekçeleri v114 raporunda; burada yalnız SONUÇ dondurulur):
   BÜYÜK HARF · küçük kapiteller · gövde italiği · renk seçici · hizalı rakam.

   PANEL DÜZENİ: eksen 5→9 çıkarken bölüm KISALDI (1041px → 588px), çünkü
   eksenler "İnce ayar" kapağının arkasına girdi ve katman çubuğuyla ikiye
   bölündü. Boyut ve aile katmana ait DEĞİL — çubuğun üstünde sabit.
   ÖNİZLEME TAVANI 368px (Kaan'ın şartı) — bu grup onu bekçiliyor.

   (Mutasyon 1: ls jetonu okuma yüzeyinden çıkarılır → (b) kırmızı.
    Mutasyon 2: başlık jetonu bir kuraldan düşer → (d) kırmızı.
    Mutasyon 3: hazır ayar birleştirir (değiştirmez) → (g) kırmızı.
    Mutasyon 4: eksenler kapak dışına çıkar → (i) kırmızı.
    Mutasyon 5: önizlemeye blok eklenir → (j) kırmızı.) */

const { test, expect, tohumla, sahteKitap, rafAc, ayarlarAc, gruplariAc } = require('./yardim');

const KITAP = () => sahteKitap({ ad: 'Ölçüm Kitabı', yazar: 'Yazar', durum: 'bitti', puan: 9,
  notlar: [{ id: 'g107n1', tip: 'alinti', metin: 'Bir alıntı.', sayfa: 12, fikir: [] },
           { id: 'g107n2', tip: 'not', metin: 'Bir not.', sayfa: null, fikir: [] }] });

async function panelAc(page) {
  await tohumla(page, [KITAP()]);
  await rafAc(page);
  await ayarlarAc(page);
  await gruplariAc(page);
}
async function inceAc(page) {
  await page.evaluate(() => { document.getElementById('tpInce').open = true; });
}
const px = (page, sec, ozellik) =>
  page.evaluate(([s, o]) => {
    const e = document.querySelector(s);
    return e ? getComputedStyle(e)[o] : null;
  }, [sec, ozellik]);
const yuk = (page, sec) =>
  page.evaluate(s => { const e = document.querySelector(s);
    return e ? Math.round(e.getBoundingClientRect().height) : null; }, sec);

test.describe('G107 alınan eksenler', () => {

  test('(a) dokuz eksen: 2 genel + 4 okuma + 3 başlık', async ({ page }) => {
    await panelAc(page);
    await inceAc(page);
    const d = await page.evaluate(() => {
      const S = window.TIPO_SECENEK;
      return { genel: Object.keys(S).filter(k => !S[k].kat),
        oku: Object.keys(S).filter(k => S[k].kat === 'oku'),
        bas: Object.keys(S).filter(k => S[k].kat === 'bas') };
    });
    expect(d.genel, 'boyut ve aile katmana AİT DEĞİL — ikisi de uygulama geneli')
      .toEqual(['fs', 'font']);
    expect(d.oku).toEqual(['lh', 'pb', 'olcu', 'ls']);
    expect(d.bas).toEqual(['bas', 'basfw', 'basls']);
  });

  test('(b) okuma harf aralığı DÖRT okuma yüzeyine iner, arayüze inmez', async ({ page }) => {
    await tohumla(page, [KITAP()]);
    await rafAc(page);
    await page.evaluate(() => window.tipografiYaz('ls', '.05em'));
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    /* Okuma yüzeyleri: liste notu + günün notu (ikisi de bu ekranda). */
    expect(await px(page, '#alintiListe .not-metin', 'letterSpacing')).not.toBe('normal');
    expect(await px(page, '#alBolumGunun .ga-metin', 'letterSpacing')).not.toBe('normal');
    /* v113'te eklenen Favoriler yüzeyi de okuma jetonlarını almalı — v114'e
       kadar ALMIYORDU (bağlanmamıştı, kusur). */
    await page.locator('#alintiListe .not-kart').first().locator('.fv-yildiz').click();
    expect(await px(page, '#alBolumFavori .fvb-metin', 'letterSpacing'),
      'Favoriler bölümü tipografiye sağır kalmamalı').not.toBe('normal');
    /* Arayüz: sekme çubuğu etiketi kendi .05em'inde kalır, okuma ekseni ona inmez */
    const nav = await px(page, '.nav-btn', 'letterSpacing');
    await page.evaluate(() => window.tipografiYaz('ls', null));
    expect(await px(page, '.nav-btn', 'letterSpacing'), 'nav okuma ekseninden etkilenmez').toBe(nav);
  });

  test('(c) gövdeye AĞIRLIK ekseni YOK — Lora diskte yalnız 400', async ({ page }) => {
    await panelAc(page);
    const d = await page.evaluate(() => Object.keys(window.TIPO_SECENEK));
    expect(d, 'gövde ağırlığı taklit kalın üretirdi').not.toContain('fw');
    expect(d, 'başlık ağırlığı VAR — Cormorant 400-600 gerçek kesim').toContain('basfw');
  });

});

test.describe('G107 başlık katmanı', () => {

  test('(d) başlık boyutu ekran başlıklarını büyütür, gövdeye DOKUNMAZ', async ({ page }) => {
    await tohumla(page, [KITAP()]);
    await rafAc(page);
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    const oku = s => page.evaluate(x => parseFloat(getComputedStyle(document.querySelector(x)).fontSize), s);
    const basOnce = await oku('.al-baslik'), govdeOnce = await oku('#alintiListe .not-metin');
    await page.evaluate(() => window.tipografiYaz('bas', 1.12));
    const basSonra = await oku('.al-baslik'), govdeSonra = await oku('#alintiListe .not-metin');
    expect(basSonra / basOnce, 'başlık 1.12 kat').toBeCloseTo(1.12, 2);
    expect(govdeSonra, 'gövde kıpırdamaz').toBeCloseTo(govdeOnce, 1);
  });

  test('(e) AİLE kilitli: başlık ekseni Cormorant\'ı değiştirmez', async ({ page }) => {
    await panelAc(page);
    await inceAc(page);
    const d = await page.evaluate(() => Object.keys(window.TIPO_SECENEK)
      .filter(k => window.TIPO_SECENEK[k].kat === 'bas'));
    expect(d, 'başlık ailesi kullanıcıya açılmaz — kimlik').not.toContain('basfont');
    const aile = await px(page, '.ay-baslik', 'fontFamily');
    await page.evaluate(() => window.tipografiYaz('font', 'sistem'));
    expect(await px(page, '.ay-baslik', 'fontFamily'),
      'gövde ailesi değişse de başlık Cormorant kalır').toBe(aile);
  });

  test('(f) sabit kutudaki Cormorant yüzeyler katman DIŞINDA (taşma koruması)',
    async ({ page }) => {
      await tohumla(page, [KITAP()]);
      await rafAc(page);
      const fabOnce = await px(page, '.fab', 'fontSize');
      await page.evaluate(() => window.tipografiYaz('bas', 1.12));
      expect(await px(page, '.fab', 'fontSize'),
        '54px sabit diskteki "+" glifi büyümez').toBe(fabOnce);
      /* Kural mekanik ve denetlenebilir: --serif kullanan ve ≥1rem olan her
         kural jetonu TAŞIMALI; altındakiler taşımamalı. */
      const kacak = await page.evaluate(() => {
        const css = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } })
          .filter(r => r.style && r.style.fontFamily && r.style.fontFamily.includes('--serif'));
        return css.filter(r => {
          const fs = r.style.fontSize || '';
          const m = fs.match(/([0-9.]+)rem/);
          if (!m || parseFloat(m[1]) < 1) return false;
          if (r.selectorText.indexOf('.fab') === 0) return false;
          if (r.selectorText.indexOf('.tp-on-baslik') === 0) return false;
          return fs.indexOf('--tipo-bas') === -1;
        }).map(r => r.selectorText);
      });
      expect(kacak, 'jetonsuz kalan başlık kuralı (yüklü CSS) yok').toEqual([]);
      /* ÇALIŞMA-ANI TARAMASI YETMEZ: eklentilerin bir kısmı CSS'ini panel
         açılınca enjekte eder (rapor.js, zeka.js), yani açılışta yüklü
         değildir. İlk koşumda tam bu yüzden .ks-ad/.ks-b-ad/.zk-buyuk
         gözden kaçtı. Kaynak dosyaları STATİK de taranır. */
      const fs = require('fs'), yol = require('path');
      const kok = yol.join(__dirname, '..');
      const statik = [];
      for (const d of fs.readdirSync(kok).filter(x => x.endsWith('.js'))) {
        const m = fs.readFileSync(yol.join(kok, d), 'utf8');
        const re = /font-size:([0-9.]+)rem/g;
        let x;
        while ((x = re.exec(m))) {
          if (parseFloat(x[1]) < 1) continue;
          const bas = m.lastIndexOf('{', x.index), son = m.indexOf('}', x.index);
          if (bas < 0 || son < 0) continue;
          const govde = m.slice(bas, son);
          if (govde.indexOf('var(--serif)') === -1) continue;
          if (govde.indexOf('--tipo-bas') !== -1) continue;
          statik.push(d + ' @ ' + x[1] + 'rem');
        }
      }
      expect(statik, 'eklenti kaynaklarında jetonsuz başlık kuralı yok').toEqual([]);
    });

});

test.describe('G107 hazır ayarlar', () => {

  test('(g) hazır ayar TAM DEĞİŞTİRİR, birleştirmez', async ({ page }) => {
    await panelAc(page);
    const d = await page.evaluate(() => {
      window.tipografiTema('yogun');
      const yogun = window.tipografiOku();
      window.tipografiTema('uzun');
      return { yogun, sonra: window.tipografiOku() };
    });
    expect(d.yogun.fs, 'Yoğun küçültür').toBe(0.92);
    expect(d.sonra.fs, 'Uzun okuma boyuta dokunmaz — melez kalmaz').toBeUndefined();
    expect(d.sonra).toEqual({ lh: 1.12, pb: '1.5em', olcu: '42em' });
  });

  test('(h) üç hazır ayar + Varsayılan; hepsi doğrulama kapısından geçer', async ({ page }) => {
    await panelAc(page);
    await expect(page.locator('#tpTema button')).toHaveCount(4);
    await expect(page.locator('#tpTema [data-act="tp-sifirla"]')).toHaveText('Varsayılan');
    const gecersiz = await page.evaluate(() => {
      const S = window.TIPO_SECENEK, T = window.TIPO_TEMA, hata = [];
      for (const ad in T) for (const k in T[ad]) {
        const o = S[k];
        if (!o || !o.secim.some(c => c.v === T[ad][k])) hata.push(ad + '.' + k);
      }
      return hata;
    });
    expect(gecersiz, 'hazır ayarların her değeri SECENEK tablosunda var').toEqual([]);
    await page.click('#tpTema [data-act="tp-tema"][data-v="yorgun"]');
    await expect(page.locator('#tpTema [data-v="yorgun"]')).toHaveAttribute('aria-pressed', 'true');
    await page.click('#tpTema [data-act="tp-sifirla"]');
    expect(await page.evaluate(() => localStorage.getItem('kk_tipografi_v1')),
      'Varsayılan anahtarı SİLER, {} bırakmaz').toBeNull();
  });

});

test.describe('G107 panel düzeni', () => {

  test('(i) eksenler KATLI gelir; katman çubuğu okuma/başlık ayırır', async ({ page }) => {
    await panelAc(page);
    await expect(page.locator('#tpTema button').first(), 'hazır ayar açıkta').toBeVisible();
    await expect(page.locator('#tpOnizleme'), 'önizleme açıkta').toBeVisible();
    await expect(page.locator('#tpKontrol .tp-chip').first(), 'eksenler KAPALI').toBeHidden();
    await inceAc(page);
    /* Boyut ve aile çubuğun ÜSTÜNDE, katmandan bağımsız */
    await expect(page.locator('#tpGlobal .tp-satir')).toHaveCount(2);
    await expect(page.locator('#tpKontrol .tp-satir')).toHaveCount(4);   // okuma
    await page.click('[data-act="tp-katman"][data-v="bas"]');
    await expect(page.locator('#tpKontrol .tp-satir')).toHaveCount(3);   // başlık
    await expect(page.locator('#tpGlobal .tp-satir'), 'genel eksenler katman değişince DURUR')
      .toHaveCount(2);
    /* Katman çubuğu yalnız ÇİZİMİ değiştirir, ayara dokunmaz */
    expect(await page.evaluate(() => localStorage.getItem('kk_tipografi_v1'))).toBeNull();
  });

  test('(j) ÖNİZLEME TAVANI 368px ve bölüm kapalıyken tek ekrandan kısa', async ({ page }) => {
    await panelAc(page);
    const onizleme = await yuk(page, '#tpOnizleme');
    const bolum = await yuk(page, '#ayBolumTipografi');
    const ekran = await page.evaluate(() => window.innerHeight);
    /* Kaan'ın şartı: önizleme panelin en büyük bloğu ve büyümeye en açık yeri. */
    expect(onizleme, 'önizleme 368px tavanını aşmaz').toBeLessThanOrEqual(368);
    expect(bolum, 'kapalı bölüm tek ekrandan kısa (v104-v113: 1041px = 1,45 ekran)')
      .toBeLessThan(ekran);
  });

  test('(k) önizleme menü şeridi sekme çubuğunun ÇEYREK sönümünü gösterir', async ({ page }) => {
    await panelAc(page);
    await expect(page.locator('#tpOnizleme .tp-on-nav')).toHaveCount(5);
    const once = await px(page, '#tpOnizleme .tp-on-nav', 'fontSize');
    const navOnce = await px(page, '.nav-btn', 'fontSize');
    await page.evaluate(() => window.tipografiYaz('fs', 1.25));
    const sonra = parseFloat(await px(page, '#tpOnizleme .tp-on-nav', 'fontSize'));
    const navSonra = parseFloat(await px(page, '.nav-btn', 'fontSize'));
    /* Şerit gerçek nav ile AYNI oranda hareket etmeli — yoksa gösterdiği şey
       yalan olur (v105'in üç kademesi: okuma tam, arayüz yarı, nav çeyrek). */
    expect(sonra / parseFloat(once)).toBeCloseTo(navSonra / parseFloat(navOnce), 3);
    expect(sonra / parseFloat(once), 'çeyrek kazanç, tam değil').toBeLessThan(1.25);
  });

});

test.describe('G107 taşma kalkanı', () => {

  test('(n) 320px + en geniş aile + en büyük boyut: sekme çubuğu TAŞMAZ',
    async ({ page }) => {
      await tohumla(page, [KITAP()]);
      await rafAc(page);
      await page.setViewportSize({ width: 320, height: 720 });
      /* ÖLÇÜM (v114 taraması): fs=1.25 TEK başına sığıyor, geniş aile TEK
         başına sığıyor, ama İKİSİ BİRLİKTE taşıyordu (genis/eski 324px,
         georgia 321px). georgia v104'ten beri seçeneklerde — yani bu kusur
         v114'ün getirdiği değil, ağır-ayar taramasının ortaya çıkardığı eski
         bir kusur. Çeyrek sönüm SAYIYI küçültür ama aİLE GENİŞLİĞİNİ
         sönümleyemez; çare taşma DAVRANIŞINDA (min-width:0 + ellipsis). */
      for (const [aile, boyut] of [[null, null], ['genis', 1.25], ['georgia', 1.25], ['eski', 1.25]]) {
        await page.evaluate(() => window.tipografiSifirla());
        if (aile) await page.evaluate(x => window.tipografiYaz('font', x), aile);
        if (boyut) await page.evaluate(x => window.tipografiYaz('fs', x), boyut);
        const d = await page.evaluate(() => {
          const n = document.querySelector('nav');
          return { sw: n.scrollWidth, cw: n.clientWidth,
            son: Math.round(document.querySelectorAll('.nav-btn')[4].getBoundingClientRect().right) };
        });
        expect(d.sw, (aile || 'varsayılan') + ': çubuk taşmaz').toBeLessThanOrEqual(d.cw);
        expect(d.son, (aile || 'varsayılan') + ': son sekme kesilmez').toBeLessThanOrEqual(320);
      }
    });

});

test.describe('G107 alınmayanlar (karar dondurma)', () => {

  test('(l) BÜYÜK HARF, kapiteller, gövde italiği, renk, hizalı rakam YOK', async ({ page }) => {
    await panelAc(page);
    const k = await page.evaluate(() => Object.keys(window.TIPO_SECENEK));
    for (const yasak of ['tt', 'fvc', 'fst', 'col', 'fvn'])
      expect(k, yasak + ' bilinçli olarak alınmadı').not.toContain(yasak);
    /* Harf dönüşümü olmadığı için belge dili TÜRKÇE kalır — Brewmaster
       lang="und" kaçamağına mecbur kalmıştı (noktalı İ italik sentezleniyor). */
    expect(await page.evaluate(() => document.documentElement.lang)).toBe('tr');
  });

  test('(m) font seçenekleri SIFIR BAYT: diske woff2 eklenmedi', async ({ page }) => {
    await panelAc(page);
    const d = await page.evaluate(() => {
      const font = window.TIPO_SECENEK.font;
      const yuzler = [...document.styleSheets]
        .flatMap(s => { try { return [...s.cssRules]; } catch (e) { return []; } })
        .filter(r => r.constructor.name === 'CSSFontFaceRule')
        .map(r => r.style.fontFamily.replace(/['"]/g, ''));
      return { secenek: font.secim.length, aile: [...new Set(yuzler)].sort() };
    });
    expect(d.secenek, 'altı seçenek').toBe(6);
    expect(d.aile, 'diskte yalnız iki aile — yeni seçenekler sistem yığını')
      .toEqual(['Cormorant Garamond', 'Lora']);
  });

});
