import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import { OTAZKY, navrhZDotazniku } from '../js/dotaznik.js';
import { pouzijNavrh } from '../js/prebirani.js';
import { dotaznikDoPdf, dotaznikZPdf } from '../js/pdf/dotaznikPdf.js';
import { nactiPdfLib } from '../js/pdf/export.js';

const odpovedi = {
  nazev: 'Hala montáže', osoby: '40 osob, v noci 2 (ostraha)', vypinac: 'trafostanice T1', plyn: 'NE', fve: true, fveKwp: 460, fveVypinac: 'STOP FVE u NN rozvodny',
  latky: 'Technický benzin 200 l, sklad B\nAceton 50 l, laboratoř', lahve: 'NE', hydrant: 'u brány č. 2', hydrantPrutok: 6.5, hydrantOveren: true,
  zjisteni: 'EPS s přenosem na PCO, do 3 min', zmeny: 'Přístavba skladu 2021', shromazdiste: 'parkoviště u vrátnice',
};

test('každá otázka má cíl a unikátní id; otázek je přiměřeně', () => {
  assert.equal(new Set(OTAZKY.map((o) => o.id)).size, OTAZKY.length);
  assert.ok(OTAZKY.every((o) => o.kam.length));
  assert.ok(OTAZKY.length >= 25 && OTAZKY.length <= 40);
});

test('převzetí odpovědí do karty, OP a poznámek k ověření', () => {
  const p = M.novyProjekt({ typ: 'operativni_plan' }); M.pridejList(p, 'karta', 'OK');
  const cile = { karta: p.listy.find((l) => l.typ === 'karta').karta, opText: p.listy.find((l) => l.typ === 'op_text').opText, opZaklad: p.listy.find((l) => l.typ === 'op_zaklad').opZaklad, projekt: p };
  const n = navrhZDotazniku(odpovedi, cile);
  pouzijNavrh(n, new Set(n.map((_, i) => i)), cile);
  const k = cile.karta;
  assert.equal(k.objekt.nazev, 'Hala montáže'); assert.equal(k.media.hlavniUzaverPlynu, 'NE'); assert.equal(k.fve.pritomna, true); assert.equal(k.fve.vykonKWp, 460);
  // látky klienta přibudou jako nové řádky; předtištěné řádky vzoru (hořlaviny, výbušniny) vyplní zpracovatel
  assert.deepEqual(k.nebezpeci.map((x) => x.popis), ['', '', 'Technický benzin 200 l, sklad B', 'Aceton 50 l, laboratoř']);
  assert.deepEqual([k.vodniZdroje[0].typ, k.vodniZdroje[0].prutokLs, k.vodniZdroje[0].overenPrutok], ['hydrant', 6.5, true]);
  assert.equal(cile.opText.udaje.osoby, '40 osob, v noci 2 (ostraha)'); assert.equal(cile.opZaklad.ots.dobaZpozorovani, 'EPS s přenosem na PCO, do 3 min');
  assert.ok(p.poznamkyKOvereni.some((x) => x.text === 'Přístavba skladu 2021'));
  assert.deepEqual(navrhZDotazniku(odpovedi, cile), [], 'podruhé nic nového (žádné duplicity)');
});

test('neprázdné pole karty se nepřepíše bez výběru; „NE“ u látek se vepíše do předtištěných řádků', () => {
  const p = M.novyProjekt(), k = p.listy.find((l) => l.typ === 'karta').karta; k.objekt.nazev = 'Původní název';
  const n = navrhZDotazniku({ nazev: 'Nový', latky: 'NE', lahve: 'NE' }, { karta: k, projekt: p });
  const i = n.findIndex((x) => x.cesta === 'objekt.nazev'); assert.equal(n[i].stavajici, 'Původní název');
  pouzijNavrh(n, new Set(n.map((_, j) => j).filter((j) => j !== i)), { karta: k, projekt: p });
  assert.equal(k.objekt.nazev, 'Původní název'); assert.deepEqual(k.nebezpeci.map((x) => [x.popis, x.znackaId]), [['NE', 'DZP-003'], ['NE', 'DZP-053']]);
});

test('vyplnitelné PDF: pole pro všechny otázky, odpovědi s diakritikou se načtou zpět', async () => {
  const b = await dotaznikDoPdf({ odpovedi: { nazev: 'Hala č. 5' } }, { objekt: 'Hala č. 5' });
  const L = await nactiPdfLib(), d = await L.PDFDocument.load(b), f = d.getForm();
  assert.equal(f.getFields().length, OTAZKY.length);
  f.getTextField('plyn').setText('Kotelna – uzávěr u dveří, ŘŽČŠĚ'); f.getTextField('fveKwp').setText('460,5'); f.getDropdown('fve').select('ano'); f.getTextField('latky').setText('Benzin 200 l\nAceton 50 l');
  const r = await dotaznikZPdf(await d.save({ updateFieldAppearances: false }));
  assert.deepEqual(r.odpovedi, { nazev: 'Hala č. 5', plyn: 'Kotelna – uzávěr u dveří, ŘŽČŠĚ', fveKwp: 460.5, fve: true, latky: 'Benzin 200 l\nAceton 50 l' });
  const prazdne = await (await L.PDFDocument.create()); prazdne.addPage();
  await assert.rejects(dotaznikZPdf(await prazdne.save()), /formulářová pole/);
});

