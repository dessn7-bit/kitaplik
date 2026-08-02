'use strict';
const { test, expect, tohumla, sahteKitap, kameraTaklit, bugunISO } = require('./yardim');

const ISBN_A = '9780132350884';
const BILINMEYEN = '9783161484100';

function gbIsbnYanit(kitap) {
  return { totalItems: 1, items: [{ volumeInfo: {
    title: kitap.ad, authors: kitap.yazar ? [kitap.yazar] : [],
    publisher: kitap.yayinevi || '', publishedDate: kitap.yil ? String(kitap.yil) : '',
    pageCount: kitap.sayfa || 0, imageLinks: null } }] };
}

async function seriAc(page) {
  await page.click('[data-act="sekme"][data-v="yedek"]');
  await page.click('[data-act="seri-ac"]');
  await expect(page.locator('#seriOrtu')).toHaveClass(/acik/);
  await expect.poll(() => page.evaluate(() => window.__akisIstendi)).toBe(true);
}

test.describe('G4 seri tarama', () => {

  test('okutulan kitap forma girmeden doğrudan kütüphaneye eklenir', async ({ page }) => {
    await kameraTaklit(page);
    await page.goto('/');
    page.__agAyar.google = gbIsbnYanit({ ad: 'Seri Kitap', yazar: 'Seri Yazar', sayfa: 200 });
    await seriAc(page);
    await page.evaluate(kod => { window.__sahteKod = kod; }, ISBN_A);
    await expect(page.locator('#seriNot')).toContainText('Eklendi: Seri Kitap', { timeout: 10000 });
    await page.evaluate(() => { window.__sahteKod = null; });
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(1);
    expect(await page.evaluate(() => veri.kitaplar[0].ad)).toBe('Seri Kitap');
    await expect(page.locator('#ortuForm')).not.toHaveClass(/acik/); // form hiç açılmadı
    await expect(page.locator('#seriListe')).toContainText('1 kitap eklendi');
  });

  test('panelde seçilen raf ve durum eklenen kitaba yazılır', async ({ page }) => {
    await kameraTaklit(page);
    await page.goto('/');
    page.__agAyar.google = gbIsbnYanit({ ad: 'Raflı Kitap', yazar: 'Y', sayfa: 150 });
    await seriAc(page);
    await page.selectOption('#seriDurum', 'bitti');
    await page.fill('#seriRaf', 'üst raf sol blok');
    await page.evaluate(kod => { window.__sahteKod = kod; }, ISBN_A);
    await expect(page.locator('#seriNot')).toContainText('Eklendi', { timeout: 10000 });
    await page.evaluate(() => { window.__sahteKod = null; });
    const k = await page.evaluate(() => veri.kitaplar[0]);
    expect(k.raf).toBe('üst raf sol blok');
    expect(k.durum).toBe('bitti');
    expect(k.guncelSayfa).toBe(150); // bitti + sayfa → güncel sayfa dolu
    expect(k.isbn).toBe(ISBN_A);
    expect(k.bitisTarihi).toBe(bugunISO());
  });

  test('aynı barkod üst üste okunursa mükerrer kayıt oluşmaz', async ({ page }) => {
    await kameraTaklit(page);
    await page.goto('/');
    page.__agAyar.google = gbIsbnYanit({ ad: 'Tek Kalmalı', yazar: 'Y' });
    await seriAc(page);
    await page.evaluate(kod => { window.__sahteKod = kod; }, ISBN_A);
    await expect(page.locator('#seriNot')).toContainText('Eklendi', { timeout: 10000 });
    await page.waitForTimeout(1600); // tarama döngüsü aynı kodu ~3 kez daha görür
    await page.evaluate(() => { window.__sahteKod = null; });
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(1);
  });

  test('zaten kayıtlı kitapta "Zaten kayıtlı" uyarısı', async ({ page }) => {
    await kameraTaklit(page);
    await tohumla(page, [sahteKitap({ ad: 'Mevcut Kitap', yazar: 'Mevcut Yazar', isbn: ISBN_A })]);
    await page.goto('/');
    page.__agAyar.google = gbIsbnYanit({ ad: 'Mevcut Kitap', yazar: 'Mevcut Yazar' });
    await seriAc(page);
    await page.evaluate(kod => { window.__sahteKod = kod; }, ISBN_A);
    await expect(page.locator('#seriNot')).toContainText('Zaten kayıtlı', { timeout: 10000 });
    await page.evaluate(() => { window.__sahteKod = null; });
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(1);
  });

  test('geri al: kitap silinir, mezar taşı bırakılır, aynı barkod hemen tekrar okunabilir', async ({ page }) => {
    await kameraTaklit(page);
    await page.goto('/');
    page.__agAyar.google = gbIsbnYanit({ ad: 'Geri Alınan', yazar: 'Y' });
    await seriAc(page);
    await page.evaluate(kod => { window.__sahteKod = kod; }, ISBN_A);
    await expect(page.locator('#seriNot')).toContainText('Eklendi', { timeout: 10000 });
    await page.evaluate(() => { window.__sahteKod = null; });
    const id = await page.evaluate(() => veri.kitaplar[0].id);
    await page.click('[data-act="seri-geri"]');
    await expect(page.locator('#toast')).toContainText('Geri alındı');
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(0);
    expect(await page.evaluate(kid => !!veri.silinenler[kid], id)).toBe(true); // mezar taşı
    // aynı barkod HEMEN tekrar okunabilmeli (4 sn'lik kilit temizlendi)
    await page.evaluate(() => { document.getElementById('seriNot').textContent = ''; });
    await page.evaluate(kod => { window.__sahteKod = kod; }, ISBN_A);
    await expect.poll(() => page.evaluate(() => veri.kitaplar.length), { timeout: 10000 }).toBe(1);
    await page.evaluate(() => { window.__sahteKod = null; });
  });

  test('aynı-kod kilidi: yavaş kaynak + sürekli tarama → 1 kayıt ve 4 sn içinde 1 kaynak sorgusu', async ({ page }) => {
    // M7 mutasyon boşluğunu kapatan vaka. Debounce'un gözlemlenebilir işi iki katlı:
    // (1) kayıt tekliği (zatenVar ikinci katman olarak da korur),
    // (2) aynı koda 4 sn içinde İKİNCİ kaynak sorgusu atılMAması — mutantı bu öldürür.
    await kameraTaklit(page);
    await page.goto('/');
    // Google yanıtını ~1.2 sn geciktir: tarama tikleri sorgu sürerken de akmaya devam eder
    await page.route(url => url.href.includes('googleapis.com/books'), async route => {
      page.__agSayac.google++;
      await new Promise(coz => setTimeout(coz, 1200));
      await route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify(gbIsbnYanit({ ad: 'Yavaş Gelen Kitap', yazar: 'Y' })) });
    });
    await seriAc(page);
    await page.evaluate(kod => { window.__sahteKod = kod; }, ISBN_A);
    await expect(page.locator('#seriNot')).toContainText('Eklendi', { timeout: 15000 });
    // kod okunmaya DEVAM ediyor — döngü aynı kodu birkaç kez daha görür
    // (4 sn'lik debounce penceresinin İÇİNDE kalacak kadar bekle)
    await page.waitForTimeout(1500);
    await page.evaluate(() => { window.__sahteKod = null; });
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(1); // tek kayıt
    expect(page.__agSayac.google).toBe(1); // 4 sn penceresinde TEK kaynak sorgusu
  });

  test('bilinmeyen ISBN eklenmez', async ({ page }) => {
    await kameraTaklit(page);
    await page.goto('/');
    await seriAc(page);
    await page.evaluate(kod => { window.__sahteKod = kod; }, BILINMEYEN);
    await expect(page.locator('#seriNot')).toContainText('bulunamadı', { timeout: 10000 });
    await page.evaluate(() => { window.__sahteKod = null; });
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(0);
  });
});
