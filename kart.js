/* Kitaplık — alıntı kartı eklentisi
   Bir alıntıyı/notu paylaşılabilir PNG görseline çevirir (1080×1350 dikey / 1080×1080 kare).
   Tamamen çevrimdışı: sistem fontları, dış kaynak yok.
   Kendi kendine yeten modül: index.html'de tek satırlık script etiketiyle yüklenir. */
'use strict';
(function(){
  const RENK = { zemin:'#F5EFE3', murekkep:'#2E2618', pirinc:'#A87D2F', soluk:'#7A6C50' };
  const SERIF = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
  const SANS = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';

  let acikBilgi = null;         // { metin, kitap, yazar, sayfa }
  let boyut = 'dikey';
  let sonCizim = null;

  function bildir(m){ if(typeof toast === 'function') toast(m); }

  /* ---------- metin sarma: kelime bazında, taşan tek kelime karakter bazında ---------- */
  function metniSar(c, metin, enFazla){
    const kelimeler = String(metin).replace(/\s+/g, ' ').trim().split(' ');
    const satirlar = [];
    let satir = '';
    for(const kelime of kelimeler){
      const aday = satir ? satir + ' ' + kelime : kelime;
      if(c.measureText(aday).width <= enFazla){ satir = aday; continue; }
      if(satir) satirlar.push(satir);
      if(c.measureText(kelime).width > enFazla){
        let parca = '';
        for(const ch of kelime){
          if(c.measureText(parca + ch).width > enFazla){ satirlar.push(parca); parca = ch; }
          else parca += ch;
        }
        satir = parca;
      }else satir = kelime;
    }
    if(satir) satirlar.push(satir);
    return satirlar;
  }
  function sigacakKadarKirp(c, metin, enFazla, ek){
    let m = String(metin);
    if(c.measureText(m + (ek || '')).width <= enFazla) return m + (ek || '');
    while(m.length > 1 && c.measureText(m + '…').width > enFazla) m = m.slice(0, -1);
    return m.replace(/[\s.,;:]+$/, '') + '…';
  }

  /* ---------- çizim: saf fonksiyon, test edilebilir metadata döndürür ---------- */
  function kartCiz(tuval, bilgi, secilenBoyut){
    const W = 1080, H = secilenBoyut === 'kare' ? 1080 : 1350;
    tuval.width = W; tuval.height = H;
    const c = tuval.getContext('2d');
    c.fillStyle = RENK.zemin;
    c.fillRect(0, 0, W, H);
    const kenar = 96, enG = W - kenar * 2;
    c.textBaseline = 'top';

    // büyük açılış tırnağı (pirinç)
    c.fillStyle = RENK.pirinc;
    c.font = 'italic 170px ' + SERIF;
    c.fillText('“', kenar - 12, 84);

    // alt bilgi satırları
    const altBilgi = [String(bilgi.kitap || '')];
    const yazarSatiri = [bilgi.yazar, bilgi.sayfa ? 'sf. ' + bilgi.sayfa : '']
      .filter(Boolean).join(' · ');
    if(yazarSatiri) altBilgi.push(yazarSatiri);

    // yerleşim (alttan yukarı): yazar satırı → kitap adı → pirinç çizgi → metin alanı
    const yazarY = H - kenar - 34;
    const kitapY = yazarSatiri ? yazarY - 52 : H - kenar - 44;
    const cizgiY = kitapY - 40;
    const metinUst = secilenBoyut === 'kare' ? 264 : 300;
    const metinAlt = cizgiY - 56;

    // sığdırma: 64px'ten 34px'e kademeli küçült, yine sığmazsa kırp + …
    let fontB = 64, satirlar = [], kirpildi = false;
    for(;;){
      c.font = 'italic ' + fontB + 'px ' + SERIF;
      satirlar = metniSar(c, bilgi.metin, enG);
      if(metinUst + satirlar.length * fontB * 1.45 <= metinAlt || fontB <= 34) break;
      fontB = Math.max(34, fontB - 5);
      if(fontB === 34){
        c.font = 'italic 34px ' + SERIF;
        satirlar = metniSar(c, bilgi.metin, enG);
        break;
      }
    }
    const satirYuk = Math.round(fontB * 1.45);
    const kapasite = Math.max(1, Math.floor((metinAlt - metinUst) / satirYuk));
    if(satirlar.length > kapasite){
      kirpildi = true;
      satirlar = satirlar.slice(0, kapasite);
      c.font = 'italic ' + fontB + 'px ' + SERIF;
      satirlar[satirlar.length - 1] =
        sigacakKadarKirp(c, satirlar[satirlar.length - 1].replace(/[\s.,;:]+$/, ''), enG - 1, '…');
    }

    // alıntı metni (mürekkep, serif italik)
    c.fillStyle = RENK.murekkep;
    c.font = 'italic ' + fontB + 'px ' + SERIF;
    satirlar.forEach((s, i) => c.fillText(s, kenar, metinUst + i * satirYuk));

    // pirinç ayraç + alt bilgi
    c.fillStyle = RENK.pirinc;
    c.fillRect(kenar, cizgiY, 72, 5);
    c.fillStyle = RENK.murekkep;
    c.font = '600 40px ' + SERIF;
    c.fillText(sigacakKadarKirp(c, altBilgi[0], enG, ''), kenar, kitapY);
    if(yazarSatiri){
      c.fillStyle = RENK.soluk;
      c.font = '30px ' + SANS;
      c.fillText(sigacakKadarKirp(c, yazarSatiri, enG, ''), kenar, yazarY);
    }

    sonCizim = {
      genislik: W, yukseklik: H, boyut: secilenBoyut === 'kare' ? 'kare' : 'dikey',
      fontBoyu: fontB, satirSayisi: satirlar.length, satirYuk,
      metinUst, metinAlt, sonSatirAlt: metinUst + satirlar.length * satirYuk,
      kirpildi, altBilgi
    };
    return sonCizim;
  }

  /* ---------- panel ---------- */
  function panelKur(){
    if(document.getElementById('kartOrtu')) return;
    const o = document.createElement('div');
    o.className = 'ortu'; o.id = 'kartOrtu';
    o.innerHTML = '<div class="sheet">'
      + '<div class="tutamac"></div>'
      + '<button class="sheet-kapat" data-act="kart-kapat" aria-label="Kapat">✕</button>'
      + '<div class="sheet-baslik">Alıntı kartı</div>'
      + '<div class="not-tip-sec" id="kartBoyutSec" style="margin-top:10px">'
      +   '<button class="mini-chip secili" data-act="kart-boyut" data-v="dikey">Dikey 4:5</button>'
      +   '<button class="mini-chip" data-act="kart-boyut" data-v="kare">Kare 1:1</button>'
      + '</div>'
      + '<div style="margin-top:12px;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface2)">'
      +   '<canvas id="kartTuval" style="width:100%;display:block"></canvas>'
      + '</div>'
      + '<div class="form-alt">'
      +   '<button class="btn btn-cerceve" id="kartPaylas" data-act="kart-paylas" style="flex:1;display:none">Paylaş</button>'
      +   '<button class="btn btn-brass" data-act="kart-indir" style="flex:2">PNG indir</button>'
      + '</div></div>';
    document.body.appendChild(o);
    o.addEventListener('click', e => { if(e.target === o) kapat(); });
  }
  function paylasVar(){
    try{
      if(!navigator.share || !navigator.canShare) return false;
      const f = new File([new Uint8Array(8)], 'kart.png', { type: 'image/png' });
      return navigator.canShare({ files: [f] });
    }catch(e){ return false; }
  }
  function cizVeGoster(){
    const tuval = document.getElementById('kartTuval');
    if(!tuval || !acikBilgi) return;
    kartCiz(tuval, acikBilgi, boyut);
    document.querySelectorAll('#kartBoyutSec .mini-chip').forEach(b =>
      b.classList.toggle('secili', b.dataset.v === boyut));
  }
  function ac(nid, kid){
    const k = (veri.kitaplar||[]).find(x => x.id === kid);
    const n = k && (k.notlar||[]).find(x => x.id === nid);
    if(!k || !n) return;
    acikBilgi = { metin: n.metin, kitap: k.ad, yazar: k.yazar || '', sayfa: n.sayfa || null };
    panelKur();
    document.getElementById('kartPaylas').style.display = paylasVar() ? '' : 'none';
    cizVeGoster();
    document.getElementById('kartOrtu').classList.add('acik');
  }
  function kapat(){
    const o = document.getElementById('kartOrtu');
    if(o) o.classList.remove('acik');
  }
  function indir(){
    const tuval = document.getElementById('kartTuval');
    if(!tuval) return;
    tuval.toBlob(blob => {
      if(!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'alinti-karti.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      bildir('Kart indirildi');
    }, 'image/png');
  }
  function paylas(){
    const tuval = document.getElementById('kartTuval');
    if(!tuval) return;
    tuval.toBlob(async blob => {
      if(!blob) return;
      try{
        await navigator.share({ files: [new File([blob], 'alinti-karti.png', { type: 'image/png' })] });
      }catch(e){ /* kullanıcı vazgeçti — sessiz */ }
    }, 'image/png');
  }

  /* ---------- kartlara düğme takma ---------- */
  function notBilgi(metin){
    for(const k of (veri.kitaplar||[]))
      for(const n of (k.notlar||[]))
        if(n.metin === metin) return { n, k };
    return null;
  }
  function dugmeTak(kapId){
    const kap = document.getElementById(kapId);
    if(!kap) return;
    kap.querySelectorAll('.not-kart').forEach(kart => {
      if(kart.dataset.paylasHazir === '1') return;
      const metinEl = kart.querySelector('.not-metin');
      if(!metinEl) return;
      const b = notBilgi(metinEl.textContent);
      if(!b) return;
      kart.dataset.paylasHazir = '1';
      const d = document.createElement('button');
      d.className = 'mini-chip';
      d.dataset.act = 'alinti-kart';
      d.dataset.nid = b.n.id;
      d.dataset.kid = b.k.id;
      d.style.marginTop = '8px';
      d.textContent = '🖼 Kart yap';
      kart.appendChild(d);
    });
  }
  function tazele(){ dugmeTak('alintiIcerik'); dugmeTak('detayIcerik'); }

  function baslat(){
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if(!el) return;
      const act = el.dataset.act;
      if(act === 'alinti-kart'){ ac(el.dataset.nid, el.dataset.kid); return; }
      if(act === 'kart-kapat'){ kapat(); return; }
      if(act === 'kart-indir'){ indir(); return; }
      if(act === 'kart-paylas'){ paylas(); return; }
      if(act === 'kart-boyut'){ boyut = el.dataset.v === 'kare' ? 'kare' : 'dikey'; cizVeGoster(); return; }
      setTimeout(tazele, 0); // sekme/detay/not işlemleri sonrası düğmeleri tak
    });
    const izle = id => {
      const el = document.getElementById(id);
      if(el && window.MutationObserver)
        new MutationObserver(() => setTimeout(tazele, 0)).observe(el, { childList: true, subtree: true });
    };
    izle('alintiIcerik');
    izle('detayIcerik');
    setTimeout(tazele, 0);
  }

  if(document.getElementById('alintiIcerik')) baslat();
  else document.addEventListener('DOMContentLoaded', baslat);

  window.__kart = { kartCiz, ac, kapat, paylasVar, tazele,
    sonCizim: () => sonCizim, boyutAl: () => boyut };
})();
