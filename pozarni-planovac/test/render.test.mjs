import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { renderListu } from '../js/kresleni/render.js';
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
  assert.ok(svg.includes('LEGENDA ZNAČEK') && svg.includes('Nadzemní požární hydrant'));
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
