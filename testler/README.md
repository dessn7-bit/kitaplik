# Kitaplık Regresyon Test Paketi (Playwright)

82 vaka, 11 grup. Uygulamanın gerçek davranışını sabitler: bir değişiklik bir şeyi
kırarsa bu paket kırmızıya döner. (Mutasyon denetiminden geçti: 7 el-yapımı mutasyonun
7'si de en az bir vakayı kırmızıya düşürüyor.)

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
