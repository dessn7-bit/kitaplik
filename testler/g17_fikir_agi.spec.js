'use strict';
const { test, expect, tohumla, sahteKitap } = require('./yardim');

/* TÜM seçiciler kapsamlı: #panel-alinti / #faPanel altında. */

let notSayac = 0;
function not(metin, fikir, sayfa) {
  notSayac++;
  return { id: 'fn' + notSayac, tip: 'alinti', metin, tarih: '2026-08-01',
    sayfa: sayfa || null, fikir: fikir || [] };
}
function kitap(ad, notlar) {
  return sahteKitap({ ad, notlar });
}
async function alintiAc(page) {
  await page.goto('/');
  await page.click('[data-act="sekme"][data-v="alinti"]');
  await expect(page.locator('#panel-alinti #faPanel')).toBeVisible();
}
async function fikirSec(page, etiket) {
  await page.click(`#panel-alinti #fikirBulut [data-act="fikir-filtre"][data-v="${etiket}"]`);
  await expect(page.locator('#panel-alinti #faKomsuKart')).toBeVisible();
}

test.describe('G17 M1 — eş-geçim hesabı', () => {

  test('iki etiket tek notta: eşik altında; ikinci notta tekrar: eşiği geçer', async ({ page }) => {
    await tohumla(page, [kitap('Kitap A', [not('Birinci alıntı', ['varlık', 'zaman'])])]);
    await page.goto('/');
    await page.click('[data-act="sekme"][data-v="alinti"]');
    let c = await page.evaluate(() => window.__fikirag.esGecim());
    expect(c.length).toBe(1);
    expect(c[0]).toMatchObject({ a: 'varlık', b: 'zaman', notlar: 1, kitapSayisi: 1 });
    let k = await page.evaluate(() => window.__fikirag.komsular('varlık'));
    expect(k).toEqual([]);          // 1 birliktelik eşiğin altında → gösterilmez
    await fikirSec(page, 'varlık');
    await expect(page.locator('#panel-alinti #faKomsuBos')).toBeVisible();

    // ikinci notta tekrar birlikte geçsin
    await page.evaluate(() => {
      veri.kitaplar[0].notlar.push({ id: 'yeni1', tip: 'alinti', metin: 'İkinci alıntı',
        tarih: '2026-08-02', sayfa: null, fikir: ['varlık', 'zaman'] });
      depoKaydet(); alintiCiz();
    });
    await page.waitForTimeout(200);
    c = await page.evaluate(() => window.__fikirag.esGecim());
    expect(c[0].notlar).toBe(2);
    k = await page.evaluate(() => window.__fikirag.komsular('varlık'));
    expect(k).toEqual([{ ad: 'zaman', notlar: 2, kitapSayisi: 1, kitaptaBirlikte: 1 }]);
  });

  test('aynı çift iki farklı kitapta → 2 kitap sayılır', async ({ page }) => {
    await tohumla(page, [
      kitap('Kitap A', [not('A alıntısı', ['özgürlük', 'ahlak'])]),
      kitap('Kitap B', [not('B alıntısı', ['özgürlük', 'ahlak'])])
    ]);
    await page.goto('/');
    await page.click('[data-act="sekme"][data-v="alinti"]');
    const k = await page.evaluate(() => window.__fikirag.komsular('özgürlük'));
    expect(k).toEqual([{ ad: 'ahlak', notlar: 2, kitapSayisi: 2, kitaptaBirlikte: 2 }]);
    await fikirSec(page, 'özgürlük');
    await expect(page.locator('#panel-alinti #faKomsuKart [data-act="fa-kesisim"]')).toContainText('2 kitap');
  });

  test('ikincil ölçüt: aynı kitapta ayrı notlarda geçenler ayrı sayılır', async ({ page }) => {
    await tohumla(page, [kitap('Tek Kitap', [
      not('İlk not', ['a-fikri']), not('İkinci not', ['b-fikri'])])]);
    await page.goto('/');
    await page.click('[data-act="sekme"][data-v="alinti"]');
    const c = await page.evaluate(() => window.__fikirag.esGecim());
    expect(c.length).toBe(1);
    expect(c[0]).toMatchObject({ notlar: 0, kitaptaBirlikte: 1 });   // aynı notta DEĞİL
    const k = await page.evaluate(() => window.__fikirag.komsular('a-fikri'));
    expect(k).toEqual([]);   // birincil ölçüt sıfır → komşu listesinde yok
  });
});

