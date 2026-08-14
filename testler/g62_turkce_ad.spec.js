'use strict';
/* G62 — TÜRKÇE AD ALANI (adTr, v73): 88 kitap Goodreads'te TR baskı
   bulunamadığı için yabancı başlıkla ekli — yanında Türkçe adı da dursun.

   SÖZLEŞMELER (bu dosyanın koruduğu):
   - adTr kitapNormalize'da: yenilemede korunur, senkron LWW ile taşınır,
     ANLIK_SURUM 10 (göç turu damga basmaz — yerleşik desen).
   - ARAMA adTr'yi kapsar ("Kucuk Prens" → "The Little Prince").
   - DETAY künyesinde "Türkçe adı" satırı: dolu ise VAR, boş ise YOK.
   - KEŞFET elemesi hem ad hem adTr üzerinden: v69'un TR-EN sınırı
     ("Suç ve Ceza"/"Crime and Punishment") adTr kayıtlıysa KAPANIR.
   - YERLEŞİK liste (veri/turkce-adlar-yerlesik.json, 88 kayıt) v67/v70
     borusunun cfg-parametreli genellemesinden geçer: önizleme + onay +
     YALNIZ adTr yazımı + damga + eşleşmeyen raporu; taksonomi kapısı YOK.
   - Formdan elle Türkçe ad girilir ve korunur; CSV'de sütun var.
   (Mutasyon 1: adTr normalize'dan çıkarılır → kalıcılık vakası kırmızı.
    Mutasyon 2: bElenmis'ten adTr karşılaştırmaları kaldırılır → eleme
    vakası kırmızı.) */
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc, ayarlarAc, ayrintilarAc } = require('./yardim');
const YERLESIK = require('../veri/turkce-adlar-yerlesik.json');

function bitmis(ek) {
  return sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30) }, ek));
}

