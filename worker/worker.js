/* kitaplik-ara — Kitaplık PWA için çok kaynaklı kitap arama + keşif proxy'si
   Uçlar:
     GET /ara?q=...              → { sonuclar:[{ad,yazar,yayinevi,yil,sayfa,kapak,kaynak}], kaynaklar }
     GET /turler                 → { turler:[{seo,ad,kitapSayisi}] }                       (78 tür)
     GET /tur?slug=..&sayfa=1    → { tur:{seo,ad}, sonuclar:[{ad,yazar,puan,okuyan,kapak}], hasMore, sayfa }
     GET /saglik                 → kaynak başına canlı sayaç (asla cache'lenmez)
   Kaynaklar: Goodreads auto_complete · 1000Kitap SSR (__NEXT_DATA__) · 1000Kitap v2 API

   NEDEN WORKER: /tur ve /turler tarayıcıdan atılamaz — kaynakta CORS başlığı yok
   VE Cloudflare sade istemcileri 403'lüyor (ölçüldü: UA'sız curl → 403, gerçek
   Chrome UA'sı → 200). Proxy hem kökeni hem tarayıcı başlıklarını sağlar. */

const IZINLI_KOKEN = 'https://dessn7-bit.github.io';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
/* Kaynak kendi sitesinin çağırdığı JSON API'si (1000kitap.com/api/... DEĞİL —
   o yol 404; ölçülen taban api.1000kitap.com/v2/). Türkçe içerik için
   Accept-Language açıkça gönderilir; yalnız YENİ uçlara eklenir, /ara'nın
   ölçülmüş davranışı değişmesin. */
const BIN1K_API = 'https://api.1000kitap.com/v2/';
const TR_BASLIK = { 'Accept-Language': 'tr-TR,tr;q=0.9' };

/* ÖNBELLEK SÜRELERİ
   - Tür listesi 7 gün: bu bir TAKSONOMİ, içerik değil. 78 türün slug seti
     pratikte hiç değişmiyor; kitapSayisi ayda bir kaç yüz oynuyor ve hiçbir
     yerde gösterilmiyor (yalnız "0 kitaplı türü eleme" kararında kullanılıyor).
     Bir haftalık gecikmenin görünür bir bedeli yok.
   - Tür sayfası 12 saat: burada GÖSTERİLEN sayı var — okur adedi ve puan
     gerekçe cümlesine giriyor. Bu sıralamalar (bir türün en çok okunan 16
     kitabı) aylar ölçeğinde oynuyor, ama gösterilen sayının yarım günden
     eski olmasına izin vermek istemiyorum: uygulama zaten kendi tarafında 24
     saat önbellekliyor, kenar önbelleğini de 24 saate çekmek en kötü durumda
     48 saatlik bir sayıyı "1000Kitap'ta X okur" diye sunardı. */
const TURLER_ONBELLEK_SN = 7 * 86400;
const TUR_ONBELLEK_SN = 12 * 3600;
/* Slug biçim kapısı: kaynağa yalnız tür-slug'ı şeklindeki metin gider
   (proxy'nin keyfi adres çağırmasını da engeller). */
const SLUG_KALIP = /^[A-Za-z0-9-]{1,60}$/;
const SAGLIK_TUR = 'Felsefe-Dusunce';   // 4114 kitaplı, kalıcı tür — teşhis sabiti

class KaynakHatasi extends Error {
  constructor(kod, ad){ super(ad); this.kod = kod; this.ad = ad; }
}

