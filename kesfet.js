'use strict';
/* Kitaplık — KEŞFET sekmesi A aşaması (ad alanı: ks-), v50.
   "Rafından ne okusam": öneri motorunun TAM EKRAN hali. Motor oneri.js'te
   (window.__oneri) — burada YALNIZ görünüm + süzgeç durumu yaşar:
   hesaplaHam() ham sıralı listeyi verir; süzgeç → cesitlilikSec (yazar≤2)
   → nedenAta (gerekçe; tekillik GÖRÜNEN listede) → çizim. Ana Sayfa SIRADAKİ
   aynı motorun kırpılmış sarmalayıcısını (hesapla) kullanır — kopya gerekçe
   mantığı YOK (bu projede tekrar eden hata deseninin panzehiri).

   UZUNLUK EŞİKLERİ (karar): kısa <200 · orta 200-400 · uzun >400 sayfa —
   novella / standart roman / tuğla ayrımının yaygın yayıncılık eşikleri.
   Kütüphane-medyanına bağlı dinamik eşik hem açıklanamaz hem test-kararsız
   olurdu. Sayfası bilinmeyen kitap uzunluk süzgeci AÇIKKEN listeye girmez:
   bilinmeyeni bir kovaya saymak uydurma olur.

   SKOR GÖSTERİMİ (karar): ham sayı YOK — Ciltli'nin tek ilerleme kalıbı
   (3px altın konturlu kanal, 64px). Görünen liste içinde min-maks normalize,
   %10-100 kelepçe (eski panel dersi: geçersiz width bar'ı tam dolu gösterirdi).
   Az-veri modunda skor yok → çizgi hiç çizilmez. */
