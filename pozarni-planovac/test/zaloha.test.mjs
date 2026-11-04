// Automatická záloha (js/zaloha/): kódování, vrstva nad úložištěm artefaktu a fronta zálohování.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MAX_CAST, otisk, zabal, rozbal, rozdel, bezpecnySegment, zpetSegment, novaVerze } from '../js/zaloha/kodovani.js';
import { pripoj, kodChyby } from '../js/zaloha/uloziste.js';
import { falesneUloziste } from './falesne-uloziste.mjs';
import { vytvorAutozalohu } from '../js/zaloha/autozaloha.js';
import * as M from '../js/model.js';

// ---------- kódování ----------
test('kódování tam a zpět: diakritika, uvozovky, zpětná lomítka, emoji', async () => {
  const t = '{"nazev":"Hala „Žluťoučký kůň“ \\\\ \\"x\\" 🔥"}';
  const g = await zabal(t);
  assert.equal(g.komprese, 'gzip');
  assert.equal(g.velikost, Buffer.byteLength(t, 'utf8'));
  assert.equal(await rozbal(g), t);
  const z = await zabal(t, { gzip: false });
  assert.equal(z.komprese, 'zadna');
  assert.equal(await rozbal(z), t);
});

test('velký podklad: 3 MB náhodného base64, všechny části do limitu', async () => {
  const text = JSON.stringify({ nazev: 'Hala', podklad: `data:image/png;base64,${randomBytes(2_250_000).toString('base64')}` });
  const { data, komprese } = await zabal(text);
  const casti = rozdel(data);
  assert.equal(MAX_CAST, 200000);
  assert.ok(casti.length > 1);
  for (const c of casti) {
    assert.ok(c.length <= 200000);
    assert.ok(Buffer.byteLength(JSON.stringify({ d: c, t: new Date().toISOString() })) < 256 * 1024);
  }
  assert.equal(casti.join(''), data);
  const zpet = await rozbal({ data: casti.join(''), komprese });
  assert.equal(await otisk(zpet), await otisk(text));
  assert.deepEqual(rozdel(''), ['']);
});