export default {
  async fetch(istek, env, ctx) {
    const url = new URL(istek.url);
    const cors = {
      'Access-Control-Allow-Origin': IZINLI_KOKEN,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Vary': 'Origin'
    };
    if (istek.method === 'OPTIONS') return new Response(null, { headers: cors });

    /* Sağlık ucu: her kaynağa bilinen bir sorgu atar, kaç sonuç döndüklerini ve
       süreyi bildirir. Kazıma/API yapısı değişirse belirti burada sayı olarak
       görünür. ASLA cache'lenmez — teşhis her seferinde taze olmalı.
       İKİ ALT SİSTEM AYRI raporlanır: `durum` /ara hattını, `turDurum` keşif
       hattını anlatır — biri bozulunca diğerinin yeşili yalan söylemesin. */
    if (url.pathname === '/saglik') {
      const q = url.searchParams.get('q') || 'tanri yanilgisi';
      const t0 = Date.now();
      const [gr, bk, tl, tk] = await Promise.all([
        goodreads(q), binKitap(q), turlerSayimi(), turSayimi(SAGLIK_TUR)]);
      const sonuc = {
        sorgu: q,
        goodreads: gr.length,
        binkitap: bk.length,
        toplam: tekillestir([...gr, ...bk]).length,
        turler: tl,
        tur: tk,
        turSlug: SAGLIK_TUR,
        sureMs: Date.now() - t0,
        durum: (gr.length || bk.length) ? (gr.length && bk.length ? 'iki kaynak da calisiyor' : 'TEK KAYNAK CALISIYOR') : 'HIC KAYNAK CALISMIYOR',
        turDurum: (tl && tk) ? 'tur kaynagi calisiyor'
          : (tl || tk) ? 'TUR KAYNAGI YARIM' : 'TUR KAYNAGI BOZUK'
      };
      return json(sonuc, { ...cors, 'Cache-Control': 'no-store' });
    }

    /* --- Tür listesi (keşfin taksonomisi) --- */
    if (url.pathname === '/turler') {
      return await onbellekli(url.origin + '/turler', ctx, cors, TURLER_ONBELLEK_SN, async () => {
        const j = await binKitapApi('kitap-turleri/turler');
        const turler = (Array.isArray(j.liste) ? j.liste : [])
          .filter(t => t && t.seo_adi && t.adi)
          .map(t => ({ seo: t.seo_adi, ad: t.adi, kitapSayisi: parseInt(t.kitapSayisi, 10) || 0 }));
        // BOŞ liste = kaynak bozulmuş; cache'lenirse arıza 7 gün yaşar
        if (!turler.length) throw new KaynakHatasi(502, 'kaynak-bos');
        return { turler };
      });
    }

    /* --- Tür sayfası: türün en çok okunan kitapları --- */
    if (url.pathname === '/tur') {
      const slug = (url.searchParams.get('slug') || '').trim();
      if (!SLUG_KALIP.test(slug))
        return json({ hata: 'slug-gecersiz' }, { ...cors, 'Cache-Control': 'no-store' }, 400);
      const sayfa = Math.min(50, Math.max(1, parseInt(url.searchParams.get('sayfa'), 10) || 1));
      // Önbellek anahtarı KANONİK (ham istek URL'i değil): sayfa kelepçelenmiş
      // hâliyle girer, tanınmayan parametreler önbelleği bölemez.
      const anahtar = url.origin + '/tur?slug=' + encodeURIComponent(slug) + '&sayfa=' + sayfa;
      return await onbellekli(anahtar, ctx, cors, TUR_ONBELLEK_SN, async () => {
        const j = await binKitapApi('kitaplar/genel-bakis?turSeo='
          + encodeURIComponent(slug) + '&sayfa=' + sayfa);
        /* GEÇERSİZ SLUG İMZASI (ölçüldü): kaynak 200 + boş liste + `kitapTuru`
           ALANI YOK döner. Yani "sonuç yok" ile "tür yok" ayrımı kitapTuru'nun
           varlığından okunur — 404 olarak dışarı verilir, cache'lenmez. */
        if (!j || !j.kitapTuru) throw new KaynakHatasi(404, 'tur-bulunamadi');
        const sonuclar = (Array.isArray(j.liste) ? j.liste : []).map(b => {
          const p = Number(b && b.puan), o = Number(b && b.okuduDuz);
          return {
            ad: (b && b.adi) || '',
            yazar: (b && (b.yazarAdi || b.ilkYazar)) || '',
            puan: p > 0 ? p : null,
            okuyan: o > 0 ? o : null,
            kapak: (b && b.resim) || null
          };
        }).filter(x => x.ad);
        if (!sonuclar.length) throw new KaynakHatasi(404, 'tur-bos');
        return {
          tur: { seo: j.kitapTuru.seo_adi || slug, ad: j.kitapTuru.adi || slug },
          sonuclar, hasMore: !!j.hasMore, sayfa
        };
      });
    }

    if (url.pathname !== '/ara')
      return new Response('kitaplik-ara v2', { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...cors } });

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

function json(o, headers, durum) {
  return new Response(JSON.stringify(o), {
    status: durum || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers }
  });
}

/* Kenar önbellekli üretici sarmalayıcı (yeni uçlar).
   KURAL KORUNUR: yalnız DOLU ve BAŞARILI yanıt cache'lenir. Üretici boş/bozuk
   kaynağı KaynakHatasi ile bildirir; hata yanıtı no-store döner, böylece geçici
   arıza saatlerce servis edilmez (/ara'daki boş-sonuç kuralının aynısı). */
async function onbellekli(anahtarUrl, ctx, cors, saniye, uret) {
  const cache = caches.default;
  const anahtar = new Request(anahtarUrl);
  const vurus = await cache.match(anahtar);
  if (vurus) return vurus;
  let govde;
  try {
    govde = await uret();
  } catch (e) {
    return json({ hata: (e && e.ad) || 'kaynak-ulasilamadi' },
      { ...cors, 'Cache-Control': 'no-store' }, (e && e.kod) || 502);
  }
  const yanit = json(govde, { ...cors, 'Cache-Control': 'public, max-age=' + saniye });
  ctx.waitUntil(cache.put(anahtar, yanit.clone()));
  return yanit;
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

/* ekBaslik parametresiz çağrılar (mevcut /ara kaynakları) BİREBİR eski
   davranışı korur — yalnız User-Agent gider. */
async function zamanli(url, ms, ekBaslik) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, {
      headers: { 'User-Agent': UA, ...(ekBaslik || {}) }, signal: c.signal });
  }
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

/* --- Kaynak 2: 1000Kitap arama (SSR __NEXT_DATA__) --- */
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

/* --- Kaynak 3: 1000Kitap v2 API (tür keşfi) --- */
async function binKitapApi(yol) {
  const r = await zamanli(BIN1K_API + yol, 5000, TR_BASLIK);
  if (!r.ok) throw new KaynakHatasi(502, 'kaynak-' + r.status);
  return await r.json();
}
/* Sağlık sayaçları: ASLA fırlatmaz, bozukluğu 0 olarak bildirir. */
async function turlerSayimi() {
  try { const j = await binKitapApi('kitap-turleri/turler');
    return (Array.isArray(j.liste) ? j.liste : []).length; } catch (e) { return 0; }
}
async function turSayimi(slug) {
  try {
    const j = await binKitapApi('kitaplar/genel-bakis?turSeo=' + encodeURIComponent(slug) + '&sayfa=1');
    return (j && j.kitapTuru && Array.isArray(j.liste)) ? j.liste.length : 0;
  } catch (e) { return 0; }
}

/* test kancası (node testleri için, Worker çalışmasını etkilemez) */
export { grDonustur, bkDonustur, tekillestir, norm };
