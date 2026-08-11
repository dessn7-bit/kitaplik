'use strict';
/* G51 — Hatırlatma (push bildirimi): bildirim.js + sw.js push/notificationclick
   + worker-bildirim/worker.js.
   Sözleşmeler:
   - GİZLİLİK: alıntı METNİ sunucuya gitmez; sunucuya giden tek veri abonelik
     + saat + dilim + vade günü. Push PAYLOAD'SIZ; metni SW, IndexedDB
     özetinden üretir. Özet SAYI değil VADE listesi taşır (gece devri).
   - bugunSayi=0 kararı: ana kapı SUNUCUDA (vade gelmemişse hiç gönderilmez);
     SW'de savunma = SESSİZLİK (yanlış bildirim güveni yakar).
   - Günde en fazla 1 bildirim (KV gonderim işareti, TTL 2 gün).
   - 404/410 → abonelik KV'den silinir; 429 → işaret yazılmaz, sonraki saat.
   - CORS yalnız https://dessn7-bit.github.io; hız sınırı; geçersiz gövde 4xx.
   Worker/SW testleri g20 yöntemiyle Node'da (sayfa yok); UI testleri Playwright.
   (Mutasyon 1: SW push'ta özet okuma kaldırılır → "vadeler sayılır" vakası
    kırmızı. Mutasyon 2: worker'da 404/410 silme kaldırılır → "ölü abonelik
    silinir" vakası kırmızı.) */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { generateKeyPairSync } = require('crypto');
const { test, expect, tohumla, sahteKitap, rafAc, ayarlarAc, bugunISO } = require('./yardim');

const KOK = path.join(__dirname, '..');
const SW_KAYNAK = fs.readFileSync(path.join(KOK, 'sw.js'), 'utf8');
const IZINLI = 'https://dessn7-bit.github.io';
const TEST_JWK = JSON.stringify(
  generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ format: 'jwk' }));

/* ================= worker yardımcıları ================= */
function sahteKV(baslangic) {
  const depo = new Map(Object.entries(baslangic || {}));
  return {
    depo,
    get: async k => (depo.has(k) ? depo.get(k) : null),
    put: async (k, v) => { depo.set(k, v); },
    delete: async k => { depo.delete(k); return true; },
    list: async (s) => ({
      keys: [...depo.keys()].filter(k => !s || !s.prefix || k.startsWith(s.prefix)).map(name => ({ name })),
      list_complete: true
    })
  };
}
async function workerYukle() {
  return (await import('file://' + path.join(KOK, 'worker-bildirim', 'worker.js').replace(/\\/g, '/'))).default;
}
function ortamKur(kv) {
  return { KV: kv || sahteKV(), VAPID_OZEL_JWK: TEST_JWK, VAPID_ACIK: 'TESTACIK' };
}
function istekYap(yol, govde, ek) {
  const e = ek || {};
  return new Request('https://kitaplik-bildirim.dessn7.workers.dev' + yol, {
    method: e.method || (govde === undefined ? 'GET' : 'POST'),
    headers: Object.assign({
      'Origin': e.koken === undefined ? IZINLI : e.koken,
      'Content-Type': 'application/json',
      'CF-Connecting-IP': e.ip || '10.0.0.1'
    }, e.basliklar || {}),
    body: govde === undefined ? undefined : (typeof govde === 'string' ? govde : JSON.stringify(govde))
  });
}
const ABONELIK = { endpoint: 'https://fcm.googleapis.com/fcm/send/ornek-abonelik-123',
  keys: { p256dh: 'p256ORNEK', auth: 'authORNEK' } };
function gecerliGovde(ek) {
  return Object.assign({ abonelik: ABONELIK, saat: 9, dilim: 'UTC', vade: '2026-08-11' }, ek || {});
}
/* sahte push servisi: global fetch'i yakalar */
function pushServisi(kod) {
  const istekler = [];
  global.fetch = async (url, secenek) => {
    istekler.push({ url: String(url), secenek: secenek || {} });
    return { status: typeof kod === 'function' ? kod(istekler.length) : (kod || 201) };
  };
  return istekler;
}

