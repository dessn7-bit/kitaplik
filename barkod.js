/* Kitaplık — barkod & ISBN eklentisi
   Kitabın arkasındaki barkodu kameraya okut, form dolsun.
   Kamera yoksa/izin verilmezse ISBN elle yazılabilir — her cihazda çalışır.
   Kendi kendine yeten modül: index.html'de tek satırlık script etiketiyle yüklenir. */
'use strict';
(function(){
  const GB_ANAHTAR = (function(){
    const m = /books\/v1\/volumes\?key=([A-Za-z0-9_-]+)/.exec(document.documentElement.innerHTML);
    return m ? m[1] : '';
  })();

  let akis = null, tarayici = null, dongu = null;

  const kacir = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function bildir(m){ if(typeof toast === 'function') toast(m); }

  /* ---------- ISBN yardımcıları ---------- */
  function isbnTemizle(s){ return String(s||'').replace(/[^0-9Xx]/g, '').toUpperCase(); }
  function isbnGecerli(s){
    const t = isbnTemizle(s);
    if(t.length === 13){
      if(!/^\d{13}$/.test(t)) return false;
      let top = 0;
      for(let i = 0; i < 12; i++) top += (+t[i]) * (i % 2 ? 3 : 1);
      return (10 - (top % 10)) % 10 === +t[12];
    }
    if(t.length === 10){
      let top = 0;
      for(let i = 0; i < 9; i++){ if(!/\d/.test(t[i])) return false; top += (+t[i]) * (10 - i); }
      top += t[9] === 'X' ? 10 : (/\d/.test(t[9]) ? +t[9] : NaN);
      return top % 11 === 0;
    }
    return false;
  }

  /* ---------- iki kaynaktan ISBN sorgusu ---------- */
  /* Dönüş: { sonuc, agSorunu }. agSorunu YALNIZ iki kaynak da yanıt veremediğinde
     true olur — biri yanıt verip bulamadıysa "kayıtlarda yok" doğru teşhistir.
     Eskiden ağ arızası da "bu ISBN kayıtlarda yok" diye raporlanıyordu. */
  async function isbnAra(isbn){
    const t = isbnTemizle(isbn);
    let sonuc = null, gbHata = false, olHata = false;
    try{
      const r = await fetch('https://www.googleapis.com/books/v1/volumes?key=' + GB_ANAHTAR
        + '&country=TR&q=isbn:' + encodeURIComponent(t));
      if(!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      if(j.totalItems && j.items && j.items[0]){
        const v = j.items[0].volumeInfo || {};
        sonuc = {
          ad: v.title || '', yazar: (v.authors||[]).slice(0,2).join(', '),
          yayinevi: v.publisher || '',
          yil: v.publishedDate ? parseInt(v.publishedDate.slice(0,4)) || null : null,
          sayfa: v.pageCount || null,
          kapak: (v.imageLinks && v.imageLinks.thumbnail)
            ? v.imageLinks.thumbnail.replace('http://','https://') : null,
          tur: (v.categories||[])[0] || ''
        };
      }
    }catch(e){ gbHata = true; }
    // Open Library: eksik alanları tamamlar (özellikle yayınevi)
    try{
      const r = await fetch('https://openlibrary.org/api/books?format=json&jscmd=data&bibkeys=ISBN:' + encodeURIComponent(t));
      if(!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      const d = j && Object.values(j)[0];
      if(d){
        const ol = {
          ad: d.title || '', yazar: (d.authors||[]).slice(0,2).map(a => a.name).join(', '),
          yayinevi: (d.publishers||[])[0] ? d.publishers[0].name : '',
          yil: d.publish_date ? parseInt(String(d.publish_date).slice(-4)) || null : null,
          sayfa: d.number_of_pages || null,
          kapak: d.cover ? (d.cover.medium || d.cover.large || null) : null, tur: ''
        };
        if(!sonuc) sonuc = ol;
        else for(const k of ['yazar','yayinevi','yil','sayfa','kapak'])
          if(!sonuc[k] && ol[k]) sonuc[k] = ol[k];
      }
    }catch(e){ olHata = true; }
    return { sonuc, agSorunu: gbHata && olHata };
  }

  /* ---------- formu doldur ---------- */
  function formuDoldur(k, isbn){
    const yaz = (id, v) => { const e = document.getElementById(id); if(e && v) e.value = v; };
    yaz('f-ad', k.ad); yaz('f-yazar', k.yazar); yaz('f-yayinevi', k.yayinevi);
    yaz('f-yil', k.yil); yaz('f-sayfa', k.sayfa);
    const tur = document.getElementById('f-tur');
    if(tur && !tur.value && k.tur) tur.value = k.tur;
    if(k.kapak && typeof durum === 'object'){
      durum.formKapak = k.kapak;
      if(typeof kapakOnizleCiz === 'function') kapakOnizleCiz();
    }
    // arama önerilerini sustur (kullanıcı yazmadı, biz doldurduk)
    if(typeof sonAramaMetni !== 'undefined'){ try{ sonAramaMetni = k.ad; }catch(e){} }
    const dEl = document.getElementById('olDurum'), sEl = document.getElementById('olSonuc');
    if(sEl) sEl.innerHTML = '';
    if(dEl) dEl.textContent = 'ISBN ' + isbn + ' bulundu — kontrol edip kaydet.';
  }

  async function isbnIsle(isbn, kaynakMetni){
    const t = isbnTemizle(isbn);
    if(!isbnGecerli(t)){ bildir('Geçersiz ISBN — 10 veya 13 haneli olmalı'); return false; }
    const dEl = document.getElementById('olDurum');
    if(dEl) dEl.textContent = 'ISBN ' + t + ' sorgulanıyor…';
    const { sonuc: k, agSorunu } = await isbnAra(t);
    if(!k || !k.ad){
      if(agSorunu){
        if(dEl) dEl.textContent = 'İnternete ulaşılamadı — bağlantını kontrol edip tekrar dene.';
        bildir('İnternete ulaşılamadı');
      }else{
        if(dEl) dEl.textContent = 'Bu ISBN kayıtlarda yok — kitap adıyla arayabilir veya elle girebilirsin.';
        bildir('ISBN bulunamadı');
      }
      return false;
    }
    formuDoldur(k, t);
    bildir((kaynakMetni || 'Barkod') + ' okundu: ' + k.ad);
    return true;
  }

  /* ---------- kamera ---------- */
  function kameraVar(){
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && 'BarcodeDetector' in window;
  }
  async function kameraAc(){
    const ortu = document.getElementById('barkodOrtu');
    const not = document.getElementById('barkodNot');
    ortu.classList.add('acik');
    if(!kameraVar()){
      not.textContent = 'Bu cihaz/tarayıcı barkod kamerasını desteklemiyor — ISBN\'i elle yazabilirsin.';
      return;
    }
    try{
      akis = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const v = document.getElementById('barkodVideo');
      v.srcObject = akis; await v.play();
      tarayici = new window.BarcodeDetector({ formats: ['ean_13','ean_8','isbn'] });
      not.textContent = 'Barkodu çerçeveye getir…';
      dongu = setInterval(async () => {
        try{
          const bulunan = await tarayici.detect(v);
          if(bulunan && bulunan.length){
            const kod = bulunan[0].rawValue;
            if(isbnGecerli(kod)){
              kameraKapat();
              await isbnIsle(kod, 'Barkod');
            }
          }
        }catch(e){}
      }, 400);
    }catch(e){
      not.textContent = 'Kamera açılamadı (izin verilmemiş olabilir) — ISBN\'i elle yazabilirsin.';
    }
  }
  function kameraKapat(){
    clearInterval(dongu); dongu = null;
    if(akis){ akis.getTracks().forEach(t => t.stop()); akis = null; }
    const v = document.getElementById('barkodVideo');
    if(v) v.srcObject = null;
    const ortu = document.getElementById('barkodOrtu');
    if(ortu) ortu.classList.remove('acik');
  }

  /* ---------- arayüz ---------- */
  function arayuzEkle(){
    if(document.getElementById('barkodBtn')) return;
    const serit = document.getElementById('araTipSec');
    if(serit){
      const b = document.createElement('button');
      b.className = 'mini-chip'; b.id = 'barkodBtn';
      b.dataset.act = 'barkod-ac';
      b.style.marginLeft = 'auto';
      b.textContent = '📷 Barkod / ISBN';
      serit.appendChild(b);
    }
    if(document.getElementById('barkodOrtu')) return;
    const o = document.createElement('div');
    o.className = 'ortu'; o.id = 'barkodOrtu';
    o.innerHTML =
      '<div class="sheet">' +
        '<div class="tutamac"></div>' +
        '<button class="sheet-kapat" data-act="barkod-kapat" aria-label="Kapat">✕</button>' +
        '<div class="sheet-baslik">Barkod veya ISBN</div>' +
        '<div style="margin-top:12px;border-radius:12px;overflow:hidden;background:#000;position:relative">' +
          '<video id="barkodVideo" playsinline muted style="width:100%;max-height:44vh;object-fit:cover;display:block"></video>' +
          '<div style="position:absolute;inset:22% 12%;border:2px solid rgba(255,253,247,.85);border-radius:10px;pointer-events:none"></div>' +
        '</div>' +
        '<div id="barkodNot" style="font-size:.82rem;color:var(--muted);margin-top:10px"></div>' +
        '<label for="barkodElle">ISBN\'i elle yaz</label>' +
        '<div style="display:flex;gap:8px">' +
          '<input id="barkodElle" inputmode="numeric" placeholder="978…" autocomplete="off" style="flex:1">' +
          '<button class="btn btn-brass" style="width:auto;padding:11px 18px" data-act="barkod-elle">Bul</button>' +
        '</div>' +
        '<div style="height:14px"></div>' +
        '<button class="btn btn-cerceve" data-act="barkod-kapat">Kapat</button>' +
      '</div>';
    document.body.appendChild(o);
    o.addEventListener('click', e => { if(e.target === o) kameraKapat(); });
  }

  function baslat(){
    arayuzEkle();
    document.addEventListener('click', async e => {
      const el = e.target.closest('[data-act]');
      if(!el) return;
      const act = el.dataset.act;
      if(act === 'yeni' || act === 'duzenle'){ setTimeout(arayuzEkle, 0); return; }
      if(act === 'barkod-ac'){ arayuzEkle(); kameraAc(); }
      else if(act === 'barkod-kapat'){ kameraKapat(); }
      else if(act === 'barkod-elle'){
        const v = document.getElementById('barkodElle').value;
        const ok = await isbnIsle(v, 'ISBN');
        if(ok){ document.getElementById('barkodElle').value = ''; kameraKapat(); }
      }
    });
  }

  if(document.getElementById('araTipSec')) baslat();
  else document.addEventListener('DOMContentLoaded', baslat);

  window.__barkod = { isbnGecerli, isbnTemizle, isbnAra, isbnIsle, formuDoldur, kameraVar };
})();
