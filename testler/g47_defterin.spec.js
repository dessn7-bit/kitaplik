'use strict';
/* G47 — Alıntılar ekranı "Defterin" (v55 Ciltli). Ciltli dönüşümünün SON ekranı.
   ÖNCE: degradeli/gölgeli günün-alıntısı kutusu, gölgeli tekrar kartı, dolu
   düğme yığını ("Devam etsin" altın dolgu), 999px dolu rozet, fikir ağı kutu
   kartları + dolu çipler + hap çubuklar; fikir bulutu ve ağ paneli kendilerini
   "arama girdisinden önce"ye sokuyordu (konum kırılgan, bölüm başlığı yok).

   SONRA: ekran başlığı + 4 bölüm, kıl payı ayraçlarla ve kicker'larla:
   tekrar → günün alıntısı → fikirler → alıntılar ve notlar.

   TİPOGRAFİ KİLİDİ: alıntı gövdesi LORA İTALİK. Cormorant'ın italik yüzü
   GÖMÜLÜ DEĞİL (@font-face yalnız font-style:normal); --serif + italic
   yazılsaydı tarayıcı sahte-eğik üretirdi. Aşağıdaki vaka bunu dondurur.
   (Mutasyon 1: bir bölümü kaldır → varlık vakası kırmızı.
    Mutasyon 2: PNG zeminini temaya bağla → krem vakası kırmızı.) */
const { test, expect, tohumla, sahteKitap, bugunISO } = require('./yardim');

const BUGUN = bugunISO(), DUN = bugunISO(-1);
let sayac = 0;
function alinti(metin, ek) {
  sayac++;
  return Object.assign({ id: 'n' + sayac, tip: 'alinti', metin, sayfa: 10 * sayac,
    tarih: DUN, fikir: [] }, ek || {});
}
function not_(metin, ek) {
  sayac++;
  return Object.assign({ id: 'n' + sayac, tip: 'not', metin, sayfa: null,
    tarih: DUN, fikir: [] }, ek || {});
}
/* Zengin fikstür: iki kitap, tekrar zamanı gelmiş 1 alıntı, düz not, ve
   fikirag.js'in ESIK=2 eş-geçim eşiğini GEÇEN bir çift ("yalnızlık"+"ironi"
   iki ayrı notta birlikte). "yalnızlık" üç notta → kesişim (2) filtreden (3)
   daha dar; süzme gerçekten ölçülebiliyor. */
function defter() {
  return [
    sahteKitap({ ad: 'Tutunamayanlar', yazar: 'Oğuz Atay', durum: 'bitti', puan: 10,
      bitisTarihi: BUGUN, notlar: [
        alinti('Ben buradayım sevgili okuyucum, sen neredesin acaba?',
          { fikir: ['yalnızlık', 'ironi'], tekrarSonraki: BUGUN, tekrarAralik: 4, tekrarSayisi: 2 }),
        alinti('İnsan kendisine yabancılaştığı ölçüde kalabalıklaşır.',
          { fikir: ['yalnızlık', 'ironi'] }),
        not_('Anlatıcının sesi ikinci bölümde değişiyor.', { fikir: ['ironi'] })
      ] }),
    sahteKitap({ ad: 'Saatleri Ayarlama Enstitüsü', yazar: 'Ahmet Hamdi Tanpınar',
      durum: 'bitti', puan: 9, bitisTarihi: BUGUN, notlar: [
        alinti('Hiçbir şey bir zamanı o zamanın kendisi kadar iyi anlatamaz.',
          { fikir: ['zaman', 'ironi'] }),
        alinti('Saat kendi başına bir ölçü değil bir alışkanlıktır.',
          { fikir: ['zaman', 'yalnızlık'] })
      ] })
  ];
}
async function alintiAc(page, kitaplar) {
  await tohumla(page, kitaplar || defter());
  await page.goto('/');
  await page.click('nav [data-act="sekme"][data-v="alinti"]');
  await expect(page.locator('#alBolumListe')).toBeVisible();
}
async function kontrast(page, metinSec, zeminSec) {
  return page.evaluate(([ms, zs]) => {
    const COZ = z => {
      let m = z.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
      m = z.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\)/);
      if (m) return { r: 255 * +m[1], g: 255 * +m[2], b: 255 * +m[3], a: m[4] === undefined ? 1 : +m[4] };
      return { r: 0, g: 0, b: 0, a: 1 };
    };
    const me = document.querySelector(ms), ze = document.querySelector(zs || ms);
    if (!me || !ze) return null;
    const metin = COZ(getComputedStyle(me).color);
    let zemin = { r: 255, g: 255, b: 255 }, kat = [], p = ze;
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
  }, [metinSec, zeminSec]);
}

