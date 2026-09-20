'use strict';
/* G94 — NOT DOSYASI içe aktarımı (v98 ekleme → v99 KİTAP BAZINDA YENİLEME →
   v129 İÇERİKLE EŞLEŞME). { "surum": 1, "not": [ {ad, yazar, metin, tip} ] } →
   ad+yazar katla eşleme → önizleme → onay → yazım. Sözleşme:
   · içe aktarımla yazılan her not kaynak işaretli (kayn:'dosya'; kitapNormalize
     yalnız işaret varken taşır — işaretsiz kayıtların parmak izi değişmez);
   · v129: dosyada GEÇEN her kitap için işaretli notlar dosya satırlarıyla
     katla(metin) düzeyinde EŞLEŞTİRİLİR — eşleşen not OLDUĞU GİBİ kalır (id,
     favori, fikir, tekrar*, tarih, ng; mezar yok); ham metin/tip farklıysa
     YERİNDE güncellenir (aynı id); dosyadan ÇIKAN işaretli not kaldırılır
     (silinenNotlar mezarı, not-sil yolunun aynısı); GİREN satır işaretli yazılır;
   · 1↔1 kuralı: kitapta tam bir işaretli not çıkıp tam bir satır giriyorsa
     sil+ekle DEĞİL yerinde güncelleme (id + üst-veri korunur, mezar yok);
   · değişim yoksa Uygula düğmesi bile yok: aynı dosya on kez → sıfır yazım,
     sıfır mezar (v99'da her yükleme +N mezar biriktiriyor, üst-veriyi siliyordu);
   · işaretsiz notlar (elle/paylaşım/Goodreads) ve dosyada geçmeyen kitaplar
     HİÇ dokunulmaz; boş "not" dizisi hiçbir şey silmez; onaysız tek bayt yok;
   · önizleme beşini sayar (yazılacak / yerinde güncellenecek / kaldırılacak /
     zaten güncel / korunacak), kitap kitap gösterir, SİLME içerdiğini söyler;
   · tip yalnız not|alinti (katla), başkası atlanır+sayılır; eşleşmeyen satır
     listelenir; dosya içi tekrar ve elle nota eş metin "zaten vardı".
   KAYNAK KİLİDİ (daraltılmış, kaldırılmadı): silme yalnız işaretli + plan id'li
   notlarda ve yalnız iceNotUygula'da; metin/tip yazımı yalnız iceNotGuncelle'de
   ve kapısı iceNotIsareti; işaretsiz nota dokunan her yol kırmızı. */
const { test, expect, tohumla, sahteKitap, rafAc, ayarlarAc,
  dosyadanYukle, jsonDosya } = require('./yardim');
const fs = require('fs');
const path = require('path');

const ELLE_ALINTI = { id: 'elle1', tip: 'alinti', metin: 'elle alıntı', tarih: '2024-01-01', sayfa: 12, ng: 5 };
const ELLE_NOT = { id: 'elle2', tip: 'not', metin: 'elle not', tarih: '2024-01-02', sayfa: null, ng: 6 };
const ESKI_ICE = { id: 'ice1', tip: 'not', metin: 'eski içe aktarım notu', tarih: '2024-02-01', sayfa: null, ng: 7, kayn: 'dosya' };
function kitaplik() {
  return [
    sahteKitap({ ad: 'Kitap A', yazar: 'Yazar A', notlar: [ELLE_ALINTI, ELLE_NOT], puan: 8 }),
    sahteKitap({ ad: 'Kitap B', yazar: 'Yazar B', notlar: [] }),
    sahteKitap({ ad: 'Kitap C', yazar: 'Yazar C', notlar: [ESKI_ICE, ELLE_NOT] })];   // dosyada GEÇMEYECEK
}
const DOSYA_V1 = { surum: 1, not: [
  { ad: 'Kitap A', yazar: 'Yazar A', metin: 'Dosya alıntısı A1', tip: 'alinti' },
  { ad: 'KİTAP A', yazar: 'yazar a', metin: 'Dosya notu A2', tip: 'not' },          // katla eşleşmesi, aynı kitaba 2. satır
  { ad: 'Kitap B', yazar: 'Yazar B', metin: 'Dosya notu B', tip: 'not' },
  { ad: 'Olmayan Kitap', yazar: 'Kimse', metin: 'boşa gider', tip: 'not' },      // eşleşmeyen
  { ad: 'Kitap B', yazar: 'Yazar B', metin: 'yorum satırı', tip: 'yorum' },     // tip bozuk
  { ad: 'Kitap A', yazar: 'Yazar A', metin: '   ', tip: 'not' },                 // eksik alanlı
  { ad: 'Kitap A', yazar: 'Yazar A', metin: 'ELLE ALINTI', tip: 'alinti' }       // elle nota eş → zaten vardı
] };
const DOSYA_V2 = { surum: 1, not: [
  { ad: 'Kitap A', yazar: 'Yazar A', metin: 'Dosya alıntısı A1 (düzeltildi)', tip: 'alinti' },
  { ad: 'Kitap A', yazar: 'Yazar A', metin: 'Dosya notu A2', tip: 'not' },
  { ad: 'Kitap A', yazar: 'Yazar A', metin: 'Dosya notu A3 (yeni satır)', tip: 'not' },
  { ad: 'Kitap B', yazar: 'Yazar B', metin: 'Dosya notu B (düzeltildi)', tip: 'not' }
] };
async function dosyaYukle(page, govde, ad) {
  /* v109: tek giriş — boruyu dosyanın kök anahtarı ("not") seçiyor */
  await dosyadanYukle(page, jsonDosya(govde, ad || 'notlar.json'));
}
async function hazirla(page) {
  await tohumla(page, kitaplik());
  await rafAc(page);
  await ayarlarAc(page);
}
const oku = page => page.evaluate(() => veri.kitaplar.map(k => ({
  ad: k.ad, g: k.g, puan: k.puan, mezar: k.silinenNotlar || {},
  notlar: (k.notlar || []).map(n => ({ id: n.id, tip: n.tip, metin: n.metin, tarih: n.tarih, sayfa: n.sayfa, ng: n.ng, kayn: n.kayn })) })));
