import test from 'node:test';
import assert from 'node:assert/strict';
import { prazdnySap, vypocetSaP, shrnutiSaP, sapJakoText, najdiProstor, PROSTORY } from '../js/sap.js';

const zaklad = () => {
  const d = prazdnySap();
  Object.assign(d, { tZP: 5, tOH: 2, prostor: '1.1', Qc: 2000, QcVolba: 'cas20' });
  d.jednotky.push({ id: 'a', nazev: 'HZS', druh: 'profi', L: 3, tBR: 3 }, { id: 'b', nazev: 'JSDH', druh: 'dobro', L: 6, tBR: 5 });
  return d;
};
const blizko = (a, b, eps = 0.05) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test('tabulka č. 1 je převzata (9 tříd, výrobní prostor Io 56,2 / Ip 11,2 / v1 1,2)', () => {
  const p = najdiProstor('1.1'); assert.deepEqual([p.io, p.ip, p.v1], [56.2, 11.2, 1.2]);
  assert.ok(PROSTORY.length > 70);
  assert.equal(najdiProstor('9.7').nazev, 'Lesy, kosodřevina');
});

test('doby, rádius, plocha požáru a hašení – kruhová forma (vzorce kap. 3.2, 4.1, 4.2)', () => {
  const { vysledky: v, chybi } = vypocetSaP(zaklad());
  assert.deepEqual(chybi, []);
  // tDO: HZS 2 + 60·3/45 = 6; JSDH 10 + 8 = 18; tR = 12; tVR = 5 + 2 + 6 + 3 = 16; t2 = 6; tuh = 5 (v1 ≤ 2); t3 = 12 + 5 − 3 + 5 = 19
  // R1 = 5·1,2 + 1,2·6 = 13,2; R = 13,2 + 0,5·1,2·19 = 24,6
  blizko(v.tR, 12); blizko(v.R, 24.6);
  blizko(v.Sp, Math.PI * 24.6 ** 2, 0.5); blizko(v.Sh, Math.PI * (24.6 ** 2 - 19.6 ** 2), 0.5);
  blizko(v.Qh, v.Sh * 11.2, 0.5);
  assert.equal(v.Nh, Math.ceil(v.Qh / 200)); assert.equal(v.NHa, Math.ceil(1.25 * 2 * v.Nh));
});

test('pravidlo 85 % plochy požárního úseku, úhlová a pravoúhlá forma, fronta hašení', () => {
  const d = zaklad(); d.plochaUseku = 500;
  // > 85 % úseku: plocha požáru = celý úsek; plochu hašení pak určuje fronta hašení (kap. 4.3, příklad str. 60–61)
  let r = vypocetSaP(d), v = r.vysledky; assert.equal(v.Sp, 500); assert.equal(v.Sh, null); assert.equal(v.Npr, undefined);
  assert.ok(r.chybi.some((x) => /fronta hašení Oh – hoří celá plocha/.test(x)));
  d.zpusob = 'fronta'; d.Oh = 20;
  v = vypocetSaP(d).vysledky; assert.equal(v.Sp, 500); assert.equal(v.Sh, 100); blizko(v.Qh, 20 * 56.2, 0.01);
  d.zpusob = 'plocha'; d.Oh = null;
  d.plochaUseku = null; d.forma = 'uhel'; d.uhel = '90';
  v = vypocetSaP(d).vysledky; blizko(v.Sp, 0.25 * Math.PI * 24.6 ** 2, 0.5);
  d.forma = 'pravouhla'; d.a = 20; d.n = 1;
  v = vypocetSaP(d).vysledky; blizko(v.Sp, 24.6 * 20, 0.01); blizko(v.Sh, 5 * 20, 0.01);
  d.zpusob = 'fronta'; d.Oh = 36;
  v = vypocetSaP(d).vysledky; blizko(v.Qh, 36 * 56.2, 0.01);
});

test('ochlazování nádrží, technika, voda, dýchací přístroj, dálková doprava a pěna (kap. 5.2–5.8)', () => {
  const d = zaklad(); d.forma = 'pravouhla'; d.a = 10;
  Object.assign(d, { nadrzD: 9, sousedniD: 9, sousedniM: 1, druzstvo: '1+5', Qc: 2500, vydatnost: 3600 });
  d.dych = { pL: 30, VL: 6, prace: 'stredni' }; d.dalkova = { Lh: 500, H: 10, prutok: '600', hadice: 'izolovane' };
  d.kyvadlo = { L: 3, Vnc: 3500, Qc: 2500, qv: 600 }; d.pena = { N: 1, qpr: 800, pp: 6 };
  const { vysledky: v } = vypocetSaP(d);
  blizko(v.Qo, Math.PI * 9 * 30 + 0.5 * Math.PI * 9 * 12, 0.5);
  blizko(v.To, (10 * 30 * 6) / 35, 0.01);
  assert.equal(v.Ncerp, Math.ceil((10 + 0.01 * 500 * 8 + 7.5) / 65));
  blizko(v.Vp, 1 * 0.01 * 800 * 6 * 10 * 3, 0.01);   // 1440 l = údaj tab. 5 pro P6 (800 l/min, 6 %)
  // + 1 družstvo 1+5 pro pěnotvornou proudnici (tabulka kap. 5.4: 2 pěnotvorné proudnice na družstvo)
  assert.equal(v.NA, Math.max(Math.ceil(v.Qp / 600), Math.ceil(v.Npr / 2)) + 1);
  assert.match(shrnutiSaP(d), /proudů/);
  assert.ok(sapJakoText(d).includes('Ochranná doba přístroje'));
});

