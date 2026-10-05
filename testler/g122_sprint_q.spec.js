'use strict';
/* G122 — SPRINT Q (v131): özet/not içe aktarımı esnek eşleşme + rapor kartı (Q1),
   senkron çakışması c alanında + göç + çözüm UI (Q2), kaynak/doğrulama (Q3),
   sahipsiz özetler + ISBN onay kartı (Q4).

   KÖK NEDENLER (23 Eylül / 1 Ekim 2026 gerçek yedekleri):
   · Q1 — iceOku/iceNotOku ad+yazar'ı katla() ile BİREBİR eşliyordu: 15 Puşkin
     ("Alexander Pushkin" ↔ "Alexandr Puškin") + 1 Sartre ("Jean Paul" ↔
     "Jean-Paul") sessizce "bulunamadı"ya düştü.
   · Q2 — senkron.js eski ozetBirlesim çakışmayı metnin İÇİNE yazıyordu ve
     "yeni metin eskiyi kapsamıyorsa ekle" (mY.indexOf(mE) < 0) kapısı TEK YÖNLÜ
     yakınsıyordu: yeni damgalı taraf KISA metin (A) ve eski taraf zaten birleşik
     (A + ek + B) olunca A.indexOf(A+ek+B) = -1 → A + ek + (A + ek + B). Her
     yeniden yükleme / öbür cihaz turu bir A kopyası daha ekledi: 1 Ekim yedeğinde
     301 kaydın 237'si ekli, 4 parçaya kadar, 119'unda parçalar aynı metnin
     tekrarı, 4,78 M karakterin 2,89 M'si çöp.
   · Q4a — ozetSenkronEt fihristteki HER id'yi çekiyordu: kitabı silinmiş özet
     açılış süpürücüsünün sildiği yere her turda geri iniyor, yedeğe giriyordu.

   (Mutasyon 1: kitapEslestir aday dalı kaldırılır → Q1 (b)/(d) kırmızı.
    Mutasyon 2: ozCakismaAyir split yerine metni olduğu gibi bırakır → Q2 (b)/(f) kırmızı.
    Mutasyon 3: ozetBirlesim aynı metinde de c girdisi/taze damga üretir → Q2 (a) kırmızı.
    Mutasyon 4: ozetSenkronEt canlı kapısı kalkar → Q4 (a) kırmızı.
    Mutasyon 5: iceUygulaOzet onaysız adayı da yazar → Q1 (b) kırmızı.) */
const { test, expect, tohumla, sahteKitap, bugunISO, rafAc, rafaGec, ayarlarAc,
  dosyadanYukle, jsonDosya, ayrintilarAc } = require('./yardim');

const AYM = '\n\n— · —\nÇakışan özet (diğer cihazdan):\n\n';
const AYO = '\n\n— · —\nÇakışan ontoloji (diğer cihazdan):\n\n';

function bitmis(ek) {
  return sahteKitap(Object.assign({ durum: 'bitti', bitisTarihi: bugunISO(-30) }, ek));
}
const ozetHazir = page => page.evaluate(() => window.__ozet.hazirBekle());
/* HAM IDB yazımı — normalize/göç kapısından GEÇMEZ: eski (şişkin) kayıtları
   açılış göçünün önüne koymak için. g80 (C) deseni. */
async function hamIdbYaz(page, kayitlar) {
  await page.evaluate(k => new Promise((cozul, kir) => {
    const istek = indexedDB.open('kk_ozet_v1', 1);
    istek.onsuccess = () => {
      const db = istek.result;
      const tx = db.transaction('ozetler', 'readwrite');
      const st = tx.objectStore('ozetler');
      for (const [id, v] of Object.entries(k)) st.put(v, id);
      tx.oncomplete = () => { db.close(); cozul(); };
      tx.onerror = () => kir(tx.error);
    };
    istek.onerror = () => kir(istek.error);
  }), kayitlar);
}
const hamIdbOku = page => page.evaluate(() => new Promise((cozul, kir) => {
  const istek = indexedDB.open('kk_ozet_v1', 1);
  istek.onsuccess = () => {
    const db = istek.result, tx = db.transaction('ozetler', 'readonly'), st = tx.objectStore('ozetler');
    const a = st.getAllKeys(), b = st.getAll();
    tx.oncomplete = () => { const o = {}; a.result.forEach((id, i) => { o[id] = b.result[i]; }); db.close(); cozul(o); };
    tx.onerror = () => kir(tx.error);
  };
  istek.onerror = () => kir(istek.error);
}));
/* Sahte oda — g79 deseni (ana gövde + --ozet kardeş düğümü) */
async function sahteOda(page, ilkIzler, ilkKayitlar) {
  const s = { anaPutlar: [], ozetPatchler: [], ozetIzlerGet: 0, kGet: [],
    izler: { ...(ilkIzler || {}) }, kayitlar: { ...(ilkKayitlar || {}) }, ana: {} };
  await page.route('**/identitytoolkit.googleapis.com/**', r =>
    r.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ idToken: 'sahte', refreshToken: 'sahte' }) }));
  await page.route('**/*firebasedatabase.app/**', r => {
    const url = r.request().url(), met = r.request().method();
    const json = g => r.fulfill({ status: 200, contentType: 'application/json',
      headers: { 'ETag': 'e1', 'Access-Control-Expose-Headers': 'ETag' },
      body: JSON.stringify(g) });
    if (url.includes('--ozet')) {
      if (met === 'GET' && url.includes('izler.json')) { s.ozetIzlerGet++; return json(s.izler); }
      if (met === 'GET' && url.includes('/k/')) {
        const id = decodeURIComponent(url.split('/k/')[1].split('.json')[0]);
        s.kGet.push(id);
        return json(s.kayitlar[id] || null);
      }
      if (met === 'PATCH') {
        const b = JSON.parse(r.request().postData() || '{}');
        s.ozetPatchler.push(b);
        for (const [yol, v] of Object.entries(b)) {
          if (yol.startsWith('k/')) s.kayitlar[yol.slice(2)] = v;
          if (yol.startsWith('izler/')) s.izler[yol.slice(6)] = v;
        }
        return json({});
      }
      return json(null);
    }
    if (met === 'GET') return json(s.ana);
    if (met === 'PUT') {
      const govde = r.request().postData() || '';
      s.anaPutlar.push(govde);
      s.ana = JSON.parse(govde || '{}');
      return json({});
    }
    return json({});
  });
  return s;
}
async function senkronBaslat(page) {
  return page.evaluate(() => {
    window.__senkron.ayarKaydet({ oda: 'testodasi', cihaz: 'c1', sonSenkron: null });
    return window.__senkron.senkronEt(true);
  });
}
const sonPatch = oda => {
  const p = oda.ozetPatchler[oda.ozetPatchler.length - 1];
  const k = Object.keys(p).find(x => x.startsWith('k/'));
  return { id: k.slice(2), kayit: p[k], iz: p['izler/' + k.slice(2)] };
};

/* ---------- GERÇEK AD LİSTESİ (23 Eylül yedeğindeki 15 Puşkin + Sartre) ---------- */
const PUSKIN_ADLAR = ['Der Stationsaufseher', 'Egyptian Nights', 'Kirdzhali', 'The Coffin Maker', 'The Blizzard',
  'Maça Kızı', 'Dubrovski', 'Roslavlev', 'Goryuhino Köyü Tarihi', 'Köylü genç bayan', 'Atış',
  'Novelle del defunto Ivan Petrovič Belkin', 'Mektuplarla Roman', "Büyük Petro'nun Arabı", 'Yüzbaşının Kızı'];
