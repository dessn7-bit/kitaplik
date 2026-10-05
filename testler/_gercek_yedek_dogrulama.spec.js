'use strict';
/* GERÇEK YEDEK DOĞRULAMASI (Sprint Q göçü) — ortam değişkeni verilmezse ATLANIR
   (npm test'i etkilemez). Çalıştırma (PowerShell):
     $env:YEDEK_23="C:\Users\Kaan\Downloads\pinakes-yedek-2026-09-23.json"
     $env:YEDEK_BUGUN="C:\Users\Kaan\OneDrive\Masaüstü\pinakes-yedek-2026-10-01.json"
     npx playwright test testler/_gercek_yedek_dogrulama.spec.js --workers=1
   Bash:
     YEDEK_23=... YEDEK_BUGUN=... npx playwright test testler/_gercek_yedek_dogrulama.spec.js --workers=1
   Yalnız biri verilirse yalnız o koşar.

   NE YAPAR: yedeğin kitaplarını localStorage'a (tohumla), ozetler nesnesini
   HAM olarak IDB'ye (kk_ozet_v1) koyar, sayfayı yeniden açar → uygulamanın
   kendi açılış göçü koşar (window.__ozet.sonGoc). Sonra Node tarafında dosyadan
   bağımsız sayılan beklentilerle karşılaştırır. Hiçbir dosyaya YAZMAZ.

   BEKLENTİLER
   · göçen kayıt sayısı == dosyada ayıraç içeren kayıt sayısı (m ∪ o)
   · 09-23 için: m'de 16 · o'da 1 · sahipsiz 9 · sahipsiz-ayıraçlı msblhlsmwzfsm göçte
   · her kayıtta göç sonrası m == dosyadaki ilk parça (ayıraçtan öncesi); o aynı
   · Puşkin (regex pu[sš]kin) kayıtlarının hepsinde m == ilk parça
   · UZUNLUK DENKLEMİ: önce(m+o) == sonra(m+o) + Σ(parça×n) + ayıraç×uzunluk
   · damga (g) göçte DEĞİŞMEZ
   · sahipsiz kayıtlar: dosyadaki sayı == göç anında yerelde sayılan (süpürücüden
     önce) ve göç onları da kapsar (sahipsizAyiracli ⊆ sonGoc.kayitlar) */
const fs = require('fs');
const { test, expect, tohumla } = require('./yardim');

const AYM = '\n\n— · —\nÇakışan özet (diğer cihazdan):\n\n';
const AYO = '\n\n— · —\nÇakışan ontoloji (diğer cihazdan):\n\n';

function dosyaOlc(y) {
  const canli = new Set((y.kitaplar || []).map(k => String(k.id)));
  const r = { mAyirac: 0, oAyirac: 0, birlesim: [], sahipsiz: [], sahipsizAyiracli: [], once: 0, ayiracUz: 0, ilkParca: {}, puskin: [] };
  for (const [id, o] of Object.entries(y.ozetler || {})) {
    const m = String(o.m || ''), on = String(o.o || '');
    const mN = m.split(AYM).length - 1, oN = on.split(AYO).length - 1;
    if (!canli.has(id)) { r.sahipsiz.push(id); if (mN || oN) r.sahipsizAyiracli.push(id); }
    if (mN) r.mAyirac++; if (oN) r.oAyirac++;
    if (!mN && !oN) continue;
    r.birlesim.push(id);
    r.once += m.length + on.length;
    r.ayiracUz += mN * AYM.length + oN * AYO.length;
    r.ilkParca[id] = { m: m.split(AYM)[0], o: on.split(AYO)[0], g: parseInt(o.g) || 0 };
    const k = (y.kitaplar || []).find(x => String(x.id) === id);
    if (k && /pu[sš]kin/i.test(k.yazar || '')) r.puskin.push(id);
  }
  return r;
}

async function hamIdbYaz(page, kayitlar) {
  await page.evaluate(k => new Promise((cozul, kir) => {
    const istek = indexedDB.open('kk_ozet_v1', 1);
    istek.onsuccess = () => {
      const db = istek.result, tx = db.transaction('ozetler', 'readwrite'), st = tx.objectStore('ozetler');
      for (const [id, v] of Object.entries(k)) st.put(v, id);
      tx.oncomplete = () => { db.close(); cozul(); };
      tx.onerror = () => kir(tx.error);
    };
    istek.onerror = () => kir(istek.error);
  }), kayitlar);
}

