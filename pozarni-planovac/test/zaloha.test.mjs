// Automatická záloha (js/zaloha/): kódování, vrstva nad úložištěm artefaktu a fronta zálohování.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MAX_CAST, otisk, zabal, rozbal, rozdel, bezpecnySegment, zpetSegment, novaVerze } from '../js/zaloha/kodovani.js';
import { pripoj, kodChyby } from '../js/zaloha/uloziste.js';
import { falesneUloziste } from './falesne-uloziste.mjs';

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
