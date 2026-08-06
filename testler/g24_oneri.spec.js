'use strict';
const { test, expect, tohumla, sahteKitap, bugunISO } = require('./yardim');

/* G24 — "Ne okusam?" öneri motoru (oneri.js, on- ad alanı)
   Tamamen yerel, açıklanabilir skorlama. Ana havuz: okunacak + sahip.
   Neden cümleleri GERÇEK veriden türer; az veride skor uydurulmaz. */

/* Puanlı bitmiş kitap fixture'ı — skorlama eşiği (3) bunlarla sağlanır. */
function bitmis(ek) {
  return sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30) }, ek));
}
function okunacak(ek) {
  return sahteKitap(Object.assign({ durum: 'okunacak', sahiplik: 'sahip' }, ek));
}
async function panelAc(page) {
  await page.click('[data-act="on-ac"]');
  await expect(page.locator('#ortuOneri')).toHaveClass(/acik/);
}
/* Skorlamayı dolduran nötr taban: 3 puanlı bitmiş kitap (eşik), alakasız yazar/tür */
function taban() {
  return [
    bitmis({ ad: 'Taban 1', yazar: 'Taban Yazar 1', tur: 'Deneme', puan: 6 }),
    bitmis({ ad: 'Taban 2', yazar: 'Taban Yazar 2', tur: 'Anı', puan: 5 }),
    bitmis({ ad: 'Taban 3', yazar: 'Taban Yazar 3', tur: 'Gezi', puan: 6 })
  ];
}

