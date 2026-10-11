import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import { navrhZKarty, navrhZPlanu, pouzijNavrh } from '../js/prebirani.js';

const vyplnenaKarta = () => {
  const k = M.novyList('karta', 'OK').karta;
  Object.assign(k.objekt, { nazev: 'Hala montáže', obsazeniOsobami: '40 osob, 2 směny', prijezdZ: 'ul. Hlavní', omezeni: 'NE' });
  Object.assign(k.objekt.provoz, { kontaktJmeno: 'Novák', kontaktTelefon: '602 111 222' });
  Object.assign(k.charakter, { ucelStavby: 'výroba', podlazi: '1 NP', celkovaVyskaM: '8', pudorysM: '65 x 36', konstrukce: 'nehořlavá', strecha: 'hořlavá' });
  k.stupenPoplachu = 'II.'; k.pbz.eps = 'vrátnice'; k.media.hlavniVypinacEl = 'trafostanice';
  k.nebezpeci.push({ id: 'n1', popis: 'Technický benzin 200 l', hasivo: 'pěna' });
  k.vodniZdroje.push({ id: 'v1', typ: 'hydrant', popis: 'u brány', prutokLs: 6.5, overenPrutok: true, objemM3: null, gps: { sirka: null, delka: null } });
  Object.assign(k.fve, { pritomna: true, vykonKWp: 460, pocetPanelu: 488, baterie: false, vypinacSilovaCast: 'STOP FVE u NN rozvodny' });
  k.doporuceni = 'Vypnout el. energii v trafostanici.'; k.znalostObjektu = { jmeno: 'Dvořák', mobil: '777 000 111' };
  return k;
};

test('karta → operativní plán: návrh převede údaje, nebezpečí, vodu, PBZ, uzávěry, FVE i kontakty', () => {
  const p = M.novyProjekt({ typ: 'operativni_plan' }), cile = { opZaklad: p.listy[0].opZaklad, opText: p.listy[1].opText };
  const n = navrhZKarty(vyplnenaKarta(), cile);
  const vse = new Set(n.map((_, i) => i));
  assert.ok(n.every((x) => x.stavajici === null));
  pouzijNavrh(n, vse, cile);
  const t = cile.opText;
  assert.equal(t.objekty[0].nazev, 'Hala montáže'); assert.match(t.objekty[0].konstrukce, /nehořlavá; střecha hořlavá/);
  assert.match(t.udaje.latky, /Technický benzin 200 l – vhodné hasivo: pěna/);
  assert.match(t.voda.zdroje, /Vnější hydrant – u brány, průtok 6,5 l\/s \(ověřen\)/);
  assert.match(t.udaje.rozvody, /Hlavní vypínač el\. proudu: trafostanice/); assert.match(t.udaje.rozvody, /FVE: 460 kWp, 488 panelů, bez baterie, vypínač silové části: STOP FVE u NN rozvodny/);
  assert.equal(t.telefony.length, 2); assert.equal(cile.opZaklad.ots.stupenPoplachu, 'II.');
  assert.deepEqual(navrhZKarty(vyplnenaKarta(), cile), [], 'podruhé už není co převzít (žádné duplicity)');
});

test('neprázdné pole se označí k přepsání a bez výběru se nepřepíše', () => {
  const p = M.novyProjekt({ typ: 'operativni_plan' }), cile = { opText: p.listy[1].opText };
  cile.opText.doporuceni = 'Můj vlastní text';
  const n = navrhZKarty(vyplnenaKarta(), cile), i = n.findIndex((x) => x.cesta === 'doporuceni');
  assert.equal(n[i].stavajici, 'Můj vlastní text');
  pouzijNavrh(n, new Set(n.map((_, j) => j).filter((j) => j !== i)), cile);
  assert.equal(cile.opText.doporuceni, 'Můj vlastní text');
});

test('operativní plán → karta: jen jednoznačná pole vybrané budovy', () => {
  const p = M.novyProjekt({ typ: 'operativni_plan' }), t = p.listy[1].opText, z = p.listy[0].opZaklad;
  t.objekty.push({ id: 'a', nazev: 'Sklad', podlazi: '1 NP', vyska: '9', pudorys: '40 x 30', konstrukce: 'ocel', useky: '1', vyuziti: 'sklad' }, { id: 'b', nazev: 'Lakovna', vyuziti: 'lakování' });
  t.udaje.osoby = '10 osob'; t.doporuceni = 'Pozor na ředidla'; z.ots.stupenPoplachu = 'I.';
  const k = M.novyList('karta').karta, n = navrhZPlanu({ opText: t, opZaklad: z }, t.objekty[1], k);
  pouzijNavrh(n, new Set(n.map((_, i) => i)), { karta: k });
  assert.equal(k.objekt.nazev, 'Lakovna'); assert.equal(k.charakter.ucelStavby, 'lakování'); assert.equal(k.charakter.podlazi, '');
  assert.equal(k.objekt.obsazeniOsobami, '10 osob'); assert.equal(k.doporuceni, 'Pozor na ředidla'); assert.equal(k.stupenPoplachu, 'I.');
  assert.equal(k.nebezpeci.length, 0);
});
