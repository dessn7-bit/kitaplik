/* Kitaplik -- fikir defteri eklentisi */
'use strict';
(function(){
  var T = {
    tumFikirler: 'T\u00fcm fikirler',
    fikirEkle: 'Fikir etiketi ekle\u2026',
    ekle: 'Ekle',
    bosluk: 'Hen\u00fcz fikir etiketi yok. Bir al\u0131nt\u0131ya etiket ekle, ayn\u0131 fikri farkl\u0131 kitaplarda izle.',
    eklendi: 'Fikir eklendi: ',
    silindi: 'Fikir etiketi kald\u0131r\u0131ld\u0131',
    kitapta: ' kitapta',
    kayit: ' kay\u0131t',
    fikirBasligi: 'Fikir: '
  };

  function kacir(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  function bildir(m){ if(typeof toast === 'function') toast(m); }
  function normEtiket(s){
    return String(s || '').trim().replace(/^#/, '').replace(/\s+/g, ' ').slice(0, 40);
  }

  var secili = '';

  function tumNotlar(){
    var cikti = [];
    (veri.kitaplar || []).forEach(function(k){
      (k.notlar || []).forEach(function(n){ cikti.push({ n: n, k: k }); });
    });
    return cikti;
  }
  function notBul(id){
    var hepsi = tumNotlar();
    for(var i = 0; i < hepsi.length; i++) if(hepsi[i].n.id === id) return hepsi[i];
    return null;
  }
  function fikirSayimlari(){
    var say = {};
    tumNotlar().forEach(function(x){
      (x.n.fikir || []).forEach(function(e){
        if(!say[e]) say[e] = { kayit: 0, kitaplar: {} };
        say[e].kayit++; say[e].kitaplar[x.k.id] = 1;
      });
    });
    return say;
  }
  function fikirEkleNota(notId, etiket){
    var b = notBul(notId);
    if(!b) return false;
    var e = normEtiket(etiket);
    if(!e) return false;
    b.n.fikir = Array.isArray(b.n.fikir) ? b.n.fikir : [];
    var varMi = b.n.fikir.some(function(x){
      return String(x).toLocaleLowerCase('tr') === e.toLocaleLowerCase('tr');
    });
    if(!varMi) b.n.fikir.push(e);
    if(typeof depoKaydet === 'function') depoKaydet();
    return !varMi;
  }
  function fikirSilNottan(notId, etiket){
    var b = notBul(notId);
    if(!b || !Array.isArray(b.n.fikir)) return;
    b.n.fikir = b.n.fikir.filter(function(x){ return x !== etiket; });
    if(typeof depoKaydet === 'function') depoKaydet();
  }

  function bulutCiz(){
    var kap = document.getElementById('alintiIcerik');
    if(!kap) return;
    var eski = document.getElementById('fikirBulut');
    if(eski) eski.remove();

    var say = fikirSayimlari();
    var etiketler = Object.keys(say).sort(function(a, b){
      return say[b].kayit - say[a].kayit || a.localeCompare(b, 'tr');
    });

    var blok = document.createElement('div');
    blok.id = 'fikirBulut';
    blok.style.margin = '2px 0 4px';
    if(!etiketler.length){
      blok.innerHTML = '<div style="font-size:.78rem;color:var(--muted2);line-height:1.5">' + T.bosluk + '</div>';
    }else{
      var parcalar = ['<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px">'];
      parcalar.push('<button class="mini-chip' + (secili ? '' : ' secili') +
        '" data-act="fikir-filtre" data-v="" style="flex:0 0 auto">' + T.tumFikirler + '</button>');
      etiketler.forEach(function(e){
        var kitapSayi = Object.keys(say[e].kitaplar).length;
        parcalar.push('<button class="mini-chip' + (secili === e ? ' secili' : '') +
          '" data-act="fikir-filtre" data-v="' + kacir(e) + '" style="flex:0 0 auto">#' + kacir(e) +
          ' <span style="opacity:.7">' + say[e].kayit + (kitapSayi > 1 ? '/' + kitapSayi + '\u25a0' : '') +
          '</span></button>');
      });
      parcalar.push('</div>');
      blok.innerHTML = parcalar.join('');
    }
    var arama = document.getElementById('alintiArama');
    if(arama) kap.insertBefore(blok, arama);
    else kap.appendChild(blok);
  }

  function kartlariZenginlestir(){
    var kap = document.getElementById('alintiIcerik');
    if(!kap) return;
    var hepsi = tumNotlar();
    var kartlar = kap.querySelectorAll('.not-kart');
    Array.prototype.forEach.call(kartlar, function(kart){
      if(kart.dataset.fikirHazir === '1') return;
      var metinEl = kart.querySelector('.not-metin');
      if(!metinEl) return;
      var metin = metinEl.textContent;
      var esles = null;
      for(var i = 0; i < hepsi.length; i++) if(hepsi[i].n.metin === metin){ esles = hepsi[i]; break; }
      if(!esles) return;
      kart.dataset.fikirHazir = '1';
      kart.dataset.notId = esles.n.id;

      var alt = document.createElement('div');
      alt.style.marginTop = '8px';
      alt.innerHTML = etiketSatiri(esles.n) +
        '<div style="display:flex;gap:6px;margin-top:7px">' +
          '<input class="fikir-giris" data-nid="' + esles.n.id + '" placeholder="' + T.fikirEkle +
            '" autocomplete="off" style="flex:1;font-size:.82rem;padding:7px 10px">' +
          '<button class="mini-chip" data-act="fikir-ekle" data-nid="' + esles.n.id + '">' + T.ekle + '</button>' +
        '</div>';
      kart.appendChild(alt);
    });
  }
  function etiketSatiri(n){
    var et = n.fikir || [];
    if(!et.length) return '';
    return '<div style="display:flex;flex-wrap:wrap;gap:5px">' + et.map(function(e){
      return '<span class="mini-chip" style="padding:3px 9px;font-size:.72rem">#' + kacir(e) +
        ' <button data-act="fikir-sil" data-nid="' + n.id + '" data-v="' + kacir(e) +
        '" style="color:var(--muted2);margin-left:2px">\u00d7</button></span>';
    }).join('') + '</div>';
  }

  function filtreUygula(){
    var kap = document.getElementById('alintiIcerik');
    if(!kap) return;
    var eskiBaslik0 = document.getElementById('fikirBaslik');
    if(eskiBaslik0) eskiBaslik0.remove();
    if(!secili){
      Array.prototype.forEach.call(kap.querySelectorAll('.not-kart'), function(kart){
        kart.style.display = '';
      });
      return;
    }
    var kartlar = kap.querySelectorAll('.not-kart');
    var gorunen = 0;
    Array.prototype.forEach.call(kartlar, function(kart){
      var id = kart.dataset.notId;
      var b = id ? notBul(id) : null;
      var uygun = b && (b.n.fikir || []).indexOf(secili) >= 0;
      kart.style.display = uygun ? '' : 'none';
      if(uygun) gorunen++;
    });
    var say = fikirSayimlari()[secili];
    var kitapSayi = say ? Object.keys(say.kitaplar).length : 0;
    var h = document.createElement('div');
    h.id = 'fikirBaslik';
    h.style.cssText = 'font-size:.82rem;color:var(--muted);margin:6px 0 2px';
    h.innerHTML = '<b style="color:var(--brass)">' + T.fikirBasligi + '#' + kacir(secili) + '</b> \u2014 ' +
      gorunen + T.kayit + ', ' + kitapSayi + T.kitapta;
    var bulut = document.getElementById('fikirBulut');
    if(bulut && bulut.nextSibling) kap.insertBefore(h, bulut.nextSibling);
  }

  function tazele(){
    if(!document.getElementById('panel-alinti') ||
       !document.getElementById('panel-alinti').classList.contains('active')) return;
    bulutCiz(); kartlariZenginlestir(); filtreUygula();
  }

  function detayZenginlestir(){
    var kap = document.getElementById('detayIcerik');
    if(!kap) return;
    var kartlar = kap.querySelectorAll('.not-kart');
    if(!kartlar.length) return;
    var k = (veri.kitaplar || []).filter(function(x){ return x.id === durum.detayId; })[0];
    if(!k) return;
    Array.prototype.forEach.call(kartlar, function(kart){
      if(kart.dataset.fikirHazir === '1') return;
      var metinEl = kart.querySelector('.not-metin');
      if(!metinEl) return;
      var n = (k.notlar || []).filter(function(x){ return x.metin === metinEl.textContent; })[0];
      if(!n) return;
      kart.dataset.fikirHazir = '1';
      kart.dataset.notId = n.id;
      var alt = document.createElement('div');
      alt.style.marginTop = '8px';
      alt.innerHTML = etiketSatiri(n) +
        '<div style="display:flex;gap:6px;margin-top:7px">' +
          '<input class="fikir-giris" data-nid="' + n.id + '" placeholder="' + T.fikirEkle +
            '" autocomplete="off" style="flex:1;font-size:.82rem;padding:7px 10px">' +
          '<button class="mini-chip" data-act="fikir-ekle" data-nid="' + n.id + '">' + T.ekle + '</button>' +
        '</div>';
      kart.appendChild(alt);
    });
  }

  function baslat(){
    document.addEventListener('click', function(e){
      var el = e.target.closest('[data-act]');
      if(!el) return;
      var act = el.dataset.act;

      if(act === 'fikir-filtre'){
        secili = el.dataset.v || '';
        tazele();
        return;
      }
      if(act === 'fikir-ekle'){
        var nid = el.dataset.nid;
        var giris = document.querySelector('.fikir-giris[data-nid="' + nid + '"]');
        if(!giris) return;
        var deger = giris.value;
        if(!normEtiket(deger)){ return; }
        var yeni = fikirEkleNota(nid, deger);
        giris.value = '';
        bildir(yeni ? T.eklendi + '#' + normEtiket(deger) : '#' + normEtiket(deger));
        yenidenCiz();
        return;
      }
      if(act === 'fikir-sil'){
        fikirSilNottan(el.dataset.nid, el.dataset.v);
        bildir(T.silindi);
        yenidenCiz();
        return;
      }
      if(act === 'sekme' && el.dataset.v === 'alinti') setTimeout(tazele, 0);
      if(act === 'detay' || act === 'not-ekle' || act === 'not-sil' || act === 'alinti-git')
        setTimeout(detayZenginlestir, 0);
    });

    document.addEventListener('keydown', function(e){
      if(e.key !== 'Enter') return;
      var t = e.target;
      if(!t || !t.classList || !t.classList.contains('fikir-giris')) return;
      e.preventDefault();
      var nid = t.dataset.nid;
      if(!normEtiket(t.value)) return;
      var yeni = fikirEkleNota(nid, t.value);
      var etiket = normEtiket(t.value);
      t.value = '';
      bildir(yeni ? T.eklendi + '#' + etiket : '#' + etiket);
      yenidenCiz();
    });

    function yenidenCiz(){
      if(typeof alintiCiz === 'function' &&
         document.getElementById('panel-alinti').classList.contains('active')){
        alintiCiz(); setTimeout(tazele, 0);
      }else{
        setTimeout(detayZenginlestir, 0);
      }
    }

    var hedef = document.getElementById('alintiIcerik');
    if(hedef && window.MutationObserver){
      new MutationObserver(function(){
        if(document.getElementById('panel-alinti').classList.contains('active') &&
           !document.getElementById('fikirBulut')) setTimeout(tazele, 0);
      }).observe(hedef, { childList: true });
    }
    setTimeout(tazele, 0);
  }

  if(document.getElementById('alintiIcerik')) baslat();
  else document.addEventListener('DOMContentLoaded', baslat);

  window.__fikir = { fikirSayimlari: fikirSayimlari, fikirEkleNota: fikirEkleNota,
    fikirSilNottan: fikirSilNottan, normEtiket: normEtiket, tazele: tazele,
    detayZenginlestir: detayZenginlestir, secilenAl: function(){ return secili; },
    secilenYaz: function(v){ secili = v; } };
})();
