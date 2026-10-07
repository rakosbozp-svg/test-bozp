import test from 'node:test';
import assert from 'node:assert/strict';
import { nactiSvg, parsujCestu, parsujTransform, parsujXml, barvaCss } from '../js/kresleni/import/svg.js';
import { primitivaNaPrvky } from '../js/kresleni/import/dxf.js';

const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≉ ${b}`);
const SVG = `<?xml version="1.0"?>
<!-- komentář -->
<svg xmlns="http://www.w3.org/2000/svg" width="297mm" height="210mm" viewBox="0 0 297 210">
  <defs><g id="hyd"><circle cx="0" cy="0" r="2" stroke="blue" fill="none"/></g></defs>
  <g transform="translate(10,20)" stroke="#000" fill="none" stroke-width="0.5">
    <line x1="0" y1="0" x2="100" y2="0"/>
    <rect x="0" y="0" width="100" height="50"/>
    <polyline points="0,0 10,10 20,0"/>
    <path d="M0 60 L50 60 Q75 40 100 60 C110 70 120 70 130 60 A10 10 0 0 1 150 60 Z"/>
    <use href="#hyd" x="30" y="30"/>
  </g>
  <text x="50" y="100" font-size="5" text-anchor="middle" fill="#c00">Výrobní <tspan x="50" dy="6">hala &amp; sklad</tspan></text>
  <path d="M5 5 h10 v10 h-10 z" fill="#ffee00" stroke="none"/>
  <image href="x.png" x="0" y="0" width="10" height="10"/>
</svg>`;

test('XML čtečka: komentáře, entity, atributy, samouzavírací tagy', () => {
  const r = parsujXml('<a x="1" y=\'2\'><!-- c --><b/><c>t &amp; u</c></a>');
  assert.equal(r.tag, 'a'); assert.equal(r.attrs.y, '2'); assert.equal(r.deti.length, 2); assert.equal(r.deti[1].text, 't & u');
});

test('SVG: fyzický rozměr z mm, transformace skupiny, čáry, obdélník, cesty se křivkami, use, text, plochy', () => {
  const r = nactiSvg(SVG);
  close(r.mmNaJednotku, 1); assert.ok(r.jisteMm, 'width v mm → fyzické rozměry jsou jisté');
  const cary = r.primitiva.filter((p) => p.t === 'cara' || p.t === 'plocha');
  const l = cary[0]; assert.deepEqual(l.body, [[10, 20], [110, 20]]);
  const rect = cary[1]; assert.equal(rect.body.length, 4); assert.deepEqual(rect.body[2], [110, 70]);
  const cesta = cary.find((p) => p.body.length > 20); assert.ok(cesta.zav, 'cesta končí Z');
  assert.ok(cary.some((p) => p.body.length === 48 && Math.abs(p.body[0][0] - 42) < 1e-6), 'use + kružnice, posunuto o transform i x/y');
  const plocha = r.primitiva.find((p) => p.t === 'plocha' && p.vypln === '#ffee00'); assert.ok(plocha);
  const t = r.primitiva.filter((p) => p.t === 'text'); assert.equal(t.length, 2);
  assert.equal(t[0].text, 'Výrobní'); assert.equal(t[1].text, 'hala & sklad'); close(t[1].y, 106);
  assert.equal(r.nepodporovane['image (vložený obrázek)'], 1);
});

test('SVG bez fyzických rozměrů: odhad 96 dpi a příznak, že rozměry nejsou jisté', () => {
  const r = nactiSvg('<svg viewBox="0 0 800 600"><line x1="0" y1="0" x2="800" y2="0" stroke="red"/></svg>');
  assert.equal(r.jisteMm, false); close(r.mmNaJednotku, 25.4 / 96);
  assert.equal(nactiSvg('<svg width="100px" height="50px"><rect width="5" height="5"/></svg>').jisteMm, false);
  assert.throws(() => nactiSvg('<html></html>'), /není platné SVG/);
});

test('cesty: relativní příkazy, H/V, oblouk, S/T zrcadlení', () => {
  const c = parsujCestu('m10 10 h20 v20 h-20 z');
  assert.deepEqual(c[0].body, [[10, 10], [30, 10], [30, 30], [10, 30]]); assert.equal(c[0].zav, true);
  const o = parsujCestu('M0 0 A10 10 0 0 1 20 0')[0].body; assert.ok(o.length > 4); close(o.at(-1)[0], 20); close(Math.min(...o.map((p) => p[1])), -10, 0.2);
  const s = parsujCestu('M0 0 C0 10 10 10 10 0 S20 -10 20 0')[0].body; close(s.at(-1)[0], 20);
  assert.equal(parsujCestu('M0 0 L10 0 20 10')[0].body.length, 3, 'další dvojice po L jsou L');
  assert.equal(parsujCestu('M0 0 10 0 10 10')[0].body.length, 3, 'další dvojice po M jsou L');
});

test('transformace a barvy', () => {
  const M = parsujTransform('translate(10 5) scale(2) rotate(90)');
  assert.ok(M.every(Number.isFinite)); close(M[4], 10); close(M[5], 5); close(M[0], 0, 1e-9); close(M[1], 2, 1e-9);
  assert.equal(barvaCss('rgb(255,0,0)'), '#ff0000'); assert.equal(barvaCss('#0f0'), '#00ff00'); assert.equal(barvaCss('none'), 'none'); assert.equal(barvaCss('blue'), '#0000ff');
});

test('SVG primitiva se převedou na prvky modelu (y dolů, bez převrácení)', () => {
  const r = nactiSvg(SVG);
  const pv = primitivaNaPrvky({ vrstvy: new Map() }, r.primitiva.map((p) => ({ ...p, vrstva: 'SVG' })), 1, { osaYNahoru: false });
  const l = pv.prvky.find((p) => p.druh === 'cara'); assert.deepEqual(l.body[0], [10, 20]);
  assert.ok(pv.prvky.some((p) => p.druh === 'text' && p.text === 'Výrobní'));
});
