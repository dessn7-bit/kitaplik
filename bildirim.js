/* Hatırlatma (push bildirimi) — alıntı tekrarı vakti gelince günde en fazla
   bir kez "N alıntı seni bekliyor" bildirimi. Kendi kendine yeten modül:
   index.html'de tek satırlık script etiketiyle yüklenir.
   AD ALANI: sınıflar ve data-act değerleri 'ht-' önekli, id'ler 'ht' önekli.

   MİMARİ (gizlilik önce):
   - Alıntı METNİ sunucuya ASLA gitmez. Sunucu (kitaplik-bildirim worker'ı)
     yalnız "uyan" sinyali yollar — push PAYLOAD'SIZDIR. Bildirim metnini
     service worker, bu dosyanın IndexedDB'ye yazdığı ÖZETTEN üretir.
   - Özet (kk_bildirim_v1 / 'ozet' / 'guncel'): { vadeler:[ISO gün...],
     ornekMetin (90 karaklık kırpık), guncelleme }. SAYI değil VADE listesi
     yazılır: sayı gece yarısında bayatlar; SW push anında "bugün <= vade"
     sayımını kendisi yapar, gece devri sorun olmaz.
   - Sunucuya giden verinin TAMAMI: push aboneliği (endpoint+anahtarlar,
     tarayıcı üretir) + tercih saati + saat dilimi + bir sonraki vade GÜNÜ.
   - Kuyruk kancası: kuyruğu değiştiren HER yol (tekrar eylemleri,
     planlamaYap, not ekleme/silme, senkron birleşmesi) depoKaydet'ten
     geçer → depoKaydet sarmalanır (senkron.js'in kendi sarmalama emsali;
     biz ondan SONRA yüklenip onun sarmalanmışını sarmalarız). tekrar.js'e
     dokunulmaz. Gece devri veri değiştirmez → SW tarafı çözer (üstte).
   - navigator.serviceWorker.ready ASLA çıplak beklenmez (Playwright
     serviceWorkers:'block' altında sonsuza dek asılı kalır) —
     getRegistration() kullanılır: kayıt yoksa undefined döner. */
