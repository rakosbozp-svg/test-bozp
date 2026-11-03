// Nástroje pro Claude (js/ai/nastroje.js): kreslení, úpravy, mazání, nastavení listu, popis stavu a limity platformy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as A from '../js/ai/nastroje.js';
import * as P from '../js/kresleni/prvky.js';
import { novyList } from '../js/model.js';
import { renderListu } from '../js/kresleni/render.js';
import { EVAK_SLOTY } from '../js/evakznacky.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KATALOG = JSON.parse(readFileSync(join(root, 'znacky/katalog.json'), 'utf8')).znacky;
const kontext = (typ = 'pudorys', extra = {}) => {
  const v = novyList(typ).vykres, evak = typ === 'evak_plan';
  const katalog = new Map((evak ? EVAK_SLOTY.slice(0, 5) : KATALOG).map((z) => [z.id, z]));
  return { v, katalog, evak, nazevListu: 'Test', typListu: typ, velikostZnacky: 8, velikostTextu: 3, ...extra };
};
const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≉ ${b}`);
const bajty = (s) => Buffer.byteLength(s, 'utf8');

test('kresli: stěny, dveře připojené ke stěně ze stejné dávky, trasa, text, značka – výchozí vrstvy a velikosti', () => {
  const k = kontext();
  const r = A.provedNastroj('kresli', { prvky: [
    { druh: 'dvere', x: 4, y: 0.05, sirka: 0.9 },   // dveře před stěnou v poli: připojí se až po přidání všech prvků
    { druh: 'stena', body: [[0, 0], [10, 0], [10, 8], [0, 8], [0, 0]], tloustka_m: 0.4 },
    { druh: 'stena', body: [[5, 0], [5, 8]], tloustka_m: 0.12 },
    { druh: 'trasa', body: [[2, 4], [4, 1], [4, -1]] },
    { druh: 'text', x: 1, y: 2, text: 'Kancelář' },
    { druh: 'znacka', x: 9, y: 7, znacka: 'dzp-001' },
  ] }, k);
  assert.equal(r.zmena, true);
  assert.equal(r.vysledek.pridano, 6);
  assert.equal(r.vysledek.chyby, undefined);
  const [d, s1] = r.vysledek.id.map((id) => P.najdi(k.v.prvky, id));
  assert.equal(d.stenaId, s1.id, 'dveře se připojily k obvodové stěně');
  close(d.x, 4); close(d.y, 0);
  assert.equal(d.typ, 'jednokridle'); assert.equal(d.typAuto, true);
  assert.equal(s1.tloustkaM, 0.4);
  const vrstvy = Object.fromEntries(k.v.prvky.map((p) => [p.druh, p.vrstva]));
  assert.deepEqual(vrstvy, { dvere: 'zaklad', stena: 'zaklad', trasa: 'trasy', text: 'popisky', znacka: 'znacky' });
  const zn = k.v.prvky.find((p) => p.druh === 'znacka');
  assert.equal(zn.znackaId, 'DZP-001'); assert.equal(zn.velikost, 8);
  assert.equal(k.v.prvky.find((p) => p.druh === 'text').vyska, 3);
  assert.deepEqual(k.v.legenda, ['DZP-001'], 'legenda se synchronizuje');
  // vykreslení listu s nakreslenými prvky projde a obsahuje je
  const svg = renderListu(k.v, { znacky: k.katalog, symbolHref: () => 'data:image/png;base64,', prilohy: {} });
  for (const druh of ['stena', 'dvere', 'trasa', 'text', 'znacka']) assert.match(svg, new RegExp(`data-druh="${druh}"`));
});

test('kresli: chybné prvky se přeskočí a nahlásí, ostatní se nakreslí; vzdálené dveře zůstanou volně s upozorněním', () => {
  const k = kontext();
  const r = A.provedNastroj('kresli', { prvky: [
    { druh: 'stena', body: [[0, 0], [6, 0]] },
    { druh: 'stena', body: [[1, 1]] },                       // málo bodů
    { druh: 'znacka', x: 1, y: 1, znacka: 'XYZ-1' },          // neznámá značka
    { druh: 'kruh', x: 1 },                                    // neznámý druh
    { druh: 'text', x: 'a', y: 1, text: 'x' },                 // není číslo
    { druh: 'cara', body: [[0, 0], [1, 1]], barva: 'fialova' }, // neznámá barva
    { druh: 'dvere', x: 3, y: 5 },                             // 5 m od stěny
    { druh: 'cara', body: [[0, 2], [6, 2]], barva: 'cervena', styl: 'carkovana' },
  ] }, k);
  assert.equal(r.vysledek.pridano, 3);
  assert.equal(r.vysledek.chyby.length, 5);
  assert.match(r.vysledek.chyby.join('\n'), /prvky\[1\].*aspoň 2/);
  assert.match(r.vysledek.chyby.join('\n'), /prvky\[2\].*XYZ-1.*není v katalogu/);
  assert.match(r.vysledek.chyby.join('\n'), /prvky\[3\].*neznámý druh/);
  assert.match(r.vysledek.chyby.join('\n'), /prvky\[5\].*neznámá barva/);
  assert.deepEqual(r.vysledek.id.map((x) => x === null), [false, true, true, true, true, true, false, false]);
  const d = k.v.prvky.find((p) => p.druh === 'dvere');
  assert.equal(d.stenaId, null); close(d.x, 3); close(d.y, 5);
  assert.match(r.vysledek.upozorneni.join('\n'), /prvky\[6\].*volně/);
  assert.equal(k.v.prvky.find((p) => p.druh === 'cara').barva, '#d62b1f');
});

test('kresli: celé volání bez prvků je chyba (Claude dostane zprávu), ostatní hodnoty se ořežou do mezí', () => {
  const k = kontext();
  assert.throws(() => A.provedNastroj('kresli', {}, k), /chybí pole „prvky“/);
  assert.throws(() => A.provedNastroj('kresli', { prvky: Array(601).fill({ druh: 'text', x: 0, y: 0, text: 'a' }) }, k), /nejvýš 600/);
  assert.throws(() => A.provedNastroj('neznamy', {}, k), /Neznámý nástroj/);
  const r = A.provedNastroj('kresli', { prvky: [{ druh: 'znacka', x: 1, y: 1, znacka: 'DZP-007', velikost: 900 }, { druh: 'text', x: 1, y: 1, text: '  A\r\nB ', vyska: 0.3 }] }, k);
  assert.equal(r.vysledek.pridano, 2);
  assert.equal(k.v.prvky[0].velikost, 500);
  assert.equal(k.v.prvky[1].vyska, 1); assert.equal(k.v.prvky[1].text, 'A\nB');
  const r2 = A.provedNastroj('kresli', { prvky: [{ druh: 'stena', body: [[0, 0], [1e6, 0]] }] }, k);
  assert.equal(r2.vysledek.pridano, 0); assert.match(r2.vysledek.chyby[0], /mimo rozsah/);
});

test('kresli: obdélník zadaný levým horním rohem, elipsa, plocha; upozornění na prvky mimo rám', () => {
  const k = kontext();
  const R = A.ramSvet(k.v);
  close(R.x1 - R.x0, 27.7); close(R.y1 - R.y0, 16.6);   // A4 na šířku 1 : 100 → rám 277 × 166 mm
  const r = A.provedNastroj('kresli', { prvky: [
    { druh: 'obdelnik', x: 2, y: 3, w: 4, h: 2, vypln: 'zluta' },
    { druh: 'elipsa', cx: 10, cy: 10, rx: 1, ry: 2 },
    { druh: 'plocha', body: [[0, 0], [2, 0], [2, 2]], vypln: null },
  ] }, k);
  const [o, e, pl] = r.vysledek.id.map((id) => P.najdi(k.v.prvky, id));
  close(o.cx, 4); close(o.cy, 4); assert.equal(o.vypln, '#f2d200');
  close(e.ry, 2); assert.equal(pl.vypln, null); assert.equal(pl.vrstva, 'komunikace');
  assert.equal(r.vysledek.upozorneni, undefined, 'vše uvnitř rámu');
  const r2 = A.provedNastroj('kresli', { prvky: [{ druh: 'stena', body: [[0, 0], [60, 0]] }] }, k);
  assert.match(r2.vysledek.upozorneni[0], /mimo rám/);
  assert.equal(A.mimoRam(k.v, r2.nove), true);
});

test('evakuační plán: bez nástupní plochy, s bodem „Jste zde“ a jen se značkami evakuačního katalogu', () => {
  const k = kontext('evak_plan');
  const r = A.provedNastroj('kresli', { prvky: [
    { druh: 'plocha', body: [[0, 0], [1, 0], [1, 1]] },
    { druh: 'jstezde', x: 5, y: 6, text: 'Jste zde – recepce' },
    { druh: 'znacka', x: 2, y: 2, znacka: 'EVAK-002' },
    { druh: 'znacka', x: 2, y: 2, znacka: 'DZP-001' },
  ] }, k);
  assert.equal(r.vysledek.pridano, 2);
  assert.match(r.vysledek.chyby[0], /nepatří/); assert.match(r.vysledek.chyby[1], /DZP-001.*není v katalogu/);
  assert.deepEqual({ x: k.v.evakPlan.jsteZde.x, y: k.v.evakPlan.jsteZde.y, t: k.v.evakPlan.jsteZde.text }, { x: 5, y: 6, t: 'Jste zde – recepce' });
  const dzp = kontext('pudorys');
  assert.match(A.provedNastroj('kresli', { prvky: [{ druh: 'jstezde', x: 1, y: 1 }] }, dzp).vysledek.chyby[0], /jen na list evakuačního plánu/);
  assert.throws(() => A.provedNastroj('nastav_list', { severka: 10 }, k), /severku nemá/);
});

test('uprav: posun, text, obdélník (levý horní roh), dveře přesunuté na jinou stěnu, atomicita a zamčená vrstva', () => {
  const k = kontext();
  const { id } = A.provedNastroj('kresli', { prvky: [
    { druh: 'stena', body: [[0, 0], [10, 0]] }, { druh: 'stena', body: [[0, 5], [10, 5]] },
    { druh: 'dvere', x: 2, y: 0 }, { druh: 'text', x: 1, y: 1, text: 'A' }, { druh: 'obdelnik', x: 0, y: 0, w: 2, h: 2 },
  ] }, k).vysledek;
  const [s1, s2, d, t, o] = id.map((x) => P.najdi(k.v.prvky, x));
  const r = A.provedNastroj('uprav', { zmeny: [
    { id: t.id, text: 'Sklad', posun: [1, 1], vyska: 4 },
    { id: d.id, x: 7, y: 5.2, sirka: 1.5 },
    { id: o.id, w: 4 },
    { id: s1.id, x: 3 },                                   // stěna nemá x – chyba, stěna beze změny
    { id: 'nic', text: 'x' },
  ] }, k);
  assert.equal(r.vysledek.upraveno, 3);
  assert.equal(r.vysledek.chyby.length, 2);
  assert.equal(t.text, 'Sklad'); close(t.x, 2); close(t.y, 2); assert.equal(t.vyska, 4);
  assert.equal(d.stenaId, s2.id); close(d.x, 7); close(d.y, 5); assert.equal(d.typ, 'dvoukridle');
  close(o.cx, 2); close(o.w, 4);                           // levý horní roh (0,0) zůstal
  assert.deepEqual(s1.body, [[0, 0], [10, 0]]);
  // chyba uprostřed změny nesmí prvek změnit napůl
  const r2 = A.provedNastroj('uprav', { zmeny: [{ id: t.id, text: 'Nové', barva: 'nesmysl' }] }, k);
  assert.equal(r2.vysledek.upraveno, 0); assert.equal(t.text, 'Sklad');
  // zamčená vrstva
  k.v.vrstvy.find((l) => l.id === 'popisky').zamcena = true;
  assert.match(A.provedNastroj('uprav', { zmeny: [{ id: t.id, text: 'X' }] }, k).vysledek.chyby[0], /zamčené vrstvě/);
  assert.match(A.provedNastroj('smaz', { id: [t.id] }, k).vysledek.chyby[0], /zamčené vrstvě/);
  assert.ok(P.najdi(k.v.prvky, t.id));
  // otočení kolem středu prvku
  A.provedNastroj('uprav', { zmeny: [{ id: s2.id, otoceni: 90 }] }, k);
  close(s2.body[0][0], 5); close(s2.body[0][1], 0); close(s2.body[1][1], 10);
});

test('smaz: prvky zmizí, dveře na smazané stěně zůstanou volně, neexistující id se nahlásí', () => {
  const k = kontext();
  const { id } = A.provedNastroj('kresli', { prvky: [{ druh: 'stena', body: [[0, 0], [10, 0]] }, { druh: 'dvere', x: 5, y: 0 }, { druh: 'text', x: 0, y: 3, text: 'a' }] }, k).vysledek;
  const r = A.provedNastroj('smaz', { id: [id[0], id[2], 'e_neni'] }, k);
  assert.equal(r.vysledek.smazano, 2); assert.equal(r.vysledek.chyby.length, 1);
  assert.equal(k.v.prvky.length, 1);
  const d = k.v.prvky[0]; assert.equal(d.stenaId, null); close(d.x, 5);
  assert.throws(() => A.provedNastroj('smaz', {}, k), /chybí pole „id“/);
});

test('nastav_list: přizpůsobení rámu obsahu, změna měřítka se zachováním středu, severka', () => {
  const k = kontext();
  A.provedNastroj('kresli', { prvky: [{ druh: 'stena', body: [[100, 100], [160, 100], [160, 140]] }] }, k);
  const r = A.provedNastroj('nastav_list', { prizpusobit: true }, k);
  assert.ok(P.MERITKA.includes(k.v.meritko.pomer));
  assert.equal(A.mimoRam(k.v, k.v.prvky.map((p) => p.id)), false, 'po přizpůsobení je vše v rámu');
  assert.equal(r.vysledek.meritko, k.v.meritko.pomer);
  const R0 = A.ramSvet(k.v), c0 = [(R0.x0 + R0.x1) / 2, (R0.y0 + R0.y1) / 2];
  A.provedNastroj('nastav_list', { meritko: 500, severka: -90 }, k);
  const R1 = A.ramSvet(k.v);
  close((R1.x0 + R1.x1) / 2, c0[0]); close((R1.y0 + R1.y1) / 2, c0[1]);
  assert.equal(k.v.severka.uhel, 270);
  assert.throws(() => A.provedNastroj('nastav_list', { meritko: 123 }, k), /povolená měřítka/);
  assert.throws(() => A.provedNastroj('nastav_list', {}, k), /nic ke změně/);
});

test('precti_vykres a popis stavu: stránkování, filtr druhu, zkrácený výpis', () => {
  const k = kontext();
  A.provedNastroj('kresli', { prvky: Array.from({ length: 450 }, (_, i) => ({ druh: 'text', x: i % 20, y: Math.floor(i / 20), text: `Místnost ${i}` })) }, k);
  A.provedNastroj('kresli', { prvky: [{ druh: 'stena', body: [[0, 0], [5, 0]] }] }, k);
  const s1 = A.provedNastroj('precti_vykres', {}, k).vysledek;
  assert.equal(s1.celkem, 451); assert.equal(s1.prvky.length, 300); assert.equal(s1.dalsi_od, 300);
  const s2 = A.provedNastroj('precti_vykres', { od: s1.dalsi_od }, k).vysledek;
  assert.equal(s2.prvky.length, 151); assert.equal(s2.dalsi_od, null);
  assert.ok(JSON.stringify(s1).length < 32000, 'výsledek nástroje je pod limitem 32 KB');
  assert.equal(A.provedNastroj('precti_vykres', { druh: 'stena' }, k).vysledek.celkem, 1);
  const popis = A.popisStavu(k, { limit: 5000 });
  assert.match(popis, /Rám výkresu .*x od 0 do 27\.7 m/);
  assert.match(popis, /Vrstvy \(zdola nahoru\): zaklad = Stavby/);
  assert.match(popis, /… a dalších \d+ prvků \(vypíše je nástroj precti_vykres s parametrem od = \d+\)/);
  assert.ok(popis.length < 5200);
  assert.match(A.popisStavu(kontext()), /list je prázdný/);
});

test('definice nástrojů a pokyny dodrží limity platformy (popis ≤ 1 KB, schéma ≤ 4 KB, zadání ≤ 256 KiB)', () => {
  for (const k of [kontext(), kontext('evak_plan'), kontext('situace')]) {
    const defs = A.definiceNastroju(k);
    assert.ok(defs.length <= 8);
    for (const d of defs) {
      assert.match(d.name, /^[A-Za-z0-9_-]{1,128}$/);
      assert.ok(bajty(d.description) <= 1024, `${d.name}: popis ${bajty(d.description)} B`);
      assert.ok(bajty(JSON.stringify(d.inputSchema)) <= 4096, `${d.name}: schéma ${bajty(JSON.stringify(d.inputSchema))} B`);
      assert.equal(d.inputSchema.type, 'object');
    }
    const druhy = defs[0].inputSchema.properties.prvky.items.properties.druh.enum;
    assert.equal(druhy.includes('plocha'), !k.evak); assert.equal(druhy.includes('jstezde'), k.evak);
    const zadani = A.pokyny(k) + A.popisStavu(k);
    assert.ok(bajty(zadani) < 100 * 1024);
    assert.match(zadani, /PRAVDIVOST/);
    assert.match(zadani, k.evak ? /EVAK-002 Shromaždiště/ : /DZP-001 Nadzemní požární hydrant/);
  }
  assert.match(A.pokyny(kontext('evak_plan')), /jstezde/);
  assert.doesNotMatch(A.pokyny(kontext()), /jstezde/);
});

test('pomocná mřížka pro obrázek listu: celé kroky v metrech s popisky, jen v rámu', () => {
  const k = kontext();
  const svg = A.mrizkaSvg(k.v);
  assert.match(svg, /data-mrizka-ai="1"/);
  assert.match(svg, />x 0</); assert.match(svg, />x 26</); assert.match(svg, />y 16</);   // rám 27,7 × 16,6 m → krok 2 m
  assert.doesNotMatch(svg, />x 28</);
  k.v.meritko.pomer = 1000; k.v.okno = { x: -3.3, y: 0 };
  assert.match(A.mrizkaSvg(k.v), />x 0</);
  assert.doesNotMatch(A.mrizkaSvg(k.v), /NaN/);
});

// ---------- opravy po revizi ----------
test('uprav: nová geometrie stěny drží dveře na místě (v metrech), vzdálené dveře se odpojí s upozorněním', () => {
  const k = kontext();
  const { id } = A.provedNastroj('kresli', { prvky: [{ druh: 'stena', body: [[0, 0], [10, 0], [10, 8]] }, { druh: 'dvere', x: 5, y: 0 }, { druh: 'dvere', x: 10, y: 4 }] }, k).vysledek;
  const [s, d1, d2] = id.map((x) => P.najdi(k.v.prvky, x));
  assert.equal(d2.seg, 1);
  // prodloužení stěny na začátku a vložení vrcholu: dveře zůstanou na (5,0) a (10,4)
  const r = A.provedNastroj('uprav', { zmeny: [{ id: s.id, body: [[-5, 0], [7, 0], [10, 0], [10, 8]] }] }, k);
  assert.equal(r.vysledek.upraveno, 1);
  close(d1.x, 5); close(d1.y, 0); close(d2.x, 10); close(d2.y, 4);
  assert.equal(d1.stenaId, s.id); assert.equal(d2.stenaId, s.id); assert.equal(d2.seg, 2);
  // stěna úplně jinde: dveře zůstanou volně na svém místě
  const r2 = A.provedNastroj('uprav', { zmeny: [{ id: s.id, body: [[0, 30], [10, 30]] }] }, k);
  assert.equal(d1.stenaId, null); close(d1.x, 5); close(d1.y, 0);
  assert.match(r2.vysledek.upozorneni.join('\n'), /po změně stěny nejsou u stěny/);
});

test('uprav dveří: přesun daleko od stěn je odpojí (ne posun po staré stěně); úhel připojených dveří nejde; otevira_k určí stranu', () => {
  const k = kontext();
  const { id } = A.provedNastroj('kresli', { prvky: [{ druh: 'stena', body: [[0, 0], [10, 0]] }, { druh: 'dvere', x: 2, y: 0, otevira_k: [2, -3] }] }, k).vysledek;
  const d = P.najdi(k.v.prvky, id[1]);
  assert.equal(d.smer, -1, 'stěna kreslená zleva doprava: křídlo nahoru (y −) = smer −1');
  A.provedNastroj('uprav', { zmeny: [{ id: d.id, otevira_k: [2, 3] }] }, k);
  assert.equal(d.smer, 1);
  assert.match(A.provedNastroj('uprav', { zmeny: [{ id: d.id, uhel: 45 }] }, k).vysledek.chyby[0], /úhel připojených dveří určuje stěna/);
  const r = A.provedNastroj('uprav', { zmeny: [{ id: d.id, x: 20, y: 15 }] }, k);
  assert.equal(d.stenaId, null); close(d.x, 20); close(d.y, 15);
  assert.match(r.vysledek.upozorneni[0], /není do 1 m žádná stěna/);
});

test('nepoužitelné vlastnosti: uprav je odmítne celé (prvek beze změny), kresli je ohlásí s radou', () => {
  const k = kontext();
  const { id } = A.provedNastroj('kresli', { prvky: [{ druh: 'text', x: 1, y: 1, text: 'A', velikost: 5 }, { druh: 'znacka', x: 2, y: 2, znacka: 'DZP-001', vyska: 12 }, { druh: 'stena', body: [[0, 0], [3, 0]], tloustka_mm: 150 }] }, k).vysledek;
  const r0 = A.provedNastroj('kresli', { prvky: [{ druh: 'text', x: 1, y: 1, text: 'B', velikost: 5, foo: 1 }] }, k).vysledek;
  assert.match(r0.upozorneni.join('\n'), /„velikost“ u druhu text nejde \(u textu je výška písma „vyska“\)/);
  assert.match(r0.upozorneni.join('\n'), /neznámé vlastnosti foo/);
  const [t, z, s] = id.map((x) => P.najdi(k.v.prvky, x));
  assert.equal(t.vyska, 3); assert.equal(z.velikost, 8); assert.equal(s.tloustkaM, 0.3);
  const r = A.provedNastroj('uprav', { zmeny: [{ id: t.id, text: 'Nový', w: 5 }, { id: s.id, cx: 3 }, { id: z.id, barva: 'cervena' }] }, k).vysledek;
  assert.equal(r.upraveno, 0); assert.equal(r.chyby.length, 3);
  assert.equal(t.text, 'A', 'chybná změna nezmění ani platné části');
  assert.match(r.chyby[1], /polohu změň přes body nebo posun/);
});

test('vrstvy: do zamčené vrstvy se nekreslí (výchozí se nahradí odemčenou, zadaná je chyba), skrytá se ohlásí', () => {
  const k = kontext();
  k.v.vrstvy.find((l) => l.id === 'zaklad').zamcena = true;
  k.v.vrstvy.find((l) => l.id === 'popisky').viditelna = false;
  const r = A.provedNastroj('kresli', { prvky: [{ druh: 'stena', body: [[0, 0], [3, 0]] }, { druh: 'stena', body: [[0, 1], [3, 1]], vrstva: 'zaklad' }, { druh: 'text', x: 1, y: 1, text: 'A' }, { druh: 'text', x: 1, y: 2, text: 'B', vrstva: 'popisky' }] }, k).vysledek;
  assert.equal(r.pridano, 3);
  const [s, , t, t2] = r.id.map((x) => x && P.najdi(k.v.prvky, x));
  assert.notEqual(s.vrstva, 'zaklad'); assert.notEqual(t.vrstva, 'popisky'); assert.equal(t2.vrstva, 'popisky');
  assert.match(r.chyby[0], /je zamčená/); assert.match(r.upozorneni.join('\n'), /je skrytá/);
  for (const l of k.v.vrstvy) l.zamcena = true;
  assert.match(A.provedNastroj('kresli', { prvky: [{ druh: 'text', x: 1, y: 1, text: 'C' }] }, k).vysledek.chyby[0], /všechny vrstvy jsou zamčené nebo skryté/);
});

test('„Jste zde“ jde přes uprav přesunout a přes smaz odebrat (id jstezde)', () => {
  const k = kontext('evak_plan');
  assert.deepEqual(A.provedNastroj('kresli', { prvky: [{ druh: 'jstezde', x: 5, y: 6 }] }, k).vysledek.id, ['jstezde']);
  assert.match(A.popisStavu(k), /„Jste zde“ \(id jstezde\): x 5, y 6/);
  assert.equal(A.provedNastroj('uprav', { zmeny: [{ id: 'jstezde', posun: [1, 0], text: 'Recepce' }] }, k).vysledek.upraveno, 1);
  assert.equal(k.v.evakPlan.jsteZde.x, 6); assert.equal(k.v.evakPlan.jsteZde.text, 'Recepce'); assert.equal(k.v.evakPlan.jsteZde.dx, 22);
  assert.equal(A.provedNastroj('smaz', { id: ['jstezde'] }, k).vysledek.smazano, 1);
  assert.equal(k.v.evakPlan.jsteZde, null);
});

test('nastav_list je atomický: chyba v jednom poli nezmění nic', () => {
  const k = kontext(), pred = P.snimek(k.v);
  assert.throws(() => A.provedNastroj('nastav_list', { orientace: 'na_vysku', meritko: 150 }, k), /povolená měřítka/);
  assert.throws(() => A.provedNastroj('nastav_list', { meritko: 200, severka: 'sever' }, k), /chybí číslo/);
  assert.equal(P.snimek(k.v), pred);
  const ke = kontext('evak_plan'), prede = P.snimek(ke.v);
  assert.throws(() => A.provedNastroj('nastav_list', { orientace: 'na_vysku', severka: 10 }, ke), /severku nemá/);
  assert.equal(P.snimek(ke.v), prede);
});

test('výsledek nástroje je pod 32 KB: stejné chyby se sloučí, i dlouhé české texty se počítají v bajtech', () => {
  const k = kontext();
  const r = A.provedNastroj('kresli', { prvky: [...Array.from({ length: 300 }, (_, i) => ({ druh: 'stena', body: [[i, 0], [i, 1]] })), ...Array.from({ length: 300 }, (_, i) => ({ druh: 'text', x: 1, y: 1, text: 'x', barva: `fialová${i % 3}` }))] }, k).vysledek;
  assert.ok(A.bajty(r) < 30000, `${A.bajty(r)} B`);
  assert.equal(r.pridano, 300);
  assert.ok(r.chyby.length <= 4, 'sloučené podle textu');
  assert.match(r.chyby[0], /^prvky\[300, 303, 306, .* a dalších \d+\]\.barva: neznámá barva/);
  const u = A.provedNastroj('uprav', { zmeny: k.v.prvky.slice(0, 300).map((p) => ({ id: p.id, barva: 'nesmysl' })) }, k).vysledek;
  assert.ok(A.bajty(u) < 30000);
  const kt = kontext();
  A.provedNastroj('kresli', { prvky: Array.from({ length: 300 }, (_, i) => ({ druh: 'text', x: i % 20, y: 1, text: `Přípravna žíravin a hořlavých kapalin č. ${i} – ${'ř'.repeat(150)}` })) }, kt);
  const s = A.provedNastroj('precti_vykres', {}, kt).vysledek;
  assert.ok(A.bajty(s) < 32000, `${A.bajty(s)} B`); assert.ok(s.dalsi_od > 0);
});

test('barvy i s diakritikou, v jiném rodě a anglicky; minimum písma a značek v evakuačním plánu', () => {
  const k = kontext();
  const { id } = A.provedNastroj('kresli', { prvky: ['žlutá', 'červený', 'black', 'Modrá', '#abc'].map((b) => ({ druh: 'cara', body: [[0, 0], [1, 1]], barva: b })) }, k).vysledek;
  assert.deepEqual(id.map((x) => P.najdi(k.v.prvky, x).barva), ['#f2d200', '#d62b1f', '#000000', '#1e5fd0', '#abc']);
  const ke = kontext('evak_plan');
  const r = A.provedNastroj('kresli', { prvky: [{ druh: 'text', x: 1, y: 1, text: 'Sklad', vyska: 2.5 }, { druh: 'znacka', x: 2, y: 2, znacka: 'EVAK-002', velikost: 5 }] }, ke).vysledek;
  const [t, z] = r.id.map((x) => P.najdi(ke.v.prvky, x));
  assert.equal(t.vyska, 2.9); assert.equal(z.velikost, 7);
  assert.equal(r.upozorneni.length, 2);
  assert.match(A.pokyny(ke), /písmo aspoň 2,9 mm/);
});

test('zóny legendy a přehledového plánu v popisu listu; pojistka rámu nejdřív centruje a měřítko nezvětší', () => {
  const k = kontext();
  assert.match(A.popisStavu(k), /nech volno pro legendu značek \(objeví se s první značkou\): x 19\.3 až 27\.5 m, y 12\.2 až 16\.4 m/);
  A.provedNastroj('kresli', { prvky: [{ druh: 'znacka', x: 5, y: 5, znacka: 'DZP-001' }] }, k);
  assert.match(A.popisStavu(k), /nech volno pro legendu značek: x/);
  // uživatel má 1 : 200; budova je mimo rám, ale po vycentrování se vejde – měřítko zůstane
  const k2 = kontext(); k2.v.meritko.pomer = 200;
  A.provedNastroj('kresli', { prvky: [{ druh: 'stena', body: [[-14, 0], [-2, 0], [-2, 8], [-14, 8], [-14, 0]] }] }, k2);
  assert.equal(A.mimoRam(k2.v, k2.v.prvky.map((p) => p.id)), true);
  assert.deepEqual(A.vejdiSeDoRamu(k2.v), { pomer: 200, zmenaMeritka: false });
  assert.equal(A.mimoRam(k2.v, k2.v.prvky.map((p) => p.id)), false);
  // nevejde se ani po vycentrování: menší měřítko
  const k3 = kontext();
  A.provedNastroj('kresli', { prvky: [{ druh: 'stena', body: [[0, 0], [80, 0], [80, 40]] }] }, k3);
  assert.deepEqual(A.vejdiSeDoRamu(k3.v), { pomer: 500, zmenaMeritka: true });
  const ke = kontext('evak_plan'); ke.v.evakPlan.prehled = 'ano';
  A.provedNastroj('kresli', { prvky: [{ druh: 'stena', body: [[0, 0], [5, 0]] }] }, ke);
  assert.match(A.popisStavu(ke), /nech volno pro přehledový plán/);
});

test('mřížka se škáluje s formátem listu (čitelná i na A0)', () => {
  const v4 = novyList('pudorys').vykres, v0 = novyList('evak_plan').vykres; v0.format = 'A0';
  const vel = (svg) => Number(/font-size="([\d.]+)"/.exec(svg)[1]);
  assert.ok(Math.abs(vel(A.mrizkaSvg(v4)) - 2.6) < 0.2, `A4: ${vel(A.mrizkaSvg(v4))}`);
  assert.ok(vel(A.mrizkaSvg(v0)) > 7, `A0: ${vel(A.mrizkaSvg(v0))}`);
});
