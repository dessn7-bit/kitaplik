/* G25 — Aralıklı alıntı tekrarı (tekrar.js, tk-).
   Felsefe: ezber sınavı değil, yeniden karşılaşma. Üç eylem: Devam etsin (aralık
   ×2.2 büyür), Daha sık (aralık küçülür, en az 1 gün), Yeter (duraklar).
   Veri not düzeyinde: tekrarSonraki/tekrarAralik/tekrarSayisi/tekrarDurum —
   kitapNormalize beyaz listesi + ANLIK_SURUM 5 göçü burada doğrulanır.
   TÜM seçiciler kapsamlı: #panel-alinti / #tkKutu / #alintiIcerik altında. */
'use strict';
const { test, expect, tohumla, sahteKitap, bugunISO } = require('./yardim');

let notSayac = 0;
function notYap(ek) {
  notSayac++;
  return Object.assign({
    id: 'tkn' + String(notSayac).padStart(3, '0'), tip: 'alinti',
    metin: 'Deneme alıntısı ' + notSayac, tarih: '2026-01-15', sayfa: null, fikir: []
  }, ek || {});
}
/* dünden beri bekleyen aktif alıntı — kutuda hemen görünür */
function dunkuAktif(ek) {
  return notYap(Object.assign({
    tekrarDurum: 'aktif', tekrarAralik: 3, tekrarSayisi: 0, tekrarSonraki: bugunISO(-1)
  }, ek || {}));
}
function kitapla(notlar, ek) { return sahteKitap(Object.assign({ notlar }, ek || {})); }
async function alintiAc(page) {
  await page.goto('/');
  await page.click('[data-act="sekme"][data-v="alinti"]');
  await expect(page.locator('#panel-alinti #alintiIcerik')).toBeVisible();
}

