'use strict';
/* G126 — SESLİ OKUMA ARKA PLAN KESİNTİSİ (ses.js, v136)
   Kaynak: Kaan'ın telefon tanısı (Android 10, Chrome 154, kurulu PWA):
     54.2 sn ekran kilidi → "hata (interrupted)"
     55.6 sn "bekçi: sessiz motor, yeniden (5.2)" → aynı anda 21 kez
     "hata (synthesis-failed)" → "sona erdi (bitti)"; kalan metin 0.0 sn'de
     "okundu" sayıldı, dönünce yer kayboldu.
   Kural: hata ASLA ilerletmez; gizliyken kesinti/hata duraklatır, yer
   korunur; gizliyken bekçi konuşmaz; ardışık synthesis-failed duraklatır,
   oturum bitmez; görünür olunca Devam doğru parçadan sürer.

   speechSynthesis TAKLİT (g123/g125 deseni) + 'reddet' kipi: her speak()
   onstart OLMADAN anında 'synthesis-failed' döner (Android arka plan motoru).

   MUTASYON DENETİMİ (koşuldu, dördü de öldürüldü):
     M1  onerror gizli dalı kalksın (sistemDuraklat yok)   → A, C2, D kırmızı
     M2  bekçi gizlilik kapısı kalksın                     → B kırmızı
     M3  ardışık-hata duraklatması kalksın (eski: ilerle)  → C kırmızı
     M4  devam() konumu sıfırlasın (j=0)                   → D kırmızı */
const { test, expect, tohumla, sahteKitap, rafAc } = require('./yardim');

const TR = [{ name: 'Sahte Türkçe', lang: 'tr-TR', localService: true, default: true }];

async function sahteOrtam(page) {
  await page.addInitScript(sesler => {
    let aktif = null;
    const S = window.__sahteSes = { konusmalar: [], reddet: false };
    function Utt(t){ this.text = String(t); this.lang = ''; this.rate = 1; this.voice = null;
      this.onstart = null; this.onend = null; this.onerror = null; }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utt, configurable: true, writable: true });
    const motor = {
      get speaking(){ return !!aktif; }, get pending(){ return false; }, paused: false,
      getVoices(){ return sesler; },
      speak(u){
        S.konusmalar.push(u.text);
        if (S.reddet){   // Android arka plan: onstart yok, anında red
          setTimeout(() => { if (u.onerror) u.onerror({ error: 'synthesis-failed' }); }, 0);
          return;
        }
        aktif = u;
        setTimeout(() => { if (aktif === u && u.onstart) u.onstart({}); }, 0);
      },
      cancel(){ const a = aktif; aktif = null;
        if (a && a.onerror) setTimeout(() => a.onerror({ error: 'interrupted' }), 0); },
      pause(){}, resume(){}, addEventListener(){}
    };
    Object.defineProperty(window, 'speechSynthesis', { value: motor, configurable: true });
    S.bitir = () => { const u = aktif; aktif = null; if (u && u.onend) u.onend({}); };
    // SİSTEM kesintisi: bizim cancel'ımız değil — aktif konuşmaya 'interrupted'
    S.sistemKes = () => { const u = aktif; aktif = null; if (u && u.onerror) u.onerror({ error: 'interrupted' }); };
    S.sustur = () => { aktif = null; };   // motor HABER VERMEDEN sustu (olay yok)
    S.hata = h => { const u = aktif; aktif = null; if (u && u.onerror) u.onerror({ error: h }); };
  }, TR);
}

/* 3 paragraf; ikincisi uzun → birden çok parça (5.2 benzeri iç konum için) */
const UZUN = 'Uzun paragrafın cümlesi burada duruyor. '.repeat(12).trim();
const OZET = 'Birinci paragraf.\n\n' + UZUN + '\n\nÜçüncü paragraf.';

async function hazirla(page) {
  await sahteOrtam(page);
  await tohumla(page, [sahteKitap({ id: 'k1', ad: 'Sesli Kitap', durum: 'bitti', ozetVar: true })]);
  await rafAc(page);
  await page.evaluate(() => window.__ozet.hazirBekle());
  await page.evaluate(o => window.__ozet.kaydetHam('k1', o, 100, ''), OZET);
  await page.evaluate(() => detayAc('k1'));
}
const cubuk = page => page.locator('#detayIcerik .so-cubuk[data-so-kaynak="m"]');
const durumu = page => page.evaluate(() => window.__ses.durum());
const say = page => page.evaluate(() => window.__sahteSes.konusmalar.length);
const olaylar = page => page.evaluate(() => window.__ses.gunluk().map(g => g.olay + (g.ek ? ' (' + g.ek + ')' : '')));
async function gorunurluk(page, v) {
  await page.evaluate(v => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => v === 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, v);
}
/* 2. paragrafın 2. parçasına kadar oku (i=1, j=1) */
async function ikinciParcayaKadar(page) {
  await cubuk(page).locator('[data-act="so-dinle"]').click();
  await expect.poll(() => say(page)).toBe(1);
  await page.evaluate(() => window.__sahteSes.bitir());   // 1.1 bitti → 2.1
  await expect.poll(() => say(page)).toBe(2);
  await page.evaluate(() => window.__sahteSes.bitir());   // 2.1 bitti → 2.2
  await expect.poll(() => say(page)).toBe(3);
  const d = await durumu(page);
  expect([d.i, d.j, d.durum]).toEqual([1, 1, 'oynuyor']);
}

