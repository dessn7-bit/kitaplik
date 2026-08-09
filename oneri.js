'use strict';
/* Kitaplık — "Ne okusam?" öneri motoru (ad alanı: on-)
   Tamamen YEREL ve açıklanabilir skorlama; dış servis yok, ML yok.

   SKOR BİLEŞENLERİ (ağırlık gerekçeleri):
   - Seri devamı        0 / +35   En güçlü sinyal: yarım seri, kullanıcının kendi
                                  başlattığı ve sürdürme niyeti taşıdığı tek işaret.
   - Yazar yakınlığı  −30 / +30   Doğrudan kalite deneyimi (n≥1). İMZALI: düşük
                                  puanlı yazarın kitabı aşağı itilir.
   - Tür yakınlığı    −20 / +20   Yazar kadar spesifik değil; n≥2 eşiği altında
                                  NÖTR (tek kitaplık tür genellenemez).
   - Etiket yakınlığı   0 / +15   Puan≥8 verilen kitapların etiketleriyle örtüşme
                                  (+5/etiket). Pozitif-yalnız: etiketsizlik ceza değil.
   - Bekleme süresi     0 / +10   gün/60 (600 günde tavan). Raf adaleti: eskiyen
                                  kitap görünür kalsın.
   - Uzunluk uygunluğu  0 / +8    Son 90 günde bitenlerin ortalama sayfasına
                                  yakınlık. ZAYIF ve pozitif-yalnız: sayfa bilgisi
                                  olmayan kitap CEZALANDIRILMAZ (bileşen 0 kalır).
   - Yayınevi           KULLANILMIYOR (karar): aynı yayınevi çok farklı tür/kalite
                                  basar; sinyal zayıf ve "X yayınevine 7 verdin"
                                  gerekçesi anlamsız duruyor.
   AÇIKLANABİLİRLİK (v48): gerekçe LİSTE bağlamında atanır (nedenAta) — kitabın
   en ÖZGÜL sinyalinin cümlesi; özgüllük sırası yazar > seri > etiket > tür >
   bekleme (Kaan kararı — skor ağırlığı DEĞİL: skor sıralamayı, özgüllük anlatımı
   yönetir). Aynı cümle listede İKİ KEZ GÖRÜNMEZ: kullanılmış cümle atlanır,
   kitap bir sonraki sinyaline düşer; benzersiz özgül sinyal kalmadıysa dürüst
   genel cümle (sayı yinelenmez), o da tükenirse gerekçesiz. Bekleme yalnız
   GEÇERLİ eklenme damgasıyla ve ≥90 günde yazılır (v49: "1 gündür bekliyor"
   gerekçe değildir); sinyalsiz kitap dürüst itirafla listede kalır.
   Uydurma gerekçe yok.
   AZ VERİ: puanlı bitirilmiş kitap < 3 ise skorlamaya GİRİLMEZ — dürüst mesaj +
   en uzun bekleyenler listesi gösterilir.
   ÇEŞİTLİLİK: ilk 5'te aynı yazardan en fazla 2, aynı türden en fazla 3 —
   tekdüze liste işe yaramaz; kota katıdır, havuz yetmezse liste kısalır.
   İSTEK LİSTESİ (karar): ana liste yalnız SAHİP olunanlar (elinde olan hemen
   başlanabilir); istekler ayrı ince bölümde en fazla 2 öneri olarak gösterilir —
   karışık listede "elimde yok" hayal kırıklığı yaratır, ayrı bölümde alışveriş
   sinyali olur. */
