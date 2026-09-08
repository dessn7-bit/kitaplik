'use strict';
/* G112 (v119) — İSTATİSTİK TABAN DÜRÜSTLÜĞÜ
 *
 * NEDEN: "Türlere göre (tüm raf)" başlığı rafın TAMAMINI gösterdiğini iddia
 * ediyordu ama çubuk İKİ kez daralıyordu ve ikisi de söylenmiyordu:
 *   (1) türü boş kitaplar hiçbir çubuğa girmiyor,
 *   (2) yalnız ilk 8 tür çiziliyor.
 * Kaan'ın verisinde ölçüldü: raf 299, türlü 254, çizilen 219 — yani rafın
 * %73'ü gösterilip "tüm raf" deniyordu. Aynı sessiz daralma puan dağılımı,
 * yazar listesi ve aylık sayfa toplamında da vardı.
 * KURAL: sayı uydurulmaz, eksik AÇIKÇA yazılır (istTarihsiz v63 emsali) ve
 * eksik YOKSA satır GÖRÜNMEZ (gürültü yapmaz).
 */
const { test, expect, tohumla, sahteKitap, rafAc, bugunISO } = require('./yardim');

async function istAc(page) {
  await rafAc(page);
  await page.click('[data-act="sekme"][data-v="ist"]');
}
/* 8'den fazla tür üretir: t1..tN, her biri azalan sayıda */
function turluKitaplar(turSayisi, herBirinden) {
  const l = [];
  for (let i = 1; i <= turSayisi; i++)
    for (let j = 0; j < herBirinden; j++)
      l.push(sahteKitap({ ad: `T${i}-${j}`, tur: 'Tur' + i }));
  return l;
}

