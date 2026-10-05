'use strict';
/* G123 — SESLİ OKUMA (ses.js, v132): Özet / Ontoloji / Notlar'da "Dinle".
   speechSynthesis TAKLİT edilir (gerçek motor test ortamında yok/kararsız):
   konuşmalar kayda geçer, onend'i test elle tetikler (__sahteSes.bitir),
   cancel() gerçek tarayıcılar gibi iptal edilen konuşmaya GEÇ onerror
   ('interrupted') yollar — jeton korumasını sınamak için.

   (Mutasyon 1: sesMetni'den yıldız temizliği kaldırılır → (a)/(b) kırmızı.
    Mutasyon 2: konus() içindeki jeton kontrolü kaldırılır → (c) kırmızı.
    Mutasyon 3: gecerlilik() sekme kontrolü atlanır → (f) kırmızı.
    Mutasyon 4: parcala tavanı yok sayılır → (i) kırmızı.) */
const { test, expect, tohumla, sahteKitap, rafAc } = require('./yardim');

const TR = [{ name: 'Sahte Türkçe', lang: 'tr-TR', localService: true, default: true },
  { name: 'Fake English', lang: 'en-US', localService: true, default: false }];

async function sahteSes(page, s) {
  await page.addInitScript(([s]) => {
    const kayit = { konusmalar: [], iptal: 0, cagri: [] };
    let aktif = null;
    function Utt(t){ this.text = String(t); this.lang = ''; this.rate = 1; this.voice = null;
      this.onstart = null; this.onend = null; this.onerror = null; }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: Utt, configurable: true, writable: true });
    const motor = {
      get speaking(){ return !!aktif; }, get pending(){ return false; }, paused: false,
      getVoices(){ return s.sesler || []; },
      speak(u){
        kayit.konusmalar.push({ metin: u.text, rate: u.rate, lang: u.lang, ses: u.voice ? u.voice.name : null });
        kayit.cagri.push('speak');
        aktif = u;
        setTimeout(() => { if (aktif === u && u.onstart) u.onstart({}); }, 0);
      },
      cancel(){
        kayit.iptal++; kayit.cagri.push('cancel');
        const a = aktif; aktif = null;
        if (a && a.onerror) setTimeout(() => a.onerror({ error: 'interrupted' }), 0);   // GEÇ olay
        if (a && a.onend) setTimeout(() => a.onend({}), 0);                            // bazı motorlar onend de yollar
      },
      pause(){}, resume(){}, addEventListener(){}
    };
    Object.defineProperty(window, 'speechSynthesis', { value: s.yok ? undefined : motor, configurable: true });
    window.__sahteSes = {
      kayit,
      bitir(){ const u = aktif; aktif = null; if (u && u.onend) u.onend({}); return u ? u.text : null; },
      sustur(){ aktif = null; },
      get aktif(){ return aktif ? aktif.text : null; }
    };
  }, [s || { sesler: TR }]);
}

const OZET = '**Konu**\nBirinci paragraf *italik* kelimeyle.\n\n## İkinci başlık\nİkinci paragraf.\n\nÜçüncü paragraf — son.';
const OZET_SES = ['Konu. Birinci paragraf italik kelimeyle.', 'İkinci başlık. İkinci paragraf.', 'Üçüncü paragraf — son.'];
const ONTO = 'Ontoloji bir.\n\nOntoloji **iki**.';

async function hazirla(page, ek) {
  const kitaplar = [sahteKitap({ id: 'k1', ad: 'Sesli Kitap', durum: 'bitti', ozetVar: true,
      notlar: [{ id: 'n1', tip: 'not', metin: 'İlk not.', tarih: '2026-09-01' },
               { id: 'n2', tip: 'alinti', metin: 'Alıntı *bir*.\n\nAlıntı iki.', tarih: '2026-09-02', sayfa: 12 }] }),
    sahteKitap({ id: 'k2', ad: 'Öteki Kitap', durum: 'bitti', ozetVar: true })];
  await sahteSes(page, ek);
  await tohumla(page, kitaplar);
  await rafAc(page);
  await page.evaluate(() => window.__ozet.hazirBekle());
  await page.evaluate(([o, n]) => Promise.all([window.__ozet.kaydetHam('k1', o, 100, n), window.__ozet.kaydetHam('k2', 'Öteki özet.', 100, '')]), [OZET, ONTO]);
}
const ac = (page, id) => page.evaluate(i => detayAc(i), id || 'k1');
const konusmalar = page => page.evaluate(() => window.__sahteSes.kayit.konusmalar.map(k => k.metin));
const durumu = page => page.evaluate(() => window.__ses.durum());
const bitir = page => page.evaluate(() => window.__sahteSes.bitir());

