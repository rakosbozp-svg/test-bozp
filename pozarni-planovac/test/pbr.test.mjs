import test from 'node:test';
import assert from 'node:assert/strict';
import { rozborPbr, navrhZPbr, slucRozbory } from '../js/pbr.js';
import { pouzijNavrh } from '../js/prebirani.js';
import { novyProjekt } from '../js/model.js';

// Smyšlené PBŘ (fiktivní údaje) s typickými formulacemi a zalomením řádků jako z pdf.js.
const STRANKY = [
  ['POŽÁRNĚ BEZPEČNOSTNÍ ŘEŠENÍ', 'Investor: Testovací spolek z.s., IČO: 12345678'],
  [
    'Místo stavby: Zkušební 12, 100 00 Praha',
    'KATEGORIE STAVBY: Stavba kategorie II',
    'Zastavěná plocha stavby: 350 m2',
    'Počet nadzemních podlaží (NP): 3',
    'Počet podzemních podlaží (PP): 1',
    'Navrhovaný počet osob: do 60 osob',
    'Počet osob vyžadujících asistenci: 2',
    'Požární výška:',
    'Dle uspořádání objektu je požární výška uvažována jako h= 7,5 m (v souladu s čl. 5.2.3 ČSN 73',
    '0802).',
    'Konstrukční systém:',
    'Nosné svislé konstrukce jsou zděné tl. min. 300 mm. Nově budou zřízeny nenosné příčky ze SDK.',
    'Stropní konstrukce jsou železobetonové.',
    'Krov je dřevěný.',
    'Vzhledem k výše uvedenému je konstrukční systém posuzován jako nehořlavý.',
  ],
  [
    'P 1.01/N3 Schodiště 25,10 0,00 1 0,00 0,00 I.',
    'P 2.01 Kanceláře 180,20 40,00 1 40,00 1,00 II.',
    '-- Neřešeno',
    'Pro únik osob je k dispozici nechráněná úniková cesta vedoucí na volné prostranství.',
    'Z požárního úseku je jeden směr úniku.',
    'SKUTEČNOST –Příjezd k objektu je po místní komunikaci ulici Zkušební. Vzdálenost je max 20 m.',
    'Nástupní plochy',
    'V souladu s článkem 12.4.4 ČSN 73 0802 nemusí být zřízena nástupní plocha pro',
    'objekt.',
    '2. Vnitřní odběrná místa',
    'Ve vzdálenosti cca 90 m se nachází nadzemní hydrant v ulici Polní na GPS souřadnicích: 50.1000000N, 14.2000000E.',
    '- Tlačítko TOTAL STOP umístěné v zádveří u hlavního vstupu – vypne všechna zařízení',
  ],
  [
    'EPS – elektrická požární signalizace',
    'Výše uvedené podmínky nejsou naplněny => zařízení se nenavrhuje.',
    'Vytápění',
    'Zdrojem tepla je plynový kotel o výkonu 24 kW.',
    'Zemní plyn',
    'Objekt je napojen na zemní plyn.',
    'l) zhodnocení elektrického zařízení',
  ],
];

const podle = (r) => Object.fromEntries(r.nalezy.map((n) => [n.klic, n]));

test('PBŘ: základní údaje, konstrukce a citace se stranou', () => {
  const n = podle(rozborPbr(STRANKY));
  assert.equal(n.adresa.hodnota, 'Zkušební 12, 100 00 Praha');
  assert.equal(n.adresa.strana, 2);
  assert.equal(n.plocha.hodnota, '350');
  assert.equal(n.podlazi.hodnota, '3 NP, 1 PP');
  assert.equal(n.vyska.hodnota, '7,5');
  assert.ok(n.vyska.neoznacit, 'požární výška není celková výška – nesmí být předem zaškrtnutá');
  assert.match(n.vyska.citace, /^Dle uspořádání/);
  assert.match(n.osoby.hodnota, /^do 60 osob.*2 osob vyžadujících asistenci/);
  assert.equal(n.steny.hodnota, 'Nosné svislé konstrukce jsou zděné tl. min. 300 mm');
  assert.match(n.priccky.hodnota, /^Nově budou zřízeny nenosné příčky/);
  assert.equal(n.konstrukce.hodnota, 'nehořlavý konstrukční systém (dle PBŘ)');
  assert.ok(n.provozovatel.neoznacit && n.ic.hodnota === '12345678');
});