/* v129: üst-veri dahil tam görüntü (favori/fikir/tekrar*) — korunma iddiaları için */
const okuTam = page => page.evaluate(() => veri.kitaplar.map(k => ({
  ad: k.ad, g: k.g, mezar: k.silinenNotlar || {},
  notlar: (k.notlar || []).map(n => ({ id: n.id, tip: n.tip, metin: n.metin, tarih: n.tarih, ng: n.ng, kayn: n.kayn,
    favori: n.favori, fikir: n.fikir, tekrarSonraki: n.tekrarSonraki, tekrarAralik: n.tekrarAralik,
    tekrarSayisi: n.tekrarSayisi, tekrarDurum: n.tekrarDurum })) })));
async function uygula(page) {
  await page.click('[data-act="zg-not-uygula"]');
  await expect(page.locator('#zgNotIceOrtu.acik')).toHaveCount(0);
}
const kayitsiz = n => { const c = { ...n }; delete c.kayn; return c; };

test.describe('G94 not dosyası — kitap bazında yenileme (v99)', () => {

  test('a+f) önizleme üç sayı + kitap kitap + SİLME uyarısı; onaysız yazım yok; elle notlar AYNEN; aynı kitaba 2 satır', async ({ page }) => {
    await hazirla(page);
    await dosyaYukle(page, DOSYA_V1);
    await expect(page.locator('#zgNotIceOrtu')).toHaveClass(/acik/);
    const ozet = page.locator('#zgNotIceOrtu .zg-ozet');
    await expect(ozet).toContainText('3 satır yazılacak');
    await expect(ozet).toContainText('0 not yerinde güncellenecek');
    await expect(ozet).toContainText('0 içe aktarım notu kaldırılacak');
    await expect(ozet).toContainText('0 not zaten güncel');
    await expect(ozet).toContainText('2 elle girilmiş not korunacak');
    await expect(ozet).toContainText('1 satır zaten vardı');
    await expect(ozet).toContainText('1 satır eşleşmedi');
    await expect(ozet).toContainText('1 satır tip alanı bozuk');
    await expect(ozet).toContainText('1 satır eksik alanlı');
    await expect(page.locator('#zgNotIceOrtu .zg-not')).toContainText('silme içermiyor');   // ilk yükleme: çıkan not yok
    await expect(page.locator('#zgNotIceOrtu .zg-not')).not.toContainText('SİLME içerir');
    await expect(page.locator('#zgNotIceOrtu')).toContainText('2 yazılacak · 0 güncellenecek · 0 kaldırılacak · 0 aynı · 2 korunacak');   // Kitap A satırı
    await expect(page.locator('#zgNotIceOrtu')).toContainText('Olmayan Kitap');
    await expect(page.locator('[data-act="zg-not-uygula"]')).toHaveText('Uygula (3 yaz)');
    // ONAYSIZ HİÇBİR ŞEY YAZILMADI
    let d = await oku(page);
    expect(d[0].notlar.map(kayitsiz)).toEqual([ELLE_ALINTI, ELLE_NOT]);
    expect(d[1].notlar.length).toBe(0);
    await page.click('[data-act="zg-not-uygula"]');
    await expect(page.locator('#toast')).toContainText('3 not dosyadan yazıldı (2 kitap)');
    await expect(page.locator('#zgNotIceOrtu')).not.toHaveClass(/acik/);
    d = await oku(page);
    // elle girilenler AYNEN (id/ng/sayfa dahil), işaretsiz
    expect(d[0].notlar.slice(0, 2)).toEqual([{ ...ELLE_ALINTI, kayn: undefined }, { ...ELLE_NOT, kayn: undefined }]);
    // f) aynı kitaba 2 satır, ikisi de işaretli yazıldı
    expect(d[0].notlar.slice(2).map(n => [n.tip, n.metin, n.kayn]))
      .toEqual([['alinti', 'Dosya alıntısı A1', 'dosya'], ['not', 'Dosya notu A2', 'dosya']]);
    expect(d[1].notlar.map(n => [n.metin, n.kayn])).toEqual([['Dosya notu B', 'dosya']]);   // 'yorum satırı' YOK
    // şema: id, tarih (bugün), sayfa null, ng damgası; k.g kullanıcı eylemi; puan dokunulmadı
    const yeni = d[0].notlar[2];
    expect(yeni.id).toMatch(/^[a-z0-9]{8,}$/);
    expect(yeni.tarih).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(yeni.sayfa).toBeNull();
    expect(yeni.ng).toBeGreaterThan(0);
    expect(d[0].g).toBeGreaterThan(0);
    expect(d[0].puan).toBe(8);
    expect(Object.keys(d[0].mezar).length, 'ilk yüklemede silinecek işaretli not yoktu → mezar yok').toBe(0);
    // yenilemede kalıcı: işaret korunur, işaretsizde alan HİÇ oluşmaz (parmak izi kararlılığı)
    await page.reload();
    const ham = await page.evaluate(() => veri.kitaplar[0].notlar.map(n => ({ metin: n.metin, kaynVar: 'kayn' in n, kayn: n.kayn })));
    expect(ham).toEqual([
      { metin: 'elle alıntı', kaynVar: false, kayn: undefined },
      { metin: 'elle not', kaynVar: false, kayn: undefined },
      { metin: 'Dosya alıntısı A1', kaynVar: true, kayn: 'dosya' },
      { metin: 'Dosya notu A2', kaynVar: true, kayn: 'dosya' }]);
  });

  test('b) düzeltilmiş dosya ikinci kez: aynen duran not KALIR, çıkan gider (mezarla), giren gelir, tek-değişen YERİNDE; elle notlar durur; üçüncü kez değişim yok', async ({ page }) => {
    await hazirla(page);
    await dosyaYukle(page, DOSYA_V1);
    await uygula(page);
    await expect(page.locator('#toast')).toContainText('3 not dosyadan yazıldı');
    const once = await oku(page);
    const [idA1, idA2] = once[0].notlar.slice(2).map(n => n.id);
    const idB = once[1].notlar[0].id;
    await dosyaYukle(page, DOSYA_V2);
    const ozet = page.locator('#zgNotIceOrtu .zg-ozet');
    /* A: A1 çıkıyor + A1(düzeltildi) ve A3 giriyor → 2 giren, belirsiz → sil+ekle;
       A2 aynen duruyor. B: B çıkıyor + B(düzeltildi) giriyor → 1↔1 → yerinde. */
    await expect(ozet).toContainText('2 satır yazılacak');
    await expect(ozet).toContainText('1 not yerinde güncellenecek');
    await expect(ozet).toContainText('1 içe aktarım notu kaldırılacak');
    await expect(ozet).toContainText('1 not zaten güncel');
    await expect(ozet).toContainText('2 elle girilmiş not korunacak');
    await expect(page.locator('#zgNotIceOrtu')).toContainText('2 yazılacak · 0 güncellenecek · 1 kaldırılacak · 1 aynı · 2 korunacak');   // Kitap A
    await expect(page.locator('#zgNotIceOrtu')).toContainText('0 yazılacak · 1 güncellenecek · 0 kaldırılacak · 0 aynı · 0 korunacak');   // Kitap B
    await expect(page.locator('#zgNotIceOrtu')).toContainText('Dosya notu B → Dosya notu B (düzeltildi)');   // yerinde güncellenecek listesi
    await expect(page.locator('#zgNotIceOrtu .zg-not')).toContainText('SİLME içerir: dosyada geçen kitapların daha önce bu yoldan gelen (dosya işaretli) ama dosyadan ÇIKMIŞ 1 notu kaldırılır');
    await expect(page.locator('[data-act="zg-not-uygula"]')).toHaveText('Uygula (2 yaz, 1 güncelle, 1 sil)');
    await uygula(page);
    await expect(page.locator('#toast')).toContainText('2 not dosyadan yazıldı, 1 not yerinde güncellendi, 1 eski içe aktarım notu kaldırıldı, 1 not zaten günceldi (2 kitap)');
    const sonra = await oku(page);
    expect(sonra[0].notlar.slice(0, 2)).toEqual(once[0].notlar.slice(0, 2));     // elle notlar birebir
    // A2 aynı id ile yerinde (ng dahil dokunulmadı); yeni satırlar sona
    expect(sonra[0].notlar.slice(2).map(n => n.metin))
      .toEqual(['Dosya notu A2', 'Dosya alıntısı A1 (düzeltildi)', 'Dosya notu A3 (yeni satır)']);
    expect(sonra[0].notlar[2]).toEqual(once[0].notlar[3]);
    // B yerinde: aynı id, yeni metin, ng ilerledi
    expect(sonra[1].notlar.map(n => [n.id, n.metin, n.kayn])).toEqual([[idB, 'Dosya notu B (düzeltildi)', 'dosya']]);
    expect(sonra[1].notlar[0].ng).toBeGreaterThan(once[1].notlar[0].ng);
    // mezar: YALNIZ çıkan A1; A2 ve B mezarda DEĞİL; elle notlar mezarda DEĞİL
    expect(sonra[0].notlar.map(n => n.id)).not.toContain(idA1);
    expect(sonra[0].mezar[idA1]).toBeGreaterThan(0);
    expect(Object.keys(sonra[0].mezar)).toEqual([idA1]);
    expect(Object.keys(sonra[1].mezar)).toEqual([]);
    expect(sonra[0].mezar[idA2]).toBeUndefined();
    expect(sonra[0].mezar.elle1).toBeUndefined();
    expect(sonra[0].mezar.elle2).toBeUndefined();
    // aynı dosya değişmeden üçüncü kez: değişim YOK — düğme kurulmaz, hiçbir bayt değişmez
    await dosyaYukle(page, DOSYA_V2);
    await expect(ozet).toContainText('0 satır yazılacak');
    await expect(ozet).toContainText('4 not zaten güncel');
    await expect(page.locator('#zgNotIceOrtu')).toContainText('Dosya ile raf zaten aynı');
    await expect(page.locator('[data-act="zg-not-uygula"]')).toHaveCount(0);
    await page.click('[data-act="zg-not-vazgec"]');
    expect(await oku(page)).toEqual(sonra);
  });

  test('c) dosyada geçmeyen kitabın notlarına (işaretli dahi olsa) dokunulmaz', async ({ page }) => {
    await hazirla(page);
    await dosyaYukle(page, DOSYA_V1);
    await page.click('[data-act="zg-not-uygula"]');
    await expect(page.locator('#toast')).toContainText('dosyadan yazıldı');
    const d = await oku(page);
    expect(d[2].ad).toBe('Kitap C');
    expect(d[2].notlar).toEqual([{ ...ESKI_ICE }, { ...ELLE_NOT, kayn: undefined }]);
    expect(Object.keys(d[2].mezar).length).toBe(0);
  });

  test('d) boş "not" dizisi: dürüst mesaj, hiçbir şey silinmez; e) vazgeç: yazılmaz ve silinmez', async ({ page }) => {
    await hazirla(page);
    // Kitap A\'ya bir işaretli not ekle ki "silinebilecek" bir şey olsun
    await page.evaluate(() => { veri.kitaplar[0].notlar.push({ id: 'iceA', tip: 'not', metin: 'önceki içe aktarım', tarih: '2024-03-01', sayfa: null, ng: 9, kayn: 'dosya' }); depoKaydet(); });
    const once = await oku(page);
    await dosyaYukle(page, { surum: 1, not: [] }, 'bos.json');
    await expect(page.locator('#toast')).toContainText('Bu dosyada not listesi yok');
    await expect(page.locator('#zgNotIceOrtu.acik')).toHaveCount(0);   // önizleme hiç kurulmadı bile
    expect(await oku(page)).toEqual(once);
    // e) vazgeç: önizleme silme vaat ediyor ama onay yok → hiçbir şey değişmez
    await dosyaYukle(page, DOSYA_V2);
    await expect(page.locator('#zgNotIceOrtu .zg-ozet')).toContainText('1 içe aktarım notu kaldırılacak');
    await page.click('[data-act="zg-not-vazgec"]');
    await expect(page.locator('#toast')).toContainText('Vazgeçildi — hiçbir şey yazılmadı');
    expect(await oku(page)).toEqual(once);
  });

  test('yalnız eşleşmeyen satırlar: hiçbir kitap "dosyada geçen" sayılmaz, düğme yok, sıfır yazım/silme', async ({ page }) => {
    await hazirla(page);
    const once = await oku(page);
    await dosyaYukle(page, { surum: 1, not: [
      { ad: 'Yok Bir', yazar: 'Kimse', metin: 'a', tip: 'not' },
      { ad: 'Yok İki', yazar: 'Kimse', metin: 'b', tip: 'alinti' }] });
    const ozet = page.locator('#zgNotIceOrtu .zg-ozet');
    await expect(ozet).toContainText('2 satır eşleşmedi');
    await expect(ozet).not.toContainText('yazılacak');
    await expect(page.locator('[data-act="zg-not-uygula"]')).toHaveCount(0);
    await expect(page.locator('#zgNotIceOrtu')).toContainText('Yok İki');
    await page.click('[data-act="zg-not-vazgec"]');
    expect(await oku(page)).toEqual(once);
  });

  test('dosya içi tekrar ve tip yazımı: "Alıntı"/"NOT" kabul, tekrar satır zaten vardı; yalnız-sil de uygulanır', async ({ page }) => {
    await hazirla(page);
    await dosyaYukle(page, { surum: 1, not: [
      { ad: 'Kitap B', yazar: 'Yazar B', metin: 'Tekrarlı metin', tip: 'Alıntı' },
      { ad: 'Kitap B', yazar: 'Yazar B', metin: 'tekrarli METİN', tip: 'NOT' }] });
    const ozet = page.locator('#zgNotIceOrtu .zg-ozet');
    await expect(ozet).toContainText('1 satır yazılacak');
    await expect(ozet).toContainText('1 satır zaten vardı');
    await page.click('[data-act="zg-not-uygula"]');
    let d = await oku(page);
    expect(d[1].notlar.map(n => [n.tip, n.metin, n.kayn])).toEqual([['alinti', 'Tekrarlı metin', 'dosya']]);
    // dosya B için yalnız elle nota eş satır taşıyor → 0 yaz, 1 sil: düğme yine var, eski işaretli gider
    await page.evaluate(() => { veri.kitaplar[1].notlar.push({ id: 'elleB', tip: 'not', metin: 'B elle', tarih: '2024-01-01', sayfa: null, ng: 3 }); depoKaydet(); });
    await dosyaYukle(page, { surum: 1, not: [{ ad: 'Kitap B', yazar: 'Yazar B', metin: 'b elle', tip: 'not' }] });
    await expect(ozet).toContainText('0 satır yazılacak');
    await expect(ozet).toContainText('1 içe aktarım notu kaldırılacak');
    await expect(ozet).toContainText('1 elle girilmiş not korunacak');
    await expect(page.locator('[data-act="zg-not-uygula"]')).toHaveText('Uygula (1 sil)');
    await expect(page.locator('#zgNotIceOrtu .zg-not')).toContainText('SİLME içerir');
    await page.click('[data-act="zg-not-uygula"]');
    d = await oku(page);
    expect(d[1].notlar.map(n => [n.id, n.metin])).toEqual([['elleB', 'B elle']]);
  });

  test('h) İÇERİKLE EŞLEŞME: düzenlenmiş dosya-notu (yıldız + etiket + tekrar) aynı dosyada KORUNUR; on kez yükleme → sıfır mezar, sıfır yazım', async ({ page }) => {
    await hazirla(page);
    await dosyaYukle(page, DOSYA_V1);
    await uygula(page);
    let d = await okuTam(page);
    const kid = await page.evaluate(() => veri.kitaplar[0].id);
    const nid = d[0].notlar[2].id;   // 'Dosya alıntısı A1'
    // kullanıcı düzenlemeleri: favori + fikir etiketi + tekrar "devam" (index.html/fikir.js/tekrar.js yolları)
    await page.evaluate(({ kid, nid }) => {
      favoriCevir(nid, kid);
      window.__fikir.fikirEkleNota(nid, 'g94-etiketi', kid);
      for (const k of veri.kitaplar) for (const n of k.notlar || []) if (n.id === nid) n.tekrarSonraki = new Date().toISOString().slice(0, 10);
      depoKaydet();
      const el = document.createElement('button'); el.dataset.act = 'tk-devam'; el.dataset.nid = nid;
      document.body.appendChild(el); el.click(); el.remove();
    }, { kid, nid });
    d = await okuTam(page);
    const duzenli = d[0].notlar.find(n => n.id === nid);
    expect(duzenli.kayn).toBe('dosya');   // işaret DÜŞMEZ — yenileme hakkı korunur
    expect(duzenli.favori).toBe(1);
    expect(duzenli.fikir).toEqual(['g94-etiketi']);
    expect(duzenli.tekrarSayisi).toBe(1);
    const gOnce = d[0].g;
    // aynı dosya on kez: her seferinde "değişim yok" — düğme yok, vazgeç
    for (let i = 0; i < 10; i++) {
      await dosyaYukle(page, DOSYA_V1);
      await expect(page.locator('#zgNotIceOrtu .zg-ozet')).toContainText('3 not zaten güncel');
      await expect(page.locator('[data-act="zg-not-uygula"]')).toHaveCount(0);
      await page.click('[data-act="zg-not-vazgec"]');
    }
    const son = await okuTam(page);
    expect(son[0].notlar.find(n => n.id === nid)).toEqual(duzenli);   // id, favori, etiket, tekrar, ng, tarih birebir
    expect(son[0].g).toBe(gOnce);                                     // kitap damgası bile dokunulmadı
    expect(son.reduce((t, k) => t + Object.keys(k.mezar).length, 0)).toBe(0);   // v99: 10 × 3 = 30 olurdu
  });

  test('i) 1↔1 YERİNDE GÜNCELLEME: tek not değişince id + üst-veri kalır, mezar yok; iki not değişince sil+ekle (belirsiz)', async ({ page }) => {
    await hazirla(page);
    await dosyaYukle(page, { surum: 1, not: [{ ad: 'Kitap B', yazar: 'Yazar B', metin: 'İlk metin', tip: 'not' }] });
    await uygula(page);
    let d = await okuTam(page);
    const kid = await page.evaluate(() => veri.kitaplar[1].id);
    const nid = d[1].notlar[0].id;
    await page.evaluate(({ kid, nid }) => { favoriCevir(nid, kid); window.__fikir.fikirEkleNota(nid, 'kalıcı', kid); }, { kid, nid });
    // dosyada metin düzeltildi (tek çıkan + tek giren)
    await dosyaYukle(page, { surum: 1, not: [{ ad: 'Kitap B', yazar: 'Yazar B', metin: 'İlk metin (düzeltildi)', tip: 'alinti' }] });
    const ozet = page.locator('#zgNotIceOrtu .zg-ozet');
    await expect(ozet).toContainText('0 satır yazılacak');
    await expect(ozet).toContainText('1 not yerinde güncellenecek');
    await expect(ozet).toContainText('0 içe aktarım notu kaldırılacak');
    await expect(page.locator('#zgNotIceOrtu .zg-not')).toContainText('silme içermiyor');   // yerinde güncelleme silme değildir
    await expect(page.locator('#zgNotIceOrtu')).toContainText('İlk metin → İlk metin (düzeltildi)');
    await expect(page.locator('[data-act="zg-not-uygula"]')).toHaveText('Uygula (1 güncelle)');
    await uygula(page);
    await expect(page.locator('#toast')).toContainText('1 not yerinde güncellendi (1 kitap)');
    d = await okuTam(page);
    expect(d[1].notlar.length).toBe(1);
    const n = d[1].notlar[0];
    expect([n.id, n.tip, n.metin, n.kayn, n.favori, n.fikir]).toEqual([nid, 'alinti', 'İlk metin (düzeltildi)', 'dosya', 1, ['kalıcı']]);
    expect(Object.keys(d[1].mezar)).toEqual([]);
    // yalnız büyük/küçük harf farkı (katla eşit) → eşleşir ama ham metin farklı → yine yerinde
    await dosyaYukle(page, { surum: 1, not: [{ ad: 'Kitap B', yazar: 'Yazar B', metin: 'İLK METİN (düzeltildi)', tip: 'alinti' }] });
    await expect(ozet).toContainText('1 not yerinde güncellenecek');
    await uygula(page);
    d = await okuTam(page);
    expect(d[1].notlar.map(x => [x.id, x.metin, x.favori])).toEqual([[nid, 'İLK METİN (düzeltildi)', 1]]);
    // iki not birden değişirse eşleme belirsiz: sil+ekle, iki mezar
    await dosyaYukle(page, { surum: 1, not: [
      { ad: 'Kitap B', yazar: 'Yazar B', metin: 'Birinci', tip: 'not' },
      { ad: 'Kitap B', yazar: 'Yazar B', metin: 'İkinci', tip: 'not' }] });
    await uygula(page);
    await dosyaYukle(page, { surum: 1, not: [
      { ad: 'Kitap B', yazar: 'Yazar B', metin: 'Birinci (yeni)', tip: 'not' },
      { ad: 'Kitap B', yazar: 'Yazar B', metin: 'İkinci (yeni)', tip: 'not' }] });
    await expect(ozet).toContainText('2 satır yazılacak');
    await expect(ozet).toContainText('0 not yerinde güncellenecek');
    await expect(ozet).toContainText('2 içe aktarım notu kaldırılacak');
    await expect(page.locator('[data-act="zg-not-uygula"]')).toHaveText('Uygula (2 yaz, 2 sil)');
    await uygula(page);
    d = await okuTam(page);
    expect(d[1].notlar.map(x => x.metin)).toEqual(['Birinci (yeni)', 'İkinci (yeni)']);
    expect(Object.keys(d[1].mezar).length).toBe(3);   // 1 (Birinci/İkinci turunda çıkan tek not) + 2
  });

  test('j) eş-metinli işaretli kopyalar (eski yüklemelerden): biri eşleşir, kalanı kaldırılır — mükerrer yaşamaz', async ({ page }) => {
    await hazirla(page);
    await page.evaluate(() => {
      veri.kitaplar[1].notlar.push(
        { id: 'kopya1', tip: 'not', metin: 'Aynı metin', tarih: '2024-01-01', sayfa: null, ng: 1, kayn: 'dosya' },
        { id: 'kopya2', tip: 'not', metin: 'Aynı metin', tarih: '2024-01-02', sayfa: null, ng: 2, kayn: 'dosya' });
      depoKaydet();
    });
    await dosyaYukle(page, { surum: 1, not: [{ ad: 'Kitap B', yazar: 'Yazar B', metin: 'Aynı metin', tip: 'not' }] });
    const ozet = page.locator('#zgNotIceOrtu .zg-ozet');
    await expect(ozet).toContainText('1 not zaten güncel');
    await expect(ozet).toContainText('1 içe aktarım notu kaldırılacak');
    await expect(page.locator('[data-act="zg-not-uygula"]')).toHaveText('Uygula (1 sil)');
    await uygula(page);
    const d = await oku(page);
    expect(d[1].notlar.map(n => n.id)).toEqual(['kopya1']);
    expect(Object.keys(d[1].mezar)).toEqual(['kopya2']);
  });

  test('k) UYGULA sırasında değişim olmayan kitaba damga basılmaz: A aynen, B yerinde → A.g ve A notları birebir, B.g ilerler', async ({ page }) => {
    await hazirla(page);
    await dosyaYukle(page, DOSYA_V1);
    await uygula(page);
    const once = await okuTam(page);
    await dosyaYukle(page, { surum: 1, not: [
      { ad: 'Kitap A', yazar: 'Yazar A', metin: 'Dosya alıntısı A1', tip: 'alinti' },
      { ad: 'Kitap A', yazar: 'Yazar A', metin: 'Dosya notu A2', tip: 'not' },
      { ad: 'Kitap B', yazar: 'Yazar B', metin: 'Dosya notu B (yerinde)', tip: 'not' }] });
    await expect(page.locator('[data-act="zg-not-uygula"]')).toHaveText('Uygula (1 güncelle)');
    await uygula(page);
    await expect(page.locator('#toast')).toContainText('1 not yerinde güncellendi, 2 not zaten günceldi (1 kitap)');   // kitap sayısı: yalnız değişen
    const sonra = await okuTam(page);
    expect(sonra[0]).toEqual(once[0]);                       // A: g, notlar, mezar — bayt bayt aynı
    expect(sonra[1].g).toBeGreaterThan(once[1].g);           // B: kullanıcı eylemi damgası
    expect(sonra[1].notlar.map(n => [n.id, n.metin])).toEqual([[once[1].notlar[0].id, 'Dosya notu B (yerinde)']]);
  });

  test('ayar metni + sürüm kilidi (kaynaktan) + DARALTILMIŞ kaynak kilidi', async ({ page }) => {
    await rafAc(page);
    await ayarlarAc(page);
    /* v109: not dosyasının kendi paragrafı Ayarlar'dan kalktı — yedi giriş tek
       kapıda birleşti. Sözleşme kaybolmadı, KARAR ANINA taşındı: ne yazılacağı,
       neye dokunulmayacağı ve neyin silineceği onay kartında duruyor. */
    await expect(page.locator('#ortuAyar')).toContainText('not–alıntı dosyası');
    await page.click('#ortuAyar [data-act="dy-sec"]');
    await page.setInputFiles('#dyDosya', jsonDosya(DOSYA_V1, 'notlar.json'));
    const kart = page.locator('#dyKarar');
    await expect(kart).toContainText('Not dosyası');
    await expect(kart).toContainText('SİLME içerir');
    await expect(kart).toContainText('daha önce BU YOLDAN gelen (dosya işaretli) ama dosyadan ÇIKMIŞ notları kaldırılır');
    await expect(kart).toContainText('metni değişen tek not yerinde güncellenir');
    await expect(kart).toContainText('elle girdiğin, paylaşımdan ve Goodreads');
    await expect(kart).toContainText('yıldız, fikir etiketi, tekrar durumu korunur');
    await expect(kart).toContainText('Geri alınamaz');
    await page.click('#dyKarar [data-act="dy-vazgec"]');
    const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
    const swN = Number((sw.match(/const CACHE = ONEK \+ '-v(\d+)'/) || [])[1]);
    expect(swN).toBeGreaterThanOrEqual(129);
    /* KAYNAK KİLİDİ (v99 daraltıldı, kaldırılmadı): notlar dizisine dokunan
       tek yer iceNotUygula; orada silme TEK satır ve yalnız iceNotIsareti'ne
       dayanır; işaret tanımı kayn === 'dosya'. İşaretsiz nota dokunan her yol
       (splice, metin değiştirme, koşulsuz filter, dizi sıfırlama) kırmızı. */
    const z = fs.readFileSync(path.join(__dirname, '..', 'zengin.js'), 'utf8');
    expect(z).toContain("const ICE_NOT_KAYN = 'dosya';");
    expect(z).toContain("function iceNotIsareti(n){ return !!(n && n.kayn === ICE_NOT_KAYN); }");
    const bas = z.indexOf('function iceNotUygula('), son = z.indexOf('KÜTÜPHANE DOSYASI (v100)');
    expect(bas).toBeGreaterThan(0); expect(son).toBeGreaterThan(bas);
    const govde = z.slice(bas, son);
    expect(govde).toContain('k.notlar.push(');
    expect(govde).not.toMatch(/splice|\.metin\s*=|notlar\s*=\s*\[/);
    // izin verilen biçimler dışında filter ve notlar ataması YOK:
    // sayım (salt-okur), TEK silme satırı (yalnız işaretli), boş-güvence
    const izinli = ['const eski = k.notlar.filter(n => iceNotIsareti(n) && silIdler.has(n.id));',
      'k.notlar = k.notlar.filter(n => !(iceNotIsareti(n) && silIdler.has(n.id)));',
      'k.notlar = k.notlar || [];'];
    let kalan = govde;
    for (const p of izinli) { expect(govde.split(p).length - 1, p).toBe(1); kalan = kalan.split(p).join(''); }
    expect(kalan).not.toContain('filter(');
    expect(kalan).not.toMatch(/notlar\s*=/);
    // fonksiyon DIŞINDA zengin.js notlar dizisine hiç yazmaz
    const dis = z.slice(0, bas) + z.slice(son);
    expect(dis).not.toMatch(/notlar\.push\(|notlar\.splice\(|\.notlar\s*=\s*[^=]/);
    /* v129: notun metnine/tipine yazan TEK yer iceNotGuncelle; kapısı ilk satırda
       (işaretsiz not → false, hiçbir alan yazılmaz). zengin.js'te başka .metin = yok. */
    expect(z).toContain("function iceNotGuncelle(n, y){\n    if(!iceNotIsareti(n)) return false;\n    n.tip = y.tip; n.metin = y.metin; n.ng = Date.now();");
    const gBas = z.indexOf('function iceNotGuncelle('), gSon = z.indexOf('const ICE_NOT = {');
    expect(gBas).toBeGreaterThan(0); expect(gSon).toBeGreaterThan(gBas);
    const gDis = z.slice(0, gBas) + z.slice(gSon);
    expect(gDis).not.toMatch(/\.metin\s*=[^=]/);
    expect(govde).toContain('iceNotGuncelle(n, y)');
  });
});