function puskinKutuphanesi() {
  return PUSKIN_ADLAR.map((ad, i) => bitmis({ id: 'pus' + i, ad, yazar: 'Alexandr Puškin' })).concat([
    bitmis({ id: 'sartre1', ad: 'Toplu Oyunlar 2', yazar: 'Jean-Paul Sartre' }),
    bitmis({ id: 'duvar1', ad: 'Duvar', yazar: 'Jean-Paul Sartre' }),
    bitmis({ id: 'duvar2', ad: 'Duvar', yazar: 'Marlen Haushofer' }),   // aynı ad, iki kitap → aday YOK
    bitmis({ id: 'zweig1', ad: 'Satranç', yazar: 'Stefan Zweig' })]);
}
function puskinDosyasi() {
  return { surum: 1, ozet: PUSKIN_ADLAR.map((ad, i) => ({ ad, yazar: 'Alexander Pushkin', ozet: 'Puşkin özeti ' + i + '.' })).concat([
    { ad: 'Toplu Oyunlar 2', yazar: 'Jean Paul Sartre', ozet: 'Sartre oyunları özeti.' },            // tire farkı → BİREBİR
    { ad: 'Duvar', yazar: 'Marlen Hauschofer', ozet: 'Haushofer Duvar.' },                            // ad iki kitapta → eşleşmez
    { id: 'zweig1', ad: 'Schachnovelle', yazar: 'Zweig, S.', ozet: 'id ile gelen Satranç özeti.' },  // id öncelikli
    { ad: 'Satranç', yazar: 'Arnold Zweig', ozet: 'yanlış Zweig' }]) };                                // soyad aynı, oran düşük → eşleşmez
}

test.describe('G122 Q1 — esnek eşleştirme + rapor kartı', () => {

  test('(a) esAnahtar / yazarBenzer / kitapEslestir sözleşmesi (saf, hiçbir şey yazmaz)', async ({ page }) => {
    await tohumla(page, puskinKutuphanesi());
    await rafAc(page);
    const s = await page.evaluate(() => {
      const E = window.__eslesme, d = window.__ice.kitapDizini(true);
      const es = r => { const x = window.__ice.kitapEslestir(r, d); return { tur: x.tur, id: x.kitaplar ? x.kitaplar.map(k => k.id) : null }; };
      return {
        tire: E.anahtar('Jean-Paul Sartre') === E.anahtar('Jean Paul Sartre'),
        aksan: E.anahtar('Puškin') === E.anahtar('puskin'),
        kesme: E.anahtar("Büyük Petro'nun Arabı") === E.anahtar('Buyuk Petronun Arabi'),
        puskin: E.yazarBenzer('Alexander Pushkin', 'Alexandr Puškin'),
        dosto: E.yazarBenzer('Fyodor Dostoyevski', 'Fyodor Dostoevsky'),
        cehov: E.yazarBenzer('Anton Chekhov', 'Anton Çehov'),
        soyad: E.yazarBenzer('Sartre', 'Jean-Paul Sartre'),
        zweig: E.yazarBenzer('Stefan Zweig', 'Arnold Zweig'),
        mann: E.yazarBenzer('Thomas Mann', 'Heinrich Mann'),
        bos: E.yazarBenzer('', 'Puşkin'),
        id: es({ id: 'zweig1', ad: 'Bambaşka', yazar: 'Kimse' }),
        tam: es({ ad: 'Toplu Oyunlar 2', yazar: 'Jean Paul Sartre' }),
        aday: es({ ad: 'Maça Kızı', yazar: 'Alexander Pushkin' }),
        adayBosYazar: es({ ad: 'Maça Kızı', yazar: '' }),
        tamIkinciKitap: es({ ad: 'Duvar', yazar: 'Marlen Haushofer' }),      // birebir yazar → normalize anahtar bulur
        ikiKitap: es({ ad: 'Duvar', yazar: 'Marlen Hauschofer' }),           // yazar yazımı farklı, ad İKİ kitapta → aday yok
        yabanci: es({ ad: 'Maça Kızı', yazar: 'Orhan Pamuk' }),
        katiDizin: window.__ice.kitapEslestir({ ad: 'Maça Kızı', yazar: 'Alexander Pushkin' }, window.__ice.kitapDizini(false)).tur
      };
    });
    expect(s.tire && s.aksan && s.kesme, 'anahtar: tire/aksan/kesme düşer').toBe(true);
    expect([s.puskin, s.dosto, s.cehov, s.soyad], 'translitere toleransı').toEqual([true, true, true, true]);
    expect([s.zweig, s.mann, s.bos], 'yanlış-pozitif kapısı: soyad aynı farklı yazar / boş').toEqual([false, false, false]);
    expect(s.id, 'id birinci').toEqual({ tur: 'id', id: ['zweig1'] });
    expect(s.tam, 'normalize anahtar ikinci').toEqual({ tur: 'tam', id: ['sartre1'] });
    expect(s.aday, 'tek kitap + benzer yazar → aday').toEqual({ tur: 'aday', id: ['pus5'] });
    expect(s.adayBosYazar.tur, 'yazarsız kayıt da aday (onaya düşer)').toBe('aday');
    expect(s.tamIkinciKitap, 'aynı adlı ikinci kitap yazarıyla birebir bulunur').toEqual({ tur: 'tam', id: ['duvar2'] });
    expect(s.ikiKitap, 'aynı adı iki kitap taşıyor → aday DEĞİL').toEqual({ tur: null, id: null });
    expect(s.yabanci.tur, 'yazar benzemiyor → aday değil').toBe(null);
    expect(s.katiDizin, 'tur/adTr dizini (esnek değil): aday yok').toBe(null);
  });

  test('(b) GERÇEK AD LİSTESİ: 15 Puşkin aday + Sartre birebir; rapor sayıları; Uygula\'ya kadar IDB/senkrona TEK BAYT yok; onaysız aday yazılmaz', async ({ page }) => {
    await tohumla(page, puskinKutuphanesi());
    const oda = await sahteOda(page);
    await rafAc(page);
    await ozetHazir(page);
    const idbOnce = await hamIdbOku(page);
    await ayarlarAc(page);
    await dosyadanYukle(page, jsonDosya(puskinDosyasi(), 'ozetler.json'));
    await expect(page.locator('#zgOzetIceOrtu')).toHaveClass(/acik/);
    const ozet = page.locator('#zgOzetIceOrtu .zg-ozet');
    await expect(ozet).toContainText('2 kayıt eşleşti (1 id ile)');
    await expect(ozet).toContainText('2 kitapta boş özet dolacak');
    await expect(ozet).toContainText('15 aday onay bekliyor');
    await expect(ozet).toContainText('2 kayıt kütüphanede bulunamadı');
    const plan = await page.evaluate(() => window.__ice.plan());
    expect(plan.adaylar.length, '15 Puşkin aday').toBe(15);
    expect(plan.adaylar.every(a => !a.onay), 'aday varsayılan İŞARETSİZ (onay bekliyor)').toBe(true);
    expect(plan.eslesmeyen.map(r => r.ad).sort()).toEqual(['Duvar', 'Satranç']);
    await expect(page.locator('#zgOzetIceOrtu .zg-aday-satir')).toHaveCount(15);
    await expect(page.locator('[data-act="zg-ozet-uygula"]')).toHaveText('Özetleri yaz (2)');
    /* hiçbir şey yazılmadı: IDB ham kayıtlar birebir, düğüme PATCH yok */
    expect(await hamIdbOku(page), 'IDB değişmedi').toEqual(idbOnce);
    expect(oda.ozetPatchler.length, 'senkrona yazım yok').toBe(0);
    /* tümünü onayla → 17; birini kaldır → 16 */
    await page.click('#zgOzetIceOrtu [data-act="zg-aday-tum"]');
    await expect(page.locator('[data-act="zg-ozet-uygula"]')).toHaveText('Özetleri yaz (17)');
    await expect(ozet).toContainText('0 aday onay bekliyor (15 onaylandı)');
    await page.locator('#zgOzetIceOrtu .zg-aday-kutu[data-i="3"]').click();
    await expect(page.locator('[data-act="zg-ozet-uygula"]')).toHaveText('Özetleri yaz (16)');
    expect(await hamIdbOku(page), 'onay kutusu da yazmaz').toEqual(idbOnce);
    await page.click('[data-act="zg-ozet-uygula"]');
    await expect(page.locator('#toast')).toContainText('16 kitabın özeti dosyadan yazıldı');
    const s = await page.evaluate(() => ({
      p0: window.__ozet.oku('pus0'), p3: window.__ozet.oku('pus3'), p14: window.__ozet.oku('pus14'),
      sartre: window.__ozet.oku('sartre1'), zweig: window.__ozet.oku('zweig1'),
      duvar1: window.__ozet.oku('duvar1'), duvar2: window.__ozet.oku('duvar2') }));
    expect(s.p0).toBe('Puşkin özeti 0.');
    expect(s.p14).toBe('Puşkin özeti 14.');
    expect(s.p3, 'onayı kaldırılan aday YAZILMADI').toBe('');
    expect(s.sartre, 'tire farkı birebir eşleşti').toBe('Sartre oyunları özeti.');
    expect(s.zweig, 'id ile eşleşti (ad/yazar farklı)').toBe('id ile gelen Satranç özeti.');
    expect([s.duvar1, s.duvar2], 'belirsiz ad hiçbir kitaba yazılmadı').toEqual(['', '']);
  });

  test('(c) eski biçim {ozet:[{ad,yazar,ozet,ontoloji}]} birebir yolda aynen çalışır; aday yokken aday bloğu çizilmez', async ({ page }) => {
    await tohumla(page, [bitmis({ ad: 'Boş Özetli', yazar: 'Yazar A' })]);
    await rafAc(page);
    await ozetHazir(page);
    await ayarlarAc(page);
    await dosyadanYukle(page, jsonDosya({ ozet: [{ ad: 'Boş Özetli', yazar: 'Yazar A', ozet: 'Eski biçim.', ontoloji: 'Onto.' }] }, 'o.json'));
    await expect(page.locator('#zgOzetIceOrtu .zg-ozet')).toContainText('1 kayıt eşleşti');
    await expect(page.locator('#zgOzetIceOrtu .zg-aday-satir')).toHaveCount(0);
    await page.click('[data-act="zg-ozet-uygula"]');
    await expect(page.locator('#toast')).toContainText('1 kitabın özeti ve 1 kitabın ontolojisi dosyadan yazıldı');
    expect(await page.evaluate(() => [window.__ozet.oku(veri.kitaplar[0].id), window.__ozet.okuOnto(veri.kitaplar[0].id)]))
      .toEqual(['Eski biçim.', 'Onto.']);
  });

  test('(d) NOT dosyası: aday çift (dosya ad|yazar → kitap) toplu onaylanır; onaysızken satırlar plana girmez, kitap "dosyada geçen" sayılmaz', async ({ page }) => {
    await tohumla(page, [
      bitmis({ id: 'pus5', ad: 'Maça Kızı', yazar: 'Alexandr Puškin', notlar: [
        { id: 'esk1', tip: 'not', metin: 'eski içe aktarım notu', tarih: '2024-02-01', sayfa: null, ng: 7, kayn: 'dosya' }] }),
      bitmis({ id: 'sartre1', ad: 'Toplu Oyunlar 2', yazar: 'Jean-Paul Sartre' })]);
    await rafAc(page);
    await ayarlarAc(page);
    await dosyadanYukle(page, jsonDosya({ surum: 1, not: [
      { ad: 'Maça Kızı', yazar: 'Alexander Pushkin', tip: 'alinti', metin: 'Puşkin alıntısı bir.' },
      { ad: 'Maça Kızı', yazar: 'Alexander Pushkin', tip: 'not', metin: 'Puşkin notu iki.' },
      { ad: 'Toplu Oyunlar 2', yazar: 'Jean Paul Sartre', tip: 'not', metin: 'Sartre notu.' }] }, 'notlar.json'));
    const ozet = page.locator('#zgNotIceOrtu .zg-ozet');
    await expect(ozet).toContainText('1 satır eşleşti');
    await expect(ozet).toContainText('1 aday onay bekliyor');
    await expect(ozet).toContainText('1 satır yazılacak');
    await expect(ozet).toContainText('0 içe aktarım notu kaldırılacak');   // onaysız aday: Puşkin "dosyada geçen" değil, eski notu silinmez
    await expect(page.locator('#zgNotIceOrtu .zg-aday-satir')).toHaveCount(1);
    await expect(page.locator('#zgNotIceOrtu .zg-aday-satir')).toContainText('2 satır');
    await expect(page.locator('[data-act="zg-not-uygula"]')).toHaveText('Uygula (1 yaz)');
    await page.locator('#zgNotIceOrtu .zg-aday-kutu[data-i="0"]').click();
    await expect(ozet).toContainText('3 satır yazılacak');
    await expect(ozet).toContainText('1 içe aktarım notu kaldırılacak');   // onaylanınca kitap dosyada geçer: eski işaretli not çıkan
    await expect(page.locator('[data-act="zg-not-uygula"]')).toHaveText('Uygula (3 yaz, 1 sil)');
    await page.click('[data-act="zg-not-uygula"]');
    await expect(page.locator('#toast')).toContainText('3 not dosyadan yazıldı');
    const d = await page.evaluate(() => veri.kitaplar.map(k => (k.notlar || []).map(n => [n.metin, n.kayn])));
    expect(d[0]).toEqual([['Puşkin alıntısı bir.', 'dosya'], ['Puşkin notu iki.', 'dosya']]);
    expect(d[1]).toEqual([['Sartre notu.', 'dosya']]);
  });
});

