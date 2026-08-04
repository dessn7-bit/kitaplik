# Kitaplık Regresyon Test Paketi (Playwright)

281 vaka, 23 grup. Uygulamanın gerçek davranışını sabitler: bir değişiklik bir şeyi
kırarsa bu paket kırmızıya döner. (Mutasyon denetiminden geçti: 9 el-yapımı mutasyon +
G12'nin 3 kritik düzeltmesi geri alındığında ilgili vakalar kırmızıya düşüyor.)

## Nasıl koşulur

```
npm test                                  # tüm paket
npx playwright test testler/g5_okuma_oturumu.spec.js   # tek grup
npx playwright test -g "hız hesabı"       # ada göre tek vaka
```

İlk kurulumda: `npm install` + `npx playwright install chromium`.

Koşum modeli: `playwright.config.js` yerel statik sunucuyu (`testler/sunucu.js`,
port 8124, repo kökü) kendisi başlatır. Her test **izole** bir tarayıcı bağlamında
koşar (temiz localStorage), service worker **engellidir** (`serviceWorkers:'block'`).

## Gruplar

| Dosya | Kapsam |
|---|---|
| g1_cekirdek | ekleme/düzenleme/silme, XSS kaçışlama, TR arama, filtreler, tarih doğrulama |
| g2_arama_kaynak | Google Books + kitaplik-ara worker + OpenLibrary zinciri, tekilleştirme, mod sorguları |
| g3_isbn_barkod | ISBN sağlama, elle giriş, kaynak birleşimi, kamera taklidi |
| g4_seri_tarama | katalog.js seri tarama: doğrudan ekleme, mükerrer koruması, geri al |
| g5_okuma_oturumu | oturum yaşam döngüsü, hız hesabı, 4 saat sınırı, kalıcılık |
| g6_seri_istatistik | üst üste gün serisi, ısı şeridi, yıllık hedef |
| g7_fikir_defteri | etiket ekleme/silme/filtre, TR mükerrer, kalıcılık |
| g8_senkron | `__senkron.birlestir` saf mantık + g damgası kalıcılığı (KRİTİK) |
| g9_gorunum_toplu | ızgara görünümü, çoklu seçim, toplu raf/etiket/durum/silme |
| g10_yedek_aktarim | JSON dışa/içe aktarım, Goodreads CSV, bozuk dosya |
| g11_alinti_karti | kart.js: PNG üretimi, boyutlar, taşma koruması, indirme/paylaşım |
| g12_veri_guvenlik | ızgara kapak yedeği (XSS), mezar taşı kalıcılığı, Düzenle görünürlüğü, yedek id çakışması, anlık görüntü boyutu + kota şeridi |
| g13_hizli_kazanimlar | not kimliği (data-nid/kid), raf gruplama düğmesi, ISBN ağ teşhisi, markdown dışa aktarım, paylaş hedefi |
| g14_okur_zekasi | zeka.js: tür/yazar puan analizi, bırakma analizi, oturumlardan aylık sayfa, saat dağılımı, sayfa hedefi |
| g15_veri_modeli | çevirmen/dil, elle ISBN, yeniden okuma (okumalar[]), seri+cilt, sahiplik/istek listesi, hedef damgası |
| g16_duzeltmeler | istek rozeti (liste+ızgara), kütüphaneyi boşalt üst düzey alanlar, eksik cilt boşluk mantığı |
| g17_fikir_agi | fikirag.js: eş-geçim, komşular, kesişim görünümü, fikir haritası sıralamaları, ilişki önerisi |
| g18_fikirag_duzeltme | tüm kaynaklarda kontrol karakteri taraması, kesişim alt listeyi de süzer |
| g19_dogruluk | Türkçe katlama (arama + kopya tespiti + etiket), oturumda tek sayfa kutusu |
| g20_worker_sw | worker: boş sonuç cache'lenmez, kaynak sayaçları, /saglik · sw: köken filtresi, çevrimdışı yedek |
| g21_gorunum_erisim | karanlık tema + kontrast (hesaplanmış), geniş ekran kırılımları, Esc/odak tuzağı/aria, dokunma hedefleri |
| g22_aria_rapor | tam ARIA dialog (role/aria-modal/labelledby, inert katmanları), rapor.js yıl sonu raporu + PNG |
| g23_kapak_foto | kapak.js: kendi kapak fotoğrafı — IndexedDB deposu, boyut/kalite işleme, yerel>uzak>sırt önceliği, silme kancaları, senkron/yedek dışında kalma, tembel yükleme |

**Yeni kitap alanı eklerken:** `kitapNormalize`'a eklemeyi unutma — yoksa alan yenilemede
sessizce silinir. Her yeni alan için "yenilemede korunur" vakası zorunlu (g15 deseni).

## Ağ taklidi — HİÇBİR test gerçek ağa çıkmaz

`yardim.js` içindeki `agTaklit` her dış isteği yakalar:

- `googleapis.com/books`, `kitaplik-ara.dessn7.workers.dev`, `openlibrary.org`,
  Firebase uçları ve kapak görselleri → sahte yanıt döner.
- **Taklit edilmeyen her dış istek abort edilir ve test HATA verir**
  (test-sonu denetimi `yardim.js`teki `test` fixture'ında).

Test içinde yanıt değiştirme:

```js
page.__agAyar.google = { totalItems: 1, items: [...] };  // sahte Google yanıtı
page.__agAyar.worker = 'hata';                           // ağ hatası taklidi
```

Sayaçlar: `page.__agSayac.google / worker / olArama / olKitap`, son Google URL'si
`page.__agSayac.sonGoogleUrl` (inauthor:/inpublisher: doğrulamada kullanılır).

Yeni bir dış kaynak eklersen: `agTaklit` içine bir `url.includes(...)` dalı ekle,
yoksa o kaynağa giden her istek testleri düşürür (bilinçli tasarım).

## Kamera taklidi

`kameraTaklit(page)` → sahte `BarcodeDetector` + `getUserMedia` kurar
(goto'dan ÖNCE çağır). Barkod okutmak: `page.evaluate(k => window.__sahteKod = k, '978...')`.
Akış kapanınca `window.__akisDurdu` true olur. `kameraYok(page)` desteksiz cihaz taklididir.

## Veri tohumlama

```js
const { tohumla, sahteKitap } = require('./yardim');
await tohumla(page, [sahteKitap({ ad: 'X', durum: 'okunuyor' })], { kk_oturum_v1: {...} });
await page.goto('/');
```

Tohum yalnız İLK yüklemede yazılır — reload testlerinde uygulamanın kaydettiği
veri ezilmez (`__kk_tohumlandi` bayrağı).

## Ad alanı kuralı (sprint dersi)

Yeni bir UI parçası eklerken **kendi ad alanını kullan**: yeni CSS sınıfı ve `data-act`
değerleri benzersiz önek taşısın (`zk-` gibi). Mevcut bir sınıfı (`.ol-sonuc`, `.not-kart`,
`.yedek-kart`) veya mevcut bir `data-act` değerini yeni bağlamda tekrar kullanmak,
testlerdeki genel seçicileri gölgeliyor ve alakasız vakaları kırıyor (iki kez yaşandı).
Görsel dili korumak için stilleri kopyala, seçici adlarını yenile.

**Seçiciler her zaman kapsamlı olsun:** `page.locator('#panel-alinti .fa-kart')` gibi.
Belge geneli sınıf seçicisi (`page.locator('.vm-rozet')`) bugün tek eşleşme bulsa bile,
aynı sınıf ikinci bir yerde kullanıldığı anda strict-mode ihlaliyle kırılır — üç kez yaşandı.

## Yeni vaka ekleme

1. İlgili grup dosyasına `test('açıklama', async ({ page }) => {...})` ekle
   (`require('./yardim')`teki `test`i kullan, ham `@playwright/test`i DEĞİL —
   yoksa ağ denetimi devre dışı kalır).
2. Ağ gerekiyorsa `page.__agAyar` ile sahte yanıtı kur.
3. `npm test` — tamamı geçmeden commit yok (sprint disiplini).

## Bilinen gerçek-davranış notları (testlerde belgelendi)

- **Detaydan "Düzenle"**: eskiden form detayın ALTINDA açılıyordu (iki `.ortu` da
  z-index:40). G12 M3'te düzeltildi: `duzenle` artık detay örtüsünü kapatıyor,
  kaydedince `formKaydet` detayı geri açıyor. (Bu not, düzeltilmiş davranışı belgeler.)
- **Pencere katmanları**: çekirdek her `.ortu` açılışında ARIA (role/aria-modal/
  labelledby) kurar ve arka planı `inert`+`aria-hidden` yapar; açık pencerenin
  KENDİSİ asla gizlenmez. Yeni pencere eklerken `.ortu > .sheet > .sheet-baslik`
  desenine uy, gerisi kendiliğinden çalışır.
- **TR arama**: G19 M1'den beri `katla()` hem i-ailesini hem aksanları düzleştirir;
  "HEIDEGGER", "HEİDEGGER", "heidegger" hepsi bulur. Etiket mükerrer kontrolü ise
  `iKatla()` kullanır (yalnız i-ailesi) — "saç" ile "sac" ayrı etiket kalır.
- **Kapak fotoğrafları (G23, KARAR)**: kullanıcı çekimi kapaklar IndexedDB'de
  (`kk_kapak_v1`, anahtar = kitap id) durur; **cihaz yerelidir** — senkron PUT'una ve
  JSON yedeğine bilinçli olarak girmez (senkron tüm kütüphaneyi tek gövdede gönderiyor;
  ikili veri kota + hızı çökertirdi). Kitap kaydında yalnız `kapakYerel` boolean'ı
  senkronlanır/yedeklenir. Gösterim önceliği: yerel > uzak URL > sırt. Testte IndexedDB'ye
  fixture yazmak: `page.evaluate(... window.__kapak.yaz(id, blob))` (g23'teki `blobEk`).
