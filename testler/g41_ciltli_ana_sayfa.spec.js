'use strict';
/* G41 — Ciltli Ana Sayfa (v47): tasarım dili + ortak bileşen sözleşmesi.
   - Ana Sayfa'da kutu/gölge/eski yarıçap YOK (hesaplanmış stil taraması);
     dolu düğme YOK; kicker'lar altın + büyük harf + harf aralıklı.
   - ORTAK BİLEŞEN: devam kartı, hedef şeridi, tarih satırı ve levha şeridi
     Kütüphane ile AYNI üreticiden gelir — DOM birebir karşılaştırılır.
     (Mutasyon M1: anaCiz kendi kopyasını kurarsa eşitlik vakası kırmızı.)
   - BUGÜN üç-hücre deseni; verisiz bölüm HİÇ çizilmez.
     (Mutasyon M2: boş-bölüm filtresi kalkarsa "çizilmez" vakası kırmızı.)
   - SON BİTİRDİKLERİN şeridi g38'in GERÇEK-error yoluyla sınanır (404 rotası). */
const { test, expect, tohumla, sahteKitap, bugunISO } = require('./yardim');

const YIL = new Date().getFullYear();

/* ---- g36 ile aynı yardımcılar (renk çözümü + dolu düğme + kontrast) ---- */
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
      .map(b => ({ sinif: b.className, act: b.dataset.act || '',
        zemin: getComputedStyle(b).backgroundColor }))
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

/* ---- tohum fabrikaları ---- */
function okunanK(ek) {
  return sahteKitap(Object.assign({ ad: 'Okunan Roman', yazar: 'Usta Yazar',
    durum: 'okunuyor', sayfa: 400, guncelSayfa: 100,
    baslamaTarihi: '2026-01-01', gsG: 5 }, ek || {}));
}
function bitmisK(ek) {
  return sahteKitap(Object.assign({ ad: 'Bitmiş Kitap', yazar: 'Aynı Yazar',
    durum: 'bitti', sayfa: 200, puan: 9, bitisTarihi: bugunISO() }, ek || {}));
}
function bekleyenAlinti(i) {
  return { id: 'g41n' + i, tip: 'alinti', metin: 'Alıntı ' + i, tarih: '2026-01-15',
    sayfa: null, fikir: [], tekrarDurum: 'aktif', tekrarAralik: 3,
    tekrarSayisi: 0, tekrarSonraki: bugunISO(-1) };
}
function bugunOturum(dakika, sa, sb) {
  // gün-sınırı güvenli (v51 flaky onarımı): Date.now()-1sa gece 00-01
  // penceresinde DÜNE düşüyordu — bugünün 12:00'sine sabitlenir.
  const d = new Date(); d.setHours(12, 0, 0, 0);
  return { b: d.getTime(), s: dakika * 60000, sa, sb };
}
/* Tüm bölümleri dolduran zengin tohum (taramalar her yüzeyi görsün) */
function zenginVeri() {
  return { kitaplar: [
    okunanK(),
    bitmisK({ ad: 'Sevilen 1' }),
    bitmisK({ ad: 'Sevilen 2', puan: 9 }),
    bitmisK({ ad: 'Sevilen 3', puan: 8 }),
    sahteKitap({ ad: 'Aday Kitap', yazar: 'Aynı Yazar', durum: 'okunacak' }),
    sahteKitap({ ad: 'Alıntılı', notlar: [bekleyenAlinti(1), bekleyenAlinti(2)],
      oturumlar: [bugunOturum(45, 100, 120)] }),
  ], hedef: { [YIL]: 12 } };
}

