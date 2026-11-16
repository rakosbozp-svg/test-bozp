import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VEKTOR, maVektor, skupinaVektoru, vektorDoBoxu, svgVektoru, dataUriVektoru, obrazekZnacky } from '../js/znackyVektor.js';
import { parsujXml } from '../js/kresleni/import/svg.js';
import { renderListu } from '../js/kresleni/render.js';
import * as P from '../js/kresleni/prvky.js';
import * as M from '../js/model.js';
import { exportujPdf } from '../js/pdf/export.js';

const KAT = JSON.parse(readFileSync(new URL('../znacky/katalog.json', import.meta.url), 'utf8')).znacky;
const katalog = new Map(KAT.map((z) => [z.id, z]));
const NEJCASTEJSI = ['DZP-105', 'DZP-108', 'DZP-004', 'DZP-001', 'DZP-007', 'DZP-055', 'DZP-002', 'DZP-005', 'DZP-008', 'DZP-017',
  'DZP-020', 'DZP-104', 'DZP-107', 'DZP-062', 'DZP-053', 'DZP-042', 'DZP-045', 'DZP-054', 'DZP-058', 'DZP-003', 'DZP-050', 'DZP-011', 'DZP-014', 'DZP-024', 'DZP-074', 'DZP-057', 'DZP-060', 'DZP-084', 'DZP-095'];
const POVOLENE = new Set(['g', 'path', 'polygon', 'polyline', 'line', 'rect', 'circle', 'ellipse', 'text', 'tspan']);

test('vektorové značky: nejčastější značky DZP mají vektor se stejným poměrem stran jako katalog', () => {
  for (const id of NEJCASTEJSI) {
    assert.ok(maVektor(id), `${id} nemá vektor`);
    const z = katalog.get(id), v = VEKTOR[id];
    assert.ok(z, `${id} není v katalogu`);
    assert.ok(v.w > 0 && v.h > 0 && v.svg.length > 20, id);
    const r = (v.w / v.h) / (z.sirka / z.vyska);
    assert.ok(r > 0.85 && r < 1.18, `${id}: poměr stran ${(v.w / v.h).toFixed(2)} vs. katalog ${(z.sirka / z.vyska).toFixed(2)}`);
  }
  assert.ok(!maVektor('DZP-012') && !maVektor('neexistuje') && !maVektor(undefined) && !maVektor('constructor'));
});

test('vektorové značky: jen čisté vektorové prvky, žádný obrázek ani skript', () => {
  const projdi = (el, id) => { assert.ok(POVOLENE.has(el.tag), `${id}: nepovolený prvek <${el.tag}>`); for (const k of Object.keys(el.attrs)) assert.ok(!/^on|href/i.test(k), `${id}: atribut ${k}`); el.deti.forEach((d) => projdi(d, id)); };
  for (const [id, v] of Object.entries(VEKTOR)) {
    const koren = parsujXml(`<svg xmlns="http://www.w3.org/2000/svg">${v.svg}</svg>`);
    koren.deti.forEach((d) => projdi(d, id));
  }
});

test('vektorové značky: skupina se vejde do čtverce velikosti značky a otáčí se kolem středu', () => {
  const g = skupinaVektoru('DZP-105', 10, 20, 8, -90, 'data-id="z1" data-druh="znacka"');
  assert.match(g, /^<g data-id="z1" data-druh="znacka" transform="translate\(10 20\) rotate\(-90\) scale\(([\d.]+)\) translate\(([-\d.]+) ([-\d.]+)\)">/);
  const [, k, tx, ty] = /scale\(([\d.]+)\) translate\(([-\d.]+) ([-\d.]+)\)/.exec(g).map(Number);
  const v = VEKTOR['DZP-105'];
  assert.ok(Math.abs(k * Math.max(v.w, v.h) - 8) < 1e-3, 'delší strana = velikost');
  assert.ok(Math.abs(tx + v.w / 2) < 1e-3 && Math.abs(ty + v.h / 2) < 1e-3, 'střed značky v bodě');
  const m = /scale\(([\d.e-]+)\)/.exec(skupinaVektoru('DZP-007', 0, 0, 0.33, 0))[1];
  assert.ok(Math.abs(Number(m) * VEKTOR['DZP-007'].w - 0.33) < 1e-6, 'velikost v metrech se nezaokrouhlí (1:100, 3,3 mm)');
  const b = vektorDoBoxu('DZP-062', 2, 3, 6, 6);
  assert.match(b, /^<g transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)">/);
  assert.equal(skupinaVektoru('DZP-012', 0, 0, 8, 0), '');
});

