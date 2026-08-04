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
  const ANLIK_SURUM = 3;
  /* v1'de her kitabın TAM JSON'u parmak izi olarak saklanıyordu: kütüphanenin
     ikinci bir kopyası kadar yer tutuyor, localStorage kotasını iki katına
     yakın hızda dolduruyordu. v2 kısa çift-hash tutar (~20 karakter/kitap).
     v3: kitapNormalize'a kapakYerel eklendi — normalize çıktısı değiştiği için
     TÜM parmak izleri değişir; sürüm artmasaydı ilk açılış bütün kütüphaneyi
     taze damgalar, bayat cihaz güncel düzenlemeleri ezerdi. KURAL: kitapNormalize
     şeması her değiştiğinde bu sürüm de artmalı (göç turu damga basmaz). */
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
    const s = JSON.stringify(kopya);
    let h1 = 0x811c9dc5, h2 = 0x01000193;   // iki bağımsız karma → çakışma olasılığı ihmal edilebilir
    for(let i = 0; i < s.length; i++){
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = (Math.imul(h2, 33) ^ c) >>> 0;
    }
    return s.length.toString(36) + '-' + h1.toString(36) + h2.toString(36);
  }
  /* Değişen/yeni kitaba zaman damgası basar, silinenler için mezar taşı bırakır. */
  function damgala(){
    if(typeof veri !== 'object' || !veri || !Array.isArray(veri.kitaplar)) return;
    const t = Date.now();
    const { izler: onceki, goc } = anlikYukle();
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
    anlikKaydet(simdiki);
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

  /* ---------- birleştirme: kitap bazında en yeni kazanır ---------- */
  function birlestir(yerel, uzak){
    const silinenler = { ...((uzak && uzak.silinenler) || {}) };
    for(const [id, t] of Object.entries((yerel && yerel.silinenler) || {}))
      if(!silinenler[id] || t > silinenler[id]) silinenler[id] = t;

    const harita = new Map();
    const koy = k => {
      if(!k || !k.id) return;
      const eski = harita.get(k.id);
      if(!eski || (k.g||0) >= (eski.g||0)) harita.set(k.id, k);
    };
    ((uzak && uzak.kitaplar) || []).forEach(koy);
    ((yerel && yerel.kitaplar) || []).forEach(koy);

    const kitaplar = [];
    for(const [id, k] of harita){
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
    if(!ayar || !ayar.oda || calisiyor || !kurulu()) return false;
    calisiyor = true;
    const yol = SENKRON_URL.replace(/\/+$/, '') + '/odalar/' + encodeURIComponent(ayar.oda) + '.json';
    try{
      const tok = await kimlikAl();
      const r = await fetch(yol + '?auth=' + tok);
      if(!r.ok) throw new Error('okuma ' + r.status);
      const uzak = (await r.json()) || {};
      const bir = birlestir(veri, uzak);
      const y = await fetch(yol + '?auth=' + tok, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ ...bir, cihazlar: { ...(uzak.cihazlar||{}), [ayar.cihaz || 'cihaz']: Date.now() } }) });
      if(!y.ok) throw new Error('yazma ' + y.status);

      veri.kitaplar = bir.kitaplar; veri.hedef = bir.hedef;
      veri.hedefG = bir.hedefG; veri.silinenler = bir.silinenler;
      veri.hedefSayfa = bir.hedefSayfa; veri.hedefSayfaG = bir.hedefSayfaG;
      const anlik = {};
      veri.kitaplar.forEach(k => { anlik[k.id] = kitapParmak(k); });
      anlikKaydet(anlik);
      try{ localStorage.setItem('kk_kitaplik_v1', JSON.stringify(veri)); }
      catch(e){ if(typeof kotaUyariGoster === 'function') kotaUyariGoster(); }

      ayarKaydet({ ...ayar, sonSenkron: Date.now() });
      if(typeof hepsiniCiz === 'function') hepsiniCiz();
      durumCiz();
      if(!sessiz) bildir('Senkron tamam — ' + veri.kitaplar.length + ' kitap');
      return true;
    }catch(e){
      durumCiz();
      if(!sessiz) bildir('Senkron başarısız — bağlantını ve oda adını kontrol et');
      return false;
    }finally{ calisiyor = false; }
  }
  function planla(){
    if(!ayar || !ayar.oda) return;
    clearTimeout(zaman);
    zaman = setTimeout(() => senkronEt(true), 4000);
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
    if(ayar && ayar.oda){
      form.style.display = 'none'; bagli.style.display = 'block';
      const ne = ayar.sonSenkron
        ? new Date(ayar.sonSenkron).toLocaleString('tr-TR', { dateStyle:'short', timeStyle:'short' })
        : 'henüz yok';
      dEl.innerHTML = 'Bağlı — oda <b>' + kacir(ayar.oda) + '</b>, bu cihaz: <b>' + kacir(ayar.cihaz || '-') +
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
        // Damgayı ÖNCE bas, sonra tek yazım yap: eskiden kütüphane aynı çağrıda
        // iki kez serileştirilip yazılıyordu ve ikinci yazım depoKaydet'in kota
        // yakalamasını atlıyordu (kota uyarısı görünmüyordu).
        try{ damgala(); }catch(e){}
        const s = asil.apply(this, arguments);
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
  window.__senkron = { birlestir, damgala, senkronEt, durumCiz, ayarKaydet, kurulu };
})();