test('PBŘ: úseky, únik, příjezd, voda, vypínač, PBZ, plyn', () => {
  const n = podle(rozborPbr(STRANKY));
  assert.equal(n.useky.hodnota, 'P 1.01/N3 Schodiště (I. SPB); P 2.01 Kanceláře (II. SPB)');
  assert.equal(n.typUc.hodnota, 'NÚC – nechráněná úniková cesta');
  assert.match(n.typUc.citace, /^Pro únik osob/);
  assert.equal(n.pocetUc.hodnota, '1');
  assert.equal(n.prijezd.hodnota, 'po místní komunikaci ulici Zkušební');
  assert.equal(n.nastup.hodnota, 'V souladu s článkem 12.4.4 ČSN 73 0802 nemusí být zřízena nástupní plocha pro objekt.');
  assert.deepEqual(n.hydrant.hodnota.gps, { sirka: 50.1, delka: 14.2 });
  assert.equal(n.hydrant.hodnota.prutokLs, null, 'průtok se z PBŘ nepřebírá');
  assert.doesNotMatch(n.hydrant.hodnota.popis, /GPS/);
  assert.equal(n.vypinac.hodnota, 'TOTAL STOP – v zádveří u hlavního vstupu (dle PBŘ)');
  assert.equal(n.eps.hodnota, 'NE (dle PBŘ se nenavrhuje)');
  assert.equal(n.kotel.hodnota, 'Zdrojem tepla je plynový kotel o výkonu 24 kW.');
  assert.equal(n.plyn.hodnota, 'Objekt je napojen na zemní plyn.');
});

test('PBŘ: co chybí, jde do „nenalezeno“ – nic se nedomýšlí', () => {
  const r = rozborPbr(STRANKY), k = podle(r);
  assert.ok(!k.fve && !k.latky);
  assert.ok(r.nenalezeno.some((x) => x.startsWith('FVE')));
  assert.ok(r.nenalezeno.includes('nebezpečné látky'));
  assert.ok(r.nenalezeno.includes('ověřený průtok hydrantu'));
  assert.deepEqual(rozborPbr([['Jiný dokument bez údajů.']]).nalezy, []);
});

test('PBŘ → návrh: citace, přeskočení shodných hodnot, zápis do karty a poznámek', () => {
  const p = novyProjekt({ typ: 'operativni_plan', nazev: 'T' }); p.listy.push({ id: 'k', typ: 'karta', karta: novyProjekt({ typ: 'operativni_karta', nazev: 'K' }).listy.find((l) => l.typ === 'karta').karta });
  const karta = p.listy.find((l) => l.typ === 'karta').karta, opText = p.listy.find((l) => l.typ === 'op_text').opText;
  karta.objekt.adresa = 'Zkušební 12, 100 00 Praha';
  const cile = { karta, opText, projekt: p };
  const navrh = navrhZPbr(rozborPbr(STRANKY).nalezy, cile, 'pbr.pdf');
  assert.ok(!navrh.some((x) => x.cesta === 'objekt.adresa'), 'shodná hodnota se nenavrhuje');
  const vyska = navrh.find((x) => x.cesta === 'charakter.celkovaVyskaM');
  assert.ok(vyska.neoznacit);
  assert.match(vyska.zdroj, /^pbr\.pdf, str\. 2: „Dle uspořádání/);
  const vse = new Set(navrh.map((_, i) => i).filter((i) => !navrh[i].neoznacit));
  pouzijNavrh(navrh, vse, cile);
  assert.equal(karta.charakter.podlazi, '3 NP, 1 PP');
  assert.equal(karta.charakter.celkovaVyskaM, '', 'neoznačené se nezapíše');
  assert.equal(karta.vodniZdroje.length, 1);
  assert.equal(karta.vodniZdroje[0].overenPrutok, false);
  assert.ok(p.poznamkyKOvereni.some((x) => x.tema === 'PBŘ' && /plyn/i.test(x.text)));
  assert.equal(navrhZPbr(rozborPbr(STRANKY).nalezy, cile, 'pbr.pdf').filter((x) => x.cil === 'projekt').length, 0, 'poznámky se podruhé neduplikují');
});

