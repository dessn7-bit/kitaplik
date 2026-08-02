/* kitaplik-ara — Kitaplık PWA için çok kaynaklı kitap arama proxy'si
   Kaynaklar: Goodreads auto_complete (JSON) + 1000Kitap (__NEXT_DATA__ SSR JSON)
   Uç: GET /ara?q=...  →  { sonuclar: [{ad, yazar, yayinevi, yil, sayfa, kapak, kaynak}] } */

const IZINLI_KOKEN = 'https://dessn7-bit.github.io';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

export default {
  async fetch(istek, env, ctx) {
    const url = new URL(istek.url);
    const cors = {
      'Access-Control-Allow-Origin': IZINLI_KOKEN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Vary': 'Origin'
    };
    if (istek.method === 'OPTIONS') return new Response(null, { headers: cors });

    /* Sağlık ucu: iki kaynağa da bilinen bir sorgu atar, kaç sonuç döndüklerini ve
       süreyi bildirir. Kazıma yapısı değişirse belirti burada sayı olarak görünür.
       ASLA cache'lenmez — teşhis her seferinde taze olmalı. */
    if (url.pathname === '/saglik') {
      const q = url.searchParams.get('q') || 'tanri yanilgisi';
      const t0 = Date.now();
      const [gr, bk] = await Promise.all([goodreads(q), binKitap(q)]);
      const sonuc = {
        sorgu: q,
        goodreads: gr.length,
        binkitap: bk.length,
        toplam: tekillestir([...gr, ...bk]).length,
        sureMs: Date.now() - t0,
        durum: (gr.length || bk.length) ? (gr.length && bk.length ? 'iki kaynak da calisiyor' : 'TEK KAYNAK CALISIYOR') : 'HIC KAYNAK CALISMIYOR'
      };
      return json(sonuc, { ...cors, 'Cache-Control': 'no-store' });
    }

    if (url.pathname !== '/ara')
      return new Response('kitaplik-ara v1', { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...cors } });

    const q = (url.searchParams.get('q') || '').trim().slice(0, 80);
    if (q.length < 3) return json({ sonuclar: [] }, cors);

    // 6 saatlik kenar önbelleği (aynı sorgu tekrar kaynaklara gitmesin)
    const cacheKey = new Request(url.toString());
    const cache = caches.default;
    const onbellek = await cache.match(cacheKey);
    if (onbellek) return onbellek;

    const [gr, bk] = await Promise.all([goodreads(q), binKitap(q)]);
    const sonuclar = tekillestir([...gr, ...bk]).slice(0, 8);
    // kaynak sayaçları: istemci kullanmasa da teşhis için yanıtta dursun
    const kaynaklar = { goodreads: gr.length, binkitap: bk.length };

    // BOŞ sonucu cache'leme: kaynak geçici düşse 6 saat boyunca boş yanıt servis
    // edilip arıza kendi kendini uzatıyordu.
    if (!sonuclar.length) return json({ sonuclar, kaynaklar }, { ...cors, 'Cache-Control': 'no-store' });

    const yanit = json({ sonuclar, kaynaklar }, { ...cors, 'Cache-Control': 'public, max-age=21600' });
    ctx.waitUntil(cache.put(cacheKey, yanit.clone()));
    return yanit;
  }
};

function json(o, headers) {
  return new Response(JSON.stringify(o), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

function norm(s) {
  return String(s || '').toLocaleLowerCase('tr').replace(/[^a-z0-9çğıöşü]+/g, '');
}

function tekillestir(liste) {
  const gorulen = new Set(), cikti = [];
  for (const a of liste) {
    if (!a || !a.ad) continue;
    const k = norm(a.ad) + '|' + norm(a.yazar);
    if (gorulen.has(k)) continue;
    gorulen.add(k); cikti.push(a);
  }
  return cikti;
}

async function zamanli(url, ms) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { return await fetch(url, { headers: { 'User-Agent': UA }, signal: c.signal }); }
  finally { clearTimeout(t); }
}

/* --- Kaynak 1: Goodreads --- */
async function goodreads(q) {
  try {
    const r = await zamanli('https://www.goodreads.com/book/auto_complete?format=json&q=' + encodeURIComponent(q), 4500);
    if (!r.ok) return [];
    const j = await r.json();
    return grDonustur(j);
  } catch (e) { return []; }
}
function grDonustur(j) {
  return (Array.isArray(j) ? j : []).slice(0, 6).map(b => ({
    ad: b.bookTitleBare || b.title || '',
    yazar: (b.author && b.author.name) || '',
    yayinevi: '', yil: null,
    sayfa: parseInt(b.numPages) || null,
    kapak: b.imageUrl ? b.imageUrl.replace(/\._S[XY]\d+_\./, '.') : null,
    kaynak: 'Goodreads'
  })).filter(x => x.ad);
}

/* --- Kaynak 2: 1000Kitap --- */
async function binKitap(q) {
  try {
    const r = await zamanli('https://1000kitap.com/ara?q=' + encodeURIComponent(q) + '&bolum=kitaplar', 4500);
    if (!r.ok) return [];
    const h = await r.text();
    return bkDonustur(h);
  } catch (e) { return []; }
}
function bkDonustur(h) {
  const es = h.match(/__NEXT_DATA__[^>]*>([\s\S]*?)<\/script>/);
  if (!es) return [];
  let j;
  try { j = JSON.parse(es[1]); } catch (e) { return []; }
  const liste = listeBul(j) || [];
  return liste.slice(0, 6).map(b => ({
    ad: b.adi || '',
    yazar: b.yazarAdi || b.ilkYazar || '',
    yayinevi: '', yil: null, sayfa: null,
    kapak: b.resim || null,
    kaynak: '1000Kitap' + (b.puan ? ` ★${b.puan}` : '')
  })).filter(x => x.ad);
}
function listeBul(o) {
  if (o && typeof o === 'object') {
    if (Array.isArray(o.liste) && o.liste[0] && typeof o.liste[0] === 'object' && 'adi' in o.liste[0]) return o.liste;
    for (const v of Object.values(o)) { const r = listeBul(v); if (r) return r; }
  }
  return null;
}

/* test kancası (node testleri için, Worker çalışmasını etkilemez) */
export { grDonustur, bkDonustur, tekillestir, norm };
