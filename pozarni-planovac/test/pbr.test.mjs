import test from 'node:test';
import assert from 'node:assert/strict';
import { rozborPbr, navrhZPbr } from '../js/pbr.js';
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