test.describe('G126 arka plan kesintisi (Android tanısı)', () => {

  test('A) arka plan + interrupted → İLERLEME YOK, duraklar, yer korunur', async ({ page }) => {
    await hazirla(page);
    await ikinciParcayaKadar(page);
    await gorunurluk(page, 'hidden');
    await page.evaluate(() => window.__sahteSes.sistemKes());
    await page.waitForTimeout(100);
    const d = await durumu(page);
    expect(d, 'oturum bitmedi').not.toBe(null);
    expect([d.i, d.j, d.durum]).toEqual([1, 1, 'duraklatildi']);
    expect(await say(page), 'yeni konuşma başlamadı').toBe(3);
    expect(await olaylar(page)).toContain('duraklatıldı (arka planda interrupted · yer 2.2)');
  });

  test('B) GİZLİYKEN bekçi konus() çağırmaz', async ({ page }) => {
    await hazirla(page);
    await ikinciParcayaKadar(page);
    await gorunurluk(page, 'hidden');
    // motor haber vermeden sustu (konuşmuyor), son olaydan beri >3 sn
    await page.evaluate(() => window.__sahteSes.sustur());
    await page.waitForTimeout(50);
    const once = await say(page);
    await page.evaluate(() => {
      const r = Date.now; Date.now = () => r() + 10000;   // bekçinin 3 sn eşiğini geç
      window.__ses.bekci();
      Date.now = r;
    });
    await page.waitForTimeout(50);
    expect(await say(page), 'gizliyken konuşma başlatılmadı').toBe(once);
    expect((await olaylar(page)).some(o => /bekçi/.test(o))).toBe(false);
    // görünürken aynı durum bekçiyi çalıştırır (kapı yalnız gizlilikte)
    await gorunurluk(page, 'visible');
    await page.evaluate(() => {
      const r = Date.now; Date.now = () => r() + 10000;
      window.__ses.bekci();
      Date.now = r;
    });
    await expect.poll(() => say(page)).toBe(once + 1);
  });

  test('C) ard arda synthesis-failed (görünür) → DURAKLAR, oturum BİTMEZ, parça "okundu" sayılmaz', async ({ page }) => {
    await hazirla(page);
    await ikinciParcayaKadar(page);
    await page.evaluate(() => { window.__sahteSes.reddet = true; });
    await page.evaluate(() => window.__sahteSes.hata('synthesis-failed'));   // 1. hata → aynı parçayı yeniden dener
    await expect.poll(() => durumu(page), { timeout: 5000 }).toMatchObject({ durum: 'duraklatildi' });
    const d = await durumu(page);
    expect([d.i, d.j]).toEqual([1, 1]);
    const o = await olaylar(page);
    expect(o.filter(x => x === 'hata (synthesis-failed)')).toHaveLength(2);   // çağlayan YOK
    expect(o).toContain('duraklatıldı (motor okuyamadı: synthesis-failed · yer 2.2)');
    expect(o.some(x => /sona erdi/.test(x))).toBe(false);
    await expect(cubuk(page).locator('[data-act="so-devam"]')).toBeVisible();
  });

  test('C2) gizliyken synthesis-failed ilk hatada duraklatır (yeniden deneme yok)', async ({ page }) => {
    await hazirla(page);
    await ikinciParcayaKadar(page);
    await gorunurluk(page, 'hidden');
    await page.evaluate(() => window.__sahteSes.hata('synthesis-failed'));
    await page.waitForTimeout(1000);
    const d = await durumu(page);
    expect([d.i, d.j, d.durum]).toEqual([1, 1, 'duraklatildi']);
    expect(await say(page)).toBe(3);
  });

  test('D) TANI SENARYOSU uçtan uca: kilit → interrupted → (eski bekçi çağlayanı olmaz) → görünür → Devam DOĞRU parçadan', async ({ page }) => {
    await hazirla(page);
    await ikinciParcayaKadar(page);
    const parca22 = await page.evaluate(() => window.__sahteSes.konusmalar[2]);
    await gorunurluk(page, 'hidden');
    await page.evaluate(() => { window.__sahteSes.reddet = true; });   // arka plan motoru reddediyor
    await page.evaluate(() => window.__sahteSes.sistemKes());
    await page.evaluate(() => {
      const r = Date.now; Date.now = () => r() + 10000;
      window.__ses.bekci();
      Date.now = r;
    });
    await page.waitForTimeout(100);
    expect(await say(page), 'gizliyken hiçbir parça denenmedi').toBe(3);
    // dön
    await page.evaluate(() => { window.__sahteSes.reddet = false; });
    await gorunurluk(page, 'visible');
    await page.waitForTimeout(800);   // görünür bekçisi (600 ms) duraklatılmışı sürmez
    expect(await say(page)).toBe(3);
    await expect(cubuk(page).locator('[data-act="so-devam"]')).toBeVisible();
    await cubuk(page).locator('[data-act="so-devam"]').click();
    await expect.poll(() => say(page)).toBe(4);
    expect(await page.evaluate(() => window.__sahteSes.konusmalar[3]), 'aynı parça (2.2) yeniden').toBe(parca22);
    const d = await durumu(page);
    expect([d.i, d.j, d.durum]).toEqual([1, 1, 'oynuyor']);
    // sonra normal akış sürer: 2.2 bitince 2.3
    await page.evaluate(() => window.__sahteSes.bitir());
    await expect.poll(async () => { const x = await durumu(page); return x && [x.i, x.j]; }).toEqual([1, 2]);
  });
});
