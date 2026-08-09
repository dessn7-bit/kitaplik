'use strict';
/* G42 — KEŞFET A aşaması (kesfet.js, ks-; v50): "rafından ne okusam" tam ekranı.
   - Motor oneri.js'te; Keşfet hesaplaHam → süzgeç → cesitlilikSec (yazar≤2)
     → nedenAta zinciri. Ana Sayfa SIRADAKİ aynı motorun kırpılmış hali —
     ortaklık kanıtı: iki yüzey AYNI kitap için AYNI gerekçeyi üretir.
   - Ciltli: dolu düğme yok, kart/gölge yok, kicker altın/büyük harf, skor
     ham sayı değil ince çizgi.
   - ŞÜPHE-2 borcu: sinyalsiz kitaplar varyant havuzundan DOLU gerekçe alır,
     '' imkânsız. (Mutasyon: erteleme kaldır → ertele vakası; çeşitlilik
     kotası kaldır → çeşitlilik vakası kırmızı.) */
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc } = require('./yardim');

function bitmis(ek) {
  return sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30) }, ek));
}
function okunacak(ek) {
  return sahteKitap(Object.assign({ durum: 'okunacak', sahiplik: 'sahip' }, ek));
}
function taban() {
  return [
    bitmis({ ad: 'Taban 1', yazar: 'Taban Yazar 1', tur: 'Deneme', puan: 6 }),
    bitmis({ ad: 'Taban 2', yazar: 'Taban Yazar 2', tur: 'Anı', puan: 5 }),
    bitmis({ ad: 'Taban 3', yazar: 'Taban Yazar 3', tur: 'Gezi', puan: 6 })
  ];
}
async function kesfetAc(page) {
  await page.goto('/');
  await page.click('nav [data-act="sekme"][data-v="kesfet"]');
  await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
}

/* g36 ile aynı yardımcılar (renk çözümü + dolu düğme + kontrast) */
const RENK_COZ = `(z => {
  if(!z || z === 'transparent') return { r:0,g:0,b:0,a:0 };
  let m = z.match(/rgba?\\(([\\d.]+),\\s*([\\d.]+),\\s*([\\d.]+)(?:,\\s*([\\d.]+))?\\)/);
  if(m) return { r:+m[1], g:+m[2], b:+m[3], a:m[4] === undefined ? 1 : +m[4] };
  m = z.match(/color\\(srgb\\s+([\\d.]+)\\s+([\\d.]+)\\s+([\\d.]+)(?:\\s*\\/\\s*([\\d.]+))?\\)/);
  if(m) return { r:255*+m[1], g:255*+m[2], b:255*+m[3], a:m[4] === undefined ? 1 : +m[4] };
  return { r:0,g:0,b:0,a:1 };
})`;

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
    const doygun = c => {
      const maks = Math.max(c.r,c.g,c.b), min = Math.min(c.r,c.g,c.b);
      return (maks - min) > 40 || maks < 120;
    };
    return [...document.querySelectorAll(kapsam + ' button')]
      .filter(b => b.offsetParent !== null)
      .map(b => ({ sinif: b.className, zemin: getComputedStyle(b).backgroundColor }))
      .filter(o => {
        const c = renkCoz(o.zemin);
        if(c.a < 0.5) return false;
        if(notrler.some(n => yakin(c, n))) return false;
        return doygun(c);
      });
  }, { kapsam, renkCozSrc: RENK_COZ });
}

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

