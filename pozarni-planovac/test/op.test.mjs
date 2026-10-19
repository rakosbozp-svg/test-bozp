import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import { zkontrolujUplnost } from '../js/uplnost.js';
import { odhadSaP, souhrnOdhadu, SCHEMA_ZAKLAD, SCHEMA_TEXT } from '../js/operativniplan.js';
import { schemaJakoText } from '../js/textlisty.js';
import { exportujPdf } from '../js/pdf/export.js';

const kody = (p) => zkontrolujUplnost(p).filter((n) => n.hladina === 'chyba').map((n) => n.kod);

test('operativní plán: listy podle Hanušky, evakuační listy nepatří, migrace doplní pole', () => {
  const p = M.novyProjekt({ typ: 'operativni_plan' });
  assert.deepEqual(p.listy.map((l) => l.typ), ['op_zaklad', 'op_sap', 'op_text', 'situace', 'pudorys']);
  assert.throws(() => M.pridejList(p, 'evak_plan'), /nemíchají/);
  assert.ok(M.pridejList(p, 'karta'));
  assert.throws(() => M.pridejList(M.novyProjekt(), 'op_zaklad'), /nemíchají/);
  const q = M.nactiProjekt(M.serializuj(p)); delete q.listy[0].opZaklad.sap; assert.equal(M.migruj(q).listy[0].opZaklad.sap.provadi, null);
});

test('kontrola úplnosti operativního plánu', () => {
  const p = M.novyProjekt({ typ: 'operativni_plan' });
  for (const k of ['OP_OTS_ROZSAH', 'OP_VARIANTA_MISTO', 'OP_SAP_ROZHODNUTI', 'OP_OBJEKTY', 'OP_VODA', 'OP_KOMUNIKACE', 'OP_DOPORUCENI']) assert.ok(kody(p).includes(k), k);
  const z = p.listy.find((l) => l.typ === 'op_zaklad').opZaklad, t = p.listy.find((l) => l.typ === 'op_text').opText;
  z.ots.rozsahPriloh = 'Situace, půdorys haly'; z.varianta.misto = 'Hala montáže'; z.sap.provadi = true;
  assert.ok(kody(p).includes('OP_SAP_VYSLEDEK'));
  z.sap.vysledek = '5× CAS 25, 30 hasičů';
  t.objekty.push({ id: 'o1', nazev: 'Montáž' }); t.voda.zdroje = 'Hydranty 3600 l/min'; t.komunikace.stav = 'Vyhovují'; t.doporuceni = 'Sledovat kabelový kanál';
  assert.ok(!kody(p).some((k) => k.startsWith('OP_')));
  assert.ok(zkontrolujUplnost(p).some((n) => n.kod === 'OP_DOPORUCENI_ENERGIE'));
  p.listy = p.listy.filter((l) => l.typ !== 'situace'); assert.ok(kody(p).includes('OP_SITUACE_CHYBI'));
});

test('hrubý odhad SaP podle pomůcky ČAHD 11/2011', () => {
  assert.deepEqual(odhadSaP({ prostor: 'prumysl', zpusob: 'plocha', hodnota: 120, qpr: 200, k: 2 }), { qhp: 1200, npr: 6, nha: 15, q: 200, ip: 10 });
  assert.equal(odhadSaP({ prostor: 'prumysl', zpusob: 'fronta', hodnota: 20, qpr: 200 }).qhp, 1000);
  assert.equal(odhadSaP({ prostor: 'byty', zpusob: 'plocha', hodnota: 50, qpr: 200 }).npr, 2);
  assert.equal(odhadSaP({ prostor: 'les', zpusob: 'plocha', hodnota: 0, qpr: 200 }), null);
  assert.equal(odhadSaP({ prostor: 'les', zpusob: 'plocha', hodnota: 10, qpr: null }), null);
  assert.match(souhrnOdhadu([{ prostor: 'prumysl', zpusob: 'plocha', hodnota: 120, qpr: 200 }]), /1[\s ]?200 l\/min, 6 proudů/);
});

test('text a PDF operativního plánu', async () => {
  const p = M.novyProjekt({ typ: 'operativni_plan' }), z = p.listy.find((l) => l.typ === 'op_zaklad').opZaklad;
  z.ots.rozsahPriloh = 'Situace a půdorys'; z.useky.push({ id: 'u1', nazev: 'Montáž', prostor: 'prumysl', zpusob: 'plocha', hodnota: 120, qpr: 200, k: 2 });
  const t = schemaJakoText(z, SCHEMA_ZAKLAD);
  assert.ok(t.includes('Situace a půdorys') && t.includes('6 proudů') && t.includes('Celkem'));
  assert.ok(schemaJakoText(p.listy.find((l) => l.typ === 'op_text').opText, SCHEMA_TEXT).includes('DOPORUČENÍ PRO VELITELE ZÁSAHU'));
  const b = await exportujPdf(p, { listy: [p.listy.find((l) => l.typ === 'op_zaklad').id, p.listy.find((l) => l.typ === 'op_text').id], katalog: new Map() });
  assert.equal(Buffer.from(b.subarray(0, 5)).toString(), '%PDF-');
});