'use strict';
(function(){
  const DB_AD = 'kk_bildirim_v1';
  const MAGAZA = 'ozet';
  const AYAR_ANAHTAR = 'kk_bildirim_v1';   // localStorage: {acik, saat, sonVade} — cihaz-yerel, senkrona girmez
  const SUNUCU = 'https://kitaplik-bildirim.dessn7.workers.dev';
  const VAPID_ACIK = 'BN3pQt_NZg4Gzpxf4VbZzoYihofRB76_nOPQY7JPJq5gM5TqF5yiekR2tOHGONUlrawESTiqBNtwd2feDJ90nPE';
  const ORNEK_KIRPMA = 90;
  const VARSAYILAN_SAAT = 9;

  function bildir(m){ if(typeof toast === 'function') toast(m); }

  /* ---------- ayar (localStorage) ---------- */
  function ayarYukle(){
    try{
      const a = JSON.parse(localStorage.getItem(AYAR_ANAHTAR)) || {};
      return { acik: !!a.acik,
        saat: (a.saat >= 0 && a.saat <= 23) ? a.saat : VARSAYILAN_SAAT,
        sonVade: a.sonVade || null };
    }catch(e){ return { acik: false, saat: VARSAYILAN_SAAT, sonVade: null }; }
  }
  function ayarKaydet(a){
    try{ localStorage.setItem(AYAR_ANAHTAR, JSON.stringify(a)); }catch(e){}
  }

  /* ---------- IndexedDB (kapak.js dbAc/islem deseninin kopyası) ---------- */
  let dbSoz = null;
  function dbAc(){
    if(dbSoz) return dbSoz;
    dbSoz = new Promise((cozul, kir) => {
      if(!window.indexedDB){ kir(new Error('indexedDB yok')); return; }
      let istek;
      try{ istek = indexedDB.open(DB_AD, 1); }
      catch(e){ kir(e); return; }
      istek.onupgradeneeded = () => { istek.result.createObjectStore(MAGAZA); };
      istek.onsuccess = () => {
        const db = istek.result;
        db.onclose = () => { dbSoz = null; };
        db.onversionchange = () => { try{ db.close(); }catch(e){} dbSoz = null; };
        cozul(db);
      };
      istek.onerror = () => kir(istek.error || new Error('açılamadı'));
    });
    dbSoz.catch(() => { dbSoz = null; });
    return dbSoz;
  }
  function islem(mod, gorev, tekrar){
    return dbAc().then(db => new Promise((cozul, kir) => {
      let sonuc;
      let tx;
      try{ tx = db.transaction(MAGAZA, mod); sonuc = gorev(tx.objectStore(MAGAZA)); }
      catch(e){
        if(!tekrar){ dbSoz = null; cozul(islem(mod, gorev, true)); return; }
        kir(e); return;
      }
      tx.oncomplete = () => cozul(sonuc ? sonuc.result : undefined);
      tx.onerror = () => kir(tx.error || new Error('işlem hatası'));
      tx.onabort = () => kir(tx.error || new Error('işlem iptal'));
    }));
  }
  const ozetYazIdb = o => islem('readwrite', st => st.put(o, 'guncel'));
  const ozetOku = () => islem('readonly', st => st.get('guncel'));

  /* ---------- özet hesabı (salt okuma — veri'ye yazmaz) ---------- */
  function kirp(m){
    const t = String(m || '').replace(/\s+/g, ' ').trim();
    return t.length > ORNEK_KIRPMA ? t.slice(0, ORNEK_KIRPMA - 1) + '…' : t;
  }
  function ozetHesapla(){
    const adaylar = [];
    try{
      (veri.kitaplar || []).forEach(k => (k.notlar || []).forEach(n => {
        if(n && n.tekrarDurum === 'aktif' && n.tekrarSonraki) adaylar.push(n);
      }));
    }catch(e){}
    /* tekrar.js kuyruk sırasıyla aynı öncelik: vade, tarih, id */
    adaylar.sort((a, b) => a.tekrarSonraki.localeCompare(b.tekrarSonraki)
      || ((a.tarih || '').localeCompare(b.tarih || ''))
      || String(a.id).localeCompare(String(b.id)));
    return {
      vadeler: adaylar.map(n => n.tekrarSonraki),
      ornekMetin: adaylar.length ? kirp(adaylar[0].metin) : null,
      guncelleme: Date.now()
    };
  }

  /* ---------- tazeleme (debounce'lu) ---------- */
  let tazeleZaman = null;
  function tazelePlanla(){
    clearTimeout(tazeleZaman);
    tazeleZaman = setTimeout(tazele, 500);
  }
  async function tazele(){
    const o = ozetHesapla();
    try{ await ozetYazIdb(o); }catch(e){}
    vadeSenkronla(o.vadeler.length ? o.vadeler[0] : null);
    return o;
  }
  /* Bir sonraki vade değiştiyse sunucuya bildir — sunucu "vade gelmemişse hiç
     gönderme" kapısını bununla işletir. Yalnız hatırlatma AÇIKKEN konuşur. */
  let vadeZaman = null;
  function vadeSenkronla(vade){
    const a = ayarYukle();
    if(!a.acik || a.sonVade === vade) return;
    clearTimeout(vadeZaman);
    vadeZaman = setTimeout(async () => {
      try{
        const abonelik = await abonelikGetir();
        if(!abonelik) return;
        const y = await fetch(SUNUCU + '/abone-guncelle', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: abonelik.endpoint, vade })
        });
        if(y.ok){ const g = ayarYukle(); g.sonVade = vade; ayarKaydet(g); }
      }catch(e){}
    }, 1200);
  }

  /* ---------- push aboneliği ---------- */
  function destekVar(){
    return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  }
  function iosTarayici(){
    /* iOS'ta Web Push yalnız iOS 16.4+ ve ANA EKRANA EKLENMİŞ uygulamada.
       Safari sekmesinde PushManager hiç yok → destek kontrolü zaten yakalar;
       bu bayrak dürüst yönlendirme metni için. */
    return /iP(hone|ad|od)/.test(navigator.userAgent)
      && !(navigator.standalone || (window.matchMedia && matchMedia('(display-mode: standalone)').matches));
  }
  async function kayitGetir(){
    try{ return await navigator.serviceWorker.getRegistration(); }
    catch(e){ return null; }
  }
  async function abonelikGetir(){
    const kayit = await kayitGetir();
    if(!kayit || !kayit.pushManager) return null;
    try{ return await kayit.pushManager.getSubscription(); }
    catch(e){ return null; }
  }
  function anahtarBaytlari(b64u){
    const dolgu = '='.repeat((4 - b64u.length % 4) % 4);
    const ham = atob((b64u + dolgu).replace(/-/g, '+').replace(/_/g, '/'));
    const dizi = new Uint8Array(ham.length);
    for(let i = 0; i < ham.length; i++) dizi[i] = ham.charCodeAt(i);
    return dizi;
  }

  async function ac(){
    if(!destekVar()){ durumYaz(); return; }
    let izin = Notification.permission;
    /* İzin diyaloğu YALNIZ bu açık kullanıcı eylemiyle çıkar (ht-ac). */
    if(izin === 'default'){
      try{ izin = await Notification.requestPermission(); }catch(e){ izin = Notification.permission; }
    }
    if(izin !== 'granted'){ durumYaz(); return; }
    const kayit = await kayitGetir();
    if(!kayit || !kayit.pushManager){
      bildir('Bildirim altyapısı bu ortamda hazır değil — sayfayı yenileyip dene');
      durumYaz(); return;
    }
    try{
      let abonelik = await kayit.pushManager.getSubscription();
      if(!abonelik){
        abonelik = await kayit.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: anahtarBaytlari(VAPID_ACIK)
        });
      }
      const a = ayarYukle();
      const o = await tazele();
      const vade = o.vadeler.length ? o.vadeler[0] : null;
      const y = await fetch(SUNUCU + '/abone', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          abonelik: abonelik.toJSON(),
          saat: a.saat,
          dilim: Intl.DateTimeFormat().resolvedOptions().timeZone,
          vade
        })
      });
      if(!y.ok) throw new Error('sunucu ' + y.status);
      a.acik = true; a.sonVade = vade;
      ayarKaydet(a);
      bildir('Hatırlatma açıldı — her gün ' + saatMetni(a.saat) + ' civarı bakılır');
    }catch(e){
      bildir('Hatırlatma açılamadı — bağlantını kontrol edip yeniden dene');
    }
    durumYaz();
  }
  async function kapat(){
    const a = ayarYukle();
    a.acik = false; a.sonVade = null;
    ayarKaydet(a);
    try{
      const abonelik = await abonelikGetir();
      if(abonelik){
        try{
          await fetch(SUNUCU + '/abone-sil', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: abonelik.endpoint })
          });
        }catch(e){}
        await abonelik.unsubscribe();
      }
    }catch(e){}
    bildir('Hatırlatma kapatıldı');
    durumYaz();
  }
  async function testGonder(){
    if(!destekVar() || Notification.permission !== 'granted'){
      bildir('Önce hatırlatmayı aç — izin gerekiyor'); return;
    }
    const kayit = await kayitGetir();
    if(!kayit){ bildir('Bildirim altyapısı hazır değil'); return; }
    const o = await tazele();
    const bugun = gunIso();
    const sayi = o.vadeler.filter(v => v <= bugun).length;
    try{
      await kayit.showNotification('Deneme — Kitaplık', {
        body: sayi ? (sayi + ' alıntı seni bekliyor. ' + (o.ornekMetin || '')) :
          'Bugün bekleyen tekrar yok — bildirim böyle görünecek.',
        tag: 'kitaplik-deneme', icon: './icon-192.png', badge: './icon-192.png'
      });
    }catch(e){ bildir('Deneme bildirimi gösterilemedi'); }
  }
  function gunIso(){
    const s = new Date();
    return s.getFullYear() + '-' + String(s.getMonth() + 1).padStart(2, '0') +
      '-' + String(s.getDate()).padStart(2, '0');
  }
  function saatMetni(s){ return String(s).padStart(2, '0') + ':00'; }

  /* ---------- Ayarlar ▸ Hatırlatma arayüzü ---------- */
  function saatSeciciDoldur(){
    const sec = document.getElementById('htSaat');
    if(!sec || sec.options.length) return;
    for(let s = 0; s < 24; s++){
      const o = document.createElement('option');
      o.value = String(s); o.textContent = saatMetni(s);
      sec.appendChild(o);
    }
    sec.value = String(ayarYukle().saat);
    sec.addEventListener('change', async () => {
      const a = ayarYukle();
      a.saat = parseInt(sec.value, 10) || 0;
      ayarKaydet(a);
      if(a.acik){
        try{
          const abonelik = await abonelikGetir();
          if(abonelik) await fetch(SUNUCU + '/abone-guncelle', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: abonelik.endpoint, saat: a.saat,
              dilim: Intl.DateTimeFormat().resolvedOptions().timeZone })
          });
        }catch(e){}
      }
    });
  }
  async function durumYaz(){
    const el = document.getElementById('htDurum');
    if(!el) return;
    saatSeciciDoldur();
    const acBtn = document.querySelector('#ayBolumHatirlatma [data-act="ht-ac"]');
    const kapatBtn = document.querySelector('#ayBolumHatirlatma [data-act="ht-kapat"]');
    const testBtn = document.querySelector('#ayBolumHatirlatma [data-act="ht-test"]');
    const g = (a, k, t) => { if(acBtn) acBtn.hidden = !a; if(kapatBtn) kapatBtn.hidden = !k; if(testBtn) testBtn.hidden = !t; };
    if(!destekVar()){
      el.textContent = iosTarayici()
        ? 'iOS\'ta bildirim yalnız Ana Ekrana eklenmiş uygulamada çalışır (iOS 16.4+): Paylaş ▸ Ana Ekrana Ekle, sonra uygulamayı oradan aç.'
        : 'Bu tarayıcı web bildirimlerini desteklemiyor.';
      g(false, false, false); return;
    }
    if(Notification.permission === 'denied'){
      el.textContent = 'Bildirim izni tarayıcıda reddedilmiş. Açmak için tarayıcının site ayarlarına gir ' +
        '(adres çubuğundaki kilit/ayar simgesi ▸ Bildirimler ▸ İzin ver), sonra buraya dön.';
      g(false, false, false); return;
    }
    const a = ayarYukle();
    const abonelik = a.acik ? await abonelikGetir() : null;
    if(a.acik && abonelik){
      el.textContent = 'Açık — tekrar vakti gelen alıntın varsa her gün ' + saatMetni(a.saat) +
        ' civarı hatırlatılır (günde en fazla bir bildirim).';
      g(false, true, true);
    }else{
      if(a.acik && !abonelik){ a.acik = false; ayarKaydet(a); }   // abonelik dışarıdan silinmiş — dürüst duruma dön
      el.textContent = 'Kapalı. Açarsan tarayıcı bir kez bildirim izni sorar; alıntı metinleri cihazında kalır, sunucuya yalnız hatırlatma saati gider.';
      g(true, false, false);
    }
  }

  /* ---------- bağlama ---------- */
  function baslat(){
    /* depoKaydet sarmalaması: senkron.js'inkinin ÜSTÜNE (biz sonra yüklendik).
       Kuyruğu değiştiren her yol buradan geçtiği için tekrar.js'e kanca gerekmez. */
    if(typeof window.depoKaydet === 'function'){
      const cekirdek = window.depoKaydet;
      window.depoKaydet = function(){
        const sonuc = cekirdek.apply(this, arguments);
        tazelePlanla();
        return sonuc;
      };
    }
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if(!el) return;
      switch(el.dataset.act){
        case 'ht-ac': ac(); break;
        case 'ht-kapat': kapat(); break;
        case 'ht-test': testGonder(); break;
        case 'ayar-ac': durumYaz(); break;   // kapak.js/ocr.js ile aynı kalıp
      }
    });
    tazelePlanla();   // açılış özeti (gece devrini sayfa tarafında da tazeler)
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
  else baslat();

  /* test kancaları */
  window.__bildirim = { ozetHesapla, tazele, ozetOku, ayarYukle, ayarKaydet, kirp,
    destekVar, iosTarayici, durumYaz, DB_AD, MAGAZA, AYAR_ANAHTAR, SUNUCU, VAPID_ACIK };
})();