function vaka(etiket, yol, beklenen) {
  test(etiket + ' — ' + (yol ? yol.replace(/\\/g, '/').split('/').pop() : 'yol yok'), async ({ page }) => {
    test.skip(!yol || !fs.existsSync(yol), 'ortam değişkeni verilmedi ya da dosya yok: ' + yol);
    test.setTimeout(180000);
    const y = JSON.parse(fs.readFileSync(yol, 'utf8'));
    const d = dosyaOlc(y);
    console.log('[' + etiket + '] dosya: kitap ' + y.kitaplar.length + ' · özet ' + Object.keys(y.ozetler).length +
      ' · m ayıraçlı ' + d.mAyirac + ' · o ayıraçlı ' + d.oAyirac + ' · birleşim ' + d.birlesim.length + ' · sahipsiz ' + d.sahipsiz.length +
      ' · sahipsiz-ayıraçlı ' + d.sahipsizAyiracli.join(',') + ' · Puşkin ' + d.puskin.length);
    if (beklenen) {
      expect(d.mAyirac, 'dosyada m ayıraçlı').toBe(beklenen.m);
      expect(d.oAyirac, 'dosyada o ayıraçlı').toBe(beklenen.o);
      expect(d.sahipsiz.length, 'dosyada sahipsiz').toBe(beklenen.sahipsiz);
    }
    /* kitaplar + özet işaretleri localStorage'a, özetler HAM IDB'ye */
    const veriNesnesi = { ...y };
    delete veriNesnesi.ozetler; delete veriNesnesi.tercihler; delete veriNesnesi.surum; delete veriNesnesi.tarih;
    await tohumla(page, veriNesnesi);
    await page.goto('/');
    await page.evaluate(() => window.__ozet.hazirBekle());
    await hamIdbYaz(page, y.ozetler);
    await page.reload();
    await page.evaluate(() => window.__ozet.hazirBekle());
    /* süpürücüden (3 sn) ÖNCE tek seferde oku */
    const s = await page.evaluate(ids => {
      const goc = window.__ozet.sonGoc;
      const kayitlar = {};
      for (const id of ids) kayitlar[id] = window.__ozet.okuHam(id);
      return { goc, kayitlar, yerelSahipsiz: window.__ozet.sahipsizYerel().map(x => x.id) };
    }, d.birlesim);
    console.log('[' + etiket + '] göç: ' + JSON.stringify({ kayit: s.goc.kayit, sahipsiz: s.goc.sahipsiz, tasinan: s.goc.tasinan,
      ozdes: s.goc.ozdes, ayirac: s.goc.ayirac, once: s.goc.onceUzunluk, sonra: s.goc.sonraUzunluk,
      tasinanUz: s.goc.tasinanUzunluk, ozdesUz: s.goc.ozdesUzunluk }));
    expect(s.goc.kayit, 'göçen kayıt == dosyada ayıraç içeren kayıt (m ∪ o)').toBe(d.birlesim.length);
    expect(s.goc.onceUzunluk, 'göç öncesi uzunluk dosyayla aynı').toBe(d.once);
    expect(s.goc.onceUzunluk, 'UZUNLUK DENKLEMİ: kayıp 0')
      .toBe(s.goc.sonraUzunluk + s.goc.tasinanUzunluk + s.goc.ozdesUzunluk + d.ayiracUz);
    let ilkParcaEsit = 0, damgaSabit = 0, cakismasiz = 0;
    for (const id of d.birlesim) {
      const k = s.kayitlar[id];
      expect(k, id + ' bellekte').toBeTruthy();
      if (k.m === d.ilkParca[id].m && k.o === d.ilkParca[id].o) ilkParcaEsit++;
      if (k.g === d.ilkParca[id].g) damgaSabit++;
      if (k.m.indexOf(AYM) < 0 && k.o.indexOf(AYO) < 0) cakismasiz++;
    }
    console.log('[' + etiket + '] ilk parça == m/o: ' + ilkParcaEsit + '/' + d.birlesim.length + ' · damga sabit: ' + damgaSabit + ' · ayıraçsız: ' + cakismasiz);
    expect(ilkParcaEsit, 'her kayıtta m/o = ayıraçtan öncesi').toBe(d.birlesim.length);
    expect(damgaSabit, 'göç damga değiştirmez').toBe(d.birlesim.length);
    expect(cakismasiz, 'hiçbir m/o ayıraç taşımıyor').toBe(d.birlesim.length);
    for (const id of d.puskin) expect(s.kayitlar[id].m, 'Puşkin ' + id + ' m == ilk parça').toBe(d.ilkParca[id].m);
    /* sahipsiz: göç kapsar, temizlik listesinde görünür */
    expect(s.goc.sahipsiz, 'göç sahipsiz-ayıraçlıyı da kapsadı').toBe(d.sahipsizAyiracli.length);
    for (const id of d.sahipsizAyiracli) expect(s.goc.kayitlar.find(x => x.id === id), id + ' göç logunda').toMatchObject({ sahipsiz: true });
    expect(s.yerelSahipsiz.slice().sort(), 'göç anında yerel sahipsiz == dosyadaki sahipsiz').toEqual(d.sahipsiz.slice().sort());
    /* MEDEA (Euripides) — göç sonrası o ve c: c'deki her ontoloji sürümü o ile
       özdeş mi, farklı mı (rapor; tarayıcıda, bellekteki kayıt üzerinden) */
    const medea = (y.kitaplar || []).find(k => /^medea$/i.test(String(k.ad || '').trim()) && /euripid/i.test(k.yazar || ''));
    if (medea) {
      const r = await page.evaluate(id => {
        const k = window.__ozet.okuHam(id);
        if (!k) return null;
        const ilk = t => String(t || '').split('\n').find(x => x.trim()) || '';
        return { mUz: k.m.length, oUz: k.o.length, oIlk: ilk(k.o).slice(0, 140), g: k.g,
          c: k.c.map(e => ({ alan: e.m ? (e.o ? 'm+o' : 'm') : 'o', ayni: !!e.ayni, n: e.n || 1, g: e.g,
            uz: (e.m || '').length + (e.o || '').length,
            oOzdes: e.o ? e.o === k.o : null, mOzdes: e.m ? e.m === k.m : null,
            ilk: ilk(e.o || e.m).slice(0, 140) })) };
      }, String(medea.id));
      console.log('[' + etiket + '] MEDEA ' + medea.id + ' (' + medea.yazar + '): ' + JSON.stringify(r, null, 1));
    }
    /* TOPLU ÇÖZÜM — bellekte (test sayfasında oda yok, senkron no-op):
       sonrasında c'si dolu kayıt 0; m+o toplam uzunluğu GÖÇ SONRASI değerle aynı.
       Süpürücü (3 sn) sahipsizleri silebileceği için toplam, CANLI kitapların
       kayıtları üzerinden alınır; sahipsizler ayrıca raporlanır. */
    const canliIdler = (y.kitaplar || []).map(k => String(k.id)).filter(id => y.ozetler[id]);
    const tc = await page.evaluate(async ids => {
      const O = window.__ozet;
      const uz = () => ids.reduce((t, id) => { const k = O.okuHam(id); return t + (k ? k.m.length + k.o.length : 0); }, 0);
      const onceSayim = O.cakismaSayim();
      const once = uz();
      const r = await O.topluCoz();
      const sonraSayim = O.cakismaSayim();
      const cDolu = ids.filter(id => { const k = O.okuHam(id); return k && k.c.length; }).length;
      return { onceKitap: onceSayim.kayit, onceSurum: onceSayim.surum, onceGercek: onceSayim.gercek,
        cozulen: r, sonraKitap: sonraSayim.kayit, cDolu, once, sonra: uz() };
    }, canliIdler);
    console.log('[' + etiket + '] TOPLU ÇÖZÜM: ' + JSON.stringify(tc));
    expect(tc.sonraKitap, 'toplu çözüm sonrası c\'si dolu kayıt 0').toBe(0);
    expect(tc.cDolu, 'canlı kitaplarda c\'si dolu 0').toBe(0);
    expect(tc.sonra, 'm+o toplam uzunluğu göç sonrasıyla aynı').toBe(tc.once);
    /* ikinci açılış: iş kalmadı */
    await page.reload();
    await page.evaluate(() => window.__ozet.hazirBekle());
    expect(await page.evaluate(() => window.__ozet.sonGoc.kayit), 'ikinci açılışta göç 0 (tekrarlanabilir-güvenli)').toBe(0);
  });
}

vaka('23 Eylül (içe aktarma sonrası, ek düzeltmesi öncesi)', process.env.YEDEK_23, { m: 16, o: 1, sahipsiz: 9 });
vaka('Bugünkü yedek', process.env.YEDEK_BUGUN, null);
