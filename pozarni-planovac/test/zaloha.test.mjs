// Automatická záloha (js/zaloha/): kódování, vrstva nad úložištěm artefaktu a fronta zálohování.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { MAX_CAST, otisk, zabal, rozbal, rozdel, bezpecnySegment, zpetSegment, novaVerze } from '../js/zaloha/kodovani.js';

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
