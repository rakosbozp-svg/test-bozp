import test from 'node:test';
import assert from 'node:assert/strict';
import * as P from '../js/kresleni/prvky.js';
import * as G from '../js/kresleni/geom.js';
import { novyList } from '../js/model.js';

const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≉ ${b}`);

test('délka trasy se počítá v metrech a mění se s geometrií', () => {
  const t = P.novyPrvek('trasa', { body: [[0, 0], [3, 4], [3, 10]] });
  close(P.delkaTrasy(t), 11);
  t.body[2] = [3, 14]; close(P.delkaTrasy(t), 15);
  assert.equal(P.formatDelky(11), '11,0 m'); assert.equal(P.formatDelky(4.256), '4,26 m');
  close(P.celkovaDelkaTras([t, P.novyPrvek('stena', { body: [[0, 0], [100, 0]] }), P.novyPrvek('trasa', { body: [[0, 0], [0, 2]] })]), 17);
});

test('dveře se vážou na stěnu a sledují ji při změně geometrie', () => {
  const s = P.novyPrvek('stena', { body: [[0, 0], [10, 0]] });
  const d = P.novyPrvek('dvere');
  const prvky = [s, d];
  assert.ok(P.pripojDvere(d, prvky, [4, 0.2], 1));
  assert.equal(d.stenaId, s.id); close(d.x, 4); close(d.y, 0);
  // stěna se posune a prodlouží – dveře zůstávají na stejném místě stěny (t)
  s.body = s.body.map(([x, y]) => [x, y + 5]); P.obnovDvere(prvky);
  close(d.y, 5);
  s.body[1] = [20, 5]; P.obnovDvere(prvky);
  close(d.x, 8, 1e-6);   // t = 0,4 z nové délky 20
  // otočení stěny otočí i dveře
  s.body = [[0, 0], [0, 10]]; P.obnovDvere(prvky);
  close(d.uhel, 90); close(d.x, 0); close(d.y, 4);
});

test('dveře: posun po stěně, přeskok na jinou stěnu, volný pohyb, odpojení a připojení', () => {
  const a = P.novyPrvek('stena', { body: [[0, 0], [10, 0]] });
  const b = P.novyPrvek('stena', { body: [[0, 20], [10, 20]] });
  const d = P.novyPrvek('dvere');
  const prvky = [a, b, d];
  P.pripojDvere(d, prvky, [2, 0]);
  P.posunDvere(d, prvky, [7, 5], 1);                // daleko od stěn – zůstane na své stěně
  assert.equal(d.stenaId, a.id); close(d.x, 7); close(d.y, 0);
  P.posunDvere(d, prvky, [3, 20.5], 1);             // u druhé stěny – přeskočí
  assert.equal(d.stenaId, b.id); close(d.x, 3); close(d.y, 20);
  P.odpojDvere(d, prvky); assert.equal(d.stenaId, null);
  P.posunDvere(d, prvky, [50, 50], 1); close(d.x, 50); close(d.y, 50);   // volně
  assert.ok(!P.pripojDvere(d, prvky, [50, 50], 1));                       // daleko – nepřipojí
  assert.ok(P.pripojDvere(d, prvky, [5, 19.8], 1)); assert.equal(d.stenaId, b.id);
});

test('smazání stěny odpojí dveře a ponechá je na místě', () => {
  const s = P.novyPrvek('stena', { body: [[0, 0], [10, 0]] }); const d = P.novyPrvek('dvere');
  let prvky = [s, d]; P.pripojDvere(d, prvky, [6, 0]);
  prvky = [d]; P.obnovDvere(prvky);
  assert.equal(d.stenaId, null); close(d.x, 6); close(d.y, 0);
});

test('typ dveří podle šířky a ruční volba', () => {
  const d = P.novyPrvek('dvere'); const prvky = [d];
  P.nastavSirkuDveri(d, 0.9, prvky); assert.equal(d.typ, 'jednokridle');
  P.nastavSirkuDveri(d, 1.6, prvky); assert.equal(d.typ, 'dvoukridle');
  P.nastavSirkuDveri(d, 3.5, prvky); assert.equal(d.typ, 'vrata');
  P.nastavTypDveri(d, 'jednokridle'); P.nastavSirkuDveri(d, 3.5, prvky); assert.equal(d.typ, 'jednokridle', 'ruční volba se nepřepíše');
  assert.throws(() => P.nastavTypDveri(d, 'okno'));
});

test('kopie dveří odpojí dveře, jejichž stěna se nekopíruje', () => {
  const s = P.novyPrvek('stena', { body: [[0, 0], [10, 0]] }); const d = P.novyPrvek('dvere');
  const prvky = [s, d]; P.pripojDvere(d, prvky, [5, 0]);
  const k1 = P.kopiePrvku([d], prvky, 1, 1); assert.equal(k1[0].stenaId, null); close(k1[0].x, 6); close(k1[0].y, 1);
  const k2 = P.kopiePrvku([s, d], prvky, 0, 3); assert.equal(k2[1].stenaId, k2[0].id);
  assert.notEqual(k2[0].id, s.id);
});

test('zásah, bbox a transformace', () => {
  const s = P.novyPrvek('stena', { body: [[0, 0], [10, 0]] });
  assert.ok(P.zasah(s, [5, 0.1], 0.2, 100)); assert.ok(!P.zasah(s, [5, 1], 0.2, 100));
  const o = P.novyPrvek('obdelnik', { cx: 5, cy: 5, w: 4, h: 2, uhel: 0 });
  P.otocPrvek(o, [5, 5], Math.PI / 2); close(o.uhel, 90);
  const b = P.bboxPrvku(o, 100); close(b.x1 - b.x0, 2); close(b.y1 - b.y0, 4);
  const z = P.novyPrvek('znacka', { x: 0, y: 0, velikost: 8, znackaId: 'DZP-001' });
  close(P.mmNaM(z.velikost, 1000), 8); close(P.mmNaM(z.velikost, 100), 0.8);
  P.meritkujPrvek(z, [0, 0], 2, 2); close(z.velikost, 16);
  P.meritkujPrvek(z, [0, 0], 100, 100); close(z.velikost, 500, 1e-9);   // ořez na 500
  P.posunPrvek(s, 1, 2); assert.deepEqual(s.body, [[1, 2], [11, 2]]);
});

test('geometrie: nejbližší bod, zjednodušení, polygon', () => {
  const r = G.nejblizsiNaLomene([5, 3], [[0, 0], [10, 0], [10, 10]]); close(r.d, 3); assert.equal(r.seg, 0);
  assert.equal(G.zjednodus([[0, 0], [1, 0.001], [2, 0], [3, 0]], 0.01).length, 2);
  assert.ok(G.bodVPolygonu([1, 1], [[0, 0], [2, 0], [2, 2], [0, 2]])); assert.ok(!G.bodVPolygonu([3, 1], [[0, 0], [2, 0], [2, 2], [0, 2]]));
});

test('legenda se skládá z použitých značek, měřítko se navrhne podle obsahu', () => {
  const l = novyList('situace'); const v = l.vykres;
  v.prvky.push(P.novyPrvek('znacka', { x: 0, y: 0, znackaId: 'DZP-001' }), P.novyPrvek('znacka', { x: 5, y: 5, znackaId: 'DZP-001' }), P.novyPrvek('znacka', { x: 9, y: 5, znackaId: 'DZP-004' }));
  P.synchronizujLegendu(v); assert.deepEqual(v.legenda, ['DZP-001', 'DZP-004']);
  v.prvky.push(P.novyPrvek('stena', { body: [[0, 0], [250, 0]] }));
  assert.equal(P.navrhniMeritko(v), 1000);                       // 250 m na 277 mm rámu → 1 : 1000
  v.prvky[3].body = [[0, 0], [20, 0]]; assert.equal(P.navrhniMeritko(v), 100);
  P.vycentrujOkno(v); assert.ok(Number.isFinite(v.okno.x));
});

test('kalibrace podkladu a ověření měřítka', () => {
  const l = novyList('pudorys'); const v = l.vykres;
  assert.ok(P.meritkoOvereno(v), 'bez podkladu se kreslí přímo v metrech');
  v.pozadi = { sirkaPx: 1000, vyskaPx: 500, mNaPx: 0.01, x: 0, y: 0, kalibrace: null };
  assert.ok(!P.meritkoOvereno(v));
  P.kalibruj(v.pozadi, [100, 100], [400, 500], 25); close(v.pozadi.mNaPx, 25 / 500);
  assert.ok(P.meritkoOvereno(v));
  assert.throws(() => P.kalibruj(v.pozadi, [0, 0], [0, 0], 5)); assert.throws(() => P.kalibruj(v.pozadi, [0, 0], [1, 1], -2));
});

test('historie: undo/redo a nová větev maže redo', () => {
  const h = new P.Historie('a'); h.push('b'); h.push('c');
  assert.equal(h.undo(), 'b'); assert.equal(h.undo(), 'a'); assert.equal(h.undo(), null);
  assert.equal(h.redo(), 'b'); h.push('x'); assert.equal(h.lzeVpred, false); assert.equal(h.push('x'), false);
  const l = novyList('situace'); const v = l.vykres; const snap = P.snimek(v);
  v.prvky.push(P.novyPrvek('cara', { body: [[0, 0], [1, 1]] })); v.meritko.pomer = 200;
  P.obnovZeSnimku(v, snap); assert.equal(v.prvky.length, 0); assert.equal(v.meritko.pomer, 1000);
});
