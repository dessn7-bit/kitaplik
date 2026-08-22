/* G27 — Kalan senkron açıkları: TOCTOU (RTDB ETag/if-match, 412'de en fazla 3
   deneme), guncelSayfa düzeltme kilidi (gsG alan damgası — yeni damga kazanır,
   eşitse koşullu max), eski istemci penceresi (sonSema: oda şeması gerilediyse
   bir tur atla + uyar), M4 borçları (uçuştaki kayıt yeniden planlanır; parmak
   izi yalnız başarılı depo yazımından sonra kalıcılaşır).
   Sahte sunucu ETag üretir; gerçek Firebase davranışı curl ile ayrıca kanıtlandı
   (bayat if-match → 412). TÜM seçiciler kapsamlı. */
'use strict';
const { test, expect, tohumla, sahteKitap,
  bugunISO, rafAc, rafYenile, ayarlarAc } = require('./yardim');

function kitap(id, ek) {
  return Object.assign({ id, ad: 'Kitap ' + id, yazar: 'Yazar', g: 100, notlar: [] }, ek || {});
}
async function birlestirilmis(page, yerelK, uzakK) {
  return page.evaluate(([y, u]) => {
    const b = window.__senkron.birlestir(
      { kitaplar: [y], silinenler: {} }, { kitaplar: [u], silinenler: {} });
    return b.kitaplar[0];
  }, [yerelK, uzakK]);
}
/* ETag'li sahte oda sunucusu: c412 kadar PUT'a 412 döner (araya yazan taklidi),
   arayaGiren verilirse 412 sonrası odaya o kitap eklenir. */