test.describe('G24 öneri motoru', () => {

  test('yüksek puanlı yazarın okunmamış kitabı en üstte, neden cümlesiyle', async ({ page }) => {
    await tohumla(page, [
      ...taban(),
      bitmis({ ad: 'Sevilen A1', yazar: 'Ursula K. Le Guin', puan: 9 }),
      bitmis({ ad: 'Sevilen A2', yazar: 'Ursula K. Le Guin', puan: 10 }),
      okunacak({ ad: 'Mülksüzler', yazar: 'Ursula K. Le Guin' }),
      okunacak({ ad: 'Nötr Kitap', yazar: 'Bilinmeyen Yazar' })
    ]);
    await page.goto('/');
    const s = await page.evaluate(() => window.__oneri.hesapla());
    expect(s.mod).toBe('skor');
    expect(s.ana[0].kitap.ad).toBe('Mülksüzler');
    expect(s.ana[0].neden).toContain('Ursula K. Le Guin');
    expect(s.ana[0].neden).toContain('2 kitaba ortalama 9,5 verdin');
    // arayüzde de ilk öğe bu
    await panelAc(page);
    await expect(page.locator('#oneriIcerik .on-item').first()).toContainText('Mülksüzler');
    await expect(page.locator('#oneriIcerik .on-item').first()).toContainText('ortalama 9,5');
  });

  test('düşük puanlı yazarın kitabı ilk 5\'e giremez', async ({ page }) => {
    const notrler = [];
    for (let i = 1; i <= 5; i++) notrler.push(okunacak({ ad: 'Nötr ' + i, yazar: 'Yazar ' + i }));
    await tohumla(page, [
      ...taban(),
      bitmis({ ad: 'Sevilmeyen B1', yazar: 'Kötü Yazar', puan: 2 }),
      bitmis({ ad: 'Sevilmeyen B2', yazar: 'Kötü Yazar', puan: 3 }),
      okunacak({ ad: 'Kötü Yazarın Yenisi', yazar: 'Kötü Yazar' }),
      ...notrler
    ]);
    await page.goto('/');
    const s = await page.evaluate(() => window.__oneri.hesapla());
    const adlar = s.ana.map(o => o.kitap.ad);
    expect(adlar.length).toBe(5);
    expect(adlar).not.toContain('Kötü Yazarın Yenisi'); // negatif yazar skoru altta bıraktı
  });

  test('seri devamı güçlü sinyal: yarım serinin sonraki cildi ilk 3\'te', async ({ page }) => {
    await tohumla(page, [
      ...taban(),
      bitmis({ ad: 'Vakıf', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 1, puan: 7 }),
      bitmis({ ad: 'Vakıf ve İmparatorluk', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 2, puan: 7 }),
      okunacak({ ad: 'İkinci Vakıf', yazar: 'Isaac Asimov', seri: 'Vakıf', ciltNo: 3 }),
      okunacak({ ad: 'Alakasız 1', yazar: 'Başka Yazar 1' }),
      okunacak({ ad: 'Alakasız 2', yazar: 'Başka Yazar 2' })
    ]);
    await page.goto('/');
    const s = await page.evaluate(() => window.__oneri.hesapla());
    const sira = s.ana.findIndex(o => o.kitap.ad === 'İkinci Vakıf');
    expect(sira).toBeGreaterThanOrEqual(0);
    expect(sira).toBeLessThan(3);
    const oge = s.ana[sira];
    expect(oge.bilesenler.seri).toBe(35);
    expect(oge.neden).toContain('Vakıf serisinin 3. cildi');
    expect(oge.neden).toContain('önceki 2 cildi bitirdin');
  });

  test('"Şimdi değil": kitap listeden çıkar, 30 gün sonra geri gelir', async ({ page }) => {
    const k = okunacak({ ad: 'Ertelenecek Kitap', yazar: 'Herhangi Yazar' });
    await tohumla(page, [...taban(), k, okunacak({ ad: 'Kalan Kitap' })]);
    await page.goto('/');
    await panelAc(page);
    await page.click(`#oneriIcerik [data-act="on-ertele"][data-id="${k.id}"]`);
    await expect(page.locator('#toast')).toContainText('30 gün sonra');
    await expect(page.locator('#oneriIcerik')).not.toContainText('Ertelenecek Kitap'); // panel tazelendi
    expect(await page.evaluate(id =>
      veri.kitaplar.find(x => x.id === id).ertelemeTarihi, k.id)).toBe(bugunISO(0));
    // tarih taklidi: 29 gün önce ertelenmiş → hâlâ gizli; 31 gün önce → geri gelir
    const gizliMi = async kayma => page.evaluate(([id, t]) => {
      veri.kitaplar.find(x => x.id === id).ertelemeTarihi = t;
      return !window.__oneri.hesapla().ana.some(o => o.kitap.id === id);
    }, [k.id, bugunISO(kayma)]);
    expect(await gizliMi(-29)).toBe(true);
    expect(await gizliMi(-31)).toBe(false);
  });

  test('ertelemeTarihi yenilemede KORUNUR ve senkron PUT\'unda taşınır', async ({ page }) => {
    let putGovde = null;
    await page.route('**/identitytoolkit.googleapis.com/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ idToken: 'sahte-token', refreshToken: 'sahte-yenile' }) }));
    await page.route('**/*firebasedatabase.app/**', route => {
      if (route.request().method() === 'PUT') putGovde = route.request().postData();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    const k = okunacak({ ad: 'Ertelenmiş Senkronlu', ertelemeTarihi: '2026-08-01', g: 5 });
    await tohumla(page, [k]);
    await page.goto('/');
    expect(await page.evaluate(() => veri.kitaplar[0].ertelemeTarihi)).toBe('2026-08-01');
    await page.reload();
    expect(await page.evaluate(() => veri.kitaplar[0].ertelemeTarihi)).toBe('2026-08-01'); // normalize elemedi
    const tamam = await page.evaluate(() => {
      window.__senkron.ayarKaydet({ oda: 'g24-test-odasi', cihaz: 'testcihaz', sonSenkron: null });
      return window.__senkron.senkronEt(true);
    });
    expect(tamam).toBe(true);
    expect(JSON.parse(putGovde).kitaplar[0].ertelemeTarihi).toBe('2026-08-01'); // senkronla taşındı
  });

  test('senkron göçü v4: sürüm atlaması kütüphaneyi yeniden damgalamaz', async ({ page }) => {
    const k = okunacak({ ad: 'Göç Kitabı v4', g: 9 });
    await tohumla(page, [k], { kk_senkron_anlik_v1: { s: 3, p: { eskiId: 'x-yz' } } });
    await page.goto('/');
    await page.evaluate(() => depoKaydet()); // damgala göç turunda koşsun
    expect(await page.evaluate(() => veri.kitaplar[0].g)).toBe(9); // damga korundu
    const anlik = await page.evaluate(() => JSON.parse(localStorage.getItem('kk_senkron_anlik_v1')));
    expect(anlik.s).toBe(await page.evaluate(() => window.__senkron.ANLIK_SURUM)); // yeni sürümle yazıldı
  });

  test('çeşitlilik: ilk 5\'te aynı yazardan en fazla 2, aynı türden en fazla 3', async ({ page }) => {
    const cokYazar = [];
    for (let i = 1; i <= 6; i++)
      cokYazar.push(okunacak({ ad: 'Tolstoy ' + i, yazar: 'Tolstoy', tur: 'Roman' }));
    await tohumla(page, [
      ...taban(),
      bitmis({ ad: 'Sevilen T', yazar: 'Tolstoy', tur: 'Roman', puan: 10 }),
      bitmis({ ad: 'Sevilen T2', yazar: 'Tolstoy', tur: 'Roman', puan: 9 }),
      ...cokYazar,
      okunacak({ ad: 'Başka Roman 1', yazar: 'Farklı Yazar 1', tur: 'Roman' }),
      okunacak({ ad: 'Başka Roman 2', yazar: 'Farklı Yazar 2', tur: 'Roman' }),
      okunacak({ ad: 'Şiir Kitabı', yazar: 'Şair', tur: 'Şiir' }),
      okunacak({ ad: 'Öykü Kitabı', yazar: 'Öykücü', tur: 'Öykü' })
    ]);
    await page.goto('/');
    const s = await page.evaluate(() => window.__oneri.hesapla());
    expect(s.ana.length).toBe(5);
    const yazarSay = {}, turSay = {};
    s.ana.forEach(o => {
      yazarSay[o.kitap.yazar] = (yazarSay[o.kitap.yazar] || 0) + 1;
      turSay[o.kitap.tur] = (turSay[o.kitap.tur] || 0) + 1;
    });
    expect(yazarSay['Tolstoy']).toBe(2);              // en sevilen yazar bile kotayı aşamaz
    Object.values(yazarSay).forEach(n => expect(n).toBeLessThanOrEqual(2));
    Object.values(turSay).forEach(n => expect(n).toBeLessThanOrEqual(3));
  });

  test('yetersiz veride uydurma gerekçe YOK: dürüst mesaj + en uzun bekleyenler', async ({ page }) => {
    // yalnız 2 puanlı bitmiş kitap (eşik 3'ün altında)
    const eski = okunacak({ ad: 'En Eski Bekleyen', eklenme: 1700000000000 });
    const yeni = okunacak({ ad: 'Daha Yeni Bekleyen', eklenme: 1753000000000 });
    await tohumla(page, [
      bitmis({ ad: 'Puanlı 1', yazar: 'X', puan: 8 }),
      bitmis({ ad: 'Puanlı 2', yazar: 'X', puan: 9 }),
      yeni, eski
    ]);
    await page.goto('/');
    const s = await page.evaluate(() => window.__oneri.hesapla());
    expect(s.mod).toBe('az-veri');
    expect(s.ana[0].kitap.ad).toBe('En Eski Bekleyen'); // en uzun bekleyen başta
    expect(s.ana[0].skor).toBe(null);                    // skor uydurulmadı
    await panelAc(page);
    const metin = await page.locator('#oneriIcerik').textContent();
    expect(metin).toContain('yeterli veri yok');
    expect(metin).toContain('rafta bekliyor');           // gerçek neden
    expect(metin).not.toContain('ortalama');             // uydurma yakınlık gerekçesi YOK
  });

  test('neden cümlesindeki sayılar hesaplanan veriyle birebir aynı', async ({ page }) => {
    const puanlar = [7, 9, 10]; // ort 8.666... → "8,7"
    await tohumla(page, [
      ...puanlar.map((p, i) => bitmis({ ad: 'Borges ' + i, yazar: 'Borges', puan: p })),
      okunacak({ ad: 'Alef', yazar: 'Borges' })
    ]);
    await page.goto('/');
    const s = await page.evaluate(() => window.__oneri.hesapla());
    const oge = s.ana.find(o => o.kitap.ad === 'Alef');
    const beklenenOrt = (puanlar.reduce((a, b) => a + b, 0) / puanlar.length);
    const beklenenMetin = beklenenOrt.toFixed(1).replace('.', ',');   // bağımsız hesap
    expect(oge.neden).toContain('bitirdiğin 3 kitaba ortalama ' + beklenenMetin + ' verdin');
    // bileşen değeri de aynı ortalamadan türemiş olmalı
    expect(oge.bilesenler.yazar).toBeCloseTo((beklenenOrt - 5.5) / 4.5 * 30, 5);
  });

  test('istek listesindeki kitap ana listede değil, ayrı bölümde rozetle', async ({ page }) => {
    await tohumla(page, [
      ...taban(),
      bitmis({ ad: 'Sevilen W1', yazar: 'Woolf', puan: 10 }),
      okunacak({ ad: 'Elimde Olan', yazar: 'Sıradan Yazar' }),
      sahteKitap({ ad: 'Dalgalar', yazar: 'Woolf', durum: 'okunacak', sahiplik: 'istek' })
    ]);
    await page.goto('/');
    const s = await page.evaluate(() => window.__oneri.hesapla());
    expect(s.ana.some(o => o.kitap.ad === 'Dalgalar')).toBe(false);   // ana havuz yalnız sahip
    expect(s.istek.some(o => o.kitap.ad === 'Dalgalar')).toBe(true);  // ayrı bölümde
    await panelAc(page);
    await expect(page.locator('#oneriIcerik .on-bolum-baslik')).toContainText('İstek listenden');
    const istekOge = page.locator('#oneriIcerik .on-item', { hasText: 'Dalgalar' });
    await expect(istekOge.locator('.on-rozet')).toContainText('İstek listende');
    await expect(istekOge.locator('[data-act="on-basla"]')).toHaveCount(0); // elinde yok → başlanamaz
  });

  test('"Okumaya başla": durum okunuyor olur, okuma OTURUMU başlamaz', async ({ page }) => {
    const k = okunacak({ ad: 'Başlanacak Kitap' });
    await tohumla(page, [...taban(), k]);
    await page.goto('/');
    await panelAc(page);
    await page.click(`#oneriIcerik [data-act="on-basla"][data-id="${k.id}"]`);
    await expect(page.locator('#toast')).toContainText('İyi okumalar');
    const d = await page.evaluate(id => {
      const x = veri.kitaplar.find(b => b.id === id);
      return { durum: x.durum, bas: x.baslamaTarihi, oturum: localStorage.getItem('kk_oturum_v1') };
    }, k.id);
    expect(d.durum).toBe('okunuyor');
    expect(d.bas).toBe(bugunISO(0));
    expect(d.oturum).toBeFalsy();                       // oturum başlatılmadı (bilinçli)
    await expect(page.locator('#oneriIcerik')).not.toContainText('Başlanacak Kitap'); // aday değil artık
  });

  test('tür eşiği: tek kitaplık tür NÖTR, iki kitaplık tür sinyal verir', async ({ page }) => {
    await tohumla(page, [
      ...taban(), // Deneme/Anı/Gezi 1'er kitap
      bitmis({ ad: 'Korku 1', yazar: 'K1', tur: 'Korku', puan: 9 }),
      bitmis({ ad: 'Korku 2', yazar: 'K2', tur: 'Korku', puan: 9 }),
      okunacak({ ad: 'Tek Kitaplık Türden', yazar: 'Y1', tur: 'Deneme' }),
      okunacak({ ad: 'Çift Kitaplık Türden', yazar: 'Y2', tur: 'Korku' })
    ]);
    await page.goto('/');
    const s = await page.evaluate(() => window.__oneri.hesapla());
    const tek = s.ana.find(o => o.kitap.ad === 'Tek Kitaplık Türden');
    const cift = s.ana.find(o => o.kitap.ad === 'Çift Kitaplık Türden');
    expect(tek.bilesenler.tur).toBeUndefined();         // eşik altı → bileşen hiç yok
    expect(cift.bilesenler.tur).toBeGreaterThan(0);
    expect(cift.neden).toContain('Korku türünde 2 kitaba ortalama 9,0 verdin');
  });

  test('sayfa bilgisi olmayan kitap cezalandırılmaz', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Yeni Biten 1', yazar: 'Z1', puan: 7, sayfa: 300, bitisTarihi: bugunISO(-10) }),
      bitmis({ ad: 'Yeni Biten 2', yazar: 'Z2', puan: 7, sayfa: 320, bitisTarihi: bugunISO(-20) }),
      bitmis({ ad: 'Yeni Biten 3', yazar: 'Z3', puan: 7, sayfa: 280, bitisTarihi: bugunISO(-15) }),
      okunacak({ ad: 'Sayfasız Kitap', yazar: 'Aynı Yazar', sayfa: null }),
      okunacak({ ad: 'Uygun Uzunluk', yazar: 'Aynı Yazar', sayfa: 300 })
    ]);
    await page.goto('/');
    const s = await page.evaluate(() => window.__oneri.hesapla());
    const sayfasiz = s.ana.find(o => o.kitap.ad === 'Sayfasız Kitap');
    expect(sayfasiz).toBeTruthy();                          // listeden düşmedi
    expect(sayfasiz.bilesenler.uzunluk).toBeUndefined();    // 0 bileşen, NEGATİF ceza yok
    Object.values(sayfasiz.bilesenler).forEach(v => expect(v).toBeGreaterThanOrEqual(0));
    const uygun = s.ana.find(o => o.kitap.ad === 'Uygun Uzunluk');
    expect(uygun.bilesenler.uzunluk).toBeGreaterThan(6);    // uygunluk bonusu çalışıyor
  });

  test('ana havuz yalnız okunacak: okunuyor/bitti kitaplar önerilmez', async ({ page }) => {
    await tohumla(page, [
      ...taban(),
      sahteKitap({ ad: 'Zaten Okunuyor', durum: 'okunuyor' }),
      sahteKitap({ ad: 'Zaten Bitti', durum: 'bitti', puan: 10 }),
      okunacak({ ad: 'Tek Aday' })
    ]);
    await page.goto('/');
    const s = await page.evaluate(() => window.__oneri.hesapla());
    const adlar = s.ana.map(o => o.kitap.ad);
    expect(adlar).toEqual(['Tek Aday']);
  });

  test('yeniden okunan kitabın arşiv puanı sayılır: az-veriye düşmez, yazar sinyali korunur', async ({ page }) => {
    await tohumla(page, [
      bitmis({ ad: 'Normal Bitmiş 1', yazar: 'N1', puan: 6 }),
      bitmis({ ad: 'Normal Bitmiş 2', yazar: 'N2', puan: 6 }),
      // üçüncü puanlı kitap ŞU AN yeniden okunuyor: puan arşivde (yeniden-oku akışı)
      sahteKitap({ ad: 'Yeniden Okunan', yazar: 'Calvino', durum: 'okunuyor', puan: null,
        okumalar: [{ bas: '2026-01-01', bit: '2026-03-01', puan: 9, not: '' }] }),
      okunacak({ ad: 'Calvino Yenisi', yazar: 'Calvino' })
    ]);
    await page.goto('/');
    const s = await page.evaluate(() => window.__oneri.hesapla());
    expect(s.mod).toBe('skor');                              // arşiv sayıldı, az-veriye düşmedi
    const oge = s.ana.find(o => o.kitap.ad === 'Calvino Yenisi');
    expect(oge.bilesenler.yazar).toBeGreaterThan(0);         // arşiv puanı yazar sinyali verdi
    expect(oge.neden).toContain('Calvino: bitirdiğin 1 kitaba ortalama 9,0 verdin');
  });

  test('yeniden okunan cilt seri sinyalini düşürmez: sonraki cilt bonusu korunur', async ({ page }) => {
    await tohumla(page, [
      ...taban(),
      // cilt 1 şu an yeniden okunuyor ama arşivinde bitmiş okuma var
      sahteKitap({ ad: 'Dune', yazar: 'Herbert', seri: 'Dune', ciltNo: 1, durum: 'okunuyor',
        okumalar: [{ bas: '2026-01-01', bit: '2026-02-01', puan: 8, not: '' }] }),
      okunacak({ ad: 'Dune Mesihi', yazar: 'Herbert', seri: 'Dune', ciltNo: 2 })
    ]);
    await page.goto('/');
    const s = await page.evaluate(() => window.__oneri.hesapla());
    const oge = s.ana.find(o => o.kitap.ad === 'Dune Mesihi');
    expect(oge.bilesenler.seri).toBe(35);
    expect(oge.neden).toContain('Dune serisinin 2. cildi');
  });

  test('uygunluk çubuğu her koşulda 0-100 arası: istek öğesinde ve ana liste boşken', async ({ page }) => {
    await tohumla(page, [
      ...taban(),
      bitmis({ ad: 'Sevilmeyen K', yazar: 'Kötü Yazar', puan: 1 }),
      okunacak({ ad: 'Tek Sahip Aday', yazar: 'Nötr Yazar' }),
      // düşük puanlı yazarın İSTEK kitabı: skoru ana minimumun ALTINDA → kelepçe testi
      sahteKitap({ ad: 'Kötü İstek', yazar: 'Kötü Yazar', durum: 'okunacak', sahiplik: 'istek' })
    ]);
    await page.goto('/');
    await panelAc(page);
    const genislikler = await page.evaluate(() =>
      [...document.querySelectorAll('#oneriIcerik .on-bar-ic')].map(b => parseFloat(b.style.width)));
    expect(genislikler.length).toBeGreaterThan(0);
    genislikler.forEach(g => { expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(100); });
    // ana liste tamamen boş (tek sahip aday ertelenir) + istek dolu → NaN/-Infinity üretmemeli
    await page.click('#oneriIcerik [data-act="on-ertele"]');
    const sonra = await page.evaluate(() =>
      [...document.querySelectorAll('#oneriIcerik .on-bar-ic')].map(b => parseFloat(b.style.width)));
    sonra.forEach(g => { expect(Number.isFinite(g)).toBe(true); expect(g).toBeGreaterThanOrEqual(0); expect(g).toBeLessThanOrEqual(100); });
    await expect(page.locator('#oneriIcerik')).toContainText('Kötü İstek'); // istek bölümü hâlâ duruyor
  });

  test('panelden detaya geçip bitirince detayda kalınır: puan şeridi çıkar, panel tazelenir', async ({ page }) => {
    // Detay tasarımı sprintinden beri "bitir" form AÇMAZ: detayda kalınır,
    // puan sorusu birincil bloktaki şerittir (d-puan). Bu vaka yeni akışı kilitler.
    const k = okunacak({ ad: 'Panelden Bitirilecek' });
    await tohumla(page, [...taban(), k]);
    await page.goto('/');
    await panelAc(page);
    // panel → detay → okumaya başla → bitir (detayda kal, puan şeridi)
    await page.click(`#oneriIcerik [data-act="on-detay"][data-id="${k.id}"]`);
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await page.click('#detayIcerik [data-act="baslat"]');
    await page.click('#detayIcerik [data-act="bitir"]');
    // form açılmadı, detay açık ve puan şeridi görünür (panel altta kalsa da detay üstte)
    await expect(page.locator('#ortuForm')).not.toHaveClass(/acik/);
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await expect(page.locator('#detayIcerik #dPuan')).toBeVisible();
    const d1 = await page.evaluate(id => {
      const x = veri.kitaplar.find(b => b.id === id);
      return { durum: x.durum, bit: x.bitisTarihi };
    }, k.id);
    expect(d1.durum).toBe('bitti');
    expect(d1.bit).toBe(bugunISO(0));
    // şeritten puan ver: form hâlâ yok, puan yazıldı
    await page.click('#detayIcerik #dPuan [data-act="d-puan"][data-v="8"]');
    await expect(page.locator('#ortuForm')).not.toHaveClass(/acik/);
    expect(await page.evaluate(id => veri.kitaplar.find(b => b.id === id).puan, k.id)).toBe(8);
    // kapat: panel bu akışta hiç kapanmadı (form açılmadı) ve veri değişince
    // kendini tazeledi — bitmiş kitap artık öneri listesinde değil
    await page.click('#detayIcerik [data-act="detay-kapat"]');
    await expect(page.locator('#ortuOneri')).toHaveClass(/acik/);
    await expect(page.locator('#oneriIcerik')).not.toContainText('Panelden Bitirilecek');
  });

  test('zar düğmesi hâlâ çalışıyor (regresyon)', async ({ page }) => {
    await tohumla(page, [okunacak({ ad: 'Zarlık Kitap' })]);
    await page.goto('/');
    await page.click('[data-act="zar"]');
    await expect(page.locator('#toast')).toContainText('Zar böyle dedi');
    await expect(page.locator('#ortuDetay')).toHaveClass(/acik/);
    await expect(page.locator('#detayIcerik')).toContainText('Zarlık Kitap');
  });
});
