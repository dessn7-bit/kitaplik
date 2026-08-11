/* kitaplik-bildirim — alıntı tekrarı push hatırlatması worker'ı.
   kitaplik-ara'dan AYRI worker (KARAR): arama proxy'si vatansız + kenar
   önbellekli; bildirim ise KV durumu, cron tetikleyici ve VAPID secret'i
   taşıyor. Ayrı deploy döngüsü arama hattını hiç riske atmaz.

   GİZLİLİK SÖZLEŞMESİ — sunucuya giden verinin TAMAMI:
     abonelik (push endpoint URL + p256dh + auth anahtarları, tarayıcı üretir)
     + saat (0-23) + dilim (IANA) + vade (YYYY-MM-DD, bir sonraki tekrar günü).
   Alıntı METNİ, kitap adı, sayı — HİÇBİRİ gelmez. Push da PAYLOAD'SIZ gider
   ("uyan" sinyali): içerik, cihazdaki service worker'ın IndexedDB özetinden
   üretilir. Payload olmadığı için Web Push şifrelemesi (aes128gcm) hiç yok.

   KV ANAHTAR TASARIMI (KARAR):
     abone:<sha256(endpoint) hex>  → kayıt JSON'u. Endpoint 500+ karakter
       olabilir ve KV anahtarı 512B sınırlı; hash sabit uzunluk + endpoint'in
       kendisi anahtar listelerinde görünmez (log hijyeni). Kayıt içinde
       endpoint zaten duruyor (push atmak için şart).
     gonderim:<hash>:<YYYY-MM-DD yerel gün> → günde-1 işareti, TTL 2 gün
       (kendini temizler; ayrı süpürme işi gerekmez).
     hiz:<ip> → abonelik uçları saatlik sayaç, TTL 1 saat. */
'use strict';

const IZINLI_KOKEN = 'https://dessn7-bit.github.io';
const HIZ_SINIR = 30;             // IP başına saatte istek (abonelik uçları)
const VADE_DESEN = /^\d{4}-\d{2}-\d{2}$/;

function corsBasliklar() {
  return {
    'Access-Control-Allow-Origin': IZINLI_KOKEN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store'
  };
}
function json(veri, durum) {
  return new Response(JSON.stringify(veri), {
    status: durum || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsBasliklar())
  });
}

async function endpointHash(endpoint) {
  const oz = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return [...new Uint8Array(oz)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function b64u(buf) {
  let s = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/* VAPID JWT — ES256, WebCrypto. Özel anahtar yalnız env.VAPID_OZEL_JWK
   secret'ında yaşar; hiçbir yanıtta/logda görünmez. */
async function vapidJwt(aud, env) {
  const jwk = JSON.parse(env.VAPID_OZEL_JWK);
  const anahtar = await crypto.subtle.importKey('jwk', jwk,
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const enc = new TextEncoder();
  const bas = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const gov = b64u(enc.encode(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 43200, sub: 'mailto:dessn7@gmail.com'
  })));
  const imza = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' },
    anahtar, enc.encode(bas + '.' + gov));   // WebCrypto ham r||s döner = JOSE biçimi
  return bas + '.' + gov + '.' + b64u(imza);
}

/* Payload'sız push. Dönüş: 'tamam' | 'olu' (404/410 → kayıt silinmeli)
   | 'geri-cekil' (429) | 'hata'. */
async function pushGonder(abonelik, env) {
  let yanit;
  try {
    const jwt = await vapidJwt(new URL(abonelik.endpoint).origin, env);
    yanit = await fetch(abonelik.endpoint, {
      method: 'POST',
      headers: {
        'TTL': '14400',
        'Urgency': 'normal',
        'Authorization': 'vapid t=' + jwt + ', k=' + env.VAPID_ACIK
      }
    });
  } catch (e) { return 'hata'; }
  if (yanit.status === 404 || yanit.status === 410) return 'olu';
  if (yanit.status === 429) return 'geri-cekil';
  if (yanit.status >= 200 && yanit.status < 300) return 'tamam';
  console.log('push beklenmedik durum: ' + yanit.status);
  return 'hata';
}

function yerelSaat(dilim, an) {
  return parseInt(new Intl.DateTimeFormat('en-US', {
    timeZone: dilim, hour: 'numeric', hourCycle: 'h23'
  }).format(an), 10);
}
function yerelGun(dilim, an) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: dilim }).format(an); // YYYY-MM-DD
}
function dilimGecerli(dilim) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: dilim }); return true; }
  catch (e) { return false; }
}

function abonelikGecerli(a) {
  return a && typeof a.endpoint === 'string' && a.endpoint.startsWith('https://')
    && a.endpoint.length < 1024 && a.keys
    && typeof a.keys.p256dh === 'string' && typeof a.keys.auth === 'string';
}

