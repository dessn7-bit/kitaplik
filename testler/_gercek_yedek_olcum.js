'use strict';
/* Sprint Q — GERÇEK YEDEK ÖLÇÜMÜ (tarayıcısız, salt okur).
   Kullanım: node testler/_gercek_yedek_olcum.js <yedek.json> [<yedek2.json> ...]
   index.html'deki göç çekirdeğini (ozCTemizle + ozCakismaAyir) olduğu gibi çekip
   her yedeğin ozetler nesnesine uygular; HİÇBİR DOSYAYA YAZMAZ.
   Raporladığı sayılar:
     - özet kaydı · m'de ayıraçlı · o'da ayıraçlı · birleşim (m veya o) · sahipsiz
     - çoklu ayıraç dağılımı · özdeş (m/o kopyası) parça · taşınan gerçek sürüm
     - UZUNLUK DENKLEMİ: önce(m+o) == sonra(m+o) + Σ(parça×n) + ayıraç×uzunluk
     - Puşkin kayıtlarında göç sonrası m == ilk parça (dosyadaki haliyle) */
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function kes(bas, son){
  const b = html.indexOf(bas); if(b < 0) throw new Error('bulunamadı: ' + bas);
  const e = html.indexOf(son, b); if(e < 0) throw new Error('bulunamadı: ' + son);
  return html.slice(b, e);
}
const kod = kes("const OZET_AYIRAC_M = ", 'const ozetBellek = new Map();')
  + kes('function ozCTemizle(', 'function ozCanliIdler(){');
const sandbox = {};
(new Function('sb', kod + '\nsb.ozCTemizle = ozCTemizle; sb.ozCakismaAyir = ozCakismaAyir; sb.AYM = OZET_AYIRAC_M; sb.AYO = OZET_AYIRAC_O;'))(sandbox);
const { ozCakismaAyir, AYM, AYO } = sandbox;

function olc(yol){
  const y = JSON.parse(fs.readFileSync(yol, 'utf8'));
  const kitaplar = y.kitaplar || [], ozetler = y.ozetler || {};
  const canli = new Set(kitaplar.map(k => String(k.id)));
  const adlar = new Map(kitaplar.map(k => [String(k.id), k]));
  const r = { dosya: path.basename(yol), tarih: y.tarih, kitap: kitaplar.length, ozet: Object.keys(ozetler).length,
    mAyirac: 0, oAyirac: 0, birlesim: 0, sahipsiz: [], sahipsizAyiracli: [], dagilim: {}, ozdes: 0, tasinan: 0,
    once: 0, sonra: 0, parcaToplam: 0, ayiracToplam: 0, denklemTutmayan: [], puskin: [], degisen: [] };
  for(const [id, o] of Object.entries(ozetler)){
    const m = String(o.m || ''), on = String(o.o || '');
    const mN = m.split(AYM).length - 1, oN = on.split(AYO).length - 1;
    if(!canli.has(id)){ r.sahipsiz.push(id); if(mN || oN) r.sahipsizAyiracli.push(id); }
    if(mN) r.mAyirac++; if(oN) r.oAyirac++;
    if(!mN && !oN) continue;
    r.birlesim++;
    r.dagilim[mN] = (r.dagilim[mN] || 0) + 1;
    const ay = ozCakismaAyir(m, on, o.c);
    r.ozdes += ay.ozdes; r.tasinan += ay.tasinan;
    const once = m.length + on.length, sonra = ay.m.length + ay.o.length;
    const parca = ay.c.reduce((t, e) => t + ((e.m || '').length + (e.o || '').length) * (e.n || 1), 0);
    const ayirac = mN * AYM.length + oN * AYO.length;
    r.once += once; r.sonra += sonra; r.parcaToplam += parca; r.ayiracToplam += ayirac;
    if(once !== sonra + parca + ayirac) r.denklemTutmayan.push({ id, once, sonra, parca, ayirac });
    const k = adlar.get(id);
    r.degisen.push({ id, ad: k ? k.ad : '(sahipsiz)', mParca: mN + 1, oParca: oN + 1, ozdes: ay.ozdes, tasinan: ay.tasinan, sahipsiz: !k });
    if(k && /pu[sš]kin/i.test(k.yazar || '')) r.puskin.push({ ad: k.ad, ilkParcaEsit: ay.m === m.split(AYM)[0], parca: mN + 1 });
  }
  return r;
}
const yollar = process.argv.slice(2);
if(!yollar.length){ console.error('yedek yolu ver'); process.exit(2); }
for(const yol of yollar){
  const r = olc(yol);
  console.log('==== ' + r.dosya + ' (' + r.tarih + ') ====');
  console.log('kitap ' + r.kitap + ' · özet kaydı ' + r.ozet + ' · m ayıraçlı ' + r.mAyirac + ' · o ayıraçlı ' + r.oAyirac +
    ' · birleşim (m∪o) ' + r.birlesim + ' · sahipsiz ' + r.sahipsiz.length + (r.sahipsizAyiracli.length ? ' (ayıraçlı: ' + r.sahipsizAyiracli.join(',') + ')' : ''));
  console.log('m parça dağılımı (ayıraç sayısı→kayıt): ' + JSON.stringify(r.dagilim) + ' · özdeş parça ' + r.ozdes + ' · taşınan gerçek sürüm ' + r.tasinan);
  console.log('UZUNLUK: önce ' + r.once + ' == sonra ' + r.sonra + ' + parça×n ' + r.parcaToplam + ' + ayıraç ' + r.ayiracToplam +
    ' = ' + (r.sonra + r.parcaToplam + r.ayiracToplam) + ' → ' + (r.denklemTutmayan.length ? 'TUTMUYOR ' + JSON.stringify(r.denklemTutmayan.slice(0, 3)) : 'TUTUYOR (kayıp 0)'));
  console.log('sahipsiz id: ' + r.sahipsiz.join(' '));
  console.log('Puşkin: ' + r.puskin.length + ' kayıt, ilk parça == göç sonrası m: ' + r.puskin.filter(p => p.ilkParcaEsit).length + '/' + r.puskin.length +
    ' · parça: ' + r.puskin.map(p => p.parca).join(','));
  if(r.degisen.length <= 20) console.log('değişecek: ' + r.degisen.map(d => d.ad + (d.sahipsiz ? '[sahipsiz]' : '') + '(m' + d.mParca + '/o' + d.oParca + ')').join(' · '));
}
