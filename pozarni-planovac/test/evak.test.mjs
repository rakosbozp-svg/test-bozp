import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import { zkontrolujUplnost } from '../js/uplnost.js';
import { evakJakoText } from '../js/evakuace.js';
import { exportujPdf } from '../js/pdf/export.js';

const vyplnPlan = (l) => {
  const v = l.vykres, e = v.evakPlan;
  Object.assign(e, { objekt: 'Hala', podlazi: '1. NP', zhotovitel: 'Z. Zpracovatel', datum: '2026-10-08', cisloPlanu: '001/1', cisloRevize: '1', pokynyPozar: 'Stiskněte tlačítko požárního poplachu', pokynyEvakuace: 'Opusťte objekt', jsteZde: { x: 1, y: 1, dx: 22, dy: -16, text: 'Jste zde' } });
  v.prvky.push({ id: 'p1', druh: 'trasa', body: [[0, 0], [10, 0]], vrstva: 'trasy' },
    { id: 'z1', druh: 'znacka', x: 1, y: 1, znackaId: 'EVAK-001', velikost: 8, vrstva: 'znacky' }, { id: 'z2', druh: 'znacka', x: 2, y: 2, znackaId: 'EVAK-002', velikost: 8, vrstva: 'znacky' });
};
const kody = (p) => zkontrolujUplnost(p).filter((n) => n.hladina === 'chyba').map((n) => n.kod);

test('evakuační plán: vlastní listy, DZP listy se nemíchají', () => {
  const p = M.novyProjekt({ nazev: 'Evak', typ: 'evakuacni_plan' });
  assert.deepEqual(p.listy.map((l) => l.typ), ['evak_text', 'evak_plan']);
  assert.throws(() => M.pridejList(p, 'karta'), /nemíchají/);
  assert.throws(() => M.pridejList(p, 'situace'), /nemíchají/);
  assert.throws(() => M.pridejList(p, 'pudorys'), /nemíchají/);
  assert.ok(M.pridejList(p, 'evak_plan', '2. podlaží'));
  const d = M.novyProjekt();
  assert.throws(() => M.pridejList(d, 'evak_text'), /nemíchají/);
  assert.equal(p.listy[1].vykres.sit10m, false); assert.equal(p.listy[1].vykres.format, 'A3');
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
  vyplnPlan(p.listy[1]);
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

test('evakuační značky: náhrada z DZP se hlásí, nahraná značka chybu odstraní, DZP značka je chyba', async () => {
  const { EVAK_SLOTY, stavSlotu } = await import('../js/evakznacky.js');
  const p = M.novyProjekt({ typ: 'evakuacni_plan' });
  assert.ok(p.evakZnacky && typeof p.evakZnacky === 'object');
  const hasici = EVAK_SLOTY.find((s) => s.nazev.startsWith('Přenosný'));
  assert.equal(stavSlotu(p, hasici), 'chybi');
  const v = p.listy[1].vykres;
  v.prvky.push({ id: 'z1', druh: 'znacka', x: 1, y: 1, znackaId: hasici.id, velikost: 8, vrstva: 'znacky' });
  assert.ok(kody(p).includes('EVAK_ZNACKA_CHYBI'));
  p.evakZnacky[hasici.id] = { png: 'data:image/png;base64,AAAA', soubor: 'hp.png' };
  assert.ok(!kody(p).includes('EVAK_ZNACKA_CHYBI'));
  v.prvky.push({ id: 'z2', druh: 'znacka', x: 2, y: 2, znackaId: 'DZP-001', velikost: 8, vrstva: 'znacky' });
  assert.ok(kody(p).includes('EVAK_ZNACKA_DZP'));
});

test('list Evakuační plán – podlaží: prázdný plán hlásí požadavky normy, vyplněný ne; měřítko a formát', () => {
  const p = M.novyProjekt({ typ: 'evakuacni_plan' }), l = p.listy[1];
  const k = kody(p);
  for (const kod of ['EVAK_PODLAZI', 'EVAK_ZHOTOVITEL', 'EVAK_DATUM', 'EVAK_CISLO_PLANU', 'EVAK_REVIZE', 'EVAK_POKYNY_POZAR', 'EVAK_POKYNY_EVAK', 'EVAK_JSTE_ZDE', 'EVAK_VYCHOD', 'EVAK_SHROMAZDISTE']) assert.ok(k.includes(kod), kod);
  vyplnPlan(l);
  const e = p.listy[0].evak; Object.assign(e.objekt, { nazev: 'Hala', adresa: 'x', rozsah: 'y' });
  assert.ok(!kody(p).some((x) => x.startsWith('EVAK_') && !x.startsWith('EVAK_A') && !x.startsWith('EVAK_B') && !x.startsWith('EVAK_C') && !x.startsWith('EVAK_D') && !x.startsWith('EVAK_E') && x !== 'EVAK_ROZSAH'));
  l.vykres.meritko.pomer = 500; assert.ok(kody(p).includes('EVAK_MERITKO'));
  l.vykres.meritko.pomer = 100; l.vykres.format = 'A4'; assert.ok(kody(p).includes('EVAK_FORMAT'));
  l.vykres.evakPlan.kategorie = 'mistnost'; assert.ok(!kody(p).includes('EVAK_FORMAT'));
  l.vykres.prvky.find((x) => x.id === 'z1').velikost = 5; assert.ok(kody(p).includes('EVAK_ZNACKA_VELIKOST'));
});

test('vykreslení listu evakuačního plánu: záhlaví, rozměry A3, šipky únikové cesty, Jste zde, popisové pole', async () => {
  const { renderListu } = await import('../js/kresleni/render.js');
  const p = M.novyProjekt({ typ: 'evakuacni_plan' }), l = p.listy[1]; vyplnPlan(l);
  const svg = renderListu(l.vykres, { objektNazev: 'Hala', nazevListu: l.nazev, znacky: new Map(), symbolHref: () => '', prilohy: {} });
  assert.ok(svg.includes('ÚNIKOVÝ PLÁN') && svg.includes('viewBox="0 0 420 297"') && svg.includes('data-jstezde') && svg.includes('BEZPEČNOSTNÍ POKYNY') && svg.includes('LEGENDA'));
  assert.ok(svg.includes('Zhotovitel') && svg.includes('Číslo revize') && svg.includes('1. NP') && !svg.includes('NaN'));
  l.vykres.orientace = 'na_vysku'; l.vykres.format = 'A2';
  assert.ok(renderListu(l.vykres, { objektNazev: '', nazevListu: '', znacky: new Map(), symbolHref: () => '', prilohy: {} }).includes('viewBox="0 0 420 594"'));
});
