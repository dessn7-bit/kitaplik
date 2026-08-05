/* G26 — Senkron alan/dizi bazlı birleştirme (keşif R4) + şema sürümü koruması.
   Kurallar: skalerler kitap-LWW (istisna: guncelSayfa büyük kazanır); diziler
   kimlik bazlı BİRLEŞİM (notlar id+ng, oturumlar b, okumalar bas+bit, odunc
   kisi+verilis, seanslar t büyük-b, etiketler/fikir iKatla kümesi); silinen not
   NOT MEZAR TAŞI (silinenNotlar) ile ölü kalır, mezardan sonra düzenlenen (ng)
   yaşar. Şema koruması: odadaki sema yerelden büyükse NE birleştir NE yaz.
   birlestir SAF: window.__senkron.birlestir doğrudan çağrılır (g8 deseni). */
'use strict';
const { test, expect, tohumla, sahteKitap, bugunISO, onaylariKabulEt } = require('./yardim');

function kitap(id, ek) {
  return Object.assign({ id, ad: 'Kitap ' + id, yazar: 'Yazar', g: 100, notlar: [] }, ek || {});
}
function not(id, ek) {
  return Object.assign({ id, tip: 'alinti', metin: 'Metin ' + id, tarih: '2026-01-10',
    sayfa: null, fikir: [], ng: 0 }, ek || {});
}
/* saf birleştirme: aynı id'li iki kitap kopyasını birleştirip tek kitabı döndürür */
async function birlestirilmis(page, yerelK, uzakK) {
  return page.evaluate(([y, u]) => {
    const b = window.__senkron.birlestir(
      { kitaplar: [y], silinenler: {} }, { kitaplar: [u], silinenler: {} });
    return b.kitaplar[0];
  }, [yerelK, uzakK]);
}