test.describe('G42 Keşfet', () => {

  /* ---------- 1. ekran + gerekçeler ---------- */

  test('Keşfet gerçek liste çizer: kicker RAFINDAN + dürüst açılış + öneri satırları', async ({ page }) => {
    await tohumla(page, [...taban(),
      okunacak({ ad: 'Aday 1', yazar: 'Y1' }), okunacak({ ad: 'Aday 2', yazar: 'Y2' })]);
    await kesfetAc(page);
    expect(await page.locator('#ksIcerik .kicker').first()
      .evaluate(el => el.textContent)).toBe('Rafından');
    await expect(page.locator('#ksIcerik .ks-acilis')).toContainText('2 okunacak aday');
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(2);
  });

  test('her öneri satırında gerekçe cümlesi VAR ve boş değil', async ({ page }) => {
    await tohumla(page, [...taban(),
      bitmis({ ad: 'Sevilen 1', yazar: 'Usta', puan: 9 }),
      bitmis({ ad: 'Sevilen 2', yazar: 'Usta', puan: 9 }),
      okunacak({ ad: 'Usta Aday', yazar: 'Usta' }),
      okunacak({ ad: 'Nötr Aday 1', yazar: 'N1' }),
      okunacak({ ad: 'Nötr Aday 2', yazar: 'N2' })]);
    await kesfetAc(page);
    const satirlar = await page.locator('#ksIcerik .ks-item').count();
    expect(satirlar).toBe(3);
    const nedenler = await page.locator('#ksIcerik .ks-neden').allTextContents();
    expect(nedenler.length, 'her satırda gerekçe var').toBe(satirlar);
    nedenler.forEach(n => expect(n.trim().length).toBeGreaterThan(0));
  });

  test('ŞÜPHE-2 borcu: ÜÇ sinyalsiz kitapta hiçbir satır boş gerekçe taşımaz (varyant havuzu)', async ({ page }) => {
    const sinyalsiz = ['Sessiz 1', 'Sessiz 2', 'Sessiz 3'].map((ad, i) => {
      const k = okunacak({ ad, yazar: 'Bilinmez ' + i });
      k.eklenme = 1;   // bekleme damgası da geçersiz: sıfır özgül sinyal
      return k;
    });
    await tohumla(page, [...taban(), ...sinyalsiz]);
    await kesfetAc(page);
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(3);
    const nedenler = await page.locator('#ksIcerik .ks-neden').allTextContents();
    expect(nedenler.length, 'üç satırın ÜÇÜNDE de gerekçe var').toBe(3);
    nedenler.forEach(n => expect(n.trim().length).toBeGreaterThan(0));
    expect(new Set(nedenler).size, 'varyantlar farklı').toBe(3);
    nedenler.forEach(n => expect(n).not.toMatch(/\d/));   // uydurma sayı yok
  });

  /* ---------- 2. eylemler ---------- */

  test('"Şimdi değil" erteler; ertelenmiş bölümünde görünür ve GERİ ALINABİLİR', async ({ page }) => {
    const k = okunacak({ ad: 'Ertelenen Kitap', yazar: 'E Yazar' });
    await tohumla(page, [...taban(), k, okunacak({ ad: 'Kalan Kitap' })]);
    await kesfetAc(page);
    await page.click(`#ksIcerik [data-act="ks-ertele"][data-id="${k.id}"]`);
    await expect(page.locator('#ksIcerik')).not.toContainText('Ertelenen Kitap');
    // ertelenmişler bölümü: sayı + göster + kalan gün + geri al
    const erteli = page.locator('#ksIcerik .ks-erteli');
    await expect(erteli).toContainText('1 kitabı ertelemiştin');
    await page.click('#ksIcerik [data-act="ks-erteli"]');
    await expect(erteli.locator('.ks-erteli-item')).toContainText('Ertelenen Kitap');
    await expect(erteli.locator('.ks-erteli-gun')).toContainText('30 gün sonra döner');
    await page.click(`#ksIcerik [data-act="ks-geri-al"][data-id="${k.id}"]`);
    await expect(page.locator('#ksIcerik .ks-item', { hasText: 'Ertelenen Kitap' })).toHaveCount(1);
    await expect(page.locator('#ksIcerik .ks-erteli')).toHaveCount(0);
    expect(await page.evaluate(id =>
      veri.kitaplar.find(x => x.id === id).ertelemeTarihi, k.id)).toBe(null);
  });

  test('zar Keşfet\'ten çalışır: rastgele okunacak kitabın detayı açılır', async ({ page }) => {
    await tohumla(page, [...taban(), okunacak({ ad: 'Zar Adayı' })]);
    await kesfetAc(page);
    await page.click('#ksIcerik .zar-btn');
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await expect(page.locator('#detayIcerik')).toContainText('Zar Adayı');
  });

  /* ---------- 3. süzgeçler ---------- */

  test('tür süzgeci doğru süzer, ikinci dokunuş kaldırır', async ({ page }) => {
    await tohumla(page, [...taban(),
      okunacak({ ad: 'Romanlı', yazar: 'Y1', tur: 'Roman' }),
      okunacak({ ad: 'Şiirli', yazar: 'Y2', tur: 'Şiir' })]);
    await kesfetAc(page);
    await page.click('#ksIcerik [data-act="ks-suz"][data-g="tur"][data-v="Roman"]');
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(1);
    await expect(page.locator('#ksIcerik .ks-item')).toContainText('Romanlı');
    await expect(page.locator('#ksIcerik .ks-acilis')).toContainText('süzgeçten geçen: 1');
    await page.click('#ksIcerik [data-act="ks-suz"][data-g="tur"][data-v="Roman"]');
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(2);
  });

  test('uzunluk süzgeci: kısa<200 / orta 200-400 / uzun>400; sayfası bilinmeyen kovaya SOKULMAZ', async ({ page }) => {
    await tohumla(page, [...taban(),
      okunacak({ ad: 'Kısa Kitap', yazar: 'Y1', sayfa: 150 }),
      okunacak({ ad: 'Orta Kitap', yazar: 'Y2', sayfa: 300 }),
      okunacak({ ad: 'Uzun Kitap', yazar: 'Y3', sayfa: 500 }),
      okunacak({ ad: 'Sayfasız Kitap', yazar: 'Y4' })]);
    await kesfetAc(page);
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(4);
    await page.click('#ksIcerik [data-act="ks-suz"][data-g="uzunluk"][data-v="kisa"]');
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(1);
    await expect(page.locator('#ksIcerik .ks-item')).toContainText('Kısa Kitap');
    await page.click('#ksIcerik [data-act="ks-suz"][data-g="uzunluk"][data-v="uzun"]');
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(1);
    await expect(page.locator('#ksIcerik .ks-item')).toContainText('Uzun Kitap');
    // sayfası bilinmeyen kitap HİÇBİR uzunluk kovasına uydurulmaz
    await page.click('#ksIcerik [data-act="ks-suz"][data-g="uzunluk"][data-v="orta"]');
    await expect(page.locator('#ksIcerik')).not.toContainText('Sayfasız Kitap');
  });

  test('raf süzgeci adayların gerçek raf değerlerinden kurulur ve doğru süzer', async ({ page }) => {
    await tohumla(page, [...taban(),
      okunacak({ ad: 'Salonda Duran', yazar: 'Y1', raf: 'Salon-1' }),
      okunacak({ ad: 'Rafsız Duran', yazar: 'Y2' })]);
    await kesfetAc(page);
    await page.click('#ksIcerik [data-act="ks-suz"][data-g="raf"][data-v="Salon-1"]');
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(1);
    await expect(page.locator('#ksIcerik .ks-item')).toContainText('Salonda Duran');
  });

  test('sahiplik süzgeci: İstek listem yalnız istekleri gösterir, başlanamaz (rozet)', async ({ page }) => {
    await tohumla(page, [...taban(),
      okunacak({ ad: 'Bende Olan', yazar: 'Y1' }),
      sahteKitap({ ad: 'İstenen Kitap', yazar: 'Y2', durum: 'okunacak', sahiplik: 'istek' })]);
    await kesfetAc(page);
    await expect(page.locator('#ksIcerik .ks-item')).toContainText('Bende Olan');
    await page.click('#ksIcerik [data-act="ks-suz"][data-g="sahiplik"][data-v="istek"]');
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(1);
    await expect(page.locator('#ksIcerik .ks-item')).toContainText('İstenen Kitap');
    await expect(page.locator('#ksIcerik .ks-rozet')).toContainText('İstek listende');
    await expect(page.locator('#ksIcerik [data-act="ks-basla"]')).toHaveCount(0);
  });

  /* ---------- 4. çeşitlilik + sayfalama ---------- */

  test('çeşitlilik: aynı yazardan en fazla 2 öneri (10\'luk listede de)', async ({ page }) => {
    const ayni = [];
    for (let i = 1; i <= 12; i++)
      ayni.push(okunacak({ ad: 'Üretken ' + i, yazar: 'Üretken Yazar' }));
    await tohumla(page, [...taban(), ...ayni,
      okunacak({ ad: 'Tek Başına', yazar: 'Yalnız Yazar' })]);
    await kesfetAc(page);
    // yazar kotası: 2 Üretken + 1 Yalnız = 3 satır; kota artığı "daha fazla" da getirmez
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(3);
    await expect(page.locator('#ksIcerik .ks-item', { hasText: 'Üretken Yazar' })).toHaveCount(2);
    await expect(page.locator('#ksIcerik [data-act="ks-daha"]')).toHaveCount(0);
  });

  test('ilk 10 gösterilir, "Daha fazla" kalanları getirir ve sonra kaybolur', async ({ page }) => {
    const adaylar = [];
    for (let i = 1; i <= 15; i++)
      adaylar.push(okunacak({ ad: 'Bağımsız ' + i, yazar: 'Yazar ' + i }));
    await tohumla(page, [...taban(), ...adaylar]);
    await kesfetAc(page);
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(10);
    await page.click('#ksIcerik [data-act="ks-daha"]');
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(15);
    await expect(page.locator('#ksIcerik [data-act="ks-daha"]')).toHaveCount(0);
  });

  /* ---------- 5. az-veri + ortaklık ---------- */

  test('yetersiz veride dürüst mesaj + bekleyenler; skor çizgisi HİÇ çizilmez', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Puanlı 1', yazar: 'X', puan: 8 }),
      okunacak({ ad: 'Bekleyen 1', yazar: 'B1', eklenme: 1700000000000 }),
      okunacak({ ad: 'Bekleyen 2', yazar: 'B2', eklenme: 1750000000000 })]);
    await kesfetAc(page);
    await expect(page.locator('#ksIcerik .ks-not')).toContainText('yeterli veri yok');
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(2);
    await expect(page.locator('#ksIcerik .ks-skor')).toHaveCount(0);   // skor uydurulmaz
    expect(await page.locator('#ksIcerik').textContent()).not.toContain('ortalama');
  });

  test('?sekme=kesfet derin bağlantısı boş iskelette KALMAZ (inceleme K1 kilidi)', async ({ page }) => {
    await tohumla(page, [...taban(), okunacak({ ad: 'Derin Aday', yazar: 'DY' })]);
    await page.goto('/index.html?sekme=kesfet');
    await expect(page.locator('#panel-kesfet')).toHaveClass(/active/);
    await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
    await expect(page.locator('#panel-kesfet .kesfet-bos')).toHaveCount(0);
    await expect(page.locator('#ksIcerik .ks-item')).toContainText('Derin Aday');
  });

  test('az-veri modunda İstek listem çipi de dürüst: istekler listelenir, yanlış mesaj yok (K2 kilidi)', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Tek Puanlı', yazar: 'X', puan: 8 }),   // eşik altı → az-veri
      okunacak({ ad: 'Sahip Bekleyen', yazar: 'B1' }),
      sahteKitap({ ad: 'İstekte Bekleyen', yazar: 'B2', durum: 'okunacak', sahiplik: 'istek' })]);
    await kesfetAc(page);
    await page.click('#ksIcerik [data-act="ks-suz"][data-g="sahiplik"][data-v="istek"]');
    await expect(page.locator('#ksIcerik .ks-item')).toHaveCount(1);
    await expect(page.locator('#ksIcerik .ks-item')).toContainText('İstekte Bekleyen');
    expect(await page.locator('#ksIcerik').textContent()).not.toContain('rafına kitap ekle');
  });

  test('ORTAKLIK KANITI: Ana Sayfa SIRADAKİ ile Keşfet AYNI kitaba AYNI gerekçeyi üretir', async ({ page }) => {
    await tohumla(page, [...taban(),
      bitmis({ ad: 'Sevilen 1', yazar: 'Ortak Yazar', puan: 9 }),
      bitmis({ ad: 'Sevilen 2', yazar: 'Ortak Yazar', puan: 10 }),
      okunacak({ ad: 'Ortak Aday', yazar: 'Ortak Yazar' }),
      okunacak({ ad: 'Dolgu Aday', yazar: 'Dolgu Yazar' })]);
    await page.goto('/');
    const anaNeden = await page.locator('#asSiradaki .as-oneri', { hasText: 'Ortak Aday' })
      .locator('.as-neden').evaluate(el => el.textContent);
    expect(anaNeden.trim().length).toBeGreaterThan(0);
    await page.click('nav [data-act="sekme"][data-v="kesfet"]');
    const ksNeden = await page.locator('#ksIcerik .ks-item', { hasText: 'Ortak Aday' })
      .locator('.ks-neden').evaluate(el => el.textContent);
    expect(ksNeden, 'iki yüzey AYNI motor + AYNI gerekçe').toBe(anaNeden);
  });

  /* ---------- 6. Ciltli dil + AA ---------- */

  test('Ciltli: Keşfet\'te dolu düğme yok, yuvarlak kart/gölge yok', async ({ page }) => {
    await tohumla(page, [...taban(),
      bitmis({ ad: 'Sevilen 1', yazar: 'Usta', puan: 9 }),
      okunacak({ ad: 'Aday 1', yazar: 'Usta', tur: 'Roman', sayfa: 300, raf: 'Salon-1' }),
      okunacak({ ad: 'Aday 2', yazar: 'Y2' }),
      sahteKitap({ ad: 'İstek K', durum: 'okunacak', sahiplik: 'istek' })]);
    await kesfetAc(page);
    expect(await doluDugmeler(page, '#panel-kesfet')).toEqual([]);
    const kacaklar = await page.evaluate(() => {
      return [...document.querySelectorAll('#panel-kesfet *')]
        .filter(el => el.offsetParent !== null)
        .map(el => { const c = getComputedStyle(el);
          return { sinif: String(el.className).slice(0, 40),
            r: parseFloat(c.borderRadius) || 0, golge: c.boxShadow }; })
        .filter(o => o.r > 7 || o.golge !== 'none');
    });
    expect(kacaklar, 'yarıçap ≤7px, gölge yok').toEqual([]);
  });

  for (const tema of ['acik', 'karanlik']) {
    test(`Keşfet metin rolleri AA (${tema} tema)`, async ({ page }) => {
      await tohumla(page, [...taban(),
        bitmis({ ad: 'Sevilen 1', yazar: 'Usta', puan: 9 }),
        bitmis({ ad: 'Sevilen 2', yazar: 'Usta', puan: 9 }),
        okunacak({ ad: 'Usta Aday', yazar: 'Usta', tur: 'Roman', sayfa: 300 }),
        okunacak({ ad: 'Ertelenecek', yazar: 'EY' })], { kk_tema_v1: tema });
      await kesfetAc(page);
      // ertelenmiş bölümü de ölçüme girsin
      await page.click('#ksIcerik [data-act="ks-ertele"]');
      await page.click('#ksIcerik [data-act="ks-erteli"]');
      const ciftler = [
        ['#ksIcerik .kicker', null, 'kicker'],
        ['#ksIcerik .ks-baslik', null, 'başlık'],
        ['#ksIcerik .ks-acilis', null, 'açılış cümlesi'],
        ['#ksIcerik .ks-suz-ad', null, 'süzgeç etiketi'],
        ['#ksIcerik .ks-chip:not(.secili)', null, 'pasif çip'],
        ['#ksIcerik .ks-chip.secili', null, 'seçili çip'],
        ['#ksIcerik .ks-ad', null, 'öneri adı'],
        ['#ksIcerik .ks-yazar', null, 'öneri yazarı'],
        ['#ksIcerik .ks-neden', null, 'gerekçe'],
        ['#ksIcerik .ks-basla', null, 'okumaya başla'],
        ['#ksIcerik .ks-sessiz', null, 'şimdi değil / göster'],
        ['#ksIcerik .ks-erteli-gun', null, 'kalan gün'],
      ];
      for (const [m, z, ad] of ciftler) {
        const o = await kontrastOrani(page, m, z);
        expect(o, `${ad} ölçülemedi (${m})`).not.toBeNull();
        expect(o, `${ad} (${tema}): ${o && o.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
