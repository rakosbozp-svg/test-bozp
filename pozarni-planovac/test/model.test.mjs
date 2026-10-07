import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as M from '../js/model.js';
import { zkontrolujUplnost, souhrn } from '../js/uplnost.js';

const katalog = JSON.parse(readFileSync(new URL('../znacky/katalog.json', import.meta.url), 'utf8'));

test('katalog: 109 značek, unikátní id, existující soubory', () => {
  assert.equal(katalog.pocet, 109);
  assert.equal(katalog.znacky.length, 109);
  assert.equal(new Set(katalog.znacky.map((z) => z.id)).size, 109);
  for (const z of katalog.znacky) {
    assert.ok(z.nazev.length > 3, z.id);
    assert.ok(readFileSync(new URL(`../${z.png}`, import.meta.url)).length > 100, z.id);
    assert.ok(readFileSync(new URL(`../${z.svg}`, import.meta.url), 'utf8').includes('<svg'), z.id);
  }
});

test('nový projekt: karta + situace, serializace tam a zpět beze ztráty', () => {
  const p = M.novyProjekt({ nazev: 'Test' });
  assert.deepEqual(p.listy.map((l) => l.typ), ['karta', 'situace']);
  const k = p.listy[0].karta;
  k.objekt.nazev = 'Hala PREFA 1';
  k.fve.vykonKWp = 460;
  const zpet = M.nactiProjekt(M.serializuj(p));
  assert.deepEqual(zpet, p);
});

test('správa listů: přidat, kopírovat, přejmenovat, řadit, smazat', () => {
  const p = M.novyProjekt();
  const pud = M.pridejList(p, 'pudorys', 'Půdorys 1.NP');
  M.prejmenujList(p, pud.id, 'Půdorys PREFA 1');
  pud.vykres.prvky.push({ id: 'a', druh: 'stena' });
  const kopie = M.kopirujList(p, pud.id);
  assert.notEqual(kopie.id, pud.id);
  assert.notEqual(kopie.vykres.prvky[0].id, 'a');
  assert.equal(p.listy.length, 4);
  M.presunList(p, kopie.id, 0);
  assert.equal(p.listy[0].id, kopie.id);
  assert.deepEqual(p.listy.map((l) => l.poradi), [0, 1, 2, 3]);
  M.smazList(p, kopie.id);
  assert.equal(p.listy.length, 3);
  assert.throws(() => M.najdiList(p, kopie.id));
});

test('migrace doplní chybějící pole a nic nesmaže', () => {
  const p = M.novyProjekt();
  const k = p.listy[0].karta;
  k.objekt.nazev = 'X'; k.nebezpeci.push({ id: 'n1', popis: 'benzin', hasivo: 'prášek' });
  delete k.fve; delete k.objekt.provoz;
  delete p.listy[1].vykres.sit10m; delete p.poznamkyKOvereni;
  const m = M.migruj(JSON.parse(JSON.stringify(p)));
  assert.equal(m.listy[0].karta.objekt.nazev, 'X');
  assert.equal(m.listy[0].karta.nebezpeci[0].hasivo, 'prášek');
  assert.equal(m.listy[0].karta.fve.pritomna, null);
  assert.equal(m.listy[0].karta.objekt.provoz.pracovniDoba, '');
  assert.equal(m.listy[1].vykres.sit10m, true);
  assert.deepEqual(m.poznamkyKOvereni, []);
});

test('migrace odmítne cizí a novější soubory', () => {
  assert.throws(() => M.migruj({}), /schemaVersion/);
  assert.throws(() => M.migruj({ schemaVersion: 99 }), /novější/);
});

test('velikost prvků: 1–500, desetinné, čárka, krok 0,1', () => {
  assert.equal(M.normalizujVelikost('2,5'), 2.5);
  assert.equal(M.normalizujVelikost(0.2), 1);
  assert.equal(M.normalizujVelikost(900), 500);
  assert.equal(M.normalizujVelikost(3.14159), 3.1);
  assert.throws(() => M.normalizujVelikost('abc'));
});