test.describe('G122 Q2 — çakışma c alanında + göç', () => {

  test('(a) ozetBirlesim: AYNI metin iki cihazdan → c yok, damga tazelenmez (Q2d); kök neden: kısa-yeni ↔ şişkin-eski iç içe BÜYÜMEZ; simetrik birleşim aynı sonuç', async ({ page }) => {
    await rafAc(page);
    const s = await page.evaluate(([AYM]) => {
      const f = window.__senkron.ozetBirlesim;
      const A = 'Doğru özet metni.', B = 'Eski başka sürüm.';
      const ayni = f({ m: A, g: 300, o: 'o1' }, { m: A, g: 250, o: 'o1' });
      /* 1 Ekim mekanizması: yeni damgalı kısa A, eski damgalı şişkin A+ek+B */
      const sisik = f({ m: A, g: 300 }, { m: A + AYM + B, g: 250 });
      const ters = f({ m: A + AYM + B, g: 250 }, { m: A, g: 300 });
      const tur2 = f(sisik, { m: A + AYM + B, g: 250 });
      /* zaten şişkin iki taraf (A+ek+A+ek+B) tekrar birleşince m yine tek A */
      const cift = f({ m: A + AYM + A + AYM + B, g: 400 }, { m: A + AYM + B, g: 250 });
      /* ikinci katman tek başına: cTemizle m ile aynı (ayni işaretsiz) girdiyi düşürür,
         farklı olanı tutar, kopyayı n'siz tek girdiye indirir */
      const temiz = window.__ozet.cTemizle(A, '', [{ m: A, g: 1 }, { m: B, g: 2 }, { m: B, g: 2 }]);
      return { ayni, sisik, ters, tur2, cift, temiz };
    }, [AYM]);
    expect(s.temiz, 'cTemizle: m ile aynı girdi çakışma değil, kopya tek').toEqual([{ g: 2, m: 'Eski başka sürüm.' }]);
    expect(s.ayni.m).toBe('Doğru özet metni.');
    expect(s.ayni.c, 'aynı metin → çakışma YOK').toEqual([]);
    expect(s.ayni.g, 'aynı metin → damga tazelenmez (max)').toBe(300);
    expect(s.sisik.m, 'm TEK sürüm, ek yok').toBe('Doğru özet metni.');
    expect(s.sisik.m.indexOf('Çakışan')).toBe(-1);
    expect(s.sisik.c.filter(e => !e.ayni).map(e => e.m), 'B gerçek çakışma olarak c\'de').toEqual(['Eski başka sürüm.']);
    expect(JSON.stringify(s.ters.c), 'simetrik birleşim aynı c').toBe(JSON.stringify(s.sisik.c));
    expect(s.ters.m).toBe(s.sisik.m);
    expect(s.tur2.m, 'ikinci tur: büyüme yok').toBe('Doğru özet metni.');
    expect(JSON.stringify(s.tur2.c)).toBe(JSON.stringify(s.sisik.c));
    expect(s.tur2.g, 'ikinci tur damga tazelemez').toBe(s.sisik.g);
    expect(s.cift.m, 'iç içe şişkin girdi: m yine tek A').toBe('Doğru özet metni.');
    expect(s.cift.c.filter(e => !e.ayni).map(e => e.m)).toEqual(['Eski başka sürüm.']);
    const ozdes = s.cift.c.find(e => e.ayni);
    expect(ozdes && ozdes.m, 'özdeş kopya c\'de ayni:true ile saklanır (metin silinmez)').toBe('Doğru özet metni.');
    expect(ozdes.n, 'kopya sayısı korunur').toBe(1);
  });

  test('(b) AÇILIŞ GÖÇÜ: 15 Puşkin + 1 sahipsiz + 1 ontoloji — gerçek ayıraç biçimi, çoklu parça; damga SABİT; uzunluk denklemi (kayıp 0); sahipsiz DAHİL ve loglu', async ({ page }) => {
    /* kitap işaretleri gerçek verideki gibi: ozetG = IDB damgası, ozetUzunluk ŞİŞKİN */
    const kitaplar = PUSKIN_ADLAR.map((ad, i) => bitmis({ id: 'pus' + i, ad, yazar: 'Alexandr Puškin',
      ozetVar: true, ozetUzunluk: 9999, ozetG: 1000 + i }));
    await tohumla(page, kitaplar);
    await rafAc(page);
    await ozetHazir(page);
    /* gerçek yapı (1 Ekim): A + ek + A + ek + B (ilk parça doğru metin, kopya, eski sürüm) */
    const ham = {};
    const A = i => 'Doğru Puşkin özeti ' + i + ' — doğrulanmış metin.';
    const B = i => 'Eski sürüm özet ' + i + ' (başka cihazdan, farklı metin).';
    for (let i = 0; i < 15; i++) ham['pus' + i] = { m: A(i) + AYM + A(i) + AYM + B(i), g: 1000 + i, o: '' };
    ham.pus0.o = 'Onto A' + AYO + 'Onto B';
    ham.yetim1 = { m: 'Sahipsiz özet metni.' + AYM + 'Sahipsiz eski sürüm.', g: 5000, o: '' };   // kitabı yok
    await hamIdbYaz(page, ham);
    const onceUzunluk = Object.values(ham).reduce((t, v) => t + v.m.length + v.o.length, 0);
    /* reload → göç; okuma HEMEN (açılış yetim süpürücüsü 3 sn sonra sahipsizi
       yerelden siler — göçün sahipsizi de kapsadığı o pencerede ölçülür) */
    await page.reload();
    await ozetHazir(page);
    const s = await page.evaluate(() => ({
      goc: window.__ozet.sonGoc,
      p0: window.__ozet.okuHam('pus0'), p7: window.__ozet.okuHam('pus7'),
      yetim: window.__ozet.okuHam('yetim1'),
      uzunluk: veri.kitaplar.find(k => k.id === 'pus7').ozetUzunluk,
      ozetG: veri.kitaplar.find(k => k.id === 'pus7').ozetG }));
    expect(s.goc.kayit, '16 kayıt göçtü (15 Puşkin + 1 sahipsiz)').toBe(16);
    expect(s.goc.sahipsiz, 'sahipsiz kayıt da göçtü ve sayıldı').toBe(1);
    expect(s.goc.kayitlar.find(x => x.id === 'yetim1').ad, 'logda sahipsiz işaretli').toBe('(sahipsiz)');
    expect(s.goc.ayirac, 'ayıraç sayısı: 15×2 + 1 (o) + 1 (sahipsiz)').toBe(32);
    expect(s.p7.m, 'm = ayıraçtan ÖNCESİ').toBe(A(7));
    expect(s.p7.g, 'damga DEĞİŞMEDİ (ping-pong yok)').toBe(1007);
    expect(s.ozetG, 'kitap işaret damgası da sabit').toBe(1007);
    expect(s.uzunluk, 'şişkin ozetUzunluk işareti düzeldi').toBe(A(7).length);
    expect(s.p7.c.filter(e => !e.ayni).map(e => e.m), 'B gerçek çakışma').toEqual([B(7)]);
    expect(s.p7.c.find(e => e.ayni).n, 'A kopyası ayni:true, n:1').toBe(1);
    expect(s.p0.o, 'ontoloji de ayrıldı').toBe('Onto A');
    expect(s.p0.c.map(e => e.o).filter(Boolean)).toEqual(['Onto B']);
    expect(s.yetim.m, 'sahipsiz kayıt da temizlendi (metin kaybı yok)').toBe('Sahipsiz özet metni.');
    expect(s.yetim.c.map(e => e.m)).toEqual(['Sahipsiz eski sürüm.']);
    /* UZUNLUK DENKLEMİ: önce == sonra + Σ(parça×n) + ayıraç×uzunluk */
    const parca = s.goc.tasinanUzunluk + s.goc.ozdesUzunluk;
    expect(s.goc.onceUzunluk).toBe(onceUzunluk);
    expect(s.goc.onceUzunluk, 'karakter kaybı 0').toBe(s.goc.sonraUzunluk + parca + 31 * AYM.length + 1 * AYO.length);
    /* ikinci açılış: tekrarlanabilir-güvenli, iş kalmadı */
    await page.reload();
    await ozetHazir(page);
    expect(await page.evaluate(() => window.__ozet.sonGoc.kayit), 'ikinci açılışta göç 0').toBe(0);
    expect(await page.evaluate(() => window.__ozet.okuHam('pus7').g), 'damga hâlâ sabit').toBe(1007);
  });

  test('(c) DETAY: uyarı + Bunu tut / Diğerini tut / yan yana; özdeş kopya UYARI SAYMAZ; seçim taze damgayla senkrona gider', async ({ page }) => {
    await tohumla(page, [bitmis({ id: 'k1', ad: 'Çakışmalı Kitap', yazar: 'Y', ozetVar: true })]);
    const oda = await sahteOda(page);
    await rafAc(page);
    await ozetHazir(page);
    await page.evaluate(() => window.__ozet.kaydetHam('k1', 'Bu cihazdaki metin.', 1000, '',
      { c: [{ m: 'Diğer cihazın metni.', g: 900 }, { m: 'Bu cihazdaki metin.', g: 0, ayni: true, n: 2, kaynak: 'goc' }] }));
    await page.click('#liste .kart');
    const uyari = page.locator('#detayIcerik .ck-uyari');
    await expect(uyari).toBeVisible();
    await expect(uyari).toContainText('Bu özetin başka bir cihazdan gelen bir sürümü var');
    await expect(uyari, 'özdeş kopya sürüm sayısına girmez').not.toContainText('2 sürüm');
    await page.click('#detayIcerik [data-act="ck-yanyana"]');
    await expect(page.locator('#detayIcerik .ck-yanyana .ck-sutun')).toHaveCount(2);
    await expect(page.locator('#detayIcerik .ck-diger')).toContainText('Diğer cihazın metni.');
    await page.click('#detayIcerik [data-act="ck-digeri"]');
    await expect(page.locator('#toast')).toContainText('Diğer cihazın sürümü alındı');
    const s = await page.evaluate(() => window.__ozet.okuHam('k1'));
    expect(s.m, 'diğer sürüm m oldu').toBe('Diğer cihazın metni.');
    expect(s.c.filter(e => !e.ayni), 'çakışma çözüldü').toEqual([]);
    expect(s.c.find(e => e.ayni), 'eski m\'nin özdeş kopyası artık m ile aynı değil → düştü').toBeUndefined();
    expect(s.g, 'taze damga').toBeGreaterThan(1000);
    await expect(page.locator('#detayIcerik .ck-uyari')).toHaveCount(0);
    await senkronBaslat(page);
    await expect.poll(() => oda.ozetPatchler.length, { timeout: 10000 }).toBeGreaterThan(0);
    const p = sonPatch(oda);
    expect(p.kayit.m).toBe('Diğer cihazın metni.');
    expect(p.kayit.c, 'çözülmüş kayıtta c alanı HİÇ yok').toBeUndefined();
    /* "Bunu tut" yolu */
    await page.evaluate(() => window.__ozet.kaydetHam('k1', 'Kalan metin.', Date.now() + 1, '', { c: [{ m: 'Gidecek sürüm.', g: 1 }] }));
    await page.evaluate(() => detayAc('k1'));
    await expect(page.locator('#detayIcerik .ck-uyari')).toBeVisible();
    await page.click('#detayIcerik [data-act="ck-bunu"]');
    await expect(page.locator('#toast')).toContainText('Bu cihazdaki sürüm tutuldu');
    expect(await page.evaluate(() => [window.__ozet.oku('k1'), window.__ozet.okuCakisma('k1')])).toEqual(['Kalan metin.', []]);
  });

  test('(d) SENKRON kendini onarır: şişkin uzak kayıt inince yerelde tek m + c; temiz paket uzağa yazılır; ikinci tur PATCH YOK (yakınsama)', async ({ page }) => {
    await tohumla(page, [bitmis({ id: 'k1', ad: 'Uzaktan Şişkin', ozet: 'Doğru metin.', ozetG: 800 })]);
    const oda = await sahteOda(page, { k1: 900 }, { k1: { m: 'Doğru metin.' + AYM + 'Doğru metin.' + AYM + 'Eski sürüm.', g: 900 } });
    await rafAc(page);
    await ozetHazir(page);
    await senkronBaslat(page);
    await expect.poll(() => oda.ozetPatchler.length, { timeout: 10000 }).toBe(1);
    const s = await page.evaluate(() => window.__ozet.okuHam('k1'));
    expect(s.m, 'yerel m tek sürüm').toBe('Doğru metin.');
    expect(s.c.filter(e => !e.ayni).map(e => e.m)).toEqual(['Eski sürüm.']);
    const p = sonPatch(oda);
    expect(p.kayit.m, 'uzağa temiz m yazıldı').toBe('Doğru metin.');
    expect(p.kayit.m.indexOf('Çakışan')).toBe(-1);
    expect(p.kayit.c.filter(e => !e.ayni).map(e => e.m)).toEqual(['Eski sürüm.']);
    await page.evaluate(() => window.__senkron.ozetSenkronEt());
    await expect.poll(() => oda.ozetIzlerGet, { timeout: 10000 }).toBeGreaterThan(1);
    expect(oda.ozetPatchler.length, 'ikinci tur: değişen yok, PATCH yok').toBe(1);
  });

  test('(e) TOPLU ÇÖZÜM: Ayarlar "Çakışan sürümler: N kitap" → onay kartı (sayı, adlar, geri alınamaz) → c ve özdeş kopyalar gider, m/o AYNEN; damga taze; yedek temiz; düzenleme kopyayı kendiliğinden düşürür', async ({ page }) => {
    const kitaplar = [bitmis({ id: 'k1', ad: 'Kopyalı', yazar: 'Yazar Bir', ozetVar: true }),
      bitmis({ id: 'k2', ad: 'Kopyalı İki', ozetVar: true })];
    for (let i = 3; i <= 8; i++) kitaplar.push(bitmis({ id: 'k' + i, ad: 'Çakışmalı ' + i, ozetVar: true }));
    kitaplar.push(bitmis({ id: 'temiz', ad: 'Temiz Kitap', ozetVar: true }));
    await tohumla(page, kitaplar);
    await rafAc(page);
    await ozetHazir(page);
    await page.evaluate(() => {
      const isler = [
        window.__ozet.kaydetHam('k1', 'Metin bir.', 1000, 'Onto bir.', { c: [{ m: 'Metin bir.', g: 0, ayni: true, n: 3, kaynak: 'goc' }, { m: 'Gerçek farklı.', g: 5 }, { o: 'Onto eski.', g: 4 }] }),
        window.__ozet.kaydetHam('k2', 'Metin iki.', 1000, '', { c: [{ m: 'Metin iki.', g: 0, ayni: true, n: 1, kaynak: 'goc' }] }),
        window.__ozet.kaydetHam('temiz', 'Çakışmasız.', 1000, '')];
      for (let i = 3; i <= 8; i++) isler.push(window.__ozet.kaydetHam('k' + i, 'Asıl ' + i, 1000, '', { c: [{ m: 'Eski ' + i, g: 7 }] }));
      return Promise.all(isler);
    });
    const once = await page.evaluate(() => Object.fromEntries(veri.kitaplar.map(k => [k.id, window.__ozet.okuHam(k.id)])));
    await ayarlarAc(page);
    const satir = page.locator('#cksSatir');
    await expect(satir).toBeVisible();
    await expect(satir).toContainText('Çakışan sürümler: 8 kitap');
    await page.click('#cksSatir [data-act="cks-ac"]');
    const kart = page.locator('#cksKart');
    await expect(kart).toContainText('8 kitabın');
    await expect(kart).toContainText('Geri alınamaz');
    await expect(kart).toContainText('Kopyalı');
    await expect(kart.locator('.sz-oge'), 'ilk 5 ad + "… ve 3 kitap daha"').toHaveCount(6);
    await expect(kart).toContainText('ve 3 kitap daha');
    /* Vazgeç: hiçbir şey değişmez */
    await page.click('#cksKart [data-act="cks-vazgec"]');
    await expect(kart).toBeHidden();
    expect(await page.evaluate(() => window.__ozet.okuHam('k1').c.length)).toBe(3);
    await page.click('#cksSatir [data-act="cks-ac"]');
    await page.click('#cksKart [data-act="cks-coz"]');
    await expect(page.locator('#toast')).toContainText('8 kitapta mevcut metin tutuldu, 12 sürüm silindi');
    await expect(satir).toBeHidden();
    const s = await page.evaluate(() => ({
      kayitlar: Object.fromEntries(veri.kitaplar.map(k => [k.id, window.__ozet.okuHam(k.id)])),
      sayim: window.__ozet.cakismaSayim(),
      yedek: window.__ozet.hepsiDisa(),
      ozetG: veri.kitaplar.find(k => k.id === 'k1').ozetG }));
    expect(s.sayim.kayit, 'c\'si dolu kitap 0').toBe(0);
    for (const id of Object.keys(once)) {
      expect(s.kayitlar[id].m, id + ' m AYNEN').toBe(once[id].m);
      expect(s.kayitlar[id].o, id + ' o AYNEN').toBe(once[id].o);
      expect(s.kayitlar[id].c, id + ' c boş').toEqual([]);
    }
    expect(s.kayitlar.k1.g, 'taze damga → senkron yayar').toBeGreaterThan(1000);
    expect(s.ozetG, 'kitap işaret damgası da taze').toBe(s.kayitlar.k1.g);
    expect(s.kayitlar.temiz.g, 'çakışmasız kayda dokunulmadı').toBe(1000);
    expect(s.yedek.k1.c, 'JSON yedekte c yok').toBeUndefined();
    expect(s.yedek.k1.cx.length, 'yedekte atılan sürümlerin izi var (m 2 + o 1)').toBe(3);
    /* düzenleme yolu: özdeş kopya m ile aynı kalmayınca kendiliğinden düşer */
    expect(await page.evaluate(async () => { await window.__ozet.kaydetHam('k2', 'Metin iki.', 2000, '', { c: [{ m: 'Metin iki.', g: 0, ayni: true, n: 1, kaynak: 'goc' }] });
      return window.__ozet.okuHam('k2').c.length; }), 'atılan özdeş kopya iziyle geri girmez').toBe(0);
    await page.evaluate(() => window.__ozet.kaydetHam('temiz', 'Çakışmasız.', 2000, '', { c: [{ m: 'Çakışmasız.', g: 0, ayni: true, n: 1, kaynak: 'goc' }] }));
    expect(await page.evaluate(() => window.__ozet.okuHam('temiz').c.length)).toBe(1);
    await page.evaluate(() => window.__ozet.kaydet('temiz', 'Çakışmasız — düzenlendi.'));
    expect(await page.evaluate(() => window.__ozet.okuHam('temiz').c), 'düzenleme eski kopyayı düşürür').toEqual([]);
  });

  test('(i) DÜZENLEME SAHTE ÇAKIŞMA DOĞURMAZ: kullanıcı/içe aktarım eski metnin izini bırakır → öbür cihazın değişmemiş eski kopyası çakışma olmaz; EŞZAMANLI farklı yazım yine çakışma; eski metne dönüş onu yeniden canlı yapar', async ({ page }) => {
    await tohumla(page, [bitmis({ id: 'k1', ad: 'Düzenlenen', ozetVar: true })]);
    await rafAc(page);
    await ozetHazir(page);
    const s = await page.evaluate(async () => {
      const O = window.__ozet, f = window.__senkron.ozetBirlesim;
      await O.kaydetHam('k1', 'Eski metin.', 1000, 'Eski onto.');
      await O.kaydet('k1', 'Yeni metin.');
      await O.kaydetOnto('k1', 'Yeni onto.');
      const a = O.okuHam('k1');
      const degismemis = f(a, { m: 'Eski metin.', o: 'Eski onto.', g: 1000 });     // telefon: hiç dokunmamış
      const essiz = f(a, { m: 'Telefonda başka.', o: 'Eski onto.', g: 1500 });      // telefon: eşzamanlı farklı yazım
      await O.kaydet('k1', 'Eski metin.');                                           // geri dönüş
      const geri = O.okuHam('k1');
      return { a, degismemis, essiz, geri, iz: O.iz('m', 'Eski metin.') };
    });
    expect(s.degismemis.c, 'değişmemiş eski kopya çakışma DEĞİL').toEqual([]);
    expect(s.degismemis.m).toBe('Yeni metin.');
    expect(s.essiz.c.map(e => e.m), 'eşzamanlı farklı metin yine çakışma').toEqual(['Telefonda başka.']);
    expect(s.a.cx).toContain(s.iz);
    expect(s.geri.cx, 'güncel metin iz değildir').not.toContain(s.iz);
  });

  test('(g) TOPLU ÇÖZÜM SENKRONA YAYILIR: temiz kayıt itilir; öbür cihazın yerel c\'si geri GELMEZ (cx); çözümsüz cihaz sonradan düzenlese de atılan sürüm dönmez, bayat kazanan taze damga alır; atılmamış FARKLI sürüm yine çakışma olur', async ({ page }) => {
    await tohumla(page, [bitmis({ id: 'k1', ad: 'Yayılım', ozetVar: true, ozetG: 900 })]);
    const oda = await sahteOda(page, { k1: 900 }, { k1: { m: 'Asıl metin.', g: 900, c: [{ m: 'Eski sürüm.', g: 5 }] } });
    await rafAc(page);
    await ozetHazir(page);
    await page.evaluate(() => window.__ozet.kaydetHam('k1', 'Asıl metin.', 900, '', { c: [{ m: 'Eski sürüm.', g: 5 }] }));
    await page.evaluate(() => window.__ozet.topluCoz());
    await senkronBaslat(page);
    await expect.poll(() => oda.ozetPatchler.length, { timeout: 10000 }).toBeGreaterThan(0);
    const p = sonPatch(oda);
    expect(p.kayit.m).toBe('Asıl metin.');
    expect(p.kayit.c, 'uzağa c\'siz kayıt').toBeUndefined();
    expect(p.kayit.cx.length).toBe(1);
    expect(p.iz, 'taze damga fihristte').toBeGreaterThan(900);
    const s = await page.evaluate(([temiz]) => {
      const f = window.__senkron.ozetBirlesim;
      const telefon = { m: 'Asıl metin.', g: 900, c: [{ m: 'Eski sürüm.', g: 5 }] };   // çözümü görmemiş cihaz
      const indir = f(temiz, telefon);                                                     // telefon uzağı indirir
      const duzenlendi = { m: 'Telefonda düzenlendi.', g: temiz.g + 1, c: [{ m: 'Eski sürüm.', g: 5 }] };
      const bayat = f(duzenlendi, temiz);                                                  // PC telefonun yeni kaydını indirir
      const tekrar = f(bayat, { ...telefon, m: 'Telefonda düzenlendi.', g: duzenlendi.g });   // telefon bir sonraki turda
      const yeni = f(temiz, { m: 'Bambaşka metin.', g: 800 });                              // atılmamış farklı sürüm
      return { indir, bayat, tekrar, yeni, dg: duzenlendi.g };
    }, [p.kayit]);
    expect(s.indir.c, 'telefonun yerel c\'si geri gelmedi').toEqual([]);
    expect(s.indir.g, 'çözüm uzağı: damga uzağınki, ping-pong yok').toBe(p.kayit.g);
    expect(s.bayat.m, 'yeni düzenleme kazanır').toBe('Telefonda düzenlendi.');
    expect(s.bayat.c.map(e => e.m), 'atılan sürüm dönmedi; eski asıl metin yeni çakışma').toEqual(['Asıl metin.']);
    expect(s.bayat.cx.length, 'izler birleşti').toBe(1);
    expect(s.bayat.g, 'bayat kazanan → taze damga (telefon temizi indirsin)').not.toBe(s.dg);
    expect(s.tekrar.c.map(e => e.m), 'telefon indirince de atılan sürüm yok').toEqual(['Asıl metin.']);
    expect(s.tekrar.g, 'ikinci turda damga sabit (yakınsama)').toBe(s.bayat.g);
    expect(s.yeni.c.map(e => e.m), 'atılmamış FARKLI sürüm yine çakışma').toEqual(['Bambaşka metin.']);
    /* İZOLE bayat kazanan: metin AYNI (yeni çakışma yok) ama kazananın c'si
       çözülmüş sürümü taşıyor → yalnız bayatlık taze damga verir */
    const b2 = await page.evaluate(([temiz]) => {
      const t = temiz.g + 7;
      return { r: window.__senkron.ozetBirlesim({ m: 'Asıl metin.', g: t, c: [{ m: 'Eski sürüm.', g: 5 }] }, temiz), t };
    }, [p.kayit]);
    expect(b2.r.c).toEqual([]);
    expect(b2.r.g, 'bayat kazanan → taze damga (kazananı tutan cihaz temizi indirsin)').toBeGreaterThan(b2.t);
  });

  test('(h) ÖZET İÇE AKTARIMI c\'yi sadeleştirir: dosyanın yazdığı m/o, c\'deki birebir aynı sürümü kaldırır; farklı sürümler kalır', async ({ page }) => {
    await tohumla(page, [bitmis({ id: 'k1', ad: 'İçe Aktarılan', yazar: 'Yazar A', ozetVar: true })]);
    await rafAc(page);
    await ozetHazir(page);
    await page.evaluate(() => window.__ozet.kaydetHam('k1', 'Mevcut metin.', 1000, 'Mevcut onto.', { c: [
      { m: 'Doğru sürüm.', g: 9 }, { m: 'Başka sürüm.', g: 8 }, { o: 'Doğru onto.', g: 7 }, { o: 'Başka onto.', g: 6 },
      { m: 'Doğru sürüm.', o: 'Başka onto 2.', g: 5 }] }));
    await ayarlarAc(page);
    await dosyadanYukle(page, jsonDosya({ surum: 1, ozet: [{ id: 'k1', ad: 'İçe Aktarılan', yazar: 'Yazar A',
      ozet: 'Doğru sürüm.', ontoloji: 'Doğru onto.' }] }, 'ozet.json'));
    await expect(page.locator('#zgOzetIceOrtu')).toHaveClass(/acik/);
    await page.click('[data-act="zg-ozet-uygula"]');
    await expect(page.locator('#toast')).toContainText('dosyadan yazıldı');
    const s = await page.evaluate(() => window.__ozet.okuHam('k1'));
    expect(s.m).toBe('Doğru sürüm.');
    expect(s.o).toBe('Doğru onto.');
    expect(s.c.map(e => [e.m || '', e.o || '']).sort(), 'yalnız farklı sürümler kaldı (karma girdinin m parçası düştü, o parçası kaldı)')
      .toEqual([['', 'Başka onto 2.'], ['', 'Başka onto.'], ['Başka sürüm.', '']]);
    /* içe aktarım eski metnin izini bıraktı: öbür cihazın değişmemiş eski kopyası sahte çakışma doğurmaz */
    const t = await page.evaluate(() => window.__senkron.ozetBirlesim(window.__ozet.okuHam('k1'),
      { m: 'Mevcut metin.', o: 'Mevcut onto.', g: 1000 }));
    expect(t.c.length, 'eski kopya yeni çakışma eklemedi').toBe(s.c.length);
  });

  test('(f) SIRA KİLİDİ: göç sahipsiz kaydı da ayırır (metin kaybı 0) ve kayıt temizlik listesinde temiz ilk satırıyla görünür; temizlik göçten SONRA, onayla', async ({ page }) => {
    await tohumla(page, [bitmis({ id: 'canli1', ad: 'Canlı Kitap' })]);
    await rafAc(page);
    await ozetHazir(page);
    await hamIdbYaz(page, { yetimX: { m: 'Yetim ilk satır doğru metin.\nİkinci satır.' + AYM + 'Yetim eski sürüm.', g: 7000, o: '' } });
    await page.reload();
    await ozetHazir(page);   // süpürücüden (3 sn) ÖNCE oku — sıra: göç → (onaylı) temizlik
    const s = await page.evaluate(() => ({
      goc: window.__ozet.sonGoc, yetim: window.__ozet.okuHam('yetimX'), yerel: window.__ozet.sahipsizYerel() }));
    expect(s.goc.kayit).toBe(1);
    expect(s.goc.kayitlar[0]).toMatchObject({ id: 'yetimX', sahipsiz: true, ad: '(sahipsiz)' });
    expect(s.yetim.m, 'önce göç: sahipsizin m\'si temiz').toBe('Yetim ilk satır doğru metin.\nİkinci satır.');
    expect(s.yetim.c.map(e => e.m), 'eski sürüm c\'de — silinmedi').toEqual(['Yetim eski sürüm.']);
    expect(s.yerel.map(x => x.id), 'sonra temizlik listesi: sahipsiz orada (henüz silinmedi)').toEqual(['yetimX']);
    expect(s.yerel[0].m.indexOf('Çakışan'), 'listede temiz metin').toBe(-1);
  });
});