test.describe('G62 Türkçe ad alanı', () => {

  test('yerleşik dosya sözleşmesi: 88 kayıt, alanlar dolu, biçim birebir', async () => {
    expect(YERLESIK.surum).toBe(1);
    expect(YERLESIK.adTr.length).toBe(88);
    for (const r of YERLESIK.adTr) {
      expect(r.ad.trim().length, r.ad).toBeGreaterThan(0);
      expect(r.yazar.trim().length).toBeGreaterThan(0);
      expect(r.adTr.trim().length).toBeGreaterThan(0);
    }
    // biçim birebir: çift boşluk korunmuş
    expect(YERLESIK.adTr.find(r => r.ad.includes('Maze of Bones')).ad)
      .toBe('The Maze of Bones  (The 39 Clues, #1)');
    expect(YERLESIK.adTr.find(r => r.ad === 'The Little Prince').adTr).toBe('Küçük Prens');
  });

  test('adTr yenilemede korunur, senkron birleşiminde taşınır, ANLIK_SURUM 10', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'The Little Prince',
      yazar: 'Antoine de Saint-Exupéry', adTr: 'Küçük Prens' })]);
    await page.goto('/');
    await page.reload();
    expect(await page.evaluate(() => veri.kitaplar[0].adTr), 'normalize korur').toBe('Küçük Prens');
    // ">= 10": sabit eşitlik sonraki şema artışında kırılır (v50 dersi)
    expect(await page.evaluate(() => window.__senkron.ANLIK_SURUM)).toBeGreaterThanOrEqual(10);
    const b = await page.evaluate(() => {
      const yerel = { ...veri.kitaplar[0], adTr: '', g: 100 };
      const uzak = { ...veri.kitaplar[0], adTr: 'Küçük Prens', g: 200 };
      return window.__senkron.birlestir(
        { kitaplar: [yerel], silinenler: {} }, { kitaplar: [uzak], silinenler: {} }).kitaplar[0];
    });
    expect(b.adTr, 'kitap-LWW taşır').toBe('Küçük Prens');
  });

  test('ARAMA adTr üzerinden çalışır: "Kucuk Prens" → The Little Prince', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'The Little Prince', yazar: 'Antoine de Saint-Exupéry', adTr: 'Küçük Prens' }),
      sahteKitap({ ad: 'Alakasız Kitap', yazar: 'Başka Yazar' })]);
    await rafAc(page);
    await page.fill('#arama', 'Kucuk Prens');
    await expect(page.locator('#liste .kart')).toHaveCount(1);
    await expect(page.locator('#liste .kart-baslik')).toHaveText('The Little Prince');
    await page.fill('#arama', 'little');   // asıl ad da aranabilir kalır
    await expect(page.locator('#liste .kart')).toHaveCount(1);
  });

  test('DETAY künyesi: "Türkçe adı" satırı dolu ise VAR, boş ise YOK', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'The Little Prince', yazar: 'Y1', adTr: 'Küçük Prens' }),
      sahteKitap({ ad: 'Yerli Kitap', yazar: 'Y2' })]);
    await rafAc(page);
    await page.locator('#liste .kart', { hasText: 'The Little Prince' }).click();
    const kunye = page.locator('#dKunyeTablo');
    await expect(kunye).toContainText('Türkçe adı');
    await expect(kunye).toContainText('Küçük Prens');
    await page.keyboard.press('Escape');
    await page.locator('#liste .kart', { hasText: 'Yerli Kitap' }).click();
    await expect(page.locator('#dKunyeTablo')).not.toContainText('Türkçe adı');
  });

  test('KEŞFET elemesi: adTr çapraz-dil çiftini yakalar (v69 TR-EN sınırı kapandı)', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Taban 1', yazar: 'Taban Yazar 1', puan: 6 }),
      bitmis({ ad: 'Taban 2', yazar: 'Taban Yazar 2', puan: 5 }),
      bitmis({ ad: 'Taban 3', yazar: 'Taban Yazar 3', puan: 6 }),
      bitmis({ ad: 'Crime and Punishment', yazar: 'Fyodor Dostoyevski',
        adTr: 'Suç ve Ceza', puan: 9 }),
      bitmis({ ad: 'Beyaz Geceler', yazar: 'Fyodor Dostoyevski', puan: 10 })]);
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="kesfet"]');
    await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
    const gItem = (ad) => ({ volumeInfo: { title: ad, authors: ['Fyodor Dostoyevski'],
      publisher: 'Y', publishedDate: '2020', pageCount: 300, language: 'tr' } });
    page.__agAyar.google = { items: [
      gItem('Suç ve Ceza'),                 // adTr BİREBİR → elenmeli
      gItem('Suç ve Ceza (Özel Baskı)'),    // adTr VARYANTI (adBenzer) → elenmeli
      gItem('Budala')] };                    // kütüphanede yok → kalmalı
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item', { hasText: 'Budala' })).toBeVisible();
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(1);
  });

  test('KEŞFET: cilt-işareti koruması adTr yolunda da işler (devam cildi yutulmaz)', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Taban 1', yazar: 'Taban Yazar 1', puan: 6 }),
      bitmis({ ad: 'Taban 2', yazar: 'Taban Yazar 2', puan: 5 }),
      bitmis({ ad: 'Taban 3', yazar: 'Taban Yazar 3', puan: 6 }),
      bitmis({ ad: 'The Lightning Thief', yazar: 'Rick Riordan', adTr: 'Şimşek Hırsızı', puan: 9 }),
      bitmis({ ad: 'The Sea of Monsters', yazar: 'Rick Riordan', adTr: 'Canavarlar Denizi', puan: 10 })]);
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="kesfet"]');
    await expect(page.locator('#ksIcerik .ks-ust')).toBeVisible();
    const gItem = (ad) => ({ volumeInfo: { title: ad, authors: ['Rick Riordan'],
      publisher: 'Y', publishedDate: '2020', pageCount: 300, language: 'tr' } });
    page.__agAyar.google = { items: [
      gItem('Şimşek Hırsızı'),        // adTr birebir → elenmeli
      gItem('Şimşek Hırsızı 2'),      // rakamlı devam cildi → cilt koruması, KALMALI
      gItem('Kızıl Piramit')] };       // kütüphanede yok → kalmalı
    await page.click('#ksB [data-act="ks-b-getir"]');
    await expect(page.locator('#ksB .ks-b-item', { hasText: 'Şimşek Hırsızı 2' })).toBeVisible();
    await expect(page.locator('#ksB .ks-b-item', { hasText: 'Kızıl Piramit' })).toBeVisible();
    await expect(page.locator('#ksB .ks-b-item')).toHaveCount(2);
  });

  test('ALINTI defteri araması da adTr kapsar (Ayarlar vaadi tutarlı)', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'The Little Prince', yazar: 'A. S-E.', adTr: 'Küçük Prens',
        notlar: [{ id: 'n1', tip: 'alinti', metin: 'Asıl önemli olan gözle görülmez.', t: 1754000000000 }] }),
      sahteKitap({ ad: 'Başka Kitap', yazar: 'B. Yazar',
        notlar: [{ id: 'n2', tip: 'alinti', metin: 'Alakasız satır.', t: 1754000000001 }] })]);
    await page.goto('/');
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    await page.fill('#alintiArama', 'Kucuk Prens');
    await expect(page.locator('#alintiListe')).toContainText('gözle görülmez');
    await expect(page.locator('#alintiListe')).not.toContainText('Alakasız satır');
  });

  test('YERLEŞİK liste: önizleme + onaysız yazım YOK + yalnız adTr yazılır + eşleşmeyen raporu', async ({ page }) => {
    const gulliver = bitmis({ ad: 'Gulliver’s Travels', yazar: 'Jonathan Swift',
      tur: 'Roman', puan: 8, sayfa: 306,
      notlar: [{ id: 'n1', tip: 'alinti', metin: 'dev not', t: 1754000000000 }] });
    await tohumla(page, [gulliver,
      sahteKitap({ ad: 'The Little Prince', yazar: 'Antoine de Saint-Exupéry' })]);
    await page.goto('/');
    const once = await page.evaluate(() => JSON.parse(JSON.stringify(veri.kitaplar[0])));
    await ayarlarAc(page);
    await page.click('[data-act="zg-adtr-hazir"]');
    const ozet = page.locator('#zgAdTrOrtu .zg-ozet');
    await expect(ozet).toContainText('2');
    await expect(ozet).toContainText('boş Türkçe ad dolacak');
    // eşleşmeyen raporu dosyadan bağımsız hesapla
    await expect(ozet).toContainText((YERLESIK.adTr.length - 2) + ' kayıt kütüphanede bulunamadı');
    // onay YOKKEN tek bayt yazılmadı
    expect(await page.evaluate(() => veri.kitaplar.map(k => k.adTr))).toEqual(['', '']);
    await page.click('[data-act="zg-adtr-uygula"]');
    await expect(page.locator('#toast')).toContainText('2 kitabın Türkçe adı dosyadan yazıldı');
    const sonra = await page.evaluate(() => JSON.parse(JSON.stringify(veri.kitaplar[0])));
    expect(sonra.adTr, 'kesme U+2019 katlamayla eşleşti').toBe("Güliver'in Gezileri");
    expect(sonra.g).toBeGreaterThan(0);
    // YALNIZ adTr + g değişti: ad/tur/puan/sayfa/durum/notlar birebir
    for (const alan of Object.keys(once)) {
      if (alan === 'adTr' || alan === 'g') continue;
      expect(JSON.stringify(sonra[alan]), 'alan bozulmadı: ' + alan).toBe(JSON.stringify(once[alan]));
    }
    const prens = await page.evaluate(() =>
      veri.kitaplar.find(k => k.ad === 'The Little Prince').adTr);
    expect(prens).toBe('Küçük Prens');
  });

  test('YERLEŞİK liste: Vazgeç iz bırakmaz', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'The Little Prince', yazar: 'Antoine de Saint-Exupéry' })]);
    await page.goto('/');
    await ayarlarAc(page);
    await page.click('[data-act="zg-adtr-hazir"]');
    await expect(page.locator('#zgAdTrOrtu .zg-ozet')).toBeVisible();
    await page.click('[data-act="zg-adtr-vazgec"]');
    await expect(page.locator('#toast')).toContainText('hiçbir şey yazılmadı');
    expect(await page.evaluate(() => veri.kitaplar[0].adTr)).toBe('');
  });

  test('FORM: elle Türkçe ad girilir, kaydedilir, düzenlemede geri gelir', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Don Quixote', yazar: 'Cervantes' })]);
    await rafAc(page);
    // Düzenle düğmesi detayın katlanır bölümünde — bölümü aç
    const detayAyrintiAc = () => page.evaluate(() => {
      const b = document.querySelector('#ortuDetay [data-act="duzenle"]');
      const d = b && b.closest('details');
      if (d) d.open = true;
    });
    await page.locator('#liste .kart', { hasText: 'Don Quixote' }).click();
    await detayAyrintiAc();
    await page.click('#ortuDetay [data-act="duzenle"]');
    await ayrintilarAc(page);   // idempotent: düzenleme modunda zaten açıksa dokunmaz
    await page.fill('#f-adtr', 'Don Kişot');
    await page.click('[data-act="form-kaydet"]');
    expect(await page.evaluate(() =>
      veri.kitaplar.find(k => k.ad === 'Don Quixote').adTr)).toBe('Don Kişot');
    // düzenleme formu değeri geri getirir (kaydet sonrası detay açık kalır)
    await detayAyrintiAc();
    await page.click('#ortuDetay [data-act="duzenle"]');
    await expect(page.locator('#f-adtr')).toHaveValue('Don Kişot');
  });

  test('CSV dışa aktarımda "Türkçe Ad" sütunu var ve değer taşır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'The Little Prince', yazar: 'A. S-E.', adTr: 'Küçük Prens' })]);
    await page.goto('/');
    const csv = await page.evaluate(() => {
      let yakalanan = null;
      const eski = window.dosyaIndir;
      window.dosyaIndir = icerik => { yakalanan = icerik; };
      csvAktar();
      window.dosyaIndir = eski;
      return yakalanan;
    });
    const satirlar = csv.replace(/^﻿/, '').split('\r\n');
    expect(satirlar[0].split(';')[1]).toBe('Türkçe Ad');
    expect(satirlar[1]).toContain('Küçük Prens');
  });
});