async function odaKur(page, ayarlar) {
  const s = Object.assign({ c412: 0, arayaGiren: null, oda: {}, putGecikme: 0 }, ayarlar || {});
  const durum = { get: 0, put: 0, ifMatch: [], govdeler: [], etiket: 1 };
  await page.route('**/identitytoolkit.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ idToken: 'sahte-token', refreshToken: 'sahte-yenile' }) }));
  await page.route('**/*firebasedatabase.app/**', route => {
    const istek = route.request();
    /* v81: ana turun SONUNDA fire-forget koşan özet düğümü turu (--ozet: izler
       GET'i) bu sayaçlara GİRMEZ — sayaçlar ANA kanal maliyetini ölçer; özet
       kanalının kendi kilitleri g79(D)/g80(I)'da. v80'den beri var olan bu
       yarış, yük altında izler GET'i iddiadan önce düşürüp sayacı kirletiyordu. */
    if (istek.url().includes('--ozet'))
      return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    if (istek.method() === 'GET') {
      durum.get++;
      return route.fulfill({ status: 200, contentType: 'application/json',
        headers: { 'ETag': 'etag-' + durum.etiket, 'Access-Control-Expose-Headers': 'ETag' },
        body: JSON.stringify(s.oda) });
    }
    if (istek.method() === 'PUT') {
      durum.put++;
      durum.ifMatch.push(istek.headers()['if-match'] || null);
      if (s.putGecikme) return new Promise(coz => setTimeout(coz, s.putGecikme)).then(() => {
        durum.govdeler.push(istek.postData());
        s.oda = JSON.parse(istek.postData());
        durum.etiket++;
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      });
      if (durum.put <= s.c412) {
        durum.etiket++;                                  // araya giren yazdı: içerik + etag değişti
        if (s.arayaGiren) s.oda = { ...s.oda,
          kitaplar: [...(s.oda.kitaplar || []), s.arayaGiren] };
        return route.fulfill({ status: 412, contentType: 'application/json', body: '{}' });
      }
      durum.govdeler.push(istek.postData());
      s.oda = JSON.parse(istek.postData());
      durum.etiket++;
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  durum.odaYaz = yeni => { s.oda = yeni; };   // test: odayı dışarıdan ez (eski istemci taklidi)
  return durum;
}
async function baglanVeSenkronla(page, sessiz) {
  return page.evaluate(s => {
    window.__senkron.ayarKaydet({ oda: 'g27-test-odasi', cihaz: 'testcihaz', sonSenkron: null });
    return window.__senkron.senkronEt(s);
  }, sessiz !== false);
}

test.describe('G27 senkron güvence: TOCTOU + gsG + eski istemci + borçlar', () => {

  test('TOCTOU: araya giren yazım 412 ile tespit edilir, birleştirme TEKRARLANIR, veri kaybolmaz', async ({ page }) => {
    const durum = await odaKur(page, { c412: 1,
      oda: { kitaplar: [kitap('uzak1')] },
      arayaGiren: kitap('araya1', { ad: 'Araya Giren Kitap', g: 500 }) });
    await tohumla(page, [sahteKitap({ ad: 'Yerel Kitap' })]);
    await rafAc(page);
    expect(await baglanVeSenkronla(page)).toBe(true);
    expect(durum.get).toBe(2);                       // 412 sonrası taze GET
    expect(durum.put).toBe(2);
    expect(durum.ifMatch[0]).toBe('etag-1');         // if-match gönderildi
    expect(durum.ifMatch[1]).toBe('etag-2');         // yeni etag ile tekrarlandı
    const son = JSON.parse(durum.govdeler[0]);
    const adlar = son.kitaplar.map(k => k.ad).sort();
    expect(adlar).toEqual(['Araya Giren Kitap', 'Kitap uzak1', 'Yerel Kitap']); // üçü de yaşıyor
  });

  test('TOCTOU: 3 denemede de çakışma → temiz hata, sonsuz döngü yok, yerel veri dokunulmamış', async ({ page }) => {
    const durum = await odaKur(page, { c412: 99, oda: { kitaplar: [kitap('uzak1')] } });
    await tohumla(page, [sahteKitap({ ad: 'Yerel Kitap' })]);
    await rafAc(page);
    expect(await baglanVeSenkronla(page, false)).toBe(false);   // sessiz değil: mesaj görünsün
    expect(durum.put).toBe(3);                       // tam 3 deneme, fazlası yok
    expect(durum.get).toBe(3);
    await expect(page.locator('#toast')).toContainText('çakışması');
    const adlar = await page.evaluate(() => veri.kitaplar.map(k => k.ad));
    expect(adlar).toEqual(['Yerel Kitap']);          // yerel birleşik sonuçla EZİLMEDİ
  });

  test('normal akışta ek maliyet yok: tek GET + tek PUT, süre makul', async ({ page }) => {
    const durum = await odaKur(page, { oda: {} });
    await tohumla(page, [sahteKitap({ ad: 'Tek Kitap' })]);
    await rafAc(page);
    const baslangic = Date.now();
    expect(await baglanVeSenkronla(page)).toBe(true);
    const ms = Date.now() - baslangic;
    console.log('[G27 süre] normal senkron turu (sahte sunucu): ' + ms + ' ms');
    expect(durum.get).toBe(1);
    expect(durum.put).toBe(1);
    expect(durum.ifMatch[0]).toBe('etag-1');
    expect(ms).toBeLessThan(1500);                   // yeniden-deneme beklemesi girmedi
  });

  test('gsG: 250→25 düzeltmesi senkronda KORUNUR; damga farklıysa yeni olan kazanır', async ({ page }) => {
    await rafAc(page);
    // düzeltme: yerel (yeni gsG) 25 vs uzak (eski gsG) 250 — aynı döngüde bile 25 kalır
    const a = await birlestirilmis(page,
      kitap('x', { g: 200, durum: 'okunuyor', guncelSayfa: 25, gsG: 2000 }),
      kitap('x', { g: 100, durum: 'okunuyor', guncelSayfa: 250, gsG: 1000 }));
    expect(a.guncelSayfa).toBe(25);                  // koşulsuz/koşullu max 250'ye kilitliyordu
    expect(a.gsG).toBe(2000);
    // KARAR sabitleme: iki cihaz da ilerledi, damgalar farklı → YENİ giriş kazanır (küçük olsa bile)
    const b = await birlestirilmis(page,
      kitap('x', { g: 200, durum: 'okunuyor', guncelSayfa: 120, gsG: 1000 }),
      kitap('x', { g: 100, durum: 'okunuyor', guncelSayfa: 80, gsG: 2000 }));
    expect(b.guncelSayfa).toBe(80);                  // en son kasıtlı giriş 80'di
  });

  test('gsG damgasız eski veride koşullu max aynen sürer; eşit damgada da', async ({ page }) => {
    await rafAc(page);
    const a = await birlestirilmis(page,
      kitap('x', { g: 200, durum: 'okunuyor', guncelSayfa: 80 }),
      kitap('x', { g: 100, durum: 'okunuyor', guncelSayfa: 120 }));
    expect(a.guncelSayfa).toBe(120);                 // gsG 0/0 → geri uyumlu büyük-kazanır
    const b = await birlestirilmis(page,
      kitap('x', { g: 200, durum: 'okunuyor', guncelSayfa: 80, gsG: 5000 }),
      kitap('x', { g: 100, durum: 'okunuyor', guncelSayfa: 120, gsG: 5000 }));
    expect(b.guncelSayfa).toBe(120);                 // eşit damga → aynı kural
  });

  test('gsG: yeniden okuma sıfırlaması damgayla da korunur (arşiv eşit olsa bile)', async ({ page }) => {
    await rafAc(page);
    const okuma = [{ bas: '2025-01-01', bit: '2025-02-01', puan: 8, not: '' }];
    const a = await birlestirilmis(page,
      kitap('x', { g: 200, durum: 'okunuyor', guncelSayfa: 0, gsG: 2000, okumalar: okuma }),
      kitap('x', { g: 100, durum: 'okunuyor', guncelSayfa: 300, gsG: 1000, okumalar: okuma }));
    expect(a.guncelSayfa).toBe(0);                   // eski koşullu-max bunu 300'e çeviriyordu
  });

  test('gsG kullanıcı girişinde basılır (ilerleme-kaydet + yeniden-oku) ve yenilemede korunur', async ({ page }) => {
    const k = sahteKitap({ ad: 'İlerleme Kitabı', durum: 'okunuyor', sayfa: 300, guncelSayfa: 10 });
    await tohumla(page, [k]);
    await rafAc(page);
    await page.click('#liste .kart');
    await page.click('[data-act="d-sayfa-ac"]');   // v46: giriş satırı açılır
    await page.fill('#d-sayfa', '50');
    await page.click('[data-act="ilerleme-kaydet"]');
    const s1 = await page.evaluate(() => ({ gs: veri.kitaplar[0].guncelSayfa, d: veri.kitaplar[0].gsG }));
    expect(s1.gs).toBe(50);
    expect(s1.d).toBeGreaterThan(0);                 // damga basıldı
    await rafYenile(page);
    const s2 = await page.evaluate(() => veri.kitaplar[0].gsG);
    expect(s2).toBe(s1.d);                           // kitapNormalize elemedi
  });

  test('göç: eski anlık görüntü (s:7) damga basmaz, yeni sürümle yazılır', async ({ page }) => {
    const k = sahteKitap({ ad: 'Göç Kitabı v8', g: 9 });
    await tohumla(page, [k], { kk_senkron_anlik_v1: { s: 7, p: { eskiId: 'x-yz' } } });
    await rafAc(page);
    await page.evaluate(() => depoKaydet());
    expect(await page.evaluate(() => veri.kitaplar[0].g)).toBe(9);
    const anlik = await page.evaluate(() => JSON.parse(localStorage.getItem('kk_senkron_anlik_v1')));
    expect(anlik.s).toBe(await page.evaluate(() => window.__senkron.ANLIK_SURUM));
  });

  test('eski istemci penceresi: oda şeması beklenenden düşükse bir tur atlanır + uyarı; sonraki tur şemayı geri yazar', async ({ page }) => {
    const durum = await odaKur(page, { oda: { kitaplar: [kitap('uzak1')] } }); // odada sema YOK (eski istemci ezmiş)
    await tohumla(page, [sahteKitap({ ad: 'Yerel Kitap' })],
      { kk_senkron_v1: { oda: 'g27-test-odasi', cihaz: 'testcihaz', sonSenkron: 1, sonSema: 2 } });
    await rafAc(page);
    /* Atlama tek seferliktir (semaDusukGecis) ve açılıştaki sessiz senkron onu
       zaten harcamış OLABİLİR. Kaçıncı turda olduğumuz PUT sayısından
       çıkarılamaz — atlanan tur da PUT üretmez; eski `oncekiPut === 0` kabulünün
       kusuru buydu ve sıralamayı zamanlamaya bırakıyordu. Turun KENDİ sonucuna
       bakıyoruz; iki sıralamada da aynı değişmezler doğrulanır. */
    const ilk = await page.evaluate(() => window.__senkron.senkronEt(true));
    await ayarlarAc(page);
    await expect(page.locator('#senkronDurum')).toContainText('eski sürümlü'); // uyarı yapışkan
    if (!ilk) {
      expect(durum.put).toBe(0);                      // atlanan tur: yazılmadı
      // bir sonraki tur yazar ve şemayı geri koyar (kısır döngü yok)
      expect(await page.evaluate(() => window.__senkron.senkronEt(true))).toBe(true);
    }
    expect(durum.put).toBeGreaterThan(0);
    const son = JSON.parse(durum.govdeler[durum.govdeler.length - 1]);
    expect(son.sema).toBe(await page.evaluate(() => window.__senkron.SEMA_SURUM));
  });

  test('normal akışta sonSema ilerler ve PUT gövdesi güncel şemayı taşır', async ({ page }) => {
    const durum = await odaKur(page, { oda: {} });
    await tohumla(page, [sahteKitap({ ad: 'Tek Kitap' })]);
    await rafAc(page);
    expect(await baglanVeSenkronla(page)).toBe(true);
    const govde = JSON.parse(durum.govdeler[0]);
    const sema = await page.evaluate(() => window.__senkron.SEMA_SURUM);
    expect(govde.sema).toBe(sema);
    const ayar = await page.evaluate(() => JSON.parse(localStorage.getItem('kk_senkron_v1')));
    expect(ayar.sonSema).toBe(sema);                 // görülen şema hafızada
  });

  test('uçuş sırasındaki kayıt kaybolmaz: senkron bitince yeniden planlanır ve gönderilir', async ({ page }) => {
    const durum = await odaKur(page, { oda: {} });
    await tohumla(page, [sahteKitap({ ad: 'Tek Kitap' })]);
    await rafAc(page);
    const sonuclar = await page.evaluate(() => {
      window.__senkron.ayarKaydet({ oda: 'g27-test-odasi', cihaz: 'testcihaz', sonSenkron: null });
      // ikinci çağrı uçuş sırasına denk gelir: eskiden sessizce yutulurdu
      return Promise.all([window.__senkron.senkronEt(true), window.__senkron.senkronEt(true)]);
    });
    expect(sonuclar).toEqual([true, false]);         // ikincisi ertelendi (yutulmadı)
    await expect.poll(() => durum.put, { timeout: 8000 }).toBeGreaterThanOrEqual(2); // ~4 sn sonra gönderildi
  });

  test('KRİTİK: PUT uçuşu sırasındaki kayıt başarı yolunda EZİLMEZ ve sonraki turda odaya gider', async ({ page }) => {
    // PUT gecikmeli: uçuş penceresi içinde kullanıcı kaydı simüle edilir
    const durum = await odaKur(page, { oda: {}, putGecikme: 600 });
    await tohumla(page, [sahteKitap({ ad: 'Eski Ad' })]);
    await rafAc(page);
    await page.evaluate(() => {
      window.__senkron.ayarKaydet({ oda: 'g27-test-odasi', cihaz: 'testcihaz', sonSenkron: null });
      window.__ucus = window.__senkron.senkronEt(true);   // beklenmeden başlat
    });
    await page.waitForTimeout(250);                       // PUT uçuştayken...
    await page.evaluate(() => {                           // ...kullanıcı kayıt yapar
      veri.kitaplar[0].ad = 'Uçuşta Değişti';
      depoKaydet();
    });
    expect(await page.evaluate(() => window.__ucus)).toBe(true);
    // eski davranış: başarı yolu veri+depoyu PUT-öncesi görüntüyle ezer, ad kaybolurdu
    expect(await page.evaluate(() => veri.kitaplar[0].ad)).toBe('Uçuşta Değişti');
    expect(await page.evaluate(() =>
      JSON.parse(localStorage.getItem('kk_kitaplik_v1')).kitaplar[0].ad)).toBe('Uçuşta Değişti');
    // bekleyen bayrağı sonraki turu planlar; o tur taze adı odaya taşır
    await expect.poll(() => durum.put, { timeout: 8000 }).toBeGreaterThanOrEqual(2);
    const son = JSON.parse(durum.govdeler[durum.govdeler.length - 1]);
    expect(son.kitaplar[0].ad).toBe('Uçuşta Değişti');
  });

  test('şema atlama turu kendini yeniden planlar; başarı bayrağı sıfırlar, ikinci gerileme yine korunur', async ({ page }) => {
    const durum = await odaKur(page, { oda: { kitaplar: [] } });   // odada sema yok
    await tohumla(page, [sahteKitap({ ad: 'Yerel Kitap' })],
      { kk_senkron_v1: { oda: 'g27-test-odasi', cihaz: 'testcihaz', sonSenkron: 1, sonSema: 2 } });
    await rafAc(page);
    // açılış sessiz senkronu atlama turudur; planla sayesinde ~4 sn içinde yazma turu KENDİLİĞİNDEN gelir
    await expect.poll(() => durum.put, { timeout: 8000 }).toBeGreaterThanOrEqual(1);
    const ilkGovde = JSON.parse(durum.govdeler[0]);
    expect(ilkGovde.sema).toBe(await page.evaluate(() => window.__senkron.SEMA_SURUM)); // şema geri yazıldı
    // İKİNCİ gerileme olayı: eski istemci odayı yine ezmiş gibi sema'yı düşür
    durum.odaYaz({ kitaplar: [] });              // sema alanı yine yok
    const atlandi = await page.evaluate(() => window.__senkron.senkronEt(true));
    expect(atlandi).toBe(false);                 // bayrak başarıda sıfırlanmıştı → koruma yine çalıştı
    const putOnce = durum.put;
    expect(await page.evaluate(() => window.__senkron.senkronEt(true))).toBe(true); // ikinci tur yazar
    expect(durum.put).toBe(putOnce + 1);
  });

  test('damga enflasyonu yok: kota turunda değişen kitap, sonraki sağlıklı kayıtta yeniden damgalanmaz', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Kitap A' }), sahteKitap({ ad: 'Kitap B' })]);
    await rafAc(page);
    await page.evaluate(() => depoKaydet());   // sağlıklı taban
    const sonuc = await page.evaluate(async () => {
      const asilSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function(anahtar, deger){
        if (anahtar === 'kk_kitaplik_v1') throw new Error('kota doldu (taklit)');
        return asilSet.apply(this, arguments);
      };
      veri.kitaplar[0].ad = 'A değişti (kota dolu)';
      depoKaydet();                             // düşer; izler bellekte bekler
      const gA1 = veri.kitaplar[0].g;
      Storage.prototype.setItem = asilSet;      // kota açıldı
      await new Promise(c => setTimeout(c, 10)); // damga zamanı ayrışsın
      veri.kitaplar[1].ad = 'B değişti';
      depoKaydet();                             // sağlıklı tur
      return { gA1, gA2: veri.kitaplar[0].g };
    });
    // bellek tabanı olmasa A "değişmiş" sanılıp taze damga alırdı → bayat içerik LWW kazanırdı
    expect(sonuc.gA2).toBe(sonuc.gA1);
  });

  test('depo yazımı başarısızsa parmak izi güncellenmez (kota uyumsuzluğu kapandı)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Kota Kitabı' })]);
    await rafAc(page);
    await page.evaluate(() => depoKaydet());   // sağlıklı taban: iz yazılsın
    const sonuc = await page.evaluate(() => {
      const izOnce = localStorage.getItem('kk_senkron_anlik_v1');
      const asilSet = Storage.prototype.setItem;
      Storage.prototype.setItem = function(anahtar, deger){
        if (anahtar === 'kk_kitaplik_v1') throw new Error('kota doldu (taklit)');
        return asilSet.apply(this, arguments);
      };
      veri.kitaplar[0].ad = 'Değişti ama diske gidemedi';
      const yazim = depoKaydet();
      Storage.prototype.setItem = asilSet;
      return { yazim, ayniKaldi: localStorage.getItem('kk_senkron_anlik_v1') === izOnce,
        kota: document.body.classList.contains('kota-dolu') };
    });
    expect(sonuc.yazim).toBe(false);                 // depoKaydet dürüstçe bildirdi
    expect(sonuc.ayniKaldi).toBe(true);              // iz, bayat depoyla uyumlu kaldı
    expect(sonuc.kota).toBe(true);                   // kota şeridi kullanıcıya görünür
  });
});
