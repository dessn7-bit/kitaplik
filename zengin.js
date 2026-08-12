/* Kütüphane zenginleştirme — üç iş tek modülde (v63):
   M1 toplu zenginleştirme (eksik tür/ISBN/sayfa/yayınevi/yıl/kapak),
   M2 hızlı puanlama (puansız bitmişler), M3 bitiş yılı atama (tarihsiz bitmişler).
   Kendi kendine yeten modül: index.html'de tek satırlık script etiketiyle yüklenir.
   AD ALANI: sınıflar ve data-act değerleri 'zg-' önekli, id'ler 'zg' önekli.

   KARARLAR:
   - KAYNAK (ölçüldü, 20 kitaplık örneklem): kitaplik-ara /ara sonuçları TÜR
     TAŞIMIYOR (alanlar: ad,yazar,yayinevi,yil,sayfa,kapak,kaynak) ve /tur ucu
     ters yön (tür→kitap listesi) — 242 kitaba tür bulmak için kullanılamaz.
     Tek pratik tür kaynağı GOOGLE BOOKS categories. İki aşamalı sorgu:
     dar (intitle+inauthor) → boşsa gevşek ("ad" yazar). Ölçüm: dar 11/20,
     +gevşek ISBN 20/20, kategori 19/20 (taksonomiye güvenle eşlenen ~%60).
   - TÜR EŞLEME (v64'te ÖLÇÜMLE yeniden kuruldu — gerçek yedeğin ilk 30
     kitabında v63 4/30 buluyordu, canlı kullanımda 0/12 çıkmıştı):
     GÜVENLİ-GENİŞ sözlük + canlı taksonomi (worker /turler, 78 tür)
     doğrulaması: eşlenen ad taksonomide yoksa BOŞ, uydurma tür imkânsız.
     Eşleşme KELİME SINIRI ister ('art' "Performing Arts"i yakalayamaz) ve
     kategori BAŞINA denenir: taksonomiye eşlenen İLK güvenli kategori
     kazanır, kapıdan geçemeyen eşleşme aramayı KESMEZ (v63 kesiyordu —
     "Biography"→'Biyografi-Otobiyografi' gibi taksonomide olmayan hedefler
     kitabı boş bırakıyordu). Konu etiketleri (Reference, Education, Art,
     Performing Arts, Turkey, Nature, kişi kategorileri: Novelists/Poets/
     Dramatists/Scientists...) bilerek YOK. TR kategoriler ("Fransız
     romanı", "Dünya klasikleri") katla üzerinden eşlenir. Tür artık tek
     adayın değil BAŞLIĞI UYAN TÜM adayların kategorilerinden aranır;
     bulunamazsa ve 2. istek hakkı duruyorsa tür için gevşek sorgu atılır
     (kitap başına ≤2 istek bütçesi KORUNUR). Ölçüm v64: 14/30 — kalan
     boşların tamamı kategorisiz kaynak ya da bilinçli eleme.
   - KOTA: istekler arası en az ARALIK_MS bekleme; kitap başına en çok 2 istek
     (242×2=484 < günlük 1000). Kuyruk DURDURULABİLİR; durum kk_zengin_v1'de,
     yarım kalırsa kaldığı yerden sürer.
   - ÖNİZLEME ZORUNLU: tarama hiçbir şey YAZMAZ; bulunanlar önce özetle
     (alan başına sayı) gösterilir, "Uygula"ya basılmadan tek bayt yazılmaz.
     242 kitabı tek tek onaylatmak işkence → ORTA YOL: alan-düzeyi toplu onay
     + isteğe bağlı "tek tek gör" listesi ve satır başına çıkarma (✕).
   - DOLU ALANA DOKUNULMAZ: uygulama yalnız boş alanı doldurur; gelen değer
     mevcutla çelişiyorsa mevcut korunur (yazılmaz bile).
   - YAZIM DAMGA BASAR: tur/isbn/sayfa/yayınevi/yıl/kapak senkron parmak
     izinde → depoKaydet sarmalaması k.g'yi tazeler (kullanıcı eylemi).
   - M3 OTOMATİK TARİH YOK: uydurma tarih veri kirliliği. Kullanıcı kitap
     kitap YIL seçer; gün/ay bilinmediği için YYYY-01-01 yazılır (yıl
     istatistiği/raporu doğru olur; aylık şeritte Ocak'a yığılma bilinen
     dürüstlük maliyeti — raporda ŞÜPHE olarak kayıtlı). */
