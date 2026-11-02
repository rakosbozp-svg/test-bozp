// Operativní karta podle vzoru HZS SČK (list A4): rozvržení, jedna strana A4, migrace starší karty, kontrola úplnosti.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import * as M from '../js/model.js';
import { exportujPdf } from '../js/pdf/export.js';
import { sestavKartu, gpsText, datumCz } from '../js/kartaData.js';
import { rozvrzeniKarty, umistiBunky } from '../js/kartaRozvrzeni.js';
import { zkontrolujUplnost } from '../js/uplnost.js';
import { naCislo, ctiSouradnici } from '../js/formular.js';
import { cisloZOdpovedi } from '../js/dotaznik.js';
import { rozborPbr, navrhZPbr } from '../js/pbr.js';
import { pouzijNavrh } from '../js/prebirani.js';

const katalog = new Map(JSON.parse(readFileSync(new URL('../znacky/katalog.json', import.meta.url), 'utf8')).znacky.map((z) => [z.id, z]));
const mame = (cmd) => spawnSync(cmd, ['-v']).status !== null;
const tmp = mkdtempSync(join(tmpdir(), 'pp-karta-'));
const kody = (p) => new Set(zkontrolujUplnost(p).map((x) => x.kod));

// Ukázková data přímo ze vzoru HZS SČK (MŠ Kladno, podklady/VZOR_operativni_karta_list_A4.docx).
function vzorovaKarta(k) {
  k.stupenPoplachu = 'I'; k.uzemniOdbor = 'Kladno';
  Object.assign(k.objekt, { nazev: 'MATEŘSKÁ ŠKOLA', provozovatel: 'Město Kladno', ic: '01010101', adresa: 'Kladno, Jana Palacha 1970', gps: { sirka: 50.1428769, delka: 14.0944197 },
    provoz: { pracovniDoba: 'Po–Pá 6:30–16:00', kontaktTelefon: '777 000 000', kontaktJmeno: 'Bc. Jana Nováková, ředitelka MŠ' },
    obsazeniOsobami: '65 dětí, 16 zaměstnanců', prijezdZ: 'ul. Zdeňka Petříka', omezeni: 'průjezdná výška: 4 m, nosnost mostu 25 t' });
  Object.assign(k.charakter, { ucelStavby: 'Mateřská škola, věk dětí 2 až 6 let', podlazi: '1. PP – 1. NP', pudorysM: '12 X 16', konstrukce: 'NEHOŘLAVÁ', unikoveCesty: '1', celkovaVyskaM: '5',
    steny: 'Porotherm', priccky: 'sádrokarton', vytahy: '1 X', vytahEvakuacni: true, vytahPozarni: false, zastavenaPlochaM2: '137', stropy: 'beton', strecha: 'Dřevěná konstrukce, betonová taška', typUnikoveCesty: 'CHÚC A 1', pozarniUseky: 'učebny, kanceláře, kotelna' });
  Object.assign(k.nebezpeci[0], { popis: '20 l benzin natural – skladováno v místnosti dílna školníka -1.PP, 1 x plechový kanystr', hasivo: 'prášek, pěna' });
  k.nebezpeci[1].popis = 'NE';
  Object.assign(k.fve, { pritomna: true, popis: '15 polí 3x12 m', vykonKWp: 25, vypinacSilovaCast: 'v technické místnosti', hasivo: 'prášek, CO₂' });
  Object.assign(k.media, { hlavniUzaverPlynu: 'V kotelně po pravé straně', hlavniUzaverVody: 'Šachta před vstupem do objektu', hlavniUzaverTopeni: 'NE', hlavniVypinacEl: 'Vstupní chodba do objektu', totalStop: 'NE', centralStop: 'Vstupní chodba do objektu' });
  Object.assign(k.pbz, { ktpo: 'U vjezdové brány', oppo: 'místnost „ŘEDITELNA“', eps: 'ANO', zdhpp: 'NE', apz: 'NE', zdp: 'ANO', shz: 'NE', pshz: 'NE', zokt: 'NE', pk: 'NE' });
  k.vodniZdroje.push({ id: 'v1', typ: 'hydrant', popis: 'V ulici Jana Palacha', prutokLs: 4, overenPrutok: true, objemM3: null, gps: { sirka: 50.1435578, delka: 14.09413 }, znackaId: 'DZP-004' },
    { id: 'v2', typ: 'nadrz', popis: 'Požární nádrž', prutokLs: null, overenPrutok: false, objemM3: 100, gps: { sirka: 50.1435578, delka: 14.09413 }, znackaId: 'DZP-022' });
  k.doporuceni = 'Po vypnutí CENTRAL STOP dojde k odpojení vzduchotechniky a sjetí výtahů do přízemí.\nPo vypnutí TOTAL STOP dojde k odpojení nouzového osvětlení, odemknou se všechny elektronické zámky dveří.\nFVE: DC část zůstává pod napětím.';
  Object.assign(k.znalostObjektu, { jmeno: 'Zdeněk Svoboda', mobil: '773 000 000', funkce: 'školník' });
  Object.assign(k.zpracoval, { jmeno: 'Ing. Josef Novák', cisloOsvedceni: 'Z-OZO 111/0000', datum: '2020-01-01' });
  Object.assign(k.schvalil, { jmeno: 'Ing. Karel Novák', funkce: 'ředitel MŠ Neználek', datum: '2020-01-01' });
}
const projektSeVzorem = () => { const p = M.novyProjekt({ nazev: 'MŠ Kladno' }); vzorovaKarta(p.listy[0].karta); M.pridejRevizi(p, { popis: 'první vydání', datum: '2020-01-01' }); return p; };

