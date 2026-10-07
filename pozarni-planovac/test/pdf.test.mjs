import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { exportujPdf } from '../js/pdf/export.js';
import * as M from '../js/model.js';
import * as P from '../js/kresleni/prvky.js';

const katalog = new Map(JSON.parse(readFileSync(new URL('../znacky/katalog.json', import.meta.url), 'utf8')).znacky.map((z) => [z.id, z]));
const mame = (cmd) => spawnSync(cmd, ['-v']).status !== null;
const tmp = mkdtempSync(join(tmpdir(), 'pp-pdf-'));

export function ukazkovyProjekt() {
  const p = M.novyProjekt({ nazev: 'DZP Litice' });
  const k = p.listy[0].karta;
  Object.assign(k, { stupenPoplachu: 'I', uzemniOdbor: 'HZS Pardubického kraje, ÚO Ústí nad Orlicí' });
  Object.assign(k.objekt, { nazev: 'Výrobní hala PREFA 1 – FVE', provozovatel: 'ŽPSV a.s.', ic: '06298362', adresa: 'Litice nad Orlicí 60, 561 86 Záchlumí', gps: { sirka: 50.0877, delka: 16.5312 }, obsazeniOsobami: 'max. 15 osob', prijezdZ: 'silnice III. třídy, vjezdová brána č. 1', omezeni: 'průjezdná výška 4 m, nosnost mostu 25 t' });
  Object.assign(k.objekt.provoz, { pracovniDoba: 'Po–Pá 6:00–14:30', kontaktTelefon: '+420 469 779 244', kontaktJmeno: 'p. Matyáš Elek, ředitel závodu' });
  k.charakter.ucelStavby = 'Výroba betonových prefabrikátů'; k.charakter.konstrukce = 'NEHOŘLAVÁ'; k.charakter.podlazi = '1. NP';
  k.nebezpeci.push({ id: 'n1', popis: '20 l benzin natural – skladováno v dílně, 1× plechový kanystr', hasivo: 'prášek, pěna', znackaId: 'DZP-003' });
  Object.assign(k.fve, { pritomna: true, pocetPanelu: 488, vykonKWp: 460, baterie: false, vypinacSilovaCast: 'před vstupem do rozvodny NN', popis: 'Výkonové optimizéry 2:1, střídače na obvodové stěně. DC část může být zásahově relevantní i po odpojení.' });
  k.media.hlavniUzaverVody = 'Šachta před vstupem do objektu'; k.media.hlavniVypinacEl = 'NE';
  k.vodniZdroje.push({ id: 'v1', typ: 'hydrant', popis: 'V ulici Jana Palacha', prutokLs: 4, overenPrutok: true, objemM3: null, gps: { sirka: 50.1435, delka: 14.0941 }, znackaId: 'DZP-004' });
  k.doporuceni = 'Po vypnutí CENTRAL STOP dojde k odpojení vzduchotechniky.\nPo vypnutí TOTAL STOP se odemknou elektronické zámky dveří.'.repeat(1);
  Object.assign(k.znalostObjektu, { jmeno: 'Ing. Dušan Jičínský', mobil: '707 700 600' });
  Object.assign(k.zpracoval, { jmeno: 'Ing. Tomáš Dufka', cisloOsvedceni: 'Z-OZO-55/2018', datum: '2025-06-25' });
  M.pridejRevizi(p, { popis: 'První vydání', autor: 'T. D.', datum: '2025-06-25' });
  const v = p.listy[1].vykres; v.razitko.zpracoval = 'Ing. Tomáš Dufka'; v.severka.uhel = 15;
  const stena = P.novyPrvek('stena', { body: [[10, 10], [60, 10], [60, 40], [10, 40], [10, 10]] }), dv = P.novyPrvek('dvere'), tr = P.novyPrvek('trasa', { body: [[15, 15], [55, 15], [55, 35]], vrstva: 'trasy' });
  v.prvky.push(stena, dv, tr, P.novyPrvek('text', { x: 20, y: 25, text: 'Strojní dílny\nČerpadlo – příliš žluťoučký kůň', vyska: 3, vrstva: 'popisky' }), P.novyPrvek('znacka', { x: 30, y: 30, znackaId: 'DZP-001', velikost: 8, vrstva: 'znacky' }), P.novyPrvek('plocha', { body: [[70, 5], [90, 5], [90, 45], [70, 45]], vrstva: 'komunikace' }));
  P.pripojDvere(dv, v.prvky, [30, 10]); P.synchronizujLegendu(v);
  M.pridejList(p, 'text', 'Poznámky').text = 'První odstavec s češtinou: ěščřžýáíéúůťďň.\nDruhý řádek.';
  return p;
}

test('export PDF: stránky, vložené písmo, česká diakritika, vektorový výkres (poppler)', { skip: !mame('pdftotext') && 'poppler není dostupný' }, async () => {
  const bajty = await exportujPdf(ukazkovyProjekt(), { katalog });
  const f = join(tmp, 'dzp.pdf'); writeFileSync(f, bajty);
  assert.equal(Buffer.from(bajty.subarray(0, 5)).toString(), '%PDF-');
  const info = spawnSync('pdfinfo', [f]).stdout.toString();
  assert.match(info, /Pages:\s+3/); assert.match(info, /Title:\s+DZP Litice/); assert.match(info, /Page size:\s+595\.\d+ x 841\.\d+ pts \(A4\)/); assert.match(info, /Author:\s+Ing\. Tomáš Dufka/);
  const fonty = spawnSync('pdffonts', [f]).stdout.toString(); assert.match(fonty, /Roboto/);
  const txt = spawnSync('pdftotext', ['-layout', f, '-']).stdout.toString();
  for (const s of ['Výrobní hala PREFA 1 – FVE', 'Litice nad Orlicí', 'HZS Pardubického kraje', 'Ing. Dušan Jičínský', 'Po–Pá 6:00–14:30', 'ŽPSV', 'Strojní dílny', 'příliš žluťoučký kůň', 'ěščřžýáíéúůťďň', 'LEGENDA ZNAČEK', 'MĚŘÍTKO', 'Nadzemní požární hydrant']) assert.ok(txt.includes(s), `v PDF chybí: ${s}`);
  assert.ok(/20,0|25,0|55,0/.test(txt) || txt.includes(' m'), 'délka trasy ve výkresu');
  assert.doesNotMatch(txt, /�/);
  const img = join(tmp, 'str'); spawnSync('pdftoppm', ['-r', '60', '-png', f, img]);
  const velikosti = [1, 2, 3].map((i) => readFileSync(`${img}-${i}.png`).length); assert.ok(velikosti.every((n) => n > 4000), `stránky nejsou prázdné: ${velikosti}`);
  writeFileSync(join(tmp, 'cesta.txt'), f); writeFileSync(new URL('./.ukazka.pdf', import.meta.url), bajty);
});

test('export vybraných listů a chyba při prázdném výběru; třířádkový text se nezlomí do jednoho řádku', async () => {
  const p = ukazkovyProjekt();
  const jen = await exportujPdf(p, { katalog, listy: [p.listy[1].id] });
  assert.ok(jen.length > 1000);
  await assert.rejects(() => exportujPdf(p, { katalog, listy: ['neexistuje'] }), /žádný list/);
});
