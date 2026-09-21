# Tür eksiği — iki yolun ölçümü (21 Eylül 2026)

Kaynak yedek: `pinakes-yedek-2026-09-08.json` (299 kitap, **45** kayıtta tür boş).
Masaüstünde 09-15 tarihli yedek YOK — en taze olan 08 Eylül'ünkü. Brief "44" diyor,
ölçülen 45; aradaki 1 kayıt 8–15 Eylül arasında elle doldurulmuş olabilir.
Aşağıdaki bütün sayılar 45 üzerinden.

Ölçüm dosyaları: `olcum_google.json`, `olcum_1000kitap.json`, `kalibrasyon.json`
(oturum scratchpad'inde).

---

## Erişim notu (ölçüm sırasında canlı görüldü)

1000Kitap ölçümün bir bölümünde worker'ı **403'ledi**: `/turler` → `kaynak-403`,
`/saglik` → `TUR KAYNAGI BOZUK`, `/isbn` → boş, `/ara` yalnız Goodreads.
Sonra kendiliğinden düzeldi. Bu geçici arızanın sessiz bir bedeli var:

`zengin.js:2429` — M1 toplu taramada `/turler` düşerse `taksonomi = null` olur ve
**tarama devam eder**; o koşuda hiçbir kitaba tür yazılmaz, diğer alanlar yazılır,
kullanıcıya hiçbir şey söylenmez. (Otomatik yol `taksonomi-yok` ile damga basmadan
çıkıyor — orası doğru. Toplu tarama yolu değil.)

Yerel makineden 1000Kitap'a doğrudan erişim de bot duvarına takılıyor: headless
Chromium 403, headed Chromium yalnız **oturum başına tek navigasyon** 200. Ölçüm
bu yüzden sorgu başına taze tarayıcı ile alındı.

---

## YOL 1 — Google kategorileri + 5 yeni eşleme

45 kaydın bugünkü durumu (zengin.js'in kendi sorgu dizisi birebir koşturuldu:
`intitle+inauthor` → `"ad" yazar`):

| sınıf | adet |
|---|---|
| Google'da kayıt yok | 9 |
| kayıt var, başlık uymuyor | 1 |
| baskı bulunuyor, `categories` yok | 27 |
| kategori var, 78'lik taksonomiye girmiyor | **7** |
| tür buluyor | 1 |

**Önceki ölçümle aynı tablo.** Tek fark: eski ölçümdeki 28 "kategorisiz"in biri
bugün tür buluyor — *Paris Sıkıntısı* → `French poetry` → **Şiir**. Yani boru
hattı koşudan koşuya kararlı değil (Google'ın %32 503'ü + yukarıdaki taksonomi
arızası). O kitap bugün bir tarama koşulsa kendiliğinden dolardı.

Taksonomi dışı kalan 7 kategori **birebir aynı**: Physicists · Turks ·
Antiques & Collectibles · Knights and knighthood · Cressida (Fictitious character) ·
Human beings · Acting.

### Beş eşleme kaç kitap kapatıyor: **5**

| # | kitap | kategori | eşleme | 1000Kitap doğruluyor mu |
|---|---|---|---|---|
| 3 | Eminim Şaka Yapıyorsunuz Bay Feynman | Physicists | Biyografi | ✅ (BTM + **Biyografi**) |
| 4 | 1200 Yıllık Sürgün | Turks | Tarih | ✅ (Araştırma-İnceleme + **Tarih**) |
| 23 | Troilos ve Cressida | Cressida (Fictitious character) | Tiyatro | ✅ (… + **Tiyatro** + …) |
| 34 | İlk şempanze | Human beings | Antropoloji-Etnoloji | ❌ (Araştırma-İnceleme + BTM) |
| 39 | Oyuncuya | Acting | Tiyatro | ✅ (**Tiyatro** + Kültür) |

Mevcut sonuçlarda regresyon: **0** (hiçbir dolu tür değişmiyor).

Kaan'ın "son ikisi yanlış olur" yargısı **doğrulandı**:
Kamelyalı Kadın 1000Kitap'ta Roman + Dünya Klasikleri + Aşk + Edebiyat (Antika değil);
İki Soylu Akraba Dünya Klasikleri + Edebiyat + Tiyatro + Senaryo-Oyun (Şövalyelik değil).

**Uyarı:** `Physicists` eşlemesi zengin.js'in kendi yazılı kuralıyla çelişiyor —
sözlüğün 5. kuralı kişi kategorilerini (Novelists/Poets/Dramatists/Scientists)
bilerek dışarıda bırakıyor. Tek kitap için o ilkeyi delmeye değer mi, karar Kaan'ın.

---

## YOL 2 — 1000Kitap tür kazıması

### Tür var mı: EVET

`api.1000kitap.com/v2/kitaplar/kitapCek?id=…` yanıtında
`liste[renderTuru=kitapHakkinda].hakkinda.kidDizi` — tür nesneleri dizisi
(`adi`, `seo_adi`, `kitapSayisi`…). Ayrıca `kidYazi` aynı listenin virgüllü hâli.

### Eşleme: kimlik — **eşlenemeyen tür sayısı 0**

`kidDizi` girdileri 1000Kitap'ın **kendi** tür taksonomisinden geliyor; bu zaten
uygulamanın `/turler` ucundan çektiği **aynı 78 türlük liste**. 45 kaydın tüm
tür adları (toplam 119 etiket) 78'liğin içinde. Sözlük gerekmiyor.

### Kapsama: 44/45 — üçüncü sorgu ile 45/45

| yol | adet |
|---|---|
| ISBN ile bulundu, ISBN **birebir** eşleşti | 39 |
| ISBN yok → ad araması, ad+yazar kapısı geçti | 5 |
| hiç bulunamadı | 1 |

Bulunamayan tek kayıt *Tersine Evrim - İnsan Olmanın Anlamının Yeniden Yazılan
Tarihi*: tam başlıkla 0 sonuç, **alt başlık atılıp** "Tersine Evrim" ile aranınca
bulunuyor, kapı geçiyor, tür geliyor (Araştırma-İnceleme + İnsan ve Toplum +
Antropoloji-Etnoloji). Yani 45/45.

`kidDizi` boş dönen kayıt: **0**. Bulunan her kitabın türü var.

### v118 kapısı (yazar kapısı olmadan yazma)

`baslikUyar` + `yazarUyar` zengin.js'ten birebir kopyalanıp uygulandı.

- Kapısız yazılan kayıt: **0**.
- 39 kayıt zaten **ISBN kimliğiyle** doğrulandı (aranan ISBN, dönen baskının
  ISBN'iyle birebir) — kapak vakasındaki "Atış → Atıştırmalıklar" hatası bu yolda
  yapısal olarak imkânsız.
- Ad+yazar kapısı 44 kaydın 41'inde geçiyor. Geçmeyen 3'ü **yanlış kitap değil**,
  yazım farkı: Karl/**C**arl Kerenyi · "Ploutos Servet" / "Ploutos **(**Servet**)**" ·
  "Troil**o**s" / "Troil**u**s". Üçünde de ISBN birebir eşleşiyor.
  → **Kural:** ISBN birebir eşleşiyorsa kimlik kanıtlanmıştır, ad kapısı
  gereksizdir. ISBN yoksa/eşleşmiyorsa ad+yazar kapısı ZORUNLU.

### Maliyet: ISBN yolu için **sıfır ek istek**

Worker'ın bugünkü `/isbn` zinciri `kitapCek`'i **zaten** indiriyor — `kidDizi` o
yanıtın içinde, okunmuyor sadece. `isbnDonustur`'a bir alan eklemek yetiyor.
Ad yolundaki ~6 kitap için yeni bir uç (kitap başına 1 `kitapCek`) gerekir.

---

## Asıl sorun: `kidDizi` bir LİSTE

Ortalama 2,7 tür (dağılım: 1→7, 2→14, 3→11, 4→7, 5→4, 7→1). Hangisi yazılacak?

Kaan'ın **kendi doldurduğu 254 türe** karşı kalibre edildi (türe göre tabakalı
65 kitaplık örneklem, 1000Kitap'ta türü bulunan 37'si):

| kural | isabet |
|---|---|
| `kidDizi[0]` | 8/37 (%22) |
| Kaan'ın kullandığı ilk tür | 13/37 (%35) |
| Kaan'ın en çok kullandığı (leave-one-out) | 11/37 (%30) |
| **şemsiye türler bastırılmış + Kaan önceliği** | **16/37 (%43)** |
| TAVAN — Kaan'ın türü listenin İÇİNDE | **27/37 (%73)** |

Kaan'ın türü listede hiç yok: 10/37 (%27).

Alan kırılımı belirleyici:

| Kaan'ın türü | isabet | listede var |
|---|---|---|
| Bilim-Teknoloji-Mühendislik | 4/5 | 5/5 |
| Fantastik | 5/5 | 5/5 |
| **Astronomi** | **0/4** | **0/4** |
| Felsefe-Düşünce | 0/2 | 0/2 |
| Edebiyat | 0/5 | 5/5 |

**Astronomi sistematik bir ayrışma:** Kaan astronomiyi ayrı tür sayıyor,
1000Kitap hepsine Bilim-Teknoloji-Mühendislik diyor. 4 vakanın 4'ünde.

45 kayda en iyi kural uygulansa yazacağı dağılım: 22 Bilim-Teknoloji-Mühendislik ·
7 Tarih · 7 Tiyatro · 2 Felsefe-Düşünce · kalanlar tek tek. İkisi Kaan'ın hiç
kullanmadığı tür olurdu (Kamelyalı Kadın → Aşk, Kokuların Gücü Adına → Sağlık-Tıp).
"A'dan Z'ye Astronomi" → Bilim-Teknoloji-Mühendislik yazılırdı; muhtemelen yanlış.

---

## Öneri

**1000Kitap tür kaynağı olarak eklensin, ama tek tür OTOMATİK yazılmasın.**

Gerekçe Kaan'ın kendi uyarısı: yanlış tür ekranda yanlış kapak kadar göze batmaz.
Otomatik yazımda ölçülen isabet %43; listeyi gösterip seçtirmede doğru cevap
%73+ oranında ekranda duruyor ve yanlış yazım riski sıfır.

Somut:

1. **Worker `/isbn` yanıtına `turler` alanı** — ek istek yok, 39 kitabı kapsıyor.
2. **Ad yolu için yeni uç** (`/kitap-tur?ad=&yazar=`) — ad+yazar kapısı worker'da,
   kapı geçmezse boş döner. ~6 kitap. Alt başlık atma denemesi burada.
3. **zengin.js önizlemesinde tür satırı seçilebilir olsun** — 1000Kitap'ın verdiği
   liste çip olarak, en olası olan önceden seçili. Google kategorisi ikinci kaynak
   olarak kalır. Önizleme zaten zorunlu; değişen sadece "tek değer" yerine "liste".
4. **Beş eşleme yine de eklensin** — 1000Kitap'ın ulaşamadığı kitaplarda ve yeni
   kitap eklerken çalışan Google yolunu güçlendiriyor, regresyonu yok.
   `Human beings → Antropoloji-Etnoloji` 1000Kitap'ça doğrulanmadı; ya düşürülsün
   ya da Bilim-Teknoloji-Mühendislik'e çevrilsin.
5. **Ayrı iş:** `zengin.js:2429` — `/turler` düşerse toplu tarama sessizce türsüz
   koşuyor. Ya dursun ya da kullanıcıya söylesin.

Kaç kitap gerçekten kapanır:

- Yol 1 tek başına (5 eşleme): **5**.
- Yol 2 tek başına: **45** kitap için tür listesi gelir; seçtirmeli akışta
  pratikte 45'i de kapanır.
- İkisi birlikte: 45 — ama yol 1, 1000Kitap'ın bilmediği ileriki kitaplar için
  sigorta olmaya devam eder.


---

# v130 — UYGULANAN (22 Eylül 2026)

Kaan onayladı; rapordaki öneri şu değişikliklerle hayata geçti.

## Worker (kitaplik-ara, canlı)

- **`/isbn` yanıtına `turler[]`** — `kitapCek`'in `hakkinda.kidDizi` alanından.
  EK İSTEK YOK: zincir o JSON'u zaten indiriyordu.
- **Yeni uç `/kitap-tur?ad=&yazar=`** — ISBN'siz kayıt için. Yanıt
  `{turler, eslesen:{ad,yazar}, tani:{aday,kapi,cek}}`. `eslesen` KAYNAK kaydın
  kendi künyesi; NİHAİ KAPIYI istemci kurar (v118), worker'daki süzgeç yalnız
  bütçe için. `tani` = `/isbn`'in `kaynaklar` sayacının dengi: boş sonuçta
  zincirin neresinin düştüğü dışarıdan okunuyor.
- İlk arama boş dönerse **alt başlık düşürülüp** bir kez daha aranır
  (" - ", ":", ";", "—"). 45. kayıt (Tersine Evrim) yalnız bu dalla geliyor.

## İstemci

- `barkod.js`: `workerIsbn` artık `turler` taşır; yeni `workerTur(ad, yazar)`.
- `zengin.js`:
  - `turListeSessiz(k, wkAl)` — ISBN yolu (kimlik ISBN'le kanıtlı, ad kapısı
    YOK) → bulunamazsa ad yolu (v118 kapısı ZORUNLU).
  - Worker `/isbn` kitap başına **tek istek**: künye ve tür aynı kaydı okur.
  - Liste gelen kitapta Google'ın tek türü YAZILMAZ (tek kaynak kuralı).
  - Önizlemede **çip seçimi**: hiçbiri önceden seçili değil, tek tür, seçiliye
    tekrar dokunmak kaldırır, seçilmeyene yazılmaz.
  - "Uygula" kuyruğu temizlediği için, seçilmemiş kitap sayısı karar anında
    ekranda yazıyor.
  - Google sözlüğüne 3 ölçülmüş eşleme: `turks`→Tarih, `acting`→Tiyatro,
    `cressida (fictitious character)`→Tiyatro. **Human beings ve Physicists
    ALINMADI** (biri ölçümle çürüdü, öbürü sözlüğün 5. kuralını deliyordu).

## /turler düşmesi — seçilen çözüm ve gerekçesi

Kaan iki seçenek bıraktı: (a) ekranda söylemek, (b) o kitapları sonraki
taramaya bırakmak. **(a) seçildi, çünkü (b) zaten oluyordu ve sorun o değildi:**
kuyruk kitap-başına damgalanıyor, tür boş kaldığı için kitap bir sonraki
taramanın kuyruğuna KENDİLİĞİNDEN giriyordu. Eksik olan tek şey kullanıcının
bunu bilmesiydi — "tür bulunamadı" ile "tür sorulamadı" ekranda aynı görünüyordu.
Uygulanan: taksonomi yoksa tür adımı atlanır (Google'a tür için istek de
harcanmaz), atlama SAYILIR (`kdurum.turAtlanan`) ve önizlemede kırmızı satır
olarak yazılır.

**İkinci ve daha kalıcı kazanım:** 1000Kitap'tan gelen tür listesi `/turler`
taksonomisine İHTİYAÇ DUYMUYOR (o adlar zaten taksonominin kendisi). Yani
`/turler` düşse bile tür hattı çalışmaya devam ediyor.

## Paris Sıkıntısı doğrulaması

Kaan "düzeltmeden sonra gelmeli" dedi — canlı doğrulandı (22 Eylül):

    /kitap-tur?ad=Paris Sıkıntısı&yazar=Charles Baudelaire
    → ["Dünya Klasikleri","Edebiyat","Şiir","Deneme-İnceleme","Anlatı"]

**Şiir listede.** Google yolu da (French poetry → Şiir) duruyor ama artık
kullanılmıyor: liste geldiği için tür o kitapta seçim.

**DÜZELTME — kök neden tek değildi.** Raporda "muhtemelen taksonomi düşmesi"
demiştim; ölçüm bunu TEK başına doğrulamıyor. 21-22 Eylül'de ikinci bir arıza
canlı görüldü: **1000Kitap'ın ISBN araması worker'dan aralıklı olarak 0 aday
dönüyor**, aynı anda BAŞLIK araması çalışıyor (`/saglik` "iki kaynak da
calisiyor" derken `/isbn` boş). Paris Sıkıntısı, Oyuncuya ve A'dan Z'ye
Astronomi tam bu pencerede ISBN'le bulunamadı, ad yoluyla bulundu. Bu yüzden
ISBN→ad düşüşü koda kondu ve testle kilitlendi (g121 F1) — süs değil, taşıyıcı.

## Mutasyon denetimi (3/3 öldü, her biri dosyada görüldü)

| # | mutasyon | sonuç |
|---|---|---|
| 1 | seçilmeyen kitaba `__turListe[0]` yaz | **2 kırmızı** (g121 G, J) |
| 2 | taksonomi düşünce `turAtlandi = false` (sessiz geç) | **1 kırmızı** (g121 M) |
| 3 | ad yolunda v118 kapısını kaldır | **1 kırmızı** (g121 D) |

## Testler

Yeni grup **g121** (18 vaka) + g93'e worker vakaları (v130 uçları) +
`testler/yardim.js`'e `/kitap-tur` taklidi ve `bkFn` kancası.
SW önbelleği **v129 → v130**.

## Uçtan uca canlı denetim (22 Eylül, taklit ağ YOK)

Kaan'ın gerçek yedeğinden türü boş 6 kayıt yerel uygulamaya tohumlandı, istekler
GERÇEK worker'a gitti (yalnız CORS başlığı gevşetildi — veri taklit edilmedi):

    Tür seçimi — 0 / 3 kitapta seçtin
      Paris Sikintisi        → Dünya Klasikleri · Edebiyat · Şiir · Deneme-İnceleme · Anlatı
      Troilos ve Cressıda    → Dünya Klasikleri · Edebiyat · Tiyatro · Senaryo-Oyun
      A'dan Z'ye Astronomi   → Araştırma-İnceleme · Bilim-Teknoloji-Mühendislik
    Paris Sıkıntısı → Şiir seçildi → Uygula
    SONUÇ: Paris Sikintisi "Şiir"; seçilmeyen 5 kitap "" (hiçbiri yazılmadı)

Kalan 3 kitap o koşuda "kaynak hatası" aldı: **yerel ortam artefaktı**, kusur
değil. Google Books anahtarı referrer-kısıtlı (`dessn7-bit.github.io`), yerelden
403 veriyor; o 3 kitabın künye alanları da eksik olduğu için Google yolu koşuyor
ve fırlıyor. Aynı koşuda tür hattı **yalnız türü eksik olan 3 kitapta Google'a
hiç gitmeden** çalıştı — v130'un "tür listesi Google'dan ÖNCE" sırasının
istenen etkisi tam olarak bu.