test.describe('G122 Q3 — kaynak / durum / doğrulama', () => {

  test('(a) içe aktarım k/s/d okur ve doğrular; kaynak-yalnız kayıt değişim sayılır; yedek + senkron paketi taşır; eski 4-parametreli yazım korur', async ({ page }) => {
    await tohumla(page, [
      bitmis({ id: 'a1', ad: 'Kaynaklı', yazar: 'Y' }),
      bitmis({ id: 'a2', ad: 'Bulunamayan', yazar: 'Y' }),
      bitmis({ id: 'a3', ad: 'Aynı Metin', yazar: 'Y', ozetVar: true })]);
    const oda = await sahteOda(page);
    await rafAc(page);
    await ozetHazir(page);
    await page.evaluate(() => window.__ozet.kaydetHam('a3', 'Değişmeyen özet.', 100));
    await ayarlarAc(page);
    await dosyadanYukle(page, jsonDosya({ ozet: [
      { ad: 'Kaynaklı', yazar: 'Y', ozet: 'Kaynaklı özet.', kaynak: 'Britannica + kitap arka kapağı', durum: 'doğru', dogrulama: '2026-09-23' },
      { ad: 'Bulunamayan', yazar: 'Y', ozet: 'Kaynaksız özet.', durum: 'bulamadım', dogrulama: '2026-09-23T10:00:00Z' },
      { ad: 'Aynı Metin', yazar: 'Y', ozet: 'Değişmeyen özet.', kaynak: 'Yayınevi sitesi', durum: 'saçma', dogrulama: 'dün' }] }, 'k.json'));
    const ozet = page.locator('#zgOzetIceOrtu .zg-ozet');
    await expect(ozet).toContainText('3 kitapta kaynak/doğrulama bilgisi yazılacak');
    await expect(ozet).toContainText('2 kaynak alanı tanınmadı');
    await expect(ozet).not.toContainText('zaten aynı');
    await expect(page.locator('[data-act="zg-ozet-uygula"]')).toHaveText('Özetleri yaz (3)');
    await page.click('[data-act="zg-ozet-uygula"]');
    await expect(page.locator('#toast')).toContainText('2 kitabın özeti ve 3 kitabın kaynak bilgisi dosyadan yazıldı');
    const s = await page.evaluate(() => ({
      a1: window.__ozet.okuKaynak('a1'), a2: window.__ozet.okuKaynak('a2'), a3: window.__ozet.okuKaynak('a3'),
      a3m: window.__ozet.oku('a3'), disa: window.__ozet.hepsiDisa() }));
    expect(s.a1).toEqual({ k: 'Britannica + kitap arka kapağı', s: 'dogru', d: '2026-09-23' });
    expect(s.a2).toEqual({ k: '', s: 'bulamadim', d: '2026-09-23' });
    expect(s.a3, 'tanınmayan durum/tarih yazılmadı, kaynak yazıldı').toEqual({ k: 'Yayınevi sitesi', s: '', d: '' });
    expect(s.a3m, 'metin aynen').toBe('Değişmeyen özet.');
    expect(s.disa.a1, 'yedekte k/s/d').toMatchObject({ m: 'Kaynaklı özet.', k: 'Britannica + kitap arka kapağı', s: 'dogru', d: '2026-09-23' });
    expect(s.disa.a3.s, 'boş alan yedeğe yazılmaz').toBeUndefined();
    /* 4 parametreli eski yazım k/s/d'yi KORUR */
    await page.evaluate(() => window.__ozet.kaydetHam('a1', 'Kaynaklı özet (yeni).', Date.now(), 'onto'));
    expect(await page.evaluate(() => window.__ozet.okuKaynak('a1').k)).toBe('Britannica + kitap arka kapağı');
    /* senkron paketi */
    await senkronBaslat(page);
    await expect.poll(() => oda.ozetPatchler.length, { timeout: 10000 }).toBeGreaterThanOrEqual(3);
    const a1p = oda.kayitlar.a1;
    expect(a1p).toMatchObject({ k: 'Britannica + kitap arka kapağı', s: 'dogru', d: '2026-09-23' });
    /* geri yükleme turu: yedek → birleştir → k/s/d döner */
    const yedek = await page.evaluate(() => ({ surum: 2, kitaplar: [veri.kitaplar[1]], ozetler: { a2: window.__ozet.hepsiDisa().a2 } }));
    await page.evaluate(() => window.__ozet.sil('a2'));
    await page.evaluate(() => { veri.kitaplar = veri.kitaplar.filter(k => k.id !== 'a2'); depoKaydet(); });
    await dosyadanYukle(page, jsonDosya(yedek, 'yedek.json'), 'birlestir');
    await expect.poll(() => page.evaluate(() => window.__ozet.okuKaynak('a2').s), { timeout: 10000 }).toBe('bulamadim');
  });

  test('(b) DETAY satırı: "Kaynak: … · Doğrulama: GG.AA.YYYY"; bulamadım açıkça; alan yoksa satır yok', async ({ page }) => {
    await tohumla(page, [
      bitmis({ id: 'a1', ad: 'Kaynaklı', ozetVar: true }),
      bitmis({ id: 'a2', ad: 'Bulunamayan', ozetVar: true }),
      bitmis({ id: 'a3', ad: 'Sade', ozetVar: true })]);
    await rafAc(page);
    await ozetHazir(page);
    await page.evaluate(() => Promise.all([
      window.__ozet.kaydetHam('a1', 'Özet bir.', 10, 'Onto bir.', { k: 'Britannica', s: 'dogru', d: '2026-09-23' }),
      window.__ozet.kaydetHam('a2', 'Özet iki.', 10, '', { s: 'bulamadim', d: '2026-09-24' }),
      window.__ozet.kaydetHam('a3', 'Özet üç.', 10, '')]));
    await page.click('#liste .kart[data-id="a1"]');
    await expect(page.locator('#detayIcerik .kdg-satir')).toHaveText('Kaynak: Britannica · doğrulandı · Doğrulama: 23.09.2026');
    await page.click('#detayIcerik [data-act="ms-sekme"][data-v="onto"]');
    await expect(page.locator('#detayIcerik .kdg-satir'), 'ontoloji sekmesinde de').toContainText('Kaynak: Britannica');
    await page.evaluate(() => detayAc('a2'));
    await expect(page.locator('#detayIcerik .kdg-satir .kdg-uyari')).toHaveText('Kaynak bulunamadı — doğrulanamadı');
    await expect(page.locator('#detayIcerik .kdg-satir')).toContainText('Bakıldı: 24.09.2026');
    await page.evaluate(() => detayAc('a3'));
    await expect(page.locator('#detayIcerik .oz-metin')).toContainText('Özet üç.');
    await expect(page.locator('#detayIcerik .kdg-satir')).toHaveCount(0);
  });
});