test('revize: průtok k hydrantu, který už v kartě je; látky místo dřívějšího „NE“', async () => {
  const { navrhZDotazniku } = await import('../js/dotaznik.js');
  const { pouzijNavrh } = await import('../js/prebirani.js');
  const { novyProjekt } = await import('../js/model.js');
  const p = novyProjekt({ typ: 'operativni_karta', nazev: 'D' }), k = p.listy.find((l) => l.typ === 'karta').karta;
  k.nebezpeci.push({ id: 'n1', popis: 'NE', hasivo: '', znackaId: null });
  k.vodniZdroje.push({ id: 'h1', typ: 'hydrant', popis: 'Polní ulice u č.p. 5', prutokLs: null, overenPrutok: false, objemM3: null, gps: { sirka: null, delka: null }, znackaId: null });
  const navrh = navrhZDotazniku({ hydrant: 'Polní ulice u č.p. 5', hydrantPrutok: 7.5, hydrantOveren: true, latky: 'propan-butan 2 x 33 kg' }, { karta: k, projekt: p });
  pouzijNavrh(navrh, new Set(navrh.map((_, i) => i).filter((i) => !navrh[i].neoznacit && !navrh[i].stavajici)), { karta: k, projekt: p });
  assert.deepEqual(k.vodniZdroje.map((h) => [h.prutokLs, h.overenPrutok]), [[7.5, true]]);
  assert.deepEqual(k.nebezpeci.map((x) => x.popis), ['', '', 'propan-butan 2 x 33 kg'], 'dřívější „NE“ bez značky odebráno, předtištěné řádky zůstaly');
  // jen průtok bez polohy → nabídne se k jedinému hydrantu, neoznačeně
  const n2 = navrhZDotazniku({ hydrantPrutok: 9 }, { karta: k, projekt: p });
  assert.equal(n2.length, 1); assert.ok(n2[0].neoznacit && /jediný hydrant/.test(n2[0].popis));
});

test('dotazník se ptá jen na to, co v kartě chybí; na údaje jen pro operativní plán jen v projektu s plánem', async () => {
  const { otazkyProjektu, otazkyKDotazu } = await import('../js/dotaznik.js');
  const p = M.novyProjekt({ typ: 'operativni_karta' }), k = p.listy.find((l) => l.typ === 'karta').karta;
  const ptat = () => otazkyKDotazu(p).map((q) => q.id), stav = (id) => otazkyProjektu(p).find((q) => q.id === id);
  assert.ok(['nazev', 'vypinac', 'fve', 'latky', 'eps', 'pco', 'hydrant', 'hydrantPrutok', 'pbzJine', 'zmeny', 'shromazdiste'].every((id) => ptat().includes(id)), 'prázdná karta: ptá se na její údaje');
  assert.deepEqual(otazkyProjektu(p).filter((q) => q.stav === 'netyka').map((q) => q.id), ['zjisteni', 'ohlasovna', 'jednotka'], 'karta bez plánu: SaP se neptá');
  k.objekt.nazev = 'Hala'; k.media.totalStop = 'NE'; k.pbz.eps = 'NE'; k.fve.pritomna = false;
  for (const x of k.nebezpeci) x.popis = 'NE';
  for (const id of ['nazev', 'totalStop', 'eps', 'pco', 'fve', 'fveKwp', 'fvePanely', 'fveBaterie', 'fveVypinac', 'latky', 'lahve']) assert.ok(!ptat().includes(id), `vyplněno nebo netýká se: ${id}`);
  assert.equal(stav('nazev').hodnota, 'Hala'); assert.equal(stav('eps').hodnota, 'není'); assert.equal(stav('latky').hodnota, 'hořlaviny: NE; výbušniny: NE');
  assert.equal(stav('pco').stav, 'netyka', 'bez EPS se na PCO neptá');
  assert.ok(ptat().includes('zmeny') && ptat().includes('centralStop'));
  // další PBZ: jen zařízení, která karta neuvádí; výtahy jen když okénko VÝTAHY není „NE“
  Object.assign(k.pbz, { zdhpp: 'NE', apz: 'NE', shz: 'NE', pshz: 'NE', zokt: 'ANO', pk: '', adsp: '' }); k.charakter.vytahy = 'NE';
  assert.equal(stav('pbzJine').text, 'Jsou v objektu tato požárně bezpečnostní zařízení: požární klapky (PK), autonomní hlásiče kouře (ADSP)? U každého uveďte ano / ne, u „ano“ i kde se ovládá. Není-li žádné, napište „NE“.');
  const n = navrhZDotazniku({ pbzJine: 'NE' }, { karta: k, projekt: p });
  assert.deepEqual(n.filter((x) => x.cil === 'karta').map((x) => [x.cesta, x.hodnota]), [['pbz.pk', 'NE'], ['pbz.adsp', 'NE']], '„NE“ = vyjmenovaná zařízení nejsou');
  pouzijNavrh(n, new Set(n.map((_, i) => i)), { karta: k, projekt: p });
  assert.ok(!ptat().includes('pbzJine'), 'všechna PBZ uvedena → neptá se');
  // místo soustředění evakuovaných zakreslené ve výkresu → neptá se
  p.listy.find((l) => l.typ === 'situace').vykres.prvky.push({ id: 'z1', druh: 'znacka', znackaId: 'DZP-042', x: 0, y: 0 });
  assert.equal(stav('shromazdiste').stav, 'vyplneno');
  // operativní plán bez karty: na údaje karty se ptá jako dřív, SaP jen dokud v plánu chybí
  const o = M.novyProjekt({ typ: 'operativni_plan' });
  assert.equal(otazkyKDotazu(o).length, OTAZKY.length);
  o.listy.find((l) => l.typ === 'op_zaklad').opZaklad.ots.jednotkaPodniku = 'NE';
  assert.equal(otazkyProjektu(o).find((q) => q.id === 'jednotka').stav, 'vyplneno');
});