test.describe('G25 aralıklı alıntı tekrarı', () => {

  test('yeni alıntı varsayılanla döngüye girer: aktif, ilk gösterim 3 gün sonra; yenilemede korunur', async ({ page }) => {
    await tohumla(page, [kitapla([])]);
    await page.goto('/');
    await page.click('#liste .kart');
    await page.click('[data-act="not-tip"][data-v="alinti"]');
    await page.fill('#d-not', 'Yeni eklenen alıntı');
    await page.click('[data-act="not-ekle"]');
    // oturum içi zamanlama: reload beklemeden varsayılanlar üretilir
    const n1 = await page.evaluate(() => { window.__tekrar.planlamaYap(); return veri.kitaplar[0].notlar[0]; });
    expect(n1.tekrarDurum).toBe('aktif');
    expect(n1.tekrarAralik).toBe(3);
    expect(n1.tekrarSayisi).toBe(0);
    expect(n1.tekrarSonraki).toBe(bugunISO(3));
    await page.reload();
    const n2 = await page.evaluate(() => veri.kitaplar[0].notlar[0]);
    expect(n2.tekrarDurum).toBe('aktif');       // kitapNormalize elemedi
    expect(n2.tekrarSonraki).toBe(bugunISO(3)); // zamanlama yenilemede değişmedi
  });

  test('"Devam etsin" aralığı büyütür (3→7) ve sonraki tarihi doğru hesaplar', async ({ page }) => {
    const n = dunkuAktif();
    await tohumla(page, [kitapla([n])]);
    await alintiAc(page);
    await expect(page.locator('#tkKutu .tk-kart')).toBeVisible();
    await page.click('#tkKutu [data-act="tk-devam"]');
    const s = await page.evaluate(id =>
      veri.kitaplar[0].notlar.find(x => x.id === id), n.id);
    expect(s.tekrarAralik).toBe(7);
    expect(s.tekrarSonraki).toBe(bugunISO(7));
    expect(s.tekrarSayisi).toBe(1);
    expect(s.tekrarDurum).toBe('aktif');
    await expect(page.locator('#tkKutu .tk-tamam')).toContainText('Bugünlük tamam');
  });

  test('aralık merdiveni: 3→7→15→33→73→161→354→365, tavanda durur', async ({ page }) => {
    await page.goto('/');
    const merdiven = await page.evaluate(() => {
      const c = []; let a = 3;
      for (let i = 0; i < 8; i++) { a = window.__tekrar.aralikBuyut(a); c.push(a); }
      return c;
    });
    expect(merdiven).toEqual([7, 15, 33, 73, 161, 354, 365, 365]);
  });

  test('"Daha sık" aralığı küçültür (7→3), en az 1 günde durur', async ({ page }) => {
    const n = dunkuAktif({ tekrarAralik: 7 });
    await tohumla(page, [kitapla([n])]);
    await alintiAc(page);
    await page.click('#tkKutu [data-act="tk-sik"]');
    const s = await page.evaluate(id =>
      veri.kitaplar[0].notlar.find(x => x.id === id), n.id);
    expect(s.tekrarAralik).toBe(3);
    expect(s.tekrarSonraki).toBe(bugunISO(3));
    const asagi = await page.evaluate(() => [
      window.__tekrar.aralikKucult(3), window.__tekrar.aralikKucult(1)]);
    expect(asagi).toEqual([1, 1]);   // 3→1, 1'in altına inmez
  });

  test('"Yeter" duraklatır; alıntı bir daha bugünün listesine girmez', async ({ page }) => {
    const n = dunkuAktif();
    await tohumla(page, [kitapla([n])]);
    await alintiAc(page);
    await page.click('#tkKutu [data-act="tk-yeter"]');
    expect(await page.evaluate(id =>
      veri.kitaplar[0].notlar.find(x => x.id === id).tekrarDurum, n.id)).toBe('duraklatildi');
    await page.reload();
    await page.click('[data-act="sekme"][data-v="alinti"]');
    await expect(page.locator('#tkKutu .tk-kart')).toHaveCount(0);
    expect(await page.evaluate(() => window.__tekrar.bugunKuyruk().length)).toBe(0);
    expect(await page.evaluate(id =>
      veri.kitaplar[0].notlar.find(x => x.id === id).tekrarDurum, n.id)).toBe('duraklatildi');
  });

  test('duraklatılmış alıntı kartından yeniden başlatılır, merdivendeki yeri korunur', async ({ page }) => {
    const n = notYap({ tekrarDurum: 'duraklatildi', tekrarAralik: 15, tekrarSayisi: 4,
      tekrarSonraki: bugunISO(-10) });
    await tohumla(page, [kitapla([n])]);
    await alintiAc(page);
    const kart = page.locator(`#alintiIcerik .not-kart[data-nid="${n.id}"]`);
    await expect(kart.locator('.tk-durum')).toContainText('duraklatıldı');
    await kart.locator('[data-act="tk-baslat"]').click();
    const s = await page.evaluate(id =>
      veri.kitaplar[0].notlar.find(x => x.id === id), n.id);
    expect(s.tekrarDurum).toBe('aktif');
    expect(s.tekrarAralik).toBe(15);              // duraklatma ceza değil
    expect(s.tekrarSonraki).toBe(bugunISO(15));
  });

  test('günlük sınır: 60 bekleyenden bugün en fazla 10 gösterilir, kalan yarına', async ({ page }) => {
    const notlar = [];
    for (let i = 0; i < 60; i++) notlar.push(dunkuAktif());
    await tohumla(page, [kitapla(notlar)]);
    await alintiAc(page);
    const sayilar = await page.evaluate(() => ({
      tum: window.__tekrar.kuyruk().length, bugun: window.__tekrar.bugunKuyruk().length }));
    expect(sayilar).toEqual({ tum: 60, bugun: 10 });
    await expect(page.locator('#tkKutu .tk-rozet-sayi')).toHaveText('10');
    for (let i = 0; i < 10; i++) await page.click('#tkKutu [data-act="tk-devam"]');
    await expect(page.locator('#tkKutu .tk-tamam')).toContainText('Bugünlük tamam');
    await expect(page.locator('#tkKutu .tk-tamam')).toContainText('50');
    expect(await page.evaluate(() => window.__tekrar.bugunKuyruk().length)).toBe(0);
  });

  test('ilk zamanlama yayılması: 100 eski alıntı aynı güne düşmez (günde ≤8, ≥13 güne yayılır)', async ({ page }) => {
    // tekrar alansız 100 alıntı (Goodreads içe aktarımı senaryosu), 5 kitaba dağılı
    const kitaplar = [];
    for (let k = 0; k < 5; k++) {
      const notlar = [];
      for (let i = 0; i < 20; i++) {
        const g = k * 20 + i;
        notlar.push(notYap({ tarih: '2025-' + String(1 + Math.floor(g / 28)).padStart(2, '0')
          + '-' + String(1 + (g % 28)).padStart(2, '0') }));
      }
      kitaplar.push(kitapla(notlar));
    }
    await tohumla(page, kitaplar);
    await page.goto('/');   // zamanlama açılışta koşar, sekmeye girmek gerekmez
    const dagilim = await page.evaluate(() => {
      const gunler = {};
      let enEskiSonraki = null;
      veri.kitaplar.forEach(k => k.notlar.forEach(n => {
        gunler[n.tekrarSonraki] = (gunler[n.tekrarSonraki] || 0) + 1;
        if (n.tarih === '2025-01-01') enEskiSonraki = n.tekrarSonraki;
      }));
      return { gunler, enEskiSonraki, planlanmamis: window.__tekrar.planlamaYap() };
    });
    expect(dagilim.planlanmamis).toBe(0);                       // hepsi zamanlandı
    const sayilar = Object.values(dagilim.gunler);
    expect(Math.max(...sayilar)).toBeLessThanOrEqual(8);        // günde en çok 8
    expect(Object.keys(dagilim.gunler).length).toBeGreaterThanOrEqual(13);
    expect(Object.keys(dagilim.gunler).sort()[0]).toBe(bugunISO(3)); // en erken 3 gün sonra
    expect(dagilim.enEskiSonraki).toBe(bugunISO(3));            // en eski alıntı ilk sırada
  });

  test('notlar (tip=not) varsayılan döngü dışı; "tekrara al" ile isteğe bağlı girer', async ({ page }) => {
    const n = notYap({ tip: 'not', metin: 'Kendi düşüncem' });
    await tohumla(page, [kitapla([n])]);
    await page.goto('/');
    const once = await page.evaluate(id =>
      veri.kitaplar[0].notlar.find(x => x.id === id), n.id);
    expect(once.tekrarDurum).toBe('duraklatildi');   // normalize varsayılanı
    expect(once.tekrarSonraki).toBe(null);           // zamanlayıcı nota dokunmadı
    await page.click('[data-act="sekme"][data-v="alinti"]');
    const kart = page.locator(`#alintiIcerik .not-kart[data-nid="${n.id}"]`);
    await expect(kart.locator('[data-act="tk-baslat"]')).toContainText('tekrara al');
    await expect(kart.locator('.tk-durum')).not.toContainText('duraklatıldı'); // hiç girmedi, "duraklatıldı" yazmaz
    await kart.locator('[data-act="tk-baslat"]').click();
    const sonra = await page.evaluate(id =>
      veri.kitaplar[0].notlar.find(x => x.id === id), n.id);
    expect(sonra.tekrarDurum).toBe('aktif');
    expect(sonra.tekrarSonraki).toBe(bugunISO(3));
  });

  test('tekrar alanları yenilemede KORUNUR ve senkron PUT\'unda taşınır', async ({ page }) => {
    let putGovde = null;
    await page.route('**/identitytoolkit.googleapis.com/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ idToken: 'sahte-token', refreshToken: 'sahte-yenile' }) }));
    await page.route('**/*firebasedatabase.app/**', route => {
      if (route.request().method() === 'PUT') putGovde = route.request().postData();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    const n = notYap({ tekrarSonraki: bugunISO(5), tekrarAralik: 7, tekrarSayisi: 2,
      tekrarDurum: 'aktif' });
    await tohumla(page, [kitapla([n], { g: 5 })]);
    await page.goto('/');
    await page.reload();
    const s = await page.evaluate(() => veri.kitaplar[0].notlar[0]);
    expect(s.tekrarSonraki).toBe(bugunISO(5));   // kitapNormalize elemedi, zamanlayıcı ezmedi
    expect(s.tekrarAralik).toBe(7);
    expect(s.tekrarSayisi).toBe(2);
    expect(s.tekrarDurum).toBe('aktif');
    const tamam = await page.evaluate(() => {
      window.__senkron.ayarKaydet({ oda: 'g25-test-odasi', cihaz: 'testcihaz', sonSenkron: null });
      return window.__senkron.senkronEt(true);
    });
    expect(tamam).toBe(true);
    const putNot = JSON.parse(putGovde).kitaplar[0].notlar[0];
    expect(putNot.tekrarSonraki).toBe(bugunISO(5));   // senkronla taşındı
    expect(putNot.tekrarAralik).toBe(7);
    expect(putNot.tekrarDurum).toBe('aktif');
  });

  test('senkron göçü v5: sürüm atlaması kütüphaneyi yeniden damgalamaz', async ({ page }) => {
    const k = kitapla([notYap()], { g: 9 });
    await tohumla(page, [k], { kk_senkron_anlik_v1: { s: 4, p: { eskiId: 'x-yz' } } });
    await page.goto('/');
    await page.evaluate(() => depoKaydet()); // damgala göç turunda koşsun
    expect(await page.evaluate(() => veri.kitaplar[0].g)).toBe(9); // damga korundu
    const anlik = await page.evaluate(() => JSON.parse(localStorage.getItem('kk_senkron_anlik_v1')));
    expect(anlik.s).toBe(await page.evaluate(() => window.__senkron.ANLIK_SURUM)); // yeni sürümle yazıldı
  });

  test('fikir defteri tekrar kutusuyla birlikte çalışır: etiket ekleme + filtre', async ({ page }) => {
    const a = dunkuAktif({ fikir: ['özgürlük'] });
    const b = notYap({ tekrarDurum: 'aktif', tekrarAralik: 3, tekrarSayisi: 0,
      tekrarSonraki: bugunISO(9), fikir: ['ahlak'] });
    await tohumla(page, [kitapla([a], { ad: 'Kitap A' }), kitapla([b], { ad: 'Kitap B' })]);
    await alintiAc(page);
    await expect(page.locator('#tkKutu .tk-kart')).toBeVisible();
    const kartA = page.locator(`#alintiIcerik .not-kart[data-nid="${a.id}"]`);
    await kartA.locator('.fikir-giris').fill('cesaret');
    await kartA.locator('[data-act="fikir-ekle"]').click();
    await expect(kartA).toContainText('#cesaret');                 // fikir.js hâlâ çalışıyor
    await page.click('#fikirBulut [data-act="fikir-filtre"][data-v="özgürlük"]');
    await expect(page.locator(`#alintiIcerik .not-kart[data-nid="${b.id}"]`)).toBeHidden();
    await expect(page.locator('#tkKutu .tk-kart')).toBeVisible();  // filtre kutuya dokunmaz
  });

  test('fikir ağı kesişimi tekrar kutusunu gizlemez', async ({ page }) => {
    const a = dunkuAktif({ fikir: ['özgürlük', 'ahlak'] });
    const b = notYap({ tekrarDurum: 'aktif', tekrarAralik: 3, tekrarSayisi: 0,
      tekrarSonraki: bugunISO(9), fikir: ['özgürlük', 'ahlak'] });
    await tohumla(page, [kitapla([a], { ad: 'Kitap A' }), kitapla([b], { ad: 'Kitap B' })]);
    await alintiAc(page);
    await page.click('#fikirBulut [data-act="fikir-filtre"][data-v="özgürlük"]');
    await expect(page.locator('#panel-alinti #faKomsuKart')).toBeVisible();
    await page.click('#panel-alinti #faKomsuKart [data-act="fa-kesisim"]');
    await expect(page.locator('#panel-alinti #faKesisimKart')).toBeVisible(); // fikirag.js hâlâ çalışıyor
    await expect(page.locator('#tkKutu .tk-kart')).toBeVisible(); // kesişim süzgeci kutuya dokunmaz
  });

  test('günün alıntısı ile çakışmaz: ikisi ayrı yaşar, tekrar eylemi günün alıntısını değiştirmez', async ({ page }) => {
    const notlar = [dunkuAktif(), notYap({ tekrarDurum: 'aktif', tekrarAralik: 3,
      tekrarSayisi: 0, tekrarSonraki: bugunISO(9) }), notYap({ tekrarDurum: 'aktif',
      tekrarAralik: 3, tekrarSayisi: 0, tekrarSonraki: bugunISO(9) })];
    await tohumla(page, [kitapla(notlar)]);
    await alintiAc(page);
    await expect(page.locator('#alintiIcerik .gunun-alintisi')).toBeVisible(); // rastgele karşılaşma
    await expect(page.locator('#tkKutu .tk-kart')).toBeVisible();              // zamanlanmış tekrar
    const gunun = await page.locator('#alintiIcerik .ga-metin').textContent();
    await page.click('#tkKutu [data-act="tk-devam"]');
    await expect(page.locator('#alintiIcerik .ga-metin')).toHaveText(gunun); // günün alıntısı sabit
  });

  test('istatistik satırı: döngüde / bugün bekleyen / en uzun aralık', async ({ page }) => {
    const notlar = [dunkuAktif(),
      notYap({ tekrarDurum: 'aktif', tekrarAralik: 15, tekrarSayisi: 3, tekrarSonraki: bugunISO(9) }),
      notYap({ tekrarDurum: 'aktif', tekrarAralik: 73, tekrarSayisi: 5, tekrarSonraki: bugunISO(40) }),
      notYap({ tekrarDurum: 'duraklatildi', tekrarAralik: 33, tekrarSayisi: 2, tekrarSonraki: bugunISO(-3) })];
    await tohumla(page, [kitapla(notlar)]);
    await alintiAc(page);
    const ist = page.locator('#tkKutu .tk-ist');
    await expect(ist).toContainText('3 alıntı döngüde');       // duraklatılan sayılmaz
    await expect(ist).toContainText('bugün 1 bekliyor');
    await expect(ist).toContainText('en uzun aralık 73 gün');
  });

  test('"Sonraki" öbür bekleyene geçer; hepsi işlenince "bugünlük tamam"', async ({ page }) => {
    const n1 = dunkuAktif(), n2 = dunkuAktif();
    await tohumla(page, [kitapla([n1, n2])]);
    await alintiAc(page);
    const ilkNid = await page.locator('#tkKutu .tk-kart').getAttribute('data-nid');
    await page.click('#tkKutu [data-act="tk-atla"]');
    const ikinciNid = await page.locator('#tkKutu .tk-kart').getAttribute('data-nid');
    expect(ikinciNid).not.toBe(ilkNid);                        // atlama gezdirir, işlemez
    await page.click('#tkKutu [data-act="tk-devam"]');
    await page.click('#tkKutu [data-act="tk-devam"]');
    await expect(page.locator('#tkKutu .tk-tamam')).toContainText('Bugünlük tamam');
  });

  test('liste kartında aktif alıntının gün göstergesi görünür', async ({ page }) => {
    const n = notYap({ tekrarDurum: 'aktif', tekrarAralik: 15, tekrarSayisi: 1,
      tekrarSonraki: bugunISO(12) });
    await tohumla(page, [kitapla([n])]);
    await alintiAc(page);
    await expect(page.locator(`#alintiIcerik .not-kart[data-nid="${n.id}"] .tk-durum`))
      .toContainText('12 gün sonra');
  });
});
