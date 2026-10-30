// Opravy z revize editoru, importu a ukládání: snímek celého listu (undo i uložení), převod čára ↔ stěna, pořadí kreslení,
// kopie listu s dveřmi, kalibrace vektorového importu, vrstvy importu dospod, očista importovaného projektu (XSS),
// legenda a razítko listu DZP, DXF v OCS (zrcadlení), MINSERT, zarovnaný text.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import * as P from '../js/kresleni/prvky.js';
import { renderListu, rozlozeniLegendy, prekryvaLegenda, udajeRazitka, zalomDoBunky, sirkaTextu } from '../js/kresleni/render.js';
import { vlozVektor, kalibrujVektor } from '../js/kresleni/import/index.js';
import { nactiDxf, bboxPrimitiv } from '../js/kresleni/import/dxf.js';
import { ocistiProjekt } from '../js/ocista.js';

const close = (a, b, e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${a} ≉ ${b}`);
const o = (extra = {}) => ({ objektNazev: 'Hala', nazevListu: 'Situace', typListu: 'situace', znacky: new Map([['Z1', { nazev: 'Hydrant' }], ['Z2', { nazev: 'Uzávěr plynu' }]]), symbolHref: (id) => `znacky/png/${id}.png`, prilohy: {}, ...extra });

test('snímek obsahuje celý list: změna orientace, razítka, severky, sítě, legendy a měřítka importu se pozná, undo ji vrátí', () => {
  const v = M.novyList('situace').vykres, H = new P.Historie(P.snimek(v));
  for (const zmena of [() => { v.orientace = 'na_vysku'; }, () => { v.razitko.zpracoval = 'Jan'; }, () => { v.severka.uhel = 30; }, () => { v.sit10m = false; }, () => { v.legendaZobrazit = false; }, () => { v.legendaPoloha = 'vlevo-dole'; }, () => { v.meritkoZdroj = { overeno: true, zdroj: 'x', popis: 'x' }; }]) {
    zmena(); assert.equal(H.push(P.snimek(v)), true, String(zmena));
  }
  v.legenda = ['Z1']; assert.equal(H.push(P.snimek(v)), false, 'odvozená legenda není změna');
  for (let i = 0; i < 7; i++) P.obnovZeSnimku(v, H.undo());
  assert.equal(v.orientace, 'na_sirku'); assert.equal(v.razitko.zpracoval, ''); assert.equal(v.severka.uhel, null); assert.equal(v.sit10m, true);
  assert.equal(v.legendaZobrazit, true); assert.equal(v.legendaPoloha, 'vpravo-dole'); assert.equal(v.meritkoZdroj, null);
  assert.equal(P.snimek(v), H.s[0], 'stejný stav → stejný text snímku');
});

test('undo po kalibraci vektorového importu vrátí i neověřené měřítko', () => {
  const v = M.novyList('pudorys').vykres;
  vlozVektor(v, { prvky: [P.novyPrvek('trasa', { body: [[0, 0], [4, 0]], vrstva: 'trasy' })], vrstvy: [], meritko: { overeno: false, zdroj: 'dxf-odhad', popis: 'mm' } });
  const H = new P.Historie(P.snimek(v));
  kalibrujVektor(v, [0, 0], [4, 0], 40); H.push(P.snimek(v));
  close(P.delkaTrasy(v.prvky[0]), 40); assert.ok(P.meritkoOvereno(v));
  P.obnovZeSnimku(v, H.undo());
  close(P.delkaTrasy(v.prvky[0]), 4); assert.equal(P.meritkoOvereno(v), false);
});

test('historie: limit velikosti snímků a zahození kroku zrušeného gesta', () => {
  const h = new P.Historie('a'.repeat(10), { maxZnaku: 35 });
  h.push('b'.repeat(10)); h.push('c'.repeat(10)); h.push('d'.repeat(10));
  assert.equal(h.s.length, 3); assert.equal(h.s[0][0], 'b'); assert.equal(h.znaku, 30);
  const g = new P.Historie('x'); g.push('y');
  assert.equal(g.zahodPosledni('x'), 'x'); assert.equal(g.lzeZpet, false); assert.equal(g.lzeVpred, false);
  assert.equal(g.zahodPosledni('x'), null, 'nic dalšího se nezahodí');
});

test('převod čára ↔ stěna zachová body, barvu a vrstvu', () => {
  const c = P.novyPrvek('cara', { body: [[0, 0], [5, 0]], barva: '#d62b1f', vrstva: 'zaklad' });
  P.prevedPrvek(c, 'stena');
  assert.equal(c.druh, 'stena'); assert.equal(c.tloustkaM, 0.3); assert.equal(c.tloustka, undefined); assert.deepEqual(c.body, [[0, 0], [5, 0]]); assert.equal(c.barva, '#d62b1f');
  const d = { ...P.novyPrvek('cara', { body: [[0, 0], [1, 0]] }), puvod: 'dxf' }; P.prevedPrvek(d, 'stena'); assert.equal(d.tloustkaM, 0.05, 'import → tenká stěna');
  P.prevedPrvek(c, 'cara'); assert.equal(c.druh, 'cara'); assert.equal(c.tloustkaM, undefined); assert.equal(c.styl, 'plna');
  assert.throws(() => P.prevedPrvek(P.novyPrvek('text', {}), 'stena'));
});

test('pořadí vykreslení podle vrstev; posun v pořadí jen ve stejné vrstvě', () => {
  const v = M.novyList('situace').vykres;
  const zn = P.novyPrvek('znacka', { x: 0, y: 0, znackaId: 'Z1', vrstva: 'znacky' }), pl = P.novyPrvek('plocha', { body: [[-5, -5], [5, -5], [5, 5]], vrstva: 'komunikace' }), os = P.novyPrvek('cara', { body: [[0, 0], [1, 1]], vrstva: 'neni' });
  v.prvky.push(zn, pl, os);
  assert.deepEqual(P.poradiVykresleni(v).map((p) => p.id), [pl.id, zn.id, os.id], 'plocha (spodní vrstva) pod značkou, osiřelý navrch');
  const a = P.novyPrvek('cara', { body: [[0, 0], [1, 0]] }), b = P.novyPrvek('text', { x: 0, y: 0, text: 't', vrstva: 'popisky' }), c = P.novyPrvek('cara', { body: [[0, 0], [2, 0]] });
  const prvky = [a, b, c];
  assert.equal(P.posunVPoradi(prvky, a, 1), true); assert.deepEqual(prvky, [c, b, a], 'přeskočí prvek jiné vrstvy');
  assert.equal(P.posunVPoradi(prvky, a, 1), false);
});

test('kopie listu: dveře zůstanou připojené ke zkopírované stěně', () => {
  const p = M.novyProjekt(), l = p.listy.find((x) => x.typ === 'situace'), v = l.vykres;
  const st = P.novyPrvek('stena', { body: [[0, 0], [10, 0]] }), d = P.novyPrvek('dvere', { x: 5, y: 0 });
  v.prvky.push(st, d); P.pripojDvere(d, v.prvky, [5, 0], 1);
  const k = M.kopirujList(p, l.id), ks = k.vykres.prvky.find((x) => x.druh === 'stena'), kd = k.vykres.prvky.find((x) => x.druh === 'dvere');
  assert.notEqual(ks.id, st.id); assert.equal(kd.stenaId, ks.id);
  P.obnovDvere(k.vykres.prvky); assert.equal(kd.stenaId, ks.id);
  assert.equal(d.stenaId, st.id, 'originál beze změny');
});

test('kalibrace vektorového importu: velikosti v mm na papíře zůstanou, text z importu má správnou skutečnou výšku', () => {
  const v = M.novyList('situace').vykres;
  vlozVektor(v, { prvky: [
    { id: 'a', druh: 'cara', vrstva: 'dxf_x', puvod: 'dxf', body: [[0, 0], [4, 0]], tloustka: 0.25, barva: '#000000', styl: 'plna' },
    { id: 'b', druh: 'cara', vrstva: 'dxf_x', puvod: 'dxf', body: [[0, 0], [0, 2]], tloustka: 0.25, barva: '#000000', styl: 'plna' },
    { id: 't', druh: 'text', vrstva: 'dxf_x', puvod: 'dxf', x: 1, y: 1, text: 'Sklad', vyska: 3, vyskaM: 0.25, uhel: 0, barva: '#000000' },
  ], vrstvy: [{ id: 'dxf_x', nazev: 'DXF: x', viditelna: true, zamcena: false }], meritko: { overeno: false, zdroj: 'dxf-odhad', popis: 'mm' } });
  const st = P.novyPrvek('stena', { body: [[0, 3], [4, 3]] }), d = P.novyPrvek('dvere', { x: 2, y: 3 });
  v.prvky.push(P.novyPrvek('znacka', { x: 2, y: 1, znackaId: 'Z1', velikost: 8 }), P.novyPrvek('text', { x: 0, y: 2, text: 'popisek', vyska: 3 }), st, d);
  P.pripojDvere(d, v.prvky, [2, 3], 1);
  const t = v.prvky.find((x) => x.id === 't'), pop = v.prvky.find((x) => x.text === 'popisek');
  close(P.mmNaM(t.vyska, v.meritko.pomer), 0.25);
  kalibrujVektor(v, [0, 0], [4, 0], 40);                               // skutečně 10× větší
  close(P.mmNaM(t.vyska, v.meritko.pomer), 2.5, 1e-3);
  assert.equal(v.prvky.find((x) => x.druh === 'znacka').velikost, 8); assert.equal(pop.vyska, 3);
  close(d.sirkaM, 9, 1e-9); assert.equal(d.stenaId, st.id);
});

test('import: vrstvy podkladu se vloží dospod, výplně nezakryjí trasy a značky', () => {
  const v = M.novyList('situace').vykres;
  vlozVektor(v, { prvky: [{ id: 'f', druh: 'plocha', vrstva: 'dxf_pdf', body: [[0, 0], [9, 0], [9, 9]], tloustka: 0.1, barva: '#ffffff', vypln: '#ffffff', kryti: 1 }], vrstvy: [{ id: 'dxf_pdf', nazev: 'DXF: PDF', viditelna: true, zamcena: false }, { id: 'dxf_pdf', nazev: 'duplicitní', viditelna: true, zamcena: false }], meritko: { overeno: false } });
  assert.deepEqual(v.vrstvy.map((l) => l.id), ['dxf_pdf', 'zaklad', 'komunikace', 'znacky', 'trasy', 'popisky']);
  v.prvky.push(P.novyPrvek('trasa', { body: [[1, 1], [5, 1]], vrstva: 'trasy' }));
  const svg = renderListu(v, o());
  assert.ok(svg.indexOf('data-vrstva="dxf_pdf"') < svg.indexOf('data-druh="trasa"'));
});

test('vykreslení: hodnoty z cizího souboru nemohou vložit značky do SVG (barvy, čísla, id)', () => {
  const v = M.novyList('situace').vykres, zlo = '#000"/><image href="x" onerror="alert(1)"/><x a="';
  v.prvky.push({ id: 'a"><script>', druh: 'cara', vrstva: 'zaklad', body: [[0, 0], [5, 5]], tloustka: '1"/><b x="', barva: zlo, styl: 'plna' },
    { id: 'b', druh: 'plocha', vrstva: 'zaklad', body: [[0, 0], [5, 0], [5, 5]], barva: '#000000', vypln: zlo, kryti: '1" onload="x', tloustka: 0.3 },
    { id: 'c', druh: 'cara', vrstva: 'zaklad', body: 'rozbité', barva: '#000000' });
  v.vrstvy[0].id = 'zaklad';
  v.pozadi = { prilohaId: 'p', x: 0, y: 0, sirkaPx: 10, vyskaPx: 10, mNaPx: 1, kryti: '1" onload="alert(2)', kalibrace: null };
  const svg = renderListu(v, o({ prilohy: { p: { data: 'data:image/png;base64,AAAA' } } }));
  assert.ok(!/onerror|onload|<script|<b /.test(svg), svg.slice(0, 400));
  assert.ok(svg.includes('stroke="#000000"') && svg.includes('data-id="a&quot;&gt;&lt;script&gt;"'));
});

test('očista importovaného projektu: barvy, čísla, obrázky, id a datum; platná data beze změny', () => {
  const p = M.novyProjekt({ nazev: 'X' }), puvodni = JSON.parse(M.serializuj(p));
  assert.deepEqual(ocistiProjekt(JSON.parse(M.serializuj(p))), puvodni, 'platný projekt se nezmění');
  const v = p.listy[1].vykres;
  v.prvky.push({ id: 'e1', druh: 'cara', vrstva: 'zaklad', body: [[0, 0], ['x', 1], [2, 2]], barva: 'red"><img>', tloustka: 'tlustá', styl: 'plna' },
    { druh: 'znacka', x: '5', y: 1, velikost: 9999, znackaId: 7, vrstva: 'znacky' }, 'nesmysl');
  v.vrstvy.push({ id: 'v1', nazev: 5 }); v.legendaPoloha = 'nahoře'; v.orientace = '<b>'; v.severka.uhel = 'sever'; v.meritko.pomer = -3;
  v.pozadi = { prilohaId: 'p1', nazev: 'a', x: 0, y: 0, sirkaPx: '<img src=x onerror=alert(1)>', vyskaPx: 10, mNaPx: 0.1, kryti: 2, kalibrace: 'ano' };
  p.prilohy.p1 = { nazev: 'a', mime: 'image/png', data: 'data:image/png;base64,AAAA' }; p.prilohy.p2 = { data: 'javascript:alert(1)' };
  p.evakZnacky = { 'EVAK-001': { png: '"><img src=x onerror=alert(1)>' }, 'EVAK-002': { png: 'data:image/png;base64,AAAA' } };
  delete p.zmeneno; p.vytvoreno = 5; delete p.id; p.listy[0].id = null; p.nastaveni.velikostZnacky = 'velká';
  const q = M.migruj(JSON.parse(JSON.stringify(p))), w = q.listy[1].vykres;
  assert.match(q.id, /^proj_\w+$/); assert.match(q.listy[0].id, /^list_\w+$/); assert.ok(!Number.isNaN(Date.parse(q.zmeneno)) && !Number.isNaN(Date.parse(q.vytvoreno)));
  assert.deepEqual(w.prvky[0].body, [[0, 0], [2, 2]]); assert.equal(w.prvky[0].barva, '#000000'); assert.equal(w.prvky[0].tloustka, 0.5);
  assert.match(w.prvky[1].id, /^e_/); assert.equal(w.prvky[1].x, 0); assert.equal(w.prvky[1].velikost, 500); assert.equal(w.prvky[1].znackaId, '7');
  assert.equal(w.prvky.length, 2, 'neobjekt zahozen');
  assert.deepEqual(w.vrstvy.at(-1), { id: 'v1', nazev: '5', viditelna: true, zamcena: false });
  assert.equal('legendaPoloha' in w, false); assert.equal(w.orientace, 'na_sirku'); assert.equal(w.severka.uhel, null); assert.equal(w.meritko.pomer, 1000);
  assert.deepEqual([w.pozadi.sirkaPx, w.pozadi.kryti, w.pozadi.kalibrace], [1, 1, null]);
  assert.deepEqual(Object.keys(q.prilohy), ['p1']); assert.deepEqual(Object.keys(q.evakZnacky), ['EVAK-002']); assert.equal(q.nastaveni.velikostZnacky, 8);
});

test('ukládání: seznam projektů nespadne na záznamu bez data změny; projekt bez id se neuloží', async () => {
  const U = await import('../js/ulozeni.js');
  await U.init();
  const stary = M.novyProjekt({ nazev: 'Starý' }); delete stary.zmeneno;
  await U.uloz(stary); await U.uloz(M.novyProjekt({ nazev: 'A' })); await U.uloz(M.novyProjekt({ nazev: 'B' }));
  assert.deepEqual(U.seznam().map((x) => x.nazev).slice(-1), ['Starý']);
  const r = await U.uloz({ nazev: 'bez id' }); assert.equal(r.ok, false); assert.ok(!U.seznam().some((x) => x.nazev === 'bez id'));
});

test('legenda: jen viditelné vrstvy, vždy uvnitř rámu (sloupce, zmenšení), poloha a prvky pod legendou', () => {
  const v = M.novyList('situace').vykres; v.orientace = 'na_vysku'; v.meritko.pomer = 500;
  for (let i = 0; i < 40; i++) v.prvky.push(P.novyPrvek('znacka', { x: i, y: 1, znackaId: `Z${i}`, velikost: 8, vrstva: 'znacky' }));
  const L = P.rozlozeniListu(v), uvnitr = (r) => r.x >= L.ram.x && r.y >= L.ram.y && r.x + r.w <= L.ram.x + L.ram.w + 1e-9 && r.y + r.h <= L.ram.y + L.ram.h + 1e-9;
  for (const poloha of ['vpravo-dole', 'vlevo-dole', 'vpravo-nahore', 'vlevo-nahore']) { v.legendaPoloha = poloha; const r = rozlozeniLegendy(v); assert.ok(uvnitr(r), poloha); assert.equal(r.poloha, poloha); }
  for (let i = 40; i < 150; i++) v.prvky.push(P.novyPrvek('znacka', { x: i, y: 1, znackaId: `Z${i}`, velikost: 8, vrstva: 'znacky' }));
  const r = rozlozeniLegendy(v); assert.ok(uvnitr(r) && r.k < 1, 'mnoho značek: legenda se zmenší');
  const w = M.novyList('situace').vykres;
  w.prvky.push(P.novyPrvek('znacka', { x: 1, y: 1, znackaId: 'Z1', vrstva: 'znacky' }), P.novyPrvek('znacka', { x: 2, y: 1, znackaId: 'Z2', vrstva: 'zaklad' }));
  w.vrstvy.find((l) => l.id === 'zaklad').viditelna = false;
  assert.deepEqual(rozlozeniLegendy(w).ids, ['Z1']); assert.ok(!renderListu(w, o()).includes('Uzávěr plynu'));
  const rl = rozlozeniLegendy(w), s = 1000 / w.meritko.pomer, pod = P.novyPrvek('znacka', { x: w.okno.x + (rl.x + rl.w / 2 - L.ram.x) / s, y: w.okno.y + (rl.y + rl.h / 2 - 10) / s, znackaId: 'Z1', vrstva: 'znacky' });
  w.prvky.push(pod); assert.deepEqual(prekryvaLegenda(w), [pod.id]);
  w.legendaZobrazit = false; assert.deepEqual(prekryvaLegenda(w), []);
});

test('razítko podle vzoru HZS: údaje z karty, zalomení dlouhého názvu, druh listu ve žlutém poli, datum d. m. rrrr', () => {
  const p = M.novyProjekt(), k = p.listy[0].karta, v = p.listy[1].vykres;
  Object.assign(k.zpracoval, { jmeno: 'Ing. Josef Novák', cisloOsvedceni: 'Z-OZO 111/0000', datum: '2020-01-01' }); Object.assign(k.schvalil, { jmeno: 'Ing. Karel Novák', funkce: '' });
  const u = udajeRazitka(v, { karta: k, objektNazev: 'MŠ' });
  assert.deepEqual([u.zpracoval, u.schvalil, u.datum, u.nazev], ['Ing. Josef Novák Z-OZO 111/0000', 'Ing. Karel Novák', '2020-01-01', 'MŠ']);
  v.razitko.zpracoval = 'Vlastní'; assert.equal(udajeRazitka(v, { karta: k }).zpracoval, 'Vlastní');
  const dlouhy = 'Mateřská škola Neználek – pavilon B s tělocvičnou, jídelnou a přístavbou z roku 2019 včetně technického zázemí';
  const svg = renderListu(v, o({ karta: k, objektNazev: dlouhy }));
  assert.ok(svg.includes('S I T U A C E') && svg.includes('datum: 1. 1. 2020') && svg.includes('Ing. Karel Novák') && svg.includes('MĚŘÍTKO:'));
  const z = zalomDoBunky(dlouhy, 60, 3.4, { tucne: true, min: 2.4 });
  assert.equal(z.radky.length, 2); assert.ok(z.radky[1].endsWith('…')); assert.ok(z.radky.every((r) => sirkaTextu(r, z.vel, true) <= 60));
  assert.ok(!svg.includes('undefined') && !svg.includes('NaN'));
});

// ---------- DXF ----------
const dxf = (entity, bloky = '') => ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '6', '0', 'ENDSEC', '0', 'SECTION', '2', 'BLOCKS', ...bloky, '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', ...entity, '0', 'ENDSEC', '0', 'EOF'].join('\n');
const bb = (q) => { const b = bboxPrimitiv([q]); return [b.x0, b.y0, b.x1, b.y1].map((x) => Math.round(x * 1000) / 1000); };

test('DXF: zrcadlené entity (vysunutí 0,0,−1) leží na správném místě', () => {
  const ext = ['210', '0', '220', '0', '230', '-1'];
  const r = nactiDxf(new TextEncoder().encode(dxf([
    '0', 'ARC', '8', 'A', '10', '10', '20', '0', '40', '1', '50', '0', '51', '90', ...ext,
    '0', 'CIRCLE', '8', 'A', '10', '20', '20', '5', '40', '2', ...ext,
    '0', 'LWPOLYLINE', '8', 'A', '90', '2', '70', '0', '10', '30', '20', '0', '42', '0.5', '10', '34', '20', '0', ...ext,
    '0', 'ARC', '8', 'A', '10', '10', '20', '0', '40', '1', '50', '0', '51', '90',
  ])));
  const [oblouk, kruh, lomena, normalni] = r.primitiva;
  assert.deepEqual(bb(oblouk), [-11, 0, -10, 1]); assert.deepEqual([kruh.cx, kruh.cy, kruh.r], [-20, 5, 2]);
  assert.deepEqual(bb(lomena), [-34, -1, -30, 0]); assert.deepEqual(bb(normalni), [10, 0, 11, 1]);
});

test('DXF: MINSERT v natočených osách bloku, zarovnaný text od bodu 10 ke 11', () => {
  const blok = ['0', 'BLOCK', '2', 'BOX', '10', '0', '20', '0', '0', 'LWPOLYLINE', '8', '0', '90', '4', '70', '1', '10', '0', '20', '0', '10', '1', '20', '0', '10', '1', '20', '1', '10', '0', '20', '1', '0', 'ENDBLK'];
  const r = nactiDxf(new TextEncoder().encode(dxf([
    '0', 'INSERT', '8', 'A', '2', 'BOX', '10', '100', '20', '0', '50', '90', '70', '3', '71', '1', '44', '5', '45', '0',
    '0', 'TEXT', '8', 'A', '10', '0', '20', '0', '11', '10', '21', '10', '40', '1', '72', '3', '1', 'Zarovnaný',
  ], blok)));
  const b = bboxPrimitiv(r.primitiva.filter((q) => q.t !== 'text')); close(b.x0, 99); close(b.x1, 100); close(b.y0, 0); close(b.y1, 11);
  const t = r.primitiva.find((q) => q.t === 'text'); close(t.x, 0); close(t.y, 0); close(t.uhel, 45);
});

test('DXF: text v zrcadleném bloku zůstane čitelný a na místě', () => {
  const blok = ['0', 'BLOCK', '2', 'POPIS', '10', '0', '20', '0', '0', 'TEXT', '8', '0', '10', '0', '20', '0', '40', '1', '1', 'ABCD', '0', 'ENDBLK'];
  const r = nactiDxf(new TextEncoder().encode(dxf(['0', 'INSERT', '8', 'A', '2', 'POPIS', '10', '50', '20', '0', '41', '-1', '42', '1'], blok)));
  const t = r.primitiva.find((q) => q.t === 'text');
  close(t.uhel, 0); assert.ok(t.x < 50 && t.x > 46, `začátek textu vlevo od bodu vložení (${t.x})`); close(t.y, 0);
});

// ---------- SVG, souřadnice importu ----------
test('SVG: styly z <style> (třídy), <use> se <symbol> a zhuštěné příznaky oblouku', async () => {
  const { nactiSvg, parsujCestu } = await import('../js/kresleni/import/svg.js');
  const r = nactiSvg('<svg viewBox="0 0 100 100"><style>.st0{fill:none;stroke:#ff0000;stroke-width:.5} rect.vypln { fill: #00ff00 }</style><rect class="st0" x="1" y="1" width="10" height="10"/><rect class="vypln" x="20" y="1" width="5" height="5"/><path class="st0" style="stroke:#0000ff" d="M0 50 L10 50"/></svg>');
  assert.deepEqual(r.primitiva.map((p) => [p.t, p.barva, p.vypln ?? null]), [['cara', '#ff0000', null], ['plocha', '#00ff00', '#00ff00'], ['cara', '#0000ff', null]]);
  const s = nactiSvg('<svg viewBox="0 0 100 100"><defs><symbol id="d" viewBox="0 0 10 10"><path d="M0 0 L10 0" stroke="#000"/></symbol></defs><use href="#d" x="20" y="30" width="20" height="20"/><use xlink:href="#d" x="50" y="0"/></svg>');
  assert.equal(s.primitiva.length, 2); assert.deepEqual(s.primitiva[0].body, [[20, 30], [40, 30]]); assert.deepEqual(s.primitiva[1].body, [[50, 0], [60, 0]]);
  assert.deepEqual(parsujCestu('M0 0a5 5 0 0110 0').at(0).body.at(-1), [10, 0]);
  assert.deepEqual(parsujCestu('M 1 1 A 2 2 0 0 1 5 1').at(0).body.at(-1), [5, 1], 'oddělené příznaky (dveře v PDF)');
  assert.deepEqual(parsujCestu('M10,10L20-5h5v5z')[0].body, [[10, 10], [20, -5], [25, -5], [25, 0]]);
});

test('import ve vzdálených (geodetických) souřadnicích se posune k počátku; další import téže soustavy navazuje', () => {
  const v = M.novyList('situace').vykres, X = -740000, Y = 1050000;
  const cara = (a, b) => ({ id: `e_${Math.random().toString(36).slice(2, 8)}`, druh: 'cara', vrstva: 'dxf_x', puvod: 'dxf', body: [a, b], tloustka: 0.25, barva: '#000000', styl: 'plna' });
  vlozVektor(v, { prvky: [cara([X + 10.123, Y + 5], [X + 60, Y + 5])], vrstvy: [], meritko: { overeno: true } });
  assert.deepEqual(v.posunSouradnic, [-740000, 1050000]); close(v.prvky[0].body[0][0], 10.123); close(v.prvky[0].body[0][1], 5);
  vlozVektor(v, { prvky: [cara([X + 10.123, Y + 20], [X + 60, Y + 20])], vrstvy: [], meritko: { overeno: true } });
  close(v.prvky[1].body[0][0], 10.123, 1e-9);
  vlozVektor(v, { prvky: [cara([1, 1], [2, 2])], vrstvy: [], meritko: { overeno: true } });
  assert.deepEqual(v.prvky[2].body, [[1, 1], [2, 2]], 'místní souřadnice se neposouvají');
  const w = M.novyList('situace').vykres; w.prvky.push(cara([X, Y], [X + 1, Y]));
  vlozVektor(w, { prvky: [cara([X + 5, Y], [X + 6, Y])], vrstvy: [], meritko: { overeno: true } });
  assert.equal(w.posunSouradnic, undefined, 'starší výkres už ve vzdálených souřadnicích zůstane v nich'); close(w.prvky[1].body[0][0], X + 5);
});

test('očista evakuačního plánu: poloha přehledového plánu a pokyny vedle plánu', () => {
  const p = M.novyProjekt({ nazev: 'E', typ: 'evakuacni_plan' }), e = p.listy.find((l) => l.typ === 'evak_plan').vykres.evakPlan;
  e.prehledPoloha = '"><b>'; e.pokynyVedle = 'ano';
  const f = M.migruj(JSON.parse(JSON.stringify(p))).listy.find((l) => l.typ === 'evak_plan').vykres.evakPlan;
  assert.equal(f.prehledPoloha, 'vpravo-dole'); assert.equal(f.pokynyVedle, false);
  e.prehledPoloha = 'vlevo-nahore'; e.pokynyVedle = true;
  const g = M.migruj(JSON.parse(JSON.stringify(p))).listy.find((l) => l.typ === 'evak_plan').vykres.evakPlan;
  assert.equal(g.prehledPoloha, 'vlevo-nahore'); assert.equal(g.pokynyVedle, true);
});