test.describe('G123 sesli okuma', () => {

  test('(a) markdown temizliği + paragraf/parça sözleşmesi (saf)', async ({ page }) => {
    await hazirla(page);
    const s = await page.evaluate(() => {
      const S = window.__ses;
      return {
        kalin: S.sesMetni('**Gerekçenin verilmesi.** Oyunun radikalliği'),
        baslik: S.sesMetni('# Başlık\nMetin'),
        cift: S.sesMetni('### Bölüm 2\n**Kalın** ve *eğik* ve ***ikisi***.'),
        yildiz: S.sesMetni('Kapanmamış *yıldız ve ** çift'),
        madde: S.sesMetni('- birinci madde\n- ikinci madde'),
        diyez: S.sesMetni('Bölüm # ara ## işaret'),
        para: S.paragraflar('a\n\n\n b \n \nc'),
        uzun: S.parcala('Bir cümle burada. '.repeat(40)),
        tavan: S.PARCA_TAVAN
      };
    });
    expect(s.kalin).toBe('Gerekçenin verilmesi. Oyunun radikalliği');
    expect(s.baslik, 'başlık düz okunur, ardından duraklama').toBe('Başlık. Metin');
    expect(s.cift).toBe('Bölüm 2. Kalın ve eğik ve ikisi.');
    expect(s.yildiz).toBe('Kapanmamış yıldız ve çift');
    expect(s.madde).toBe('birinci madde. ikinci madde');
    expect(s.diyez).toBe('Bölüm ara işaret');
    expect(s.para).toEqual(['a', 'b', 'c']);
    expect(s.uzun.length).toBeGreaterThan(1);
    expect(s.uzun.every(p => p.length <= s.tavan), 'her parça tavanın altında').toBe(true);
    expect(s.uzun.join(' ').replace(/\s+/g, ' '), 'parçalama metin kaybetmez').toBe('Bir cümle burada. '.repeat(40).trim());
  });

  test('(b) ÖZET: Dinle → paragraflar SIRAYLA, markdown işaretsiz, tr-TR ses; okunan paragraf vurgulu; bitince çubuk Dinle\'ye döner', async ({ page }) => {
    await hazirla(page);
    await ac(page);
    const cubuk = page.locator('#detayIcerik .so-cubuk[data-so-kaynak="m"]');
    await expect(cubuk.locator('[data-act="so-dinle"]')).toBeVisible();
    await cubuk.locator('[data-act="so-dinle"]').click();
    await expect.poll(() => konusmalar(page)).toEqual([OZET_SES[0]]);
    const ilk = await page.evaluate(() => window.__sahteSes.kayit.konusmalar[0]);
    expect(ilk.lang).toBe('tr-TR');
    expect(ilk.ses, 'Türkçe ses seçildi').toBe('Sahte Türkçe');
    const p = page.locator('#detayIcerik #dOzetBlok > .oz-metin > p');
    await expect(p.nth(0)).toHaveClass(/so-okunan/);
    await expect(cubuk).toContainText('1 / 3');
    await bitir(page);
    await expect.poll(() => konusmalar(page)).toEqual(OZET_SES.slice(0, 2));
    await expect(p.nth(1)).toHaveClass(/so-okunan/);
    await expect(p.nth(0)).not.toHaveClass(/so-okunan/);
    await bitir(page);
    await bitir(page);
    await expect.poll(() => durumu(page)).toBe(null);
    const hepsi = await konusmalar(page);
    expect(hepsi).toEqual(OZET_SES);
    expect(hepsi.join(' '), 'hiçbir işaret okunmadı').not.toMatch(/[*#]/);
    await expect(cubuk.locator('[data-act="so-dinle"]')).toBeVisible();
    await expect(page.locator('#detayIcerik .so-okunan')).toHaveCount(0);
  });

  test('(c) DURAKLAT / DEVAM / DURDUR — iptal edilen konuşmanın GEÇ olayı sırayı kaydırmaz; devam aynı paragraftan', async ({ page }) => {
    await hazirla(page);
    await ac(page);
    const cubuk = page.locator('#detayIcerik .so-cubuk[data-so-kaynak="m"]');
    await cubuk.locator('[data-act="so-dinle"]').click();
    await bitir(page);   // 2. paragrafa geçti
    await expect.poll(() => konusmalar(page)).toHaveLength(2);
    await cubuk.locator('[data-act="so-duraklat"]').click();
    await expect(cubuk.locator('[data-act="so-devam"]')).toBeVisible();
    await page.waitForTimeout(80);   // sahte motorun GEÇ onerror/onend'i düşsün
    expect(await konusmalar(page), 'duraklatınca yeni konuşma yok, sıra kaymadı').toHaveLength(2);
    expect((await durumu(page)).durum).toBe('duraklatildi');
    expect((await durumu(page)).i).toBe(1);
    await expect(page.locator('#detayIcerik #dOzetBlok > .oz-metin > p').nth(1), 'duraklatılmışken vurgu yerinde').toHaveClass(/so-okunan/);
    await cubuk.locator('[data-act="so-devam"]').click();
    await expect.poll(() => konusmalar(page)).toEqual([OZET_SES[0], OZET_SES[1], OZET_SES[1]]);
    await cubuk.locator('[data-act="so-durdur"]').click();
    await page.waitForTimeout(80);
    expect(await durumu(page)).toBe(null);
    expect(await konusmalar(page), 'durdur sonrası geç olay yeni konuşma başlatmadı').toHaveLength(3);
    await expect(page.locator('#detayIcerik .so-okunan')).toHaveCount(0);
    await expect(cubuk.locator('[data-act="so-dinle"]')).toBeVisible();
  });

  test('(d) PARAGRAFA DOKUN: açık oturumda o paragraftan; boşta dokunmak ses BAŞLATMAZ', async ({ page }) => {
    await hazirla(page);
    await ac(page);
    const p = page.locator('#detayIcerik #dOzetBlok > .oz-metin > p');
    await p.nth(2).click();
    await page.waitForTimeout(50);
    expect(await konusmalar(page), 'boşta dokunma sessiz').toEqual([]);
    await page.locator('#detayIcerik [data-act="so-dinle"][data-kaynak="m"]').click();
    await p.nth(2).click();
    await expect.poll(() => konusmalar(page)).toEqual([OZET_SES[0], OZET_SES[2]]);
    await expect(p.nth(2)).toHaveClass(/so-okunan/);
    /* duraklatılmışken dokunma da oradan başlatır */
    await page.locator('#detayIcerik [data-act="so-duraklat"]').click();
    await p.nth(0).click();
    await expect.poll(() => konusmalar(page)).toEqual([OZET_SES[0], OZET_SES[2], OZET_SES[0]]);
    expect((await durumu(page)).durum).toBe('oynuyor');
  });

  test('(e) HIZ: 0,8–1,5; seçim çalan parçaya uygulanır ve yeniden açılışta hatırlanır', async ({ page }) => {
    await hazirla(page);
    await ac(page);
    const sec = page.locator('#detayIcerik .so-cubuk[data-so-kaynak="m"] .so-hiz');
    expect(await sec.locator('option').evaluateAll(o => o.map(x => parseFloat(x.value)))).toEqual([0.8, 0.9, 1, 1.1, 1.2, 1.3, 1.4, 1.5]);
    await page.locator('#detayIcerik [data-act="so-dinle"][data-kaynak="m"]').click();
    await page.locator('#detayIcerik .so-cubuk[data-so-kaynak="m"] .so-hiz').selectOption('1.3');
    await expect.poll(() => page.evaluate(() => window.__sahteSes.kayit.konusmalar.map(k => k.rate))).toEqual([1, 1.3]);
    expect(await konusmalar(page), 'aynı paragraf yeni hızla').toEqual([OZET_SES[0], OZET_SES[0]]);
    await page.reload();
    await page.evaluate(() => window.__ozet.hazirBekle());
    await ac(page);
    await expect(page.locator('#detayIcerik .so-cubuk[data-so-kaynak="m"] .so-hiz')).toHaveValue('1.3');
    await page.locator('#detayIcerik [data-act="so-dinle"][data-kaynak="m"]').click();
    await expect.poll(() => page.evaluate(() => window.__sahteSes.kayit.konusmalar.map(k => k.rate))).toEqual([1.3]);
  });

  test('(f) DURMA: sekme değişince, kitap kapanınca, başka kitap açılınca; iki okuma ÜST ÜSTE binmez', async ({ page }) => {
    await hazirla(page);
    await ac(page);
    const dinle = k => page.locator('#detayIcerik [data-act="so-dinle"][data-kaynak="' + k + '"]');
    /* 1) Özet → Ontoloji sekmesi */
    await dinle('m').click();
    await expect.poll(() => konusmalar(page)).toHaveLength(1);
    await page.click('#detayIcerik [data-act="ms-sekme"][data-v="onto"]');
    await expect.poll(() => durumu(page)).toBe(null);
    await page.waitForTimeout(60);
    await bitir(page);
    expect(await konusmalar(page), 'sekme değişti: yeni konuşma yok').toHaveLength(1);
    expect(await page.evaluate(() => window.__ses.gunluk().map(g => g.ek).filter(Boolean))).toContain('sekme değişti');
    /* 2) Ontoloji okurken Notlar'da Dinle → tek oturum (önceki iptal) */
    await dinle('o').click();
    await expect.poll(() => konusmalar(page)).toEqual([OZET_SES[0], 'Ontoloji bir.']);
    await dinle('n').click();
    await expect.poll(() => konusmalar(page)).toEqual([OZET_SES[0], 'Ontoloji bir.', 'Alıntı bir.']);
    expect((await durumu(page)).kaynak).toBe('n');
    await expect(page.locator('#detayIcerik .so-okunan'), 'tek vurgu').toHaveCount(1);
    await expect(page.locator('#detayIcerik [data-act="so-duraklat"]'), 'tek kontrol çubuğu oynuyor').toHaveCount(1);
    /* 3) başka kitap açılınca */
    await ac(page, 'k2');
    await expect.poll(() => durumu(page)).toBe(null);
    await page.waitForTimeout(60);
    await bitir(page);
    expect(await konusmalar(page)).toHaveLength(3);
    /* 4) detay kapanınca */
    await page.locator('#detayIcerik [data-act="so-dinle"][data-kaynak="m"]').click();
    await expect.poll(() => konusmalar(page)).toHaveLength(4);
    await page.click('#detayIcerik .sheet-kapat');
    await expect.poll(() => durumu(page)).toBe(null);
    await page.waitForTimeout(60);
    await bitir(page);
    expect(await konusmalar(page), 'kapandı: yeni konuşma yok').toHaveLength(4);
    expect(await page.evaluate(() => window.__sahteSes.aktif), 'motor sustu').toBe(null);
  });

  test('(g) ONTOLOJİ ve NOTLAR kaynakları: kendi paragrafları, ekrandaki sırayla (notlar yeniden eskiye)', async ({ page }) => {
    await hazirla(page);
    await ac(page);
    await page.click('#detayIcerik [data-act="ms-sekme"][data-v="onto"]');
    await page.locator('#detayIcerik [data-act="so-dinle"][data-kaynak="o"]').click();
    await bitir(page);
    await bitir(page);
    await expect.poll(() => durumu(page)).toBe(null);
    expect(await konusmalar(page)).toEqual(['Ontoloji bir.', 'Ontoloji iki.']);
    await page.locator('#detayIcerik [data-act="so-dinle"][data-kaynak="n"]').click();
    await expect(page.locator('#detayIcerik .not-kart[data-nid="n2"] .not-metin > p').first()).toHaveClass(/so-okunan/);
    await bitir(page); await bitir(page); await bitir(page);
    await expect.poll(() => durumu(page)).toBe(null);
    expect((await konusmalar(page)).slice(2), 'n2 (yeni) önce, iki paragrafı ayrı; sonra n1').toEqual(['Alıntı bir.', 'Alıntı iki.', 'İlk not.']);
  });

  test('(h) Türkçe ses YOKSA düğme yerine mesaj; API yoksa da açıklama', async ({ page }) => {
    await hazirla(page, { sesler: [{ name: 'Fake English', lang: 'en-US', localService: true, default: true }] });
    await ac(page);
    const cubuk = page.locator('#detayIcerik .so-cubuk[data-so-kaynak="m"]');
    await expect(cubuk).toHaveText('Bu cihazda Türkçe ses bulunamadı');
    await expect(page.locator('#detayIcerik [data-act="so-dinle"]')).toHaveCount(0);
    expect(await page.evaluate(() => window.__ses.baslat('m', 0)), 'zorla başlatma da reddedilir').toBe(false);
  });

  test('(h2) speechSynthesis hiç yoksa açıklayıcı mesaj, düğme yok', async ({ page }) => {
    await hazirla(page, { yok: true });
    await ac(page);
    await expect(page.locator('#detayIcerik .so-cubuk[data-so-kaynak="m"]')).toHaveText('Bu tarayıcı sesli okumayı desteklemiyor');
    await expect(page.locator('#detayIcerik [data-act="so-dinle"]')).toHaveCount(0);
  });

  test('(i) UZUN paragraf parçalara bölünür (tavan altı), hepsi aynı paragrafı vurgular; bekçi sessizleşen motoru kaldığı parçadan sürdürür', async ({ page }) => {
    await hazirla(page);
    const uzun = 'Uzun cümle numarası bir, biraz da dolgu metni ile. '.repeat(12).trim();
    await page.evaluate(m => window.__ozet.kaydetHam('k1', m + '\n\nKısa son paragraf.', 200, ''), uzun);
    await ac(page);
    await page.locator('#detayIcerik [data-act="so-dinle"][data-kaynak="m"]').click();
    const tavan = await page.evaluate(() => window.__ses.PARCA_TAVAN);
    const parcaSayisi = await page.evaluate(m => window.__ses.parcala(m).length, uzun);
    expect(parcaSayisi).toBeGreaterThan(2);
    for (let i = 1; i < parcaSayisi; i++) {
      await bitir(page);
      await expect(page.locator('#detayIcerik #dOzetBlok > .oz-metin > p').first()).toHaveClass(/so-okunan/);
    }
    await expect.poll(() => konusmalar(page)).toHaveLength(parcaSayisi);
    const k = await konusmalar(page);
    expect(k.every(t => t.length <= tavan)).toBe(true);
    expect(k.join(' ')).toBe(uzun);
    /* bekçi: motor haber vermeden sustu (arka plan) → aynı parça yeniden */
    await page.evaluate(() => window.__sahteSes.sustur());
    await page.evaluate(() => { const d = window.__ses.durum(); return d; });
    await page.waitForTimeout(3100);
    await page.evaluate(() => window.__ses.bekci());
    await expect.poll(() => konusmalar(page)).toHaveLength(parcaSayisi + 1);
    expect((await konusmalar(page)).slice(-1)[0], 'kaldığı parçadan').toBe(k[k.length - 1]);
    expect(await page.evaluate(() => window.__ses.gunluk().some(g => /bekçi/.test(g.olay)))).toBe(true);
  });

  test('(j) TANI günlüğü: oturum olayları kaydolur, detayda katlanır "Okuma tanısı" ve yeniden açılışta durur', async ({ page }) => {
    await hazirla(page);
    await ac(page);
    await page.locator('#detayIcerik [data-act="so-dinle"][data-kaynak="m"]').click();
    await bitir(page);
    await page.locator('#detayIcerik [data-act="so-durdur"]').click();
    const tani = page.locator('#detayIcerik .so-cubuk[data-so-kaynak="m"] details.so-tani');
    await expect(tani).toContainText('Okuma tanısı');
    await tani.locator('summary').click();
    await expect(tani.locator('.so-tani-metin')).toContainText('oturum (özet · 3 paragraf');
    await expect(tani.locator('.so-tani-metin')).toContainText('durdu (durdur düğmesi)');
    await page.reload();
    await page.evaluate(() => window.__ozet.hazirBekle());
    await ac(page);
    await expect(page.locator('#detayIcerik .so-cubuk[data-so-kaynak="m"] details.so-tani')).toHaveCount(1);
  });
});