test.describe('G47 Defterin — Alıntılar ekranı Ciltli', () => {

  /* ---------- dil ---------- */
  test('kutu dili YOK: yuvarlak köşe, gölge, degrade kalmadı', async ({ page }) => {
    await alintiAc(page);
    const kacaklar = await page.evaluate(() =>
      [...document.querySelectorAll('#panel-alinti *')]
        .filter(el => el.offsetParent !== null && el.tagName !== 'INPUT')
        .map(el => { const c = getComputedStyle(el);
          return { et: el.tagName + '.' + (el.className || ''), r: parseFloat(c.borderRadius) || 0,
            golge: c.boxShadow, gorsel: c.backgroundImage }; })
        .filter(o => o.r > 7 || o.golge !== 'none' || o.gorsel !== 'none'));
    expect(kacaklar).toEqual([]);
  });

  test('görünür DOLU düğme yok (tekrar eylemleri ince metin)', async ({ page }) => {
    await alintiAc(page);
    const dolular = await page.evaluate(() => {
      const A = z => { const m = z.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
        return m ? (m[4] === undefined ? 1 : +m[4]) : 0; };
      return [...document.querySelectorAll('#panel-alinti button')]
        .filter(el => el.offsetParent !== null && A(getComputedStyle(el).backgroundColor) >= 0.5)
        .map(el => el.textContent.trim().slice(0, 30));
    });
    expect(dolular).toEqual([]);
    // "Devam etsin" artık kontursuz metin eylemi: kenarlığı yok
    const b = await page.evaluate(() => {
      const el = document.querySelector('.tk-btn-birincil');
      const c = getComputedStyle(el);
      return { kenar: c.borderTopWidth, zemin: c.backgroundColor, r: c.borderRadius };
    });
    expect(b.kenar).toBe('0px');
    expect(b.r).toBe('0px');
  });

  test('kicker etiketleri altın + BÜYÜK HARF', async ({ page }) => {
    await alintiAc(page);
    const k = await page.evaluate(() => {
      const p = document.createElement('span');
      p.style.color = getComputedStyle(document.documentElement).getPropertyValue('--brass').trim();
      document.body.appendChild(p);
      const altin = getComputedStyle(p).color;
      p.remove();
      return [...document.querySelectorAll('#panel-alinti .kicker')].map(el => {
        const c = getComputedStyle(el);
        return { metin: el.textContent, versal: c.textTransform,
          aralik: parseFloat(c.letterSpacing), altin: c.color === altin };
      });
    });
    expect(k.length, 'tekrar + 3 bölüm kicker\'ı').toBeGreaterThanOrEqual(4);
    for (const x of k) {
      expect(x.versal, x.metin).toBe('uppercase');
      expect(x.aralik, x.metin + ' harf aralığı').toBeGreaterThan(0.5);
      expect(x.altin, x.metin + ' altın').toBe(true);
    }
  });

  test('TİPOGRAFİ: alıntı gövdesi GERÇEK italik Lora (Cormorant italik gömülü değil)',
    async ({ page }) => {
      await alintiAc(page);
      const f = await page.evaluate(() => {
        const oku = s => { const c = getComputedStyle(document.querySelector(s));
          return { aile: c.fontFamily, stil: c.fontStyle }; };
        // gömülü yüzler: Cormorant YALNIZ normal, Lora normal + italic
        const yuzler = [...document.styleSheets].flatMap(ss => {
          try { return [...ss.cssRules]; } catch (e) { return []; } })
          .filter(r => r.constructor.name === 'CSSFontFaceRule')
          .map(r => r.style.getPropertyValue('font-family').replace(/['"]/g, '')
            + '|' + r.style.getPropertyValue('font-style'));
        return { gunun: oku('.ga-metin'), tekrar: oku('.tk-metin'),
          liste: oku('.not-kart.alinti .not-metin'), baslik: oku('.al-baslik'), yuzler };
      });
      for (const [ad, o] of [['günün', f.gunun], ['tekrar', f.tekrar], ['liste', f.liste]]) {
        expect(o.stil, ad + ' alıntısı italik').toBe('italic');
        expect(o.aile, ad + ' alıntısı Lora').toMatch(/Lora/);
        expect(o.aile, ad + ' alıntısı Cormorant DEĞİL').not.toMatch(/Cormorant/);
      }
      // ekran başlığı Cormorant DÜZ
      expect(f.baslik.aile).toMatch(/Cormorant/);
      expect(f.baslik.stil).toBe('normal');
      // kararın dayanağı: Cormorant'ın italik yüzü yok
      expect(f.yuzler.some(y => /Cormorant/.test(y) && /italic/.test(y)),
        'Cormorant italik GÖMÜLÜ OLSAYDI karar yeniden değerlendirilmeli').toBe(false);
      expect(f.yuzler.some(y => /Lora/.test(y) && /italic/.test(y)),
        'Lora italik gömülü').toBe(true);
    });

  /* ---------- hiyerarşi ---------- */
  test('HİYERARŞİ: tekrar en üstte, sonra günün alıntısı → fikirler → liste', async ({ page }) => {
    await alintiAc(page);
    const sira = await page.evaluate(() => {
      const kok = document.querySelector('#panel-alinti .alinti-wrap');
      const y = el => el.getBoundingClientRect().top;
      return { ust: y(kok.querySelector('.al-ust')), tekrar: y(document.getElementById('tkKutu')),
        gunun: y(document.getElementById('alBolumGunun')),
        fikir: y(document.getElementById('alBolumFikir')),
        liste: y(document.getElementById('alBolumListe')) };
    });
    expect(sira.ust).toBeLessThan(sira.tekrar);
    expect(sira.tekrar).toBeLessThan(sira.gunun);
    expect(sira.gunun).toBeLessThan(sira.fikir);
    expect(sira.fikir).toBeLessThan(sira.liste);
    // eklentiler kendi yuvasında (ekran sonuna yığılmıyor)
    await expect(page.locator('#alYuvaFikir #fikirBulut')).toHaveCount(1);
    await expect(page.locator('#alYuvaFikirAg #faPanel')).toHaveCount(1);
  });

  /* tohumla YALNIZ ilk yüklemede yazar (__kk_tohumlandi bayrağı) — iki farklı
     kütüphane tek testte kurulamaz, bu yüzden iki ayrı vaka. */
  test('tekrar kuyruğu HİÇ yoksa bölüm ÇİZİLMEZ', async ({ page }) => {
    await alintiAc(page, [sahteKitap({ ad: 'Notsuz Kitap', notlar: [] })]);
    await expect(page.locator('#tkKutu')).toBeEmpty();
    await expect(page.locator('#tkKutu')).toBeHidden();     // :empty{display:none}
  });

  test('tekrar kuyruğu doluyken bölüm en üstte ve kicker\'lı', async ({ page }) => {
    await alintiAc(page);
    await expect(page.locator('#tkKutu .tk-kart')).toBeVisible();
    await expect(page.locator('#tkKutu .kicker')).toHaveText('Tekrar zamanı');
  });

  /* ---------- korunan özellikler ---------- */
  test('TÜM bölümler ve özellikler duruyor (varlık denetimi)', async ({ page }) => {
    await alintiAc(page);
    const kalemler = {
      'ekran başlığı': '#panel-alinti .al-baslik',
      'özet satırı': '#alOzet',
      'tekrar kartı': '#tkKutu .tk-kart',
      'tekrar sayacı': '#tkKutu .tk-rozet-sayi',
      'tekrar istatistiği': '#tkKutu .tk-ist',
      'devam etsin': '[data-act="tk-devam"]',
      'daha sık': '[data-act="tk-sik"]',
      'yeter': '[data-act="tk-yeter"]',
      'günün alıntısı': '#alBolumGunun .ga-metin',
      'günün kaynağı': '#alBolumGunun .ga-kaynak',
      'fikir bulutu': '#alYuvaFikir #fikirBulut',
      'tüm fikirler çipi': '[data-act="fikir-filtre"][data-v=""]',
      'fikir ağı paneli': '#alYuvaFikirAg #faPanel',
      'fikir haritası': '#faSiraSec',
      'arama': '#alintiArama',
      'liste': '#alintiListe .not-kart',
      'kitaba git': '.alinti-git',
      'etiket ekleme': '[data-act="fikir-ekle"]',
      'kart yap (PNG)': '[data-act="alinti-kart"]',
      'tekrar durum göstergesi': '.tk-durum'
    };
    const eksik = [];
    for (const [ad, sec] of Object.entries(kalemler)) {
      if (await page.locator(sec).count() === 0) eksik.push(ad + ' (' + sec + ')');
    }
    expect(eksik, 'kaybolan özellik').toEqual([]);
    await expect(page.locator('#alOzet')).toHaveText('4 alıntı · 1 not · 2 kitaptan');
  });

  /* ---------- etkileşim ---------- */
  /* Üç eylem üç AYRI vaka: tohumla yalnız ilk yüklemede yazdığı için tek
     testte üç taze kütüphane kurulamaz. */
  const notOku = (page, nid) => page.evaluate(i => {
    const n = veri.kitaplar.flatMap(k => k.notlar).find(x => x.id === i);
    return { aralik: n.tekrarAralik, sonraki: n.tekrarSonraki, sayi: n.tekrarSayisi,
      durum: n.tekrarDurum }; }, nid);

  test('tekrar "Devam etsin": aralık ×CARPAN, sayaç artar, tarih ileri gider', async ({ page }) => {
    await alintiAc(page);
    const nid = await page.locator('#tkKutu .tk-kart').getAttribute('data-nid');
    const once = await notOku(page, nid);
    await page.click('[data-act="tk-devam"]');
    const sonra = await notOku(page, nid);
    const carpan = await page.evaluate(() => window.__tekrar.CARPAN);
    expect(sonra.aralik, 'aralık ×' + carpan).toBe(Math.round(once.aralik * carpan));
    expect(sonra.sayi).toBe(once.sayi + 1);
    expect(sonra.sonraki > BUGUN, 'sonraki tarih ileri atıldı').toBe(true);
  });

  test('tekrar "Daha sık": aralık küçülür', async ({ page }) => {
    await alintiAc(page);
    const nid = await page.locator('#tkKutu .tk-kart').getAttribute('data-nid');
    const once = await notOku(page, nid);
    await page.click('[data-act="tk-sik"]');
    const sonra = await notOku(page, nid);
    expect(sonra.aralik).toBeLessThan(once.aralik);
    expect(sonra.aralik).toBeGreaterThanOrEqual(
      await page.evaluate(() => window.__tekrar.MIN_ARALIK));
  });

  test('tekrar "Yeter": kayıt döngüden çıkar, kart kaybolur', async ({ page }) => {
    await alintiAc(page);
    const nid = await page.locator('#tkKutu .tk-kart').getAttribute('data-nid');
    await page.click('[data-act="tk-yeter"]');
    await expect(page.locator('#tkKutu .tk-kart')).toHaveCount(0);
    /* "Yeter" kaydı SİLMEZ, DURAKLATIR (tekrarDurum='duraklatildi'); tarih
       alanı korunur, böylece "tekrara al" ile geri açıldığında aralık geçmişi
       kaybolmaz. Kullanıcı için sonuç aynı: kuyruktan çıkar. */
    const s = await notOku(page, nid);
    expect(s.durum, 'kayıt duraklatıldı').toBe('duraklatildi');
    // liste kartındaki durum göstergesi de bunu söyler ve geri alma yolu sunar
    await expect(page.locator('#alintiListe .not-kart').first().locator('.tk-durum'))
      .toContainText('duraklatıldı');
    await expect(page.locator('[data-act="tk-baslat"]').first()).toBeVisible();
  });

  test('günün alıntısı gerçek bir alıntı gösterir ve gün içinde sabit kalır', async ({ page }) => {
    await alintiAc(page);
    const m = await page.locator('#alBolumGunun .ga-metin').textContent();
    expect(m.length).toBeGreaterThan(10);
    const metinler = await page.evaluate(() => veri.kitaplar.flatMap(k => k.notlar)
      .filter(n => n.tip === 'alinti').map(n => n.metin));
    expect(metinler.some(x => m.includes(x)), 'gerçek alıntıdan geliyor').toBe(true);
    await expect(page.locator('#alBolumGunun .ga-kaynak')).toContainText('sf.');
    await page.reload();
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    await expect(page.locator('#alBolumGunun .ga-metin')).toHaveText(m);
  });

  test('fikir etiketi: ekleme, silme, filtre, "Tüm fikirler"e dönüş', async ({ page }) => {
    await alintiAc(page);
    const ilk = page.locator('#alintiListe .not-kart').first();
    await ilk.locator('.fikir-giris').fill('yeni-fikir');
    await ilk.locator('[data-act="fikir-ekle"]').click();
    await expect(page.locator('#alYuvaFikir')).toContainText('yeni-fikir');
    // filtre
    await page.click('[data-act="fikir-filtre"][data-v="yeni-fikir"]');
    await expect(page.locator('#fikirBaslik')).toContainText('yeni-fikir');
    expect(await page.locator('#alintiListe .not-kart:visible').count()).toBe(1);
    // "Tüm fikirler"e dönüş
    await page.click('[data-act="fikir-filtre"][data-v=""]');
    expect(await page.locator('#alintiListe .not-kart:visible').count()).toBe(5);
    // silme
    await page.click('[data-act="fikir-sil"][data-v="yeni-fikir"]');
    await expect(page.locator('#alYuvaFikir')).not.toContainText('yeni-fikir');
  });

  test('fikir ağı: komşular, kesişim görünümü ve alt liste süzmesi', async ({ page }) => {
    await alintiAc(page);
    // "yalnızlık" 3 notta; "ironi" ile 2 notta BİRLİKTE → ESIK(2) geçildi, komşu
    await page.click('[data-act="fikir-filtre"][data-v="yalnızlık"]');
    expect(await page.locator('#alintiListe .not-kart:visible').count(),
      'yalnızlık filtresi 3 kayıt').toBe(3);
    const komsu = page.locator('#faPanel .fa-komsu[data-act="fa-kesisim"]').first();
    await expect(komsu).toBeVisible();
    await expect(komsu).toContainText('ironi');
    await komsu.click();
    await expect(page.locator('#faPanel .fa-kesisim-not').first()).toBeVisible();
    // kesişim aktifken alt liste İKİ etiketi BİRDEN taşıyanlara iner (3 → 2)
    expect(await page.locator('#alintiListe .not-kart:visible').count(),
      'kesişim süzgeci daraltır').toBe(2);
    await page.click('[data-act="fa-kesisim-kapat"]');
    expect(await page.locator('#alintiListe .not-kart:visible').count(),
      'kesişim kapanınca eski filtreye döner').toBe(3);
  });

  test('arama TR duyarlı çalışır ve sayaç günceller', async ({ page }) => {
    await alintiAc(page);
    await expect(page.locator('#alBolumListe .al-sayi')).toHaveText('5 / 5');
    await page.fill('#alintiArama', 'ınsan');          // noktasız ı ile
    await expect(page.locator('#alintiListe .not-kart')).toHaveCount(1);
    await expect(page.locator('#alintiListe')).toContainText('kalabalıklaşır');
    await expect(page.locator('#alBolumListe .al-sayi')).toHaveText('1 / 5');
    await page.fill('#alintiArama', 'kesinlikle-yok');
    await expect(page.locator('#alintiListe .bos')).toContainText('Aramayla eşleşen yok');
  });

  test('alıntı kartı PNG üretilir ve KREM kalır (karanlık temada da)', async ({ page }) => {
    await tohumla(page, defter(), { kk_tema_v1: 'karanlik' });
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    await expect(page.locator('#alBolumListe')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-tema')))
      .toBe('karanlik');
    await page.click('#alintiListe [data-act="alinti-kart"] >> nth=0');
    await expect(page.locator('#kartOrtu')).toHaveClass(/acik/);
    const m = await page.evaluate(() => window.__kart.sonCizim());
    expect(m, 'çizim yapıldı').not.toBeNull();
    expect(m.genislik).toBe(1080);
    /* KREM ölçümü GERÇEK PİKSELDEN (sabit okumaktan değil): tuvalin köşesi
       tema değişkenine bağlansaydı karanlıkta koyu çıkardı. */
    const z = await page.evaluate(() => {
      const t = document.getElementById('kartTuval');
      const d = t.getContext('2d').getImageData(4, 4, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2] };
    });
    expect(z, 'PNG zemini KREM — tema bağımsız').toEqual({ r: 245, g: 239, b: 227 });
  });

  test('boş kütüphanede anlamlı mesaj, çökme yok', async ({ page }) => {
    const hatalar = [];
    page.on('pageerror', e => hatalar.push(String(e)));
    await alintiAc(page, [sahteKitap({ ad: 'Notsuz', notlar: [] })]);
    await expect(page.locator('#alintiListe .bos')).toContainText('Henüz not veya alıntı eklemedin');
    await expect(page.locator('#alOzet')).toHaveText('Henüz kayıt yok');
    // günün alıntısı bölümü hiç çizilmez (alıntı yok)
    await expect(page.locator('#alBolumGunun')).toHaveCount(0);
    expect(hatalar, 'çökme yok').toEqual([]);
  });

  /* ---------- kontrast ---------- */
  for (const tema of ['acik', 'karanlik']) {
    test(`kontrast AA — dört bölüm (${tema} tema)`, async ({ page }) => {
      await tohumla(page, defter(), { kk_tema_v1: tema });
      await page.goto('/');
      await page.click('nav [data-act="sekme"][data-v="alinti"]');
      await expect(page.locator('#alBolumListe')).toBeVisible();
      await page.click('[data-act="fikir-filtre"][data-v="yalnızlık"]');
      const ciftler = [
        ['#panel-alinti .al-baslik', '#panel-alinti', 'ekran başlığı'],
        ['#alOzet', '#panel-alinti', 'özet'],
        ['#tkKutu .kicker', '#tkKutu', 'tekrar kicker'],
        ['#tkKutu .tk-metin', '#tkKutu', 'tekrar alıntısı'],
        ['#tkKutu .tk-kaynak', '#tkKutu', 'tekrar kaynağı'],
        ['#tkKutu .tk-btn-birincil', '#tkKutu', 'devam eylemi'],
        ['#tkKutu .tk-btn', '#tkKutu', 'ikincil eylem'],
        ['#tkKutu .tk-ist', '#tkKutu', 'tekrar istatistiği'],
        ['#alBolumGunun .kicker', '#alBolumGunun', 'günün kicker'],
        ['#alBolumGunun .ga-metin', '#alBolumGunun', 'günün alıntısı'],
        ['#alBolumGunun .ga-kaynak', '#alBolumGunun', 'günün kaynağı'],
        ['#alBolumFikir .fa-baslik', '#alBolumFikir', 'fikir ağı başlığı'],
        ['#alBolumFikir .fa-deger', '#alBolumFikir', 'fikir ağı değeri'],
        ['#alBolumFikir .fa-cip', '#alBolumFikir', 'fikir çipi'],
        ['#alBolumListe .al-sayi', '#alBolumListe', 'liste sayacı'],
        ['#alintiListe .not-metin', '#alBolumListe', 'not metni'],
        ['#alintiListe .not-tarih', '#alBolumListe', 'not kaynağı']
      ];
      for (const [m, z, ad] of ciftler) {
        const o = await kontrast(page, m, z);
        expect(o, ad + ' ölçülemedi (' + m + ')').not.toBeNull();
        expect(o, `${ad} (${tema}): ${o && o.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

