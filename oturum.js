/* Kitaplık — okuma oturumu & seri eklentisi
   Gerçek süre ölçümü: başla/bitir, saatte kaç sayfa, günlük dakika, kesintisiz gün sayısı.
   Kendi kendine yeten modül: index.html'de tek satırlık script etiketiyle yüklenir. */
'use strict';
(function(){
  const OTURUM_ANAHTAR = 'kk_oturum_v1';   // açık oturum (tek seferde bir kitap)
  const UNUTMA_SINIRI = 4 * 60 * 60 * 1000; // 4 saat: muhtemelen kapatmayı unuttu
  let tikZaman = null;

  function bildir(m){ if(typeof toast === 'function') toast(m); }
  const kacir = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function acikOturum(){
    try{ return JSON.parse(localStorage.getItem(OTURUM_ANAHTAR)) || null; }catch(e){ return null; }
  }
  function oturumYaz(o){
    try{ o ? localStorage.setItem(OTURUM_ANAHTAR, JSON.stringify(o)) : localStorage.removeItem(OTURUM_ANAHTAR); }catch(e){}
  }
  function gunStr(ts){
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function sureMetni(ms){
    const dk = Math.max(0, Math.round(ms / 60000));
    if(dk < 60) return dk + ' dk';
    const s = Math.floor(dk / 60), k = dk % 60;
    return k ? s + ' sa ' + k + ' dk' : s + ' sa';
  }

  /* ---------- veri: k.oturumlar = [{b:baslangic, s:sureMs, sa:sayfaBaslangic, sb:sayfaBitis, sup:true?}] ---------- */
  function oturumEkle(k, kayit){
    k.oturumlar = Array.isArray(k.oturumlar) ? k.oturumlar : [];
    k.oturumlar.push(kayit);
    if(k.oturumlar.length > 400) k.oturumlar = k.oturumlar.slice(-400);
  }
  function toplamSure(k){
    return (k.oturumlar||[]).filter(o => !o.sup).reduce((t,o) => t + (o.s||0), 0);
  }
  function toplamSayfa(k){
    return (k.oturumlar||[]).filter(o => !o.sup)
      .reduce((t,o) => t + Math.max(0, (o.sb||0) - (o.sa||0)), 0);
  }
  function hizSayfaSaat(k){
    const sr = toplamSure(k), sy = toplamSayfa(k);
    if(sr < 5*60000 || sy <= 0) return null;
    return Math.round(sy / (sr / 3600000) * 10) / 10;
  }
  /* Tüm kitaplardan genel hız — yeni kitapta tahmin için */
  function genelHiz(){
    let sr = 0, sy = 0;
    (veri.kitaplar||[]).forEach(k => { sr += toplamSure(k); sy += toplamSayfa(k); });
    if(sr < 20*60000 || sy <= 0) return null;
    return Math.round(sy / (sr / 3600000) * 10) / 10;
  }

  /* ---------- seri & günlük dakika ---------- */
  function gunlukDakikalar(){
    const harita = {};
    (veri.kitaplar||[]).forEach(k => (k.oturumlar||[]).forEach(o => {
      if(o.sup || !o.b || !o.s) return;
      const g = gunStr(o.b);
      harita[g] = (harita[g]||0) + o.s;
    }));
    return harita;
  }
  function seriHesapla(harita){
    let seri = 0;
    const d = new Date();
    // bugün okumadıysa seri dünden başlar (gün henüz bitmedi, cezalandırma yok)
    if(!harita[gunStr(d.getTime())]) d.setDate(d.getDate() - 1);
    while(harita[gunStr(d.getTime())]){ seri++; d.setDate(d.getDate() - 1); }
    return seri;
  }
  function enUzunSeri(harita){
    const gunler = Object.keys(harita).sort();
    let en = 0, akt = 0, onceki = null;
    for(const g of gunler){
      if(onceki){
        const fark = Math.round((new Date(g) - new Date(onceki)) / 86400000);
        akt = fark === 1 ? akt + 1 : 1;
      }else akt = 1;
      if(akt > en) en = akt;
      onceki = g;
    }
    return en;
  }

  /* ---------- unutulan oturumu kapat ---------- */
  function unutulanKontrol(){
    const o = acikOturum();
    if(!o) return;
    if(Date.now() - o.b > UNUTMA_SINIRI){
      const k = (veri.kitaplar||[]).find(x => x.id === o.kitapId);
      if(k){
        oturumEkle(k, { b:o.b, s: UNUTMA_SINIRI, sa:o.sa, sb:o.sa, sup:true });
        if(typeof depoKaydet === 'function') depoKaydet();
      }
      oturumYaz(null);
      bildir('Açık kalan okuma oturumu kapatıldı — istatistiğe katılmadı');
    }
  }

  /* ---------- arayüz: detay sayfasına şerit ---------- */
  function detayGuncelle(){
    const kap = document.getElementById('detayIcerik');
    if(!kap || !document.getElementById('ortuDetay').classList.contains('acik')) return;
    if(typeof durum !== 'object' || !durum.detayId) return;
    const k = (veri.kitaplar||[]).find(x => x.id === durum.detayId);
    if(!k) return;

    let blok = document.getElementById('oturumBlok');
    if(!blok){
      blok = document.createElement('div');
      blok.className = 'detay-satir'; blok.id = 'oturumBlok';
      const hedefEl = kap.querySelector('.detay-satir') || kap.lastElementChild;
      kap.insertBefore(blok, hedefEl);
    }
    const o = acikOturum();
    const bende = o && o.kitapId === k.id;
    const sr = toplamSure(k), hz = hizSayfaSaat(k);
    const ozet = sr > 0
      ? '<div class="hiz-kutu">Bu kitapla geçirdiğin süre: <b>' + sureMetni(sr) + '</b>'
        + (hz ? '<br>Okuma hızın: <b>' + hz + ' sayfa/saat</b>' : '')
        + ((hz && k.sayfa && k.guncelSayfa < k.sayfa)
            ? '<br>Kalan ' + (k.sayfa - k.guncelSayfa) + ' sayfa ≈ <b>'
              + sureMetni((k.sayfa - k.guncelSayfa) / hz * 3600000) + '</b>' : '')
        + '</div>'
      : '';

    if(bende){
      const gecen = Date.now() - o.b;
      blok.innerHTML = '<label>Okuma oturumu</label>'
        + '<div class="hiz-kutu" style="border-color:var(--brass)">Okuyorsun — <b id="oturumSayac">'
        + sureMetni(gecen) + '</b> (başlangıç sayfası: ' + (o.sa||0) + ')</div>'
        + '<div class="ilerleme-guncelle" style="margin-top:10px">'
        + '<input type="number" inputmode="numeric" min="0" ' + (k.sayfa ? 'max="'+k.sayfa+'"' : '')
        + ' id="oturumSayfa" value="' + (k.guncelSayfa||o.sa||0) + '">'
        + '<span>' + (k.sayfa ? '/ ' + k.sayfa + ' sayfada kaldım' : 'sayfada kaldım') + '</span>'
        + '<button class="btn btn-brass" style="width:auto;padding:9px 14px" data-act="oturum-bitir">Bitir</button>'
        + '</div>'
        + '<button class="btn btn-cerceve" style="margin-top:8px" data-act="oturum-iptal">Oturumu iptal et</button>'
        + ozet;
      sayacBaslat();
    }else{
      const baskaKitap = o && o.kitapId !== k.id;
      blok.innerHTML = '<label>Okuma oturumu</label>'
        + (baskaKitap
            ? '<div class="hiz-kutu">Başka bir kitapta açık oturum var. Önce onu bitir.</div>'
            : '<button class="btn btn-brass" data-act="oturum-basla">▶ Okumaya başla (süre tut)</button>')
        + ozet;
      sayacDurdur();
    }
  }
  function sayacBaslat(){
    sayacDurdur();
    tikZaman = setInterval(() => {
      const o = acikOturum(), el = document.getElementById('oturumSayac');
      if(!o || !el){ sayacDurdur(); return; }
      el.textContent = sureMetni(Date.now() - o.b);
    }, 30000);
  }
  function sayacDurdur(){ if(tikZaman){ clearInterval(tikZaman); tikZaman = null; } }

  /* ---------- istatistik bölümü ---------- */
  function istatistikEkle(){
    const kap = document.getElementById('istIcerik');
    if(!kap || document.getElementById('oturumIst')) return;
    const harita = gunlukDakikalar();
    const gunSayisi = Object.keys(harita).length;
    if(!gunSayisi) return;

    const toplamMs = Object.values(harita).reduce((a,b) => a+b, 0);
    const seri = seriHesapla(harita), enUzun = enUzunSeri(harita);
    const hz = genelHiz();
    const ortDk = Math.round(toplamMs / gunSayisi / 60000);

    // son 30 gün ısı şeridi
    const kutular = [];
    const enBuyuk = Math.max(...Object.values(harita));
    for(let i = 29; i >= 0; i--){
      const d = new Date(); d.setDate(d.getDate() - i);
      const g = gunStr(d.getTime()), v = harita[g] || 0;
      const yogun = v ? Math.max(0.25, v / enBuyuk) : 0;
      kutular.push('<div title="' + g + (v ? ' · ' + sureMetni(v) : '') + '" style="flex:1;height:26px;border-radius:3px;'
        + (v ? 'background:var(--brass);opacity:' + yogun.toFixed(2) : 'background:var(--surface2)') + '"></div>');
    }

    const blok = document.createElement('div');
    blok.className = 'ist-kart'; blok.id = 'oturumIst';
    blok.innerHTML = '<div class="ist-bolum-baslik">Okuma alışkanlığı</div>'
      + '<div class="ist-grid" style="margin-top:10px">'
      + '<div><div class="ist-sayi">' + seri + '</div><div class="ist-etiket">gün üst üste</div></div>'
      + '<div><div class="ist-sayi">' + ortDk + '</div><div class="ist-etiket">okuduğun günlerde ort. dakika</div></div>'
      + '</div>'
      + '<div class="mini-not">Toplam <b>' + sureMetni(toplamMs) + '</b> okuma, ' + gunSayisi + ' ayrı günde.'
      + (hz ? ' Genel hızın <b>' + hz + ' sayfa/saat</b>.' : '')
      + (enUzun > seri ? ' En uzun serin ' + enUzun + ' gün.' : '') + '</div>'
      + '<div style="display:flex;gap:2px;margin-top:12px">' + kutular.join('') + '</div>'
      + '<div style="font-size:.7rem;color:var(--muted2);margin-top:5px">son 30 gün</div>';
    const ilk = kap.querySelector('.ist-kart');
    ilk ? kap.insertBefore(blok, ilk.nextSibling) : kap.appendChild(blok);
  }

  /* ---------- olaylar ---------- */
  function baslat(){
    unutulanKontrol();

    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if(!el) return;
      const act = el.dataset.act;

      if(act === 'oturum-basla'){
        const k = (veri.kitaplar||[]).find(x => x.id === durum.detayId);
        if(!k) return;
        if(acikOturum()){ bildir('Zaten açık bir oturum var'); return; }
        oturumYaz({ kitapId: k.id, b: Date.now(), sa: k.guncelSayfa || 0 });
        if(k.durum === 'okunacak' || k.durum === 'yarim'){
          k.durum = 'okunuyor';
          k.baslamaTarihi = k.baslamaTarihi || (typeof bugun === 'function' ? bugun() : null);
          depoKaydet();
          if(typeof hepsiniCiz === 'function') hepsiniCiz();
          if(typeof detayAc === 'function') detayAc(k.id);
        }
        detayGuncelle();
        bildir('Süre başladı — iyi okumalar');
        return;
      }
      if(act === 'oturum-bitir'){
        const o = acikOturum();
        const k = o && (veri.kitaplar||[]).find(x => x.id === o.kitapId);
        if(!o || !k) return;
        const alan = document.getElementById('oturumSayfa');
        const yeniSayfa = alan ? (parseInt(alan.value) || 0) : (k.guncelSayfa||0);
        const sb = k.sayfa ? Math.min(yeniSayfa, k.sayfa) : yeniSayfa;
        const sure = Date.now() - o.b;
        oturumEkle(k, { b:o.b, s:sure, sa:o.sa, sb: Math.max(o.sa, sb) });
        if(sb > (k.guncelSayfa||0)) k.guncelSayfa = sb;
        oturumYaz(null);
        depoKaydet();
        if(typeof hepsiniCiz === 'function') hepsiniCiz();
        if(typeof detayAc === 'function') detayAc(k.id);
        const okunan = Math.max(0, sb - o.sa);
        bildir(sureMetni(sure) + ' okudun' + (okunan ? ', ' + okunan + ' sayfa' : ''));
        return;
      }
      if(act === 'oturum-iptal'){
        if(confirm('Bu oturum kaydedilmeden iptal edilsin mi?')){
          oturumYaz(null); detayGuncelle(); bildir('Oturum iptal edildi');
        }
        return;
      }
      // detay/sekme etkileşimlerinden sonra şeridi tazele
      if(['detay','duzenle','bitir','baslat','ilerleme-kaydet','not-ekle','not-sil',
          'odunc-ver','odunc-al','alinti-git'].indexOf(act) >= 0){
        setTimeout(detayGuncelle, 0);
      }
      if(act === 'sekme' && el.dataset.v === 'ist') setTimeout(istatistikEkle, 0);
      if(act === 'detay-kapat') sayacDurdur();
    });

    // istatistik sekmesi zaten açıksa
    setTimeout(istatistikEkle, 0);
    // hedef kaydedilince istatistik yeniden çizilir; şeridimizi geri koy
    const gozlem = new MutationObserver(() => {
      if(document.getElementById('panel-ist').classList.contains('active')
         && !document.getElementById('oturumIst')) istatistikEkle();
    });
    const ist = document.getElementById('istIcerik');
    if(ist) gozlem.observe(ist, { childList:true });
  }

  if(document.getElementById('detayIcerik')) baslat();
  else document.addEventListener('DOMContentLoaded', baslat);

  window.__oturum = { acikOturum, oturumYaz, sureMetni, hizSayfaSaat, genelHiz,
    gunlukDakikalar, seriHesapla, enUzunSeri, toplamSure, toplamSayfa, detayGuncelle,
    istatistikEkle, unutulanKontrol, UNUTMA_SINIRI };
})();