(function(){
  const ERTELEME_GUN = 30;
  const MIN_PUANLI = 3;   // bu sayının altında puanlı bitmiş kitapla skor uydurma olur
  const AGIRLIK = { seri: 35, yazar: 30, tur: 20, etiket: 15, bekleme: 10, uzunluk: 8 };
  const MIN_TUR_KITAP = 2;
  const ANA_SAYI = 5, ISTEK_SAYI = 2;

  function bildir(m){ if(typeof toast === 'function') toast(m); }
  function fmt(x){ return x.toFixed(1).replace('.', ','); }
  function kat(s){ return (typeof katla === 'function') ? katla(s) : String(s || '').toLowerCase(); }
  function iKat(s){ return (typeof iKatla === 'function') ? iKatla(s) : String(s || '').toLowerCase(); }

  function ertelemeAktif(k){
    if(!k.ertelemeTarihi) return false;
    return gunFarki(k.ertelemeTarihi, bugun()) < ERTELEME_GUN;
  }
  /* Bekleme yalnız GEÇERLİ eklenme damgasıyla anlamlı (v48): damga yok/<=0,
     gelecekte ya da absürt eski (>600 ay) ise null — cümle HİÇ kurulmaz.
     (v47 canlı kanıtı: bozuk damga "689 aydır rafta bekliyor" üretmişti.) */
  const BEKLEME_TAVAN_GUN = 600 * 30;   // 600 ay
  /* GEREKÇE eşiği (v49): bekleme ancak 3 ay (90 gün) üzerinde anlatılmaya değer.
     "1 gündür rafta bekliyor" kitabın dün eklendiğini söyler, NEDEN okunacağını
     değil (canlı v48 kanıtı). 90 gün: skor katkısı o noktada 1.5 puana ulaşır
     (gün/60) — sinyal ancak orada "unutulmuş kitap" anlatısına dönüşüyor;
     beklemeCumle'nin "aydır" dili de 60. günden sonra başlıyor. */
  const BEKLEME_GEREKCE_GUN = 90;
  function beklemeGun(k){
    if(!(k.eklenme > 0)) return null;
    const gun = Math.floor((Date.now() - k.eklenme) / 86400000);
    if(gun < 0 || gun > BEKLEME_TAVAN_GUN) return null;
    return gun;
  }
  function beklemeCumle(k){
    const gun = beklemeGun(k);
    if(gun === null) return '';
    return gun >= 60 ? Math.floor(gun / 30) + ' aydır rafta bekliyor'
                     : gun + ' gündür rafta bekliyor';
  }
  /* Gerekçe ataması LİSTE bağlamında (v48) — özgüllük sırası + tekillik.
     Her parça (birincil + katkısı ≥10 ikincil) kullanılan kümesine ayrı girer;
     böylece birleşik cümleler de kendiliğinden farklılaşır. Keşfet aynı motoru
     kullanacak: düzeltme BURADA, arayüzlerde kopya yok. */
  const GEREKCE_SIRA = ['yazar', 'seri', 'etiket', 'tur', 'bekleme'];
  function nedenAta(liste){
    const kullanilan = new Set();
    liste.forEach(o => {
      const c = o.cumleler || {};
      const b = o.bilesenler || {};
      const parcalar = [];
      for(const ad of GEREKCE_SIRA){
        if(parcalar.length >= 2) break;
        if(!c[ad] || kullanilan.has(c[ad])) continue;
        if(parcalar.length && b[ad] < 10) continue;   // ikincil için güç eşiği
        parcalar.push(c[ad]);
        kullanilan.add(c[ad]);
      }
      if(!parcalar.length){
        /* Genel yedek İKİ AYRI durum (v49):
           - kitapta sinyal VAR ama cümleleri listede kullanılmış → tür-genel
             (yalnız tür gerçekten pozitifken) ya da nötr raf cümlesi;
           - kitapta HİÇ sinyal yok → dürüst itiraf. KARAR: sinyalsiz kitap
             listeden ATILMAZ — veri yokluğu kitabın aleyhine kanıt değil,
             küçük kütüphanede liste boşalır ve "önerilecek kitap yok" yalanı
             doğardı; cümle sayı uydurmaz, denemeye davet eder. */
        const sinyalVar = Object.keys(c).length > 0;
        const genel = !sinyalVar
          ? 'Hakkında yeterli veri yok — denemeye değer.'
          : (b.tur > 0 && o.kitap.tur)
            ? o.kitap.tur + ' türünden kitapları beğeniyorsun'
            : 'Rafında seni bekliyor.';
        if(!kullanilan.has(genel)){ parcalar.push(genel); kullanilan.add(genel); }
      }
      o.neden = parcalar.join(' · ');   // hiçbir parça kalmadıysa '' — UI nedensiz çizer
    });
  }

  /* Kitap düzeyinde okuma geçmişi özeti — ARŞİVLİ okumalar (yeniden-oku) dahil.
     rapor.js ile aynı semantik: "yeniden oku" puanı okumalar[]'a taşır; oradaki
     bitmiş/puanlı okumalar da gerçek okuma olayıdır. Bunlar sayılmazsa yeniden
     okunan kitap az-veri eşiğinden düşer, yazar/seri sinyali sessizce kaybolur. */
  function okumaOzet(k){
    const arsiv = Array.isArray(k.okumalar) ? k.okumalar : [];
    const bitti = k.durum === 'bitti' || arsiv.some(o => o && o.bit);
    let puan = (k.durum === 'bitti' && k.puan >= 1) ? k.puan : null;
    if(puan === null) for(let i = arsiv.length - 1; i >= 0; i--){
      const o = arsiv[i];
      if(o && o.bit && o.puan >= 1){ puan = o.puan; break; } // en güncel puanlı okuma
    }
    let sonBit = (k.durum === 'bitti' && k.bitisTarihi) ? k.bitisTarihi : null;
    arsiv.forEach(o => { if(o && o.bit && (!sonBit || o.bit > sonBit)) sonBit = o.bit; });
    return { bitti, puan, sonBit };
  }

  /* ---------- skorlama ---------- */
  function hesapla(){
    const kitaplar = (typeof veri === 'object' && Array.isArray(veri.kitaplar)) ? veri.kitaplar : [];
    const ozetler = new Map(kitaplar.map(k => [k.id, okumaOzet(k)]));
    const bittiler = kitaplar.filter(k => ozetler.get(k.id).bitti);
    const puanlilar = bittiler.filter(k => ozetler.get(k.id).puan !== null);

    const adaylar = kitaplar.filter(k => k.durum === 'okunacak' && !ertelemeAktif(k));
    const sahipler = adaylar.filter(k => (k.sahiplik || 'sahip') === 'sahip');
    const istekler = adaylar.filter(k => k.sahiplik === 'istek');

    if(puanlilar.length < MIN_PUANLI){
      // AZ VERİ: skor yok, uydurma gerekçe yok — en uzun bekleyenler (gerçek neden);
      // gerekçeler burada da nedenAta'dan geçer (geçersiz damga = beklemesiz, tekillik)
      const bekleyen = sahipler.slice()
        .sort((a, b) => (a.eklenme || 0) - (b.eklenme || 0))
        .slice(0, ANA_SAYI)
        .map(k => {
          const c = {};
          const gun = beklemeGun(k);
          if(gun !== null && gun >= BEKLEME_GEREKCE_GUN) c.bekleme = beklemeCumle(k);
          return { kitap: k, skor: null, bilesenler: {}, cumleler: c };
        });
      nedenAta(bekleyen);
      return { mod: 'az-veri', puanliSayi: puanlilar.length, esik: MIN_PUANLI,
        ana: bekleyen, istek: [] };
    }

    // yazar / tür istatistikleri (yalnız puanlı bitmişlerden; puan = kitap başına
    // en güncel puanlı okuma — güncel ya da arşivli)
    const yazarIst = new Map(), turIst = new Map();
    puanlilar.forEach(k => {
      const p = ozetler.get(k.id).puan;
      if(k.yazar){
        const a = kat(k.yazar), o = yazarIst.get(a) || { toplam: 0, n: 0 };
        o.toplam += p; o.n++; yazarIst.set(a, o);
      }
      if(k.tur){
        const a = kat(k.tur), o = turIst.get(a) || { toplam: 0, n: 0 };
        o.toplam += p; o.n++; turIst.set(a, o);
      }
    });
    // beğenilen etiketler (puan≥8) — etiket kimliği iKatla (uygulama kuralı)
    const sevilen = new Map();
    puanlilar.filter(k => ozetler.get(k.id).puan >= 8).forEach(k =>
      (k.etiketler || []).forEach(e => { const a = iKat(e); if(!sevilen.has(a)) sevilen.set(a, e); }));
    // seri: bitmiş ciltler
    const seriIst = new Map();
    bittiler.forEach(k => {
      if(k.seri && k.ciltNo){
        const a = kat(k.seri), o = seriIst.get(a) || { ciltler: [] };
        if(o.ciltler.indexOf(k.ciltNo) < 0) o.ciltler.push(k.ciltNo);
        seriIst.set(a, o);
      }
    });
    // son 90 günde bitenlerin ortalama sayfası (arşivli okumaların bitişi dahil)
    const sinir = Date.now() - 90 * 86400000;
    const sonSayfa = bittiler.filter(k => {
      const b = ozetler.get(k.id).sonBit;
      return b && new Date(b).getTime() >= sinir && k.sayfa > 0;
    }).map(k => k.sayfa);
    const ortSayfa = sonSayfa.length ? sonSayfa.reduce((a, b) => a + b, 0) / sonSayfa.length : null;

    function degerlendir(k){
      const b = {};                 // bileşen -> puan
      const cumleler = {};          // bileşen -> gerçek-veri cümlesi
      // seri devamı: bitmiş en büyük cildin hemen SONRAKİ cildi (karar: aradaki
      // cilt atlanmışsa "devam" sayılmaz, diğer bileşenler yine çalışır)
      if(k.seri && k.ciltNo){
        const s = seriIst.get(kat(k.seri));
        if(s && s.ciltler.length && s.ciltler.indexOf(k.ciltNo) < 0 &&
           k.ciltNo === Math.max.apply(null, s.ciltler) + 1){
          b.seri = AGIRLIK.seri;
          cumleler.seri = k.seri + ' serisinin ' + k.ciltNo + '. cildi — önceki ' +
            s.ciltler.length + ' cildi bitirdin';
        }
      }
      if(k.yazar){
        const y = yazarIst.get(kat(k.yazar));
        if(y){
          const ort = y.toplam / y.n;
          b.yazar = (ort - 5.5) / 4.5 * AGIRLIK.yazar;
          if(b.yazar > 0)
            cumleler.yazar = k.yazar + ': bitirdiğin ' + y.n + ' kitaba ortalama ' + fmt(ort) + ' verdin';
        }
      }
      if(k.tur){
        const t = turIst.get(kat(k.tur));
        if(t && t.n >= MIN_TUR_KITAP){
          const ort = t.toplam / t.n;
          b.tur = (ort - 5.5) / 4.5 * AGIRLIK.tur;
          if(b.tur > 0)
            cumleler.tur = k.tur + ' türünde ' + t.n + ' kitaba ortalama ' + fmt(ort) + ' verdin';
        }
      }
      const ortak = (k.etiketler || []).filter(e => sevilen.has(iKat(e)));
      if(ortak.length){
        b.etiket = Math.min(AGIRLIK.etiket, ortak.length * 5);
        cumleler.etiket = 'beğendiğin kitaplarla ortak etiket: ' + ortak.slice(0, 3).join(', ');
      }
      if(ortSayfa && k.sayfa > 0){
        const f = Math.abs(k.sayfa - ortSayfa) / ortSayfa;
        const u = Math.max(0, AGIRLIK.uzunluk * (1 - f));
        if(u > 0){
          b.uzunluk = u;
          if(u >= 6) cumleler.uzunluk = k.sayfa + ' sayfa — son dönemde okuduğun uzunlukta';
        }
      }
      // bekleme yalnız geçerli damgayla puana girer (v48); CÜMLE ayrıca
      // gerekçe eşiğini ister (v49) — kısa bekleme skorda önemsiz kalır
      // (1 gün ≈ 0.02 puan), gerekçe olaraksa hiç kullanılmaz.
      const bGun = beklemeGun(k);
      if(bGun !== null){
        b.bekleme = Math.min(AGIRLIK.bekleme, bGun / 60);
        if(bGun >= BEKLEME_GEREKCE_GUN) cumleler.bekleme = beklemeCumle(k);
      }

      const skor = Object.values(b).reduce((a, x) => a + x, 0);
      // neden BURADA atanmaz: liste bağlamı gerekir (tekillik) — hesapla
      // sonunda nedenAta seçilen öğelere yazar.
      return { kitap: k, skor, bilesenler: b, cumleler };
    }

    const sirala = (a, b) => b.skor - a.skor || (a.kitap.eklenme || 0) - (b.kitap.eklenme || 0);
    const sahipSkor = sahipler.map(degerlendir).sort(sirala);
    const istekSkor = istekler.map(degerlendir).sort(sirala).slice(0, ISTEK_SAYI);
    const anaSecim = cesitlilikSec(sahipSkor, ANA_SAYI);
    // gerekçe tekilliği GÖSTERİLEN listenin tamamında (panel ana+istek birlikte çizer)
    nedenAta(anaSecim.concat(istekSkor));
    return { mod: 'skor', puanliSayi: puanlilar.length, esik: MIN_PUANLI,
      ana: anaSecim, istek: istekSkor };
  }

  /* İlk N'de aynı yazardan ≤2, aynı türden ≤3 — kota katı, havuz yetmezse kısalır */
  function cesitlilikSec(sirali, n){
    const secilen = [], ySay = new Map(), tSay = new Map();
    for(const a of sirali){
      if(secilen.length >= n) break;
      const y = kat(a.kitap.yazar || ''), t = kat(a.kitap.tur || '');
      if(y && (ySay.get(y) || 0) >= 2) continue;
      if(t && (tSay.get(t) || 0) >= 3) continue;
      secilen.push(a);
      if(y) ySay.set(y, (ySay.get(y) || 0) + 1);
      if(t) tSay.set(t, (tSay.get(t) || 0) + 1);
    }
    return secilen;
  }

  /* ---------- arayüz ---------- */
  function kapakHtml(k){
    if(k.kapakYerel && window.__kapak)
      return '<img class="on-kapak" data-kp-id="' + escAttr(k.id) + '"' +
        (k.kapak ? ' data-kp-yedek="' + escAttr(k.kapak) + '"' : '') + ' alt="">';
    if(k.kapak)
      return '<img class="on-kapak" src="' + escAttr(k.kapak) + '" alt="" loading="lazy">';
    return '<div class="on-yedek" style="background:' + sirtRenk(k.ad) + '"></div>';
  }
  function ogeHtml(o, enYuksek, enDusuk, istekMi){
    const k = o.kitap;
    let bar = '';
    if(o.skor !== null){
      const aralik = (enYuksek - enDusuk) || 1;
      // kelepçe: aralık dışı skor (ör. istek öğesi) ya da bozuk girdi asla
      // negatif/NaN genişlik üretmesin — geçersiz width bar'ı TAM DOLU gösterirdi
      const yuzde = Math.max(5, Math.min(100, Math.round(((o.skor - enDusuk) / aralik) * 90 + 10)));
      if(Number.isFinite(yuzde))
        bar = '<div class="on-bar" role="img" aria-label="uygunluk göstergesi">' +
          '<div class="on-bar-ic" style="width:' + yuzde + '%"></div></div>';
    }
    return '<div class="on-item" data-id="' + escAttr(k.id) + '">' +
      kapakHtml(k) +
      '<div class="on-icerik">' +
        '<button class="on-ad" data-act="on-detay" data-id="' + escAttr(k.id) + '">' + esc(k.ad) + '</button>' +
        (k.yazar ? '<div class="on-yazar">' + esc(k.yazar) + '</div>' : '') +
        '<div class="on-neden">' + esc(o.neden) + '</div>' +
        bar +
        '<div class="on-satir">' +
          (istekMi ? '<span class="on-rozet">İstek listende</span>'
                   : '<button class="on-btn on-btn-birincil" data-act="on-basla" data-id="' + escAttr(k.id) + '">Okumaya başla</button>') +
          '<button class="on-btn" data-act="on-ertele" data-id="' + escAttr(k.id) + '">Şimdi değil</button>' +
        '</div>' +
      '</div></div>';
  }
  function panelCiz(){
    const kap = document.getElementById('oneriIcerik');
    if(!kap) return;
    const s = hesapla();
    let html = '';
    if(!s.ana.length && !s.istek.length){
      html = '<div class="on-mesaj">Okunacak listende önerilebilecek kitap yok — rafına kitap ekle,' +
        ' ya da "Şimdi değil" dediklerin ' + ERTELEME_GUN + ' gün sonra geri gelir.</div>';
    }else if(s.mod === 'az-veri'){
      html = '<div class="on-mesaj">Henüz kişisel öneri için yeterli veri yok: puan verdiğin ' +
        'bitmiş kitap sayısı ' + s.puanliSayi + ' (en az ' + s.esik + ' gerekir). ' +
        'Kitap bitirip puanladıkça öneriler sana göre şekillenir. ' +
        'Şimdilik en uzun süredir bekleyenler:</div>' +
        s.ana.map(o => ogeHtml(o, 0, 0, false)).join('');
    }else{
      // bar ölçeği ana+istek birlikte: ana boşken (hepsi erteli, istek dolu)
      // boş diziden -Infinity/NaN üretmesin
      const skorlar = s.ana.concat(s.istek).map(o => o.skor);
      const enY = Math.max.apply(null, skorlar), enD = Math.min.apply(null, skorlar);
      html = s.ana.map(o => ogeHtml(o, enY, enD, false)).join('');
      if(s.istek.length){
        html += '<div class="on-bolum-baslik">İstek listenden — eline geçerse bunlar da sana göre</div>' +
          s.istek.map(o => ogeHtml(o, enY, enD, true)).join('');
      }
    }
    kap.innerHTML = html;
  }
  function panelAc(){
    panelCiz();
    const o = document.getElementById('ortuOneri');
    if(o){
      o.classList.add('acik');
      if(typeof ortuAriaKur === 'function') ortuAriaKur(o);
    }
  }

  function baslat(){
    // örtü dışına tıklayınca kapat — diğer pencerelerle aynı davranış
    const ortu = document.getElementById('ortuOneri');
    if(ortu) ortu.addEventListener('click', e => {
      if(e.target.id === 'ortuOneri') ortu.classList.remove('acik');
    });
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if(!el) return;
      switch(el.dataset.act){
        case 'on-ac': panelAc(); break;
        case 'on-kapat': {
          const o = document.getElementById('ortuOneri');
          if(o) o.classList.remove('acik');
          break; }
        case 'on-detay':
          if(typeof detayAc === 'function') detayAc(el.dataset.id);
          break;
        case 'on-basla': {
          const k = kitapBul(el.dataset.id);
          // bayat düğme koruması: panel açıkken kitabın durumu detaydan değişmiş
          // olabilir — koşulsuz yazmak bitmiş kitabın bitiş tarihini silerdi
          if(!k || k.durum !== 'okunacak'){ panelCiz(); bildir('Liste güncellendi — kitabın durumu değişmiş'); return; }
          // yalnız durum değişir; okuma OTURUMU başlatılmaz (ayrı, bilinçli eylem)
          k.durum = 'okunuyor';
          k.baslamaTarihi = k.baslamaTarihi || bugun();
          k.bitisTarihi = null;
          depoKaydet();
          if(typeof hepsiniCiz === 'function') hepsiniCiz();
          panelCiz();
          bildir('İyi okumalar');
          break; }
        case 'on-ertele': {
          const k = kitapBul(el.dataset.id);
          if(!k || k.durum !== 'okunacak'){ panelCiz(); return; } // bayat düğme → tazele
          k.ertelemeTarihi = bugun();
          depoKaydet();
          panelCiz();
          bildir(ERTELEME_GUN + ' gün sonra yeniden önerilir');
          break; }
      }
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
  else baslat();

  window.__oneri = { hesapla, cesitlilikSec, panelAc, panelCiz,
    ERTELEME_GUN, MIN_PUANLI, AGIRLIK };
})();
