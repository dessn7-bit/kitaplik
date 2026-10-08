'use strict';
/* G125 — EKRAN UYANIK TUTMA (ses.js, v135): sesli okuma sürerken Screen Wake
   Lock. Okuma başlayınca navigator.wakeLock.request('screen'); duraklat /
   durdur / bitiş ve sayfa gizlenince bırakılır; görünür olup okuma sürüyorsa
   yeniden istenir. Destek yoksa okuma aynen sürer, tanı günlüğüne yazılır.

   speechSynthesis ve wakeLock TAKLİT (g123 deseni). Görünürlük
   document.visibilityState üzerine yazılıp visibilitychange yollanarak
   taklit edilir.

   MUTASYON DENETİMİ (koşuldu):
     M1  duraklat'ta kilitBirak kalksın                 → W1 kırmızı
     M2  gizlenmede kilitBirak kalksın                  → W3 kırmızı
     M3  görünürde kilitAl kalksın                      → W3, W7 kırmızı
     M4  istek dönüşünde kilitUygun kontrolü kalksın     → W6 kırmızı
     M5  destek yok dalı günlüğe yazmasın               → W4 kırmızı */
const { test, expect, tohumla, sahteKitap, rafAc } = require('./yardim');

const TR = [{ name: 'Sahte Türkçe', lang: 'tr-TR', localService: true, default: true }];

async function sahteOrtam(page, k) {
  await page.addInitScript(([k, sesler]) => {
    /* --- speechSynthesis (g123'ten sadeleştirilmiş) --- */
    let aktif = null;
    function Utt(t){ this.text = String(t); this.lang = ''; this.rate = 1; this.voice = null;
      this.onstart = null; this.onend = null; this.onerror = null; }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utt, configurable: true, writable: true });
    const motor = {
      get speaking(){ return !!aktif; }, get pending(){ return false; }, paused: false,
      getVoices(){ return sesler; },
      speak(u){ aktif = u; window.__sahteSes.konusmalar.push(u.text);
        setTimeout(() => { if (aktif === u && u.onstart) u.onstart({}); }, 0); },
      cancel(){ const a = aktif; aktif = null;
        if (a && a.onerror) setTimeout(() => a.onerror({ error: 'interrupted' }), 0); },
      pause(){}, resume(){}, addEventListener(){}
    };
    Object.defineProperty(window, 'speechSynthesis', { value: motor, configurable: true });
    window.__sahteSes = { konusmalar: [],
      bitir(){ const u = aktif; aktif = null; if (u && u.onend) u.onend({}); } };

    /* --- wakeLock --- */
    const K = window.__sahteKilit = { istek: 0, birak: 0, aktif: 0, sentinel: null, bekleyen: null };
    function Sentinel(){
      this.released = false; this.type = 'screen'; this._d = [];
      this.addEventListener = (ad, f) => { if (ad === 'release') this._d.push(f); };
      this.release = () => {
        if (this.released) return Promise.resolve();
        this.released = true; K.birak++; K.aktif--;
        if (K.sentinel === this) K.sentinel = null;
        this._d.forEach(f => f({}));
        return Promise.resolve();
      };
    }
    function ver(){ const s = new Sentinel(); K.aktif++; K.sentinel = s; return s; }
    K.tarayiciBirak = () => { if (K.sentinel) K.sentinel.release(); };
    K.coz = () => { const b = K.bekleyen; K.bekleyen = null; if (b) b(ver()); };
    const wl = {
      request(tip){
        K.istek++; K.tip = tip;
        if (k.reddet) return Promise.reject(Object.assign(new Error('izin yok'), { name: 'NotAllowedError' }));
        if (k.ertele) return new Promise(r => { K.bekleyen = r; });
        return Promise.resolve(ver());
      }
    };
    Object.defineProperty(navigator, 'wakeLock', { value: k.yok ? undefined : wl, configurable: true });
  }, [k || {}, TR]);
}

const OZET = 'Birinci paragraf.\n\nİkinci paragraf.';

async function hazirla(page, k) {
  await sahteOrtam(page, k);
  await tohumla(page, [sahteKitap({ id: 'k1', ad: 'Sesli Kitap', durum: 'bitti', ozetVar: true })]);
  await rafAc(page);
  await page.evaluate(() => window.__ozet.hazirBekle());
  await page.evaluate(o => window.__ozet.kaydetHam('k1', o, 100, ''), OZET);
  await page.evaluate(() => detayAc('k1'));
}
const cubuk = page => page.locator('#detayIcerik .so-cubuk[data-so-kaynak="m"]');
const dinle = page => cubuk(page).locator('[data-act="so-dinle"]').click();
const K = page => page.evaluate(() => {
  const k = window.__sahteKilit;
  return { istek: k.istek, birak: k.birak, aktif: k.aktif, tip: k.tip, var: window.__ses.kilitVar() };
});
const olaylar = page => page.evaluate(() => window.__ses.gunluk().map(g => g.olay + (g.ek ? ' (' + g.ek + ')' : '')));
async function gorunurluk(page, v) {
  await page.evaluate(v => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => v === 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  }, v);
}