test('nová karta má předtištěné řádky vzoru (hořlaviny, výbušniny) a pole TOTAL/CENTRAL STOP, KTPO, OPPO', () => {
  const k = M.novyProjekt().listy[0].karta;
  assert.deepEqual(k.nebezpeci.map((x) => [x.popis, x.znackaId]), [['', 'DZP-003'], ['', 'DZP-053']]);
  assert.deepEqual(Object.keys(k.media), ['hlavniUzaverPlynu', 'hlavniUzaverVody', 'hlavniUzaverTopeni', 'hlavniVypinacEl', 'totalStop', 'centralStop']);
  assert.ok('ktpo' in k.pbz && 'oppo' in k.pbz && !('vytahEvakuacni' in k.pbz));
});

test('mřížka vzoru: každý řádek tabulky má 190 mm, STUPEŇ POPLACHU přes 5 řádků', () => {
  const R = rozvrzeniKarty(sestavKartu(projektSeVzorem().listy[0].karta, projektSeVzorem()));
  for (const t of R.tabulky) {
    const radky = umistiBunky(t);
    let presah = 0, zbyva = 0;
    for (const r of radky) {
      const sirka = r.bunky.reduce((a, b) => a + b.w, 0) + (zbyva > 0 ? presah : 0);
      assert.ok(Math.abs(sirka - 190) < 0.05, `řádek má ${sirka} mm`);
      if (zbyva > 0) zbyva--;
      const rs = r.bunky.find((b) => (b.rowspan || 1) > 1); if (rs) { presah = rs.w; zbyva = rs.rowspan - 1; }
    }
  }
  assert.equal(R.tabulky[0].radky[0].bunky[1].rowspan, 5);
});

test('obsah karty: GPS ve tvaru vzoru, FVE „NE“ má vlastní řádek, datum a revize česky', () => {
  assert.equal(gpsText({ sirka: 50.1428769, delka: 14.0944197 }), '50.1428769N, 14.0944197E');
  assert.equal(gpsText({ sirka: 50.14, delka: -1.5 }), '50.14N, 1.5W');
  assert.equal(datumCz('2020-01-01'), '1. 1. 2020');
  const p = projektSeVzorem(), k = p.listy[0].karta;
  k.fve.pritomna = false;
  const d = sestavKartu(k, p);
  assert.equal(d.fve.text, 'NE');
  assert.equal(d.revize[0], 'č. 1 (1. 1. 2020): první vydání');
  assert.deepEqual(d.pbz.map((x) => x.zkratka), ['EPS', 'ZDP']);
  assert.match(d.vody[0].text, /^V ulici Jana Palacha – průtok 4 l\/s, GPS: 50\.1435578N, 14\.09413E \(vzdušnou čarou cca \d+ m od objektu\)$/);
  k.fve.pritomna = true; k.fve.pocetPanelu = 1;
  assert.match(sestavKartu(k, p).fve.text, /^1 panel, výkon 25 kWp/);
});