test('hydrant z karty: na polohu se neptá, na průtok jmenovitě; odpověď se zapíše k tomuto hydrantu', async () => {
  const { otazkyProjektu } = await import('../js/dotaznik.js');
  const p = M.novyProjekt({ typ: 'operativni_karta' }), k = p.listy.find((l) => l.typ === 'karta').karta;
  k.vodniZdroje.push({ id: 'h1', typ: 'hydrant', popis: 'Podzemní hydrant v ulici Tyršova, cca 138 m (dle PBŘ) – průtok neuveden', prutokLs: null, overenPrutok: false, objemM3: null, gps: { sirka: null, delka: null }, znackaId: 'DZP-004' });
  const q = Object.fromEntries(otazkyProjektu(p).map((x) => [x.id, x]));
  assert.equal(q.hydrant.stav, 'vyplneno');
  assert.equal(q.hydrantPrutok.stav, 'ptat'); assert.equal(q.hydrantPrutok.text, 'Vnější hydrant „Podzemní hydrant v ulici Tyršova, cca 138 m“ – průtok podle poslední zkoušky (l/s)');
  const n = navrhZDotazniku({ hydrantPrutok: 8.2, hydrantOveren: true }, { karta: k, projekt: p });
  assert.deepEqual(n.map((x) => [x.polozka?.pole, x.hodnota, !!x.neoznacit]), [['prutokLs', 8.2, false], ['overenPrutok', true, false]]);
  pouzijNavrh(n, new Set(n.map((_, i) => i)), { karta: k, projekt: p });
  assert.ok(['hydrant', 'hydrantPrutok', 'hydrantOveren'].every((id) => otazkyProjektu(p).find((x) => x.id === id).stav === 'vyplneno'), 'ověřený průtok → neptá se');
  // vodní zdroj „NE“ → na hydrant ani jiné zdroje se neptá
  const r = M.novyProjekt({ typ: 'operativni_karta' }), kr = r.listy.find((l) => l.typ === 'karta').karta;
  kr.vodniZdroje.push({ id: 'v1', typ: 'jiny', popis: 'NE', prutokLs: null, overenPrutok: false, objemM3: null, gps: { sirka: null, delka: null }, znackaId: null });
  assert.ok(otazkyProjektu(r).filter((x) => ['hydrant', 'hydrantPrutok', 'hydrantOveren', 'vodaJina'].includes(x.id)).every((x) => x.stav === 'vyplneno'));
});

test('PDF a text dotazníku obsahují jen otázky, na které se ptá', async () => {
  const { otazkyKDotazu, dotaznikJakoText } = await import('../js/dotaznik.js');
  const p = M.novyProjekt({ typ: 'operativni_karta' }), k = p.listy.find((l) => l.typ === 'karta').karta;
  k.objekt.nazev = 'Hala'; k.objekt.adresa = 'Polní 5, Kladno';
  const otazky = otazkyKDotazu(p), b = await dotaznikDoPdf(p.dotaznik, { objekt: 'Hala', otazky });
  const L = await nactiPdfLib(), f = (await L.PDFDocument.load(b)).getForm(), jmena = f.getFields().map((x) => x.getName());
  assert.equal(jmena.length, otazky.length); assert.ok(!jmena.includes('nazev') && !jmena.includes('adresa') && jmena.includes('provozovatel'));
  const t = dotaznikJakoText(p.dotaznik, 'Hala', otazky);
  assert.ok(!t.includes('Adresa objektu') && t.includes('Provozovatel') && !t.includes('ORGANIZACE POŽÁRNÍ OCHRANY'), 'prázdný oddíl (SaP bez plánu) se nevypíše');
  assert.ok(t.includes('E. POŽÁRNĚ BEZPEČNOSTNÍ ZAŘÍZENÍ A VODA\n') && t.includes('F. ZÁSAH A PŘÍJEZD\n'), 'písmena oddílů popořadě');
});