(function(){
  const SAYFA_ADIMI = 10;
  const UZUNLUK_AD = { kisa: 'Kısa', orta: 'Orta', uzun: 'Uzun' };
  const UZUNLUK_IPUCU = { kisa: '200 sayfadan az', orta: '200–400 sayfa', uzun: '400 sayfadan çok' };
  function uzunlukKova(sayfa){
    if(!(sayfa > 0)) return null;              // bilinmeyen: hiçbir kovaya girmez
    return sayfa < 200 ? 'kisa' : sayfa <= 400 ? 'orta' : 'uzun';
  }
  // süzgeç + liste durumu (cihaz-yerel, oturumluk — kalıcı tercih değil)
  const S = { sahiplik: 'sahip', tur: null, uzunluk: null, raf: null,
    limit: SAYFA_ADIMI, erteliAcik: false };

  const CSS = [
    '#ksIcerik{padding:2px 16px 24px}',
    '.ks-ust{display:flex;align-items:flex-start;gap:10px;padding:0 0 4px}',
    '.ks-ust-ic{flex:1;min-width:0}',
    '.ks-baslik{font-family:var(--serif);font-size:1.8rem;font-weight:400;line-height:1.15;margin-top:2px}',
    '.ks-acilis{font-size:.78rem;color:var(--muted);margin-top:4px;letter-spacing:.02em;font-variant-numeric:tabular-nums}',
    '.ks-ust .zar-btn{flex:0 0 40px;height:40px;margin-top:6px}',
    '.ks-suz{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:6px 0;align-items:center}',
    '.ks-suz::-webkit-scrollbar{display:none}',
    '.ks-suz-ad{font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted2);flex:0 0 auto;margin-right:2px}',
    '.ks-chip{flex:0 0 auto;padding:7px 12px;border:1px solid var(--cizgi);border-radius:var(--r-sm);' +
      'font-size:.78rem;color:var(--muted);background:transparent;white-space:nowrap}',
    // seçili çip metni PAPER: brass metin %7 tint üzerinde 4.23'e düşüyor (AA
    // kaçağı — g42 doğru renk çözücüyle ölçünce çıktı); seçililiği kontur +
    // tint + ağırlık verir, metin okunur kalır.
    '.ks-chip.secili{border-color:var(--brass);color:var(--paper);font-weight:600;' +
      'background:color-mix(in srgb,var(--brass) 7%,transparent)}',
    '.ks-item,.ks-b-item{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid var(--cizgi)}',
    '.ks-ic{flex:1;min-width:0}',
    '.ks-ad{display:block;font-family:var(--serif);font-size:1.05rem;font-weight:600;line-height:1.25;' +
      'text-align:left;overflow-wrap:break-word;padding:0;background:none;border:none;color:var(--paper)}',
    '.ks-yazar,.ks-b-yazar{font-style:italic;font-size:.78rem;color:var(--muted);margin-top:1px}',
    '.ks-neden,.ks-b-neden{font-size:.8rem;color:var(--muted2);line-height:1.5;margin-top:4px}',
    '.ks-skor{display:block;width:64px}',
    '.ks-eylem{display:flex;gap:16px;margin-top:8px;align-items:center}',
    '.ks-basla,.ks-b-ekle{font-family:var(--serif);font-weight:600;font-size:.8rem;color:var(--brass);' +
      'padding:2px 0;position:relative;background:none;border:none}',
    '.ks-basla::after,.ks-b-ekle::after{content:"";position:absolute;inset:-8px}',
    '.ks-sessiz,.ks-b-gizle{font-size:.78rem;color:var(--muted);text-decoration:underline;text-underline-offset:3px;' +
      'text-decoration-color:var(--muted2);padding:2px 0;background:none;border:none}',
    '.ks-rozet{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--brass)}',
    '.ks-not{font-size:.85rem;color:var(--muted);line-height:1.5;padding:14px 0}',
    '.ks-daha{margin-top:14px}',
    '.ks-erteli{padding:14px 0}',
    '.ks-erteli-item{display:flex;align-items:center;justify-content:space-between;gap:10px;' +
      'padding:10px 0;border-bottom:1px solid var(--cizgi);font-size:.85rem;color:var(--muted)}',
    '.ks-erteli-ad{flex:1;min-width:0;overflow-wrap:break-word}',
    '.ks-erteli-sag{display:flex;align-items:center;gap:12px;white-space:nowrap}',
    '.ks-erteli-gun{font-size:.72rem;color:var(--muted2);font-variant-numeric:tabular-nums}',
    // ---- B bölümü: YENİ KİTAPLAR (kütüphane-dışı; v51) ----
    '.ks-b-bas{display:flex;align-items:center;justify-content:space-between;gap:10px;' +
      'padding:16px 0 6px;margin-top:8px;border-top:1px solid var(--cizgi)}',
    '.ks-b-ad{display:block;font-family:var(--serif);font-size:1.05rem;font-weight:600;' +
      'line-height:1.25;overflow-wrap:break-word}',
    '.ks-b-not{font-size:.85rem;color:var(--muted);line-height:1.5;padding:10px 0}',
    '.ks-b-getir{margin-top:8px}'
  ].join('\n');

  function chip(grup, deger, etiket, secili, ipucu){
    return '<button class="ks-chip' + (secili ? ' secili' : '') + '" data-act="ks-suz"' +
      ' data-g="' + grup + '" data-v="' + escAttr(deger) + '"' +
      (ipucu ? ' title="' + escAttr(ipucu) + '"' : '') + '>' + esc(etiket) + '</button>';
  }

  function ustHtml(h, havuzN, filtreliN){
    const okunacakVar = typeof veri === 'object' && veri.kitaplar.some(k => k.durum === 'okunacak');
    const suzVar = S.tur || S.uzunluk || S.raf;
    // açılış cümlesi DÜRÜST: kaç aday, süzgeç kaçını geçirdi (sayı uydurma yok)
    const acilis = !havuzN
      ? 'Okunacak aday yok'
      : h.mod === 'az-veri'
        ? havuzN + ' okunacak aday — şimdilik bekleme sırasına göre'
        : suzVar
          ? havuzN + ' aday · süzgeçten geçen: ' + filtreliN
          : havuzN + ' okunacak aday arasından, okuma geçmişine göre';
    return '<div class="ks-ust"><div class="ks-ust-ic">' +
      '<span class="kicker">Rafından</span>' +
      '<h2 class="ks-baslik">Ne okusam?</h2>' +
      '<div class="ks-acilis">' + esc(acilis) + '</div></div>' +
      (okunacakVar ? '<button class="zar-btn" data-act="zar" title="Kader seçsin" ' +
        'aria-label="Okunacaklardan rastgele kitap öner">' +
        (window.ikon ? ikon('zar') : '') + '</button>' : '') +
      '</div>';
  }

  function suzgecHtml(turler, raflar){
    let html = '<div class="ks-suz"><span class="ks-suz-ad">Süz</span>' +
      chip('sahiplik', 'sahip', 'Bende', S.sahiplik === 'sahip') +
      chip('sahiplik', 'istek', 'İstek listem', S.sahiplik === 'istek') +
      Object.keys(UZUNLUK_AD).map(u =>
        chip('uzunluk', u, UZUNLUK_AD[u], S.uzunluk === u, UZUNLUK_IPUCU[u])).join('') +
      '</div>';
    if(turler.length)
      html += '<div class="ks-suz"><span class="ks-suz-ad">Tür</span>' +
        turler.map(t => chip('tur', t, t, S.tur === t)).join('') + '</div>';
    if(raflar.length)
      html += '<div class="ks-suz"><span class="ks-suz-ad">Raf</span>' +
        raflar.map(r => chip('raf', r, r, S.raf === r)).join('') + '</div>';
    return html;
  }

  function satirHtml(o, enY, enD){
    const k = o.kitap;
    let cizgi = '';
    if(o.skor !== null){
      const aralik = (enY - enD) || 1;
      const yuzde = Math.max(10, Math.min(100, Math.round(((o.skor - enD) / aralik) * 90 + 10)));
      if(Number.isFinite(yuzde))
        cizgi = '<span class="ilerleme ks-skor" role="img" aria-label="uygunluk göstergesi">' +
          '<span style="display:block;height:100%;background:var(--brass);width:' + yuzde + '%"></span></span>';
    }
    const eylem = (k.sahiplik === 'istek')
      ? '<span class="ks-rozet">İstek listende</span>'
      : '<button class="ks-basla" data-act="ks-basla" data-id="' + escAttr(k.id) + '">Okumaya başla</button>';
    return '<div class="ks-item">' +
      (typeof ktPlate === 'function' ? ktPlate(k, 'p-mini') : '') +
      '<div class="ks-ic">' +
        '<button class="ks-ad" data-act="detay" data-id="' + escAttr(k.id) + '">' + esc(k.ad) + '</button>' +
        (k.yazar ? '<div class="ks-yazar">' + esc(k.yazar) + '</div>' : '') +
        (o.neden ? '<div class="ks-neden">' + esc(o.neden) + '</div>' : '') +
        cizgi +
        '<div class="ks-eylem">' + eylem +
          '<button class="ks-sessiz" data-act="ks-ertele" data-id="' + escAttr(k.id) + '">Şimdi değil</button>' +
        '</div>' +
      '</div></div>';
  }

  /* ---------- B bölümü: YENİ KİTAPLAR (v51) ----------
     Kütüphanede OLMAYAN kitaplar; sinyaller yalnız YAZAR + SERİ (tür bazlı
     keşif ölçüldü, kaynaklar yetersiz — kapsam dışı). TEMBEL: Keşfet açılışı
     sorgu ATMAZ (Rafından anlık kalsın, kota kullanıcı niyetine harcansın);
     kullanıcı "Yeni kitapları getir" der ya da taze önbellek varsa (ağ maliyeti
     sıfır) doğrudan gösterilir. Sorgular window.__ara üzerinden (canliAra ile
     AYNI kaynak yolu — kopya istemci yok). */
  const B_ONBELLEK = 'kk_kesfet_b_v1';
  /* TTL 24 saat: Google kotası günlük, yazar kataloğu günlük değişmez. Anahtar
     İMZA sorgu setinden (yazar+seri katla'lı) — kütüphane değişip sinyal seti
     değişirse önbellek kendiliğinden düşer. Cihaz-yerel, senkron DIŞI
     (türetilmiş veri DERIVED yazılmaz — W1 ilkesi). */
  const B_TTL_MS = 24 * 3600 * 1000;
  /* Kota: koşum başına ≤3 yazar + ≤3 seri sorgusu (≤6 istek). Google 1000/gün;
     24 saatlik önbellekle gün başına tek sorgu seti — kota güvenli. */
  const B_YAZAR_KOTA = 3, B_SERI_KOTA = 3, B_YAZAR_ADAY = 3, B_SERI_ADAY = 4;
  const B = { durum: 'bekliyor', adaylar: null, gorunen: [] };

  function isbnTemiz(s){
    // barkod.js ihraçlı temizleyici; eklenti yüklenmemişse aynı kural (emniyet)
    return (window.__barkod && window.__barkod.isbnTemizle)
      ? window.__barkod.isbnTemizle(s)
      : String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase();
  }
  /* Anahtar HER ZAMAN ad|yazar (araTekillestir emsali) — ISBN-öncelikli anahtar
     iki edisyonu iki satır yapıyor ve gizlemeyi edisyon değişiminde deliyordu
     (v51 inceleme K1/K2). ISBN eleme kütüphane karşılaştırmasında AYRICA yaşar. */
  function bAnahtar(a){
    return katla(a.ad) + '|' + katla(a.yazar || '');
  }
  function bImza(){
    const M = window.__oneri;
    return JSON.stringify([
      M.sevilenYazarlar().slice(0, B_YAZAR_KOTA).map(y => katla(y.ad)),
      M.eksikSeriler().slice(0, B_SERI_KOTA).map(s => katla(s.seri))]);
  }
  function bOnbellekOku(){
    try{
      const v = JSON.parse(localStorage.getItem(B_ONBELLEK) || 'null');
      if(!v || !Array.isArray(v.adaylar)) return null;
      if(v.imza !== bImza() || (Date.now() - v.t) > B_TTL_MS) return null;
      return v.adaylar;
    }catch(e){ return null; }
  }
  /* Eleme HER ÇİZİMDE taze: kütüphanede olan (ad+yazar TR-katlamalı VE ISBN),
     gizlenen ve yinelenen adaylar düşer. Önbellek HAM aday saklar — kitap
     eklenince/gizlenince liste sorgusuz güncellenir. */
  function bElenmis(){
    const adSet = new Set(), isbnSet = new Set();
    (veri.kitaplar || []).forEach(k => {
      adSet.add(katla(k.ad) + '|' + katla(k.yazar || ''));
      if(k.isbn){ const t = isbnTemiz(k.isbn); if(t) isbnSet.add(t); }
    });
    const gizli = veri.kesfetGizli || {};
    const gorulen = new Set();
    return (B.adaylar || []).filter(a => {
      if(!a || !a.ad) return false;
      const anah = bAnahtar(a);
      if(gorulen.has(anah)) return false;
      gorulen.add(anah);
      if(adSet.has(katla(a.ad) + '|' + katla(a.yazar || ''))) return false;
      const t = a.isbn ? isbnTemiz(a.isbn) : '';
      if(t && isbnSet.has(t)) return false;
      if(gizli[anah]) return false;
      return true;
    });
  }
  async function bGetir(){
    const M = window.__oneri, A = window.__ara;
    if(!M || !A || B.durum === 'yukleniyor') return;
    B.durum = 'yukleniyor';
    if(typeof durum === 'object' && durum.sekme === 'kesfet') ciz();
    // imza sorgu BAŞINDA dondurulur (inceleme K4): yükleme sırasında kütüphane
    // değişirse eski sinyalle çekilen adaylar yeni imzayla mühürlenmesin
    const imza = bImza();
    const yazarlar = M.sevilenYazarlar().slice(0, B_YAZAR_KOTA);
    const seriler = M.eksikSeriler().slice(0, B_SERI_KOTA);
    // zaman aşımı canliAra ile aynı: 9 sn (inceleme K3 — asılı fetch süresiz
    // "yükleniyor"da bırakıyordu)
    const ctl = new AbortController();
    const zam = setTimeout(() => ctl.abort(), 9000);
    let hataOldu = false;
    const dene = p => p.catch(() => { hataOldu = true; return []; });
    const adaylar = [];
    // EN GÜÇLÜ sinyal önce: eksik seri sorguları liste başında
    for(const s of seriler){
      const q = s.yazar ? '"' + s.seri + '" inauthor:"' + s.yazar + '"' : '"' + s.seri + '"';
      (await dene(A.google(q, null, ctl.signal))).slice(0, B_SERI_ADAY)
        .forEach(a => adaylar.push({ ...a, neden: s.cumle }));
    }
    for(const y of yazarlar){
      (await dene(A.google(y.ad, 'yazar', ctl.signal))).slice(0, B_YAZAR_ADAY)
        .forEach(a => adaylar.push({ ...a, neden: y.cumle }));
    }
    clearTimeout(zam);
    if(!adaylar.length && hataOldu){
      B.durum = 'hata';   // hiç sonuç yok VE ağ düştü → dürüst hata; kısmi sonuç gösterilir
    }else{
      B.adaylar = adaylar;
      B.durum = 'hazir';
      try{ localStorage.setItem(B_ONBELLEK,
        JSON.stringify({ imza, t: Date.now(), adaylar })); }catch(e){}
    }
    if(typeof durum === 'object' && durum.sekme === 'kesfet') ciz();
  }
  function bSatirHtml(a, i){
    return '<div class="ks-b-item">' +
      (typeof ktPlate === 'function'
        ? ktPlate({ ad: a.ad, yazar: a.yazar || '', kapak: a.kapak || null }, 'p-mini') : '') +
      '<div class="ks-ic">' +
        '<span class="ks-b-ad">' + esc(a.ad) + '</span>' +
        (a.yazar ? '<div class="ks-b-yazar">' + esc(a.yazar) + '</div>' : '') +
        '<div class="ks-b-neden">' + esc(a.neden || '') + '</div>' +
        '<div class="ks-eylem">' +
          '<button class="ks-b-ekle" data-act="ks-b-ekle" data-i="' + i + '">İstek listeme ekle</button>' +
          '<button class="ks-b-gizle" data-act="ks-b-gizle" data-i="' + i + '">İlgilenmiyorum</button>' +
        '</div>' +
      '</div></div>';
  }
  function bBolumHtml(){
    const M = window.__oneri;
    if(!M || !M.sevilenYazarlar) return '';
    const sinyalVar = M.sevilenYazarlar().length || M.eksikSeriler().length;
    let ic;
    if(!sinyalVar){
      // yetersiz veri: sorgu da atılmaz — uydurma öneri YOK
      ic = '<div class="ks-b-not">Yeni kitap önerisi için önce sinyal gerek: bir yazarın ' +
        'kitabını bitirip 8 ve üzeri puan ver ya da bir serinin ciltlerini kütüphanene işle.</div>';
    }else{
      if(B.durum === 'bekliyor'){
        const c = bOnbellekOku();
        if(c){ B.adaylar = c; B.durum = 'hazir'; }   // taze önbellek: ağ maliyeti sıfır
      }
      if(B.durum === 'bekliyor'){
        ic = '<div class="ks-b-not">Sevdiğin yazarların ve eksik serilerinin kütüphanende ' +
          'OLMAYAN kitapları kaynaklardan sorulur — sen istemeden sorgu atılmaz.</div>' +
          '<button class="btn btn-cerceve ks-b-getir" data-act="ks-b-getir">Yeni kitapları getir</button>';
      }else if(B.durum === 'yukleniyor'){
        ic = '<div class="ks-b-not">Kaynaklara soruluyor…</div>';
      }else if(B.durum === 'hata'){
        ic = '<div class="ks-b-not">İnternete ulaşılamadı — yeni kitap önerileri şimdilik yok; ' +
          'rafından öneriler etkilenmez.</div>' +
          '<button class="btn btn-cerceve ks-b-getir" data-act="ks-b-getir">Yeniden dene</button>';
      }else{
        B.gorunen = bElenmis();
        ic = B.gorunen.length
          ? B.gorunen.map(bSatirHtml).join('')
          : '<div class="ks-b-not">Kaynaklarda kütüphanende olmayan yeni bir şey bulunamadı.</div>';
      }
    }
    return '<div class="ks-b" id="ksB">' +
      '<div class="ks-b-bas"><span class="kicker">Yeni kitaplar</span></div>' + ic + '</div>';
  }
  function bEkle(i){
    const a = B.gorunen[+i];
    if(!a || typeof kitapNormalize !== 'function' || typeof uid !== 'function') return;
    // katalog.js kodIsle emsali: normalize + push + depoKaydet + hepsiniCiz
    const yeni = kitapNormalize({ id: uid(), ad: a.ad, yazar: a.yazar || '',
      yayinevi: a.yayinevi || '', yil: a.yil || null, sayfa: a.sayfa || null,
      kapak: a.kapak || null, isbn: a.isbn || '', durum: 'okunacak',
      sahiplik: 'istek', eklenme: Date.now(), g: Date.now() });
    veri.kitaplar.push(yeni);
    depoKaydet();
    if(typeof toast === 'function') toast('İstek listene eklendi');
    if(typeof hepsiniCiz === 'function') hepsiniCiz();   // sarmalama Keşfet'i tazeler
    ciz();
  }
  function bGizle(i){
    const a = B.gorunen[+i];
    if(!a) return;
    veri.kesfetGizli = veri.kesfetGizli || {};
    veri.kesfetGizli[bAnahtar(a)] = Date.now();   // kalıcı tercih; senkronda union
    depoKaydet();
    if(typeof toast === 'function') toast('Bir daha önerilmeyecek');
    ciz();
  }

  function ciz(){
    const kap = document.getElementById('ksIcerik');
    if(!kap || !window.__oneri || !window.__oneri.hesaplaHam) return;
    const M = window.__oneri;
    const h = M.hesaplaHam();
    const havuz = S.sahiplik === 'istek' ? h.istek : h.sahip;

    // süzgeç seçenekleri adayların KENDİ değerlerinden (uydurma seçenek yok)
    const turler = [...new Set(havuz.map(o => o.kitap.tur).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'tr'));
    const raflar = [...new Set(havuz.map(o => o.kitap.raf).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'tr'));
    if(S.tur && turler.indexOf(S.tur) < 0) S.tur = null;   // aday kalmadıysa süzgeç düşer
    if(S.raf && raflar.indexOf(S.raf) < 0) S.raf = null;

    const filtreli = havuz.filter(o => {
      const k = o.kitap;
      if(S.tur && k.tur !== S.tur) return false;
      if(S.raf && k.raf !== S.raf) return false;
      if(S.uzunluk && uzunlukKova(k.sayfa) !== S.uzunluk) return false;
      return true;
    });

    // az-veri: bekleme sırası korunur (çeşitlilik kotası skor listesi içindir)
    const secilen = h.mod === 'az-veri'
      ? filtreli.slice(0, S.limit)
      : M.cesitlilikSec(filtreli, S.limit);
    M.nedenAta(secilen);

    // "daha fazla" DÜRÜST: bir sonraki adım gerçekten yeni öğe getirecekse görünür
    const sonrakiN = h.mod === 'az-veri'
      ? Math.min(filtreli.length, S.limit + SAYFA_ADIMI)
      : M.cesitlilikSec(filtreli, S.limit + SAYFA_ADIMI).length;
    const dahaVar = sonrakiN > secilen.length;

    const skorlar = secilen.map(o => o.skor).filter(s => s !== null);
    const enY = skorlar.length ? Math.max.apply(null, skorlar) : 0;
    const enD = skorlar.length ? Math.min.apply(null, skorlar) : 0;

    const erteliler = (typeof veri === 'object' ? veri.kitaplar : [])
      .filter(k => k.durum === 'okunacak' && M.ertelemeAktif(k));

    let html = ustHtml(h, havuz.length, filtreli.length);
    html += suzgecHtml(turler, raflar);
    if(h.mod === 'az-veri')
      html += '<div class="ks-not">Henüz kişisel öneri için yeterli veri yok: puan verdiğin ' +
        'bitmiş kitap sayısı ' + h.puanliSayi + ' (en az ' + h.esik + ' gerekir). ' +
        'Kitap bitirip puanladıkça bu liste sana göre şekillenir.' +
        (secilen.length ? ' Şimdilik en uzun süredir bekleyenler:' : '') + '</div>';
    if(!secilen.length){
      // boş-durum metni SAHİPLİK moduna göre (inceleme K2: istek modunda
      // "rafına kitap ekle" yanıltıcıydı)
      html += '<div class="ks-not">' + (havuz.length
        ? 'Bu süzgeçlerle eşleşen aday kalmadı — bir süzgeci kaldırmayı dene.'
        : S.sahiplik === 'istek'
          ? 'İstek listende bekleyen kitap yok.'
          : 'Okunacak listende önerilebilecek kitap yok — rafına kitap ekle, ya da ' +
            '"Şimdi değil" dediklerin ' + M.ERTELEME_GUN + ' gün sonra geri gelir.') + '</div>';
    }else{
      html += secilen.map(o => satirHtml(o, enY, enD)).join('');
      if(dahaVar)
        html += '<button class="btn btn-cerceve ks-daha" data-act="ks-daha">Daha fazla göster</button>';
    }
    if(erteliler.length){
      html += '<div class="ks-erteli"><button class="ks-sessiz" data-act="ks-erteli">' +
        erteliler.length + ' kitabı ertelemiştin — ' + (S.erteliAcik ? 'gizle' : 'göster') + '</button>' +
        (S.erteliAcik ? erteliler.map(k => {
          const kalan = Math.max(0, M.ERTELEME_GUN - gunFarki(k.ertelemeTarihi, bugun()));
          return '<div class="ks-erteli-item"><span class="ks-erteli-ad">' + esc(k.ad) + '</span>' +
            '<span class="ks-erteli-sag"><span class="ks-erteli-gun">' + kalan + ' gün sonra döner</span>' +
            '<button class="ks-basla" data-act="ks-geri-al" data-id="' + escAttr(k.id) + '">Geri al</button>' +
            '</span></div>';
        }).join('') : '') + '</div>';
    }
    html += bBolumHtml();   // v51: YENİ KİTAPLAR — Rafından'ın altında, kıl payı ayraçlı
    kap.innerHTML = html;
    if(typeof ktPlateHata === 'function') ktPlateHata(kap);   // levha kapakları tek yedek yoluna (v44)
  }

  function baslat(){
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    /* Bayat-panel panzehiri: veri değişince (detaydan bitir/sil, senkron...)
       Keşfet açıksa yeniden çizilir — çekirdek hepsiniCiz sarmalanır
       (çekirdek eklentiyi bilmez; kesfet.js kendi tazeliğinden sorumlu). */
    if(typeof window.hepsiniCiz === 'function'){
      const cekirdek = window.hepsiniCiz;
      window.hepsiniCiz = function(){
        cekirdek();
        if(typeof durum === 'object' && durum.sekme === 'kesfet') ciz();
      };
    }

    // ?sekme=kesfet derin bağlantısı: sekmeGec bu betik yüklenmeden koştu —
    // açılışta Keşfet aktifse ilk çizimi burada yap (inceleme K1).
    if(typeof durum === 'object' && durum.sekme === 'kesfet') ciz();

    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if(!el) return;
      switch(el.dataset.act){
        case 'sekme':
          // sekmeGec bittikten sonra taze çizim (ampul düğmesi de bu yoldan gelir)
          if(el.dataset.v === 'kesfet') setTimeout(ciz, 0);
          break;
        case 'ks-suz': {
          const g = el.dataset.g, v = el.dataset.v;
          if(g === 'sahiplik') S.sahiplik = v;
          else S[g] = (S[g] === v) ? null : v;   // toggle: seçiliye bas → kaldır
          S.limit = SAYFA_ADIMI;
          ciz(); break; }
        case 'ks-daha': S.limit += SAYFA_ADIMI; ciz(); break;
        case 'ks-erteli': S.erteliAcik = !S.erteliAcik; ciz(); break;
        case 'ks-basla':
          if(window.__oneri && window.__oneri.basla(el.dataset.id) &&
             typeof hepsiniCiz === 'function') hepsiniCiz();
          ciz(); break;
        case 'ks-ertele':
          if(window.__oneri && window.__oneri.ertele(el.dataset.id) &&
             typeof hepsiniCiz === 'function') hepsiniCiz();
          ciz(); break;
        case 'ks-geri-al':
          if(window.__oneri && window.__oneri.erteleGeriAl(el.dataset.id) &&
             typeof hepsiniCiz === 'function') hepsiniCiz();
          ciz(); break;
        case 'ks-b-getir': bGetir(); break;
        case 'ks-b-ekle': bEkle(el.dataset.i); break;
        case 'ks-b-gizle': bGizle(el.dataset.i); break;
      }
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
  else baslat();

  window.__kesfet = { ciz };   // test/tanı kancası
})();