test('PDF: karta se vzorovými daty HZS SČK je na jedné straně A4 a má okénka vzoru (poppler)', { skip: !mame('pdftotext') && 'poppler není dostupný' }, async () => {
  const p = projektSeVzorem(), varovani = [];
  const b = await exportujPdf(p, { katalog, listy: [p.listy[0].id], varovani });
  const f = join(tmp, 'vzor.pdf'); writeFileSync(f, b);
  assert.match(spawnSync('pdfinfo', [f]).stdout.toString(), /Pages:\s+1\b/);
  assert.deepEqual(varovani, []);
  const txt = spawnSync('pdftotext', ['-layout', f, '-']).stdout.toString();
  for (const s of ['STUPEŇ POPLACHU', 'Stanice HZS', '50.1428769N, 14.0944197E', 'UZÁVĚRY', 'KTPO', 'OPPO', '*EPS', '*ZDP', 'ZNALOST O OBJEKTU MÁ:', 'JMÉNO A PŘÍJMENÍ', 'ČÍSLO OSVĚDČENÍ', 'FUNKCE', 'hasivo: prášek, CO2']) assert.ok(txt.includes(s), `v PDF chybí: ${s}`);
  assert.doesNotMatch(txt, /(^|[^U])ZÁVĚRY/m, 'nadpis je UZÁVĚRY, ne ZÁVĚRY');
});

test('PDF: příliš dlouhá karta pokračuje na další straně, nic se neztratí a export upozorní (poppler)', { skip: !mame('pdftotext') && 'poppler není dostupný' }, async () => {
  const p = projektSeVzorem(), k = p.listy[0].karta, varovani = [];
  k.doporuceni += `\n${Array.from({ length: 40 }, (_, i) => `Pokyn ${i + 1}: shromaždiště je na hřišti za budovou, děti vede učitelka.`).join('\n')}\nPOSLEDNÍ ŘÁDEK DOPORUČENÍ`;
  const b = await exportujPdf(p, { katalog, listy: [p.listy[0].id], varovani });
  const f = join(tmp, 'dlouha.pdf'); writeFileSync(f, b);
  assert.match(spawnSync('pdfinfo', [f]).stdout.toString(), /Pages:\s+2\b/);
  assert.equal(varovani.length, 1); assert.match(varovani[0], /nevešla na jednu stranu A4.*Hanuška 1996, kap\. 3\.1/);
  const txt = spawnSync('pdftotext', ['-layout', f, '-']).stdout.toString();
  for (const s of ['Pokyn 1:', 'Pokyn 40:', 'POSLEDNÍ ŘÁDEK DOPORUČENÍ', 'ČÍSLO OSVĚDČENÍ']) assert.ok(txt.includes(s), `chybí: ${s}`);
});

test('migrace starší karty: vedlejší uzávěry do „mimo vzor“, výtahy z PBZ do charakteru, nic se neztratí', () => {
  const p = M.novyProjekt(), k = p.listy[0].karta;
  delete k.media.totalStop; delete k.media.centralStop; delete k.pbz.ktpo; delete k.pbz.oppo; delete k.mimoVzor; delete k.charakter.vytahEvakuacni; delete k.charakter.vytahPozarni;
  Object.assign(k.media, { vedlejsiUzaverVody: 'NE', vedlejsiUzaverPlynu: 'kotelna vpravo', vedlejsiUzaverTopeni: '', vedlejsiVypinacEl: 'rozvaděč R2' });
  Object.assign(k.pbz, { vytahEvakuacni: '1 x', vytahPozarni: 'NE' });
  const m = M.migruj(JSON.parse(JSON.stringify(p))).listy[0].karta;
  assert.deepEqual(m.mimoVzor, [{ nazev: 'Vedlejší uzávěr plynu', hodnota: 'kotelna vpravo' }, { nazev: 'Vedlejší vypínač el. proudu', hodnota: 'rozvaděč R2' }]);
  assert.ok(!('vedlejsiUzaverVody' in m.media) && !('vytahEvakuacni' in m.pbz));
  assert.deepEqual([m.charakter.vytahEvakuacni, m.charakter.vytahPozarni, m.charakter.vytahy], [true, false, '1 x']);
  assert.equal(m.media.totalStop, ''); assert.equal(m.pbz.ktpo, '');
  assert.ok(kody({ ...p, listy: [{ ...p.listy[0], karta: m }, p.listy[1]] }).has('MIMO_VZOR'));
});