test.describe('G41 Ciltli Ana Sayfa', () => {

  /* ---------- 1. tasarım dili taramaları ---------- */

  test('Ana Sayfa\'da yuvarlak köşeli kart/gölge YOK (hesaplanmış stil taraması)', async ({ page }) => {
    await tohumla(page, zenginVeri());
    await page.goto('/');
    await expect(page.locator('#asSiradaki')).toBeVisible();   // eklenti çizimi otursun
    const kacaklar = await page.evaluate(() => {
      return [...document.querySelectorAll('#anaIcerik *')]
        .filter(el => el.offsetParent !== null)
        .map(el => {
          const c = getComputedStyle(el);
          return { sinif: String(el.className).slice(0, 40),
            r: parseFloat(c.borderRadius) || 0, golge: c.boxShadow };
        })
        .filter(o => o.r > 7 || o.golge !== 'none');
    });
    expect(kacaklar, 'yarıçap ≤ 7px ve gölge yok olmalı').toEqual([]);
  });

  test('Ana Sayfa\'da görünür dolu düğme YOK', async ({ page }) => {
    await tohumla(page, zenginVeri());
    await page.goto('/');
    await expect(page.locator('#asSiradaki')).toBeVisible();
    expect(await doluDugmeler(page, '#panel-ana')).toEqual([]);
  });

  test('kicker etiketleri: altın + büyük harf + harf aralıklı (tüm bölümler)', async ({ page }) => {
    await tohumla(page, zenginVeri());
    await page.goto('/');
    await expect(page.locator('#asSiradaki')).toBeVisible();
    const r = await page.evaluate(() => {
      const brass = (() => {
        const p = document.createElement('div');
        p.style.color = getComputedStyle(document.documentElement).getPropertyValue('--brass').trim();
        document.body.appendChild(p);
        const x = getComputedStyle(p).color; p.remove(); return x;
      })();
      return { brass, kickerlar: [...document.querySelectorAll('#anaIcerik .kicker')]
        .map(el => { const c = getComputedStyle(el);
          return { metin: el.textContent.trim(), renk: c.color, buyuk: c.textTransform,
            aralik: parseFloat(c.letterSpacing), punto: parseFloat(c.fontSize) }; }) };
    });
    expect(r.kickerlar.length, 'bölüm kicker sayısı').toBeGreaterThanOrEqual(4);
    for (const k of r.kickerlar) {
      expect(k.renk, k.metin + ' altın').toBe(r.brass);
      expect(k.buyuk, k.metin + ' büyük harf').toBe('uppercase');
      expect(k.aralik, k.metin + ' harf aralığı').toBeGreaterThan(0.8);
      expect(k.punto, k.metin + ' küçük punto').toBeLessThan(12);
    }
  });

  test('üst blok: karşılama + Kütüphane deseninde tarih (AYNI üretici) + gerçek özet', async ({ page }) => {
    await tohumla(page, zenginVeri());
    await page.goto('/');
    const selam = await page.locator('#anaIcerik .as-selam').textContent();
    expect(['Günaydın', 'İyi günler', 'İyi akşamlar', 'İyi geceler']).toContain(selam);
    // tarih satırı Kütüphane'yle AYNI üreticiden: metin birebir eşit
    const [anaTarih, ktTarih] = await page.evaluate(() => [
      document.querySelector('#anaIcerik .kt-tarih').textContent,
      document.querySelector('#ktUst .kt-tarih').textContent]);
    expect(anaTarih).toBe(ktTarih);
    // özet gerçek veriden: 5 sahip cilt (istek yok) · bu yıl 3 bitmiş
    await expect(page.locator('#anaIcerik .as-ozet')).toHaveText('6 cilt · bu yıl 3 kitap bitirdin');
  });

  /* ---------- 2. ortak bileşen kanıtları ---------- */

  test('ORTAK BİLEŞEN: devam kartı Ana Sayfa ve Kütüphane\'de BİREBİR aynı DOM', async ({ page }) => {
    await tohumla(page, [okunanK()]);
    await page.goto('/');
    await expect(page.locator('#asDevam .kt-devam-kart')).toBeVisible();
    const [ana, kt] = await page.evaluate(() => [
      document.querySelector('#asDevam .kt-devam-kart').outerHTML,
      document.querySelector('#ktDevam .kt-devam-kart').outerHTML]);
    expect(kt, 'Kütüphane devam kartı çizilmiş olmalı').toBeTruthy();
    expect(ana, 'iki ekran AYNI üreticiden çıkmalı (kopya mantık yasak)').toBe(kt);
  });

  test('ORTAK BİLEŞEN: yıl hedef şeridi Ana Sayfa ve Kütüphane\'de BİREBİR aynı DOM', async ({ page }) => {
    await tohumla(page, { kitaplar: [bitmisK()], hedef: { [YIL]: 12 } });
    await page.goto('/');
    await expect(page.locator('#asYil .kt-hedef')).toBeVisible();
    const [ana, kt] = await page.evaluate(() => [
      document.querySelector('#asYil .kt-hedef').outerHTML,
      document.querySelector('#ktHedef .kt-hedef').outerHTML]);
    expect(kt).toBeTruthy();
    expect(ana).toBe(kt);
  });

  test('çift-DOM regresyonu: sayfa kutusu yalnız dokunulan panelde açılır (data-kid, id değil)', async ({ page }) => {
    /* Ortak bileşen iki panelde de çiziliyor; kutu id taşısaydı getElementById
       hep İLK (gizli Ana Sayfa) kopyayı bulur, Kütüphane kutusu hiç açılmazdı. */
    await tohumla(page, [okunanK()]);
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="raf"]');
    await page.click('#ktUst [data-act="kt-sayfa-ac"]');
    await expect(page.locator('#ktUst .kt-sayfa-satir')).toBeVisible();
    expect(await page.locator('#asDevam .kt-sayfa-satir').getAttribute('hidden'),
      'Ana Sayfa kopyası kapalı kalır').not.toBeNull();
    // kutuyu kapat (toggle) — sekme geçişi ktUst'u yeniden çizmez, açık kalırdı
    await page.click('#ktUst [data-act="kt-sayfa-ac"]');
    expect(await page.locator('#ktUst .kt-sayfa-satir').getAttribute('hidden')).not.toBeNull();
    // Ana Sayfa'ya dönünce (taze çizim) kutu kapalı; oradan açmak yalnız onu açar
    await page.click('nav [data-act="sekme"][data-v="ana"]');
    await page.click('#asDevam [data-act="kt-sayfa-ac"]');
    await expect(page.locator('#asDevam .kt-sayfa-satir')).toBeVisible();
    expect(await page.locator('#ktUst .kt-sayfa-satir').getAttribute('hidden'),
      'Kütüphane kopyası kapalı kalır').not.toBeNull();
  });

  /* ---------- 3. BUGÜN ---------- */

  test('BUGÜN: üç hücre gerçek veriden — sol kıl payı ayraçlı, tekrar hücresi Alıntılar\'a gider', async ({ page }) => {
    await tohumla(page, [okunanK({ oturumlar: [bugunOturum(45, 100, 120)],
      notlar: [bekleyenAlinti(1), bekleyenAlinti(2)] })]);
    await page.goto('/');
    const blok = page.locator('#asBugun');
    await expect(blok.locator('.as-hucre')).toHaveCount(3);
    await expect(blok.locator('.as-hucre-sayi').nth(0)).toHaveText('2');       // tekrar
    await expect(blok.locator('.as-hucre-sayi').nth(1)).toHaveText('45 dk');   // süre
    await expect(blok.locator('.as-hucre-sayi').nth(2)).toHaveText('20');      // sayfa
    const ayraclar = await blok.locator('.as-hucre').evaluateAll(els =>
      els.map(el => getComputedStyle(el).borderLeftWidth));
    expect(ayraclar).toEqual(['1px', '1px', '1px']);
    await blok.locator('[data-act="ana-tekrar"]').click();
    await expect(page.locator('#panel-alinti')).toHaveClass(/active/);
  });

  test('BUGÜN: tekrar kuyruğu boş ve bugün okuma yoksa bölüm HİÇ çizilmez', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Sessiz Gün Kitabı' })]);
    await page.goto('/');
    await expect(page.locator('#anaIcerik .as-ust')).toBeVisible();  // sayfa çizildi
    await expect(page.locator('#asBugun')).toHaveCount(0);
  });

  /* ---------- 4. SIRADAKİ ---------- */

  test('SIRADAKİ: gerekçe cümlesi gerçek veriden — yazar ortalaması bağımsız hesapla tutar', async ({ page }) => {
    await tohumla(page, [
      bitmisK({ ad: 'Sevilen 1', puan: 9 }),
      bitmisK({ ad: 'Sevilen 2', puan: 9 }),
      bitmisK({ ad: 'Sevilen 3', puan: 8 }),
      sahteKitap({ ad: 'Aday Kitap', yazar: 'Aynı Yazar', durum: 'okunacak' }),
    ]);
    await page.goto('/');
    const neden = page.locator('#asSiradaki .as-neden');
    await expect(neden).toContainText('Aynı Yazar');
    // bağımsız hesap: (9+9+8)/3 = 8,7 — cümledeki ortalama uydurma değil
    await expect(neden).toContainText('ortalama 8,7');
    // öneri satırı mini levha taşır ve detaya götürür
    await page.click('#asSiradaki .as-oneri');
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await expect(page.locator('#detayIcerik')).toContainText('Aday Kitap');
  });

  test('SIRADAKİ: az-veri modunda dürüst bekleme gerekçesi (skor uydurulmaz)', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Puansız Bitmiş', durum: 'bitti', bitisTarihi: bugunISO() }),
      sahteKitap({ ad: 'Bekleyen Aday', durum: 'okunacak' }),
    ]);
    await page.goto('/');
    await expect(page.locator('#asSiradaki .as-neden')).toContainText('rafta bekliyor');
  });

  /* ---------- 5. SON BİTİRDİKLERİN (g38 gerçek-error yolu) ---------- */

  test('SON BİTİRDİKLERİN: levha yükseklikleri eşit; bozuk kapakta yedek metin görünür', async ({ page }) => {
    // g38 deseni: agTaklit'in tanımadığı host'a testin KENDİ 404 rotası —
    // sonradan kayıt öncelikli olduğundan img error'u SAHİCİ yoldan tetiklenir.
    await page.route('**/covers.bozuk.example/**', r => r.fulfill({ status: 404, body: '' }));
    await tohumla(page, [
      sahteKitap({ ad: 'Bozuk Şeritli', yazar: 'Hatalı Sunucu', durum: 'bitti',
        bitisTarihi: bugunISO(), kapak: 'https://covers.bozuk.example/yok.jpg' }),
      sahteKitap({ ad: 'Kapaksız Bitmiş', yazar: 'Yerli Yazar', durum: 'bitti',
        bitisTarihi: bugunISO(-1) }),
    ]);
    await page.goto('/');
    const levhalar = page.locator('#asSonBiten .kt-sira-plate');
    await expect(levhalar).toHaveCount(2);
    const bozuk = levhalar.first();   // en yeni bitiş önce
    await expect(bozuk).toHaveClass(/p-bos/);
    await expect(bozuk).not.toHaveClass(/kt-sira-kapakli/);
    await expect(bozuk.locator('.kt-sira-ad')).toHaveText('Bozuk Şeritli');
    await expect(bozuk.locator('.kt-sira-yazar')).toHaveText('Hatalı Sunucu');
    await expect(bozuk.locator('img')).toHaveCount(0);
    const kutular = await levhalar.evaluateAll(els =>
      els.map(el => el.getBoundingClientRect().height));
    expect(Math.abs(kutular[0] - kutular[1]), 'levha yükseklikleri eşit').toBeLessThanOrEqual(1);
    expect(kutular[0], 'levha gerçekten boyanıyor').toBeGreaterThan(50);
  });

  /* ---------- 6. boş kütüphane Ciltli ---------- */

  test('boş kütüphane: başlangıç yüzeyi de Ciltli (kutu/gölge yok, tek pirinç kontur)', async ({ page }) => {
    await tohumla(page, []);
    await page.goto('/');
    await expect(page.locator('#panel-ana')).toContainText('Kütüphanen henüz boş');
    const kacaklar = await page.evaluate(() => {
      return [...document.querySelectorAll('#anaIcerik *')]
        .filter(el => el.offsetParent !== null)
        .map(el => { const c = getComputedStyle(el);
          return { r: parseFloat(c.borderRadius) || 0, golge: c.boxShadow }; })
        .filter(o => o.r > 7 || o.golge !== 'none');
    });
    expect(kacaklar).toEqual([]);
    expect(await doluDugmeler(page, '#panel-ana')).toEqual([]);
  });

  /* ---------- 7. kontrast AA (yeni metin rolleri, iki tema) ---------- */

  for (const tema of ['acik', 'karanlik']) {
    test(`yeni metin rolleri AA (${tema} tema)`, async ({ page }) => {
      await tohumla(page, {
        kitaplar: [
          bitmisK({ ad: 'Sevilen 1', puan: 9 }),
          bitmisK({ ad: 'Sevilen 2', puan: 9 }),
          bitmisK({ ad: 'Sevilen 3', puan: 8 }),
          sahteKitap({ ad: 'Aday Kitap', yazar: 'Aynı Yazar', durum: 'okunacak' }),
          sahteKitap({ ad: 'Alıntılı', notlar: [bekleyenAlinti(1)],
            oturumlar: [bugunOturum(30, 10, 40)] }),
        ], hedef: {},
      }, { kk_tema_v1: tema });
      await page.goto('/');
      await expect(page.locator('#asSiradaki')).toBeVisible();
      const ciftler = [
        ['#anaIcerik .as-selam', null, 'karşılama'],
        ['#anaIcerik .as-ozet', null, 'özet satırı'],
        ['#anaIcerik .kicker', null, 'kicker'],
        ['#asBugun .as-hucre-sayi', null, 'hücre sayısı'],
        ['#asBugun .as-hucre-ad', null, 'hücre etiketi'],
        ['#asSiradaki .as-oneri-ad', null, 'öneri adı'],
        ['#asSiradaki .as-oneri-yazar', null, 'öneri yazarı'],
        ['#asSiradaki .as-neden', null, 'gerekçe'],
        ['#asYil .as-yil-metin', null, 'yıl notu'],
        ['#asYil .as-yil-link', null, 'hedef koy bağlantısı'],
        ['#asSonBiten .kt-sira-ad', null, 'şerit levha adı'],
      ];
      for (const [m, z, ad] of ciftler) {
        const o = await kontrastOrani(page, m, z);
        expect(o, `${ad} ölçülemedi (${m})`).not.toBeNull();
        expect(o, `${ad} (${tema}): ${o && o.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