test.describe('G26 senkron dizi birleşimi + şema koruması', () => {

  test('KRİTİK: iki cihaz aynı kitaba FARKLI alıntı ekler → İKİSİ DE kalır', async ({ page }) => {
    await page.goto('/');
    const k = await birlestirilmis(page,
      kitap('x', { g: 200, notlar: [not('nYerel', { metin: 'Yerel alıntı' })] }),
      kitap('x', { g: 100, notlar: [not('nUzak', { metin: 'Uzak alıntı' })] }));
    expect(k.notlar.length).toBe(2);   // eski davranış: kazanan kitap uzak notu EZERDİ
    const idler = k.notlar.map(n => n.id).sort();
    expect(idler).toEqual(['nUzak', 'nYerel']);
  });

  test('not silme mezar taşı yazar (UI) ve yenilemede korunur', async ({ page }) => {
    const n = not('silinecek');
    await tohumla(page, [sahteKitap({ notlar: [n] })]);
    onaylariKabulEt(page);
    await page.goto('/');
    await page.click('#liste .kart');
    await page.click(`#detayIcerik [data-act="not-sil"][data-nid="${n.id}"]`);
    let mezar = await page.evaluate(() => veri.kitaplar[0].silinenNotlar);
    expect(mezar.silinecek).toBeGreaterThan(0);
    await page.reload();
    mezar = await page.evaluate(() => veri.kitaplar[0].silinenNotlar);
    expect(mezar.silinecek).toBeGreaterThan(0);   // kitapNormalize elemedi
  });

  test('silinen not birleşimde GERİ GELMEZ (mezar iki yönde de işler)', async ({ page }) => {
    await page.goto('/');
    // yerel sildi, uzak kopyada not hâlâ var
    const a = await birlestirilmis(page,
      kitap('x', { g: 200, notlar: [], silinenNotlar: { nEski: 5000 } }),
      kitap('x', { g: 100, notlar: [not('nEski', { ng: 1000 })] }));
    expect(a.notlar.length).toBe(0);
    expect(a.silinenNotlar.nEski).toBe(5000);     // mezar taşınıyor
    // uzak sildi, yerel kopyada not hâlâ var (kitap-kazanan yerel olsa bile)
    const b = await birlestirilmis(page,
      kitap('x', { g: 200, notlar: [not('nEski', { ng: 1000 })] }),
      kitap('x', { g: 100, notlar: [], silinenNotlar: { nEski: 5000 } }));
    expect(b.notlar.length).toBe(0);
  });

  test('silme sonrası düzenleme: ng mezardan yeniyse not yaşar ve mezar düşer', async ({ page }) => {
    await page.goto('/');
    const a = await birlestirilmis(page,
      kitap('x', { g: 200, notlar: [], silinenNotlar: { n1: 5000 } }),
      kitap('x', { g: 100, notlar: [not('n1', { ng: 9000, metin: 'Sonradan düzenlendi' })] }));
    expect(a.notlar.length).toBe(1);              // düzenleme silmeden yeni → yaşar
    expect(a.silinenNotlar.n1).toBeUndefined();   // mezar kalktı, yeniden öldürmez
    const b = await birlestirilmis(page,
      kitap('x', { g: 200, notlar: [], silinenNotlar: { n1: 9000 } }),
      kitap('x', { g: 100, notlar: [not('n1', { ng: 5000 })] }));
    expect(b.notlar.length).toBe(0);              // silme düzenlemeden yeni → ölü (tutarlı kural)
  });

  test('aynı not iki tarafta: ng yeni olan kazanır, eşitlikte kitap-kazananı; fikir birleşir', async ({ page }) => {
    await page.goto('/');
    const a = await birlestirilmis(page,
      kitap('x', { g: 200, notlar: [not('n1', { metin: 'Yerel hali', ng: 1000, fikir: ['özgürlük'] })] }),
      kitap('x', { g: 100, notlar: [not('n1', { metin: 'Uzak hali', ng: 2000, fikir: ['ahlak'] })] }));
    expect(a.notlar[0].metin).toBe('Uzak hali'); // ng 2000 > 1000: kitap-kazananına rağmen not-uzak
    expect(a.notlar[0].fikir.sort()).toEqual(['ahlak', 'özgürlük']); // fikir küme birleşimi
    const b = await birlestirilmis(page,
      kitap('x', { g: 200, notlar: [not('n1', { metin: 'Yerel hali', ng: 0 })] }),
      kitap('x', { g: 100, notlar: [not('n1', { metin: 'Uzak hali', ng: 0 })] }));
    expect(b.notlar[0].metin).toBe('Yerel hali'); // ng eşit → kitap-kazananı tarafı
  });

  test('oturumlar birleşir, aynı b mükerrer olmaz, tamamlanmış (uzun) hali kazanır', async ({ page }) => {
    await page.goto('/');
    const k = await birlestirilmis(page,
      kitap('x', { g: 200, oturumlar: [{ b: 1000, s: 60000, sa: 1, sb: 5 }, { b: 3000, s: 100, sa: 6, sb: 6 }] }),
      kitap('x', { g: 100, oturumlar: [{ b: 1000, s: 60000, sa: 1, sb: 5 }, { b: 2000, s: 30000, sa: 5, sb: 8 },
        { b: 3000, s: 90000, sa: 6, sb: 12 }] }));
    expect(k.oturumlar.length).toBe(3);                        // 1000 mükerrer değil, 2000 eklendi
    expect(k.oturumlar.find(o => o.b === 3000).s).toBe(90000); // uzun (tamamlanmış) oturum kazandı
  });

  test('okumalar birleşir, aynı bas+bit mükerrer olmaz', async ({ page }) => {
    await page.goto('/');
    const k = await birlestirilmis(page,
      kitap('x', { g: 200, okumalar: [{ bas: '2025-01-01', bit: '2025-02-01', puan: 8, not: '' }] }),
      kitap('x', { g: 100, okumalar: [{ bas: '2025-01-01', bit: '2025-02-01', puan: 8, not: '' },
        { bas: '2026-03-01', bit: '2026-04-01', puan: 9, not: 'ikinci okuma' }] }));
    expect(k.okumalar.length).toBe(2);
    expect(k.okumalar.find(o => o.bas === '2026-03-01').puan).toBe(9);
  });

  test('ödünç birleşir (kisi+verilis anahtar), iade kaydı tercih edilir', async ({ page }) => {
    await page.goto('/');
    const k = await birlestirilmis(page,
      kitap('x', { g: 200, odunc: [{ kisi: 'Ali', verilis: '2026-01-01', donus: null }] }),
      kitap('x', { g: 100, odunc: [{ kisi: 'Ali', verilis: '2026-01-01', donus: '2026-02-01' },
        { kisi: 'Ayşe', verilis: '2026-03-01', donus: null }] }));
    expect(k.odunc.length).toBe(2);
    expect(k.odunc.find(o => o.kisi === 'Ali').donus).toBe('2026-02-01'); // iade ileridedir
  });

  test('seanslar: aynı gün büyük (ilerlemiş) sayfa kazanır, farklı günler birleşir', async ({ page }) => {
    await page.goto('/');
    const k = await birlestirilmis(page,
      kitap('x', { g: 200, seanslar: [{ t: '2026-08-01', a: 10, b: 40 }] }),
      kitap('x', { g: 100, seanslar: [{ t: '2026-08-01', a: 10, b: 65 }, { t: '2026-08-02', a: 65, b: 80 }] }));
    expect(k.seanslar.length).toBe(2);
    expect(k.seanslar.find(s => s.t === '2026-08-01').b).toBe(65); // ilerlemiş olan
  });

  test('guncelSayfa: 120 ve 80 → 120 kazanır (damgadan bağımsız)', async ({ page }) => {
    await page.goto('/');
    const a = await birlestirilmis(page,
      kitap('x', { g: 200, guncelSayfa: 80 }), kitap('x', { g: 100, guncelSayfa: 120 }));
    expect(a.guncelSayfa).toBe(120);   // kazanan kitapta 80 olsa bile ilerleme geri gitmez
    const b = await birlestirilmis(page,
      kitap('x', { g: 200, guncelSayfa: 120 }), kitap('x', { g: 100, guncelSayfa: 80 }));
    expect(b.guncelSayfa).toBe(120);
  });

  test('etiketler birleşir, TR mükerrer olmaz (Islam/İslam tek)', async ({ page }) => {
    await page.goto('/');
    const k = await birlestirilmis(page,
      kitap('x', { g: 200, etiketler: ['İslam', 'tarih'] }),
      kitap('x', { g: 100, etiketler: ['Islam', 'felsefe'] }));
    expect(k.etiketler.length).toBe(3);            // İslam/Islam tek (iKatla), felsefe eklendi
    expect(k.etiketler).toContain('İslam');        // kazanan tarafın yazımı korunur
    expect(k.etiketler).toContain('felsefe');
  });

  test('skaler alanlar: daha yeni damgalı kitap kazanır (mevcut davranış korunur)', async ({ page }) => {
    await page.goto('/');
    const k = await birlestirilmis(page,
      kitap('x', { g: 200, ad: 'Yeni Ad', durum: 'bitti', puan: 9, raf: 'salon' }),
      kitap('x', { g: 100, ad: 'Eski Ad', durum: 'okunacak', puan: 3, raf: 'depo' }));
    expect(k.ad).toBe('Yeni Ad');
    expect(k.durum).toBe('bitti');
    expect(k.puan).toBe(9);
    expect(k.raf).toBe('salon');
  });

  test('şema koruması: odadaki sema büyükse yerel NE birleştirir NE yazar + uyarı', async ({ page }) => {
    let putSayisi = 0;
    await page.route('**/identitytoolkit.googleapis.com/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ idToken: 'sahte-token', refreshToken: 'sahte-yenile' }) }));
    await page.route('**/*firebasedatabase.app/**', route => {
      if (route.request().method() === 'PUT') { putSayisi++; }
      if (route.request().method() === 'GET')
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ sema: 999, kitaplar: [{ id: 'uzakK', ad: 'Gelecekten Kitap', g: 1 }] }) });
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await tohumla(page, [sahteKitap({ ad: 'Yerel Kitap' })]);
    await page.goto('/');
    const sonuc = await page.evaluate(() => {
      window.__senkron.ayarKaydet({ oda: 'g26-test-odasi', cihaz: 'testcihaz', sonSenkron: null });
      return window.__senkron.senkronEt(true);
    });
    expect(sonuc).toBe(false);                                  // senkron reddedildi
    expect(putSayisi).toBe(0);                                  // uzağa YAZILMADI
    const yerel = await page.evaluate(() => veri.kitaplar.map(k => k.ad));
    expect(yerel).toEqual(['Yerel Kitap']);                     // gelecekteki veri İÇERİ ALINMADI
    await page.click('[data-act="sekme"][data-v="yedek"]');
    await expect(page.locator('#senkronDurum')).toContainText('eski sürümde'); // uyarı görünür
    // ikinci deneme kısa devre: GET bile atılmadan reddedilir
    expect(await page.evaluate(() => window.__senkron.senkronEt(true))).toBe(false);
  });

  test('eşit şemada normal çalışır: PUT gövdesi sema numarasını taşır', async ({ page }) => {
    let putGovde = null;
    await page.route('**/identitytoolkit.googleapis.com/**', route =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ idToken: 'sahte-token', refreshToken: 'sahte-yenile' }) }));
    await page.route('**/*firebasedatabase.app/**', route => {
      if (route.request().method() === 'PUT') putGovde = route.request().postData();
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
    await tohumla(page, [sahteKitap({ ad: 'Senkronlu Kitap' })]);
    await page.goto('/');
    const tamam = await page.evaluate(() => {
      window.__senkron.ayarKaydet({ oda: 'g26-test-odasi', cihaz: 'testcihaz', sonSenkron: null });
      return window.__senkron.senkronEt(true);
    });
    expect(tamam).toBe(true);
    expect(JSON.parse(putGovde).sema).toBe(
      await page.evaluate(() => window.__senkron.SEMA_SURUM));  // dinamik, sabit yazılmaz
  });

  test('göç: eski anlık görüntü (s:6) damga basmaz, yeni sürümle yazılır', async ({ page }) => {
    const k = sahteKitap({ ad: 'Göç Kitabı v7', g: 9, notlar: [not('n1')] });
    await tohumla(page, [k], { kk_senkron_anlik_v1: { s: 6, p: { eskiId: 'x-yz' } } });
    await page.goto('/');
    await page.evaluate(() => depoKaydet());
    expect(await page.evaluate(() => veri.kitaplar[0].g)).toBe(9);
    const anlik = await page.evaluate(() => JSON.parse(localStorage.getItem('kk_senkron_anlik_v1')));
    expect(anlik.s).toBe(await page.evaluate(() => window.__senkron.ANLIK_SURUM));
  });

  test('eski format veri çökmez: ng ve mezarsız notlar, id\'siz not kaybolmaz', async ({ page }) => {
    // açılış: ng'siz/mezarsız eski kitap normalize'dan sağ çıkar
    await tohumla(page, [{ id: 'eski1', ad: 'Çok Eski Kitap',
      notlar: [{ tip: 'alinti', metin: 'İdsiz eski alıntı' }] }]);
    await page.goto('/');
    const acilis = await page.evaluate(() => veri.kitaplar[0].notlar[0]);
    expect(acilis.ng).toBe(0);
    expect(acilis.id).toBeTruthy();                 // normalize id verdi
    // birleşim: ham (normalize görmemiş) uzak kopyada id'siz not → kaybolmaz
    const k = await birlestirilmis(page,
      kitap('x', { g: 200, notlar: [not('n1')] }),
      { id: 'x', ad: 'Kitap x', g: 100, notlar: [{ tip: 'not', metin: 'İdsiz uzak not' }] });
    expect(k.notlar.length).toBe(2);
    expect(k.notlar.some(n => n.metin === 'İdsiz uzak not')).toBe(true);
  });

  test('ng damgası kasıtlı düzenlemede güncellenir: fikir ekleme + tekrar eylemi', async ({ page }) => {
    const n1 = not('nFikir', { ng: 0 });
    const n2 = not('nTekrar', { ng: 0, tekrarDurum: 'aktif', tekrarAralik: 3,
      tekrarSayisi: 0, tekrarSonraki: bugunISO(-1) });
    await tohumla(page, [sahteKitap({ notlar: [n1, n2] })]);
    await page.goto('/');
    await page.click('[data-act="sekme"][data-v="alinti"]');
    const kartA = page.locator(`#alintiIcerik .not-kart[data-nid="${n1.id}"]`);
    await kartA.locator('.fikir-giris').fill('cesaret');
    await kartA.locator('[data-act="fikir-ekle"]').click();
    expect(await page.evaluate(id =>
      veri.kitaplar[0].notlar.find(x => x.id === id).ng, n1.id)).toBeGreaterThan(0);
    await page.click('#tkKutu [data-act="tk-devam"]');
    expect(await page.evaluate(id =>
      veri.kitaplar[0].notlar.find(x => x.id === id).ng, n2.id)).toBeGreaterThan(0);
  });

  test('performans: 500 kitaplık iki taraflı birleşim makul sürede biter', async ({ page }) => {
    await page.goto('/');
    const sonuc = await page.evaluate(() => {
      const taraf = kayma => ({
        kitaplar: Array.from({ length: 500 }, (_, i) => ({
          id: 'k' + i, ad: 'Kitap ' + i, g: 100 + kayma,
          etiketler: ['roman', 'tarih'],
          notlar: Array.from({ length: 3 }, (_, j) => ({
            id: 'n' + i + '-' + j + '-' + kayma, tip: 'alinti',
            metin: 'Alıntı ' + j, tarih: '2026-01-01', ng: kayma })),
          oturumlar: [{ b: 1000 + kayma, s: 60000, sa: 1, sb: 5 }],
          seanslar: [{ t: '2026-08-01', a: 1, b: 5 + kayma }]
        })),
        silinenler: {}
      });
      const yerel = taraf(0), uzak = taraf(50);
      const t0 = performance.now();
      const b = window.__senkron.birlestir(yerel, uzak);
      const ms = performance.now() - t0;
      return { ms: Math.round(ms * 10) / 10, adet: b.kitaplar.length,
        notToplam: b.kitaplar.reduce((t, k) => t + k.notlar.length, 0) };
    });
    console.log('[G26 performans] 500 kitap × 2 taraf birleşim: ' + sonuc.ms + ' ms, '
      + sonuc.notToplam + ' not');
    expect(sonuc.adet).toBe(500);
    expect(sonuc.notToplam).toBe(3000);         // 3 yerel + 3 uzak not/kitap — hepsi yaşıyor
    expect(sonuc.ms).toBeLessThan(2000);        // cömert sınır; gerçek değer rapora
  });
});
