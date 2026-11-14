import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { renderListu, nadpisListu, NADPIS_LEGENDY, sirkaTextu, popiskySite, jmenoSloupce } from '../js/kresleni/render.js';
import * as P from '../js/kresleni/prvky.js';
import { novyList } from '../js/model.js';

const o = (extra = {}) => ({ objektNazev: 'Hala PREFA 1', nazevListu: 'Půdorys 1.NP', znacky: new Map([['DZP-001', { nazev: 'Nadzemní požární hydrant' }]]), symbolHref: () => 'http://localhost:8795/znacky/png/DZP-001.png', prilohy: {}, ...extra });

export function ukazka() {
  const v = novyList('pudorys').vykres;
  v.severka.uhel = 20; v.razitko.zpracoval = 'Ing. Test'; v.razitko.datum = '2026-10-07';
  const stena = P.novyPrvek('stena', { body: [[2, 2], [20, 2], [20, 12], [2, 12], [2, 2]] });
  const dv = P.novyPrvek('dvere'), dv2 = P.novyPrvek('dvere', { sirkaM: 1.6, typ: 'dvoukridle', typAuto: false }), vr = P.novyPrvek('dvere', { sirkaM: 3, typ: 'vrata', typAuto: false });
  v.prvky.push(stena, dv, dv2, vr);
  P.pripojDvere(dv, v.prvky, [6, 2]); P.pripojDvere(dv2, v.prvky, [14, 12]); P.pripojDvere(vr, v.prvky, [20, 7]); dv.smer = -1;
  v.prvky.push(P.novyPrvek('trasa', { body: [[4, 4], [18, 4], [18, 10]], vrstva: 'trasy' }), P.novyPrvek('text', { x: 4, y: 9, text: 'Hala PREFA 1\n1.NP', vrstva: 'popisky' }),
    P.novyPrvek('znacka', { x: 10, y: 7, znackaId: 'DZP-001', velikost: 6, vrstva: 'znacky' }), P.novyPrvek('plocha', { body: [[22, 0], [30, 0], [30, 14], [22, 14]], vrstva: 'komunikace' }));
  P.synchronizujLegendu(v);
  return v;
}

test('render: obsahuje prvky, délku trasy v metrech, razítko, legendu i varování o neověřeném měřítku', () => {
  const v = ukazka();
  let svg = renderListu(v, o());
  assert.match(svg, /^<svg /); assert.ok(svg.includes('data-druh="stena"') && svg.includes('data-druh="dvere"'));
  assert.ok(svg.includes('20,0 m'), 'délka trasy 14 + 6 = 20 m');
  assert.ok(svg.includes('Legenda pro dokumentaci zdolávání požárů') && svg.includes('Nadzemní požární hydrant'));
  assert.ok(svg.includes('1 : 100') && svg.includes('Ing. Test') && svg.includes('Hala PREFA 1'));
  assert.ok(!svg.includes('NEOVĚŘENO'));
  v.pozadi = { prilohaId: 'a', x: 0, y: 0, sirkaPx: 100, vyskaPx: 50, mNaPx: 0.1, kalibrace: null };
  svg = renderListu(v, o({ prilohy: { a: { data: 'data:image/png;base64,AAAA' } } }));
  assert.ok(svg.includes('MĚŘÍTKO NEOVĚŘENO') && svg.includes('data-pozadi="1"'));
  assert.ok(!svg.includes('NaN') && !svg.includes('undefined'));
  v.vrstvy.find((l) => l.id === 'trasy').viditelna = false;
  assert.ok(!renderListu(v, o()).includes('data-druh="trasa"'));
  writeFileSync(new URL('./.ukazka.svg', import.meta.url), renderListu(ukazka(), o()));
});

test('render: síť 10 × 10 m a osiřelý prvek se neztratí', () => {
  const v = ukazka(); v.prvky.push(P.novyPrvek('cara', { body: [[0, 0], [1, 1]], vrstva: 'neexistuje' }));
  assert.ok(renderListu(v, o()).includes('data-sit="1"') && renderListu(v, o()).includes('data-druh="cara"'));
  v.sit10m = false; assert.ok(!renderListu(v, o()).includes('data-sit="1"'));
});

test('rozvržení DZP: pás 5 mm nad rámem, evakuační plán beze změny', () => {
  const v = novyList('situace').vykres;
  assert.equal(P.HLAVICKA_MM, 5);
  assert.deepEqual(P.rozlozeniListu(v).ram, { x: 10, y: 15, w: 277, h: 161 });
  v.orientace = 'na_vysku'; assert.deepEqual(P.rozlozeniListu(v).ram, { x: 10, y: 15, w: 190, h: 248 });
  assert.deepEqual(P.rozlozeniListu(novyList('evak_plan').vykres).ram, { x: 97, y: 51, w: 313, h: 236 });
});

test('nadpis listu podle druhu dokumentace a názvu listu', () => {
  assert.equal(nadpisListu({ typDokumentu: 'operativni_karta', nazevListu: 'Situace', typListu: 'situace' }), 'GRAFICKÁ ČÁST OPERATIVNÍ KARTY – SITUACE –');
  assert.equal(nadpisListu({ typDokumentu: 'operativni_plan', nazevListu: 'Půdorys 1.NP', typListu: 'pudorys' }), 'GRAFICKÁ ČÁST OPERATIVNÍHO PLÁNU – PŮDORYS 1.NP –');
  assert.equal(nadpisListu({ nazevListu: '  ', typListu: 'schema' }), 'GRAFICKÁ ČÁST OPERATIVNÍ KARTY – SCHÉMA –');
});