test.describe('G51 worker uçları', () => {

  test('abone: geçerli gövde 200 + KV kaydı hash anahtarıyla; metin alanı YOK', async () => {
    const w = await workerYukle();
    const env = ortamKur();
    const y = await w.fetch(istekYap('/abone', gecerliGovde()), env);
    expect(y.status).toBe(200);
    const anahtarlar = [...env.KV.depo.keys()].filter(k => k.startsWith('abone:'));
    expect(anahtarlar.length).toBe(1);
    expect(anahtarlar[0].length).toBe('abone:'.length + 64);   // sha-256 hex — endpoint anahtarda görünmez
    const kayit = JSON.parse(env.KV.depo.get(anahtarlar[0]));
    expect(kayit.saat).toBe(9);
    expect(kayit.dilim).toBe('UTC');
    expect(kayit.vade).toBe('2026-08-11');
    expect(kayit.abonelik.endpoint).toBe(ABONELIK.endpoint);
    // gizlilik: kayıtta yalnız beklenen alanlar — metin taşıyabilecek alan yok
    expect(Object.keys(kayit).sort()).toEqual(['abonelik', 'dilim', 'olusturma', 'saat', 'vade']);
  });

  test('abone: geçersiz gövdeler 4xx (bozuk json, eksik anahtar, saat, dilim, vade)', async () => {
    const w = await workerYukle();
    const env = ortamKur();
    expect((await w.fetch(istekYap('/abone', 'bozuk{json'), env)).status).toBe(400);
    expect((await w.fetch(istekYap('/abone', gecerliGovde({ abonelik: { endpoint: 'http://duz-http' } })), env)).status).toBe(400);
    expect((await w.fetch(istekYap('/abone', gecerliGovde({ saat: 25 })), env)).status).toBe(400);
    expect((await w.fetch(istekYap('/abone', gecerliGovde({ dilim: 'Boyle/Dilim_Yok' })), env)).status).toBe(400);
    expect((await w.fetch(istekYap('/abone', gecerliGovde({ vade: '11.08.2026' })), env)).status).toBe(400);
    expect([...env.KV.depo.keys()].filter(k => k.startsWith('abone:'))).toEqual([]);
  });

  test('CORS: yabancı kökenden red (403), izinli köken başlıkta, OPTIONS 204', async () => {
    const w = await workerYukle();
    const env = ortamKur();
    const yabanci = await w.fetch(istekYap('/abone', gecerliGovde(), { koken: 'https://kotu.site' }), env);
    expect(yabanci.status).toBe(403);
    const on = await w.fetch(istekYap('/abone', undefined, { method: 'OPTIONS' }), env);
    expect(on.status).toBe(204);
    expect(on.headers.get('Access-Control-Allow-Origin')).toBe(IZINLI);
    const dogru = await w.fetch(istekYap('/abone', gecerliGovde()), env);
    expect(dogru.headers.get('Access-Control-Allow-Origin')).toBe(IZINLI);
  });

  test('hız sınırı: aynı IP saatte 30 POST sonrası 429', async () => {
    const w = await workerYukle();
    const env = ortamKur();
    let son = null;
    for (let i = 0; i < 31; i++) {
      son = await w.fetch(istekYap('/abone-sil', { endpoint: ABONELIK.endpoint }, { ip: '7.7.7.7' }), env);
    }
    expect(son.status).toBe(429);
    // farklı IP etkilenmez
    expect((await w.fetch(istekYap('/abone-sil', { endpoint: ABONELIK.endpoint }, { ip: '8.8.8.8' }), env)).status).toBe(200);
  });

  test('abone-durum / abone-guncelle / abone-sil akışı', async () => {
    const w = await workerYukle();
    const env = ortamKur();
    await w.fetch(istekYap('/abone', gecerliGovde()), env);
    const durumUrl = '/abone-durum?endpoint=' + encodeURIComponent(ABONELIK.endpoint);
    let d = await (await w.fetch(istekYap(durumUrl), env)).json();
    expect(d).toEqual({ kayitli: true, saat: 9, dilim: 'UTC', vade: '2026-08-11' });
    expect((await w.fetch(istekYap('/abone-guncelle', { endpoint: ABONELIK.endpoint, vade: '2026-09-01', saat: 21 }), env)).status).toBe(200);
    d = await (await w.fetch(istekYap(durumUrl), env)).json();
    expect(d.vade).toBe('2026-09-01');
    expect(d.saat).toBe(21);
    expect((await w.fetch(istekYap('/abone-guncelle', { endpoint: 'https://olmayan.example/x' }), env)).status).toBe(404);
    expect((await w.fetch(istekYap('/abone-sil', { endpoint: ABONELIK.endpoint }), env)).status).toBe(200);
    d = await (await w.fetch(istekYap(durumUrl), env)).json();
    expect(d).toEqual({ kayitli: false });
  });

  test('cron: saati gelen + vadesi geçen aboneye PAYLOAD\'SIZ VAPID push; işaret yazılır', async () => {
    const w = await workerYukle();
    const env = ortamKur();
    await w.fetch(istekYap('/abone', gecerliGovde()), env);   // saat 9 UTC, vade dün
    const istekler = pushServisi(201);
    await w.gonderTuru(env, new Date('2026-08-12T09:30:00Z'));
    expect(istekler.length).toBe(1);
    expect(istekler[0].url).toBe(ABONELIK.endpoint);
    expect(istekler[0].secenek.method).toBe('POST');
    expect(istekler[0].secenek.body).toBeUndefined();          // payload'sız — metin taşınmaz
    const yetki = istekler[0].secenek.headers.Authorization;
    expect(yetki.startsWith('vapid t=')).toBe(true);
    expect(yetki).toContain('k=TESTACIK');
    const jwt = yetki.slice('vapid t='.length).split(',')[0].split('.');
    expect(jwt.length).toBe(3);
    const govde = JSON.parse(Buffer.from(jwt[1], 'base64url').toString());
    expect(govde.aud).toBe('https://fcm.googleapis.com');
    expect(govde.sub).toContain('mailto:');
    expect(govde.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    const isaretler = [...env.KV.depo.keys()].filter(k => k.startsWith('gonderim:'));
    expect(isaretler.length).toBe(1);
    expect(isaretler[0].endsWith(':2026-08-12')).toBe(true);
  });

  test('cron: saat eşleşmeyen VEYA vadesi gelmemiş aboneye HİÇ gönderilmez', async () => {
    const w = await workerYukle();
    const env = ortamKur();
    await w.fetch(istekYap('/abone', gecerliGovde({ saat: 15 })), env);   // saat tutmuyor
    const baska = { endpoint: 'https://fcm.googleapis.com/fcm/send/ikinci', keys: ABONELIK.keys };
    await w.fetch(istekYap('/abone', gecerliGovde({ abonelik: baska, vade: '2026-08-13' })), env);  // vade yarın
    const ucuncu = { endpoint: 'https://fcm.googleapis.com/fcm/send/ucuncu', keys: ABONELIK.keys };
    await w.fetch(istekYap('/abone', gecerliGovde({ abonelik: ucuncu, vade: null })), env);          // vadesiz
    const istekler = pushServisi(201);
    await w.gonderTuru(env, new Date('2026-08-12T09:30:00Z'));
    expect(istekler).toEqual([]);
  });

  test('günde EN FAZLA 1: işaret varken aynı gün ikinci tur göndermez', async () => {
    const w = await workerYukle();
    const env = ortamKur();
    await w.fetch(istekYap('/abone', gecerliGovde()), env);
    const istekler = pushServisi(201);
    await w.gonderTuru(env, new Date('2026-08-12T09:10:00Z'));
    await w.gonderTuru(env, new Date('2026-08-12T09:50:00Z'));
    expect(istekler.length).toBe(1);
  });

  test('404/410 → ölü abonelik KV\'den SİLİNİR (mutasyon kilidi)', async () => {
    const w = await workerYukle();
    const env = ortamKur();
    await w.fetch(istekYap('/abone', gecerliGovde()), env);
    pushServisi(410);
    await w.gonderTuru(env, new Date('2026-08-12T09:30:00Z'));
    expect([...env.KV.depo.keys()].filter(k => k.startsWith('abone:'))).toEqual([]);
    expect([...env.KV.depo.keys()].filter(k => k.startsWith('gonderim:'))).toEqual([]);
  });

  test('429 → geri çekil: işaret yazılmaz, kayıt durur, sonraki saat yeniden dener', async () => {
    const w = await workerYukle();
    const env = ortamKur();
    await w.fetch(istekYap('/abone', gecerliGovde()), env);
    let istekler = pushServisi(429);
    await w.gonderTuru(env, new Date('2026-08-12T09:10:00Z'));
    expect(istekler.length).toBe(1);
    expect([...env.KV.depo.keys()].filter(k => k.startsWith('abone:')).length).toBe(1);
    expect([...env.KV.depo.keys()].filter(k => k.startsWith('gonderim:'))).toEqual([]);
    istekler = pushServisi(201);
    await w.gonderTuru(env, new Date('2026-08-12T09:50:00Z'));   // aynı gün, işaret yok → yeniden
    expect(istekler.length).toBe(1);
    expect([...env.KV.depo.keys()].filter(k => k.startsWith('gonderim:')).length).toBe(1);
  });

  test('VAPID özel anahtarı hiçbir yanıtta sızmaz', async () => {
    const w = await workerYukle();
    const env = ortamKur();
    const ozelD = JSON.parse(TEST_JWK).d;
    const yanitlar = [
      await w.fetch(istekYap('/abone', gecerliGovde()), env),
      await w.fetch(istekYap('/abone-durum?endpoint=' + encodeURIComponent(ABONELIK.endpoint)), env),
      await w.fetch(istekYap('/saglik'), env),
      await w.fetch(istekYap('/abone', 'bozuk'), env)
    ];
    for (const y of yanitlar) {
      const metin = await y.text();
      expect(metin.includes(ozelD)).toBe(false);
      expect(metin.includes('VAPID_OZEL')).toBe(false);
    }
  });

  test('worker kaynak kopyaları özdeş (canlı deploy ↔ repo arşivi, CRLF hariç)', async () => {
    const duz = s => s.replace(/\r\n/g, '\n');
    const repo = duz(fs.readFileSync(path.join(KOK, 'worker-bildirim', 'worker.js'), 'utf8'));
    const canli = duz(fs.readFileSync('C:/Users/Kaan/_kitaplik_worker_bildirim/worker.js', 'utf8'));
    expect(repo).toBe(canli);
  });
});

/* ================= sw.js push / notificationclick (vm) ================= */
function sahteIdb(kayit) {
  return {
    open() {
      const istek = {};
      setTimeout(() => {
        istek.result = {
          transaction() {
            return { objectStore() {
              return { get(k) {
                const g = {};
                setTimeout(() => { g.result = (k === 'guncel') ? kayit : undefined; if (g.onsuccess) g.onsuccess(); }, 0);
                return g;
              } };
            } };
          },
          close() {}, createObjectStore() {}
        };
        if (istek.onsuccess) istek.onsuccess();
      }, 0);
      return istek;
    }
  };
}
function swPushKur(ozet, ayar) {
  const a = ayar || {};
  const dinleyici = {};
  const bildirimler = [];
  const acilan = [];
  const mesajlar = [];
  const istemciler = (a.istemciler || []).map(u => ({
    url: u, odaklandi: false,
    focus() { this.odaklandi = true; return Promise.resolve(this); },
    postMessage(m) { mesajlar.push(m); }
  }));
  const ctx = {
    self: {
      location: { origin: 'https://dessn7-bit.github.io' },
      addEventListener: (t, f) => { dinleyici[t] = f; },
      skipWaiting: () => {},
      registration: { showNotification: (baslik, secenek) => { bildirimler.push({ baslik, secenek }); return Promise.resolve(); } },
      clients: {
        claim: () => {},
        matchAll: async () => istemciler,
        openWindow: async u => { acilan.push(u); return null; }
      }
    },
    caches: { open: async () => ({ put: async () => {}, match: async () => undefined, addAll: async () => {} }),
      keys: async () => [], delete: async () => {}, match: async () => undefined },
    fetch: async () => ({ clone: () => ({}) }),
    indexedDB: sahteIdb(ozet),
    Response: class { constructor(g, o) { this.govde = g; Object.assign(this, o || {}); } },
    URL, console, Date, setTimeout
  };
  vm.createContext(ctx);
  vm.runInContext(SW_KAYNAK, ctx);
  return { dinleyici, bildirimler, acilan, mesajlar, istemciler };
}
async function olayGonder(kurulum, tur, ek) {
  const bekleyen = [];
  kurulum.dinleyici[tur](Object.assign({ waitUntil: p => bekleyen.push(p) }, ek || {}));
  await Promise.all(bekleyen);
}
function gunKaydir(n) {
  const d = new Date(Date.now() + n * 86400000);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

test.describe('G51 service worker push', () => {

  test('push: dünkü+bugünkü vadeler sayılır, gelecektekiler sayılmaz; örnek metin gövdede (mutasyon kilidi)', async () => {
    const k = swPushKur({ vadeler: [gunKaydir(-1), gunKaydir(0), gunKaydir(3)], ornekMetin: 'Örnek kırpık cümle…', guncelleme: 1 });
    await olayGonder(k, 'push');
    expect(k.bildirimler.length).toBe(1);
    expect(k.bildirimler[0].baslik).toBe('2 alıntı seni bekliyor');
    expect(k.bildirimler[0].secenek.body).toContain('Örnek kırpık cümle');
    expect(k.bildirimler[0].secenek.tag).toBe('kitaplik-tekrar');
  });

  test('push: bugün vadesi YOK → bildirim gösterilmez (bugunSayi=0 kararı: sessizlik)', async () => {
    const k = swPushKur({ vadeler: [gunKaydir(2), gunKaydir(9)], ornekMetin: 'x', guncelleme: 1 });
    await olayGonder(k, 'push');
    expect(k.bildirimler).toEqual([]);
  });

  test('push: özet hiç yok → bildirim gösterilmez', async () => {
    const k = swPushKur(undefined);
    await olayGonder(k, 'push');
    expect(k.bildirimler).toEqual([]);
  });

  test('notificationclick: açık sekme odaklanır + tekrar-ac mesajı; pencere AÇILMAZ', async () => {
    const k = swPushKur(undefined, { istemciler: ['https://dessn7-bit.github.io/kitaplik/index.html'] });
    let kapatildi = false;
    await olayGonder(k, 'notificationclick', { notification: { close: () => { kapatildi = true; } } });
    expect(kapatildi).toBe(true);
    expect(k.istemciler[0].odaklandi).toBe(true);
    expect(k.mesajlar).toEqual([{ tur: 'tekrar-ac' }]);
    expect(k.acilan).toEqual([]);
  });

  test('notificationclick: açık sekme yoksa ?sekme=alinti ile pencere açılır', async () => {
    const k = swPushKur(undefined, { istemciler: [] });
    await olayGonder(k, 'notificationclick', { notification: { close: () => {} } });
    expect(k.acilan).toEqual(['./index.html?sekme=alinti']);
  });

  test('sw kaynak: bildirim.js ASSETS\'te; OCR kova sözleşmesi bozulmadı (regresyon)', async () => {
    const e = SW_KAYNAK.match(/const ASSETS = \[([^\]]*)\]/)[1];
    expect(e).toContain("'./bildirim.js'");
    // OCR sözleşmesi: kova sabiti + activate muafiyeti + /ocr/ dalı hâlâ yerinde
    expect(SW_KAYNAK).toContain("const OCR_KOVA = 'kk_ocr_paket_v1'");
    expect(SW_KAYNAK).toContain('k !== CACHE && k !== OCR_KOVA');
    expect(SW_KAYNAK.indexOf("indexOf('/ocr/')")).toBeGreaterThan(-1);
  });
});

/* ================= sayfa tarafı (bildirim.js) ================= */
function alintiNotu(ek) {
  return Object.assign({ id: 'not' + Math.random().toString(36).slice(2, 7), tip: 'alinti',
    metin: 'Aşk, insanın kendi eksikliğini bir başkasında tamamlama çabasıdır; upuzun bir cümle olsun diye devam ediyor.',
    tarih: '2026-08-01', sayfa: null, tekrarDurum: 'aktif', tekrarAralik: 3,
    tekrarSayisi: 1, tekrarSonraki: bugunISO(0) }, ek || {});
}

test.describe('G51 sayfa tarafı', () => {

  test('özet IndexedDB\'ye yazılır: vade listesi + kırpılmış örnek metin', async ({ page }) => {
    const k = sahteKitap({ ad: 'Deneme', notlar: [alintiNotu(), alintiNotu({ tekrarSonraki: bugunISO(4), metin: 'İkinci.' })] });
    await tohumla(page, [k]);
    await rafAc(page);
    await expect.poll(() => page.evaluate(() => window.__bildirim.ozetOku().then(o => o && o.vadeler.length)), { timeout: 8000 }).toBe(2);
    const o = await page.evaluate(() => window.__bildirim.ozetOku());
    expect(o.vadeler[0]).toBe(await page.evaluate(() => {
      const s = new Date();
      return s.getFullYear() + '-' + String(s.getMonth() + 1).padStart(2, '0') + '-' + String(s.getDate()).padStart(2, '0');
    }));
    expect(o.ornekMetin.length).toBeLessThanOrEqual(90);
    expect(o.ornekMetin.endsWith('…')).toBe(true);
    expect(o.ornekMetin).toContain('Aşk, insanın');
  });

  test('kuyruk değişince özet tazelenir (tk-devam → vade ileri gider)', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Deneme', notlar: [alintiNotu()] })]);
    await rafAc(page);
    await page.click('nav [data-act="sekme"][data-v="alinti"]');
    await expect(page.locator('#tkKutu [data-act="tk-devam"]')).toBeVisible();
    const bugun = bugunISO(0);
    await expect.poll(() => page.evaluate(() => window.__bildirim.ozetOku().then(o => o && o.vadeler[0])), { timeout: 8000 }).toBe(bugun);
    await page.click('#tkKutu [data-act="tk-devam"]');
    // depoKaydet sarmalaması + 500ms debounce → özetteki vade artık gelecekte
    await expect.poll(() => page.evaluate(() => window.__bildirim.ozetOku().then(o => o && o.vadeler[0])), { timeout: 8000 }).not.toBe(bugun);
    const yeni = await page.evaluate(() => window.__bildirim.ozetOku().then(o => o.vadeler[0]));
    expect(yeni > bugun).toBe(true);
  });

  test('Ayarlar ▸ Hatırlatma: destek yokken dürüst mesaj, düğmeler gizli', async ({ page }) => {
    await page.addInitScript(() => { try { delete window.PushManager; } catch (e) {} });
    await tohumla(page, [sahteKitap({ ad: 'Deneme' })]);
    await rafAc(page);
    await ayarlarAc(page);
    await expect(page.locator('#htDurum')).toContainText('desteklemiyor');
    await expect(page.locator('#ayBolumHatirlatma [data-act="ht-ac"]')).toBeHidden();
  });

  test('izin reddedilmişse dürüst mesaj + tarayıcı ayarı yönergesi; Aç düğmesi gizli', async ({ page }) => {
    await page.addInitScript(() => {
      try { Object.defineProperty(Notification, 'permission', { value: 'denied', configurable: true }); } catch (e) {}
    });
    await tohumla(page, [sahteKitap({ ad: 'Deneme' })]);
    await rafAc(page);
    await ayarlarAc(page);
    await expect(page.locator('#htDurum')).toContainText('reddedilmiş');
    await expect(page.locator('#htDurum')).toContainText('site ayarları');
    await expect(page.locator('#ayBolumHatirlatma [data-act="ht-ac"]')).toBeHidden();
    await expect(page.locator('#ayBolumHatirlatma [data-act="ht-kapat"]')).toBeHidden();
  });

  test('saat seçici 24 seçenek, tercih localStorage\'da kalıcı', async ({ page }) => {
    await tohumla(page, [sahteKitap({ ad: 'Deneme' })]);
    await rafAc(page);
    await ayarlarAc(page);
    await expect(page.locator('#htSaat option')).toHaveCount(24);
    await expect(page.locator('#htSaat')).toHaveValue('9');   // varsayılan 09:00
    await page.selectOption('#htSaat', '21');
    await page.reload();
    await ayarlarAc(page);
    await expect(page.locator('#htSaat')).toHaveValue('21');
    const a = await page.evaluate(() => JSON.parse(localStorage.getItem('kk_bildirim_v1')));
    expect(a.saat).toBe(21);
  });
});
