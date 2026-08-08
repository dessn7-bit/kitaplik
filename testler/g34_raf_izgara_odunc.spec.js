/* G34 — Kütüphane = raf (izgara varsayılan) + ödünç UI söküm + bayat metin.
   Sözleşme:
   - Tercih YOKSA Kütüphane İZGARADA açılır (kapak duvarı); kayıtlı liste
     tercihi varsa listede (saygı). tohumla varsayılan olarak liste basar
     (davranış-koruyucu göç) — buradaki vakalar {kk_gorunum_v1:null} sentineliyle
     tohumsuz koşar.
   - Raf gruplama düğmesi yalnız raf verisi VARKEN görünür.
   - Bitmiş kitap izgarada sönük (iz-okundu) — okunmamışlar öne çıkar.
   - Ödünç UI'ı YOK; veri modeli ve senkron birleşimi yaşıyor (g26 emsali).
   - Boş raf metni kalkmış "Ara" akışını anlatmaz. */
'use strict';
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc } = require('./yardim');

test.describe('G34 raf görünümü', () => {

  test('M1a: tercih yokken Kütüphane izgarada açılır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Duvar Kitabı' })], { kk_gorunum_v1: null });
    await rafAc(page);
    await expect(page.locator('#liste')).toHaveClass(/izgara/);
    await expect(page.locator('#liste .iz-yedek')).toHaveCount(1);   // kapaksız → levha içinde ad
    // v42: üç düzen anahtarında aktif seçim izgara
    await expect(page.locator('#duzenIzgara')).toHaveClass(/aktif/);
    await expect(page.locator('#duzenListe')).not.toHaveClass(/aktif/);
  });

  test('M1b: kayıtlı LİSTE tercihi varsa ona saygı duyulur', async ({ page }) => {
    await tohumla(page, [sahteKitap()], { kk_gorunum_v1: '{"izgara":false,"rafGrupla":false}' });
    await rafAc(page);
    await expect(page.locator('#liste')).not.toHaveClass(/izgara/);
    await expect(page.locator('#liste .kart .kart-alt')).toHaveCount(1);  // liste düzeni
  });

  /* v43 (D2d): eksen veri yokken de SEÇİLEBİLİR — gruplama zorlanmaz, dürüst
     not çıkar; veri gelince aynı seçim gruplamaya dönüşür. */
  test('M1c: raf ekseni veri yokken dürüst not verir, veri gelince gruplar', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Rafsız Kitap' })], { kk_gorunum_v1: null });
    await rafAc(page);
    await expect(page.locator('#liste')).toHaveClass(/izgara/);
    await page.click('#grupRaf');
    await expect(page.locator('#grupBosNot')).toBeVisible();
    await expect(page.locator('#grupBosNot')).toContainText('Raf konumu');
    await expect(page.locator('#liste .raf-basligi')).toHaveCount(0); // tek "belirtilmemiş" kovası ZORLANMAZ
    // raf verisi gelince aynı eksen gruplar, not kaybolur
    await page.evaluate(() => {
      veri.kitaplar[0].raf = 'üst raf'; depoKaydet(); listeCiz();
    });
    await expect(page.locator('#grupBosNot')).toBeHidden();
    await expect(page.locator('#liste .raf-basligi')).toHaveCount(1);
  });

  /* v42 KARAR: okunmuş işareti sönükleştirme (opacity/grayscale) DEĞİL — Ciltli
     durum satırı: karo altında "✓ Okundu" (SVG onay + sessiz metin), okunuyor
     altın. Kapaklar tam görünür kalır (kapak duvarında bilgi kaybı yok). */
  test('M1d: bitmiş kitap izgarada ✓ Okundu satırı taşır, kapak sönükleşmez', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'Okunmuş Kitap', durum: 'bitti', sayfa: 100, bitisTarihi: bugunISO() }),
      sahteKitap({ ad: 'Okunmamış Kitap', durum: 'okunacak' })
    ], { kk_gorunum_v1: null });
    await rafAc(page);
    const okunmus = page.locator('#liste .kart', { hasText: 'Okunmuş Kitap' });
    const okunmamis = page.locator('#liste .kart', { hasText: 'Okunmamış Kitap' });
    await expect(okunmus).toHaveClass(/iz-okundu/);
    await expect(okunmamis).not.toHaveClass(/iz-okundu/);
    // durum satırı: okunmuşta onay SVG'si + "Okundu"; okunmamışta ikonsuz "Okunacak"
    await expect(okunmus.locator('.iz-durum')).toContainText('Okundu');
    await expect(okunmus.locator('.iz-durum svg.ikon')).toHaveCount(1);
    await expect(okunmamis.locator('.iz-durum')).toContainText('Okunacak');
    await expect(okunmamis.locator('.iz-durum svg.ikon')).toHaveCount(0);
    // kapak levhası SÖNÜKLEŞMEZ: iki karonun görseli de tam opak
    const o1 = await okunmus.locator('.iz-yedek').evaluate(el => parseFloat(getComputedStyle(el).opacity));
    const o2 = await okunmamis.locator('.iz-yedek').evaluate(el => parseFloat(getComputedStyle(el).opacity));
    expect(o1, 'okunmuş kapak tam görünür (v42)').toBe(1);
    expect(o2, 'okunmamış tam').toBe(1);
    // başlık tam opak kalır (bilgi kaybolmaz)
    expect(await okunmus.locator('.kart-baslik')
      .evaluate(el => parseFloat(getComputedStyle(el).opacity))).toBe(1);
  });

  test('M1e: izgarada detay açılır ve seçim modu çalışır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Etkileşim Kitabı' })], { kk_gorunum_v1: null });
    await rafAc(page);
    await page.click('#liste .kart');
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await expect(page.locator('#detayIcerik')).toContainText('Etkileşim Kitabı');
    await page.click('[data-act="detay-kapat"]');
    // seçim modu
    await page.click('#secimBtn');
    await page.click('#liste .kart');
    await expect(page.locator('#topluSayi')).toHaveText('1 seçili');
    await page.click('[data-act="toplu-cik"]');
  });

  /* ---------- M2 ödünç söküm ---------- */
  test('M2a+b: detayda ödünç bölümü YOK, çip şeridinde Ödünçte YOK', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Sade Kitap' })]);
    await rafAc(page);
    await expect(page.locator('#durumChips [data-v="odunc"]')).toHaveCount(0);
    await page.click('#liste .kart');
    await expect(page.locator('#detayIcerik')).toContainText('Sade Kitap');
    await expect(page.locator('#dOduncKatla')).toHaveCount(0);
    await expect(page.locator('[data-act="odunc-ver"]')).toHaveCount(0);
    await expect(page.locator('[data-act="odunc-al"]')).toHaveCount(0);
  });

  test('M2c: ödünç VERİSİ olan eski kitap açılır, çökme yok, veri korunur, rozet yok', async ({ page }) => {
    const hatalar = [];
    await tohumla(page, [sahteKitap({ ad: 'Eski Ödünçlü', odunc: [
      { kisi: 'Ali', verilis: '2026-07-01', donus: null },
      { kisi: 'Ayşe', verilis: '2026-05-01', donus: '2026-06-01' }
    ] })]);
    page.on('pageerror', h => hatalar.push(String(h)));
    await rafAc(page);
    await expect(page.locator('#liste .kart .r-odunc')).toHaveCount(0);
    await page.click('#liste .kart');
    await expect(page.locator('#detayIcerik')).toContainText('Eski Ödünçlü');
    await expect(page.locator('#detayIcerik .r-odunc')).toHaveCount(0);
    // veri modeli DOKUNULMAMIŞ: alan yenilemede de korunur (kitapNormalize)
    const odunc = await page.evaluate(() => veri.kitaplar[0].odunc);
    expect(odunc.length).toBe(2);
    expect(odunc[0].kisi).toBe('Ali');
    expect(hatalar).toEqual([]);
  });

  test('M2d: senkron birleşimi ödünç dizisini hâlâ doğru birleştirir (UI olmadan)', async ({ page }) => {
    // g26'daki veri-düzeyi sözleşmenin v40 sonrası da yaşadığının kanıtı:
    // birlestir saf fonksiyon, UI'dan bağımsız — iade kaydı kazanır.
    await tohumla(page, []);
    await page.goto('/');
    const k = await page.evaluate(() => {
      const a = { id: 'x', ad: 'K', g: 200, odunc: [{ kisi: 'Ali', verilis: '2026-01-01', donus: null }] };
      const b = { id: 'x', ad: 'K', g: 100, odunc: [{ kisi: 'Ali', verilis: '2026-01-01', donus: '2026-02-01' },
        { kisi: 'Veli', verilis: '2026-03-01', donus: null }] };
      return window.__senkron.birlestir(
        { kitaplar: [a], silinenler: {} }, { kitaplar: [b], silinenler: {} }).kitaplar[0];
    });
    expect(k.odunc.length).toBe(2);
    expect(k.odunc.find(o => o.kisi === 'Ali').donus).toBe('2026-02-01');
  });

  /* ---------- M3 bayat metin ---------- */
  test('M3: boş raf mesajı kalkmış "Ara" akışını anlatmaz, canlı öneriyi anlatır', async ({ page }) => {
    await tohumla(page, []);
    await rafAc(page);
    await expect(page.locator('#liste')).toContainText('Raf henüz boş.');
    const metin = await page.locator('#liste .bos').innerText();
    expect(metin).not.toContain('"Ara"');
    expect(metin).toContain('yazmaya başla');
  });
});