// ---- druhý styl PBŘ (změna stavby, tabulkové údaje, odrážky; text jako z OCR) – smyšlené údaje ----
const STRANKY_ZMENA = [
  ['Stavební úpravy zázemí testovací haly Testov', 'Stavba:', 'Stavební úpravy zázemí testovací haly', 'Polní čp. 12, parc.č.st. 34, k.ú. Testov', 'POŽÁRNĚ BEZPEČNOSTNÍ ŘEŠENÍ', 'Požárně bezpečnostní řešení — TZ 1'],
  ['Stavební úpravy zázemí testovací haly Testov', '1. Úvod', 'Požárně bezpečnostní řešení změny stavby je zpracováno jako část projektu.', 'Konstrukční systém:',
    '- Svislé nosné konstrukce železobetonové prefabrikované - konstrukční část druhu DP1',
    '- Vodorovné nosné konstrukce — železobetonové prefabrikované - konstrukční část druhu DP1',
    'Požární výška objektu + 0,00 m', 'Konstrukce objektu smíšený', 'Počet podlaží 2 NP', 'Čl. 3.2.b5 ČSN 73 0834 - Posouzení únikových cest:', 'Požárně bezpečnostní řešení — TZ 2'],
  ['Stavební úpravy zázemí testovací haly Testov', 'Z posuzované části objektu jsou dva směry nechráněné únikové cesty vedoucí do volného prostoru.',
    'Změna užívání je zatříděna jako Změna staveb skupiny II.',
    '- Příjezdová komunikace k objektu je zpevněná cesta šířky 4 m', '- Objekt je vzdálen od veřejné komunikace 15 m',
    '- Vnější odběrní místa — stávající hydranty v ulici Lipová a Dubová ve vzdálenosti cca', '150 m od objektu',
    '- Vnitřní odběrní místa — bude provedena instalace nového vnitřního odběrního místa', 'H D 19, s hadicí délky 20 m.',
    '- V prostoru šaten budou umístěny dva hasicí přístroje PG6 - práškové', 'Požárně bezpečnostní řešení — TZ 3'],
];

test('PBŘ změny stavby: tabulkové údaje, odrážky přes více řádků, záhlaví se nelepí do vět', () => {
  const n = podle(rozborPbr(STRANKY_ZMENA));
  assert.equal(n.adresa.hodnota, 'Polní čp. 12, parc.č.st. 34, k.ú. Testov');
  assert.ok(n.adresa.neoznacit);
  assert.equal(n.podlazi.hodnota, '2 NP');
  assert.equal(n.vyska.hodnota, '0,00');
  assert.equal(n.konstrukce.hodnota, 'smíšený konstrukční systém (dle PBŘ)');
  assert.match(n.steny.hodnota, /^Svislé nosné konstrukce železobetonové/);
  assert.match(n.stropy.hodnota, /^Vodorovné nosné konstrukce/);
  assert.equal(n.typUc.hodnota, 'NÚC – nechráněná úniková cesta');
  assert.match(n.typUc.citace, /^Z posuzované části/, 'záhlaví stránky ani nadpis článku nejsou v citaci');
  assert.equal(n.pocetUc.hodnota, '2');
  assert.equal(n.prijezd.hodnota, 'zpevněná cesta šířky 4 m; objekt je vzdálen od veřejné komunikace 15 m');
  assert.match(n.hydrant.hodnota.popis, /Lipová a Dubová ve vzdálenosti cca 150 m od objektu/);
  assert.match(n.vnitrni.hodnota, /H D 19, s hadicí délky 20 m\.$/);
  assert.match(n.php.hodnota, /PG6/);
  assert.equal(n.zmenaSkupiny.hodnota, 'změna stavby skupiny II');
});