test.describe('G125 ekran uyanık tutma (Wake Lock)', () => {

  test('W1) Dinle → kilit istenir (screen); Duraklat → bırakılır; Devam → yeniden; Durdur → bırakılır', async ({ page }) => {
    await hazirla(page);
    await dinle(page);
    await expect.poll(() => K(page)).toMatchObject({ istek: 1, aktif: 1, tip: 'screen', var: true });
    expect(await olaylar(page)).toContain('ekran uyanık');
    await cubuk(page).locator('[data-act="so-duraklat"]').click();
    await expect.poll(() => K(page)).toMatchObject({ birak: 1, aktif: 0, var: false });
    expect(await olaylar(page)).toContain('ekran kilidi bırakıldı (duraklat)');
    await cubuk(page).locator('[data-act="so-devam"]').click();
    await expect.poll(() => K(page)).toMatchObject({ istek: 2, aktif: 1, var: true });
    await cubuk(page).locator('[data-act="so-durdur"]').click();
    await expect.poll(() => K(page)).toMatchObject({ birak: 2, aktif: 0, var: false });
    expect(await olaylar(page)).toContain('ekran kilidi bırakıldı (durdur düğmesi)');
  });

  test('W2) okuma SONA ERİNCE kilit bırakılır; detay kapanınca da', async ({ page }) => {
    await hazirla(page);
    await dinle(page);
    await expect.poll(() => K(page)).toMatchObject({ aktif: 1 });
    await expect.poll(() => page.evaluate(() => window.__sahteSes.konusmalar.length)).toBe(1);
    await page.evaluate(() => window.__sahteSes.bitir());
    await expect.poll(() => page.evaluate(() => window.__sahteSes.konusmalar.length)).toBe(2);
    expect((await K(page)).aktif, 'ara paragrafta kilit sürer').toBe(1);
    await page.evaluate(() => window.__sahteSes.bitir());
    await expect.poll(() => K(page)).toMatchObject({ aktif: 0, var: false });
    expect(await olaylar(page)).toContain('ekran kilidi bırakıldı (bitti)');
    // yeniden başlat, detayı kapat
    await dinle(page);
    await expect.poll(() => K(page)).toMatchObject({ aktif: 1 });
    await page.click('#ortuDetay [data-act="detay-kapat"]');
    await expect.poll(() => K(page)).toMatchObject({ aktif: 0, var: false });
  });

  test('W3) sayfa GİZLENİNCE bırakılır; görünür + okuma sürüyorsa yeniden istenir; duraklatılmışsa istenmez', async ({ page }) => {
    await hazirla(page);
    await dinle(page);
    await expect.poll(() => K(page)).toMatchObject({ istek: 1, aktif: 1 });
    await gorunurluk(page, 'hidden');
    await expect.poll(() => K(page)).toMatchObject({ aktif: 0, var: false });
    expect(await olaylar(page)).toContain('ekran kilidi bırakıldı (gizlendi)');
    await gorunurluk(page, 'visible');
    await expect.poll(() => K(page)).toMatchObject({ istek: 2, aktif: 1, var: true });
    // duraklat, gizle, görünür yap → yeni istek YOK
    await cubuk(page).locator('[data-act="so-duraklat"]').click();
    await gorunurluk(page, 'hidden');
    await gorunurluk(page, 'visible');
    await page.waitForTimeout(100);
    expect(await K(page)).toMatchObject({ istek: 2, aktif: 0, var: false });
  });

  test('W4) wakeLock DESTEĞİ YOKSA okuma aynen sürer; günlüğe oturum başına BİR kez yazılır', async ({ page }) => {
    await hazirla(page, { yok: true });
    await dinle(page);
    await expect.poll(() => page.evaluate(() => window.__sahteSes.konusmalar.length)).toBe(1);
    await cubuk(page).locator('[data-act="so-duraklat"]').click();
    await cubuk(page).locator('[data-act="so-devam"]').click();
    await gorunurluk(page, 'hidden');
    await gorunurluk(page, 'visible');
    const o = await olaylar(page);
    expect(o.filter(x => x === 'ekran kilidi: destek yok')).toHaveLength(1);
    expect((await page.evaluate(() => window.__ses.durum())).durum).toBe('oynuyor');
    await expect(page.locator('#detayIcerik .so-tani')).toContainText('ekran kilidi: destek yok');
  });

  test('W5) istek REDDEDİLİRSE okuma sürer, sebep günlükte', async ({ page }) => {
    await hazirla(page, { reddet: true });
    await dinle(page);
    await expect.poll(() => olaylar(page)).toContain('ekran kilidi: reddedildi (NotAllowedError)');
    expect((await page.evaluate(() => window.__ses.durum())).durum).toBe('oynuyor');
    expect((await K(page)).var).toBe(false);
  });

  test('W6) YARIŞ: istek yanıtı gelmeden duraklatılırsa gelen kilit hemen geri verilir (sızıntı yok)', async ({ page }) => {
    await hazirla(page, { ertele: true });
    await dinle(page);
    await expect.poll(() => K(page)).toMatchObject({ istek: 1 });
    await cubuk(page).locator('[data-act="so-duraklat"]').click();
    await page.evaluate(() => window.__sahteKilit.coz());
    await expect.poll(() => K(page)).toMatchObject({ aktif: 0, birak: 1, var: false });
    expect(await olaylar(page)).not.toContain('ekran uyanık');
  });

  test('W7) tarayıcı kilidi KENDİSİ bırakırsa günlüğe yazılır; görünür olunca okuma sürüyorsa yeniden istenir', async ({ page }) => {
    await hazirla(page);
    await dinle(page);
    await expect.poll(() => K(page)).toMatchObject({ aktif: 1 });
    await page.evaluate(() => window.__sahteKilit.tarayiciBirak());
    await expect.poll(() => K(page)).toMatchObject({ aktif: 0, var: false });
    expect(await olaylar(page)).toContain('ekran kilidi: tarayıcı bıraktı');
    await gorunurluk(page, 'visible');
    await expect.poll(() => K(page)).toMatchObject({ istek: 2, aktif: 1, var: true });
  });
});
