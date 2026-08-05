/* Kitaplık — cihazlar arası senkron eklentisi (Firebase RTDB + anonim kimlik)
   Kendi kendine yeten modül: index.html'de tek satırlık script etiketiyle yüklenir.
   Kart arayüzünü kendi enjekte eder, kendi olaylarını dinler, depoKaydet'i sarmalar. */
'use strict';
(function(){
  const SENKRON_URL = 'https://kitaplik-sync-default-rtdb.europe-west1.firebasedatabase.app';
  const SENKRON_KEY = 'AIzaSyD1G8pR2wKXnekFe_7f-lNyYwHKaH2GRiw';
  const AYAR_ANAHTAR = 'kk_senkron_v1';
  const ANLIK_ANAHTAR = 'kk_senkron_anlik_v1';

  let ayar = null, kimlik = null, zaman = null, calisiyor = false;
  let eskiSurum = false;   // odada daha yeni şema görüldü → bu oturumda senkron durur
  let bekleyen = false;    // senkron uçuştayken kayıt yapıldı → bitince yeniden planla
  let semaDustu = false;   // odaya eski istemci yazmış (şema geriledi) → uyarı satırı
  let semaDusukGecis = false; // düşük şemada BİR tur atlanır; sonraki tur şemayı geri yazar
  let yazimSayaci = 0;     // her depoKaydet'te artar — PUT uçuşunda kayıt yapıldığını yakalar
  let bekleyenIzler = null;// depo yazımı düşen turun izleri: bellek tabanı — bayat disk
                           // tabanı sonraki damgala'da değişmemiş kitapları taze damgalayıp
                           // LWW'de bayat içeriği kazandırırdı (damga enflasyonu)

  const kurulu = () => SENKRON_URL.indexOf('__SYNC') !== 0;
  const kacir = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function ayarYukle(){ try{ return JSON.parse(localStorage.getItem(AYAR_ANAHTAR)) || null; }catch(e){ return null; } }
  function ayarKaydet(a){
    ayar = a;
    try{ a ? localStorage.setItem(AYAR_ANAHTAR, JSON.stringify(a)) : localStorage.removeItem(AYAR_ANAHTAR); }catch(e){}
  }
  function bildir(m){ if(typeof toast === 'function') toast(m); }

  /* ---------- damgalama: depoKaydet sarmalayıcısı ---------- */
  const ANLIK_SURUM = 8;
  /* SEMA_SURUM: PUT gövdesine yazılan VERİ şeması numarası (parmak izi deposu
     sürümü olan ANLIK_SURUM'dan ayrı — o iz biçimi için de artar). Odadaki sema
     yerelden BÜYÜKSE bu istemci eskidir: birleştirme + yazma tümüyle durur.
     "Salt-okur birleşme" bile güvensizdi — eski normalize bilmediği alanları
     budar, budanmış yerel kopya eşit damgada sonraki turda odayı ezerdi. */
  const SEMA_SURUM = 2;   // 2: gsG eklendi — v32 ve öncesi normalize gsG'yi budar
  /* v1'de her kitabın TAM JSON'u parmak izi olarak saklanıyordu: kütüphanenin
     ikinci bir kopyası kadar yer tutuyor, localStorage kotasını iki katına
     yakın hızda dolduruyordu. v2 kısa çift-hash tutar (~20 karakter/kitap).
     v3: kitapNormalize'a kapakYerel eklendi — normalize çıktısı değiştiği için
     TÜM parmak izleri değişir; sürüm artmasaydı ilk açılış bütün kütüphaneyi
     taze damgalar, bayat cihaz güncel düzenlemeleri ezerdi. KURAL: kitapNormalize
     şeması her değiştiğinde bu sürüm de artmalı (göç turu damga basmaz).
     v4: ertelemeTarihi eklendi (öneri motoru "Şimdi değil").
     v5: notlara tekrar* alanları eklendi (aralıklı alıntı tekrarı, tekrar.js).
     v6: kitapParmak notların tekrar* alanlarını dışlar (iz biçimi değişti) —
     otomatik zamanlama damga üretmesin, LWW zehirlenmesin diye.
     v7: notlara ng (not damgası) + kitaba silinenNotlar (not mezar taşı)
     eklendi — dizi birleşimi ve not silme kalıcılığı için (SEMA_SURUM 1).
     v8: kitaba gsG (guncelSayfa damgası) eklendi — düzeltme/sıfırlama senkronda
     korunur, damgalar eşitse koşullu max sürer (SEMA_SURUM 2). */
  function anlikYukle(){
    try{
      const h = JSON.parse(localStorage.getItem(ANLIK_ANAHTAR));
      if(!h) return { izler: {}, goc: false };
      if(h.s === ANLIK_SURUM && h.p && typeof h.p === 'object') return { izler: h.p, goc: false };
      return { izler: {}, goc: true };   // v1 (veya bozuk) — göç: yeniden damgalama YAPMA
    }catch(e){ return { izler: {}, goc: true }; }
  }
  function anlikKaydet(izler){
    try{ localStorage.setItem(ANLIK_ANAHTAR, JSON.stringify({ s: ANLIK_SURUM, p: izler })); }catch(e){}
  }
  function kitapParmak(k){
    const kopya = { ...k }; delete kopya.g;
    /* Notların tekrar* alanları parmak izine GİRMEZ: yayılma zamanlaması
       (tekrar.js planlamaYap) her cihazda kendi kendine koşan türetilmiş bir
       defter kaydıdır — parmak izini değiştirseydi salt-render yapan cihaz
       kitabı taze damgalar, LWW birleşmesinde gerçek düzenlemeyi ezerdi
       (kanıtlanmış senaryo: karşı cihazın yeni eklediği alıntı kalıcı silinir).
       Kasıtlı tekrar eylemleri (Devam/Daha sık/Yeter/başlat) damgayı tekrar.js
       içinde k.g'ye AÇIKÇA basar. */
    if(Array.isArray(kopya.notlar)) kopya.notlar = kopya.notlar.map(n => {
      const t = { ...n };
      delete t.tekrarSonraki; delete t.tekrarAralik;
      delete t.tekrarSayisi; delete t.tekrarDurum;
      return t;
    });
    const s = JSON.stringify(kopya);
    let h1 = 0x811c9dc5, h2 = 0x01000193;   // iki bağımsız karma → çakışma olasılığı ihmal edilebilir
    for(let i = 0; i < s.length; i++){
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = (Math.imul(h2, 33) ^ c) >>> 0;
    }
    return s.length.toString(36) + '-' + h1.toString(36) + h2.toString(36);
  }
  /* Değişen/yeni kitaba zaman damgası basar, silinenler için mezar taşı bırakır.
     izleriYaz === false: parmak izleri KAYDEDİLMEZ, döndürülür — çağıran depo
     yazımı başarılı olursa kendisi kaydeder (M4b: iz depodan önce kalıcılaşırsa
     kota hatasında "değişiklik yok" sanılır, damga hiç basılmazdı). */
  function damgala(izleriYaz){
    if(typeof veri !== 'object' || !veri || !Array.isArray(veri.kitaplar)) return;
    const t = Date.now();
    const { izler: diskIzler, goc } = anlikYukle();
    // bellekteki bekleyen izler disk tabanının üstüne biner (kota turu telafisi)
    const onceki = bekleyenIzler ? { ...diskIzler, ...bekleyenIzler } : diskIzler;
    const simdiki = {};
    veri.silinenler = veri.silinenler || {};
    for(const k of veri.kitaplar){
      if(!k || !k.id) continue;
      const pf = kitapParmak(k);
      simdiki[k.id] = pf;
      // göç turunda parmak izi biçimi değiştiği için içerik değişmemiş sayılır:
      // aksi halde tüm kütüphane taze damgalanır ve bayat cihaz güncel olanı ezerdi
      if(!k.g || (!goc && onceki[k.id] !== pf)) k.g = t;
      if(veri.silinenler[k.id] && veri.silinenler[k.id] < k.g) delete veri.silinenler[k.id];
    }
    if(!goc) for(const id of Object.keys(onceki))
      if(!(id in simdiki) && !veri.silinenler[id]) veri.silinenler[id] = t;
    veri.hedefG = veri.hedefG || {};
    for(const yil of Object.keys(veri.hedef || {}))
      if(!veri.hedefG[yil]) veri.hedefG[yil] = t;
    veri.hedefSayfaG = veri.hedefSayfaG || {};
    for(const yil of Object.keys(veri.hedefSayfa || {}))
      if(!veri.hedefSayfaG[yil]) veri.hedefSayfaG[yil] = t;
    if(izleriYaz !== false) anlikKaydet(simdiki);
    return simdiki;
  }

  /* ---------- kimlik ---------- */
  async function kimlikAl(){
    const simdi = Date.now();
    if(kimlik && simdi - kimlik.sonAlim < 50*60*1000) return kimlik.idToken;
    if(kimlik && kimlik.refreshToken){
      try{
        const r = await fetch('https://securetoken.googleapis.com/v1/token?key=' + SENKRON_KEY, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ grant_type:'refresh_token', refresh_token: kimlik.refreshToken }) });
        const j = await r.json();
        if(j.id_token){ kimlik = { idToken:j.id_token, refreshToken:j.refresh_token, sonAlim:simdi }; return kimlik.idToken; }
      }catch(e){}
    }
    const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=' + SENKRON_KEY, {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ returnSecureToken:true }) });
    const j = await r.json();
    if(!j.idToken) throw new Error('kimlik alinamadi');
    kimlik = { idToken:j.idToken, refreshToken:j.refreshToken, sonAlim:simdi };
    return j.idToken;
  }

  /* ---------- birleştirme ----------
     Skalerler: KİTAP bazında en yeni damga kazanır (alan başına damga tutmak
     depo + karmaşıklık maliyeti; kazanç sınırlı — KARAR). İstisna guncelSayfa:
     okuma ilerlemesi geri gitmez, büyük olan kazanır.
     DİZİLER (notlar/oturumlar/okumalar/odunc/seanslar): toplanabilir veridir,
     ezilmez — kimlik bazlı BİRLEŞİM. Etiket/fikir listeleri İSTİSNA: kazanan
     kopyadan aynen alınır (LWW) — bkz. kumeTekil notu. Silinen not, not mezar taşıyla
     (kitap kaydındaki silinenNotlar) ölü kalır; mezardan SONRA düzenlenen not
     (ng damgası) yeniden yaşar. Hepsi saf: yan etkisiz, testte doğrudan çağrılır. */
  function iKat(s){
    return (typeof iKatla === 'function') ? iKatla(s)
      : String(s == null ? '' : s).toLocaleLowerCase('tr');
  }
  /* etiket / fikir: verilen liste(ler)i TR (i-ailesi) mükerrersiz süz.
     Birleşimde KAZANANIN listesi AYNEN alınır (tek argüman = LWW) — küme
     birleşimi silinen etiketi karşı kopyadan diriltiyordu ve etiket bir daha
     silinemiyordu (kanıtlı kusur). Bedel: iki cihazda EŞ ZAMANLI eklenen
     farklı etiketlerden biri kaybolur — bilinçli KARAR (tek kullanıcı; kalıcı
     dirilme çok daha kötü). Tam çözüm etiket mezar taşı (OR-set) — rapor. */
  function kumeTekil(){
    const c = [], gor = new Set();
    for(const liste of arguments) for(const x of (Array.isArray(liste) ? liste : [])){
      const anahtar = iKat(x);
      if(!anahtar || gor.has(anahtar)) continue;
      gor.add(anahtar); c.push(x);
    }
    return c;
  }
  /* doğal anahtarlı dizi birleşimi: kazanan sırası korunur, kaybedene özgüler
     sona eklenir; aynı anahtarda sec() karar verir (yoksa kazanan kalır).
     Anahtarsız eleman (çok eski kayıt) birleştirilemez ama KAYBOLMAZ da. */
  function anahtarliBirlesim(kazanan, kaybeden, anahtar, sec){
    const h = new Map(), anahtarsiz = [];
    /* sec HER çakışmada uygulanır — taraflar ARASI ve taraf İÇİ (birleşim
       bozuk sıra bırakmışsa aynı güne iki seans doğabiliyordu; ilki sessizce
       yutulmasın). sec yoksa ilk gelen (kazanan tarafı) kalır. */
    const koy = e => {
      if(!e) return;
      const key = anahtar(e);
      if(!key){ anahtarsiz.push(e); return; }
      const mevcut = h.get(key);
      if(mevcut === undefined) h.set(key, e);
      else if(sec) h.set(key, sec(mevcut, e));
    };
    (Array.isArray(kazanan) ? kazanan : []).forEach(koy);
    (Array.isArray(kaybeden) ? kaybeden : []).forEach(koy);
    return [...h.values(), ...anahtarsiz];
  }
  function notlariBirlestir(kazanan, kaybeden){
    // not mezar taşları: iki tarafın birleşimi, en yeni silme zamanı kazanır
    const mezar = {};
    for(const kaynak of [kazanan.silinenNotlar, kaybeden.silinenNotlar])
      if(kaynak && typeof kaynak === 'object')
        for(const [id, t] of Object.entries(kaynak)){
          const n = Number(t);
          if(Number.isFinite(n) && n > 0 && (!mezar[id] || n > mezar[id])) mezar[id] = n;
        }
    const h = new Map(), idsiz = [];
    (Array.isArray(kazanan.notlar) ? kazanan.notlar : []).forEach(n => {
      if(!n) return;
      if(n.id) h.set(n.id, n); else idsiz.push(n);
    });
    (Array.isArray(kaybeden.notlar) ? kaybeden.notlar : []).forEach(n => {
      if(!n) return;
      if(!n.id){ idsiz.push(n); return; }
      const v = h.get(n.id);
      if(!v){ h.set(n.id, n); return; }
      /* aynı not iki tarafta: not damgası (ng) yeni olan BÜTÜNÜYLE kazanır
         (fikir listesi dahil — LWW), eşitlikte kitap-kazananı tarafı.
         fikir-sil ng bastığı için silen kopya yeni sayılır, silinen dirilmez. */
      const secilen = ((n.ng || 0) > (v.ng || 0)) ? n : v;
      h.set(n.id, { ...secilen, fikir: kumeTekil(secilen.fikir) });
    });
    const notlar = [];
    for(const [id, n] of h){
      if(mezar[id] && mezar[id] >= (n.ng || 0)) continue;  // silme daha yeni → not ölü
      if(mezar[id]) delete mezar[id];  // silmeden SONRA düzenlenmiş → yaşar, mezar kalkar
      notlar.push(n);
    }
    return { notlar: [...notlar, ...idsiz], silinenNotlar: mezar };
  }
  function kitapCiftiBirlestir(kazanan, kaybeden){
    const k = { ...kazanan };
    /* guncelSayfa: gsG (alan damgası — yalnız KULLANICI ilerleme girişleri basar)
       farklıysa YENİ damgalı taraf kazanır: kasıtlı en son giriş, düzeltme
       (250→25) dahil, senkronda korunur. Damgalar EŞİTSE (eski/damgasız veri)
       geri uyumlu kural: aynı okuma döngüsünde (iki kopya da 'okunuyor',
       okumalar arşiv boyu eşit) büyük kazanır, değilse kazananın değeri —
       koşulsuz max "Yeniden oku" sıfırlamasını kalıcı kilitliyordu. */
    const kGs = parseInt(kazanan.gsG) || 0, yGs = parseInt(kaybeden.gsG) || 0;
    if(kGs !== yGs){
      k.guncelSayfa = parseInt((kGs > yGs ? kazanan : kaybeden).guncelSayfa) || 0;
    }else{
      const ayniDongu = kazanan.durum === 'okunuyor' && kaybeden.durum === 'okunuyor'
        && (Array.isArray(kazanan.okumalar) ? kazanan.okumalar.length : 0) ===
           (Array.isArray(kaybeden.okumalar) ? kaybeden.okumalar.length : 0);
      k.guncelSayfa = ayniDongu
        ? Math.max(parseInt(kazanan.guncelSayfa) || 0, parseInt(kaybeden.guncelSayfa) || 0)
        : (parseInt(kazanan.guncelSayfa) || 0);
    }
    k.gsG = Math.max(kGs, yGs);
    const nb = notlariBirlestir(kazanan, kaybeden);
    k.notlar = nb.notlar;
    k.silinenNotlar = nb.silinenNotlar;
    k.oturumlar = anahtarliBirlesim(kazanan.oturumlar, kaybeden.oturumlar,
      o => String(o.b || ''), (a, b) => ((b.s || 0) > (a.s || 0)) ? b : a);   // aynı oturum: tamamlanmış (uzun) hali
    k.okumalar = anahtarliBirlesim(kazanan.okumalar, kaybeden.okumalar,
      o => (o.bas || '') + '|' + (o.bit || ''), null);
    k.odunc = anahtarliBirlesim(kazanan.odunc, kaybeden.odunc,
      o => (o.kisi || '') + '|' + (o.verilis || ''), (a, b) => (!a.donus && b.donus) ? b : a); // iade kaydı ileridedir
    /* aynı gün seansları: iki dilim tek aralığa BİRLEŞİR (min a, max b) —
       taraf seçimi ilk dilimin sayfalarını yutuyordu */
    k.seanslar = anahtarliBirlesim(kazanan.seanslar, kaybeden.seanslar,
      s => String(s.t || ''), (a, b) => ({
        ...(((parseInt(b.b) || 0) > (parseInt(a.b) || 0)) ? b : a),
        a: Math.min(parseInt(a.a) || 0, parseInt(b.a) || 0),
        b: Math.max(parseInt(a.b) || 0, parseInt(b.b) || 0) }));
    k.etiketler = kumeTekil(kazanan.etiketler);   // LWW: kazanan kitabın listesi, TR-mükerrersiz
    /* Birleşim sırası kronolojik DEĞİLDİ (kaybedene özgü eski kayıt sona
       geliyordu): seansEkle "son eleman = bugün" varsayar, hız analizi sıraya
       bakar. Birleşimden sonra sırala; oturumda uygulama tavanı (400, oturumEkle)
       burada da uygulanır — yoksa budanan girişler odadan sonsuza dek dirilirdi. */
    k.oturumlar.sort((x, y) => (x.b || 0) - (y.b || 0));
    if(k.oturumlar.length > 400) k.oturumlar = k.oturumlar.slice(-400);
    k.seanslar.sort((x, y) => String(x.t || '').localeCompare(String(y.t || '')));
    k.okumalar.sort((x, y) => String(x.bas || x.bit || '').localeCompare(String(y.bas || y.bit || '')));
    k.odunc.sort((x, y) => String(x.verilis || '').localeCompare(String(y.verilis || '')));
    return k;
  }
  function birlestir(yerel, uzak){
    const silinenler = { ...((uzak && uzak.silinenler) || {}) };
    for(const [id, t] of Object.entries((yerel && yerel.silinenler) || {}))
      if(!silinenler[id] || t > silinenler[id]) silinenler[id] = t;

    const ciftler = new Map();   // id → { u: uzak kopya, y: yerel kopya }
    ((uzak && uzak.kitaplar) || []).forEach(k => { if(k && k.id) ciftler.set(k.id, { u: k }); });
    ((yerel && yerel.kitaplar) || []).forEach(k => {
      if(!k || !k.id) return;
      const c = ciftler.get(k.id);
      if(c) c.y = k; else ciftler.set(k.id, { y: k });
    });

    const kitaplar = [];
    for(const [id, c] of ciftler){
      let k;
      if(c.u && c.y){
        const kazanan = ((c.y.g || 0) >= (c.u.g || 0)) ? c.y : c.u;   // eşitlikte yerel (mevcut kural)
        k = kitapCiftiBirlestir(kazanan, kazanan === c.y ? c.u : c.y);
      }else k = c.u || c.y;
      const mezar = silinenler[id];
      if(mezar && mezar >= (k.g||0)) continue;
      const kayit = (typeof kitapNormalize === 'function') ? kitapNormalize(k) : k;
      kayit.g = k.g || 0;
      kitaplar.push(kayit);
    }

    const hedef = { ...((uzak && uzak.hedef) || {}) };
    const hedefG = { ...((uzak && uzak.hedefG) || {}) };
    for(const [yil, v] of Object.entries((yerel && yerel.hedef) || {})){
      const yg = ((yerel && yerel.hedefG) || {})[yil] || 0;
      if(!(yil in hedef) || yg >= (hedefG[yil]||0)){ hedef[yil] = v; hedefG[yil] = yg; }
    }
    // Sayfa hedefi: kitap hedefiyle aynı desen, kendi damgasıyla (hedefSayfaG)
    const hedefSayfa = { ...((uzak && uzak.hedefSayfa) || {}) };
    const hedefSayfaG = { ...((uzak && uzak.hedefSayfaG) || {}) };
    for(const [yil, v] of Object.entries((yerel && yerel.hedefSayfa) || {})){
      const yg = ((yerel && yerel.hedefSayfaG) || {})[yil] || 0;
      if(!(yil in hedefSayfa) || yg >= (hedefSayfaG[yil]||0)){ hedefSayfa[yil] = v; hedefSayfaG[yil] = yg; }
    }
    return { kitaplar, hedef, hedefG, hedefSayfa, hedefSayfaG, silinenler };
  }

  /* ---------- senkron ---------- */
  async function senkronEt(sessiz){
    if(!ayar || !ayar.oda || !kurulu() || eskiSurum) return false;
    /* M4a: uçuş sırasındaki çağrı yutulmaz — bitince yeniden planlanır ki
       senkron devam ederken yapılan kayıt bir sonraki kaydı beklemeden gitsin */
    if(calisiyor){ bekleyen = true; return false; }
    calisiyor = true;
    const odaBasta = ayar.oda;   // uçuş sırasında kes/oda-değiştir yarışına karşı
    const yol = SENKRON_URL.replace(/\/+$/, '') + '/odalar/' + encodeURIComponent(ayar.oda) + '.json';
    try{
      const tok = await kimlikAl();
      /* M1 (TOCTOU): RTDB ETag/if-match — GERÇEK sunucuda doğrulandı
         (X-Firebase-ETag → ETag; bayat if-match → 412). Araya yazan olursa
         PUT 412 döner; GET-birleştir-PUT en fazla 3 kez tekrarlanır (kısa
         rastgele bekleme) — araya girenin verisi taze GET'le birleşime girer,
         kaybolmaz. ETag başlığı gelmezse (beklenmedik ara katman) korumasız
         eski davranışa düşülür. */
      for(let deneme = 0; deneme < 3; deneme++){
        const r = await fetch(yol + '?auth=' + tok, { headers: { 'X-Firebase-ETag': 'true' } });
        if(!r.ok) throw new Error('okuma ' + r.status);
        const etag = r.headers.get('ETag');
        const uzak = (await r.json()) || {};
        const uzakSema = parseInt(uzak.sema) || 0;
        /* Şema koruması: odada daha yeni istemcinin verisi varsa bu istemci NE
           birleştirir NE yazar — dokunmamak tek güvenli seçenek (üstteki not). */
        if(uzakSema > SEMA_SURUM){
          eskiSurum = true;
          durumCiz();
          if(!sessiz) bildir('Bu cihaz eski sürümde — güncellemek için uygulamayı kapatıp aç');
          return false;
        }
        /* M3: oda şeması daha önce görülenin ALTINDAYSA eski sürümlü bir cihaz
           tam gövde yazıp sema alanını silmiş demektir. Bir tur atlanır (uyarı),
           sonraki tur PUT şemayı geri yazar — pencere daraltma, tam çözüm değil:
           eski istemci aktif kaldıkça dönüşümlü sürer. */
        if(uzakSema < ((ayar && ayar.sonSema) || 0)){
          if(!semaDusukGecis){
            semaDusukGecis = true;
            semaDustu = true;
            durumCiz();
            if(!sessiz) bildir('Odaya eski sürümlü bir cihaz yazmış — bu tur atlandı');
            planla();   // salt-okur oturumda da sonraki tur gelsin, şema geri yazılsın
            return false;
          }
          semaDusukGecis = false;   // ikinci tur: yaz ve şemayı geri koy
        }
        const sayacOnce = yazimSayaci;   // birleşim bu andaki verinin görüntüsü
        const bir = birlestir(veri, uzak);
        const basliklar = { 'Content-Type': 'application/json' };
        if(etag) basliklar['if-match'] = etag;
        const y = await fetch(yol + '?auth=' + tok, {
          method:'PUT', headers: basliklar,
          body: JSON.stringify({ ...bir, sema: SEMA_SURUM,
            cihazlar: { ...(uzak.cihazlar||{}), [ayar.cihaz || 'cihaz']: Date.now() } }) });
        if(y.status === 412){   // araya yazan oldu: taze gövdeyle yeniden birleştirilecek
          await new Promise(c => setTimeout(c, 120 + Math.random() * 280));
          continue;
        }
        if(!y.ok) throw new Error('yazma ' + y.status);

        /* KRİTİK koruma: PUT uçuşu sırasında kullanıcı kayıt yaptıysa (sayaç
           ilerledi) ya da oda değişti/kesildiyse birleşim görüntüsü BAYATTIR —
           yerele uygulamak uçuştaki düzenlemeyi bellek+depo+iz tabanından birden
           silerdi (kanıtlı senaryo). Yerele DOKUNMA: oda birleşik gövdeyi aldı,
           bir sonraki tur taze yerelle yeniden birleştirir. */
        if(yazimSayaci !== sayacOnce || !ayar || ayar.oda !== odaBasta){
          if(ayar && ayar.oda === odaBasta){
            bekleyen = true;
            ayarKaydet({ ...ayar, sonSenkron: Date.now(),
              sonSema: Math.max(uzakSema, SEMA_SURUM, ayar.sonSema || 0) });
          }
          durumCiz();
          return true;
        }

        veri.kitaplar = bir.kitaplar; veri.hedef = bir.hedef;
        veri.hedefG = bir.hedefG; veri.silinenler = bir.silinenler;
        veri.hedefSayfa = bir.hedefSayfa; veri.hedefSayfaG = bir.hedefSayfaG;
        /* M4b: önce depo, başarılıysa parmak izi — ters sıra kota hatasında
           taze iz + bayat depo uyumsuzluğu bırakıyordu */
        let depoTamam = true;
        try{ localStorage.setItem('kk_kitaplik_v1', JSON.stringify(veri)); }
        catch(e){ depoTamam = false; if(typeof kotaUyariGoster === 'function') kotaUyariGoster(); }
        const anlik = {};
        veri.kitaplar.forEach(k => { anlik[k.id] = kitapParmak(k); });
        if(depoTamam){ anlikKaydet(anlik); bekleyenIzler = null; }
        else bekleyenIzler = anlik;   // bellek tabanı: damga enflasyonu önlenir

        /* semaDustu bilerek SIFIRLANMAZ: şema geri yazılsa da eski sürümlü cihaz
           dışarıda durur, uyarı o cihaz güncellenene dek (bu oturum boyu) kalmalı.
           semaDusukGecis ise olay-başına: sonraki gerileme yine bir tur atlasın. */
        semaDusukGecis = false;
        ayarKaydet({ ...ayar, sonSenkron: Date.now(),
          sonSema: Math.max(uzakSema, SEMA_SURUM, (ayar && ayar.sonSema) || 0) });
        if(typeof hepsiniCiz === 'function') hepsiniCiz();
        durumCiz();
        if(!sessiz) bildir('Senkron tamam — ' + veri.kitaplar.length + ' kitap');
        return true;
      }
      // 3 denemede de çakışma: veri yerelde güvende, dürüstçe söyle, yeniden dene
      durumCiz();
      if(!sessiz) bildir('Senkron çakışması — birazdan yeniden denenecek');
      planla();
      return false;
    }catch(e){
      durumCiz();
      if(!sessiz) bildir('Senkron başarısız — bağlantını ve oda adını kontrol et');
      planla(30000);   // geçici ağ hatası kendiliğinden telafi edilsin (seyrek: 30 sn)
      return false;
    }finally{
      calisiyor = false;
      if(bekleyen){ bekleyen = false; planla(); }   // M4a: uçuştaki kayıt gönderilsin
    }
  }
  function planla(gecikme){
    if(!ayar || !ayar.oda) return;
    clearTimeout(zaman);
    zaman = setTimeout(() => senkronEt(true), gecikme || 4000);
  }

  /* ---------- arayüz ---------- */
  function kartEkle(){
    const kap = document.querySelector('.yedek-wrap');
    if(!kap || document.getElementById('senkronKart')) return;
    const kart = document.createElement('div');
    kart.className = 'yedek-kart';
    kart.id = 'senkronKart';
    kart.innerHTML =
      '<h3>Cihazlar arası senkron</h3>' +
      '<p id="senkronDurum"></p>' +
      '<div id="senkronForm">' +
        '<label for="s-oda">Oda adı</label>' +
        '<input id="s-oda" placeholder="ör. kabir-kitaplik-7431" autocomplete="off">' +
        '<label for="s-cihaz">Bu cihazın adı</label>' +
        '<input id="s-cihaz" placeholder="ör. Telefon" autocomplete="off">' +
        '<div style="height:12px"></div>' +
        '<button class="btn btn-brass" data-act="senkron-bagla">Bağlan ve senkronize et</button>' +
      '</div>' +
      '<div id="senkronBagli" style="display:none">' +
        '<button class="btn btn-brass" data-act="senkron-simdi">Şimdi senkronize et</button>' +
        '<div style="height:8px"></div>' +
        '<button class="btn btn-cerceve" data-act="senkron-kes">Bağlantıyı kes</button>' +
      '</div>';
    kap.insertBefore(kart, kap.firstChild);
  }
  function durumCiz(){
    const dEl = document.getElementById('senkronDurum');
    if(!dEl) return;
    const form = document.getElementById('senkronForm'), bagli = document.getElementById('senkronBagli');
    if(!kurulu()){
      form.style.display = 'none'; bagli.style.display = 'none';
      dEl.textContent = 'Senkron bu sürümde henüz yapılandırılmamış.';
      return;
    }
    if(eskiSurum){
      form.style.display = 'none';
      if(bagli) bagli.style.display = 'none';
      dEl.innerHTML = '⚠️ <b>Bu cihaz eski sürümde</b> — odadaki veri daha yeni bir uygulama ' +
        'sürümüyle yazılmış. Veri kaybını önlemek için senkron duraklatıldı. ' +
        'Güncellemek için uygulamayı kapatıp yeniden aç.';
      return;
    }
    if(ayar && ayar.oda){
      form.style.display = 'none'; bagli.style.display = 'block';
      const ne = ayar.sonSenkron
        ? new Date(ayar.sonSenkron).toLocaleString('tr-TR', { dateStyle:'short', timeStyle:'short' })
        : 'henüz yok';
      dEl.innerHTML = (semaDustu
          ? '⚠️ Odaya <b>eski sürümlü</b> bir cihaz yazmış — o cihazda uygulamayı kapatıp açmalısın. ' +
            'Koruma için bir senkron turu atlandı.<br>'
          : '') +
        'Bağlı — oda <b>' + kacir(ayar.oda) + '</b>, bu cihaz: <b>' + kacir(ayar.cihaz || '-') +
        '</b>.<br>Son senkron: ' + ne + '. Değişiklikler birkaç saniye içinde kendiliğinden gönderilir.';
    }else{
      form.style.display = 'block'; bagli.style.display = 'none';
      dEl.textContent = 'Telefon, laptop ve tabletin aynı kütüphaneyi görsün. Aynı oda adını girdiğin her cihaz senkronize olur — oda adını kimseyle paylaşma, şifren gibidir.';
    }
  }

  /* ---------- bağlanma ---------- */
  function baslat(){
    ayar = ayarYukle();
    kartEkle(); durumCiz();

    // depoKaydet'i sarmala: her kayıtta damga + otomatik senkron
    if(typeof window.depoKaydet === 'function' && !window.depoKaydet.__senkron){
      const asil = window.depoKaydet;
      const sarmal = function(){
        yazimSayaci++;   // PUT uçuşundaki kayıtları senkron başarı yolu fark etsin
        // Damgayı ÖNCE bas (g değerleri yazılacak JSON'a girer), izleri SONRA
        // kaydet: depo yazımı kota yüzünden düşerse parmak izi de kalıcılaşmaz
        // (M4b) — aksi halde bayat depo taze iz tabanıyla "değişmemiş" sayılırdı.
        let izler = null;
        try{ izler = damgala(false); }catch(e){}
        const s = asil.apply(this, arguments);
        if(s !== false && izler){ anlikKaydet(izler); bekleyenIzler = null; }
        else if(izler) bekleyenIzler = izler;   // bellek tabanı: damga enflasyonu önlenir
        planla();
        return s;
      };
      sarmal.__senkron = true;
      window.depoKaydet = sarmal;
    }

    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if(!el) return;
      const act = el.dataset.act;
      if(act === 'senkron-bagla'){
        const oda = document.getElementById('s-oda').value.trim();
        const cihaz = document.getElementById('s-cihaz').value.trim() || 'Cihaz';
        if(oda.length < 6){ bildir('Oda adı en az 6 karakter olmalı — tahmin edilmesi zor bir şey seç'); return; }
        ayarKaydet({ oda, cihaz, sonSenkron: null });
        damgala(); durumCiz(); senkronEt(false);
      }else if(act === 'senkron-simdi'){
        senkronEt(false);
      }else if(act === 'senkron-kes'){
        if(confirm('Senkron kapatılsın mı? Kitapların bu cihazda kalır, diğer cihazlarla alışverişi durur.')){
          ayarKaydet(null); durumCiz(); bildir('Senkron kapatıldı');
        }
      }
    });

    // ilk açılışta damga tabanı + senkron
    damgala();
    if(ayar && ayar.oda) senkronEt(true);
  }

  if(document.querySelector('.yedek-wrap')) baslat();
  else document.addEventListener('DOMContentLoaded', baslat);

  // test kancaları
  window.__senkron = { birlestir, damgala, senkronEt, durumCiz, ayarKaydet, kurulu,
    ANLIK_SURUM, SEMA_SURUM };
})();
