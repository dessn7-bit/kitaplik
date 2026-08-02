/* Kitaplık — raf görünümü eklentisi
   1) Çoklu seçim + toplu düzenleme (raf ata, etiket ekle, durum değiştir, sil)
   2) Kapak ızgarası görünümü (isteğe bağlı rafa göre gruplama)
   Kendi kendine yeten modül: index.html'de tek satırlık script etiketiyle yüklenir. */
'use strict';
(function(){
  const GORUNUM_ANAHTAR = 'kk_gorunum_v1';
  let secimModu = false;
  let secilenler = new Set();
  let izgara = false, rafGrupla = false;
  let basmaZaman = null, basmaId = null;

  const kacir = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function bildir(m){ if(typeof toast === 'function') toast(m); }
  function kitapBulL(id){ return (veri.kitaplar||[]).find(k => k.id === id); }

  function ayarYukle(){
    try{
      const a = JSON.parse(localStorage.getItem(GORUNUM_ANAHTAR)) || {};
      izgara = !!a.izgara; rafGrupla = !!a.rafGrupla;
    }catch(e){}
  }
  function ayarYaz(){
    try{ localStorage.setItem(GORUNUM_ANAHTAR, JSON.stringify({ izgara, rafGrupla })); }catch(e){}
  }

  function stilEkle(){
    if(document.getElementById('gorunumStil')) return;
    const s = document.createElement('style');
    s.id = 'gorunumStil';
    s.textContent = `
      #liste.izgara{display:grid;grid-template-columns:repeat(auto-fill,minmax(104px,1fr));gap:12px}
      #liste.izgara .kart{flex-direction:column;background:transparent;border:none;box-shadow:none;padding:0}
      #liste.izgara .kart .kart-ic{padding:6px 2px 0}
      #liste.izgara .kart-baslik{font-size:.82rem;line-height:1.25;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      #liste.izgara .kart-yazar{font-size:.72rem;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #liste.izgara .kart-alt,#liste.izgara .ilerleme-txt{display:none}
      #liste.izgara .iz-kapak{width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:8px;
        border:1px solid var(--border);background:var(--surface2);box-shadow:0 2px 6px rgba(90,75,50,.14)}
      #liste.izgara .iz-yedek{width:100%;aspect-ratio:2/3;border-radius:8px;display:flex;align-items:flex-end;
        padding:8px;font-family:var(--serif);font-size:.8rem;color:#FFFDF7;line-height:1.2;
        box-shadow:0 2px 6px rgba(90,75,50,.14);overflow:hidden}
      .raf-basligi{grid-column:1/-1;font-size:.8rem;color:var(--muted);margin:6px 0 -4px;letter-spacing:.03em}
      .kart.secili{outline:2px solid var(--brass);outline-offset:2px;border-radius:12px}
      .secim-isaret{position:absolute;top:6px;right:6px;width:24px;height:24px;border-radius:50%;
        background:var(--brass);color:#FFFDF7;display:flex;align-items:center;justify-content:center;
        font-size:.8rem;z-index:3;box-shadow:0 1px 4px rgba(0,0,0,.2)}
      .toplu-cubuk{position:fixed;left:0;right:0;bottom:calc(64px + env(safe-area-inset-bottom));z-index:31;
        background:var(--surface);border-top:1px solid var(--brass-dim);padding:10px 14px;
        display:flex;gap:8px;align-items:center;flex-wrap:wrap;box-shadow:0 -3px 12px rgba(90,75,50,.12)}
      .toplu-cubuk .sayi{font-size:.85rem;color:var(--brass);font-weight:600;margin-right:auto}
      .toplu-cubuk button{padding:8px 12px;border-radius:8px;border:1px solid var(--border);
        background:var(--surface2);font-size:.8rem;color:var(--paper)}
      .toplu-cubuk button.tehlike{border-color:var(--drop);color:var(--drop)}
      .gorunum-dugme{padding:6px 10px;border-radius:8px;border:1px solid var(--border);
        background:var(--surface);font-size:.8rem;color:var(--muted)}
      .gorunum-dugme.aktif{background:var(--brass);color:#FFFDF7;border-color:var(--brass)}
    `;
    document.head.appendChild(s);
  }

  function dugmeEkle(){
    const satir = document.querySelector('.sort-row');
    if(!satir || document.getElementById('izgaraBtn')) return;
    const b = document.createElement('button');
    b.id = 'izgaraBtn'; b.className = 'gorunum-dugme' + (izgara ? ' aktif' : '');
    b.dataset.act = 'gorunum-degis';
    b.textContent = izgara ? '☰ Liste' : '▦ Izgara';
    satir.insertBefore(b, satir.firstChild.nextSibling);
    const s = document.createElement('button');
    s.id = 'secimBtn'; s.className = 'gorunum-dugme';
    s.dataset.act = 'secim-ac';
    s.textContent = '✓ Seç';
    satir.insertBefore(s, b);
  }

  function sirtRenkL(ad){
    const renkler = ['#C89B4B','#8FA86B','#B06A4A','#7E8FA6','#A67E9E','#8A6A33','#6BA0A8','#B58F5E'];
    let h = 0;
    for(const ch of String(ad)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
    return renkler[h % renkler.length];
  }
  function izgaraCiz(){
    const kap = document.getElementById('liste');
    if(!kap) return;
    const idler = [...kap.querySelectorAll('.kart')].map(k => k.dataset.id).filter(Boolean);
    if(!idler.length){ kap.classList.remove('izgara'); return; }
    kap.classList.add('izgara');
    const kitaplar = idler.map(kitapBulL).filter(Boolean);

    let parcalar = [];
    if(rafGrupla){
      const gruplar = new Map();
      kitaplar.forEach(k => {
        const r = k.raf || '— raf belirtilmemiş —';
        if(!gruplar.has(r)) gruplar.set(r, []);
        gruplar.get(r).push(k);
      });
      [...gruplar.keys()].sort((a,b) => a.localeCompare(b,'tr')).forEach(r => {
        parcalar.push('<div class="raf-basligi">' + kacir(r) + ' · ' + gruplar.get(r).length + '</div>');
        gruplar.get(r).forEach(k => parcalar.push(kartHtml(k)));
      });
    }else{
      kitaplar.forEach(k => parcalar.push(kartHtml(k)));
    }
    kap.innerHTML = parcalar.join('');
    kapakHatalariniBagla(kap, kitaplar);
    secimGorselTazele();
  }
  /* Kapak yüklenemezse yedek sırtı DOM API'siyle kurar.
     Satır içi onerror KULLANILMAZ: attribute değeri iki kez çözüldüğü için
     kitap adındaki apostrof JS dizesini kapatıp kod çalıştırabiliyordu. */
  function yedekSirtKoy(img, ad){
    if(!img || !img.parentNode) return;
    const d = document.createElement('div');
    d.className = 'iz-yedek';
    d.style.background = sirtRenkL(ad);
    d.textContent = String(ad == null ? '' : ad);
    img.parentNode.replaceChild(d, img);
  }
  function kapakHatalariniBagla(kap, kitaplar){
    const harita = new Map(kitaplar.map(k => [k.id, k]));
    kap.querySelectorAll('.kart').forEach(kart => {
      const img = kart.querySelector('img.iz-kapak');
      if(!img) return;
      const k = harita.get(kart.dataset.id);
      const ad = k ? k.ad : '';
      img.addEventListener('error', () => yedekSirtKoy(img, ad), { once: true });
      if(img.complete && img.naturalWidth === 0) yedekSirtKoy(img, ad); // dinleyiciden önce düşmüşse
    });
  }
  function kartHtml(k){
    const gorsel = k.kapak
      ? '<img class="iz-kapak" src="' + kacir(k.kapak) + '" alt="" loading="lazy">'
      : '<div class="iz-yedek" style="background:' + sirtRenkL(k.ad) + '">' + kacir(k.ad) + '</div>';
    const rozet = k.durum === 'okunuyor'
      ? '<div style="position:absolute;top:6px;left:6px;background:var(--brass);color:#FFFDF7;' +
        'font-size:.62rem;padding:2px 6px;border-radius:999px">okunuyor</div>' : '';
    return '<button class="kart" data-act="detay" data-id="' + k.id + '" style="position:relative">' +
      gorsel + rozet +
      '<div class="kart-ic"><div class="kart-baslik">' + kacir(k.ad) + '</div>' +
      (k.yazar ? '<div class="kart-yazar">' + kacir(k.yazar) + '</div>' : '') +
      '</div></button>';
  }

  function secimAc(id){
    secimModu = true;
    secilenler = new Set(id ? [id] : []);
    cubukCiz(); secimGorselTazele();
  }
  function secimKapat(){
    secimModu = false; secilenler.clear();
    const c = document.getElementById('topluCubuk');
    if(c) c.remove();
    secimGorselTazele();
  }
  function secimGorselTazele(){
    document.querySelectorAll('#liste .kart').forEach(kart => {
      const id = kart.dataset.id;
      const eski = kart.querySelector('.secim-isaret');
      if(eski) eski.remove();
      kart.classList.toggle('secili', secimModu && secilenler.has(id));
      if(secimModu && secilenler.has(id)){
        kart.style.position = 'relative';
        const i = document.createElement('div');
        i.className = 'secim-isaret'; i.textContent = '✓';
        kart.appendChild(i);
      }
    });
    cubukSayiTazele();
  }
  function cubukCiz(){
    if(document.getElementById('topluCubuk')) return;
    const c = document.createElement('div');
    c.className = 'toplu-cubuk'; c.id = 'topluCubuk';
    c.innerHTML =
      '<span class="sayi" id="topluSayi">0 seçili</span>' +
      '<button data-act="toplu-tumu">Tümü</button>' +
      '<button data-act="toplu-raf">Raf ata</button>' +
      '<button data-act="toplu-etiket">Etiket</button>' +
      '<button data-act="toplu-durum">Durum</button>' +
      '<button class="tehlike" data-act="toplu-sil">Sil</button>' +
      '<button data-act="toplu-cik">Çık</button>';
    document.body.appendChild(c);
  }
  function cubukSayiTazele(){
    const el = document.getElementById('topluSayi');
    if(el) el.textContent = secilenler.size + ' seçili';
  }

  function pencereAc(baslik, icerik, act){
    let o = document.getElementById('topluOrtu');
    if(!o){
      o = document.createElement('div');
      o.className = 'ortu'; o.id = 'topluOrtu';
      document.body.appendChild(o);
      o.addEventListener('click', e => { if(e.target === o) o.classList.remove('acik'); });
    }
    o.innerHTML = '<div class="sheet">' +
      '<div class="tutamac"></div>' +
      '<button class="sheet-kapat" data-act="toplu-kapat" aria-label="Kapat">✕</button>' +
      '<div class="sheet-baslik">' + baslik + '</div>' +
      icerik +
      '<div class="form-alt">' +
        '<button class="btn btn-cerceve" data-act="toplu-kapat" style="flex:1">Vazgeç</button>' +
        '<button class="btn btn-brass" data-act="' + act + '" style="flex:2">Uygula</button>' +
      '</div></div>';
    o.classList.add('acik');
  }

  function topluRafAc(){
    const mevcut = new Set();
    (veri.kitaplar||[]).forEach(k => { if(k.raf) mevcut.add(k.raf); });
    pencereAc('Raf ata (' + secilenler.size + ' kitap)',
      '<label for="topluRafGiris">Raf konumu</label>' +
      '<input id="topluRafGiris" list="topluRafListe" placeholder="ör. üst raf sol blok" autocomplete="off">' +
      '<datalist id="topluRafListe">' +
        [...mevcut].sort((a,b)=>a.localeCompare(b,'tr')).map(r => '<option value="'+kacir(r)+'">').join('') +
      '</datalist>' +
      '<div class="mini-not">Boş bırakıp kaydedersen raf bilgisi silinir.</div>',
      'toplu-raf-uygula');
  }
  function topluEtiketAc(){
    const mevcut = new Set();
    (veri.kitaplar||[]).forEach(k => (k.etiketler||[]).forEach(e => mevcut.add(e)));
    pencereAc('Etiket ekle (' + secilenler.size + ' kitap)',
      '<label for="topluEtiketGiris">Etiketler (virgülle ayır)</label>' +
      '<input id="topluEtiketGiris" list="topluEtiketListe" placeholder="ör. felsefe, tekrar-okunacak" autocomplete="off">' +
      '<datalist id="topluEtiketListe">' +
        [...mevcut].sort((a,b)=>a.localeCompare(b,'tr')).map(r => '<option value="'+kacir(r)+'">').join('') +
      '</datalist>' +
      '<div class="mini-not">Mevcut etiketler korunur, bunlar eklenir.</div>',
      'toplu-etiket-uygula');
  }
  function topluDurumAc(){
    pencereAc('Durum değiştir (' + secilenler.size + ' kitap)',
      '<label for="topluDurumSec">Yeni durum</label>' +
      '<select id="topluDurumSec">' +
        '<option value="okunacak">Okunacak</option>' +
        '<option value="okunuyor">Okunuyor</option>' +
        '<option value="bitti">Bitti</option>' +
        '<option value="yarim">Yarım kaldı</option>' +
      '</select>' +
      '<div class="mini-not">Bitti seçersen bitiş tarihi bugün olarak yazılır (tarihi olmayanlara).</div>',
      'toplu-durum-uygula');
  }

  function secilenKitaplar(){
    return [...secilenler].map(kitapBulL).filter(Boolean);
  }
  function kaydetVeTazele(mesaj){
    if(typeof depoKaydet === 'function') depoKaydet();
    if(typeof hepsiniCiz === 'function') hepsiniCiz();
    const o = document.getElementById('topluOrtu');
    if(o) o.classList.remove('acik');
    bildir(mesaj);
    setTimeout(() => { izgaraTazele(); secimGorselTazele(); }, 0);
  }

  function izgaraTazele(){
    if(izgara) izgaraCiz();
    else {
      const kap = document.getElementById('liste');
      if(kap) kap.classList.remove('izgara');
    }
  }
  function listeyiBagla(){
    if(typeof window.listeCiz === 'function' && !window.listeCiz.__gorunum){
      const asil = window.listeCiz;
      const sarmal = function(){
        const s = asil.apply(this, arguments);
        dugmeEkle();
        izgaraTazele();
        secimGorselTazele();
        return s;
      };
      sarmal.__gorunum = true;
      window.listeCiz = sarmal;
    }
  }

  function baslat(){
    ayarYukle(); stilEkle(); listeyiBagla(); dugmeEkle(); izgaraTazele();

    document.addEventListener('click', e => {
      if(!secimModu) return;
      const kart = e.target.closest('#liste .kart');
      if(!kart) return;
      e.preventDefault(); e.stopPropagation();
      const id = kart.dataset.id;
      if(secilenler.has(id)) secilenler.delete(id); else secilenler.add(id);
      secimGorselTazele();
    }, true);

    const basla = e => {
      const kart = e.target.closest('#liste .kart');
      if(!kart || secimModu) return;
      basmaId = kart.dataset.id;
      basmaZaman = setTimeout(() => {
        if(basmaId){ secimAc(basmaId); bildir('Seçim modu — kartlara dokunarak seç'); }
      }, 550);
    };
    const bitir = () => { clearTimeout(basmaZaman); basmaId = null; };
    document.addEventListener('touchstart', basla, { passive: true });
    document.addEventListener('touchend', bitir);
    document.addEventListener('touchmove', bitir, { passive: true });
    document.addEventListener('mousedown', basla);
    document.addEventListener('mouseup', bitir);

    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if(!el) return;
      const act = el.dataset.act;

      if(act === 'gorunum-degis'){
        izgara = !izgara; ayarYaz();
        el.textContent = izgara ? '☰ Liste' : '▦ Izgara';
        el.classList.toggle('aktif', izgara);
        if(typeof listeCiz === 'function') listeCiz();
        return;
      }
      if(act === 'secim-ac'){ secimModu ? secimKapat() : secimAc(null); return; }
      if(act === 'toplu-cik'){ secimKapat(); return; }
      if(act === 'toplu-kapat'){
        const o = document.getElementById('topluOrtu');
        if(o) o.classList.remove('acik');
        return;
      }
      if(act === 'toplu-tumu'){
        const hepsi = [...document.querySelectorAll('#liste .kart')].map(k => k.dataset.id).filter(Boolean);
        if(secilenler.size === hepsi.length) secilenler.clear();
        else hepsi.forEach(id => secilenler.add(id));
        secimGorselTazele();
        return;
      }
      if(secilenler.size === 0 &&
         ['toplu-raf','toplu-etiket','toplu-durum','toplu-sil'].indexOf(act) >= 0){
        bildir('Önce kitap seç'); return;
      }
      if(act === 'toplu-raf'){ topluRafAc(); return; }
      if(act === 'toplu-etiket'){ topluEtiketAc(); return; }
      if(act === 'toplu-durum'){ topluDurumAc(); return; }
      if(act === 'toplu-sil'){
        const n = secilenler.size;
        if(!confirm(n + ' kitap kalıcı olarak silinsin mi? Notları ve oturumları da silinir.')) return;
        veri.silinenler = veri.silinenler || {};
        const t = Date.now();
        secilenler.forEach(id => { veri.silinenler[id] = t; });
        veri.kitaplar = veri.kitaplar.filter(k => !secilenler.has(k.id));
        secilenler.clear();
        kaydetVeTazele(n + ' kitap silindi');
        secimKapat();
        return;
      }
      if(act === 'toplu-raf-uygula'){
        const raf = (document.getElementById('topluRafGiris')||{}).value || '';
        const ks = secilenKitaplar();
        ks.forEach(k => { k.raf = raf.trim(); k.g = Date.now(); });
        kaydetVeTazele(ks.length + ' kitaba raf yazıldı');
        return;
      }
      if(act === 'toplu-etiket-uygula'){
        const ham = (document.getElementById('topluEtiketGiris')||{}).value || '';
        const yeni = ham.split(',').map(x => x.trim().replace(/^#/,'')).filter(Boolean);
        if(!yeni.length){ bildir('Etiket yaz'); return; }
        const ks = secilenKitaplar();
        ks.forEach(k => {
          k.etiketler = Array.isArray(k.etiketler) ? k.etiketler : [];
          yeni.forEach(e => {
            const var_ = k.etiketler.some(x => x.toLocaleLowerCase('tr') === e.toLocaleLowerCase('tr'));
            if(!var_) k.etiketler.push(e);
          });
          k.g = Date.now();
        });
        kaydetVeTazele(ks.length + ' kitaba etiket eklendi');
        return;
      }
      if(act === 'toplu-durum-uygula'){
        const d = (document.getElementById('topluDurumSec')||{}).value || 'okunacak';
        const ks = secilenKitaplar();
        const bgn = typeof bugun === 'function' ? bugun() : null;
        ks.forEach(k => {
          k.durum = d;
          if(d === 'bitti'){
            if(!k.bitisTarihi) k.bitisTarihi = bgn;
            if(k.sayfa) k.guncelSayfa = k.sayfa;
          }
          if(d === 'okunuyor' && !k.baslamaTarihi) k.baslamaTarihi = bgn;
          if(d === 'okunacak'){ k.guncelSayfa = 0; k.baslamaTarihi = null; k.bitisTarihi = null; }
          k.g = Date.now();
        });
        kaydetVeTazele(ks.length + ' kitabın durumu değişti');
        return;
      }
    });
  }

  if(document.getElementById('liste')) baslat();
  else document.addEventListener('DOMContentLoaded', baslat);

  window.__gorunum = { secimAc, secimKapat, izgaraCiz, izgaraTazele,
    secilenler: () => secilenler, izgaraMi: () => izgara,
    izgaraYaz: v => { izgara = v; ayarYaz(); },
    rafGruplaYaz: v => { rafGrupla = v; ayarYaz(); } };
})();
