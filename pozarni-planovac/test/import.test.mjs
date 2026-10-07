import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nactiDxf, primitivaNaPrvky } from '../js/kresleni/import/dxf.js';
import { nactiSvg } from '../js/kresleni/import/svg.js';
import { vlozVektor, kalibrujVektor } from '../js/kresleni/import/index.js';
import { sloucCary } from '../js/kresleni/import/pdf.js';
import { novyList } from '../js/model.js';
import * as P from '../js/kresleni/prvky.js';

const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≉ ${b}`);
const fix = (n) => readFileSync(new URL(`./fixtury/${n}`, import.meta.url));

test('vložení DXF do výkresu: měřítko tisku se navrhne, texty dostanou velikost v mm na papíře, dveře se připojí ke stěně', () => {
  const r = nactiDxf(fix('hala_m.dxf')), pv = primitivaNaPrvky(r.vysl, r.primitiva, 1);
  const v = novyList('pudorys').vykres;
  const info = vlozVektor(v, { prvky: pv.prvky, vrstvy: pv.vrstvy, meritko: { overeno: true, zdroj: 'dxf-hlavicka', popis: 'metry' } });
  assert.equal(v.meritko.pomer, 200); assert.equal(info.pomer, 200);   // obsah má ~24 m na výšku (168 mm rámu) → 1 : 200
  const t = v.prvky.find((p) => p.druh === 'text' && p.text.startsWith('RoØ'));
  close(t.vyska, 2, 1e-6); assert.equal(t.vyskaM, undefined);          // 0,4 m × 1000 / 200 = 2 mm
  const dveře = v.prvky.filter((p) => p.druh === 'dvere');
  assert.equal(dveře.length, 2);
  assert.ok(dveře.some((d) => d.stenaId), 'alespoň jedny dveře leží na stěně a připojily se'); assert.ok(dveře.every((d) => d.kKontrole));
  assert.ok(P.meritkoOvereno(v)); assert.equal(v.vrstvy.filter((l) => l.id.startsWith('dxf_')).length >= 4, true);
  assert.ok(Number.isFinite(v.okno.x));
});

test('neověřené měřítko (DXF bez jednotek) → upozornění do kalibrace; kalibrace přeškáluje celý obsah a měřítko ověří', () => {
  const r = nactiDxf(fix('hala_bez_jednotek_mm.dxf')), kand = r.odhad.kandidati.find((k) => k.id === 'mm');
  const pv = primitivaNaPrvky(r.vysl, r.primitiva, kand.mNa), v = novyList('pudorys').vykres;
  vlozVektor(v, { prvky: pv.prvky, vrstvy: pv.vrstvy, meritko: { overeno: false, zdroj: 'dxf-odhad', popis: 'jednotky vybrané uživatelem (milimetry)' } });
  assert.equal(P.meritkoOvereno(v), false);
  const obvod = v.prvky.find((p) => p.druh === 'stena' && p.body.length === 5), sirka = () => Math.max(...obvod.body.map((b) => b[0])) - Math.min(...obvod.body.map((b) => b[0]));
  close(sirka(), 20, 1e-6);
  // uživatel změří známou délku: strana haly je ve skutečnosti 40 m (ne 20 m)
  const [a, b] = [obvod.body[0], obvod.body[1]];
  const f = kalibrujVektor(v, a, b, 40); close(f, 2);
  close(sirka(), 40, 1e-6); assert.ok(P.meritkoOvereno(v)); assert.match(v.meritkoZdroj.popis, /kalibrac/);
  assert.throws(() => kalibrujVektor(v, a, a, 5)); assert.throws(() => kalibrujVektor(v, a, b, -1));
});

test('vložení SVG/PDF dat: osa y dolů, měřítko tisku zadané uživatelem zůstává neověřené', () => {
  const r = nactiSvg('<svg width="297mm" height="210mm" viewBox="0 0 297 210"><path d="M10 10 L110 10" stroke="#000"/><text x="20" y="30" font-size="5">Hala</text></svg>');
  const N = 100, pv = primitivaNaPrvky({ vrstvy: new Map() }, r.primitiva.map((p) => ({ ...p, vrstva: 'SVG' })), (r.mmNaJednotku * N) / 1000, { osaYNahoru: false, rozpoznat: false });
  const l = pv.prvky.find((p) => p.druh === 'cara'); close(l.body[1][0] - l.body[0][0], 10);     // 100 mm na papíře × 100 = 10 m
  const v = novyList('situace').vykres; vlozVektor(v, { prvky: pv.prvky, vrstvy: pv.vrstvy, meritko: { overeno: false, zdroj: 'svg-tisk', popis: 'měřítko tisku 1 : 100' } });
  assert.equal(P.meritkoOvereno(v), false);
});

test('slučování navazujících úseček (PDF z CADu)', () => {
  const s = (a, b) => ({ t: 'cara', body: [a, b], zav: false, barva: '#000', tloustka: 0.25, styl: 'plna' });
  const r = sloucCary([s([0, 0], [1, 0]), s([2, 0], [3, 0]), s([1, 0], [2, 0]), s([5, 5], [6, 6]), { ...s([3, 0], [4, 0]), barva: '#f00' }]);
  const cary = r.filter((p) => p.t === 'cara');
  assert.equal(cary.length, 3);                                              // 1 sloučená (0→3), 1 samotná, 1 jiné barvy
  assert.deepEqual(cary.find((p) => p.body.length === 4).body, [[0, 0], [1, 0], [2, 0], [3, 0]]);
  const uzavrena = sloucCary([s([0, 0], [1, 0]), s([1, 0], [1, 1]), s([1, 1], [0, 1]), s([0, 1], [0, 0])]);
  assert.equal(uzavrena.length, 1); assert.equal(uzavrena[0].zav, true);
});

test('vložení do neprázdného výkresu zachová stávající obsah a nepřepíše ověřené měřítko', () => {
  const v = novyList('pudorys').vykres; v.prvky.push(P.novyPrvek('stena', { body: [[0, 0], [5, 0]] })); v.meritko.pomer = 50;
  vlozVektor(v, { prvky: [P.novyPrvek('cara', { body: [[0, 1], [3, 1]] })], vrstvy: [], meritko: { overeno: false, zdroj: 'x', popis: 'x' } });
  assert.equal(v.prvky.length, 2); assert.equal(v.meritko.pomer, 50, 'měřítko tisku se v neprázdném výkresu nemění');
});