'use strict';
(function(){
  const KUYRUK_ANAHTAR = 'kk_zengin_v1';
  const ARALIK_MS = 650;          // istekler arası en az bekleme (kota nezaketi)
  const ALANLAR = ['tur', 'isbn', 'sayfa', 'yayinevi', 'yil', 'kapak'];
  const ALAN_AD = { tur: 'Tür', isbn: 'ISBN', sayfa: 'Sayfa', yayinevi: 'Yayınevi', yil: 'Yıl', kapak: 'Kapak' };
  const YIL_SAYISI = 15;          // M3 yıl ızgarası: bu yıldan geriye

  /* Google kategori → 1000Kitap taksonomi adı. Kurallar:
     (1) anahtarlar katla-katlanmış küçük harf yazılır;
     (2) eşleşme KELİME SINIRI ister ('art' "Performing Arts"i yakalayamaz);
     (3) 3. eleman 'tam' ise anahtar kategorinin TAMAMI olmalı
         ('roman' ↔ "Roman Empire" karışmasın);
     (4) SIRA ÖNEMLİ: spesifik önce, jenerikler (literature/novel/fiction)
         EN SONDA; sıra yalnız AYNI kategori metni içinde hüküm sürer,
         kategoriler arasında geliş sırası kazanır;
     (5) konu etiketleri (Reference, Education, Art, Turkey, Nature, Beer,
         Human anatomy, kişi kategorileri) BİLEREK YOK — tür değildir;
     (6) her satır "bu kategori GERÇEKTEN bu türü mü işaret ediyor"
         süzgecinden geçti; şüphelide eleme tarafında kalındı
         (ör. Atheism→Felsefe reddedildi: 1000Kitap rafı doğrulamadı).
     Eşlenen ad canlı taksonomide yoksa yine boş (ikinci kapı). */
  const TUR_ESLEME = [
    /* kurgu alt-türleri (spesifik) */
    ['science fiction', 'Bilim-Kurgu'],
    ['juvenile fiction', 'Çocuk'],
    ['juvenile nonfiction', 'Çocuk'],
    ['juvenile', 'Çocuk'],
    ['young adult', 'Gençlik'],
    ['fantasy', 'Fantastik'],
    ['horror', 'Korku-Gerilim'],
    ['ghost stories', 'Korku-Gerilim'],
    ['thrillers', 'Polisiye'],
    ['thriller', 'Polisiye'],
    ['mystery', 'Polisiye'],
    ['detective', 'Polisiye'],
    ['crime fiction', 'Polisiye'],
    ['adventure stories', 'Macera-Aksiyon'],
    ['adventure fiction', 'Macera-Aksiyon'],
    ['romance', 'Aşk'],
    ['love stories', 'Aşk'],
    ['graphic novels', 'Çizgi-Roman'],
    ['graphic novel', 'Çizgi-Roman'],
    ['comics', 'Çizgi-Roman'],
    ['manga', 'Manga'],
    ['fairy tales', 'Masal'],
    ['short stories', 'Hikaye (Öykü)'],
    /* sahne / şiir */
    ['poetry', 'Şiir'],
    ['drama', 'Tiyatro'],
    ['tragedies', 'Tiyatro'],
    ['tragedy', 'Tiyatro'],
    ['theater', 'Tiyatro'],
    ['theatre', 'Tiyatro'],
    ['plays', 'Tiyatro'],
    /* kurgu-dışı — spesifik bileşikler jeneriklerden ÖNCE */
    ['literary criticism', 'Eleştiri-Kuram'],
    ['history and criticism', 'Eleştiri-Kuram'],
    ['natural history', 'Bilim-Teknoloji-Mühendislik'],
    ['political science', 'Siyaset-Politika'],
    ['social sciences', 'Sosyoloji'],
    ['social science', 'Sosyoloji'],
    ['self-help', 'Kişisel Gelişim'],
    ['self-improvement', 'Kişisel Gelişim'],
    ['philosophy', 'Felsefe-Düşünce'],
    ['psychology', 'Psikoloji'],
    ['psychoanalysis', 'Psikoloji'],
    ['sociology', 'Sosyoloji'],
    ['politics', 'Siyaset-Politika'],
    ['history', 'Tarih'],
    ['biography', 'Biyografi'],
    ['autobiography', 'Biyografi'],
    ['memoirs', 'Anı-Mektup-Günlük'],
    ['memoir', 'Anı-Mektup-Günlük'],
    ['diaries', 'Anı-Mektup-Günlük'],
    ['correspondence', 'Anı-Mektup-Günlük'],
    ['essays', 'Deneme-İnceleme'],
    ['travel', 'Gezi'],
    ['music', 'Müzik'],
    ['mythology', 'Mitolojiler'],
    ['legends', 'Efsaneler-Destanlar'],
    ['folklore', 'Halk Edebiyatı'],
    ['islam', 'Din (İslam)'],
    ['sufism', 'Tasavvuf-Mezhepler-Tarikatlar'],
    ['christianity', 'Diğer İnançlar'],
    ['judaism', 'Diğer İnançlar'],
    ['buddhism', 'Diğer İnançlar'],
    ['economics', 'Ekonomi-Emek-İş Dünyası'],
    ['business', 'Ekonomi-Emek-İş Dünyası'],
    ['law', 'Hukuk'],
    ['medical', 'Sağlık-Tıp'],
    ['medicine', 'Sağlık-Tıp'],
    ['health', 'Sağlık-Tıp'],
    ['humor', 'Eğlence-Mizah'],
    ['humour', 'Eğlence-Mizah'],
    ['anthropology', 'Antropoloji-Etnoloji'],
    ['ethnology', 'Antropoloji-Etnoloji'],
    ['archaeology', 'Arkeoloji'],
    ['archeology', 'Arkeoloji'],
    ['astronomy', 'Astronomi'],
    ['astrophysics', 'Astronomi'],
    ['geography', 'Coğrafya'],
    ['linguistics', 'Dilbilimi-Etimoloji'],
    ['etymology', 'Dilbilimi-Etimoloji'],
    ['cooking', 'Yemek'],
    ['cookery', 'Yemek'],
    ['sports', 'Spor'],
    ['computers', 'Bilgisayar-İnternet'],
    ['ecology', 'Ekoloji'],
    ['interviews', 'Söyleşi-Röportaj'],
    ['aphorisms', 'Özlü Sözler-Duvar Yazıları'],
    ['encyclopedias', 'Sözlük-Kılavuz Kitap-Ansiklopedi'],
    ['dictionaries', 'Sözlük-Kılavuz Kitap-Ansiklopedi'],
    ['evolution', 'Bilim-Teknoloji-Mühendislik'],
    ['physics', 'Bilim-Teknoloji-Mühendislik'],
    ['biology', 'Bilim-Teknoloji-Mühendislik'],
    ['chemistry', 'Bilim-Teknoloji-Mühendislik'],
    ['technology', 'Bilim-Teknoloji-Mühendislik'],
    ['engineering', 'Bilim-Teknoloji-Mühendislik'],
    ['sciences', 'Bilim-Teknoloji-Mühendislik'],
    ['science', 'Bilim-Teknoloji-Mühendislik'],
    /* Türkçe kategoriler (Google TR kayıtları; katla katlanmış gelir) */
    ['dunya klasikleri', 'Dünya Klasikleri'],
    ['turk klasikleri', 'Türk Klasikleri'],
    ['romani', 'Roman'],            // "Fransız romanı", "Türk romanı"
    ['siiri', 'Şiir'],              // "Türk şiiri"
    ['siir', 'Şiir'],
    ['felsefe', 'Felsefe-Düşünce'],
    ['tiyatro', 'Tiyatro'],
    ['oykusu', 'Hikaye (Öykü)'],
    ['oyku', 'Hikaye (Öykü)'],
    ['hikaye', 'Hikaye (Öykü)'],
    ['tarihi', 'Tarih'],
    ['tarih', 'Tarih'],
    ['edebiyati', 'Edebiyat'],
    ['edebiyat', 'Edebiyat'],
    ['cocuk', 'Çocuk'],
    ['psikoloji', 'Psikoloji'],
    ['roman', 'Roman', 'tam'],      // TAM eşleşme: "Roman Empire" tuzağı
    /* jenerikler EN SONDA */
    ['literature', 'Edebiyat'],
    ['novels', 'Roman'],
    ['novel', 'Roman'],
    ['fiction', 'Roman']
  ];

  const GB_ANAHTAR = (function(){
    const m = /books\/v1\/volumes\?key=([A-Za-z0-9_-]+)/.exec(document.documentElement.innerHTML);
    return m ? m[1] : '';
  })();

  let calisiyor = false;          // tarama döngüsü aktif mi
  let durdur = false;             // kullanıcı duraklattı
  let taksonomi = null;           // canlı /turler önbelleği (oturumluk)
  let puanKuyruk = null, puanSira = 0, puanBasi = 0;   // M2 oturum durumu
  let tarihKuyruk = null, tarihSira = 0;               // M3 oturum durumu

  function bildir(m){ if(typeof toast === 'function') toast(m); }
  function bekle(ms){ return new Promise(r => setTimeout(r, ms)); }

  /* ---------- kuyruk durumu (localStorage — cihaz-yerel, senkrona girmez) ---------- */
  function kuyrukYukle(){
    try{ return JSON.parse(localStorage.getItem(KUYRUK_ANAHTAR)) || null; }
    catch(e){ return null; }
  }
  function kuyrukKaydet(k){
    try{ localStorage.setItem(KUYRUK_ANAHTAR, JSON.stringify(k)); }catch(e){}
  }
  function kuyrukTemizle(){
    try{ localStorage.removeItem(KUYRUK_ANAHTAR); }catch(e){}
  }

  /* ---------- eksik alan sayımı ---------- */
  function alanBos(k, alan){
    if(alan === 'sayfa' || alan === 'yil') return !k[alan];
    return !(k[alan] && String(k[alan]).trim());
  }
  function eksikSayim(){
    const s = { toplam: 0 };
    ALANLAR.forEach(a => { s[a] = 0; });
    (veri.kitaplar || []).forEach(k => {
      s.toplam++;
      ALANLAR.forEach(a => { if(alanBos(k, a)) s[a]++; });
    });
    return s;
  }

  /* ---------- Google Books sorgusu (categories DAHİL — mevcut aramaGoogle
     categories okumadığı için burada kendi ayrıştırıcımız var) ---------- */
  async function gbSor(q, sinyal){
    const y = await fetch('https://www.googleapis.com/books/v1/volumes?key=' + GB_ANAHTAR +
      '&country=TR&maxResults=10&printType=books&q=' + encodeURIComponent(q),
      sinyal ? { signal: sinyal } : undefined);
    const j = await y.json();
    if(j.error) throw new Error('google-' + j.error.code);
    return (j.items || []).map(it => it.volumeInfo || {});
  }
  function baslikUyar(kitapAd, adayBaslik){
    const a = katla(kitapAd), b = katla(String(adayBaslik || ''));
    if(!a || !b) return false;
    return a.indexOf(b) >= 0 || b.indexOf(a) >= 0;
  }
  function rxKac(s){ return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  /* Kategori listesi (geliş SIRASI korunur) → taksonomiye eşlenen İLK güvenli
     tür. Kategori başına sözlük sırayla denenir; kelime sınırı zorunlu; 'tam'
     işaretli anahtar kategorinin tamamını ister. Taksonomi kapısından
     geçemeyen eşleşme aramayı KESMEZ — UYDURMA yine imkânsız (iki kapı). */
  function turCevir(kategoriler){
    if(!Array.isArray(kategoriler) || !taksonomi) return '';
    for(const kat of kategoriler){
      const metin = katla(kat);
      if(!metin) continue;
      for(const es of TUR_ESLEME){
        const uydu = es[2] === 'tam' ? metin === es[0]
          : new RegExp('\\b' + rxKac(es[0]) + '\\b').test(metin);
        if(!uydu) continue;
        /* canlı taksonomi doğrulaması: ad ya da seo katlaması eşleşmeli */
        const hedef = katla(es[1]);
        const t = taksonomi.find(x => katla(x.ad) === hedef || katla(x.seo) === hedef);
        if(t) return t.ad;   // İLK güvenli eşleşme kazanır
      }
    }
    return '';
  }
  /* Başlığı uyan adayların kategorileri — aday sırası korunur, tekrarsız. */
  function kategoriTopla(adaylar, kitapAd){
    const gorulen = {}, sonuc = [];
    for(const v of adaylar){
      if(!baslikUyar(kitapAd, v.title)) continue;
      for(const kat of (v.categories || [])){
        const anah = katla(kat);
        if(gorulen[anah]) continue;
        gorulen[anah] = 1;
        sonuc.push(kat);
      }
    }
    return sonuc;
  }
  /* Tek kitap için bulunanlar: yalnız EKSİK alanlar sorgulanır/derlenir.
     İstek bütçesi kitap başına ≤2 KORUNUR: dar + en çok BİR gevşek sorgu.
     Gevşek, v63'te yalnız dar SIFIR sonuç verince atılıyordu; artık uyan
     aday bulunamayınca da (aynı düşüş, daha erken yakalanır) ya da tür
     hâlâ boşken (kategori kaynağını genişletmek için) atılır. */
  async function kitapSorgula(k){
    const eksikler = ALANLAR.filter(a => alanBos(k, a));
    if(!eksikler.length) return null;
    const dar = 'intitle:"' + k.ad + '"' + (k.yazar ? ' inauthor:"' + k.yazar + '"' : '');
    const adaylar1 = await gbSor(dar);
    let aday = adaylar1.find(v => baslikUyar(k.ad, v.title));
    let adaylar2 = null;
    if(!aday){
      await bekle(ARALIK_MS);
      adaylar2 = await gbSor('"' + k.ad + '" ' + (k.yazar || ''));
      aday = adaylar2.find(v => baslikUyar(k.ad, v.title));
    }
    /* TÜR: tek adayın değil, başlığı uyan TÜM adayların kategorileri
       (geliş sırası korunur); hâlâ boşsa ve gevşek daha atılmadıysa
       tür için gevşek de denenir — istek sınırı yine ≤2. */
    let tur = '';
    if(eksikler.indexOf('tur') >= 0){
      tur = turCevir(kategoriTopla(adaylar1, k.ad)
        .concat(adaylar2 ? kategoriTopla(adaylar2, k.ad) : []));
      if(!tur && adaylar2 === null){
        await bekle(ARALIK_MS);
        adaylar2 = await gbSor('"' + k.ad + '" ' + (k.yazar || ''));
        tur = turCevir(kategoriTopla(adaylar2, k.ad));
      }
    }
    if(!aday) return null;
    const kimlik = aday.industryIdentifiers || [];
    const i13 = kimlik.find(x => x && x.type === 'ISBN_13');
    const i10 = kimlik.find(x => x && x.type === 'ISBN_10');
    const bulunan = {};
    if(tur) bulunan.tur = tur;
    if(eksikler.indexOf('isbn') >= 0){
      const ham = (i13 && i13.identifier) || (i10 && i10.identifier) || '';
      const B = window.__barkod;
      /* checksum'dan geçmeyen ISBN yazılmaz (barkod.js doğrulayıcısı) */
      if(ham && (!B || !B.isbnGecerli || B.isbnGecerli(ham))) bulunan.isbn = B && B.isbnTemizle ? B.isbnTemizle(ham) : ham;
    }
    if(eksikler.indexOf('sayfa') >= 0 && aday.pageCount > 0) bulunan.sayfa = aday.pageCount;
    if(eksikler.indexOf('yayinevi') >= 0 && aday.publisher) bulunan.yayinevi = String(aday.publisher);
    if(eksikler.indexOf('yil') >= 0 && aday.publishedDate){
      const y = parseInt(String(aday.publishedDate).slice(0, 4));
      if(y > 1400 && y <= new Date().getFullYear() + 1) bulunan.yil = y;
    }
    if(eksikler.indexOf('kapak') >= 0 && aday.imageLinks && aday.imageLinks.thumbnail)
      bulunan.kapak = aday.imageLinks.thumbnail.replace('http://', 'https://');
    return Object.keys(bulunan).length ? bulunan : null;
  }

  /* ---------- tarama döngüsü ---------- */
  async function taramaBaslat(){
    if(calisiyor) return;
    let kdurum = kuyrukYukle();
    if(!kdurum || kdurum.bitti){
      kdurum = { sira: (veri.kitaplar || []).filter(k => ALANLAR.some(a => alanBos(k, a))).map(k => k.id),
        islenen: {}, bulunan: {}, hata: {}, bitti: false };
    }
    kuyrukKaydet(kdurum);
    calisiyor = true; durdur = false;
    ortuKur('zgTarama', 'Kütüphaneyi zenginleştir');
    ac('zgTarama');
    taramaCiz(kdurum);
    try{
      if(!taksonomi){
        try{ taksonomi = await window.__ara.turler(); }
        catch(e){ taksonomi = null; }   // taksonomi yoksa tür eşlenmez (boş kalır), diğer alanlar sürer
      }
      const kalanlar = kdurum.sira.filter(id => !kdurum.islenen[id]);
      let ardArdaHata = 0;
      for(const id of kalanlar){
        if(durdur) break;
        const k = (veri.kitaplar || []).find(x => x.id === id);
        if(k){
          try{
            const b = await kitapSorgula(k);
            if(b) kdurum.bulunan[id] = b;
            ardArdaHata = 0;
          }catch(e){
            kdurum.hata[id] = 1;
            ardArdaHata++;
            if(ardArdaHata >= 5){
              /* ağ ya da kota düşmüş: dürüst mesaj + duraklat — yarım veri yazılmaz,
                 kuyruk durumu duruyor, "Devam et" kaldığı yerden sürer */
              durdur = true;
              bildir('Kaynağa ulaşılamıyor — tarama duraklatıldı, sonra kaldığı yerden sürdürebilirsin');
            }
          }
        }
        kdurum.islenen[id] = 1;
        kuyrukKaydet(kdurum);
        taramaCiz(kdurum);
        if(!durdur) await bekle(ARALIK_MS);
      }
      if(kdurum.sira.every(id => kdurum.islenen[id])) kdurum.bitti = true;
      kuyrukKaydet(kdurum);
    }finally{
      calisiyor = false;
    }
    onizlemeCiz(kdurum);
  }

  /* ---------- ÖNİZLEME + UYGULAMA ---------- */
  function onizlemeOzet(kdurum){
    const alanSayi = {};
    ALANLAR.forEach(a => { alanSayi[a] = 0; });
    let kitapSayi = 0;
    Object.values(kdurum.bulunan).forEach(b => {
      kitapSayi++;
      ALANLAR.forEach(a => { if(b[a] !== undefined) alanSayi[a]++; });
    });
    return { alanSayi, kitapSayi };
  }
  /* UYGULA: yalnız hâlâ BOŞ olan alana yazar — dolu alan (bu arada elle
     doldurulmuş olsa bile) KORUNUR; çelişen değer yazılmaz. */
  function uygula(kdurum){
    let kitapN = 0, alanN = 0;
    Object.entries(kdurum.bulunan).forEach(([id, b]) => {
      const k = (veri.kitaplar || []).find(x => x.id === id);
      if(!k) return;
      let yazildi = false;
      ALANLAR.forEach(a => {
        if(b[a] === undefined) return;
        if(!alanBos(k, a)) return;   // DOLU ALANA DOKUNMA
        k[a] = b[a];
        yazildi = true; alanN++;
      });
      if(yazildi) kitapN++;
    });
    if(typeof depoKaydet === 'function') depoKaydet();   // parmak izi değişti → damga
    kuyrukTemizle();
    kapat('zgTarama');
    bildir(kitapN + ' kitapta ' + alanN + ' alan dolduruldu');
    if(typeof hepsiniCiz === 'function') hepsiniCiz();
    durumTazele();
  }

  /* ---------- pencereler (eklenti-enjekte, katalog.js ortuEkle deseni) ---------- */
  function ortuKur(id, baslik){
    if(document.getElementById(id)) return;
    const o = document.createElement('div');
    o.className = 'ortu'; o.id = id;
    o.innerHTML = '<div class="sheet">' +
      '<div class="tutamac"></div>' +
      '<button class="sheet-kapat" data-act="zg-kapat" data-ortu="' + id + '" aria-label="Kapat">✕</button>' +
      '<div class="sheet-baslik">' + baslik + '</div>' +
      '<div class="zg-govde" id="' + id + 'Govde"></div>' +
    '</div>';
    document.body.appendChild(o);
    o.addEventListener('click', e => { if(e.target === o) ortuKapat(id); });
  }
  function ac(id){
    const o = document.getElementById(id);
    if(!o) return;
    o.classList.add('acik');
    if(typeof ortuAriaKur === 'function') ortuAriaKur(o);
  }
  function kapat(id){
    const o = document.getElementById(id);
    if(o) o.classList.remove('acik');
  }

  function taramaCiz(kdurum){
    const g = document.getElementById('zgTaramaGovde');
    if(!g) return;
    const toplam = kdurum.sira.length;
    const islenen = Object.keys(kdurum.islenen).length;
    const yuzde = toplam ? Math.round(islenen * 100 / toplam) : 100;
    const { kitapSayi } = onizlemeOzet(kdurum);
    g.innerHTML =
      '<div class="zg-satir">' + islenen + ' / ' + toplam + ' kitap tarandı · ' +
        kitapSayi + ' kitapta yeni bilgi bulundu</div>' +
      '<div class="ilerleme"><div style="width:' + yuzde + '%"></div></div>' +
      '<p class="zg-not">Kaynaklara aralıklı sorulur (kota nezaketi). Durdurabilirsin — ' +
        'kaldığı yerden devam eder. Hiçbir şey şu anda YAZILMIYOR; bitince önce önizleme göreceksin.</p>' +
      '<div class="form-alt"><button class="btn btn-cerceve" data-act="zg-durdur" style="flex:1">' +
        (calisiyor ? 'Duraklat' : 'Kapat') + '</button></div>';
  }
  function onizlemeCiz(kdurum){
    const g = document.getElementById('zgTaramaGovde');
    if(!g) return;
    const { alanSayi, kitapSayi } = onizlemeOzet(kdurum);
    const toplam = kdurum.sira.length;
    const islenen = Object.keys(kdurum.islenen).length;
    const hataN = Object.keys(kdurum.hata).length;
    if(!kitapSayi){
      g.innerHTML = '<div class="zg-satir">' + islenen + ' / ' + toplam + ' kitap tarandı' +
        (kdurum.bitti ? ' — yazılacak yeni bilgi bulunamadı' : ' (yarım — devam edebilirsin)') +
        (hataN ? ' · ' + hataN + ' kitapta kaynak hatası' : '') + '.</div>' +
        '<div class="form-alt">' +
        (kdurum.bitti ? '' : '<button class="btn btn-cerceve" data-act="zg-tara" style="flex:1">Devam et</button>') +
        '<button class="btn btn-cerceve" data-act="zg-kapat" data-ortu="zgTarama" style="flex:1">Kapat</button></div>';
      if(kdurum.bitti) kuyrukTemizle();
      return;
    }
    const ozetler = ALANLAR.filter(a => alanSayi[a])
      .map(a => ALAN_AD[a] + ': <b>' + alanSayi[a] + '</b> kitap').join(' · ');
    const satirlar = Object.entries(kdurum.bulunan).map(([id, b]) => {
      const k = (veri.kitaplar || []).find(x => x.id === id);
      if(!k) return '';
      const parcalar = ALANLAR.filter(a => b[a] !== undefined)
        .map(a => ALAN_AD[a] + ': ' + esc(String(b[a]).length > 34 ? String(b[a]).slice(0, 33) + '…' : b[a]));
      return '<div class="zg-onizle-satir" data-kid="' + escAttr(id) + '">' +
        '<div class="zg-onizle-ic"><span class="zg-onizle-ad">' + esc(k.ad) + '</span>' +
        '<span class="zg-onizle-alan">' + parcalar.join(' · ') + '</span></div>' +
        '<button class="zg-cikar" data-act="zg-cikar" data-kid="' + escAttr(id) + '" ' +
          'aria-label="Bu kitabı listeden çıkar">✕</button></div>';
    }).join('');
    g.innerHTML =
      '<div class="zg-satir">' + islenen + ' / ' + toplam + ' kitap tarandı' +
        (kdurum.bitti ? '' : ' (yarım — devam edebilirsin)') +
        (hataN ? ' · ' + hataN + ' kitapta kaynak hatası' : '') + '</div>' +
      '<div class="zg-ozet">' + kitapSayi + ' kitapta yeni bilgi: ' + ozetler + '</div>' +
      '<p class="zg-not">Yalnız BOŞ alanlar doldurulur; elle girdiğin hiçbir değere dokunulmaz. ' +
        'Tür, 1000Kitap taksonomisine eşlenemezse boş bırakılır — uydurma tür yazılmaz.</p>' +
      '<details class="zg-katla"><summary>Tek tek gör (' + kitapSayi + ' kitap)</summary>' +
        '<div class="zg-onizle-liste">' + satirlar + '</div></details>' +
      '<div class="form-alt">' +
        (kdurum.bitti ? '' : '<button class="btn btn-cerceve" data-act="zg-tara" style="flex:1">Devam et</button>') +
        '<button class="btn btn-cerceve" data-act="zg-vazgec" style="flex:1">Vazgeç</button>' +
        '<button class="btn btn-cerceve" data-act="zg-uygula" style="flex:2">Bulunanları uygula</button>' +
      '</div>';
  }

  /* ---------- Ayarlar bölümü durumu ---------- */
  function durumTazele(){
    const el = document.getElementById('zgDurum');
    if(!el) return;
    const s = eksikSayim();
    const parcalar = ALANLAR.filter(a => s[a])
      .map(a => s[a] + ' kitapta ' + ALAN_AD[a].toLowerCase());
    el.textContent = s.toplam
      ? (parcalar.length
        ? s.toplam + ' kitabın: ' + parcalar.join(', ') + ' eksik.'
        : 'Tüm kitapların temel alanları dolu görünüyor.')
      : 'Kütüphanen boş.';
    const dugme = document.querySelector('#ayBolumZengin [data-act="zg-tara"]');
    if(dugme){
      const kdurum = kuyrukYukle();
      dugme.textContent = (kdurum && !kdurum.bitti && Object.keys(kdurum.islenen).length)
        ? 'Taramaya devam et'
        : (kdurum && kdurum.bitti && Object.keys(kdurum.bulunan).length)
          ? 'Bulunanları gözden geçir'
          : 'Taramayı başlat';
    }
  }

  /* ---------- M2: hızlı puanlama ---------- */
  function puanlanacaklar(){
    return (veri.kitaplar || []).filter(k => k.durum === 'bitti' && !k.puan)
      .sort((a, b) => String(b.bitisTarihi || '').localeCompare(String(a.bitisTarihi || '')));
  }
  function puanBaslat(){
    puanKuyruk = puanlanacaklar();
    puanSira = 0; puanBasi = puanKuyruk.length;
    if(!puanBasi){ bildir('Puansız bitmiş kitap kalmadı'); return; }
    ortuKur('zgPuanOrtu', 'Hızlı puanlama');
    puanCiz_();
    ac('zgPuanOrtu');
  }
  function puanCiz_(){
    const g = document.getElementById('zgPuanOrtuGovde');
    if(!g) return;
    if(puanSira >= puanKuyruk.length){
      g.innerHTML = '<div class="zg-satir">Bitti — ' + puanBasi + ' kitabın tümü gözden geçirildi.</div>' +
        '<div class="form-alt"><button class="btn btn-cerceve" data-act="zg-kapat" data-ortu="zgPuanOrtu" style="flex:1">Kapat</button></div>';
      return;
    }
    const k = puanKuyruk[puanSira];
    g.innerHTML =
      '<div class="zg-sayac">' + (puanSira + 1) + ' / ' + puanBasi + '</div>' +
      '<div class="zg-kitap">' + (typeof ktPlate === 'function' ? ktPlate(k, 'p-mini') : '') +
        '<div class="zg-kitap-ic"><span class="zg-kitap-ad">' + esc(k.ad) + '</span>' +
        (k.yazar ? '<span class="zg-kitap-yazar">' + esc(k.yazar) + '</span>' : '') +
        (k.bitisTarihi ? '<span class="zg-kitap-alt">' + esc(String(k.bitisTarihi).slice(0, 4)) + ' yılında bitti</span>' : '') +
        '</div></div>' +
      '<div class="zg-puan-secim">' + Array.from({ length: 10 }, (_, i) =>
        '<button class="zg-puan-btn" data-act="zg-puan" data-v="' + (i + 1) + '">' + (i + 1) + '</button>').join('') + '</div>' +
      '<div class="zg-eylem"><button class="zg-sessiz" data-act="zg-atla">Atla</button></div>';
    if(typeof ktPlateHata === 'function') ktPlateHata(g);
  }
  function puanVer(p){
    const k = puanKuyruk && puanKuyruk[puanSira];
    if(!k) return;
    const canli = (veri.kitaplar || []).find(x => x.id === k.id);
    if(canli && p >= 1 && p <= 10 && !canli.puan){
      canli.puan = p;
      canli.g = Date.now();   // kullanıcı eylemi — açık damga (d-puan ile aynı kalıp)
      if(typeof depoKaydet === 'function') depoKaydet();
    }
    puanSira++;
    puanCiz_();
  }

  /* ---------- M3: bitiş yılı atama ---------- */
  function tarihsizler(){
    return (veri.kitaplar || []).filter(k => k.durum === 'bitti' && !k.bitisTarihi);
  }
  function tarihBaslat(){
    tarihKuyruk = tarihsizler();
    tarihSira = 0;
    if(!tarihKuyruk.length){ bildir('Bitiş tarihi eksik bitmiş kitap kalmadı'); return; }
    ortuKur('zgTarihOrtu', 'Bitiş yılı ata');
    tarihCiz_();
    ac('zgTarihOrtu');
  }
  function tarihCiz_(){
    const g = document.getElementById('zgTarihOrtuGovde');
    if(!g) return;
    if(tarihSira >= tarihKuyruk.length){
      g.innerHTML = '<div class="zg-satir">Bitti — kalan kitap yok.</div>' +
        '<div class="form-alt"><button class="btn btn-cerceve" data-act="zg-kapat" data-ortu="zgTarihOrtu" style="flex:1">Kapat</button></div>';
      return;
    }
    const k = tarihKuyruk[tarihSira];
    const buYil = new Date().getFullYear();
    g.innerHTML =
      '<div class="zg-sayac">' + (tarihSira + 1) + ' / ' + tarihKuyruk.length + '</div>' +
      '<div class="zg-kitap">' + (typeof ktPlate === 'function' ? ktPlate(k, 'p-mini') : '') +
        '<div class="zg-kitap-ic"><span class="zg-kitap-ad">' + esc(k.ad) + '</span>' +
        (k.yazar ? '<span class="zg-kitap-yazar">' + esc(k.yazar) + '</span>' : '') +
        '</div></div>' +
      '<p class="zg-not">Hangi YIL bitirdin? Gün/ay uydurulmaz — kayda yılın ilk günü yazılır, ' +
        'yıl istatistikleri ve yıl raporu doğru çalışır.</p>' +
      '<div class="zg-yil-izgara">' + Array.from({ length: YIL_SAYISI }, (_, i) => {
        const y = buYil - i;
        return '<button class="zg-yil-btn" data-act="zg-yil" data-v="' + y + '">' + y + '</button>';
      }).join('') + '</div>' +
      '<div class="zg-eylem"><button class="zg-sessiz" data-act="zg-atla-tarih">Atla</button></div>';
    if(typeof ktPlateHata === 'function') ktPlateHata(g);
  }
  function yilVer(y){
    const k = tarihKuyruk && tarihKuyruk[tarihSira];
    if(!k) return;
    const canli = (veri.kitaplar || []).find(x => x.id === k.id);
    if(canli && !canli.bitisTarihi && y >= 1900 && y <= new Date().getFullYear()){
      canli.bitisTarihi = y + '-01-01';
      canli.g = Date.now();
      if(typeof depoKaydet === 'function') depoKaydet();
    }
    tarihSira++;
    tarihCiz_();
  }

  /* ---------- bağlama ---------- */
  const CSS = [
    '.zg-satir{font-size:.9rem;color:var(--paper);margin:10px 0 8px;font-variant-numeric:tabular-nums}',
    '.zg-ozet{font-size:.85rem;color:var(--muted);margin:8px 0;line-height:1.5}',
    '.zg-ozet b{color:var(--paper);font-variant-numeric:tabular-nums}',
    '.zg-not{font-size:.8rem;color:var(--muted);margin-top:10px;line-height:1.5}',
    '.zg-katla{margin-top:12px;border:1px solid var(--kontur);border-radius:var(--r-md)}',
    '.zg-katla summary{list-style:none;cursor:pointer;padding:10px 14px;font-size:.85rem;color:var(--muted)}',
    '.zg-katla summary::-webkit-details-marker{display:none}',
    '.zg-onizle-liste{padding:0 14px 10px;max-height:44vh;overflow-y:auto}',
    '.zg-onizle-satir{display:flex;align-items:flex-start;gap:10px;padding:9px 0;border-bottom:1px solid var(--cizgi)}',
    '.zg-onizle-ic{flex:1;min-width:0}',
    '.zg-onizle-ad{display:block;font-family:var(--serif);font-weight:600;font-size:.9rem}',
    '.zg-onizle-alan{display:block;font-size:.75rem;color:var(--muted);margin-top:2px}',
    '.zg-cikar{flex:0 0 auto;color:var(--muted2);font-size:.9rem;padding:2px 6px;background:transparent;border:none;position:relative}',
    '.zg-cikar::after{content:"";position:absolute;inset:-8px}',
    '.zg-sayac{font-size:.75rem;letter-spacing:.06em;color:var(--muted2);margin:8px 0;font-variant-numeric:tabular-nums}',
    '.zg-kitap{display:flex;gap:12px;align-items:flex-start;margin:6px 0 12px}',
    '.zg-kitap-ic{flex:1;min-width:0}',
    '.zg-kitap-ad{display:block;font-family:var(--serif);font-size:1.15rem;font-weight:600;line-height:1.25}',
    '.zg-kitap-yazar{display:block;font-style:italic;font-size:.82rem;color:var(--muted);margin-top:2px}',
    '.zg-kitap-alt{display:block;font-size:.75rem;color:var(--muted2);margin-top:4px}',
    /* puan/yıl düğmeleri: .puan-btn görsel reçetesinin zg- kopyası (sınıf
       yeniden kullanılmaz — test seçici sözleşmesi) */
    '.zg-puan-secim,.zg-yil-izgara{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}',
    '.zg-puan-btn{width:40px;height:40px;border-radius:var(--r-md);border:1px solid var(--kontur);' +
      'background:transparent;color:var(--muted);font-size:.9rem;font-variant-numeric:tabular-nums}',
    '.zg-yil-btn{padding:9px 12px;border-radius:var(--r-md);border:1px solid var(--kontur);' +
      'background:transparent;color:var(--muted);font-size:.85rem;font-variant-numeric:tabular-nums}',
    '.zg-puan-btn:active,.zg-yil-btn:active{background:color-mix(in srgb,var(--brass) 12%,transparent)}',
    '.zg-eylem{display:flex;gap:16px;margin-top:14px}',
    '.zg-sessiz{font-size:.8rem;color:var(--muted);text-decoration:underline;text-underline-offset:3px;' +
      'text-decoration-color:var(--muted2);padding:2px 0;background:transparent;border:none;position:relative}',
    '.zg-sessiz::after{content:"";position:absolute;inset:-10px}'
  ].join('\n');

  function baslat(){
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);
    document.addEventListener('click', e => {
      const el = e.target.closest('[data-act]');
      if(!el) return;
      switch(el.dataset.act){
        case 'zg-tara': {
          ortuKur('zgTarama', 'Kütüphaneyi zenginleştir');
          const kdurum = kuyrukYukle();
          if(kdurum && kdurum.bitti && Object.keys(kdurum.bulunan).length){
            ac('zgTarama'); onizlemeCiz(kdurum);   // bitmiş tarama: doğrudan önizleme
          }else{
            taramaBaslat();
          }
          break; }
        case 'zg-durdur':
          if(calisiyor){ durdur = true; }
          else kapat('zgTarama');
          break;
        case 'zg-vazgec':
          kuyrukTemizle(); kapat('zgTarama'); durumTazele();
          bildir('Bulunanlar silindi — hiçbir şey yazılmadı');
          break;
        case 'zg-uygula': {
          const kdurum2 = kuyrukYukle();
          if(kdurum2) uygula(kdurum2);
          break; }
        case 'zg-cikar': {
          const kdurum3 = kuyrukYukle();
          if(kdurum3 && kdurum3.bulunan[el.dataset.kid]){
            delete kdurum3.bulunan[el.dataset.kid];
            kuyrukKaydet(kdurum3);
            onizlemeCiz(kdurum3);
          }
          break; }
        case 'zg-kapat': kapat(el.dataset.ortu); break;
        case 'zg-puanla': puanBaslat(); break;
        case 'zg-puan': puanVer(parseInt(el.dataset.v)); break;
        case 'zg-atla': puanSira++; puanCiz_(); break;
        case 'zg-tarih': tarihBaslat(); break;
        case 'zg-yil': yilVer(parseInt(el.dataset.v)); break;
        case 'zg-atla-tarih': tarihSira++; tarihCiz_(); break;
        case 'ayar-ac': durumTazele(); break;   // kapak/ocr/bildirim ile aynı kalıp
      }
    });
    durumTazele();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', baslat);
  else baslat();

  /* test kancaları */
  window.__zengin = { eksikSayim, alanBos, turCevir, baslikUyar, kitapSorgula, uygula,
    kuyrukYukle, kuyrukKaydet, kuyrukTemizle, puanlanacaklar, tarihsizler, durumTazele,
    taksonomiKur: t => { taksonomi = t; }, ARALIK_MS, ALANLAR, KUYRUK_ANAHTAR };
})();