test('kontrola karty: „NE“ nejde u názvu, adresy a zpracovatele; stupeň poplachu jen upozornění; PBZ jedním hlášením', () => {
  const p = projektSeVzorem(), k = p.listy[0].karta;
  assert.ok(![...zkontrolujUplnost(p)].some((x) => x.hladina === 'chyba'), 'vzorová karta nemá chyby');
  k.objekt.nazev = 'NE'; k.zpracoval.cisloOsvedceni = 'ne';
  const n = zkontrolujUplnost(p), nal = (kod) => n.find((x) => x.kod === kod);
  assert.equal(nal('ID_OBJEKT').hladina, 'chyba'); assert.match(nal('OSVEDCENI').text, /§ 11 odst\. 1 nebo 2/);
  k.stupenPoplachu = ''; assert.equal(zkontrolujUplnost(p).find((x) => x.kod === 'KARTA_POPLACH').hladina, 'upozorneni');
  k.pbz.eps = ''; k.pbz.pk = '';
  const pbz = zkontrolujUplnost(p).filter((x) => x.kod === 'PBZ');
  assert.equal(pbz.length, 1); assert.match(pbz[0].text, /EPS, PK/);
  k.doporuceni = 'Děti evakuuje personál.';
  assert.ok(kody(p).has('DOPORUCENI_ENERGIE'));
  assert.ok(!zkontrolujUplnost(p).some((x) => /pudorysM|hlavniUzaverVody|vytahEvakuacni/.test(x.text)), 'hlášení nesou popisky, ne interní klíče');
});

test('čísla: tisíce s mezerou, souřadnice se světovou stranou; z dotazníku jen jednoznačné číslo', () => {
  assert.equal(naCislo('1 200'), 1200); assert.equal(naCislo('1 250,5'), 1250.5); assert.ok(Number.isNaN(naCislo('49,5 kWp'))); assert.ok(Number.isNaN(naCislo('1e3')));
  assert.equal(ctiSouradnici('50.1428769N'), 50.1428769); assert.equal(ctiSouradnici('W 1,5'), -1.5);
  assert.equal(cisloZOdpovedi('49,5 kWp'), 49.5); assert.equal(cisloZOdpovedi('1 200 ks'), 1200); assert.equal(cisloZOdpovedi('cca 8 l/s'), 8);
  assert.equal(cisloZOdpovedi('4–6 l/s'), null); assert.equal(cisloZOdpovedi('6,5 l/s (zkouška 2024)'), null); assert.equal(cisloZOdpovedi('nevím'), null);
});

test('PBŘ: TOTAL STOP jde do vlastního okénka karty, PBZ jako „NE“ / „ANO“; víceřádkový text se do jednořádkového pole nespojí natvrdo', () => {
  const p = M.novyProjekt(), k = p.listy[0].karta;
  const r = rozborPbr([['Hlavní vypínač elektrické energie TOTAL STOP je umístěn v zádveří u hlavního vstupu.', 'EPS – elektrická požární signalizace: V objektu se nenavrhuje.']], { jePbr: true });
  const navrh = navrhZPbr(r.nalezy, { karta: k, projekt: p });
  const ts = navrh.find((x) => x.cesta === 'media.totalStop'), eps = navrh.find((x) => x.cesta === 'pbz.eps');
  assert.equal(ts.hodnota, 'v zádveří u hlavního vstupu (dle PBŘ)'); assert.match(ts.popis, /^TOTAL STOP/);
  assert.equal(eps.hodnota, 'NE');
  pouzijNavrh([{ cil: 'karta', cesta: 'objekt.obsazeniOsobami', hodnota: 'denní směna 24 osob\nnoční směna 6 osob' }], new Set([0]), { karta: k });
  assert.equal(k.objekt.obsazeniOsobami, 'denní směna 24 osob; noční směna 6 osob');
});