test.describe('G122 Q4 — sahipsiz özetler + mükerrer + Keşfet', () => {

  test('(a) SAHİPSİZ: senkron sahipsizi ÇEKMEZ; Ayarlar sayımı yerel+uzak; onay kartı ilk satırla; silme IDB + yedek + düğüm (mezar); sayım 0', async ({ page }) => {
    await tohumla(page, [bitmis({ id: 'canli1', ad: 'Canlı Kitap' })]);
    const oda = await sahteOda(page,
      { canli1: 500, yetimUzak: 600, yetimMezar: 650 },
      { canli1: { m: 'Canlı özet.', g: 500 }, yetimUzak: { m: 'Uzak yetim ilk satır.\nDevamı.', g: 600 }, yetimMezar: { m: '', g: 650 } });
    await rafAc(page);
    await ozetHazir(page);
    /* açılış yetim süpürücüsü (3 sn) geçsin — yerel sahipsiz ondan SONRA yazılır
       ki vaka süpürücüyü değil Ayarlar sayımını ölçsün */
    await page.waitForTimeout(3300);
    await page.evaluate(() => window.__ozet.kaydetHam('yetimYerel', 'Yerel yetim özeti.', 400));   // kitabı yok, bu cihazda
    await senkronBaslat(page);
    await expect.poll(() => page.evaluate(() => window.__ozet.oku('canli1')), { timeout: 10000 }).toBe('Canlı özet.');
    expect(await page.evaluate(() => window.__ozet.oku('yetimUzak')), 'sahipsiz kayıt yerele İNMEDİ').toBe('');
    expect(oda.kGet, 'sahipsiz kayıt için k/<id> GET bile yok').not.toContain('yetimUzak');
    expect(oda.ozetPatchler.every(p => !Object.keys(p).some(x => x === 'k/yetimYerel')), 'yerel yetim uzağa İTİLMEDİ').toBe(true);
    await ayarlarAc(page);
    const satir = page.locator('#szSatir');
    await expect(satir).toContainText('Sahipsiz özetler: 2');   // yetimUzak (düğüm) + yetimYerel (bu cihaz); mezar sayılmaz
    await page.click('#szSatir [data-act="sz-ac"]');
    const kart = page.locator('#szKart');
    await expect(kart).toBeVisible();
    await expect(kart.locator('.sz-oge')).toHaveCount(2);
    await expect(kart).toContainText('Uzak yetim ilk satır.');
    await expect(kart).toContainText('Yerel yetim özeti.');
    await expect(kart).toContainText('senkron düğümü');
    await expect(kart).toContainText('bu cihaz');
    await expect(kart.locator('[data-act="sz-sil"]')).toHaveText('Sil (2)');
    const patchOnce = oda.ozetPatchler.length;
    await page.click('#szKart [data-act="sz-sil"]');
    await expect(page.locator('#toast')).toContainText('2 sahipsiz özet silindi (senkron düğümü dahil)');
    await expect.poll(() => oda.ozetPatchler.length).toBe(patchOnce + 1);
    const p = oda.ozetPatchler[oda.ozetPatchler.length - 1];
    expect(p['k/yetimUzak'], 'düğümde MEZAR (boş + damga), düz silme değil').toMatchObject({ m: '' });
    expect(p['k/yetimUzak'].g).toBeGreaterThan(600);
    expect(p['izler/yetimUzak']).toBe(p['k/yetimUzak'].g);
    expect(p['k/yetimYerel']).toMatchObject({ m: '' });
    const s = await page.evaluate(() => ({ yerel: window.__ozet.oku('yetimYerel'), disa: Object.keys(window.__ozet.hepsiDisa()), ham: null }));
    expect(s.yerel, 'IDB\'den gitti').toBe('');
    expect(s.disa, 'yedekte yalnız canlı').toEqual(['canli1']);
    expect(Object.keys(await hamIdbOku(page))).not.toContain('yetimYerel');
    await expect.poll(() => satir.textContent()).toContain('Sahipsiz özetler: 0');
    await expect(page.locator('#szSatir [data-act="sz-ac"]')).toHaveCount(0);
  });

  test('(b) MÜKERRER: normalize ad+yazar ("Jean Paul" ↔ "Jean-Paul") elle formda onay kartı açar; barkod kolu da aynı anahtarı kullanır', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Toplu Oyunlar 2', yazar: 'Jean-Paul Sartre', isbn: '9780132350884' })]);
    await rafAc(page);
    await page.click('.fab[data-act="yeni"]');
    await ayrintilarAc(page);
    await page.fill('#f-ad', 'Toplu Oyunlar 2');
    await page.fill('#f-yazar', 'Jean Paul Sartre');
    await page.click('[data-act="form-kaydet"]');
    await expect(page.locator('#ortuIkiz')).toHaveClass(/acik/);
    expect(await page.evaluate(() => veri.kitaplar.length)).toBe(1);
    const k = await page.evaluate(() => ({
      tire: !!window.__kopya.adYazarVar('toplu oyunlar 2', 'jean paul sartre', null),
      aksan: !!window.__kopya.zatenVar('Toplu Oyunlar 2', 'Jean-Paul Sártre', '', null),
      isbn: !!window.__kopya.zatenVar('Bambaşka', 'Kimse', '978-0-13-235088-4', null),
      farkli: !!window.__kopya.adYazarVar('Toplu Oyunlar 3', 'Jean-Paul Sartre', null) }));
    expect(k).toEqual({ tire: true, aksan: true, isbn: true, farkli: false });
  });

  test('(c) ÖLÇÜM — Keşfet = "Ne okusam?": başlık, arama girdisi (v115) ve başlıktaki kısayol aynı ekrana gider', async ({ page }) => {
    /* g108 fikstürü: puanlı bitmişler motoru az-veri modundan çıkarır, okunacaklar aday havuzu */
    await tohumla(page, [
      bitmis({ ad: 'Taban 1', yazar: 'Taban Yazar 1', tur: 'Deneme', puan: 8 }),
      bitmis({ ad: 'Taban 2', yazar: 'Taban Yazar 2', tur: 'Anı', puan: 7 }),
      bitmis({ ad: 'Taban 3', yazar: 'Taban Yazar 3', tur: 'Gezi', puan: 6 }),
      bitmis({ ad: 'Taban 4', yazar: 'Dostoyevski', tur: 'Roman', puan: 9 })].concat(
      ['Suç ve Ceza', 'Budala', 'Yeraltından Notlar', 'Gezi Notları'].map((ad, i) =>
        sahteKitap({ ad, yazar: i < 3 ? 'Dostoyevski' : 'Üçüncü Yazar', durum: 'okunacak', sahiplik: 'sahip', tur: i < 3 ? 'Roman' : 'Gezi', sayfa: 300 }))));
    await page.goto('/');
    /* "Ne okusam?" kısayolu (başlık düğmesi) Keşfet sekmesine bağlı — ayrı ekran yok */
    await expect(page.locator('.on-ac-btn')).toHaveAttribute('data-v', 'kesfet');
    await page.click('nav [data-act="sekme"][data-v="kesfet"]');
    await expect(page.locator('#panel-kesfet')).toHaveClass(/active/);
    await expect(page.locator('#ksIcerik .ks-baslik')).toHaveText('Ne okusam?');
    await expect(page.locator('#ksAra'), 'arama girdisi ekranda (v115) — ayrı düğme gerekmedi').toBeVisible();
    await expect(page.locator('#ksAra')).toHaveAttribute('placeholder', /ara/i);
  });
});