test('neúplné vstupy se hlásí, výpočet nic nedomýšlí', () => {
  const { chybi, vysledky } = vypocetSaP(prazdnySap());
  assert.ok(chybi.length >= 3); assert.equal(vysledky.Npr, undefined);
  assert.match(shrnutiSaP(prazdnySap()), /není úplný/);
});

test('řešený příklad metodiky, montáž (str. 58–61): tVR 45, t3 16, R 57,6, celá hala, Qh 2 023,2', () => {
  const d = prazdnySap();
  // stanice HZS: tDO = 2 + 60·4,5/45 = 8; JSDHP II: tDO = 10 + 60·5,25/45 = 17 (str. 60); tBR první 2, poslední 4 min
  Object.assign(d, { tZP: 30, tOH: 5, prostor: '1.1', forma: 'pravouhla', a: 36, n: 1, plochaUseku: 2340, zpusob: 'fronta', Oh: 36, QcVolba: 'cas20', Qc: 2000 });
  d.jednotky.push({ id: 'a', nazev: 'Stanice HZS', druh: 'profi', L: 4.5, tBR: 2 }, { id: 'b', nazev: 'JSDHP II', druh: 'dobro', L: 5.25, tBR: 4 });
  const { vysledky: v, kroky, chybi } = vypocetSaP(d);
  assert.deepEqual(chybi, []);
  blizko(v.tVR, 45); blizko(v.t3, 16); blizko(v.R, 57.6, 0.001);
  assert.equal(v.Sp, 2340); assert.ok(v.cela, 'R/L = 88,6 % → celá plocha haly');
  blizko(v.Qh, 2023.2, 0.01);
  assert.match(kroky.find((k) => k.nazev === 'Doba volného rozvoje požáru').vzorec, /tBR\(Pr\).*str\. 60/);
  assert.doesNotMatch(shrnutiSaP(d), /Podle vzorce v metodice|nejednoznačnost/);
});

test('bez doby bojového rozvinutí poslední jednotky není výsledek (žádný tichý rádius k prvním proudům)', () => {
  const d = zaklad(); d.jednotky[1].tBR = null;
  const { vysledky: v, chybi } = vypocetSaP(d);
  assert.equal(v.Npr, undefined); assert.equal(v.R, null);
  assert.ok(chybi.some((x) => /poslední jednotky tBR/.test(x)));
  assert.match(shrnutiSaP(d), /není úplný/);
  // vědomá volba „první proudy“ je jen orientační a shrnutí to říká
  d.rPro = 'prvni'; assert.match(shrnutiSaP(d), /POZOR: rádius je počítán k nasazení prvních proudů/);
});

test('kap. 4.2: celá plocha při v1 > 2 m/min, u neuvedené v1, v malém prostoru a u kapalin', () => {
  const d = zaklad(); d.prostor = '3.1';   // sklady hořlavých kapalin, v1 = 2,5
  let r = vypocetSaP(d);
  assert.ok(r.chybi.some((x) => /plocha objektu nebo prostoru.*v1 = 2,5 m\/min > 2/.test(x)));
  d.plochaUseku = 5000; r = vypocetSaP(d);
  assert.equal(r.vysledky.Sp, 5000); assert.ok(r.chybi.some((x) => /fronta hašení Oh/.test(x)));
  d.zpusob = 'fronta'; d.Oh = 30; r = vypocetSaP(d);
  blizko(r.vysledky.Qh, 30 * 51.9, 0.01); assert.equal(r.vysledky.Sh, 150);
  const k = zaklad(); k.prostor = '3.14'; k.plochaUseku = 120; k.celaPlocha = 'kapaliny';   // benzin, v1 v tab. „–“
  r = vypocetSaP(k); assert.equal(r.vysledky.Sp, 120); assert.equal(r.vysledky.Sh, 120); blizko(r.vysledky.Qh, 120 * 24, 0.01);
  const m = zaklad(); m.plochaUseku = 40; m.celaPlocha = 'mistnost';
  r = vypocetSaP(m); assert.equal(r.vysledky.Sp, 40); assert.equal(r.vysledky.Sh, 40); assert.match(shrnutiSaP(m), /\(celá plocha\)/);
});

