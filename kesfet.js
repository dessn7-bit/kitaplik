'use strict';
/* Kitaplık — KEŞFET sekmesi A aşaması (ad alanı: ks-), v50.
   "Rafından ne okusam": öneri motorunun TAM EKRAN hali. Motor oneri.js'te
   (window.__oneri) — burada YALNIZ görünüm + süzgeç durumu yaşar:
   hesaplaHam() ham sıralı listeyi verir; süzgeç → cesitlilikSec (yazar≤2)
   → nedenAta (gerekçe; tekillik GÖRÜNEN listede) → çizim. Ana Sayfa SIRADAKİ
   aynı motorun kırpılmış sarmalayıcısını (hesapla) kullanır — kopya gerekçe
   mantığı YOK (bu projede tekrar eden hata deseninin panzehiri).

   UZUNLUK EŞİKLERİ (karar): kısa <200 · orta 200-400 · uzun >400 sayfa —
   novella / standart roman / tuğla ayrımının yaygın yayıncılık eşikleri.
   Kütüphane-medyanına bağlı dinamik eşik hem açıklanamaz hem test-kararsız
   olurdu. Sayfası bilinmeyen kitap uzunluk süzgeci AÇIKKEN listeye girmez:
   bilinmeyeni bir kovaya saymak uydurma olur.

   SKOR GÖSTERİMİ (karar): ham sayı YOK — Ciltli'nin tek ilerleme kalıbı
   (3px altın konturlu kanal, 64px). Görünen liste içinde min-maks normalize,
   %10-100 kelepçe (eski panel dersi: geçersiz width bar'ı tam dolu gösterirdi).
   Az-veri modunda skor yok → çizgi hiç çizilmez. */