test.describe('G112 istatistik taban dürüstlüğü (v119)', () => {

  test('A) başlık artık "tüm raf" iddiası taşımaz', async ({ page }) => {
    await tohumla(page, [sahteKitap({ tur: 'Roman' })]);
    await istAc(page);
    await expect(page.locator('#istTurler')).toHaveText('Türlere göre');
    await expect(page.locator('#istTurler')).not.toContainText('tüm raf');
  });

  test('B) türsüz kayıt varken taban notu sayıyı AÇIKÇA verir', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'a', tur: 'Roman' }), sahteKitap({ ad: 'b', tur: 'Roman' }),
      sahteKitap({ ad: 'c', tur: 'Tiyatro' }),
      sahteKitap({ ad: 'd', tur: '' }), sahteKitap({ ad: 'e', tur: '' })
    ]);
    await istAc(page);
    const not = page.locator('#istTurTaban');
    await expect(not).toContainText('Çubuklar 3 kitabı gösteriyor');
    await expect(not).toContainText('raftaki 5 kitaptan');
    await expect(not).toContainText('2 kitabın türü boş');
  });

  test('C) türsüz YOKSA "türü boş" cümlesi ÇIKMAZ ama taban yine yazılır', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'a', tur: 'Roman' }), sahteKitap({ ad: 'b', tur: 'Tiyatro' })
    ]);
    await istAc(page);
    const not = page.locator('#istTurTaban');
    await expect(not).toContainText('Çubuklar 2 kitabı gösteriyor');
    await expect(not).toContainText('raftaki 2 kitaptan');
    await expect(not).not.toContainText('türü boş');
  });

  test('D) ilk-8 kırpması açıklanır (10 tür → 8 çubuk + kalan bildirilir)', async ({ page }) => {
    /* 10 tür × 2 kitap = 20 kitap; ilk 8 tür = 16 kitap, kalan 2 tür = 4 kitap */
    await tohumla(page, turluKitaplar(10, 2));
    await istAc(page);
    const not = page.locator('#istTurTaban');
    await expect(not).toContainText('Çubuklar 16 kitabı gösteriyor');
    await expect(not).toContainText('raftaki 20 kitaptan');
    await expect(not).toContainText('4 kitap listede olmayan 2 türde');
    await expect(not).not.toContainText('türü boş');
  });

  test('E) iki daralma birlikte: hem kırpma hem türsüz aynı notta', async ({ page }) => {
    await tohumla(page, [...turluKitaplar(10, 2),
      sahteKitap({ ad: 'x', tur: '' }), sahteKitap({ ad: 'y', tur: '' })]);
    await istAc(page);
    const not = page.locator('#istTurTaban');
    await expect(not).toContainText('Çubuklar 16 kitabı gösteriyor');
    await expect(not).toContainText('raftaki 22 kitaptan');
    await expect(not).toContainText('4 kitap listede olmayan 2 türde');
    await expect(not).toContainText('2 kitabın türü boş');
  });

  test('F) puan dağılımı tabanı: puansız varken söylenir', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'p1', durum: 'bitti', puan: 8, bitisTarihi: bugunISO(-3) }),
      sahteKitap({ ad: 'p2', durum: 'bitti', puan: 9, bitisTarihi: bugunISO(-4) }),
      sahteKitap({ ad: 'p3', durum: 'bitti', puan: null, bitisTarihi: bugunISO(-5) })
    ]);
    await istAc(page);
    const not = page.locator('#istPuanTaban');
    await expect(not).toContainText('2 puanlanmış kitaptan');
    await expect(not).toContainText('3 bitmiş kitaptan');
    await expect(not).toContainText('1 kitap puansız');
  });

  test('G) puansız YOKSA o cümle çıkmaz, taban yine yazılır', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'p1', durum: 'bitti', puan: 8, bitisTarihi: bugunISO(-3) }),
      sahteKitap({ ad: 'p2', durum: 'bitti', puan: 9, bitisTarihi: bugunISO(-4) })
    ]);
    await istAc(page);
    const not = page.locator('#istPuanTaban');
    await expect(not).toContainText('2 puanlanmış kitaptan');
    await expect(not).not.toContainText('puansız');
  });

  test('H) yazarsız bitmiş kitap varsa listede olmadığı SÖYLENİR; yoksa satır GİZLİ', async ({ page }) => {
    /* yazarı olan iki kitap aynı yazardan (n>1 şartı) ki liste çizilsin */
    await tohumla(page, [
      sahteKitap({ ad: 'y1', yazar: 'Ortak Yazar', durum: 'bitti', bitisTarihi: bugunISO(-3) }),
      sahteKitap({ ad: 'y2', yazar: 'Ortak Yazar', durum: 'bitti', bitisTarihi: bugunISO(-4) }),
      sahteKitap({ ad: 'y3', yazar: '', durum: 'bitti', bitisTarihi: bugunISO(-5) })
    ]);
    await istAc(page);
    await expect(page.locator('#istYazarsiz')).toContainText('1 bitmiş kitapta yazar boş');
  });

  test('I) yazarsız yokken satır hiç çizilmez (gürültü yapmaz)', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'y1', yazar: 'Ortak Yazar', durum: 'bitti', bitisTarihi: bugunISO(-3) }),
      sahteKitap({ ad: 'y2', yazar: 'Ortak Yazar', durum: 'bitti', bitisTarihi: bugunISO(-4) })
    ]);
    await istAc(page);
    await expect(page.locator('#istYazarsiz')).toHaveCount(0);
  });

  test('J) sayfasız kitap aylık toplamı eksiltiyorsa söylenir', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 's1', durum: 'bitti', sayfa: 300, bitisTarihi: bugunISO(-10) }),
      sahteKitap({ ad: 's2', durum: 'bitti', sayfa: null, bitisTarihi: bugunISO(-12) })
    ]);
    await istAc(page);
    await expect(page.locator('#istSayfasiz')).toContainText('1 kitapta sayfa sayısı yok');
  });

  test('K) ÇUBUK SAYILARI DEĞİŞMEDİ — not eklendi, veri bozulmadı', async ({ page }) => {
    await tohumla(page, [
      sahteKitap({ ad: 'a', tur: 'Roman' }), sahteKitap({ ad: 'b', tur: 'Roman' }),
      sahteKitap({ ad: 'c', tur: 'Tiyatro' }), sahteKitap({ ad: 'd', tur: '' })
    ]);
    await istAc(page);
    const satirlar = await page.evaluate(() => {
      const bas = document.getElementById('istTurler');
      const c = [];
      let el = bas && bas.nextElementSibling;
      while (el && el.classList.contains('bar-satir')) {
        c.push([el.querySelector('.bar-ad').textContent.trim(),
                el.querySelector('.bar-deger').textContent.trim()]);
        el = el.nextElementSibling;
      }
      return c;
    });
    expect(satirlar).toEqual([['Roman', '2'], ['Tiyatro', '1']]);   // türsüz çubuk YOK
  });
});
