import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import { OTAZKY, navrhZDotazniku } from '../js/dotaznik.js';
import { pouzijNavrh } from '../js/prebirani.js';
import { dotaznikDoPdf, dotaznikZPdf } from '../js/pdf/dotaznikPdf.js';
import { nactiPdfLib } from '../js/pdf/export.js';

const odpovedi = {
  nazev: 'Hala montáže', osoby: '40 osob, v noci 2 (ostraha)', vypinac: 'trafostanice T1', plyn: 'NE', fve: true, fveKwp: 460, fveVypinac: 'STOP FVE u NN rozvodny',
  latky: 'Technický benzin 200 l, sklad B\nAceton 50 l, laboratoř', lahve: 'NE', hydrant: 'u brány č. 2', hydrantPrutok: 6.5, hydrantOveren: true,
  zjisteni: 'EPS s přenosem na PCO, do 3 min', zmeny: 'Přístavba skladu 2021', shromazdiste: 'parkoviště u vrátnice',
};

test('každá otázka má cíl a unikátní id; otázek je přiměřeně', () => {
  assert.equal(new Set(OTAZKY.map((o) => o.id)).size, OTAZKY.length);
  assert.ok(OTAZKY.every((o) => o.kam.length));
  assert.ok(OTAZKY.length >= 25 && OTAZKY.length <= 40);
});

test('převzetí odpovědí do karty, OP a poznámek k ověření', () => {
  const p = M.novyProjekt({ typ: 'operativni_plan' }); M.pridejList(p, 'karta', 'OK');
  const cile = { karta: p.listy.find((l) => l.typ === 'karta').karta, opText: p.listy.find((l) => l.typ === 'op_text').opText, opZaklad: p.listy.find((l) => l.typ === 'op_zaklad').opZaklad, projekt: p };
  const n = navrhZDotazniku(odpovedi, cile);
  pouzijNavrh(n, new Set(n.map((_, i) => i)), cile);
  const k = cile.karta;
  assert.equal(k.objekt.nazev, 'Hala montáže'); assert.equal(k.media.hlavniUzaverPlynu, 'NE'); assert.equal(k.fve.pritomna, true); assert.equal(k.fve.vykonKWp, 460);
  // látky klienta přibudou jako nové řádky; předtištěné řádky vzoru (hořlaviny, výbušniny) vyplní zpracovatel
  assert.deepEqual(k.nebezpeci.map((x) => x.popis), ['', '', 'Technický benzin 200 l, sklad B', 'Aceton 50 l, laboratoř']);
  assert.deepEqual([k.vodniZdroje[0].typ, k.vodniZdroje[0].prutokLs, k.vodniZdroje[0].overenPrutok], ['hydrant', 6.5, true]);
  assert.equal(cile.opText.udaje.osoby, '40 osob, v noci 2 (ostraha)'); assert.equal(cile.opZaklad.ots.dobaZpozorovani, 'EPS s přenosem na PCO, do 3 min');
  assert.ok(p.poznamkyKOvereni.some((x) => x.text === 'Přístavba skladu 2021'));
  assert.deepEqual(navrhZDotazniku(odpovedi, cile), [], 'podruhé nic nového (žádné duplicity)');
});

test('neprázdné pole karty se nepřepíše bez výběru; „NE“ u látek se vepíše do předtištěných řádků', () => {
  const p = M.novyProjekt(), k = p.listy.find((l) => l.typ === 'karta').karta; k.objekt.nazev = 'Původní název';
  const n = navrhZDotazniku({ nazev: 'Nový', latky: 'NE', lahve: 'NE' }, { karta: k, projekt: p });
  const i = n.findIndex((x) => x.cesta === 'objekt.nazev'); assert.equal(n[i].stavajici, 'Původní název');
  pouzijNavrh(n, new Set(n.map((_, j) => j).filter((j) => j !== i)), { karta: k, projekt: p });
  assert.equal(k.objekt.nazev, 'Původní název'); assert.deepEqual(k.nebezpeci.map((x) => [x.popis, x.znackaId]), [['NE', 'DZP-003'], ['NE', 'DZP-053']]);
});

test('vyplnitelné PDF: pole pro všechny otázky, odpovědi s diakritikou se načtou zpět', async () => {
  const b = await dotaznikDoPdf({ odpovedi: { nazev: 'Hala č. 5' } }, { objekt: 'Hala č. 5' });
  const L = await nactiPdfLib(), d = await L.PDFDocument.load(b), f = d.getForm();
  assert.equal(f.getFields().length, OTAZKY.length);
  f.getTextField('plyn').setText('Kotelna – uzávěr u dveří, ŘŽČŠĚ'); f.getTextField('fveKwp').setText('460,5'); f.getDropdown('fve').select('ano'); f.getTextField('latky').setText('Benzin 200 l\nAceton 50 l');
  const r = await dotaznikZPdf(await d.save({ updateFieldAppearances: false }));
  assert.deepEqual(r.odpovedi, { nazev: 'Hala č. 5', plyn: 'Kotelna – uzávěr u dveří, ŘŽČŠĚ', fveKwp: 460.5, fve: true, latky: 'Benzin 200 l\nAceton 50 l' });
  const prazdne = await (await L.PDFDocument.create()); prazdne.addPage();
  await assert.rejects(dotaznikZPdf(await prazdne.save()), /formulářová pole/);
});

test('revize: průtok k hydrantu, který už v kartě je; látky místo dřívějšího „NE“', async () => {
  const { navrhZDotazniku } = await import('../js/dotaznik.js');
  const { pouzijNavrh } = await import('../js/prebirani.js');
  const { novyProjekt } = await import('../js/model.js');
  const p = novyProjekt({ typ: 'operativni_karta', nazev: 'D' }), k = p.listy.find((l) => l.typ === 'karta').karta;
  k.nebezpeci.push({ id: 'n1', popis: 'NE', hasivo: '', znackaId: null });
  k.vodniZdroje.push({ id: 'h1', typ: 'hydrant', popis: 'Polní ulice u č.p. 5', prutokLs: null, overenPrutok: false, objemM3: null, gps: { sirka: null, delka: null }, znackaId: null });
  const navrh = navrhZDotazniku({ hydrant: 'Polní ulice u č.p. 5', hydrantPrutok: 7.5, hydrantOveren: true, latky: 'propan-butan 2 x 33 kg' }, { karta: k, projekt: p });
  pouzijNavrh(navrh, new Set(navrh.map((_, i) => i).filter((i) => !navrh[i].neoznacit && !navrh[i].stavajici)), { karta: k, projekt: p });
  assert.deepEqual(k.vodniZdroje.map((h) => [h.prutokLs, h.overenPrutok]), [[7.5, true]]);
  assert.deepEqual(k.nebezpeci.map((x) => x.popis), ['', '', 'propan-butan 2 x 33 kg'], 'dřívější „NE“ bez značky odebráno, předtištěné řádky zůstaly');
  // jen průtok bez polohy → nabídne se k jedinému hydrantu, neoznačeně
  const n2 = navrhZDotazniku({ hydrantPrutok: 9 }, { karta: k, projekt: p });
  assert.equal(n2.length, 1); assert.ok(n2[0].neoznacit && /jediný hydrant/.test(n2[0].popis));
});