test('družstvo obslouží nejvýš jednu proudnici B; 1+2 proudnici B neobslouží', () => {
  const d = zaklad(); d.qprH = '400'; d.qprO = '400'; d.druzstvo = '1+8'; d.Qc = 2000;
  const v = vypocetSaP(d).vysledky;
  assert.ok(v.NA >= v.Npr, `${v.NA} automobilů pro ${v.Npr} proudnic B`);
  d.druzstvo = '1+2'; assert.ok(vypocetSaP(d).chybi.some((x) => /1\+2 obsluhuje jen proudnici C/.test(x)));
});

test('100% záloha hasičů, když doba lokalizace není kratší než ochranná doba dýchacího přístroje', () => {
  const d = zaklad(); d.dych = { pL: 20, VL: 4, prace: 'max' };   // To = 10·20·4/70 = 11,4 min < t3 = 19 min
  const v = vypocetSaP(d).vysledky;
  blizko(v.To, 800 / 70, 0.01); assert.ok(v.NHa100 > v.NHa);
  assert.match(shrnutiSaP(d), new RegExp(`přibližně ${v.NHa100} hasičů včetně 100% zálohy`));
  d.dych = { pL: 30, VL: 6, prace: 'stredni' };   // To = 51,4 min > t3
  assert.equal(vypocetSaP(d).vysledky.NHa100, undefined);
});

test('celkový počet automobilů pokryje i techniku k dodávce hasiva; záporné vstupy se nepřijmou', () => {
  const d = zaklad(); d.qprH = '800'; d.qprO = '800'; d.druzstvo = '1+8'; d.Qc = 800; d.QcVolba = 'vlastni';
  const v = vypocetSaP(d).vysledky;
  assert.equal(v.NAcelkem, Math.max(v.NA, v.NAN));
  assert.match(shrnutiSaP(d), new RegExp(`${v.NAcelkem} požární(ch)? automobil(y|ů)?\\b`));
  const z = zaklad(); z.tZP = -20;
  const r = vypocetSaP(z); assert.equal(r.vysledky.Npr, undefined); assert.ok(r.chybi.some((x) => /tZP \(nesmí být záporná\)/.test(x)));
  const i = zaklad(); i.ipVlastni = 0; assert.ok(vypocetSaP(i).chybi.some((x) => /vlastní Ip musí být kladné/.test(x)));
});

test('hořlavá kapalina hašená pěnou: voda jen na ochlazování (řešený příklad LTO, str. 63–64)', () => {
  const d = prazdnySap();
  Object.assign(d, { tZP: 5, tOH: 2, nadrzD: 9, nadrzIo: 30, sousedniD: 9, sousedniIo: 12, sousedniM: 1, Qc: 2000, QcVolba: 'cas20' });
  d.jednotky.push({ id: 'a', nazev: 'HZS', druh: 'profi', L: 3, tBR: 3 }, { id: 'b', nazev: 'JSDH', druh: 'dobro', L: 6, tBR: 5 });
  d.pena = { N: 1, qpr: 800, pp: 6 };
  const { vysledky: v, chybi } = vypocetSaP(d);
  assert.deepEqual(chybi, []);
  blizko(v.Qo, 848.2 + 169.6, 0.1);   // str. 64: chlazení hořící 848,2 + sousední 169,6 l/min
  assert.equal(v.Nh, 0); assert.equal(v.No, Math.ceil((848.23 + 169.65) / 200));
  assert.match(shrnutiSaP(d), /1 pěnotvorná proudnice, 4 požární automobily/);
});

test('vydatnost vody z ověřeného hydrantu v kartě, když není zadána (neověřený se nepoužije)', async () => {
  const { nastavKontextSaP, kontextSaP } = await import('../js/sap.js');
  const d = zaklad(), hydrant = (prutokLs, overenPrutok, popis) => ({ id: popis, typ: 'hydrant', popis, prutokLs, overenPrutok });
  const projekt = { listy: [{ typ: 'karta', karta: { vodniZdroje: [hydrant(20, false, 'neověřený'), hydrant(7.5, true, 'Polní'), hydrant(6, true, 'Lipová')] } }] };
  const k = kontextSaP(projekt);
  assert.equal(k.vydatnost.lmin, 450); assert.match(k.vydatnost.popis, /„Polní“ 7,5 l\/s × 60 \(největší z 2 ověřených hydrantů\)/);
  nastavKontextSaP(d, k);
  const krok = vypocetSaP(d).kroky.find((x) => x.nazev === 'Porovnání se zdrojem vody');
  assert.match(krok.vzorec, /vydatnost zdroje 450 l\/min \(vydatnost nezadána – z karty: ověřený průtok hydrantu „Polní“/);
  d.vydatnost = 1200;   // zadaná hodnota má přednost
  assert.doesNotMatch(vypocetSaP(d).kroky.find((x) => x.nazev === 'Porovnání se zdrojem vody').vzorec, /z karty/);
  assert.deepEqual(kontextSaP({ listy: [{ typ: 'karta', karta: { vodniZdroje: [hydrant(20, false, 'x')] } }] }), {});
});
