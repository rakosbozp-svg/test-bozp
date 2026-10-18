// Přebírání údajů mezi operativní kartou a operativním plánem (stejný projekt nebo jiný uložený projekt).
// Vždy jen návrh: uživatel vidí, co se kam zapíše, a vybírá. Neprázdné cílové pole se bez souhlasu nepřepíše.
// Strukturované údaje karty (nebezpečí, vodní zdroje, PBZ) se do plánu převádějí jako text; opačně je nelze spolehlivě rozložit,
// proto se z plánu do karty přebírají jen jednoznačná pole.
import { dostan, nastav, zCisla } from './formular.js';

const nic = (v) => v === null || v === undefined || String(v).trim() === '';
const tx = (v) => (nic(v) ? '' : String(v).trim());
const radky = (arr) => arr.filter(Boolean).join('\n');

const PBZ = { eps: 'EPS', zdhpp: 'ZDHPP', apz: 'APZ', zdp: 'ZDP', shz: 'SHZ', pshz: 'PSHZ', zokt: 'ZOKT', pk: 'PK', vytahEvakuacni: 'Výtah evakuační', vytahPozarni: 'Výtah požární' };
const MEDIA = { hlavniUzaverVody: 'Hlavní uzávěr vody', vedlejsiUzaverVody: 'Vedlejší uzávěr vody', hlavniUzaverPlynu: 'Hlavní uzávěr plynu', vedlejsiUzaverPlynu: 'Vedlejší uzávěr plynu', hlavniUzaverTopeni: 'Hlavní uzávěr topení', vedlejsiUzaverTopeni: 'Vedlejší uzávěr topení', hlavniVypinacEl: 'Hlavní vypínač el. proudu', vedlejsiVypinacEl: 'Vedlejší vypínač el. proudu' };
const VODA = { hydrant: 'Vnější hydrant', nadrz: 'Požární nádrž', jiny: 'Jiný zdroj' };

export function textNebezpeci(k) {
  const n = k.nebezpeci.filter((x) => !nic(x.popis));
  if (n.length === 1 && n[0].popis.trim().toUpperCase() === 'NE') return 'NE';
  return radky(n.map((x) => `${x.popis.trim()}${nic(x.hasivo) ? '' : ` – vhodné hasivo: ${x.hasivo.trim()}`}`));
}
export const textPbz = (k) => radky(Object.entries(PBZ).filter(([c]) => !nic(k.pbz[c])).map(([c, n]) => `${n}: ${k.pbz[c].trim()}`));
export function textVody(k) {
  return radky(k.vodniZdroje.map((v) => [`${VODA[v.typ] || 'Zdroj'}${nic(v.popis) ? '' : ` – ${v.popis.trim()}`}`,
    v.prutokLs !== null && v.prutokLs !== undefined ? `, průtok ${zCisla(v.prutokLs)} l/s (${v.overenPrutok ? 'ověřen' : 'NEOVĚŘEN'})` : '',
    v.objemM3 !== null && v.objemM3 !== undefined ? `, objem ${zCisla(v.objemM3)} m³` : ''].join('')));
}
export function textRozvody(k) {
  const f = k.fve, o = Object.entries(MEDIA).filter(([c]) => !nic(k.media[c])).map(([c, n]) => `${n}: ${k.media[c].trim()}`);
  if (f.pritomna === true) o.push(`FVE: ${[f.vykonKWp != null ? `${zCisla(f.vykonKWp)} kWp` : '', f.pocetPanelu != null ? `${f.pocetPanelu} panelů` : '', f.baterie === true ? 'bateriové úložiště' : f.baterie === false ? 'bez baterie' : '', nic(f.vypinacSilovaCast) ? '' : `vypínač silové části: ${f.vypinacSilovaCast.trim()}`, tx(f.popis)].filter(Boolean).join(', ')}`);
  if (f.pritomna === false) o.push('FVE: NE');
  return radky(o);
}
const konstrukce = (c) => [['', c.konstrukce], ['stěny ', c.steny], ['příčky ', c.priccky], ['stropy ', c.stropy], ['střecha ', c.strecha]].filter(([, v]) => !nic(v)).map(([n, v]) => `${n}${v.trim()}`).join('; ');