test('kontrola úplnosti: prázdná karta má chyby, vyplněná NE je akceptována', () => {
  const p = M.novyProjekt();
  const kody = (n) => new Set(n.map((x) => x.kod));
  let n = zkontrolujUplnost(p, katalog.znacky);
  for (const kod of ['ID_OBJEKT', 'GPS', 'PRIJEZD', 'NEBEZPECI', 'VODA', 'DOPORUCENI', 'FVE_ROZHODNUTI', 'OSVEDCENI']) assert.ok(kody(n).has(kod), kod);
  assert.ok(kody(n).has('SEVERKA') && kody(n).has('LEGENDA') && kody(n).has('REVIZE_CHYBI'));
  assert.ok(souhrn(n).chyby > 10);

  const k = p.listy[0].karta;
  k.omezeni = 'NE'; k.objekt.omezeni = 'NE';
  k.nebezpeci.push({ id: 'n1', popis: 'NE', hasivo: '' });
  n = zkontrolujUplnost(p);
  assert.ok(!kody(n).has('OMEZENI') && !kody(n).has('NEBEZPECI') && !kody(n).has('NEBEZPECI_HASIVO'));
});

test('kontrola: nebezpečí bez hasiva, FVE bez výkonu, hydrant bez ověřeného průtoku', () => {
  const p = M.novyProjekt();
  const k = p.listy[0].karta;
  k.nebezpeci.push({ id: 'n1', popis: 'benzin 20 l', hasivo: '' });
  k.fve.pritomna = true;
  k.vodniZdroje.push({ id: 'v1', typ: 'hydrant', prutokLs: 4, overenPrutok: false, gps: { sirka: null, delka: null } });
  const kod = new Set(zkontrolujUplnost(p).map((x) => x.kod));
  for (const c of ['NEBEZPECI_HASIVO', 'FVE_VYKON', 'FVE_VYPINAC', 'HYDRANT_PRUTOK']) assert.ok(kod.has(c), c);
  k.vodniZdroje[0].overenPrutok = true;
  assert.ok(!new Set(zkontrolujUplnost(p).map((x) => x.kod)).has('HYDRANT_PRUTOK'));
});

test('kontrola: odkaz na neexistující značku a ověřené měřítko', () => {
  const p = M.novyProjekt();
  const v = p.listy[1].vykres;
  v.prvky.push({ id: 'p1', druh: 'znacka', znackaId: 'DZP-999' }, { id: 'p2', druh: 'znacka', znackaId: 'DZP-001' });
  const n = zkontrolujUplnost(p, katalog.znacky);
  assert.equal(n.filter((x) => x.kod === 'ZNACKA_NEEXISTUJE').length, 1);
  assert.ok(!n.some((x) => x.kod === 'MERITKO'), 'bez podkladu se kreslí v metrech – měřítko je ověřené');
  v.pozadi = { prilohaId: 'x', kalibrace: null };
  assert.ok(zkontrolujUplnost(p).some((x) => x.kod === 'MERITKO'));
  v.pozadi.kalibrace = { delkaM: 5 };
  assert.ok(!zkontrolujUplnost(p).some((x) => x.kod === 'MERITKO'));
});

test('referenční projekt Litice se načte a obsahuje jen potvrzená FVE data', () => {
  const p = M.nactiProjekt(readFileSync(new URL('../data/litice.projekt.json', import.meta.url), 'utf8'));
  const f = p.listy[0].karta.fve;
  assert.deepEqual([f.pocetPanelu, f.vykonKWp, f.baterie], [488, 460, false]);
  assert.equal(p.listy[0].karta.objekt.adresa, '');   // nedoplněno, nevymýšlí se
  assert.ok(zkontrolujUplnost(p).some((x) => x.kod === 'GPS'));
});