test('otisk je stabilní hex', async () => {
  assert.equal(await otisk('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('bezpečný segment tam a zpět', () => {
  for (const id of ['proj_ab12cd34', 'a/b c', 'Žár', '.', '..', 'x+y.z']) {
    const s = bezpecnySegment(id);
    assert.match(s, /^[A-Za-z0-9_\-~:@+]+$/, s);
    assert.ok(s !== '.' && s !== '..');
    assert.equal(zpetSegment(s), id);
  }
  assert.equal(bezpecnySegment('proj_ab12cd34'), 'proj_ab12cd34');
  assert.throws(() => bezpecnySegment(''), /Prázdné id projektu/);
});

test('nová verze', () => {
  const v = new Set(Array.from({ length: 100 }, () => novaVerze()));
  assert.equal(v.size, 100);
  for (const x of v) assert.match(x, /^[0-9a-z]{10}$/);
});

// ---------- vrstva nad úložištěm ----------
const H = (o = {}) => ({ format: 1, nazev: 'A', typ: 'operativni_karta', zmeneno: '2026-11-04T10:00:00.000Z', velikost: 4, sha256: 'x', verze: 'v1', casti: 2, komprese: 'zadna', zalohovano: '2026-11-04T10:00:01.000Z', smazano: null, ...o });

test('připojení: bez claude, s use → null, s uid null a po limitu → null', async () => {
  assert.equal(await pripoj({ claude: undefined }), null);
  assert.equal(await pripoj({ claude: { use: async () => null } }), null);
  assert.equal(await pripoj({ claude: falesneUloziste({ uid: null }).claude }), null);
  assert.equal(await pripoj({ claude: { use: () => new Promise(() => {}) }, limitMs: 50 }), null);
  assert.equal(await pripoj({ claude: falesneUloziste({ uid: 'a/b' }).claude }), null, 'id porušující gramatiku cest');
  assert.equal((await pripoj({ claude: falesneUloziste().claude })).uid, 'u1');
  assert.equal(kodChyby({ code: 'quota_exceeded' }), 'quota_exceeded');
  assert.equal(kodChyby(new Error('x')), 'unavailable');
});

test('části a hlavička tam a zpět', async () => {
  const f = falesneUloziste(), u = await pripoj({ claude: f.claude });
  await u.zapisCasti('proj_a', 'v1', ['ab', 'cd']);
  await u.zapisHlavicku('proj_a', H());
  assert.equal(await u.ctiData('proj_a', H()), 'abcd');
  const h = await u.hlavicky();
  assert.equal(h.length, 1);
  assert.equal(h[0].pid, 'proj_a');
  assert.equal(h[0].verze, 'v1');
  assert.ok(Date.parse(f.dokumenty['data/users/u1/proj_a/casti/v1_0'].t) > 0, 'část nese čas zápisu');
  await u.zapisCasti('proj_b', 'v1', ['x'], '2026-01-01T00:00:00.000Z');
  assert.equal(f.dokumenty['data/users/u1/proj_b/casti/v1_0'].t, '2026-01-01T00:00:00.000Z', 'čas zápisu jde předat (hodiny zálohy)');
});

test('úklid: smaže předchozí verzi a staré sirotky, nechá čerstvé cizí části', async () => {
  const ted = Date.parse('2026-11-04T12:00:00.000Z'), stary = new Date(ted - 2 * 3600000).toISOString(), cerstvy = new Date(ted - 60000).toISOString();
  const k = 'data/users/u1/proj_a/casti/';
  const f = falesneUloziste({ dokumenty: { [`${k}v0_0`]: { d: 'x', t: cerstvy }, [`${k}vX_0`]: { d: 'x', t: stary }, [`${k}vY_0`]: { d: 'x', t: cerstvy }, [`${k}v1_0`]: { d: 'x', t: stary } } });
  const u = await pripoj({ claude: f.claude });
  assert.equal(await u.uklid('proj_a', 'v1', 'v0', ted), 2);
  assert.deepEqual(Object.keys(f.dokumenty).sort(), [`${k}v1_0`, `${k}vY_0`]);
});

test('odstranění smaže hlavičku i všechny části; označení bez hlavičky vrátí false; chybějící část → chybi_cast', async () => {
  const f = falesneUloziste(), u = await pripoj({ claude: f.claude }), kdy = '2026-11-04T12:00:00.000Z';
  assert.equal(await u.oznacSmazany('proj_a', kdy), false);
  await u.zapisCasti('proj_a', 'v1', ['ab', 'cd']);
  await u.zapisHlavicku('proj_a', H());
  assert.equal(await u.oznacSmazany('proj_a', kdy), true);
  assert.equal((await u.hlavicky())[0].smazano, kdy);
  await u.zrusSmazani('proj_a');
  assert.equal((await u.hlavicky())[0].smazano, null);
  delete f.dokumenty['data/users/u1/proj_a/casti/v1_1'];
  await assert.rejects(u.ctiData('proj_a', H()), (e) => e.code === 'chybi_cast');
  await u.odstran('proj_a');
  assert.deepEqual(Object.keys(f.dokumenty), []);
});

// ---------- automatická záloha ----------
const ZMENENO = '2026-11-04T10:00:00.000Z';
const textProjektu = (nazev, extra = {}) => M.serializuj(Object.assign(M.novyProjekt({ nazev }), extra));
const zaznam = (id, text, zmeneno = ZMENENO, nazev = id) => ({ id, nazev, typ: 'operativni_karta', zmeneno, text });
function falesneUlozeni(zaznamy = []) {
  const m = new Map(zaznamy.map((r) => [r.id, r])), posl = new Set();
  return {
    sleduj: (fn) => { posl.add(fn); return () => posl.delete(fn); },
    seznam: () => [...m.values()].map(({ id, nazev, typ, zmeneno }) => ({ id, nazev, typ, zmeneno })),
    zaznam: (id) => m.get(id) ?? null,
    uloz(r) { m.set(r.id, r); for (const f of posl) f({ typ: 'ulozeno', id: r.id }); },
    smaz(id) { m.delete(id); for (const f of posl) f({ typ: 'smazano', id }); },
    m,
  };
}
async function autozaloha(f, ul, { cekani = [], ted, nahoda } = {}) {
  return vytvorAutozalohu({ ulozeni: ul, uloziste: await pripoj({ claude: f.claude }), prodlevaMs: 10, cekej: async (ms) => { cekani.push(ms); }, ...(ted ? { ted } : {}), ...(nahoda ? { nahoda } : {}) });
}
const sety = (f, casti) => f.stav.zapisy.filter(([v, c]) => v === 'set' && c.includes('/casti/') === casti).length;
const velkyText = (nazev) => textProjektu(nazev, { poznamka: randomBytes(300_000).toString('base64') });

test('změna se po prodlevě zazálohuje a obnova vrátí stejný text', async () => {
  const f = falesneUloziste(), ul = falesneUlozeni(), z = await autozaloha(f, ul), text = textProjektu('Hala A');
  await z.start();
  ul.uloz(zaznam('proj_a', text));
  await new Promise((r) => setTimeout(r, 40));   // prodleva 10 ms uplyne sama
  await z.dokonci();
  assert.equal(z.projekty().length, 1);
  assert.equal(z.stav().faze, 'ok');
  assert.equal(z.stav().pocet, 1);
  assert.equal(z.stav().ceka, 0);
  assert.ok(z.stav().posledni);
  const o = await z.nactiProObnovu(['proj_a']);
  assert.deepEqual(o.chyby, []);
  assert.deepEqual(o.projekty, [M.nactiProjekt(text)]);
});

test('beze změny otisku se nic nezapíše', async () => {
  const f = falesneUloziste(), ul = falesneUlozeni(), z = await autozaloha(f, ul), text = textProjektu('Hala A');
  await z.start();
  ul.uloz(zaznam('proj_a', text)); await z.dokonci();
  const pred = f.stav.zapisy.length;
  ul.uloz(zaznam('proj_a', text)); await z.dokonci();
  assert.equal(f.stav.zapisy.filter(([v]) => v === 'set').length, f.stav.zapisy.slice(0, pred).filter(([v]) => v === 'set').length);
});

test('smazání označí hlavičku; obnova smazaného jen zruší značku', async () => {
  const f = falesneUloziste(), ul = falesneUlozeni(), z = await autozaloha(f, ul), text = textProjektu('Hala A');
  await z.start();
  ul.uloz(zaznam('proj_a', text)); await z.dokonci();
  ul.smaz('proj_a'); await z.dokonci();
  assert.match(z.projekty()[0].smazano, /^\d{4}-\d\d-\d\dT/);
  assert.equal(z.stav().pocet, 0);
  assert.equal(z.stav().smazanych, 1);
  const casti = sety(f, true);
  ul.uloz(zaznam('proj_a', text)); await z.dokonci();
  assert.equal(z.projekty()[0].smazano, null);
  assert.equal(sety(f, true), casti, 'žádné nové části');
});

test('přerušení při zápisu částí nepoškodí zálohu', async () => {
  let ted = Date.parse('2026-11-04T10:00:00.000Z');
  const f = falesneUloziste(), ul = falesneUlozeni(), z = await autozaloha(f, ul, { ted: () => new Date(ted) });
  const stary = textProjektu('Hala A'), novy = velkyText('Hala A');
  await z.start();
  ul.uloz(zaznam('proj_a', stary)); await z.dokonci();
  const v0 = z.projekty()[0].verze;
  let n = 0;
  f.stav.pred = (v, c) => { if (v === 'set' && c.includes('/casti/') && ++n === 2) throw { code: 'invalid_argument', message: 'simulace' }; };
  ul.uloz(zaznam('proj_a', novy, '2026-11-04T10:05:00.000Z')); await z.dokonci();
  assert.equal(z.projekty()[0].verze, v0, 'hlavička ukazuje na starou úplnou verzi');
  assert.deepEqual((await z.nactiProObnovu(['proj_a'])).projekty, [M.nactiProjekt(stary)]);
  f.stav.pred = null;
  ul.uloz(zaznam('proj_a', novy, '2026-11-04T10:06:00.000Z')); await z.dokonci();
  const v2 = z.projekty()[0].verze, casti = Object.keys(f.dokumenty).filter((k) => k.includes('/casti/'));
  assert.ok(!casti.some((k) => k.includes(`/casti/${v0}_`)), 'stará verze uklizená');
  assert.ok(casti.some((k) => !k.includes(`/casti/${v2}_`)), 'čerstvý sirotek přerušeného pokusu zatím zůstává');
  assert.deepEqual((await z.nactiProObnovu(['proj_a'])).projekty, [M.nactiProjekt(novy)]);
  ted += 2 * 3600000;   // za dvě hodiny další záloha sirotka uklidí
  ul.uloz(zaznam('proj_a', textProjektu('Hala B'), '2026-11-04T12:06:00.000Z')); await z.dokonci();
  const v3 = z.projekty()[0].verze;
  assert.ok(Object.keys(f.dokumenty).filter((k) => k.includes('/casti/')).every((k) => k.includes(`/casti/${v3}_`)));
});

test('souběh dvou záloh stejného projektu: hlavička vždy na úplné verzi', async () => {
  const f = falesneUloziste(), text0 = textProjektu('Hala 0'), tA = velkyText('Hala A'), tB = velkyText('Hala B');
  const ulA = falesneUlozeni(), ulB = falesneUlozeni();
  const a = await autozaloha(f, ulA), b = await autozaloha(f, ulB);
  await a.start();
  ulA.uloz(zaznam('proj_a', text0)); await a.dokonci();
  await b.start();
  ulA.uloz(zaznam('proj_a', tA, '2026-11-04T10:01:00.000Z'));
  ulB.uloz(zaznam('proj_a', tB, '2026-11-04T10:02:00.000Z'));
  await Promise.all([a.dokonci(), b.dokonci()]);
  const c = await autozaloha(f, falesneUlozeni());
  await c.start();
  const o = await c.nactiProObnovu(['proj_a']);
  assert.deepEqual(o.chyby, []);
  assert.equal(o.projekty.length, 1);
  assert.ok([M.nactiProjekt(tA).nazev, M.nactiProjekt(tB).nazev].includes(o.projekty[0].nazev));
});

test('smazání během nahrávání: hlavička skončí se smazano', async () => {
  const f = falesneUloziste(), ul = falesneUlozeni(), z = await autozaloha(f, ul);
  await z.start();
  f.stav.pred = (v, c) => { if (v === 'set' && c.includes('/casti/') && ul.m.has('proj_a')) ul.m.delete('proj_a'); };
  ul.uloz(zaznam('proj_a', textProjektu('Hala A'))); await z.dokonci();
  assert.match(z.projekty()[0].smazano, /^\d{4}-\d\d-\d\dT/);
});

test('dohánění po startu', async () => {
  const hl = (zmeneno) => ({ format: 1, nazev: 'x', typ: 'operativni_karta', zmeneno, velikost: 1, sha256: 'x', verze: 'v0', casti: 1, komprese: 'zadna', zalohovano: zmeneno, smazano: null });
  const f = falesneUloziste({ dokumenty: { 'data/users/u1/p1': hl('2026-11-01T00:00:00.000Z'), 'data/users/u1/p2': hl('2026-11-01T00:00:00.000Z') } });
  const ul = falesneUlozeni([zaznam('p1', textProjektu('P1'), '2026-11-02T00:00:00.000Z'), zaznam('p2', textProjektu('P2'), '2026-11-01T00:00:00.000Z'), zaznam('p3', textProjektu('P3'))]);
  const z = await autozaloha(f, ul);
  await z.start(); await z.dokonci();
  assert.equal(sety(f, false), 2, 'nahrány právě p1 (novější) a p3 (bez hlavičky)');
  assert.equal(z.projekty().find((h) => h.pid === 'p2').verze, 'v0');
});

test('chyby úložiště: plné, přetížené, nedostupné, odebrané, chyba projektu', async () => {
  // plné úložiště: fronta stojí
  let f = falesneUloziste(), ul = falesneUlozeni(), z = await autozaloha(f, ul);
  await z.start();
  f.stav.pred = (v) => { if (v === 'set') throw { code: 'quota_exceeded', message: 'x' }; };
  ul.uloz(zaznam('p1', textProjektu('P1'))); ul.uloz(zaznam('p2', textProjektu('P2'))); await z.dokonci();
  assert.equal(z.stav().faze, 'chyba');
  assert.equal(z.stav().chyba.text, 'Úložiště artefaktu je plné. Odstraňte ze zálohy smazané projekty, nebo zálohujte ručně.');
  assert.ok(z.stav().ceka > 0);
  // přetížení: pauza 60 s a pokračuje
  let cekani = [];
  f = falesneUloziste(); ul = falesneUlozeni(); z = await autozaloha(f, ul, { cekani });
  await z.start();
  let n = 0;
  f.stav.pred = (v) => { if (v === 'set' && n++ === 0) throw { code: 'resource_exhausted', message: 'x' }; };
  ul.uloz(zaznam('p1', textProjektu('P1'))); await z.dokonci();
  assert.ok(cekani.includes(60000));
  assert.equal(z.stav().faze, 'ok');
  assert.equal(z.projekty().length, 1);
  // nedostupné dvakrát: jeden nový pokus po 2–5 s, pak chyba
  cekani = [];
  f = falesneUloziste(); ul = falesneUlozeni(); z = await autozaloha(f, ul, { cekani, nahoda: () => 0.5 });
  await z.start();
  f.stav.pred = (v) => { if (v === 'set') throw { code: 'unavailable', message: 'x' }; };
  ul.uloz(zaznam('p1', textProjektu('P1'))); await z.dokonci();
  assert.equal(cekani.length, 1);
  assert.ok(cekani[0] >= 2000 && cekani[0] <= 5000);
  assert.equal(z.stav().faze, 'chyba');
  assert.equal(z.stav().chyba.text, 'Úložiště je dočasně nedostupné.');
  // odebraný přístup: záloha se vypne
  f = falesneUloziste(); ul = falesneUlozeni(); z = await autozaloha(f, ul);
  await z.start();
  f.stav.pred = () => { throw { code: 'revoked', message: 'x' }; };
  ul.uloz(zaznam('p1', textProjektu('P1'))); await z.dokonci();
  assert.equal(z.stav().faze, 'nedostupna');
  // chyba jednoho projektu: přeskočí ho a pokračuje dalším
  f = falesneUloziste(); ul = falesneUlozeni(); z = await autozaloha(f, ul);
  await z.start();
  f.stav.pred = (v, c) => { if (v === 'set' && c.includes('/pX')) throw { code: 'invalid_argument', message: 'x' }; };
  ul.uloz(zaznam('pX', textProjektu('X'), ZMENENO, 'X')); ul.uloz(zaznam('pY', textProjektu('Y'), ZMENENO, 'Y')); await z.dokonci();
  assert.equal(z.stav().chyba.text, 'Záloha projektu „X“ selhala (kód invalid_argument).');
  assert.deepEqual(z.projekty().map((h) => h.pid), ['pY']);
});

test('obnova s chybějící částí', async () => {
  const f = falesneUloziste(), ul = falesneUlozeni(), z = await autozaloha(f, ul);
  await z.start();
  ul.uloz(zaznam('p1', textProjektu('P1'), ZMENENO, 'Projekt jedna')); ul.uloz(zaznam('p2', textProjektu('P2'), ZMENENO, 'Projekt dva')); await z.dokonci();
  delete f.dokumenty[Object.keys(f.dokumenty).find((k) => k.startsWith('data/users/u1/p1/casti/'))];
  const o = await z.nactiProObnovu(['p1', 'p2']);
  assert.equal(o.projekty.length, 1);
  assert.equal(o.chyby.length, 1);
  assert.match(o.chyby[0], /Projekt jedna/);
});