test.describe('G17 M2 — kesişim görünümü', () => {

  test('kesişim yalnız İKİ etiketi de taşıyan notları listeler ve kitabı yazar', async ({ page }) => {
    await tohumla(page, [
      kitap('Heidegger Kitabı', [
        not('Birlikte olan alıntı', ['varlık', 'zaman'], 12),
        not('Yalnız varlık', ['varlık'])]),
      kitap('Proust Kitabı', [
        not('İkinci birlikte alıntı', ['varlık', 'zaman'], 40),
        not('Alakasız alıntı', ['bellek'])])
    ]);
    await alintiAc(page);
    await fikirSec(page, 'varlık');
    await page.click('#panel-alinti #faKomsuKart [data-act="fa-kesisim"][data-v="zaman"]');
    const kesisim = page.locator('#panel-alinti #faKesisimKart');
    await expect(kesisim).toBeVisible();
    await expect(kesisim.locator('.fa-kesisim-not')).toHaveCount(2);   // yalnız ikisi
    await expect(kesisim).toContainText('Birlikte olan alıntı');
    await expect(kesisim).toContainText('İkinci birlikte alıntı');
    await expect(kesisim).not.toContainText('Yalnız varlık');
    // kaynak kitap adı görünür (kitaplar arası bağ kurmanın amacı)
    await expect(kesisim.locator('.fa-kesisim-kaynak').first()).toContainText('Heidegger Kitabı');
    await expect(kesisim.locator('.fa-kesisim-kaynak').nth(1)).toContainText('Proust Kitabı');
    await expect(kesisim).toContainText('2 not, 2 kitap');
  });

  test('kesişimden çıkış yolu çalışır', async ({ page }) => {
    await tohumla(page, [
      kitap('K1', [not('n1', ['x-fikri', 'y-fikri'])]),
      kitap('K2', [not('n2', ['x-fikri', 'y-fikri'])])
    ]);
    await alintiAc(page);
    await fikirSec(page, 'x-fikri');
    await page.click('#panel-alinti [data-act="fa-kesisim"][data-v="y-fikri"]');
    await expect(page.locator('#panel-alinti #faKesisimKart')).toBeVisible();
    await page.click('#panel-alinti [data-act="fa-kesisim-kapat"]');
    expect(await page.locator('#panel-alinti #faKesisimKart').count()).toBe(0);
    await expect(page.locator('#panel-alinti #faKomsuKart')).toBeVisible();   // komşulara döndük
  });
});

test.describe('G17 M3 — fikir haritası', () => {

  /* fikirler: cok-not (4 not/1 kitap), cok-kitap (3 not/3 kitap), cok-bag (2 not, 3 komşu) */
  function haritaKitaplari() {
    return [
      kitap('K1', [
        not('n1', ['cok-not']), not('n2', ['cok-not']), not('n3', ['cok-not']),
        not('n4', ['cok-not', 'cok-kitap']),
        not('n5', ['cok-bag', 'a1']), not('n6', ['cok-bag', 'a2'])]),
      kitap('K2', [not('n7', ['cok-kitap'])]),
      kitap('K3', [not('n8', ['cok-kitap'])])
    ];
  }

  test('en çok kullanılan sıralaması doğru', async ({ page }) => {
    await tohumla(page, haritaKitaplari());
    await alintiAc(page);
    const h = await page.evaluate(() => { window.__fikirag.siralaYaz('not'); return window.__fikirag.harita(); });
    expect(h[0].ad).toBe('cok-not');
    expect(h[0].notSayisi).toBe(4);
  });

  test('en çok kitaba yayılan sıralaması doğru ve vurgulanır', async ({ page }) => {
    await tohumla(page, haritaKitaplari());
    await alintiAc(page);
    await page.click('#panel-alinti #faSiraSec [data-act="fa-sirala"][data-v="kitap"]');
    const h = await page.evaluate(() => window.__fikirag.harita());
    expect(h[0].ad).toBe('cok-kitap');
    expect(h[0].kitapSayisi).toBe(3);
    await expect(page.locator('#panel-alinti #faYaygin')).toContainText('cok-kitap');
    await expect(page.locator('#panel-alinti #faYaygin')).toContainText('3 kitap');
  });

  test('en çok bağlantılı sıralaması doğru', async ({ page }) => {
    await tohumla(page, haritaKitaplari());
    await alintiAc(page);
    await page.click('#panel-alinti #faSiraSec [data-act="fa-sirala"][data-v="baglanti"]');
    const h = await page.evaluate(() => window.__fikirag.harita());
    expect(h[0].ad).toBe('cok-bag');
    expect(h[0].komsuSayisi).toBe(2);   // a1 ve a2 ile birlikte geçti
    await expect(page.locator('#panel-alinti #faSiraSec .fa-cip.fa-secili')).toContainText('bağlantılı');
  });

  test('haritadan fikir seçilince komşu kartı açılır', async ({ page }) => {
    await tohumla(page, [
      kitap('K1', [not('n1', ['seçilecek', 'komşu'])]),
      kitap('K2', [not('n2', ['seçilecek', 'komşu'])])
    ]);
    await alintiAc(page);
    await page.click('#panel-alinti #faHaritaKart [data-act="fa-sec"][data-v="seçilecek"]');
    await expect(page.locator('#panel-alinti #faKomsuKart')).toContainText('#seçilecek');
  });
});

