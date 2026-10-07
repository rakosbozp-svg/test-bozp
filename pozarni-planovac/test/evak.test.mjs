import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import { zkontrolujUplnost } from '../js/uplnost.js';
import { evakJakoText } from '../js/evakuace.js';
import { exportujPdf } from '../js/pdf/export.js';

const kody = (p) => zkontrolujUplnost(p).filter((n) => n.hladina === 'chyba').map((n) => n.kod);

test('evakuační plán: vlastní listy, DZP listy se nemíchají', () => {
  const p = M.novyProjekt({ nazev: 'Evak', typ: 'evakuacni_plan' });
  assert.deepEqual(p.listy.map((l) => l.typ), ['evak_text', 'pudorys']);
  assert.throws(() => M.pridejList(p, 'karta'), /nemíchají/);
  assert.throws(() => M.pridejList(p, 'situace'), /nemíchají/);
  assert.ok(M.pridejList(p, 'pudorys', '2. podlaží'));
  const d = M.novyProjekt();
  assert.throws(() => M.pridejList(d, 'evak_text'), /nemíchají/);
  assert.equal(p.listy[1].vykres.sit10m, false);
});

test('kontrola úplnosti § 33: prázdný plán hlásí všechny povinné body a/b/c/d/e/f', () => {
  const p = M.novyProjekt({ typ: 'evakuacni_plan' });
  const k = kody(p);
  for (const kod of ['EVAK_A_OSOBA', 'EVAK_A_MISTO', 'EVAK_B_OSOBY', 'EVAK_B_PROSTREDKY', 'EVAK_C_CESTY', 'EVAK_C_SHROMAZDISTE', 'EVAK_C_KONTROLA', 'EVAK_D_POMOC', 'EVAK_E_MATERIAL', 'EVAK_F_TRASA']) assert.ok(k.includes(kod), kod);
  assert.ok(!zkontrolujUplnost(p).some((n) => ['KARTA_POPLACH', 'SIT10', 'SEVERKA', 'LEGISLATIVA'].includes(n.kod)), 'DZP kontroly se na evakuaci nevztahují');
});

test('vyplněný plán s únikovou cestou nemá chyby; materiál bez střežení je chyba, „NE“ stačí', () => {
  const p = M.novyProjekt({ typ: 'evakuacni_plan' });
  const e = p.listy[0].evak;
  Object.assign(e.objekt, { nazev: 'Hala', adresa: 'Ulice 1', rozsah: '1. NP' });
  Object.assign(e.organizator, { jmeno: 'A. Novák' }); e.mistoRizeni = 'Vrátnice'; e.prostredky = 'NE'; e.cesty = 'Hlavním východem na parkoviště.';
  e.osoby.push({ id: 'o1', jmeno: 'B. Dvořák', funkce: 'vedoucí', ukol: 'Kontrola prostor' });
  e.shromazdiste.push({ id: 's1', popis: 'Parkoviště u brány' }); e.kontrolaPoctu.jmeno = 'C. Svoboda'; e.prvniPomoc = 'Lékárnička na vrátnici.';
  e.material = 'Sklad č. 2'; e.zpracoval.jmeno = 'Z. Zpracovatel';
  p.listy[1].vykres.prvky.push({ id: 'p1', druh: 'trasa', body: [[0, 0], [10, 0]], vrstva: 'trasy' });
  assert.deepEqual(kody(p), ['EVAK_E_STREZENI']);
  e.materialStrezeni = 'NE'; assert.deepEqual(kody(p), []);
  assert.ok(evakJakoText(e, p).includes('Parkoviště u brány'));
});

test('starší projekty bez druhu evakuace se načtou beze změny; evak data se doplní', () => {
  const p = M.nactiProjekt(M.serializuj(M.novyProjekt({ typ: 'evakuacni_plan' })));
  delete p.listy[0].evak.overeni; const q = M.migruj(p);
  assert.equal(q.listy[0].evak.overeni.datum, '');
});

test('PDF evakuačního plánu vznikne', async () => {
  const p = M.novyProjekt({ typ: 'evakuacni_plan' });
  const b = await exportujPdf(p, { listy: [p.listy[0].id], katalog: new Map() });
  assert.equal(Buffer.from(b.subarray(0, 5)).toString(), '%PDF-');
});