(function(){
  const SAYFA_ADIMI = 10;
  const UZUNLUK_AD = { kisa: 'Kısa', orta: 'Orta', uzun: 'Uzun' };
  const UZUNLUK_IPUCU = { kisa: '200 sayfadan az', orta: '200–400 sayfa', uzun: '400 sayfadan çok' };
  function uzunlukKova(sayfa){
    if(!(sayfa > 0)) return null;              // bilinmeyen: hiçbir kovaya girmez
    return sayfa < 200 ? 'kisa' : sayfa <= 400 ? 'orta' : 'uzun';
  }
  // süzgeç + liste durumu (cihaz-yerel, oturumluk — kalıcı tercih değil)
  const S = { sahiplik: 'sahip', tur: null, uzunluk: null, raf: null,
    limit: SAYFA_ADIMI, erteliAcik: false, gizliAcik: false };

  const CSS = [
    '#ksIcerik{padding:2px 16px 24px}',
    '.ks-ust{display:flex;align-items:flex-start;gap:10px;padding:0 0 4px}',
    '.ks-ust-ic{flex:1;min-width:0}',
    '.ks-baslik{font-family:var(--serif);font-size:1.8rem;font-weight:400;line-height:1.15;margin-top:2px}',
    '.ks-acilis{font-size:.78rem;color:var(--muted);margin-top:4px;letter-spacing:.02em;font-variant-numeric:tabular-nums}',
    '.ks-ust .zar-btn{flex:0 0 40px;height:40px;margin-top:6px}',
    '.ks-suz{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:6px 0;align-items:center}',
    '.ks-suz::-webkit-scrollbar{display:none}',
    '.ks-suz-ad{font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted2);flex:0 0 auto;margin-right:2px}',
    '.ks-chip{flex:0 0 auto;padding:7px 12px;border:1px solid var(--kontur);border-radius:var(--r-sm);' +
      'font-size:.78rem;color:var(--muted);background:transparent;white-space:nowrap}',
    // seçili çip metni PAPER: brass metin %7 tint üzerinde 4.23'e düşüyor (AA
    // kaçağı — g42 doğru renk çözücüyle ölçünce çıktı); seçililiği kontur +
    // tint + ağırlık verir, metin okunur kalır.
    '.ks-chip.secili{border-color:var(--brass);color:var(--paper);font-weight:600;' +
      'background:color-mix(in srgb,var(--brass) 7%,transparent)}',
    '.ks-item,.ks-b-item{display:flex;gap:12px;padding:14px 0;border-bottom:1px solid var(--cizgi)}',
    '.ks-ic{flex:1;min-width:0}',
    '.ks-ad{display:block;font-family:var(--serif);font-size:1.05rem;font-weight:600;line-height:1.25;' +
      'text-align:left;overflow-wrap:break-word;padding:0;background:none;border:none;color:var(--paper)}',
    '.ks-yazar,.ks-b-yazar{font-style:italic;font-size:.78rem;color:var(--muted);margin-top:1px}',
    '.ks-neden,.ks-b-neden{font-size:.8rem;color:var(--muted2);line-height:1.5;margin-top:4px}',
    '.ks-skor{display:block;width:64px}',
    '.ks-eylem{display:flex;gap:16px;margin-top:8px;align-items:center}',
    '.ks-basla,.ks-b-ekle{font-family:var(--serif);font-weight:600;font-size:.8rem;color:var(--brass);' +
      'padding:2px 0;position:relative;background:none;border:none}',
    '.ks-basla::after,.ks-b-ekle::after{content:"";position:absolute;inset:-8px}',
    '.ks-sessiz,.ks-b-gizle{font-size:.78rem;color:var(--muted);text-decoration:underline;text-underline-offset:3px;' +
      'text-decoration-color:var(--muted2);padding:2px 0;background:none;border:none}',
    '.ks-rozet{font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;color:var(--brass)}',
    '.ks-not{font-size:.85rem;color:var(--muted);line-height:1.5;padding:14px 0}',
    '.ks-daha{margin-top:14px}',
    '.ks-erteli,.ks-gizli{padding:14px 0}',
    '.ks-erteli-item{display:flex;align-items:center;justify-content:space-between;gap:10px;' +
      'padding:10px 0;border-bottom:1px solid var(--cizgi);font-size:.85rem;color:var(--muted)}',
    '.ks-erteli-ad{flex:1;min-width:0;overflow-wrap:break-word}',
    '.ks-erteli-sag{display:flex;align-items:center;gap:12px;white-space:nowrap}',
    '.ks-erteli-gun{font-size:.72rem;color:var(--muted2);font-variant-numeric:tabular-nums}',
    // ---- B bölümü: YENİ KİTAPLAR (kütüphane-dışı; v51) ----
    '.ks-b-bas{display:flex;align-items:center;justify-content:space-between;gap:10px;' +
      'padding:16px 0 6px;margin-top:8px;border-top:1px solid var(--cizgi)}',
    '.ks-b-ad{display:block;font-family:var(--serif);font-size:1.05rem;font-weight:600;' +
      'line-height:1.25;overflow-wrap:break-word}',
    '.ks-b-not{font-size:.85rem;color:var(--muted);line-height:1.5;padding:10px 0}',
    '.ks-b-getir{margin-top:8px}',
    // Kaynak etiketi: .ks-suz-ad ile AYNI tipografik rol (mikro versal, muted2)
    // — yeni bir görsel dil değil, kurulmuş bir rolün ikinci kullanımı.
    '.ks-b-kaynak{display:block;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;' +
      'color:var(--muted2);margin-bottom:2px}'
  ].join('\n');

  function chip(grup, deger, etiket, secili, ipucu){
    return '<button class="ks-chip' + (secili ? ' secili' : '') + '" data-act="ks-suz"' +
      ' data-g="' + grup + '" data-v="' + escAttr(deger) + '"' +
      (ipucu ? ' title="' + escAttr(ipucu) + '"' : '') + '>' + esc(etiket) + '</button>';
  }

  function ustHtml(h, havuzN, filtreliN, elemeNotu){
    const okunacakVar = typeof veri === 'object' && veri.kitaplar.some(k => k.durum === 'okunacak');
    const suzVar = S.tur || S.uzunluk || S.raf;
    // açılış cümlesi DÜRÜST: kaç aday, süzgeç kaçını geçirdi (sayı uydurma yok);
    // çeşitlilik kotası aday elediyse o da SÖYLENİR (v62 — "6 diyor, 5 var" bitti)
    const acilis = (!havuzN
      ? 'Okunacak aday yok'
      : h.mod === 'az-veri'
        ? havuzN + ' okunacak aday — şimdilik bekleme sırasına göre'
        : suzVar
          ? havuzN + ' aday · süzgeçten geçen: ' + filtreliN
          : havuzN + ' okunacak aday arasından, okuma geçmişine göre') + (elemeNotu || '');
    return '<div class="ks-ust"><div class="ks-ust-ic">' +
      '<span class="kicker">Rafından</span>' +
      '<h2 class="ks-baslik">Ne okusam?</h2>' +
      '<div class="ks-acilis">' + esc(acilis) + '</div></div>' +
      (okunacakVar ? '<button class="zar-btn" data-act="zar" title="Kader seçsin" ' +
        'aria-label="Okunacaklardan rastgele kitap öner">' +
        (window.ikon ? ikon('zar') : '') + '</button>' : '') +
      '</div>';
  }

  function suzgecHtml(turler, raflar){
    let html = '<div class="ks-suz"><span class="ks-suz-ad">Süz</span>' +
      chip('sahiplik', 'sahip', 'Bende', S.sahiplik === 'sahip') +
      chip('sahiplik', 'istek', 'İstek listem', S.sahiplik === 'istek') +
      Object.keys(UZUNLUK_AD).map(u =>
        chip('uzunluk', u, UZUNLUK_AD[u], S.uzunluk === u, UZUNLUK_IPUCU[u])).join('') +
      '</div>';
    if(turler.length)
      html += '<div class="ks-suz"><span class="ks-suz-ad">Tür</span>' +
        turler.map(t => chip('tur', t, t, S.tur === t)).join('') + '</div>';
    if(raflar.length)
      html += '<div class="ks-suz"><span class="ks-suz-ad">Raf</span>' +
        raflar.map(r => chip('raf', r, r, S.raf === r)).join('') + '</div>';
    return html;
  }

  function satirHtml(o, enY, enD){
    const k = o.kitap;
    let cizgi = '';
    if(o.skor !== null){
      const aralik = (enY - enD) || 1;
      const yuzde = Math.max(10, Math.min(100, Math.round(((o.skor - enD) / aralik) * 90 + 10)));
      if(Number.isFinite(yuzde))
        cizgi = '<span class="ilerleme ks-skor" role="img" aria-label="uygunluk göstergesi">' +
          '<span style="display:block;height:100%;background:var(--brass);width:' + yuzde + '%"></span></span>';
    }
    const eylem = (k.sahiplik === 'istek')
      ? '<span class="ks-rozet">İstek listende</span>'
      : '<button class="ks-basla" data-act="ks-basla" data-id="' + escAttr(k.id) + '">Okumaya başla</button>';
    return '<div class="ks-item">' +
      (typeof ktPlate === 'function' ? ktPlate(k, 'p-mini') : '') +
      '<div class="ks-ic">' +
        '<button class="ks-ad" data-act="detay" data-id="' + escAttr(k.id) + '">' + esc(k.ad) + '</button>' +
        (k.yazar ? '<div class="ks-yazar">' + esc(k.yazar) + '</div>' : '') +
        (o.neden ? '<div class="ks-neden">' + esc(o.neden) + '</div>' : '') +
        cizgi +
        '<div class="ks-eylem">' + eylem +
          '<button class="ks-sessiz" data-act="ks-ertele" data-id="' + escAttr(k.id) + '">Şimdi değil</button>' +
        '</div>' +
      '</div></div>';
  }

  /* ---------- B bölümü: YENİ KİTAPLAR (v51, tür kaynağı v52) ----------
     Kütüphanede OLMAYAN kitaplar; sinyaller SERİ + YAZAR + TÜR. TEMBEL: Keşfet
     açılışı sorgu ATMAZ (Rafından anlık kalsın, kota kullanıcı niyetine
     harcansın); kullanıcı "Yeni kitapları getir" der ya da taze önbellek varsa
     (ağ maliyeti sıfır) doğrudan gösterilir. Sorgular window.__ara üzerinden
     (canliAra ile AYNI kaynak yolu — kopya istemci yok).
     SIRA seri → yazar → tür: motorun kendi ağırlık sırası (seri 35 > yazar 30 >
     tür 20). Tür en zayıf sinyal, listenin sonunda durur. */
  const B_ONBELLEK = 'kk_kesfet_b_v1';
  /* TTL 24 saat: Google kotası günlük, yazar kataloğu günlük değişmez. Anahtar
     İMZA sorgu setinden (yazar+seri katla'lı) — kütüphane değişip sinyal seti
     değişirse önbellek kendiliğinden düşer. Cihaz-yerel, senkron DIŞI
     (türetilmiş veri DERIVED yazılmaz — W1 ilkesi). */
  const B_TTL_MS = 24 * 3600 * 1000;
  /* Kota: koşum başına ≤3 yazar + ≤3 seri sorgusu (≤6 istek). Google 1000/gün;
     24 saatlik önbellekle gün başına tek sorgu seti — kota güvenli. */
  const B_YAZAR_KOTA = 3, B_SERI_KOTA = 3, B_YAZAR_ADAY = 3, B_SERI_ADAY = 4;
  /* TÜR KOTASI 2 (3 değil): tür motorun en zayıf sinyali (ağırlık 20 vs yazar
     30 / seri 35) ve 3. sıradaki tür zaten ilk ikisinin altında kalmış bir
     ortalamadır — listeyi uzatır, isabeti artırmaz. Maliyet tarafı bağlayıcı
     değil (worker Cloudflare ücretsiz katmanında, kaynak 1000Kitap'ın kendi
     API'si); bağlayıcı olan 9 sn'lik iptal bütçesi, o da tür dalının Google
     döngüsüyle ÖRTÜŞMESİYLE korunuyor. */
  const B_TUR_KOTA = 2, B_TUR_ADAY = 4;
  const B_KAYNAK_AD = { seri: 'Seri', yazar: 'Yazar', tur: 'Tür' };
  const B = { durum: 'bekliyor', adaylar: null, gorunen: [] };

  /* ---- kullanıcı türü → 1000Kitap tür slug'ı (v52) ----
     UYDURMA EŞLEME YOK. Dört kademe, ilk isabet kazanır; hiçbiri tutmazsa tür
     ATLANIR. Bulanık/edit-mesafeli eşleme bilinçli olarak YOK: "Tarih" ile
     "Tarihi"yi birbirine bağlayan bir kural sessizce yanlış türü sorar ve
     kullanıcı bunu gerekçe cümlesinden anlayamaz.
       1) katlanmış tam eşleşme — slug
       2) katlanmış tam eşleşme — görünen ad
       3) SÖZCÜK eşleşmesi — slug sözcükleri
       4) SÖZCÜK eşleşmesi — görünen ad sözcükleri
     Sözcük eşiği 3 harf, ÖLÇÜMLE seçildi: 78 türün sözcük envanterinde 3
     harfli olanların hepsi gerçek tür adı (din, tıp, anı, fal, aşk); tek
     anlamsız parçalar 2 harfli ("ve", "iş"), onlar da eşiğin altında kalıyor.
     Kaynak listesi KENDİ sırasında (1000Kitap'ın gösterim sırası) taranır —
     aynı kademede birden çok tür tutarsa popüler olan kazanır, sonuç
     deterministik. kitapSayisi=0 türler (78'in 8'i: novella, arkeoloji, uzay…)
     havuzdan düşer: boş türe sorgu atmak kotayı harcar, sonuç dönmez. */
  function turAnahtar(s){ return katla(s).replace(/[^a-z0-9]+/g, ''); }
  function turSozcukler(s){
    return String(s || '').split(/[^A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû0-9]+/)
      .map(turAnahtar).filter(w => w.length >= 3);
  }
  function turEslestir(kullaniciTur, kaynakTurler){
    const a = turAnahtar(kullaniciTur);
    if(!a || !Array.isArray(kaynakTurler)) return null;
    const havuz = kaynakTurler.filter(t => t && t.seo && t.ad && t.kitapSayisi !== 0);
    for(const t of havuz) if(turAnahtar(t.seo) === a) return t;
    for(const t of havuz) if(turAnahtar(t.ad) === a) return t;
    if(a.length >= 3){
      for(const t of havuz) if(turSozcukler(t.seo).indexOf(a) >= 0) return t;
      for(const t of havuz) if(turSozcukler(t.ad).indexOf(a) >= 0) return t;
    }
    return null;   // eşleşme yok → bu tür ATLANIR
  }

  /* ---- ALAKA DENETİMİ (v53) ----
     KUSUR: dönen adayın gerçekten sorgulanan yazara ait olduğu doğrulanmıyordu.
     Canlı kanıt: kütüphanede "Yazar 0" varken öneriler "YOLCU — Metin Yazar",
     "İç ses — Meçhul yazar", "Baharla gelen — Erhan Bener (Türk yazar)" oldu ve
     hepsine "Yazar 0: bitirdiğin 3 kitaba ortalama 9,0 verdin" gerekçesi asıldı.

     SORGU SÖZDİZİMİ ÇÖZÜM DEĞİL (ölçüldü, Google Books canlı):
       inauthor:Yazar 0    →   5 sonuç, hepsi adında "yazar" GEÇEN başka yazarlar
       inauthor:"Yazar 0"  → 117 sonuç, tamamen alakasız (Library of Congress…)
       inauthor:"Ali Kemal"→ "Ali Kemal Sunal", "Ali Kemal Saran"
     Yani tırnak işi DÜZELTMİYOR, kötüleştiriyor. Tek güvenilir savunma DÖNEN
     sonucun kendisini denetlemek. Sorgu biçimi bilerek DEĞİŞTİRİLMEDİ.

     ASİMETRİ (bu projede aramanın TERSİ): katla() yorumunda "kaçırmak yanlış
     eşleşmekten daha pahalı" yazar — orada kullanıcı KENDİ kitabını arıyor.
     Burada tersi geçerli: yanlış öneri görünür çöp ve yanlış bir iddia taşır
     ("bu senin sevdiğin yazarın kitabı"), kaçan öneri görünmez. Bu yüzden
     denetim KATI; şüphede olan aday elenir, doldurma yapılmaz. */
  const GENEL_YAZAR = ['yazar', 'anonim', 'kolektif', 'anonymous', 'unknown',
    'various', 'derleme', 'muhtelif', 'bilinmiyor', 'bilinmeyen', 'yok'];
  /* Parantezli ekler SÖKÜLÜR: Google Books hem ayırt edici not ("Erhan Bener
     (Türk yazar)") hem alternatif yazım ("Halil Cibran (Kahlil Gibran)") için
     kullanıyor; ikisi de soyadı denetimini yanlış yerden kırardı. */
  function adSozcukler(s){
    return String(s || '')
      .replace(/\([^)]*\)/g, ' ')
      .split(/[^A-Za-zÇĞİÖŞÜçğıöşüÂÎÛâîû0-9]+/)
      .map(w => katla(w).replace(/[^a-z0-9]+/g, ''))
      .filter(Boolean);
  }
  /* Sorgulanabilirlik: hiç ANLAMLI sözcüğü olmayan ad kaynağa HİÇ sorulmaz —
     "Yazar 0", "Anonim", "Kolektif" gibi değerler kotayı harcar ve tanım gereği
     hiçbir gerçek eşleşme üretemez. (Tek harfli parçalar da anlamlı sayılmaz.) */
  function anlamliSozcukler(ad){
    return adSozcukler(ad).filter(w => w.length >= 2 && GENEL_YAZAR.indexOf(w) < 0);
  }
  function sorulabilirYazar(ad){ return anlamliSozcukler(ad).length > 0; }

  /* Yazar eşleşmesi — TR-katlamalı, iki kural:
     · ÇOK SÖZCÜKLÜ ad: adayın SON sözcüğü (soyadı) sorgununkiyle TAM eşleşmeli
       VE sorgunun ≥2 harfli tüm sözcükleri adayda geçmeli.
       - Soyadı TEK BAŞINA yetmez (vaka c): "Janet Asimov" ≠ "Isaac Asimov";
         Türkçede birçok ad aynı zamanda soyadıdır ("Yaşar Kemal"/"Kemal Tahir"),
         yalnız soyadına bakmak kütüphaneyi çapraz kirletirdi.
       - Son sözcük şartı, adayın FAZLADAN sözcüğünü ayırt eder: "Ali Kemal" →
         "Ali Kemal Sunal" ELENİR (başka kişi), ama "Fyodor Dostoyevski" →
         "Fyodor Mihayloviç Dostoyevski" GEÇER (göbek adı, aynı kişi).
       - Baş harfler (J.K.) alt küme şartına girmez: "J.K. Rowling" →
         "Joanne Rowling" geçer.
     · TEK SÖZCÜKLÜ ad (mononim): adayın TAMAMI o sözcüğe eşit olmalı. Alt küme
       kuralı burada çöker — "Ali" sorgusu "Sabahattin Ali"yi yakalardı. Uzunluk
       eşiği yerine tam eşleşme: keyfi bir harf sayısı seçmeden aynı korumayı
       verir ("Homeros" → "Homeros ve Hesiodos" elenir, "Homeros" geçer).
     Aday alanı çok yazarlı olabilir ("Isaac Asimov, Ali Kaftan") — virgülle
     ayrılıp her parça ayrı denenir (aramaGoogle bu biçimi üretiyor). */
  function yazarEslesir(sorguAd, adayAd){
    const s = adSozcukler(sorguAd);
    if(!s.length) return false;
    const soyad = s[s.length - 1];
    const govde = s.filter(w => w.length >= 2);
    for(const p of String(adayAd || '').split(',')){
      const a = adSozcukler(p);
      if(!a.length) continue;
      if(s.length === 1){
        /* Mononim (tek adlı yazar, v62): birebir-eşitlik klasikleri KAYBETTİRİYORDU —
           kaynaklar "Homeros Homer", "Konfüçyüs Confucius" gibi çift-ad biçimleri
           dönüyor (parantezli "Homeros (Homer)" adSozcukler'de zaten soyulur).
           Kural: adayın İLK sözcüğü eşitse kabul — mononim varyant ekleri SONA
           gelir; Türk ad-soyad düzeninde tek ad SOYADDIR ve sonda durur
           ("Ali" → "Sabahattin Ali" ilk sözcükten elenir). Bağlaçlı aday
           ("Homeros ve Hesiodos") birden çok kişidir → yine elenir. */
        if(a.length && a[0] === s[0]
          && a.indexOf('ve') < 0 && a.indexOf('and') < 0 && a.indexOf('ile') < 0) return true;
        continue;
      }
      if(a[a.length - 1] !== soyad) continue;
      if(govde.every(w => a.indexOf(w) >= 0)) return true;
    }
    return false;
  }
  /* Seri eşleşmesi: seri adının ≥2 harfli TÜM sözcükleri adayın BAŞLIĞINDA
     sözcük olarak geçmeli. Alt dizi değil sözcük eşleşmesi — "Ada" serisi
     "Adalet"i yakalamasın. Ölçülen gerekçe: `"Harry Potter" inauthor:"J.K.
     Rowling"` sorgusu "Ozan Beedle'ın Hikâyeleri" ve "Çağlar Boyu Quidditch"
     de döndürüyor; bunlar gerçek Rowling kitapları ama Harry Potter CİLDİ
     değil — "N. cildi eksik" gerekçesiyle sunulsalardı yanlış iddia olurdu.
     Denetlenemeyen seri adı (tümü tek harf) engellenmez. */
  function seriEslesir(seriAd, adayBaslik){
    const s = adSozcukler(seriAd).filter(w => w.length >= 2);
    if(!s.length) return true;
    const b = adSozcukler(adayBaslik);
    return s.every(w => b.indexOf(w) >= 0);
  }

  /* Sayı biçimi DETERMİNİSTİK (toLocaleString değil): ICU sürümüne göre
     değişmeyen tek doğru çıktı — 138762 → "138.762", 8.45 → "8,5". */
  function binlik(n){ return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function ondalik(n){ return (Math.round(n * 10) / 10).toFixed(1).replace('.', ','); }
  /* Gerekçe İKİ YARIM, ikisi de gerçek veri:
       [kullanıcı]  "Felsefe türünde 12 kitap bitirdin, ortalama 8,4 verdin"
       [kaynak]     "1000Kitap'ta 138.762 okur, ★8,5"
     Kullanıcının kendi tür etiketi 1000Kitap'ınkinden FARKLIYSA bu açıkça
     yazılır ("… Felsefe-Düşünce içinde …"): eşleştirmeyi gizlemek, kullanıcının
     12 kitabını sanki 1000Kitap'ın türüne saymak olurdu. Kaynak sayısı yoksa o
     yarım hiç kurulmaz — uydurma sayı yok. */
  function turCumle(sinyal, kaynakTur, aday){
    const parcalar = [sinyal.cumle];
    const ayni = turAnahtar(sinyal.ad) === turAnahtar(kaynakTur.ad);
    const kaynakParca = [];
    if(aday.okuyan > 0) kaynakParca.push(binlik(aday.okuyan) + ' okur');
    if(aday.puan > 0) kaynakParca.push('★' + ondalik(aday.puan));
    if(kaynakParca.length)
      parcalar.push('1000Kitap\'ta ' + (ayni ? '' : kaynakTur.ad + ' içinde ')
        + kaynakParca.join(', '));
    else if(!ayni)
      parcalar.push('1000Kitap\'ta ' + kaynakTur.ad + ' türünden');
    return parcalar.join(' · ');
  }

  /* ---- DİL SÜZGECİ (v65): Keşfet YALNIZ TÜRKÇE önerir ----
     Canlı kanıt: YENİ KİTAPLAR "L'enfance d'un chef", "Pale Blue Dot",
     "Madonna In a Fur Coat" öneriyordu — sevilen yazarın İNGİLİZCE ÇEVİRİSİ
     yazar denetiminden geçer (gerçekten o yazarın kitabı), dili tutmaz.
     ÖLÇÜM (2026-08-13, canlı GB): langRestrict=tr TEK BAŞINA GÜVENİLMEZ —
     Carl Sagan langRestrict=tr'ye rağmen 6/6 İngilizce, Sabahattin Ali'ye bile
     1 İngilizce sızdı. Bu yüzden savunma İKİ katman: sorguya langRestrict=tr
     (ucuz ön eleme) + DÖNEN adayın volumeInfo.language alanı burada denetlenir.
     Dil alanı OLMAYAN aday ELENİR — ölçülen karar: 114 canlı adayın 0'ı
     dilsizdi (%0), yani eleme pratikte hiçbir gerçek Türkçe kitabı kaybettirmez;
     dili bilinmeyeni "muhtemelen Türkçedir" diye geçirmek uydurma olurdu.
     1000Kitap tür adayları MUAF: kaynak zaten Türkçe, dil alanı taşımaz.
     Eleme sonrası bir yazar/seri boş kalırsa o kaynak sessizce atlanır —
     doldurma yok (v53 ilkesinin dil ayağı). Süzgeç TEK fonksiyon ve hem
     sorgu sonunda (kota dilimi Türkçelere kalsın) hem her çizimde (bElenmis —
     24 saatlik bayat önbellekte kalmış yabancı adaylar da düşsün) uygulanır. */
  function bDilUygun(a){
    if(a && a.kaynakTip === 'tur') return true;   // 1000Kitap: dokunulmaz (görev sözleşmesi)
    return String((a && a.dil) || '').toUpperCase() === 'TR';
  }

  function isbnTemiz(s){
    // barkod.js ihraçlı temizleyici; eklenti yüklenmemişse aynı kural (emniyet)
    return (window.__barkod && window.__barkod.isbnTemizle)
      ? window.__barkod.isbnTemizle(s)
      : String(s || '').replace(/[^0-9Xx]/g, '').toUpperCase();
  }
  /* Anahtar HER ZAMAN ad|yazar (araTekillestir emsali) — ISBN-öncelikli anahtar
     iki edisyonu iki satır yapıyor ve gizlemeyi edisyon değişiminde deliyordu
     (v51 inceleme K1/K2). ISBN eleme kütüphane karşılaştırmasında AYRICA yaşar. */
  function bAnahtar(a){
    return katla(a.ad) + '|' + katla(a.yazar || '');
  }
  /* İmzaya tür sinyali de girer: kütüphaneye yeni bir tür işlenip sıralama
     değişince 24 saat beklemeden önbellek düşer. (M.sevilenTurler kontrolü
     bilinçli: SW güncellemesi sırasında taze kesfet.js + bayat oneri.js
     eşleşebilir; eksik API çökme değil, tür dalının sessiz yokluğu olmalı.) */
  function bSevilenTurler(){
    const M = window.__oneri;
    return (M && typeof M.sevilenTurler === 'function') ? M.sevilenTurler() : [];
  }
  /* Sorgulanamaz yazarlar (v53) TEK YERDE elenir: imza, sinyal kontrolü ve
     sorgu döngüsü hep bu listeyi kullanır. Süzgeç kotadan ÖNCE uygulanır —
     yoksa "Anonim" ilk 3 yazar yuvasından birini işgal ederdi. */
  function bYazarlar(){
    const M = window.__oneri;
    return (M.sevilenYazarlar() || []).filter(y => sorulabilirYazar(y.ad));
  }
  function bImza(){
    const M = window.__oneri;
    return JSON.stringify([
      bYazarlar().slice(0, B_YAZAR_KOTA).map(y => katla(y.ad)),
      M.eksikSeriler().slice(0, B_SERI_KOTA).map(s => katla(s.seri)),
      bSevilenTurler().slice(0, B_TUR_KOTA).map(t => katla(t.ad))]);
  }
  function bOnbellekOku(){
    try{
      const v = JSON.parse(localStorage.getItem(B_ONBELLEK) || 'null');
      if(!v || !Array.isArray(v.adaylar)) return null;
      if(v.imza !== bImza() || (Date.now() - v.t) > B_TTL_MS) return null;
      return v.adaylar;
    }catch(e){ return null; }
  }
  /* Eleme HER ÇİZİMDE taze: kütüphanede olan (ad+yazar TR-katlamalı VE ISBN),
     gizlenen ve yinelenen adaylar düşer. Önbellek HAM aday saklar — kitap
     eklenince/gizlenince liste sorgusuz güncellenir. */
  function bElenmis(){
    const adSet = new Set(), isbnSet = new Set();
    (veri.kitaplar || []).forEach(k => {
      adSet.add(katla(k.ad) + '|' + katla(k.yazar || ''));
      if(k.isbn){ const t = isbnTemiz(k.isbn); if(t) isbnSet.add(t); }
    });
    const gorulen = new Set();
    return (B.adaylar || []).filter(a => {
      if(!a || !a.ad) return false;
      if(!bDilUygun(a)) return false;    // v65: bayat önbellekteki yabancı aday da düşer
      const anah = bAnahtar(a);
      if(gorulen.has(anah)) return false;
      gorulen.add(anah);
      if(adSet.has(katla(a.ad) + '|' + katla(a.yazar || ''))) return false;
      const t = a.isbn ? isbnTemiz(a.isbn) : '';
      if(t && isbnSet.has(t)) return false;
      if(bGizliMi(anah)) return false;   // v62: geri alınan gizlemeler artık elemez
      return true;
    });
  }
  async function bGetir(){
    const M = window.__oneri, A = window.__ara;
    if(!M || !A || B.durum === 'yukleniyor') return;
    B.durum = 'yukleniyor';
    if(typeof durum === 'object' && durum.sekme === 'kesfet') ciz();
    // imza sorgu BAŞINDA dondurulur (inceleme K4): yükleme sırasında kütüphane
    // değişirse eski sinyalle çekilen adaylar yeni imzayla mühürlenmesin
    const imza = bImza();
    const yazarlar = bYazarlar().slice(0, B_YAZAR_KOTA);
    const seriler = M.eksikSeriler().slice(0, B_SERI_KOTA);
    // zaman aşımı canliAra ile aynı: 9 sn (inceleme K3 — asılı fetch süresiz
    // "yükleniyor"da bırakıyordu)
    const ctl = new AbortController();
    const zam = setTimeout(() => ctl.abort(), 9000);
    let hataOldu = false;
    const dene = p => p.catch(() => { hataOldu = true; return []; });
    const adaylar = [];
    /* TÜR dalı Google döngülerinden ÖNCE ateşlenir, SONRA toplanır: başka
       kökene giden bağımsız istekler sıradaki ≤6 Google sorgusunun gölgesinde
       koşar, duvar saatine eklediği süre pratikte ~0 (ölçüm: /turler 0,23 sn,
       /tur 0,56 sn; Google döngüsü tipik 1-3 sn). İptal sinyali ORTAK. */
    const turSozu = (A.turler && A.tur) ? dene(bTurAdaylari(A, ctl.signal)) : Promise.resolve([]);
    /* ALAKA SÜZGECİ kotadan ÖNCE (v53): eleme slice'tan sonra yapılsaydı ilk 3
       sıradaki çöp, 4. sıradaki gerçek kitabı listeden dışarıda bırakırdı.
       Eşleşen kalmazsa o yazar/seri sessizce ATLANIR — doldurma yok. */
    // EN GÜÇLÜ sinyal önce: eksik seri sorguları liste başında
    for(const s of seriler){
      const q = s.yazar ? '"' + s.seri + '" inauthor:"' + s.yazar + '"' : '"' + s.seri + '"';
      // Seride ÜÇ denetim: kitap gerçekten o seriden mi, gerçekten o yazarın mı,
      // TÜRKÇE mi (v65 — dil süzgeci kota diliminden ÖNCE: yabancı baskılar
      // B_SERI_ADAY yuvalarını işgal edip Türkçeleri dışarıda bırakmasın).
      // Yazar denetlenemiyorsa (ad yok ya da "Anonim") yalnız seri adı bağlar.
      const yazarDenetli = !!s.yazar && sorulabilirYazar(s.yazar);
      (await dene(A.google(q, null, ctl.signal, 'tr')))
        .filter(a => bDilUygun(a) && seriEslesir(s.seri, a.ad) &&
          (!yazarDenetli || yazarEslesir(s.yazar, a.yazar)))
        .slice(0, B_SERI_ADAY)
        .forEach(a => adaylar.push({ ...a, kaynakTip: 'seri', neden: s.cumle }));
    }
    for(const y of yazarlar){
      (await dene(A.google(y.ad, 'yazar', ctl.signal, 'tr')))
        .filter(a => bDilUygun(a) && yazarEslesir(y.ad, a.yazar))
        .slice(0, B_YAZAR_ADAY)
        .forEach(a => adaylar.push({ ...a, kaynakTip: 'yazar', neden: y.cumle }));
    }
    (await turSozu).forEach(a => adaylar.push(a));   // en zayıf sinyal en sonda
    clearTimeout(zam);
    if(!adaylar.length && hataOldu){
      B.durum = 'hata';   // hiç sonuç yok VE ağ düştü → dürüst hata; kısmi sonuç gösterilir
    }else{
      B.adaylar = adaylar;
      B.durum = 'hazir';
      try{ localStorage.setItem(B_ONBELLEK,
        JSON.stringify({ imza, t: Date.now(), adaylar })); }catch(e){}
    }
    if(typeof durum === 'object' && durum.sekme === 'kesfet') ciz();
  }
  /* Tür adayları: önce taksonomi (/turler), sonra eşleşen ≤2 tür için İLK
     SAYFA (türün en çok okunanları — kaynak zaten okunma sırasına dizili,
     hasMore takip edilmiyor: keşif için ilk 16 yeterli, 2. sayfa kuyruğa
     iniyor). Eşleşmeyen kullanıcı türü SESSİZCE atlanır; hiç tür eşleşmezse
     tek istek bile atılmaz. Kısmi arıza kısmi sonuç verir; HİÇ sonuç yokken
     arıza varsa dışarı fırlatılır (dış katmanın "dürüst hata" kuralı). */
  async function bTurAdaylari(A, sinyal){
    const sevilen = bSevilenTurler();
    if(!sevilen.length) return [];
    const kaynakTurler = await A.turler(sinyal);
    const secilen = [], kullanilan = new Set();
    for(const t of sevilen){
      if(secilen.length >= B_TUR_KOTA) break;
      const e = turEslestir(t.ad, kaynakTurler);
      if(!e || kullanilan.has(e.seo)) continue;
      kullanilan.add(e.seo);
      secilen.push({ sinyal: t, kaynakTur: e });
    }
    if(!secilen.length) return [];
    let turHata = false;
    const paketler = await Promise.all(secilen.map(s => A.tur(s.kaynakTur.seo, 1, sinyal)
      .then(p => ({ s, p })).catch(() => { turHata = true; return null; })));
    const adaylar = [];
    paketler.filter(Boolean).forEach(({ s, p }) => {
      (p.sonuclar || []).slice(0, B_TUR_ADAY).forEach(a => adaylar.push({
        ad: a.ad, yazar: a.yazar || '', kapak: a.kapak || null,
        kaynakTip: 'tur', neden: turCumle(s.sinyal, s.kaynakTur, a) }));
    });
    if(!adaylar.length && turHata) throw new Error('tur-kaynagi');
    return adaylar;
  }

  function bSatirHtml(a, i){
    const kaynakAd = B_KAYNAK_AD[a.kaynakTip] || '';
    return '<div class="ks-b-item">' +
      (typeof ktPlate === 'function'
        ? ktPlate({ ad: a.ad, yazar: a.yazar || '', kapak: a.kapak || null }, 'p-mini') : '') +
      '<div class="ks-ic">' +
        (kaynakAd ? '<span class="ks-b-kaynak">' + esc(kaynakAd) + '</span>' : '') +
        '<span class="ks-b-ad">' + esc(a.ad) + '</span>' +
        (a.yazar ? '<div class="ks-b-yazar">' + esc(a.yazar) + '</div>' : '') +
        '<div class="ks-b-neden">' + esc(a.neden || '') + '</div>' +
        '<div class="ks-eylem">' +
          '<button class="ks-b-ekle" data-act="ks-b-ekle" data-i="' + i + '">İstek listeme ekle</button>' +
          '<button class="ks-b-gizle" data-act="ks-b-gizle" data-i="' + i + '">İlgilenmiyorum</button>' +
        '</div>' +
      '</div></div>';
  }
  function bBolumHtml(){
    const M = window.__oneri;
    if(!M || !M.sevilenYazarlar) return '';
    // sinyal sayımı SORGULANABİLİR yazarlar üzerinden: yalnız "Anonim" okuyan
    // birine "getir" düğmesi göstermek, basınca hiç sorgu atmamak olurdu.
    const sinyalVar = bYazarlar().length || M.eksikSeriler().length
      || bSevilenTurler().length;
    let ic;
    if(!sinyalVar){
      // yetersiz veri: sorgu da atılmaz — uydurma öneri YOK
      ic = '<div class="ks-b-not">Yeni kitap önerisi için önce sinyal gerek: bir yazarın ' +
        'kitabını bitirip 8 ve üzeri puan ver, bir serinin ciltlerini kütüphanene işle ' +
        'ya da aynı türden en az 2 kitabı bitirip 7 ve üzeri puan ver.</div>';
    }else{
      if(B.durum === 'bekliyor'){
        const c = bOnbellekOku();
        if(c){ B.adaylar = c; B.durum = 'hazir'; }   // taze önbellek: ağ maliyeti sıfır
      }
      if(B.durum === 'bekliyor'){
        ic = '<div class="ks-b-not">Sevdiğin yazarların ve eksik serilerinin kütüphanende ' +
          'OLMAYAN kitapları kaynaklardan sorulur — sen istemeden sorgu atılmaz.</div>' +
          '<button class="btn btn-cerceve ks-b-getir" data-act="ks-b-getir">Yeni kitapları getir</button>';
      }else if(B.durum === 'yukleniyor'){
        ic = '<div class="ks-b-not">Kaynaklara soruluyor…</div>';
      }else if(B.durum === 'hata'){
        ic = '<div class="ks-b-not">İnternete ulaşılamadı — yeni kitap önerileri şimdilik yok; ' +
          'rafından öneriler etkilenmez.</div>' +
          '<button class="btn btn-cerceve ks-b-getir" data-act="ks-b-getir">Yeniden dene</button>';
      }else{
        B.gorunen = bElenmis();
        ic = B.gorunen.length
          ? B.gorunen.map(bSatirHtml).join('')
          : '<div class="ks-b-not">Kaynaklarda kütüphanende olmayan yeni bir şey bulunamadı.</div>';
      }
    }
    return '<div class="ks-b" id="ksB">' +
      '<div class="ks-b-bas"><span class="kicker">Yeni kitaplar</span></div>' + ic +
      bGizliHtml() + '</div>';
  }
  function bEkle(i){
    const a = B.gorunen[+i];
    if(!a || typeof kitapNormalize !== 'function' || typeof uid !== 'function') return;
    // katalog.js kodIsle emsali: normalize + push + depoKaydet + hepsiniCiz
    const yeni = kitapNormalize({ id: uid(), ad: a.ad, yazar: a.yazar || '',
      yayinevi: a.yayinevi || '', yil: a.yil || null, sayfa: a.sayfa || null,
      kapak: a.kapak || null, isbn: a.isbn || '', durum: 'okunacak',
      sahiplik: 'istek', eklenme: Date.now(), g: Date.now() });
    veri.kitaplar.push(yeni);
    depoKaydet();
    /* Otomatik tür (v65): istek listesine eklenen kitap da yeni kitaptır —
       aday Google'dan geldiyse kategorileri bedava taşınır, yoksa kuyruk
       tek sorguyla dener; bulunamazsa boş kalır (formKaydet ile aynı motor). */
    if(!yeni.tur && window.__zengin && window.__zengin.otoTur)
      window.__zengin.otoTur(yeni.id,
        (Array.isArray(a.kategoriler) && a.kategoriler.length) ? a.kategoriler : null);
    if(typeof toast === 'function') toast('İstek listene eklendi');
    if(typeof hepsiniCiz === 'function') hepsiniCiz();   // sarmalama Keşfet'i tazeler
    ciz();
  }
  /* Gizleme GERİ ALINABİLİR (v62 — erteleme deseninin dengi). Senkron
     semantiği KARARI: kesfetGizli öz-damgalı UNION'dur; union'dan kayıt
     SİLMEK öbür cihazın kopyasından geri dirilir. Bu yüzden geri alma ayrı
     bir öz-damgalı haritada yaşar: kesfetGizliGeri (silinenler mezar taşı
     deseninin birebiri). Etkin gizlilik = gizli damgası > geri damgası;
     yeniden gizlemek daha yeni damgayla geri almayı yener. */
  const GIZLI_AD_ANAHTAR = 'kk_kesfet_gizli_ad_v1';   // cihaz-yerel ad defteri (senkrona girmez)
  function gizliAdDefteri(){
    try{ return JSON.parse(localStorage.getItem(GIZLI_AD_ANAHTAR)) || {}; }
    catch(e){ return {}; }
  }
  function bGizliMi(anah){
    const g = (veri.kesfetGizli || {})[anah];
    const geri = (veri.kesfetGizliGeri || {})[anah];
    return !!g && !(geri > g);
  }
  function bGizliListe(){
    const defter = gizliAdDefteri();
    return Object.keys(veri.kesfetGizli || {}).filter(bGizliMi).sort()
      .map(anah => ({ anah,
        /* başka cihazda gizlenmişse ad defterinde yoktur — anahtarın kendisi
           (katlanmış "ad — yazar") gösterilir: çirkin ama dürüst */
        ad: defter[anah] || anah.split('|').filter(Boolean).join(' — ') }));
  }
  function bGizle(i){
    const a = B.gorunen[+i];
    if(!a) return;
    veri.kesfetGizli = veri.kesfetGizli || {};
    veri.kesfetGizli[bAnahtar(a)] = Date.now();   // kalıcı tercih; senkronda union
    try{
      const defter = gizliAdDefteri();
      defter[bAnahtar(a)] = a.ad + (a.yazar ? ' — ' + a.yazar : '');
      localStorage.setItem(GIZLI_AD_ANAHTAR, JSON.stringify(defter));
    }catch(e){}
    depoKaydet();
    if(typeof toast === 'function') toast('Bir daha önerilmeyecek — alttaki listeden geri alabilirsin');
    ciz();
  }
  function bGeriAl(anah){
    if(!anah || !bGizliMi(anah)) return;
    veri.kesfetGizliGeri = veri.kesfetGizliGeri || {};
    veri.kesfetGizliGeri[anah] = Date.now();
    depoKaydet();
    if(typeof toast === 'function') toast('Öneri geri geldi');
    ciz();
  }
  function bGizliHtml(){
    const gizliler = bGizliListe();
    if(!gizliler.length) return '';
    return '<div class="ks-gizli"><button class="ks-sessiz" data-act="ks-gizli">' +
      gizliler.length + ' öneri gizledin — ' + (S.gizliAcik ? 'gizle' : 'göster') + '</button>' +
      (S.gizliAcik ? gizliler.map(g =>
        '<div class="ks-erteli-item ks-gizli-item"><span class="ks-erteli-ad">' + esc(g.ad) + '</span>' +
        '<span class="ks-erteli-sag"><button class="ks-basla" data-act="ks-gizli-geri" data-anah="' +
        escAttr(g.anah) + '">Geri al</button></span></div>').join('') : '') + '</div>';
  }

  function ciz(){
    const kap = document.getElementById('ksIcerik');
    if(!kap || !window.__oneri || !window.__oneri.hesaplaHam) return;
    const M = window.__oneri;
    const h = M.hesaplaHam();
    const havuz = S.sahiplik === 'istek' ? h.istek : h.sahip;

    // süzgeç seçenekleri adayların KENDİ değerlerinden (uydurma seçenek yok)
    const turler = [...new Set(havuz.map(o => o.kitap.tur).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'tr'));
    const raflar = [...new Set(havuz.map(o => o.kitap.raf).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'tr'));
    if(S.tur && turler.indexOf(S.tur) < 0) S.tur = null;   // aday kalmadıysa süzgeç düşer
    if(S.raf && raflar.indexOf(S.raf) < 0) S.raf = null;

    const filtreli = havuz.filter(o => {
      const k = o.kitap;
      if(S.tur && k.tur !== S.tur) return false;
      if(S.raf && k.raf !== S.raf) return false;
      if(S.uzunluk && uzunlukKova(k.sayfa) !== S.uzunluk) return false;
      return true;
    });

    // az-veri: bekleme sırası korunur (çeşitlilik kotası skor listesi içindir)
    const secilen = h.mod === 'az-veri'
      ? filtreli.slice(0, S.limit)
      : M.cesitlilikSec(filtreli, S.limit);
    M.nedenAta(secilen);

    // "daha fazla" DÜRÜST: bir sonraki adım gerçekten yeni öğe getirecekse görünür
    const sonrakiN = h.mod === 'az-veri'
      ? Math.min(filtreli.length, S.limit + SAYFA_ADIMI)
      : M.cesitlilikSec(filtreli, S.limit + SAYFA_ADIMI).length;
    const dahaVar = sonrakiN > secilen.length;

    const skorlar = secilen.map(o => o.skor).filter(s => s !== null);
    const enY = skorlar.length ? Math.max.apply(null, skorlar) : 0;
    const enD = skorlar.length ? Math.min.apply(null, skorlar) : 0;

    const erteliler = (typeof veri === 'object' ? veri.kitaplar : [])
      .filter(k => k.durum === 'okunacak' && M.ertelemeAktif(k));

    /* D5 (v62): çeşitlilik kotası aday elediyse sayım şeffaf — hangi kota
       kestiği elenen adaylardan bakılarak söylenir, sayı uydurulmaz. */
    let elemeNotu = '';
    if(h.mod !== 'az-veri' && !dahaVar && filtreli.length > secilen.length){
      const gosterilen = new Set(secilen.map(o => o.kitap.id));
      const yazarSay = {};
      secilen.forEach(o => { const y = katla(o.kitap.yazar || '');
        if(y) yazarSay[y] = (yazarSay[y] || 0) + 1; });
      let turKesti = false;
      filtreli.forEach(o => {
        if(gosterilen.has(o.kitap.id)) return;
        const y = katla(o.kitap.yazar || '');
        if(!(y && yazarSay[y] >= 2)) turKesti = true;
      });
      elemeNotu = ' · ' + (filtreli.length - secilen.length) + ' aday gösterilmiyor: aynı yazardan en fazla 2' +
        (turKesti ? ', benzer türden sınırlı sayıda' : '') + ' öneri';
    }
    let html = ustHtml(h, havuz.length, filtreli.length, elemeNotu);
    html += suzgecHtml(turler, raflar);
    if(h.mod === 'az-veri')
      html += '<div class="ks-not">Henüz kişisel öneri için yeterli veri yok: puan verdiğin ' +
        'bitmiş kitap sayısı ' + h.puanliSayi + ' (en az ' + h.esik + ' gerekir). ' +
        'Kitap bitirip puanladıkça bu liste sana göre şekillenir.' +
        (secilen.length ? ' Şimdilik en uzun süredir bekleyenler:' : '') + '</div>';
    if(!secilen.length){
      // boş-durum metni SAHİPLİK moduna göre (inceleme K2: istek modunda
      // "rafına kitap ekle" yanıltıcıydı)
      html += '<div class="ks-not">' + (havuz.length
        ? 'Bu süzgeçlerle eşleşen aday kalmadı — bir süzgeci kaldırmayı dene.'
        : S.sahiplik === 'istek'
          ? 'İstek listende bekleyen kitap yok.'
          : 'Okunacak listende önerilebilecek kitap yok — rafına kitap ekle, ya da ' +
            '"Şimdi değil" dediklerin ' + M.ERTELEME_GUN + ' gün sonra geri gelir.') + '</div>';
    }else{
      html += secilen.map(o => satirHtml(o, enY, enD)).join('');
      if(dahaVar)
        html += '<button class="btn btn-cerceve ks-daha" data-act="ks-daha">Daha fazla göster</button>';
    }
    if(erteliler.length){
      html += '<div class="ks-erteli"><button class="ks-sessiz" data-act="ks-erteli">' +
        erteliler.length + ' kitabı ertelemiştin — ' + (S.erteliAcik ? 'gizle' : 'göster') + '</button>' +
        (S.erteliAcik ? erteliler.map(k => {
          const kalan = Math.max(0, M.ERTELEME_GUN - gunFarki(k.ertelemeTarihi, bugun()));
          return '<div class="ks-erteli-item"><span class="ks-erteli-ad">' + esc(k.ad) + '</span>' +
            '<span class="ks-erteli-sag"><span class="ks-erteli-gun">' + kalan + ' gün sonra döner</span>' +
            '<button class="ks-basla" data-act="ks-geri-al" data-id="' + escAttr(k.id) + '">Geri al</button>' +
            '</span></div>';
        }).join('') : '') + '</div>';
    }
    html += bBolumHtml();   // v51: YENİ KİTAPLAR — Rafından'ın altında, kıl payı ayraçlı
    kap.innerHTML = html;
    if(typeof ktPlateHata === 'function') ktPlateHata(kap);   // levha kapakları tek yedek yoluna (v44)
  }

  function baslat(){
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    /* Bayat-panel panzehiri: veri değişince (detaydan bitir/sil, senkron...)
       Keşfet açıksa yeniden çizilir — çekirdek hepsiniCiz sarmalanır
       (çekirdek eklentiyi bilmez; kesfet.js kendi tazeliğinden sorumlu). */
    if(typeof window.hepsiniCiz === 'function'){
      const cekirdek = window.hepsiniCiz;
      window.hepsiniCiz = function(){
        cekirdek();
        if(typeof durum === 'object' && durum.sekme === 'kesfet') ciz();
      };
    }

    // ?sekme=kesfet derin bağlantısı: sekmeGec bu betik yüklenmeden koştu —
    // açılışta Keşfet aktifse ilk çizimi burada yap (inceleme K1).
    if(typeof durum === 'object' && durum.sekme === 'kesfet') ciz();

    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if(!el) return;
      switch(el.dataset.act){
        case 'sekme':
          // sekmeGec bittikten sonra taze çizim (ampul düğmesi de bu yoldan gelir)
          if(el.dataset.v === 'kesfet') setTimeout(ciz, 0);
          break;
        case 'ks-suz': {
          const g = el.dataset.g, v = el.dataset.v;
          if(g === 'sahiplik') S.sahiplik = v;
          else S[g] = (S[g] === v) ? null : v;   // toggle: seçiliye bas → kaldır
          S.limit = SAYFA_ADIMI;
          ciz(); break; }
        case 'ks-daha': S.limit += SAYFA_ADIMI; ciz(); break;
        case 'ks-erteli': S.erteliAcik = !S.erteliAcik; ciz(); break;
        case 'ks-gizli': S.gizliAcik = !S.gizliAcik; ciz(); break;
        case 'ks-gizli-geri': bGeriAl(el.dataset.anah); break;
        case 'ks-basla':
          if(window.__oneri && window.__oneri.basla(el.dataset.id) &&
             typeof hepsiniCiz === 'function') hepsiniCiz();
          ciz(); break;
        case 'ks-ertele':
          if(window.__oneri && window.__oneri.ertele(el.dataset.id) &&
             typeof hepsiniCiz === 'function') hepsiniCiz();
          ciz(); break;
        case 'ks-geri-al':
          if(window.__oneri && window.__oneri.erteleGeriAl(el.dataset.id) &&
             typeof hepsiniCiz === 'function') hepsiniCiz();
          ciz(); break;
        case 'ks-b-getir': bGetir(); break;
        case 'ks-b-ekle': bEkle(el.dataset.i); break;
        case 'ks-b-gizle': bGizle(el.dataset.i); break;
      }
    });
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
  else baslat();

  window.__kesfet = { ciz };   // test/tanı kancası
})();