test.describe('G17 M4 — ilişki önerisi', () => {

  /* 5+ etiket: hedef, birlikte, oneri1, oneri2, uzak */
  function oneriKitaplari() {
    return [
      kitap('Ortak Kitap', [
        not('n1', ['hedef', 'birlikte']),
        not('n2', ['oneri1']),
        not('n3', ['oneri2'])]),
      kitap('Uzak Kitap', [not('n4', ['uzak'])])
    ];
  }

  test('birlikte etiketlenmemiş ama aynı kitapta geçen fikir önerilir', async ({ page }) => {
    await tohumla(page, oneriKitaplari());
    await alintiAc(page);
    const o = await page.evaluate(() => window.__fikirag.oneriler('hedef'));
    const adlar = o.map(x => x.ad).sort();
    expect(adlar).toEqual(['oneri1', 'oneri2']);
    expect(o[0].ortakKitap).toBe(1);
    await fikirSec(page, 'hedef');
    await expect(page.locator('#panel-alinti #faOneriKart')).toContainText('oneri1');
  });

  test('birlikte etiketlenmiş fikir ÖNERİLMEZ, uzak kitaptaki de gelmez', async ({ page }) => {
    await tohumla(page, oneriKitaplari());
    await alintiAc(page);
    const adlar = await page.evaluate(() => window.__fikirag.oneriler('hedef').map(x => x.ad));
    expect(adlar).not.toContain('birlikte');   // aynı notta etiketlenmiş
    expect(adlar).not.toContain('uzak');       // başka kitapta
    await fikirSec(page, 'hedef');
    await expect(page.locator('#panel-alinti #faOneriKart')).not.toContainText('#birlikte');
  });

  test('5\'ten az etiketle öneri bölümü görünmez', async ({ page }) => {
    await tohumla(page, [kitap('K1', [
      not('n1', ['a', 'b']), not('n2', ['c']), not('n3', ['d'])])]);   // 4 etiket
    await alintiAc(page);
    expect(await page.evaluate(() => window.__fikirag.oneriler('a'))).toEqual([]);
    await fikirSec(page, 'a');
    expect(await page.locator('#panel-alinti #faOneriKart').count()).toBe(0);
  });
});

test.describe('G17 — bütünlük', () => {

  test('fikir.js davranışı bozulmadı: etiket ekleme, silme, filtre', async ({ page }) => {
    await tohumla(page, [kitap('K1', [not('Etiketlenecek alıntı', [])])]);
    await alintiAc(page);
    // ekleme
    await page.locator('#panel-alinti .not-kart .fikir-giris').fill('yeni-fikir');
    await page.locator('#panel-alinti .not-kart [data-act="fikir-ekle"]').click();
    await expect(page.locator('#toast')).toContainText('Fikir eklendi');
    expect(await page.evaluate(() => veri.kitaplar[0].notlar[0].fikir)).toEqual(['yeni-fikir']);
    // filtre
    await page.click('#panel-alinti #fikirBulut [data-act="fikir-filtre"][data-v="yeni-fikir"]');
    await expect(page.locator('#panel-alinti #fikirBaslik')).toContainText('yeni-fikir');
    await expect(page.locator('#panel-alinti .not-kart:visible')).toHaveCount(1);
    // silme
    await page.locator('#panel-alinti .not-kart [data-act="fikir-sil"]').click();
    await expect(page.locator('#toast')).toContainText('kaldırıldı');
    expect(await page.evaluate(() => veri.kitaplar[0].notlar[0].fikir)).toEqual([]);
  });

  test('hiç etiket yokken panel anlamlı boş mesaj verir, çökme yok', async ({ page }) => {
    const hatalar = [];
    await tohumla(page, [kitap('K1', [not('Etiketsiz alıntı', [])])]);
    page.on('pageerror', h => hatalar.push(String(h)));
    await alintiAc(page);
    await expect(page.locator('#panel-alinti #faBos')).toContainText('Henüz fikir etiketi yok');
    expect(await page.evaluate(() => window.__fikirag.esGecim())).toEqual([]);
    expect(await page.evaluate(() => window.__fikirag.enYaygin())).toBeNull();
    expect(hatalar).toEqual([]);
  });

  test('hiç kitap yokken bile çökme yok', async ({ page }) => {
    const hatalar = [];
    await page.goto('/');
    page.on('pageerror', h => hatalar.push(String(h)));
    await page.click('[data-act="sekme"][data-v="alinti"]');
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.__fikirag.harita())).toEqual([]);
    expect(hatalar).toEqual([]);
  });
});
