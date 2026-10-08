'use strict';
/* ses.js — SESLİ OKUMA (so-, v132). Kitap detayında Özet, Ontoloji ve
   Notlar & alıntılar bölümlerine "Dinle".

   KARARLAR
   · Yalnız tarayıcının Web Speech API'si (speechSynthesis), tr-TR ses. Dış
     servis, anahtar, ücretli ses YOK — çevrimdışı da çalışır (cihaz sesi).
   · Birim = ekranda görünen PARAGRAF (<p>). Metin mdMini'nin kendi paragraf
     kuralıyla (boş satır = ayraç) ham metinden kurulur → ekrandaki <p> ile
     birebir hizalı; vurgu ve "dokun, buradan başla" bu hizaya dayanır.
   · Paragraf da tek parça verilmez: cümle sınırından PARCA_TAVAN karakterlik
     parçalara bölünür. Neden: Chrome (masaüstü, uzak sesler) ~15 sn'yi aşan
     tek konuşmayı SESSİZCE kesiyor; Android'de de uzun tek konuşma bekçiyle
     yeniden başlatılırsa baştan okunurdu — kısa parça kaybı küçük tutar.
   · DURAKLAT = cancel + konumu hatırla (pause()/resume() DEĞİL): Android
     Chrome'da speechSynthesis.pause() bazı sürümlerde hiçbir şey yapmıyor,
     resume() takılı kalabiliyor. Devam aynı parçanın başından konuşur.
   · Tek oturum: her başlangıç önce cancel(); her konuşmanın bir JETONU var,
     iptal edilmiş konuşmanın geç gelen onend/onerror'ı ilerletmez (iki okuma
     üst üste binmez, eski konuşma sırayı kaydırmaz).
   · Durma: detay kapanınca, başka kitap açılınca, Özet↔Ontoloji sekmesi
     değişince, okunan metin değişince (düzenleme) — MutationObserver ile
     DOM'un kendisinden okunur; tek tek kapanış yollarına kanca atılmaz
     (ortuDetay'ı kapatan 6+ yol var, biri unutulurdu).
   · Paragrafa dokunma yalnız AÇIK bir okuma oturumunda (oynuyor/duraklatıldı)
     o paragrafa atlar — boşta metne dokunmak (seçme, kaydırma) ses başlatmaz.
   · Arka plan / ekran kilidi: davranış tarayıcıya ait ve cihazda ÖLÇÜLMELİ.
     Bekçi: görünür olunca oturum "oynuyor" ama motor susmuşsa kaldığı
     parçadan yeniden konuşur. Tanı günlüğü (kk_ses_gunluk_v1) son oturumun
     olaylarını zaman damgasıyla tutar; detayda "Okuma tanısı" altında. */