test('vektorové značky: samostatné SVG a data URI pro náhledy (img)', () => {
  const s = svgVektoru('DZP-053');
  assert.match(s, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 [\d.]+ [\d.]+"/);
  const uri = dataUriVektoru('DZP-045');
  assert.match(uri, /^data:image\/svg\+xml;base64,[A-Za-z0-9+/=]+$/);
  const txt = new TextDecoder().decode(Uint8Array.from(atob(uri.split(',')[1]), (c) => c.charCodeAt(0)));
  assert.ok(txt.includes('MŘE'), 'UTF-8 se zachová');
  assert.equal(obrazekZnacky(katalog.get('DZP-045')), uri);
  assert.equal(obrazekZnacky(katalog.get('DZP-012')), katalog.get('DZP-012').png);
  assert.equal(obrazekZnacky(null), '');
});

const o = () => ({ objektNazev: 'Test', nazevListu: 'Situace', typListu: 'situace', znacky: katalog, symbolHref: (id) => `znacky/png/${id}.png`, prilohy: {} });

test('render: značka s vektorem se kreslí vektorem (výkres i legenda), ostatní obrázkem', () => {
  const v = M.novyList('situace').vykres;
  v.prvky.push(P.novyPrvek('znacka', { x: 30, y: 30, znackaId: 'DZP-105', velikost: 8, uhel: 90, vrstva: 'znacky' }),
    P.novyPrvek('znacka', { x: 50, y: 30, znackaId: 'DZP-012', velikost: 8, vrstva: 'znacky' }));
  P.synchronizujLegendu(v);
  const svg = renderListu(v, o());
  assert.ok(!svg.includes('DZP-105.png'), 'vektorová značka bez PNG');
  assert.ok(svg.includes('DZP-012.png'), 'značka bez vektoru dál obrázkem');
  assert.match(svg, /<g data-id="[^"]+" data-druh="znacka" transform="translate\(30 30\) rotate\(90\)/);
  const leg = svg.slice(svg.indexOf('data-legenda="1"'));
  assert.ok(!leg.includes('DZP-105.png') && leg.includes('DZP-012.png'));
  assert.ok(!svg.includes('NaN') && !svg.includes('undefined'));
});

test('PDF: vektorové značky na výkresu i v kartě (včetně výchozích nebezpečí karty) nevloží žádný bitmapový obrázek', async () => {
  const p = M.novyProjekt({ nazev: 'Vektor', typ: 'operativni_karta' });
  const k = p.listy[0].karta;
  k.nebezpeci.push({ id: 'n1', popis: 'kotel', hasivo: 'uzavřít plyn', znackaId: 'DZP-053' });
  k.vodniZdroje.push({ id: 'v1', typ: 'hydrant', popis: 'ulice', prutokLs: 6, overenPrutok: true, objemM3: null, gps: null, znackaId: 'DZP-004' });
  const v = p.listy[1].vykres;
  for (const [i, id] of NEJCASTEJSI.entries()) v.prvky.push(P.novyPrvek('znacka', { x: 10 + (i % 6) * 15, y: 10 + Math.floor(i / 6) * 15, znackaId: id, velikost: 8, vrstva: 'znacky' }));
  P.synchronizujLegendu(v);
  const pdf = await exportujPdf(p, { katalog });
  const text = new TextDecoder('latin1').decode(pdf);
  assert.ok(pdf.length > 2000);
  assert.ok(!/\/Subtype\s*\/Image/.test(text), 'v PDF není žádný obrázek');
});
