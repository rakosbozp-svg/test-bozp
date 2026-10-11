import test from 'node:test';
import assert from 'node:assert/strict';
import { prazdnySap, vypocetSaP, shrnutiSaP, sapJakoText, najdiProstor, PROSTORY } from '../js/sap.js';

const zaklad = () => {
  const d = prazdnySap();
  Object.assign(d, { tZP: 5, tOH: 2, prostor: '1.1' });
  d.jednotky.push({ id: 'a', nazev: 'HZS', druh: 'profi', L: 3, tBR: 3 }, { id: 'b', nazev: 'JSDH', druh: 'dobro', L: 6, tBR: 5 });
  return d;
};
const blizko = (a, b, eps = 0.05) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('tabulka č. 1 je převzata (9 tříd, výrobní prostor Io 56,2 / Ip 11,2 / v1 1,2)', () => {
  const p = najdiProstor('1.1'); assert.deepEqual([p.io, p.ip, p.v1], [56.2, 11.2, 1.2]);
  assert.ok(PROSTORY.length > 70);
  assert.equal(najdiProstor('9.7').nazev, 'Lesy, kosodřevina');
});

test('doby, rádius, plocha požáru a hašení – kruhová forma (vzorce kap. 3.2, 4.1, 4.2)', () => {
  const { vysledky: v, chybi } = vypocetSaP(zaklad());
  assert.deepEqual(chybi, []);
  // tDO: HZS 2 + 60·3/45 = 6; JSDH 10 + 8 = 18; tR = 12; tVR = 5 + 2 + 6 + 3 = 16; t2 = 6; tuh = 5 (v1 ≤ 2); t3 = 12 + 5 − 3 + 5 = 19
  // R1 = 5·1,2 + 1,2·6 = 13,2; R = 13,2 + 0,5·1,2·19 = 24,6
  blizko(v.tR, 12); blizko(v.R, 24.6);
  blizko(v.Sp, Math.PI * 24.6 ** 2, 0.5); blizko(v.Sh, Math.PI * (24.6 ** 2 - 19.6 ** 2), 0.5);
  blizko(v.Qh, v.Sh * 11.2, 0.5);
  assert.equal(v.Nh, Math.ceil(v.Qh / 200)); assert.equal(v.NHa, Math.ceil(1.25 * 2 * v.Nh));
});

test('pravidlo 85 % plochy požárního úseku, úhlová a pravoúhlá forma, fronta hašení', () => {
  const d = zaklad(); d.plochaUseku = 500;
  let v = vypocetSaP(d).vysledky; assert.equal(v.Sp, 500); assert.equal(v.Sh, 500);
  d.plochaUseku = null; d.forma = 'uhel'; d.uhel = '90';
  v = vypocetSaP(d).vysledky; blizko(v.Sp, 0.25 * Math.PI * 24.6 ** 2, 0.5);
  d.forma = 'pravouhla'; d.a = 20; d.n = 1;
  v = vypocetSaP(d).vysledky; blizko(v.Sp, 24.6 * 20, 0.01); blizko(v.Sh, 5 * 20, 0.01);
  d.zpusob = 'fronta'; d.Oh = 36;
  v = vypocetSaP(d).vysledky; blizko(v.Qh, 36 * 56.2, 0.01);
});

test('ochlazování nádrží, technika, voda, dýchací přístroj, dálková doprava a pěna (kap. 5.2–5.8)', () => {
  const d = zaklad(); d.forma = 'pravouhla'; d.a = 10;
  Object.assign(d, { nadrzD: 9, sousedniD: 9, sousedniM: 1, druzstvo: '1+5', Qc: 2500, vydatnost: 3600 });
  d.dych = { pL: 30, VL: 6, prace: 'stredni' }; d.dalkova = { Lh: 500, H: 10, prutok: '600', hadice: 'izolovane' };
  d.kyvadlo = { L: 3, Vnc: 3500, Qc: 2500, qv: 600 }; d.pena = { N: 1, qpr: 800, pp: 6 };
  const { vysledky: v } = vypocetSaP(d);
  blizko(v.Qo, Math.PI * 9 * 30 + 0.5 * Math.PI * 9 * 12, 0.5);
  blizko(v.To, (10 * 30 * 6) / 35, 0.01);
  assert.equal(v.Ncerp, Math.ceil((10 + 0.01 * 500 * 8 + 7.5) / 65));
  blizko(v.Vp, 1 * 0.01 * 800 * 6 * 10 * 3, 0.01);   // 1440 l = údaj tab. 5 pro P6 (800 l/min, 6 %)
  assert.equal(v.NA, Math.max(Math.ceil(v.Qp / 600), Math.ceil(v.Npr / 2)));
  assert.match(shrnutiSaP(d), /proudů/);
  assert.ok(sapJakoText(d).includes('Ochranná doba přístroje'));
});

test('neúplné vstupy se hlásí, výpočet nic nedomýšlí', () => {
  const { chybi, vysledky } = vypocetSaP(prazdnySap());
  assert.ok(chybi.length >= 3); assert.equal(vysledky.Npr, undefined);
  assert.match(shrnutiSaP(prazdnySap()), /není úplný/);
});