// ---- DOCX (průvodní zpráva) ----
import { deflateRawSync } from 'node:zlib';
import { stranyZDocx } from '../js/docx.js';
function zip(soubory) {   // minimální ZIP (deflate) pro test
  const lok = [], cen = []; let off = 0;
  for (const [jm, obsah] of Object.entries(soubory)) {
    const data = deflateRawSync(Buffer.from(obsah)), n = Buffer.from(jm);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(8, 8); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(Buffer.byteLength(obsah), 22); h.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(8, 10); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(Buffer.byteLength(obsah), 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    lok.push(h, n, data); cen.push(c, n); off += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(cen), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(cen.length / 2, 8); e.writeUInt16LE(cen.length / 2, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return new Uint8Array(Buffer.concat([...lok, cd, e]));
}
const odst = (...p) => `<w:document><w:body>${p.map((x) => `<w:p><w:r><w:t>${x}</w:t></w:r></w:p>`).join('')}</w:body></w:document>`;

test('DOCX: průvodní zpráva – místo stavby, stavebník, podlaží, vytápění; popisky bez „PBŘ“', async () => {
  const bajty = zip({ '[Content_Types].xml': '<Types/>', 'word/document.xml': odst('A.1.1 Údaje o stavbě', 'a) název stavby', 'Rekonstrukce šaten haly v Testově', 'b) místo stavby (adresa, čísla popisná, katastrální území, parcelní čísla pozemků)', 'Polní č.p.12', 'Testov, 100 00', 'Pozemek: p.č. st. 34', 'A.1.2 Údaje o žadateli / stavebníkovi', 'Obec Testov, Náměstí 1, 10000 Testov', 'Počet podlaží ………………….1', 'Objekt je vytápěn plynovou kotelnou &amp; ohřev vody bojlerem.') });
  const st = await stranyZDocx(bajty);
  assert.ok(st[0].includes('Počet podlaží 1'), 'tečkovací vodítka se odstraní');
  const r = rozborPbr(st, { odstavce: true }), n = podle(r);
  assert.equal(r.jePbr, false);
  assert.equal(n.adresa.hodnota, 'Polní č.p.12, Testov, 100 00');
  assert.equal(n.nazev.hodnota, 'Rekonstrukce šaten haly v Testově'); assert.ok(n.nazev.neoznacit);
  assert.equal(n.provozovatel.hodnota, 'Obec Testov, Náměstí 1, 10000 Testov'); assert.ok(n.provozovatel.neoznacit);
  assert.equal(n.podlazi.hodnota, '1 (počet podlaží celkem – NP/PP neuvedeno)');
  assert.equal(n.plyn.hodnota, 'Objekt je vytápěn plynovou kotelnou & ohřev vody bojlerem.');
  assert.ok(!n.kotel, 'stejná věta se nenabízí dvakrát');
  assert.ok(!r.nalezy.some((x) => /PBŘ/.test(x.popis)));
  await assert.rejects(stranyZDocx(new Uint8Array([1, 2, 3])), /DOCX/);
});

test('více dokumentů: shodné údaje jednou, rozdílné neoznačené s upozorněním, nenalezeno = v žádném', () => {
  const a = { soubor: 'pbr.pdf', ocr: 93, ...rozborPbr(STRANKY_ZMENA) };
  const b = { soubor: 'A.docx', ...rozborPbr([['Počet podlaží 1', 'Polní č.p.12']], { odstavce: true }) };
  const c = { soubor: 'B.docx', ...rozborPbr([['Konstrukce objektu smíšený']], { odstavce: true }) };
  const { nalezy, nenalezeno } = slucRozbory([a, b, c]);
  const podl = nalezy.filter((x) => x.klic === 'podlazi');
  assert.equal(podl.length, 2); assert.ok(podl.every((x) => x.neoznacit && /POZOR: dokumenty uvádějí různé hodnoty/.test(x.popis)));
  assert.equal(nalezy.filter((x) => x.klic === 'konstrukce').length, 1, 'stejná hodnota ze dvou dokumentů jen jednou');
  assert.ok(!nenalezeno.includes('počet podlaží'));
  assert.ok(nenalezeno.includes('počet osob'));
  const navrh = navrhZPbr(nalezy, { karta: { objekt: {}, charakter: {}, vodniZdroje: [] }, projekt: null });
  assert.match(navrh.find((x) => x.cesta === 'charakter.steny').zdroj, /^pbr\.pdf \(OCR, jistota 93 %\), str\. 2: „Svislé/);
});

test('PBŘ → operativní plán: složená pole (EPS+SHZ…), nová budova, druhý import jen doplní', () => {
  const p = novyProjekt({ typ: 'operativni_plan', nazev: 'OP' });
  const cile = { opText: p.listy.find((l) => l.typ === 'op_text').opText, opZaklad: p.listy.find((l) => l.typ === 'op_zaklad').opZaklad, projekt: p };
  const nal = rozborPbr(STRANKY).nalezy;
  const navrh = navrhZPbr(nal, cile, 'pbr.pdf'), dle = (c) => navrh.find((x) => x.cesta === c);
  assert.equal(dle('udaje.pbz').hodnota, 'EPS: NE (dle PBŘ se nenavrhuje)');
  assert.equal(dle('udaje.rozvody').hodnota, 'Hlavní vypínač: TOTAL STOP – v zádveří u hlavního vstupu (dle PBŘ)\nPlyn: Objekt je napojen na zemní plyn.\nZdrojem tepla je plynový kotel o výkonu 24 kW.');
  assert.match(dle('voda.zdroje').hodnota, /^Vnější hydrant: .*nadzemní hydrant v ulici Polní/);
  assert.equal(dle('komunikace.stav').hodnota, 'Příjezd: po místní komunikaci ulici Zkušební');
  assert.equal(dle('ots.signalizace').hodnota, 'EPS: NE (dle PBŘ se nenavrhuje)');
  const b = navrh.find((x) => x.pridat === 'objekty');
  assert.deepEqual({ ...b.hodnota, konstrukce: b.hodnota.konstrukce.slice(0, 40) }, { nazev: '', podlazi: '3 NP, 1 PP', vyska: '', pudorys: '', konstrukce: 'nehořlavý konstrukční systém (dle PBŘ); ', useky: 'P 1.01/N3 Schodiště (I. SPB); P 2.01 Kanceláře (II. SPB)', vyuziti: '' });
  assert.ok(!b.neoznacit && /název a celkovou výšku doplňte/.test(b.popis));
  assert.ok(!navrh.some((x) => x.cil === 'projekt' && /Zdroj tepla/.test(x.hodnota.text)), 'co je v plánu, se nezdvojuje do poznámek');
  assert.ok(navrh.some((x) => x.cil === 'projekt' && /^Plyn/.test(x.hodnota.text)), 'plyn zůstává v poznámkách (zjistit uzávěr)');
  pouzijNavrh(navrh, new Set(navrh.map((_, i) => i).filter((i) => !navrh[i].neoznacit)), cile);
  assert.equal(cile.opText.objekty.length, 1);
  assert.equal(cile.opText.objekty[0].podlazi, '3 NP, 1 PP');
  // ruční úprava budovy a druhý import: shodné se přeskočí, změněné se nabídne k přepsání (neoznačené)
  cile.opText.objekty[0].nazev = 'Hala A'; cile.opText.objekty[0].podlazi = '3 NP';
  const n2 = navrhZPbr(nal, cile, 'pbr.pdf').filter((x) => x.cil !== 'projekt');
  assert.deepEqual(n2.map((x) => x.polozka?.pole ?? x.cesta), ['podlazi'], 'jen změněné pole budovy');
  const pod = n2.find((x) => x.polozka?.pole === 'podlazi');
  assert.equal(pod.stavajici, '3 NP'); assert.match(pod.popis, /budova „Hala A“ – Podlaží/);
  pouzijNavrh(n2, new Set([n2.indexOf(pod)]), cile);
  assert.equal(cile.opText.objekty[0].podlazi, '3 NP, 1 PP');
});
