import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nactiDxf, primitivaNaPrvky, parsujDxf, dekodujBajty, bboxPrimitiv, barvaAci, JEDNOTKY } from '../js/kresleni/import/dxf.js';

const fix = (n) => readFileSync(new URL(`./fixtury/${n}`, import.meta.url));
const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≉ ${b}`);

test('DXF v metrech: jednotky z hlavičky, rozsah 20 × 10 m, vrstvy a zmrazené/skryté vrstvy', () => {
  const r = nactiDxf(fix('hala_m.dxf'));
  assert.equal(r.jednotky.nazev, 'metry'); assert.equal(r.odhad, null);
  const pv = primitivaNaPrvky(r.vysl, r.primitiva, r.jednotky.mNa);
  const stena = pv.prvky.filter((p) => p.druh === 'stena');
  assert.ok(stena.length >= 2, 'vrstva STENY se rozpozná jako stěny');
  const nazvy = pv.vrstvy.map((v) => v.nazev);
  assert.ok(nazvy.includes('DXF: STENY') && nazvy.includes('DXF: SKRYTA') && nazvy.includes('DXF: ZMRAZENA'));
  assert.equal(pv.vrstvy.find((v) => v.nazev === 'DXF: SKRYTA').viditelna, false, 'vypnutá vrstva se importuje jako skrytá');
  assert.equal(pv.vrstvy.find((v) => v.nazev === 'DXF: ZMRAZENA').viditelna, false, 'zmrazená vrstva také');
  const obvod = pv.prvky.find((p) => p.druh === 'stena' && p.body.length === 5);
  const xs = obvod.body.map((b) => b[0]), ys = obvod.body.map((b) => b[1]);
  close(Math.max(...xs) - Math.min(...xs), 20); close(Math.max(...ys) - Math.min(...ys), 10);
  assert.ok(Math.max(...ys) <= 0 + 1e-9 && Math.min(...ys) <= -9.99, 'osa y se převrací (CAD y nahoru → plátno y dolů)');
});

test('DXF v milimetrech dává stejné metry; bez jednotek se jednotky odhadnou a nikdy se tiše nepředpokládají', () => {
  const m = nactiDxf(fix('hala_mm.dxf')); assert.equal(m.jednotky.nazev, 'milimetry');
  const pm = primitivaNaPrvky(m.vysl, m.primitiva, m.jednotky.mNa).prvky.find((p) => p.druh === 'stena' && p.body.length === 5);
  close(Math.max(...pm.body.map((b) => b[0])) - Math.min(...pm.body.map((b) => b[0])), 20);
  const b = nactiDxf(fix('hala_bez_jednotek_mm.dxf'));
  assert.equal(b.jednotky, null); assert.ok(b.odhad, 'odhad existuje');
  assert.equal(b.odhad.doporuceno, 'mm'); assert.match(b.odhad.duvod, /kóta|rozměr/);
  const mmK = b.odhad.kandidati.find((k) => k.id === 'mm'); close(mmK.rozmerM[0], 22.4, 0.1);   // hala 20 m + hydrant vpravo
});

test('DXF R2000 s kódovou stránkou ANSI_1250: české znaky se dekódují správně', () => {
  const r = nactiDxf(fix('hala_r2000_cp1250.dxf'));
  assert.equal(r.kodovani, 'windows-1250');
  const texty = primitivaNaPrvky(r.vysl, r.primitiva, 1).prvky.filter((p) => p.druh === 'text').map((p) => p.text);
  assert.ok(texty.some((t) => t.includes('Výrobní hala – ČERPADLO')), `texty: ${JSON.stringify(texty)}`);
});

test('texty: TEXT s %% kódy, MTEXT s formátováním, \\U+ a entitami; výška a otočení', () => {
  const r = nactiDxf(fix('hala_m.dxf'));
  const t = primitivaNaPrvky(r.vysl, r.primitiva, 1).prvky.filter((p) => p.druh === 'text');
  const texty = t.map((p) => p.text);
  assert.ok(texty.includes('RoØ100 45°'), 'Ø a °');
  const mt = texty.find((x) => x.includes('Strojní dílny'));
  assert.equal(mt, 'Strojní dílny\nI. NP Čerpadlo & sklad');
  const svisly = t.find((p) => p.text.startsWith('RoØ')); close(Math.abs(svisly.uhel), 90, 1e-6); close(svisly.vyskaM, 0.4, 1e-6);
});

test('bloky: dveře a hydrant; dveře se rozpoznají podle názvu bloku a označí ke kontrole, ostatní bloky se rozbalí', () => {
  const r = nactiDxf(fix('hala_m.dxf'));
  const pv = primitivaNaPrvky(r.vysl, r.primitiva, 1);
  const dv = pv.prvky.filter((p) => p.druh === 'dvere'); assert.equal(dv.length, 2);
  assert.ok(dv.every((d) => d.kKontrole === true && d.stenaId === null), 'nejistý převod je označen ke kontrole');
  close(dv[0].sirkaM, 0.9, 0.05);
  assert.ok(pv.prvky.some((p) => p.druh === 'elipsa' && Math.abs(p.rx - 0.4) < 1e-6), 'hydrant: kružnice z bloku, rozbalená');
  const bez = primitivaNaPrvky(r.vysl, r.primitiva, 1, { rozpoznat: false });
  assert.equal(bez.prvky.filter((p) => p.druh === 'stena').length, 0);
});

test('kóty se importují z anonymních bloků (čáry, šipky, text) a slouží k odhadu jednotek', () => {
  const r = nactiDxf(fix('hala_bez_jednotek_mm.dxf'));
  assert.ok(r.koty.length >= 2, `kót: ${r.koty}`); assert.ok(r.koty.some((k) => Math.abs(k - 20000) < 1));
  const pv = primitivaNaPrvky(r.vysl, r.primitiva, 0.001);
  assert.ok(pv.prvky.some((p) => p.druh === 'text' && /20000|20\.000|20/.test(p.text)), 'text kóty');
});

test('ostatní entity: oblouk, elipsa, spline, polyline s obloukem; HATCH se hlásí jako přeskočený', () => {
  const r = nactiDxf(fix('hala_m.dxf'));
  assert.ok(r.nepodporovane.HATCH >= 1, JSON.stringify(r.nepodporovane));
  const pv = primitivaNaPrvky(r.vysl, r.primitiva, 1);
  assert.ok(pv.prvky.some((p) => p.druh === 'elipsa'), 'kružnice/elipsa');
  const bulge = pv.prvky.find((p) => p.druh === 'stena' && p.body.length > 6 && Math.min(...p.body.map((q) => q[1])) < -19);
  assert.ok(bulge, 'polyline s obloukem (bulge) se rozloží na úsečky');
  const bb = bboxPrimitiv(r.primitiva); assert.ok(bb.x1 - bb.x0 > 20);
});

test('oblouk z bulge má správný směr a vzepětí (kontrola geometrie)', () => {
  const r = nactiDxf(fix('hala_m.dxf'));
  const pv = primitivaNaPrvky(r.vysl, r.primitiva, 1);
  const o = pv.prvky.find((p) => p.druh === 'stena' && p.body.length > 6 && Math.min(...p.body.map((q) => q[1])) < -19);
  const maxX = Math.max(...o.body.map((q) => q[0]));
  close(maxX, 4.5, 0.02);                                      // chord (4;20)–(4;22), bulge 0,5 → vzepětí 0,5 m doprava
  const nej = o.body.reduce((a, q) => (q[0] > a[0] ? q : a)); close(nej[1], -21, 0.1);   // uprostřed tětivy (y převráceno)
});

test('barvy ACI a binární DXF', () => {
  assert.equal(barvaAci(1), '#ff0000'); assert.equal(barvaAci(7), '#000000'); assert.match(barvaAci(30), /^#[0-9a-f]{6}$/); assert.match(barvaAci(140), /^#[0-9a-f]{6}$/);
  assert.throws(() => dekodujBajty(new TextEncoder().encode('AutoCAD Binary DXF\r\n\x1a\0')), /Binární DXF/);
  assert.equal(JEDNOTKY[4].mNa, 0.001);
});

test('prázdný nebo poškozený soubor nespadne', () => {
  const r = parsujDxf('0\nSECTION\n2\nENTITIES\n0\nLINE\n8\n0\n10\n0\n20\n0\n0\nENDSEC\n0\nEOF\n');
  assert.equal(r.entity.length, 1);
  assert.doesNotThrow(() => parsujDxf('nesmysl\nbez\nstruktury'));
});