(function(){
  const HIZ_ANAHTAR = 'kk_ses_hiz_v1';
  const GUNLUK_ANAHTAR = 'kk_ses_gunluk_v1';
  const HIZLAR = [0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5];
  const PARCA_TAVAN = 180;
  const GUNLUK_TAVAN = 200;
  const SES_BEKLE_MS = 1500;   // getVoices boş dönerse voiceschanged için azami bekleme
  const KAYNAK_AD = { m: 'özet', o: 'ontoloji', n: 'notlar' };

  const motor = () => (typeof window.speechSynthesis === 'object' && window.speechSynthesis) || null;

  /* ---------- metin ---------- */
  /* Okunacak düz metin: markdown işaretleri (** * # > -) gider, METİN kalır;
     satır sonu noktalama yoksa nokta konur — tek satırlık kalın başlık
     ("**Konu**") sonraki cümleyle birleşip tek nefeste okunmasın. */
  function sesMetni(ham){
    const satirlar = String(ham ?? '').replace(/\r\n?/g, '\n').split('\n')
      .map(s => s
        .replace(/^\s{0,3}#{1,6}\s*/, '')      // başlık işareti
        .replace(/^\s*>\s?/, '')               // alıntı işareti
        .replace(/^\s*[-+•]\s+/, '')           // madde işareti
        .replace(/^\s*\*\s+/, '')              // "* " maddesi
        .replace(/\*\*([\s\S]*?)\*\*/g, '$1')  // kalın
        .replace(/\*([^\n]*?)\*/g, '$1')       // italik
        .replace(/\*+/g, '')                   // kapanmamış / tek yıldız
        .replace(/__/g, '')
        .replace(/(^|\s)#+(?=\s|$)/g, '$1')    // tek başına kalan # dizileri
        .replace(/[ \t]+/g, ' ').trim())
      .filter(Boolean);
    let cikti = '';
    for(const s of satirlar){
      if(!cikti){ cikti = s; continue; }
      cikti += (/[.!?…:;,]["'”’»)]*$/.test(cikti) ? ' ' : '. ') + s;
    }
    return cikti;
  }
  /* mdMini'nin paragraf kuralı (index.html): bir ya da daha çok boş satır */
  function paragraflar(ham){
    return String(ham ?? '').replace(/\r\n?/g, '\n').split(/\n(?:[ \t]*\n)+/)
      .map(p => p.trim()).filter(Boolean);
  }
  /* Cümle sınırından ≤ PARCA_TAVAN parçalar; tek cümle tavanı aşarsa virgül,
     o da yoksa boşluk sınırından bölünür. Hiçbir karakter kaybolmaz. */
  function parcala(metin){
    const t = String(metin || '').trim();
    if(!t) return [];
    if(t.length <= PARCA_TAVAN) return [t];
    const cumleler = t.match(/[^.!?…]+(?:[.!?…]+["'”’»)]*)?\s*/g) || [t];
    const parcalar = [];
    let tampon = '';
    const it = s => {
      if(!s) return;
      if((tampon + s).length <= PARCA_TAVAN){ tampon += s; return; }
      if(tampon.trim()) parcalar.push(tampon.trim());
      tampon = '';
      if(s.length <= PARCA_TAVAN){ tampon = s; return; }
      /* uzun cümle: virgül/boşluk sınırından */
      let kalan = s;
      while(kalan.length > PARCA_TAVAN){
        let kes = kalan.lastIndexOf(', ', PARCA_TAVAN);
        if(kes < PARCA_TAVAN / 3) kes = kalan.lastIndexOf(' ', PARCA_TAVAN);
        if(kes < 1) kes = PARCA_TAVAN;
        else kes += 1;
        parcalar.push(kalan.slice(0, kes).trim());
        kalan = kalan.slice(kes);
      }
      tampon = kalan;
    };
    cumleler.forEach(it);
    if(tampon.trim()) parcalar.push(tampon.trim());
    return parcalar.filter(Boolean);
  }

  /* ---------- ses seçimi ---------- */
  let sesler = [], seslerBilinir = false;
  function sesleriOku(){
    const s = motor();
    try{ sesler = s ? (s.getVoices() || []) : []; }catch(e){ sesler = []; }
    if(sesler.length) seslerBilinir = true;
  }
  function trSes(){
    const tr = sesler.filter(v => v && /^tr([-_]|$)/i.test(String(v.lang || '')));
    return tr.find(v => v.localService && v.default) || tr.find(v => v.localService) || tr.find(v => v.default) || tr[0] || null;
  }
  /* 'yok-api' | 'bekleniyor' | 'yok-tr' | 'var' */
  function sesDurumu(){
    if(!motor() || typeof window.SpeechSynthesisUtterance !== 'function') return 'yok-api';
    if(!seslerBilinir) return 'bekleniyor';
    return trSes() ? 'var' : 'yok-tr';
  }

  /* ---------- hız ---------- */
  function hizOku(){
    let v = 1;
    try{ v = parseFloat(localStorage.getItem(HIZ_ANAHTAR)); }catch(e){}
    return HIZLAR.indexOf(v) >= 0 ? v : 1;
  }
  function hizYaz(v){ try{ localStorage.setItem(HIZ_ANAHTAR, String(v)); }catch(e){} }

  /* ---------- tanı günlüğü ---------- */
  let gunluk = [];
  try{ const g = JSON.parse(localStorage.getItem(GUNLUK_ANAHTAR) || '[]'); if(Array.isArray(g)) gunluk = g; }catch(e){}
  function kaydet(olay, ek){
    const g = { t: Date.now(), olay };
    if(ek !== undefined && ek !== null && ek !== '') g.ek = String(ek).slice(0, 80);
    if(document.visibilityState) g.gorunur = document.visibilityState === 'visible' ? 1 : 0;
    gunluk.push(g);
    if(gunluk.length > GUNLUK_TAVAN) gunluk = gunluk.slice(-GUNLUK_TAVAN);
    try{ localStorage.setItem(GUNLUK_ANAHTAR, JSON.stringify(gunluk)); }catch(e){}
  }
  function gunlukMetni(){
    if(!gunluk.length) return '';
    const t0 = gunluk[0].t;
    const ilk = new Date(t0);
    const pad = n => String(n).padStart(2, '0');
    return 'Başlangıç ' + pad(ilk.getHours()) + ':' + pad(ilk.getMinutes()) + ':' + pad(ilk.getSeconds()) +
      ' · ' + (navigator.userAgent || '') + (window.matchMedia && matchMedia('(display-mode: standalone)').matches ? ' · KURULU PWA' : ' · tarayıcı sekmesi') + '\n' +
      gunluk.map(g => '+' + ((g.t - t0) / 1000).toFixed(1) + ' sn  ' + g.olay + (g.ek ? ' (' + g.ek + ')' : '') +
        (g.gorunur === 0 ? '  [arka plan]' : '')).join('\n');
  }

  /* ---------- kaynaklar: ekrandaki paragraflar ---------- */
  /* Dönen: { kap, birimler: [{ el, metin }] } ya da null (kaynak ekranda yok). */
  function kaynakTopla(kaynak){
    if(typeof durum !== 'object' || !durum.detayId) return null;
    const id = durum.detayId;
    if(kaynak === 'm' || kaynak === 'o'){
      const kap = document.querySelector(kaynak === 'm' ? '#detayIcerik #dOzetBlok > .oz-metin' : '#detayIcerik #dOntoBlok > .onto-metin');
      if(!kap || !window.__ozet) return null;
      const ham = kaynak === 'm' ? window.__ozet.oku(id) : window.__ozet.okuOnto(id);
      const ps = Array.from(kap.children).filter(e => e.tagName === 'P');
      const pr = paragraflar(ham);
      const birimler = ps.map((el, i) => ({ el, metin: sesMetni(pr.length === ps.length ? pr[i] : el.textContent) }))
        .filter(b => b.metin);
      return birimler.length ? { kap, birimler } : null;
    }
    if(kaynak === 'n'){
      const kartlar = Array.from(document.querySelectorAll('#detayIcerik .not-kart[data-nid]'));
      if(!kartlar.length || typeof kitapBul !== 'function') return null;
      const k = kitapBul(id);
      const birimler = [];
      for(const kart of kartlar){
        const n = k && (k.notlar || []).find(x => String(x.id) === kart.dataset.nid);
        const ps = Array.from(kart.querySelectorAll('.not-metin > p'));
        const pr = paragraflar(n ? n.metin : '');
        ps.forEach((el, i) => {
          const metin = sesMetni(pr.length === ps.length ? pr[i] : el.textContent);
          if(metin) birimler.push({ el, metin });
        });
      }
      return birimler.length ? { kap: kartlar[0].parentElement, birimler } : null;
    }
    return null;
  }
  function imza(birimler){ return birimler.map(b => b.metin).join('\u0001'); }

  /* ---------- oturum ---------- */
  let ot = null;     // { kaynak, kitapId, sekme, imza, birimler:[{metin, parcalar}], i, j, durum, sonOlay }
  let jetonSayac = 0, aktifJeton = 0;
  const vurguSinif = 'so-okunan';

  function vurgula(){
    document.querySelectorAll('#detayIcerik .' + vurguSinif).forEach(e => e.classList.remove(vurguSinif));
    document.querySelectorAll('#detayIcerik .so-p').forEach(e => { e.classList.remove('so-p'); delete e.dataset.soI; });
    if(!ot) return;
    const t = kaynakTopla(ot.kaynak);
    if(!t) return;
    t.birimler.forEach((b, i) => { b.el.classList.add('so-p'); b.el.dataset.soI = String(i); });
    const el = t.birimler[ot.i] && t.birimler[ot.i].el;
    if(el){
      el.classList.add(vurguSinif);
      if(ot.kaydirilan !== ot.i){   // aynı paragrafta tekrar kaydırma yok (kullanıcı elle kaydırabilsin)
        ot.kaydirilan = ot.i;
        try{ el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }catch(e){ try{ el.scrollIntoView(); }catch(e2){} }
      }
    }
  }

  /* ---------- ekran uyanık tutma (v135, Screen Wake Lock) ----------
     Okuma sürerken ekran kendiliğinden kararmasın: "oynuyor" + sayfa görünür
     iken kilit istenir; duraklat/durdur/bitiş ve sayfa gizlenince bırakılır,
     görünür olup okuma sürüyorsa yeniden istenir. Tarayıcı kilidi gizlenmede
     KENDİSİ de bırakır (release olayı) — ikisi de günlüğe girer. Destek yoksa
     (eski tarayıcı, güvensiz bağlam) okuma aynen sürer; yalnız günlüğe yazılır,
     oturum başına bir kez. İstek asenkron: yanıt geldiğinde koşul bozulmuşsa
     (duraklatıldı, gizlendi) kilit hemen geri verilir — sızıntı olmaz. */
  let kilit = null, kilitIstekte = false;
  function kilitUygun(){
    return !!ot && ot.durum === 'oynuyor' && document.visibilityState === 'visible';
  }
  function kilitAl(){
    if(!kilitUygun() || kilit || kilitIstekte) return;
    const wl = navigator.wakeLock;
    if(!wl || typeof wl.request !== 'function'){
      if(!ot.kilitYok){ ot.kilitYok = true; kaydet('ekran kilidi: destek yok'); }
      return;
    }
    kilitIstekte = true;
    let p;
    try{ p = wl.request('screen'); }catch(e){ p = Promise.reject(e); }
    Promise.resolve(p).then(l => {
      kilitIstekte = false;
      if(!l) return;
      if(!kilitUygun()){ try{ l.release(); }catch(e){} return; }
      kilit = l;
      try{
        l.addEventListener('release', () => {
          if(kilit !== l) return;          // bizim bıraktığımız: zaten yazıldı
          kilit = null;
          if(ot) kaydet('ekran kilidi: tarayıcı bıraktı');
        });
      }catch(e){}
      kaydet('ekran uyanık');
    }, e => {
      kilitIstekte = false;
      if(ot) kaydet('ekran kilidi: reddedildi', (e && (e.name || e.message)) || 'hata');
    });
  }
  function kilitBirak(sebep){
    if(!kilit) return;
    const l = kilit;
    kilit = null;
    try{ const r = l.release(); if(r && r.catch) r.catch(() => {}); }catch(e){}
    kaydet('ekran kilidi bırakıldı', sebep);
  }

  function konus(){
    const s = motor();
    if(!ot || !s) return;
    const b = ot.birimler[ot.i];
    if(!b){ bitir('bitti'); return; }
    const parca = b.parcalar[ot.j];
    if(parca === undefined){ bitir('bitti'); return; }
    const jeton = aktifJeton = ++jetonSayac;
    try{ s.cancel(); }catch(e){}
    const u = new window.SpeechSynthesisUtterance(parca);
    u.lang = 'tr-TR';
    const v = trSes();
    if(v) u.voice = v;
    u.rate = hizOku();
    u.onstart = () => { if(jeton !== aktifJeton || !ot) return; ot.sonOlay = Date.now(); kaydet('başladı', (ot.i + 1) + '.' + (ot.j + 1)); };
    u.onend = () => {
      if(jeton !== aktifJeton || !ot || ot.durum !== 'oynuyor') return;
      ot.sonOlay = Date.now();
      kaydet('bitti', (ot.i + 1) + '.' + (ot.j + 1));
      ilerle();
    };
    u.onerror = e => {
      const hata = (e && e.error) || 'hata';
      if(jeton !== aktifJeton || !ot) return;   // iptal edilmiş konuşmanın geç olayı
      kaydet('hata', hata);
      if(hata === 'interrupted' || hata === 'canceled') return;   // bilinçli iptal — ilerletme
      if(ot.durum !== 'oynuyor') return;
      ot.sonOlay = Date.now();
      ilerle();   // tek parça okunamadıysa takılma, sonrakine geç
    };
    ot.sonOlay = Date.now();
    vurgula();
    try{ s.speak(u); }catch(e){ kaydet('hata', 'speak: ' + (e && e.message)); bitir('hata'); }
  }
  function ilerle(){
    if(!ot) return;
    ot.j++;
    if(ot.j >= ot.birimler[ot.i].parcalar.length){ ot.i++; ot.j = 0; }
    if(ot.i >= ot.birimler.length){ bitir('bitti'); return; }
    konus();
  }
  function baslat(kaynak, sira){
    if(sesDurumu() !== 'var') return false;
    const t = kaynakTopla(kaynak);
    if(!t) return false;
    durdur('yeni okuma');   // tek oturum: önceki her ne ise biter
    gunluk = [];
    ot = { kaynak, kitapId: durum.detayId, sekme: durum.sekme, imza: imza(t.birimler),
      birimler: t.birimler.map(b => ({ metin: b.metin, parcalar: parcala(b.metin) })),
      i: Math.max(0, Math.min(t.birimler.length - 1, parseInt(sira) || 0)), j: 0, durum: 'oynuyor', sonOlay: Date.now() };
    kaydet('oturum', KAYNAK_AD[kaynak] + ' · ' + ot.birimler.length + ' paragraf · hız ' + hizOku());
    konus();
    kilitAl();
    cubuklariCiz();
    return true;
  }
  function duraklat(){
    if(!ot || ot.durum !== 'oynuyor') return;
    ot.durum = 'duraklatildi';
    aktifJeton = ++jetonSayac;   // çalan konuşmanın geç onend'i ilerletmesin
    try{ motor() && motor().cancel(); }catch(e){}
    kaydet('duraklat', (ot.i + 1) + '.' + (ot.j + 1));
    kilitBirak('duraklat');
    cubuklariCiz();
  }
  function devam(){
    if(!ot || ot.durum !== 'duraklatildi') return;
    ot.durum = 'oynuyor';
    kaydet('devam', (ot.i + 1) + '.' + (ot.j + 1));
    konus();
    kilitAl();
    cubuklariCiz();
  }
  function atla(sira){
    if(!ot) return;
    ot.i = Math.max(0, Math.min(ot.birimler.length - 1, sira)); ot.j = 0;
    ot.durum = 'oynuyor';
    kaydet('atla', String(ot.i + 1));
    konus();
    kilitAl();
    cubuklariCiz();
  }
  function bitir(sebep){
    if(!ot) return;
    kaydet(sebep === 'bitti' ? 'sona erdi' : 'durdu', sebep);
    kilitBirak(sebep);
    ot = null;
    aktifJeton = ++jetonSayac;
    vurgula();
    cubuklariCiz();
  }
  function durdur(sebep){
    if(!ot) return;
    aktifJeton = ++jetonSayac;
    try{ motor() && motor().cancel(); }catch(e){}
    bitir(sebep || 'durdur');
  }

  /* ---------- denetçi: oturum hâlâ geçerli mi? ---------- */
  function gecerlilik(){
    if(!ot) return '';
    const ortu = document.getElementById('ortuDetay');
    if(!ortu || !ortu.classList.contains('acik')) return 'detay kapandı';
    if(typeof durum !== 'object' || durum.detayId !== ot.kitapId) return 'başka kitap açıldı';
    if(durum.sekme !== ot.sekme) return 'sekme değişti';
    const t = kaynakTopla(ot.kaynak);
    if(!t) return ot.kaynak === 'n' ? 'notlar kalktı' : 'sekme değişti';
    if(imza(t.birimler) !== ot.imza) return 'metin değişti';
    return '';
  }
  let denetimBekliyor = false;
  function denetle(){
    if(denetimBekliyor) return;
    denetimBekliyor = true;
    setTimeout(() => {
      denetimBekliyor = false;
      const neden = gecerlilik();
      if(neden){ durdur(neden); return; }
      if(ot) vurgula();
      cubuklariCiz();
    }, 0);
  }

  /* ---------- çubuklar (Dinle / kontroller) ---------- */
  function hizSecHtml(){
    const h = hizOku();
    return '<select class="so-hiz" aria-label="Okuma hızı">' + HIZLAR.map(v =>
      '<option value="' + v + '"' + (v === h ? ' selected' : '') + '>' + String(v).replace('.', ',') + '×</option>').join('') + '</select>';
  }
  function cubukHtml(kaynak){
    const d = sesDurumu();
    if(d === 'bekleniyor') return '';
    if(d === 'yok-api') return '<span class="so-mesaj">Bu tarayıcı sesli okumayı desteklemiyor</span>';
    if(d === 'yok-tr') return '<span class="so-mesaj">Bu cihazda Türkçe ses bulunamadı</span>';
    const bu = ot && ot.kaynak === kaynak;
    if(!bu) return '<button class="so-btn" data-act="so-dinle" data-kaynak="' + kaynak + '">▶ Dinle</button>' + hizSecHtml();
    const oynuyor = ot.durum === 'oynuyor';
    return (oynuyor
        ? '<button class="so-btn" data-act="so-duraklat">⏸ Duraklat</button>'
        : '<button class="so-btn" data-act="so-devam">▶ Devam</button>') +
      '<button class="so-btn" data-act="so-durdur">■ Durdur</button>' + hizSecHtml() +
      '<span class="so-konum">' + (ot.i + 1) + ' / ' + ot.birimler.length + '</span>';
  }
  function taniHtml(kaynak){
    if(!gunluk.length) return '';
    if(ot && ot.kaynak !== kaynak) return '';
    if(!ot && gunlukKaynak() !== kaynak) return '';
    return '<details class="so-tani"><summary>Okuma tanısı (son oturum, ' + gunluk.length + ' olay)</summary>' +
      '<pre class="so-tani-metin">' + escHtml(gunlukMetni()) + '</pre>' +
      '<button class="so-btn" data-act="so-tani-kopya">Kopyala</button></details>';
  }
  function gunlukKaynak(){
    const o = gunluk.find(g => g.olay === 'oturum');
    if(!o || !o.ek) return '';
    for(const [k, ad] of Object.entries(KAYNAK_AD)) if(o.ek.indexOf(ad + ' ·') === 0) return k;
    return '';
  }
  function escHtml(s){ return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

  /* Çubuğun yeri: Özet/Ontoloji → metnin hemen ÜSTÜ; Notlar → "Ekle"
     satırının altı, ilk not kartının üstü. Idempotent: HTML değişmediyse
     DOM'a dokunulmaz (gözlemci döngüsü kurulmasın). */
  function cubukYer(kaynak){
    if(kaynak === 'n'){
      const kart = document.querySelector('#detayIcerik .not-kart[data-nid]');
      return kart ? { ebeveyn: kart.parentElement, once: kart } : null;
    }
    const kap = document.querySelector(kaynak === 'm' ? '#detayIcerik #dOzetBlok > .oz-metin' : '#detayIcerik #dOntoBlok > .onto-metin');
    return kap ? { ebeveyn: kap.parentElement, once: kap } : null;
  }
  function cubuklariCiz(){
    const kok = document.getElementById('detayIcerik');
    if(!kok) return;
    const ortu = document.getElementById('ortuDetay');
    const acik = ortu && ortu.classList.contains('acik');
    for(const kaynak of ['m', 'o', 'n']){
      let c = kok.querySelector('.so-cubuk[data-so-kaynak="' + kaynak + '"]');
      const yer = acik ? cubukYer(kaynak) : null;
      if(!yer){ if(c) c.remove(); continue; }
      const html = cubukHtml(kaynak) + taniHtml(kaynak);
      if(!html){ if(c) c.remove(); continue; }
      if(!c){
        c = document.createElement('div');
        c.className = 'so-cubuk';
        c.dataset.soKaynak = kaynak;
      }
      if(c.nextElementSibling !== yer.once || c.parentElement !== yer.ebeveyn) yer.ebeveyn.insertBefore(c, yer.once);
      if(c.dataset.soHtml !== html){
        const taniAcik = !!c.querySelector('details.so-tani[open]');
        c.innerHTML = html;
        c.dataset.soHtml = html;
        if(taniAcik){ const d = c.querySelector('details.so-tani'); if(d) d.open = true; }
      }
    }
  }

  /* ---------- stil ---------- */
  function stilEkle(){
    if(document.getElementById('soStil')) return;
    const s = document.createElement('style');
    s.id = 'soStil';
    s.textContent = `
      .so-cubuk{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:2px 0 10px}
      .so-btn{margin:0;background:transparent;border:1px solid var(--kontur);border-radius:var(--r-sm);
        color:var(--paper);font-family:var(--sans);font-size:.78rem;padding:6px 12px;min-height:40px;cursor:pointer}
      .so-btn:hover{border-color:var(--brass)}
      .so-cubuk .so-hiz{width:auto;flex:0 0 auto;margin:0;background:transparent;border:1px solid var(--kontur);border-radius:var(--r-sm);
        color:var(--paper);font-size:.78rem;padding:6px 8px;min-height:40px}
      .so-konum{font-size:.72rem;color:var(--muted2);font-variant-numeric:tabular-nums}
      .so-mesaj{font-size:.78rem;color:var(--muted)}
      .so-p{cursor:pointer}
      .so-okunan{background:color-mix(in srgb,var(--brass) 14%,transparent);
        box-shadow:-6px 0 0 color-mix(in srgb,var(--brass) 14%,transparent),6px 0 0 color-mix(in srgb,var(--brass) 14%,transparent);
        border-radius:2px;transition:background .25s}
      .so-tani{flex-basis:100%;font-size:.72rem;color:var(--muted)}
      .so-tani summary{cursor:pointer;padding:4px 0}
      .so-tani-metin{white-space:pre-wrap;word-break:break-word;max-height:30vh;overflow:auto;
        font-family:var(--mono,monospace);font-size:.68rem;line-height:1.45;margin:6px 0}
    `;
    document.head.appendChild(s);
  }

  /* ---------- bağlama ---------- */
  function kur(){
    stilEkle();
    const s = motor();
    if(s){
      sesleriOku();
      const yenile = () => { sesleriOku(); seslerBilinir = true; cubuklariCiz(); };
      try{ s.addEventListener ? s.addEventListener('voiceschanged', yenile) : (s.onvoiceschanged = yenile); }catch(e){}
      setTimeout(() => { if(!seslerBilinir){ sesleriOku(); seslerBilinir = true; cubuklariCiz(); } }, SES_BEKLE_MS);
    }
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      const act = el && el.dataset.act;
      if(act === 'so-dinle'){ baslat(el.dataset.kaynak, 0); return; }
      if(act === 'so-duraklat'){ duraklat(); return; }
      if(act === 'so-devam'){ devam(); return; }
      if(act === 'so-durdur'){ durdur('durdur düğmesi'); return; }
      if(act === 'so-tani-kopya'){
        const m = gunlukMetni();
        try{ navigator.clipboard.writeText(m).then(() => { if(typeof toast === 'function') toast('Tanı kopyalandı'); }); }catch(err){}
        return;
      }
      if(act) return;
      /* oturum açıkken paragrafa dokunma → oradan */
      if(!ot) return;
      const p = e.target.closest('#detayIcerik .so-p');
      if(p && !e.target.closest('a,button,input,textarea,select')){
        const i = parseInt(p.dataset.soI);
        if(!isNaN(i)) atla(i);
      }
    });
    document.addEventListener('change', e => {
      if(!e.target.classList || !e.target.classList.contains('so-hiz')) return;
      const v = parseFloat(e.target.value);
      if(HIZLAR.indexOf(v) < 0) return;
      hizYaz(v);
      kaydet('hız', String(v));
      if(ot && ot.durum === 'oynuyor') konus();   // yeni hız çalan parçadan itibaren
      cubuklariCiz();
    });
    const kok = document.getElementById('detayIcerik');
    const ortu = document.getElementById('ortuDetay');
    if(window.MutationObserver){
      if(kok) new MutationObserver(denetle).observe(kok, { childList: true, subtree: true });
      if(ortu) new MutationObserver(denetle).observe(ortu, { attributes: true, attributeFilter: ['class'] });
    }
    /* yaşam döngüsü: ölçüm için kaydedilir; görünür olunca bekçi */
    const yasam = olay => () => {
      if(!ot) return;
      kaydet(olay, ot.durum);
      if(olay === 'arka plan') kilitBirak('gizlendi');
      if(olay === 'görünür'){ kilitAl(); setTimeout(bekci, 600); }
    };
    document.addEventListener('visibilitychange', () => (document.visibilityState === 'visible' ? yasam('görünür') : yasam('arka plan'))());
    window.addEventListener('pagehide', yasam('pagehide'));
    window.addEventListener('pageshow', yasam('pageshow'));
    document.addEventListener('freeze', yasam('freeze'));
    document.addEventListener('resume', yasam('resume'));
    setInterval(bekci, 4000);
    cubuklariCiz();
  }
  /* BEKÇİ: oturum "oynuyor" ama motor ne konuşuyor ne sırada bekliyor ve son
     olaydan beri 3 sn geçti → motor bizi haber vermeden susturmuş (arka plan,
     ekran kilidi, tarayıcı kesmesi). Kaldığı parçadan yeniden konuş. */
  function bekci(){
    const s = motor();
    if(!ot || ot.durum !== 'oynuyor' || !s) return;
    if(s.speaking || s.pending) return;
    if(Date.now() - (ot.sonOlay || 0) < 3000) return;
    kaydet('bekçi: sessiz motor, yeniden', (ot.i + 1) + '.' + (ot.j + 1));
    konus();
  }

  if(document.getElementById('detayIcerik')) kur();
  else document.addEventListener('DOMContentLoaded', kur);

  window.__ses = {
    sesMetni, paragraflar, parcala, PARCA_TAVAN, HIZLAR,
    durum: () => ot ? { kaynak: ot.kaynak, kitapId: ot.kitapId, i: ot.i, j: ot.j, durum: ot.durum,
      paragraf: ot.birimler.length, metinler: ot.birimler.map(b => b.metin) } : null,
    sesDurumu, baslat, duraklat, devam, durdur, atla, bekci,
    kilitVar: () => !!kilit,
    gunluk: () => gunluk.slice(), gunlukMetni,
    sesleriYenile: () => { sesleriOku(); seslerBilinir = true; cubuklariCiz(); }
  };
})();
