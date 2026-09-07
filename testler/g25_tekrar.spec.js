/* G25 — Aralıklı alıntı tekrarı (tekrar.js, tk-).
   Felsefe: ezber sınavı değil, yeniden karşılaşma. Üç eylem: Devam etsin (aralık
   ×2.2 büyür), Daha sık (aralık küçülür, en az 1 gün), Yeter (duraklar).
   Veri not düzeyinde: tekrarSonraki/tekrarAralik/tekrarSayisi/tekrarDurum —
   kitapNormalize beyaz listesi + ANLIK_SURUM 5 göçü burada doğrulanır.
   TÜM seçiciler kapsamlı: #panel-alinti / #tkKutu / #alintiIcerik altında. */
'use strict';
const { test, expect, tohumla, sahteKitap,
  bugunISO, onaylariKabulEt, rafAc, rafYenile } = require('./yardim');

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
  await rafAc(page);
  await page.click('[data-act="sekme"][data-v="alinti"]');
  await expect(page.locator('#panel-alinti #alintiIcerik')).toBeVisible();
}

test.describe('G25 aralıklı tekrar', () => {

  test('yeni alıntı varsayılanla döngüye girer: aktif, ilk gösterim 3 gün sonra; yenilemede korunur', async ({ page }) => {
    await tohumla(page, [kitapla([])]);
    await rafAc(page);
    await page.click('#liste .kart');
    await page.click('[data-act="not-tip"][data-v="alinti"]');
    await page.fill('#d-not', 'Yeni eklenen alıntı');
    await page.click('[data-act="not-ekle"]');
    // zamanlama OTOMATİK: tekrar.js not-ekle aksiyonunu gözler, elle tetik gerekmez
    await page.waitForFunction(() =>
      veri.kitaplar[0].notlar[0] && !!veri.kitaplar[0].notlar[0].tekrarSonraki);
    const n1 = await page.evaluate(() => veri.kitaplar[0].notlar[0]);
    expect(n1.tekrarDurum).toBe('aktif');
    expect(n1.tekrarAralik).toBe(3);
    expect(n1.tekrarSayisi).toBe(0);
    expect(n1.tekrarSonraki).toBe(bugunISO(3));
    await rafYenile(page);
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
    await rafAc(page);
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
    // liste kartındaki gösterge AYNI OTURUMDA tazelenir (bayat "bugün" kalmaz)
    await expect(page.locator(`#alintiIcerik .not-kart[data-nid="${n.id}"] .tk-durum`))
      .toContainText('duraklatıldı');
    await rafYenile(page);
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

  test('ilk zamanlama yayılması: 100 eski kayıt günde TAM 2, 50 güne yayılır', async ({ page }) => {
    // tekrar alansız 100 kayıt (Goodreads içe aktarımı senaryosu), 5 kitaba dağılı
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
    await rafAc(page);   // zamanlama açılışta koşar, sekmeye girmek gerekmez
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
    /* v112: eşitlik iddiası — eski hâli "≤8" idi ve YAYILMA_GUNLUK 8'den 2'ye
       inince de yeşil kalıyordu, yani sabiti KORUMUYORDU. Sabitin gerçek
       gerekçesi işlenen kaydın 7 gün sonra GERİ GELMESİ; hız kapasiteye
       bağlıdır ve gevşek bir üst sınır bunu sınamaz. */
    expect(Math.max(...sayilar), 'günde TAM 2').toBe(2);
    expect(Object.keys(dagilim.gunler).length, '100 / 2 = 50 gün').toBe(50);
    expect(Object.keys(dagilim.gunler).sort()[0]).toBe(bugunISO(3)); // en erken 3 gün sonra
    expect(dagilim.enEskiSonraki).toBe(bugunISO(3));            // en eski kayıt ilk sırada
  });

  test('v112: NOT da ALINTI da varsayılan döngüde — tip ölçüt DEĞİL', async ({ page }) => {
    const nt = notYap({ tip: 'not', metin: 'Kendi düşüncem' });
    const al = notYap({ tip: 'alinti', metin: 'Bir alıntı' });
    await tohumla(page, [kitapla([nt, al])]);
    await rafAc(page);
    const d = await page.evaluate(() => veri.kitaplar[0].notlar
      .map(x => ({ tip: x.tip, durum: x.tekrarDurum, sonraki: x.tekrarSonraki })));
    expect(d.map(x => x.durum), 'ikisi de aktif').toEqual(['aktif', 'aktif']);
    await page.click('[data-act="sekme"][data-v="alinti"]');
    /* YAYILMA_GUNLUK 2: ilk iki kayıt aynı güne (ILK_GUN), üçüncüsü ertesi güne */
    const s = await page.evaluate(() => veri.kitaplar[0].notlar.map(x => x.tekrarSonraki));
    expect(s).toEqual([bugunISO(3), bugunISO(3)]);
    for (const n of [nt, al]) {
      const kart = page.locator(`#alintiIcerik .not-kart[data-nid="${n.id}"]`);
      await expect(kart.locator('.tk-durum')).toContainText('3 gün sonra');
      await expect(kart.locator('[data-act="tk-baslat"]'), '"tekrara al" opt-in yolu KALKTI')
        .toHaveCount(0);
    }
  });

  test('oturum içinde eklenen NOT da reload beklemeden zamanlanır (durumOf yolu)', async ({ page }) => {
    /* NEDEN AYRI VAKA: tekrar.js'in kendi durumOf varsayılanı YALNIZ normalize
       henüz koşmamış kayıt için devreye girer — depodan gelen her kayıtta
       tekrarDurum zaten yazılıdır. Tek gerçek yol bu: kullanıcı NOT ekler,
       gözlemci aynı oturumda planlamaYap'ı çağırır. Üstteki alıntı vakasının
       ikizi; o varken mutasyon denetiminde durumOf'un tip dalına dönüş
       26/26 yeşil kalmıştı (not tarafı sınanmıyordu). */
    await tohumla(page, [kitapla([])]);
    await rafAc(page);
    await page.click('#liste .kart');
    await page.click('[data-act="not-tip"][data-v="not"]');
    await page.fill('#d-not', 'Yeni eklenen NOT');
    await page.click('[data-act="not-ekle"]');
    await page.waitForFunction(() =>
      veri.kitaplar[0].notlar[0] && !!veri.kitaplar[0].notlar[0].tekrarSonraki);
    const n = await page.evaluate(() => veri.kitaplar[0].notlar[0]);
    expect(n.tip).toBe('not');
    expect(n.tekrarDurum, 'not da reload beklemeden döngüde').toBe('aktif');
    expect(n.tekrarSonraki).toBe(bugunISO(3));
  });

  test('kitapNormalize kuralı TEK BAŞINA doğrulanır (tekrar.js üzerinden değil)', async ({ page }) => {
    /* NEDEN AYRI VAKA: planlamaYap aktif saydığı her kayda tekrarDurum='aktif'
       YAZIYOR, yani tekrar.js normalize'ın varsayılanını bellekte eziyor.
       Arayüzden ölçen vakalar bu yüzden normalize satırını KORUMUYOR —
       mutasyon denetiminde tip varsayılanına geri dönüş 25/25 yeşil kalmıştı.
       Burada kitapNormalize doğrudan çağrılır. */
    await rafAc(page);
    const d = await page.evaluate(() => {
      const nrm = n => kitapNormalize({ id: 'k1', ad: 'K', notlar: [n] }).notlar[0].tekrarDurum;
      return {
        yeniNot: nrm({ id: 'a', tip: 'not', metin: 'm' }),
        yeniAlinti: nrm({ id: 'b', tip: 'alinti', metin: 'm' }),
        eskiTipVarsayilani: nrm({ id: 'c', tip: 'not', metin: 'm',
          tekrarDurum: 'duraklatildi', tekrarSayisi: 0 }),
        kullaniciDurdurdu: nrm({ id: 'd', tip: 'not', metin: 'm',
          tekrarDurum: 'duraklatildi', tekrarSayisi: 3 }),
        aktifKorunur: nrm({ id: 'e', tip: 'not', metin: 'm',
          tekrarDurum: 'aktif', tekrarSayisi: 0 })
      };
    });
    expect(d).toEqual({ yeniNot: 'aktif', yeniAlinti: 'aktif', eskiTipVarsayilani: 'aktif',
      kullaniciDurdurdu: 'duraklatildi', aktifKorunur: 'aktif' });
  });

  test('GÖÇ: kullanıcının duraklattığı KORUNUR, tip varsayılanı aktife alınır', async ({ page }) => {
    /* Ayrım tekrarSayisi: duraklatmayı YALNIZ "Yeter" üretir ve sayacı artırır.
       sayısı 0 + duraklatildi = eski TİP VARSAYILANI (normalize koşulsuz yazıyordu),
       kullanıcının kararı değil → aktife alınır. */
    const eskiVarsayilan = notYap({ tip: 'not', metin: 'Hiç dokunulmadı',
      tekrarDurum: 'duraklatildi', tekrarSayisi: 0 });
    const kullaniciDurdurdu = notYap({ tip: 'not', metin: 'Yeter dedim',
      tekrarDurum: 'duraklatildi', tekrarSayisi: 2, tekrarAralik: 33 });
    await tohumla(page, [kitapla([eskiVarsayilan, kullaniciDurdurdu])]);
    await alintiAc(page);
    const d = await page.evaluate(() => veri.kitaplar[0].notlar.map(x => x.tekrarDurum));
    expect(d, 'tercih korunur, varsayılan çevrilir').toEqual(['aktif', 'duraklatildi']);
    const durmus = page.locator(`#alintiIcerik .not-kart[data-nid="${kullaniciDurdurdu.id}"]`);
    await expect(durmus.locator('.tk-durum')).toContainText('duraklatıldı');
    await expect(durmus.locator('[data-act="tk-baslat"]')).toContainText('başlat');
    /* geri açıldığında merdivendeki yeri korunur (duraklatma ceza değil) */
    await durmus.locator('[data-act="tk-baslat"]').click();
    await expect(durmus.locator('.tk-durum')).toContainText('33 gün sonra');
  });

  test('PARMAK İZİ: 299 kayda tekrar alanı yazmak damga ÜRETMEZ (ANLIK_SURUM turu gerekmez)',
    async ({ page }) => {
      /* v111'de favori alanı pozitife çevrilince o notların izi değişiyordu ve
         ANLIK_SURUM turu şarttı. Burada risk YOK: kitapParmak tekrar* alanlarını
         DIŞLIYOR (ANLIK_SURUM 6). Bu vaka onu davranışla ölçer — 299 kayıt
         planlanır, depo yazılır, kitap damgası KIPIRDAMAZ. */
      const cok = [];
      for (let i = 0; i < 299; i++) cok.push(notYap({ tip: 'not', metin: 'Not ' + i }));
      await tohumla(page, [kitapla(cok, { g: 777 })]);
      await alintiAc(page);
      const o = await page.evaluate(() => {
        const oncekiG = veri.kitaplar[0].g;
        const planli = veri.kitaplar[0].notlar.filter(n => n.tekrarSonraki).length;
        depoKaydet();
        return { oncekiG, sonraG: veri.kitaplar[0].g, planli,
          aktif: veri.kitaplar[0].notlar.filter(n => n.tekrarDurum === 'aktif').length };
      });
      expect(o.aktif, '299 kayıt döngüde').toBe(299);
      expect(o.planli, 'hepsi zamanlandı').toBe(299);
      expect(o.sonraG, 'damga değişmedi — otomatik zamanlama LWW zehirlemez').toBe(777);
      expect(o.oncekiG).toBe(777);
    });

  test('YAYILMA: 299 kayıt 2/gün dağılır, bugün hiçbiri çıkmaz, yığılma yok', async ({ page }) => {
    const cok = [];
    for (let i = 0; i < 299; i++) cok.push(notYap({ tip: 'not', metin: 'Not ' + i }));
    await tohumla(page, [kitapla(cok)]);
    await alintiAc(page);
    const o = await page.evaluate(() => {
      const g = {};
      veri.kitaplar[0].notlar.forEach(n => { g[n.tekrarSonraki] = (g[n.tekrarSonraki] || 0) + 1; });
      const gunler = Object.keys(g).sort();
      return { gunSayisi: gunler.length, ilkGun: gunler[0], sonGun: gunler[gunler.length - 1],
        enKalabalikGun: Math.max(...Object.values(g)),
        bugunBekleyen: window.__tekrar.kuyruk().length,
        bugunGosterilen: window.__tekrar.bugunKuyruk().length };
    });
    expect(o.enKalabalikGun, 'YAYILMA_GUNLUK=2').toBe(2);
    expect(o.gunSayisi, '299 kayıt / 2 = 150 gün').toBe(150);
    expect(o.ilkGun).toBe(bugunISO(3));
    expect(o.sonGun, 'son kaydın ilk karşılaşması').toBe(bugunISO(152));
    expect(o.bugunBekleyen, 'bugün hiçbiri zamanı gelmedi').toBe(0);
    expect(o.bugunGosterilen).toBe(0);
    await expect(page.locator('#tkKutu .tk-ist'), 'kutu yine de döngü sayısını söyler')
      .toContainText('299 kayıt döngüde');
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
    await rafAc(page);
    await rafYenile(page);
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

  test('senkron göçü: sürüm atlaması kütüphaneyi yeniden damgalamaz', async ({ page }) => {
    const k = kitapla([notYap()], { g: 9 });
    await tohumla(page, [k], { kk_senkron_anlik_v1: { s: 4, p: { eskiId: 'x-yz' } } });
    await rafAc(page);
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
    /* favori: 1 — v111: günün bloğu yalnız SEÇİLMİŞ kayıtlarla çizilir. Seçilen
       kayıt BİLEREK tekrar kutusundaki (dunkuAktif) DEĞİL: vakanın iddiası
       zaten "ikisi ayrı yaşar" — tekrar eylemi başka bir kaydı işlerken günün
       bloğu kıpırdamamalı. Havuz tek kayıt olduğu için seçim de gün tohumundan
       bağımsız. */
    const notlar = [dunkuAktif(), notYap({ tekrarDurum: 'aktif', tekrarAralik: 3,
      tekrarSayisi: 0, tekrarSonraki: bugunISO(9), favori: 1 }), notYap({ tekrarDurum: 'aktif',
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
    /* v112: etiket "alıntı" DEĞİL "kayıt" — sayaç zaten tipten bağımsız tüm
       aktifleri sayıyordu, "0 alıntı · 299 not" olan kütüphanede "1 alıntı
       döngüde" yazıyordu. Sayı doğruydu, etiket yalan söylüyordu. */
    await expect(ist).toContainText('3 kayıt döngüde');         // duraklatılan sayılmaz
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

  test('KRİTİK: otomatik zamanlama damga BASMAZ, kasıtlı tekrar eylemi basar', async ({ page }) => {
    // Zamanlama türetilmiş defter kaydıdır: kitapParmak tekrar* alanlarını dışlar.
    // Aksi halde salt-render yapan cihaz kitabı taze damgalar, kitap-bazlı LWW
    // birleşmesinde karşı cihazın gerçek düzenlemesini (yeni alıntı) kalıcı ezerdi.
    const nA = notYap();                             // zamanlanmamış — otomatik zamanlanır
    const nB = dunkuAktif();                         // bugün bekleyen — kasıtlı eylem
    const kA = kitapla([nA], { g: 9 }), kB = kitapla([nB], { g: 9 });
    await tohumla(page, [kA, kB]);
    await rafAc(page);                            // anlik tabanı kurulur
    await rafYenile(page);                             // kararlı durum (göç turu bitti)
    const oto = await page.evaluate(id => {
      const k = veri.kitaplar.find(x => x.id === id);
      k.notlar[0].tekrarSonraki = null;              // birleşmeden zamanlanmamış kopya gelmiş gibi
      window.__tekrar.planlamaYap();                 // depoKaydet → damgala (göç DIŞI tur)
      return { g: k.g, sonraki: k.notlar[0].tekrarSonraki };
    }, kA.id);
    expect(oto.g).toBe(9);                           // salt-zamanlama LWW damgası üretmedi
    expect(oto.sonraki).toBe(bugunISO(3));
    await page.click('[data-act="sekme"][data-v="alinti"]');
    await page.click('#tkKutu [data-act="tk-devam"]');
    expect(await page.evaluate(id => veri.kitaplar.find(x => x.id === id).g, kB.id))
      .toBeGreaterThan(9);                           // kasıtlı eylem damgayı bastı
    expect(await page.evaluate(id => veri.kitaplar.find(x => x.id === id).g, kA.id))
      .toBe(9);                                      // öbür kitap etkilenmedi
  });

  test('detaydan not silinince tekrar kutusu tazelenir (bayat kart kalmaz)', async ({ page }) => {
    const n = dunkuAktif({ metin: 'Silinecek alıntı' });
    await tohumla(page, [kitapla([n])]);
    onaylariKabulEt(page);
    await alintiAc(page);
    await expect(page.locator('#tkKutu .tk-kart')).toContainText('Silinecek alıntı');
    await page.click('#tkKutu [data-act="tk-git"]');
    await page.click('#detayIcerik [data-act="not-sil"]');
    await expect(page.locator('#tkKutu .tk-kart')).toHaveCount(0); // kutu silinen kaydı göstermez
  });

  test('"başlat" düğmesi tıklanınca aynı oturumda göstergeye dönüşür', async ({ page }) => {
    /* v112: fikstür artık KULLANICI duraklatması (tekrarSayisi ≥ 1) — "tekrara al"
       opt-in yolu kalktı, bu dala yalnız geçmişi olan kayıt düşer. */
    const n = notYap({ tip: 'not', metin: 'Duraklatılmış not',
      tekrarDurum: 'duraklatildi', tekrarSayisi: 1, tekrarAralik: 3 });
    await tohumla(page, [kitapla([n])]);
    await alintiAc(page);
    const kart = page.locator(`#alintiIcerik .not-kart[data-nid="${n.id}"]`);
    await kart.locator('[data-act="tk-baslat"]').click();
    await expect(kart.locator('.tk-durum')).toContainText('3 gün sonra'); // rozet tazelendi
    await expect(kart.locator('[data-act="tk-baslat"]')).toHaveCount(0);  // bayat düğme kalmadı
  });

  test('bozuk tekrar verisi normalize\'da kırpılır: negatif aralık, biçimsiz tarih', async ({ page }) => {
    const n = notYap({ tekrarDurum: 'aktif', tekrarAralik: -5, tekrarSayisi: 1,
      tekrarSonraki: '9999' });
    await tohumla(page, [kitapla([n])]);
    await rafAc(page);
    const s = await page.evaluate(() => veri.kitaplar[0].notlar[0]);
    expect(s.tekrarAralik).toBe(1);            // [1,365] aralığına kırpıldı
    expect(s.tekrarSonraki).toBe(bugunISO(3)); // '9999' düştü, zamanlayıcı yeniden atadı
  });

  test('klavye odağı eylem sonrası kutuda kalır (ardışık akış kopmaz)', async ({ page }) => {
    const n1 = dunkuAktif(), n2 = dunkuAktif();
    await tohumla(page, [kitapla([n1, n2])]);
    await alintiAc(page);
    await page.click('#tkKutu [data-act="tk-devam"]');
    expect(await page.evaluate(() =>
      document.getElementById('tkKutu').contains(document.activeElement))).toBe(true);
  });
});