test('render: červený nadpis nad rámem (dlouhý se zmenší a zkrátí), nový nadpis legendy, evakuační plán bez nadpisu', () => {
  const nad = (svg) => /<text data-nadpis="1" x="148\.5" y="8\.8" font-size="([\d.]+)" font-weight="700" fill="#d00000"[^>]*>([^<]*)<\/text>/.exec(svg);
  const m = nad(renderListu(ukazka(), o({ typDokumentu: 'operativni_karta' })));
  assert.ok(m); assert.equal(m[1], '4.4'); assert.equal(m[2], 'GRAFICKÁ ČÁST OPERATIVNÍ KARTY – PŮDORYS 1.NP –');
  const d = nad(renderListu(ukazka(), o({ nazevListu: 'X'.repeat(200) })));
  assert.equal(d[1], '3'); assert.ok(d[2].endsWith('…')); assert.ok(sirkaTextu(d[2], 3, true) <= 277);
  const svg = renderListu(ukazka(), o());
  assert.ok(svg.includes(NADPIS_LEGENDY) && !svg.includes('LEGENDA ZNAČEK'));
  assert.equal(NADPIS_LEGENDY, 'Legenda pro dokumentaci zdolávání požárů');
  const e = novyList('evak_plan');
  assert.ok(!renderListu(e.vykres, { objektNazev: 'Hala', nazevListu: e.nazev, znacky: new Map(), symbolHref: () => '', prilohy: {} }).includes('data-nadpis'));
});

test('popisky sítě: písmena nad rámem, čísla vlevo, krajní poloviny bez popisku', () => {
  const v = novyList('situace').vykres; v.meritko.pomer = 500; v.okno = { x: 0, y: 0 };
  const p = popiskySite(v);
  assert.deepEqual(p.sloupce.map((s) => s.text), [...'ABCDEFGHIJKLMN']);
  assert.equal(p.sloupce[0].x, 20); assert.equal(p.radky.length, 8); assert.equal(p.radky[0].y, 25); assert.equal(p.radky[7].text, '8');
  v.okno = { x: -5, y: -5 }; const q = popiskySite(v);
  assert.equal(q.sloupce[0].text, 'A'); assert.equal(q.sloupce[0].x, 30); assert.equal(q.radky[0].y, 35);
});

test('popisky sítě: AA za Z, nic bez sítě, v evakuačním plánu ani při buňce pod 4 mm', () => {
  assert.deepEqual([0, 25, 26, 27].map(jmenoSloupce), ['A', 'Z', 'AA', 'AB']);
  const v = novyList('situace').vykres; v.meritko.pomer = 1000; v.okno = { x: 0, y: 0 };
  assert.equal(popiskySite(v).sloupce.at(-1).text, 'AB');
  v.meritko.pomer = 2500; assert.ok(popiskySite(v));
  v.meritko.pomer = 5000; assert.equal(popiskySite(v), null);
  v.meritko.pomer = 500; v.sit10m = false; assert.equal(popiskySite(v), null);
  assert.equal(popiskySite(novyList('evak_plan').vykres), null);
});

test('render: síť je tečkovaná, popisky leží mimo rám, „10 m“ v rohu', () => {
  const v = novyList('situace').vykres; v.meritko.pomer = 500;
  const svg = renderListu(v, o());
  assert.ok(svg.includes('stroke-dasharray="0.125,0.525"') && svg.includes('data-popis-site="1"') && svg.includes('>10 m</text>'));
});

test('tučný text se vykreslí tučně', () => {
  const v = novyList('situace').vykres; v.prvky.push(P.novyPrvek('text', { x: 1, y: 1, text: 'ul. Tyršova', tucne: true, vrstva: 'popisky' }));
  assert.match(renderListu(v, o()), /data-druh="text"[^>]*font-weight="700"/);
});

test('render příjezdu: černý mnohoúhelník a bílý tučný text; poškozená šipka se nevykreslí', () => {
  const v = novyList('situace').vykres; v.meritko.pomer = 500;
  v.prvky.push(P.novyPrvek('prijezd', { body: [[0, 20], [0, 0]], vrstva: 'komunikace' }), P.novyPrvek('prijezd', { body: [[0, 0]], vrstva: 'komunikace' }));
  const svg = renderListu(v, o());
  assert.match(svg, /data-druh="prijezd"><polygon points="[^"]+" fill="#000000"\/><text [^>]*font-weight="700" fill="#fff"[^>]*>směr příjezdu<\/text>/);
  assert.equal((svg.match(/data-druh="prijezd"/g) || []).length, 1);
});

test('popisky sítě: při 1 : 2500 se písmena zmenší, aby se sousední nepřekrývala; při 1 : 500 zůstanou 3 mm', () => {
  const v = novyList('situace').vykres; v.meritko.pomer = 2500; v.okno = { x: 0, y: 0 };
  const p = popiskySite(v), w = (t) => sirkaTextu(t, p.velSloupcu, true);
  assert.ok(p.velSloupcu < 3 && p.velSloupcu > 1.5, String(p.velSloupcu));
  for (let i = 1; i < p.sloupce.length; i++) assert.ok(p.sloupce[i].x - p.sloupce[i - 1].x >= (w(p.sloupce[i].text) + w(p.sloupce[i - 1].text)) / 2, `${p.sloupce[i - 1].text}/${p.sloupce[i].text}`);
  assert.ok(renderListu(v, o()).includes(`font-size="${p.velSloupcu}"`));
  v.meritko.pomer = 500; assert.equal(popiskySite(v).velSloupcu, 3);
});
