# Kitaplık Regresyon Test Paketi (Playwright)

163 vaka, 16 grup. Uygulamanın gerçek davranışını sabitler: bir değişiklik bir şeyi
kırarsa bu paket kırmızıya döner. (Mutasyon denetiminden geçti: 7 el-yapımı mutasyon +
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

## Yeni vaka ekleme

1. İlgili grup dosyasına `test('açıklama', async ({ page }) => {...})` ekle
   (`require('./yardim')`teki `test`i kullan, ham `@playwright/test`i DEĞİL —
   yoksa ağ denetimi devre dışı kalır).
2. Ağ gerekiyorsa `page.__agAyar` ile sahte yanıtı kur.
3. `npm test` — tamamı geçmeden commit yok (sprint disiplini).

## Bilinen gerçek-davranış notları (testlerde belgelendi)

- **Detaydan "Düzenle"**: düzenleme formu detay sayfasının ALTINDA açılır
  (iki `.ortu` da z-index:40, DOM'da sonraki üstte). Kullanıcı detayı kapatınca
  formu görür. g1'deki düzenleme testi bu yüzden önce detayı kapatır.
- **TR arama**: ASCII büyük I içeren arama ("HEIDEGGER") tr-locale küçültmede
  `ı`ya döner ve "Heidegger"i BULMAZ; TR klavye büyük i'si ("HEİDEGGER") bulur.
  g1'deki TR arama testi her iki davranışı da sabitler.