// Návrh převzetí z operativní karty do operativního plánu. cile = { opText, opZaklad } (kterýkoli může chybět).
export function navrhZKarty(k, { opText, opZaklad }) {
  const o = [];
  const dej = (cil, data, cesta, popis, hodnota) => { if (!data || nic(hodnota)) return; const st = dostan(data, cesta); if (tx(st) === tx(hodnota)) return; o.push({ cil, cesta, popis, hodnota, stavajici: nic(st) ? null : String(st) }); };
  if (opText) {
    const c = k.charakter, b = { nazev: tx(k.objekt.nazev), podlazi: tx(c.podlazi), vyska: tx(c.celkovaVyskaM), pudorys: tx(c.pudorysM), konstrukce: konstrukce(c), useky: tx(c.pozarniUseky), vyuziti: tx(c.ucelStavby) };
    if (b.nazev && !opText.objekty.some((x) => tx(x.nazev).toLowerCase() === b.nazev.toLowerCase())) o.push({ cil: 'opText', pridat: 'objekty', popis: 'Budova (údaje z charakteru objektu)', hodnota: b, stavajici: null });
    dej('opText', opText, 'udaje.osoby', 'Osoby (obsazení)', tx(k.objekt.obsazeniOsobami));
    dej('opText', opText, 'udaje.latky', 'Nebezpečné látky a hasiva', textNebezpeci(k));
    dej('opText', opText, 'udaje.pbz', 'SHZ, EPS a další PBZ', textPbz(k));
    dej('opText', opText, 'udaje.rozvody', 'Uzávěry, vypínače a FVE', textRozvody(k));
    dej('opText', opText, 'voda.zdroje', 'Vodní zdroje', textVody(k));
    dej('opText', opText, 'komunikace.pokyny', 'Příjezd a omezení', radky([nic(k.objekt.prijezdZ) ? '' : `Příjezd z: ${k.objekt.prijezdZ.trim()}`, nic(k.objekt.omezeni) ? '' : `Omezení: ${k.objekt.omezeni.trim()}`]));
    dej('opText', opText, 'doporuceni', 'Doporučení pro velitele zásahu', tx(k.doporuceni));
    const tel = [];
    if (!nic(k.objekt.provoz.kontaktTelefon)) tel.push({ funkce: 'Kontakt na provoz', jmeno: tx(k.objekt.provoz.kontaktJmeno), telefon: tx(k.objekt.provoz.kontaktTelefon) });
    if (!nic(k.znalostObjektu.mobil) || !nic(k.znalostObjektu.jmeno)) tel.push({ funkce: 'Znalost objektu', jmeno: tx(k.znalostObjektu.jmeno), telefon: tx(k.znalostObjektu.mobil) });
    for (const t of tel) if (!opText.telefony.some((x) => tx(x.telefon) && tx(x.telefon) === t.telefon)) o.push({ cil: 'opText', pridat: 'telefony', popis: `Telefon – ${t.funkce}`, hodnota: t, stavajici: null });
  }
  if (opZaklad) {
    dej('opZaklad', opZaklad, 'ots.stupenPoplachu', 'Stupeň požárního poplachu', tx(k.stupenPoplachu));
    dej('opZaklad', opZaklad, 'ots.osoby', 'Počet osob a směnnost', tx(k.objekt.obsazeniOsobami));
    dej('opZaklad', opZaklad, 'ots.signalizace', 'EPS, ohlašovna', nic(k.pbz.eps) ? '' : `EPS: ${k.pbz.eps.trim()}`);
    dej('opZaklad', opZaklad, 'ots.zasobovaniVodou', 'Zásobování vodou', textVody(k).replace(/\n/g, '; '));
  }
  return o;
}

// Návrh převzetí z operativního plánu do karty. budova = položka opText.objekty (nebo null).
export function navrhZPlanu({ opText, opZaklad }, budova, k) {
  const o = [];
  const dej = (cesta, popis, hodnota) => { if (nic(hodnota)) return; const st = dostan(k, cesta); if (tx(st) === tx(hodnota)) return; o.push({ cil: 'karta', cesta, popis, hodnota: tx(hodnota), stavajici: nic(st) ? null : String(st) }); };
  if (budova) {
    dej('objekt.nazev', 'Objekt', budova.nazev); dej('charakter.ucelStavby', 'Účel stavby', budova.vyuziti); dej('charakter.podlazi', 'Podlaží', budova.podlazi);
    dej('charakter.celkovaVyskaM', 'Celková výška (m)', budova.vyska); dej('charakter.pudorysM', 'Půdorys (m)', budova.pudorys);
    dej('charakter.konstrukce', 'Konstrukce objektu', budova.konstrukce); dej('charakter.pozarniUseky', 'Požární úseky', budova.useky);
  }
  if (opText) { dej('objekt.obsazeniOsobami', 'Obsazení osobami', opText.udaje.osoby); dej('doporuceni', 'Doporučení pro velitele zásahu', opText.doporuceni); }
  if (opZaklad) dej('stupenPoplachu', 'Stupeň poplachu', opZaklad.ots.stupenPoplachu);
  return o;
}

const uid = () => `t_${Math.random().toString(36).slice(2, 10)}`;
// Zapíše vybrané položky návrhu. cile = { opText, opZaklad, karta, projekt }. Položka: cesta | pridat (nová položka kolekce) | polozka {kolekce, id, pole} | odebrat {kolekce, id}. Vrací počet zapsaných.
export function pouzijNavrh(navrh, vybrane, cile) {
  let n = 0;
  navrh.forEach((x, i) => {
    if (!vybrane.has(i)) return;
    const data = cile[x.cil]; if (!data) return;
    if (x.pridat) (data[x.pridat] ||= []).push({ id: uid(), ...x.hodnota });
    else if (x.odebrat) data[x.odebrat.kolekce] = (data[x.odebrat.kolekce] || []).filter((y) => y.id !== x.odebrat.id);
    else if (x.polozka) { const it = (data[x.polozka.kolekce] || []).find((y) => y.id === x.polozka.id); if (!it) return; it[x.polozka.pole] = x.hodnota; }   // pole položky kolekce (např. budova OP)
    else nastav(data, x.cesta, x.hodnota);
    n++;
  });
  return n;
}