async function hizAsimi(request, env) {
  const ip = request.headers.get('CF-Connecting-IP') || 'bilinmiyor';
  const anahtar = 'hiz:' + ip;
  const sayi = parseInt(await env.KV.get(anahtar), 10) || 0;
  if (sayi >= HIZ_SINIR) return true;
  await env.KV.put(anahtar, String(sayi + 1), { expirationTtl: 3600 });
  return false;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const koken = request.headers.get('Origin');

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsBasliklar() });
    /* Origin başlığı taşıyan (tarayıcı) isteklerde yalnız kendi kökenimiz.
       Origin'siz istek (curl/sunucu) CORS'un konusu değil; uçlar zaten
       kişisel veri döndürmez, yazma uçları gövde doğrulamasından geçer. */
    if (koken && koken !== IZINLI_KOKEN) return json({ hata: 'koken' }, 403);

    if (url.pathname === '/saglik') return json({ durum: 'calisiyor' });

    if (url.pathname === '/abone-durum' && request.method === 'GET') {
      const endpoint = url.searchParams.get('endpoint') || '';
      if (!endpoint.startsWith('https://')) return json({ hata: 'endpoint' }, 400);
      const kayit = await env.KV.get('abone:' + await endpointHash(endpoint));
      if (!kayit) return json({ kayitli: false });
      const k = JSON.parse(kayit);
      return json({ kayitli: true, saat: k.saat, dilim: k.dilim, vade: k.vade });
    }

    if (request.method !== 'POST') return json({ hata: 'yontem' }, 405);
    if (await hizAsimi(request, env)) return json({ hata: 'hiz' }, 429);

    let govde;
    try { govde = await request.json(); } catch (e) { return json({ hata: 'govde' }, 400); }

    if (url.pathname === '/abone') {
      if (!abonelikGecerli(govde.abonelik)) return json({ hata: 'abonelik' }, 400);
      const saat = parseInt(govde.saat, 10);
      if (!(saat >= 0 && saat <= 23)) return json({ hata: 'saat' }, 400);
      if (typeof govde.dilim !== 'string' || !dilimGecerli(govde.dilim)) return json({ hata: 'dilim' }, 400);
      if (govde.vade !== null && !VADE_DESEN.test(govde.vade || '')) return json({ hata: 'vade' }, 400);
      const anahtar = 'abone:' + await endpointHash(govde.abonelik.endpoint);
      await env.KV.put(anahtar, JSON.stringify({
        abonelik: { endpoint: govde.abonelik.endpoint,
          keys: { p256dh: govde.abonelik.keys.p256dh, auth: govde.abonelik.keys.auth } },
        saat, dilim: govde.dilim, vade: govde.vade || null,
        olusturma: new Date().toISOString()
      }));
      return json({ tamam: true });
    }

    if (url.pathname === '/abone-guncelle') {
      if (typeof govde.endpoint !== 'string') return json({ hata: 'endpoint' }, 400);
      const anahtar = 'abone:' + await endpointHash(govde.endpoint);
      const eski = await env.KV.get(anahtar);
      if (!eski) return json({ hata: 'kayit-yok' }, 404);
      const k = JSON.parse(eski);
      if (govde.saat !== undefined) {
        const saat = parseInt(govde.saat, 10);
        if (!(saat >= 0 && saat <= 23)) return json({ hata: 'saat' }, 400);
        k.saat = saat;
      }
      if (govde.dilim !== undefined) {
        if (typeof govde.dilim !== 'string' || !dilimGecerli(govde.dilim)) return json({ hata: 'dilim' }, 400);
        k.dilim = govde.dilim;
      }
      if (govde.vade !== undefined) {
        if (govde.vade !== null && !VADE_DESEN.test(govde.vade || '')) return json({ hata: 'vade' }, 400);
        k.vade = govde.vade;
      }
      await env.KV.put(anahtar, JSON.stringify(k));
      return json({ tamam: true });
    }

    if (url.pathname === '/abone-sil') {
      if (typeof govde.endpoint !== 'string') return json({ hata: 'endpoint' }, 400);
      await env.KV.delete('abone:' + await endpointHash(govde.endpoint));
      return json({ tamam: true });
    }

    return json({ hata: 'yol' }, 404);
  },

  /* Saatte bir: yerel saati tercihine denk gelen VE vadesi bugün/geçmiş
     olan abonelere payload'sız "uyan" sinyali. Günde EN FAZLA 1 (işaret). */
  async scheduled(olay, env, ctx) {
    ctx.waitUntil(this.gonderTuru(env, new Date()));
  },

  async gonderTuru(env, an) {
    let cursor;
    do {
      const liste = await env.KV.list({ prefix: 'abone:', cursor });
      for (const anahtar of liste.keys) {
        const ham = await env.KV.get(anahtar.name);
        if (!ham) continue;
        let kayit;
        try { kayit = JSON.parse(ham); } catch (e) { await env.KV.delete(anahtar.name); continue; }
        let saat, gun;
        try { saat = yerelSaat(kayit.dilim, an); gun = yerelGun(kayit.dilim, an); }
        catch (e) { continue; }
        if (saat !== kayit.saat) continue;
        if (!kayit.vade || kayit.vade > gun) continue;   // vade gelmemiş → HİÇ gönderme
        const isaret = 'gonderim:' + anahtar.name.slice(6) + ':' + gun;
        if (await env.KV.get(isaret)) continue;          // günde en fazla 1
        const sonuc = await pushGonder(kayit.abonelik, env);
        if (sonuc === 'olu') { await env.KV.delete(anahtar.name); continue; }
        if (sonuc === 'geri-cekil') continue;            // işaret YOK → sonraki saat yeniden dener
        if (sonuc === 'tamam') await env.KV.put(isaret, '1', { expirationTtl: 172800 });
      }
      cursor = liste.list_complete ? null : liste.cursor;
    } while (cursor);
  }
};
