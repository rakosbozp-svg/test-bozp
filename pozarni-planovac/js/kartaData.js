// Obsah operativní karty jako prostá data (bez HTML). Jediný zdroj pro náhled na obrazovce i pro PDF, aby se nikdy nerozešly.
// Rozvržení do okének vzoru HZS SČK je v js/kartaRozvrzeni.js.
import { zCisla } from './formular.js';
import { PBZ, stavPbz, upresneniPbz } from './kartaPole.js';
import { vzdalenostM } from './geo.js';

const prazdne = (v) => v === null || v === undefined || String(v).trim() === '';
const tx = (v) => (prazdne(v) ? '' : String(v).trim());
// datum z formuláře (RRRR-MM-DD) → „1. 1. 2020“
export const datumCz = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d ?? '')); return m ? `${+m[3]}. ${+m[2]}. ${m[1]}` : tx(d); };
// 1 panel, 2–4 panely, 5 panelů (čeština)
export const sklonuj = (n, [jeden, dva, pet]) => { const a = Math.abs(n); return a === 1 ? jeden : a >= 2 && a <= 4 && Number.isInteger(a) ? dva : pet; };
// GPS ve tvaru vzoru: „50.1428769N, 14.0944197E“ (nejvýš 7 desetinných míst, jak je uživatel zadal)
const souradnice = (v, kladna, zaporna) => `${Number(Math.abs(v).toFixed(7))}${v < 0 ? zaporna : kladna}`;
export const gpsText = (g) => (g && Number.isFinite(g.sirka) && Number.isFinite(g.delka) ? `${souradnice(g.sirka, 'N', 'S')}, ${souradnice(g.delka, 'E', 'W')}` : '');

function textFve(f) {
  if (f.pritomna === false) return { text: 'NE', hasivo: '' };
  if (f.pritomna !== true) return { text: '', hasivo: '' };
  const n = Number.isFinite(f.pocetPanelu) ? f.pocetPanelu : null;
  const hlavni = [n !== null ? `${n} ${sklonuj(n, ['panel', 'panely', 'panelů'])}` : '', Number.isFinite(f.vykonKWp) ? `výkon ${zCisla(f.vykonKWp)} kWp` : 'výkon … kWp',
    f.baterie === true ? 's bateriovým úložištěm' : f.baterie === false ? 'bez bateriového úložiště' : ''].filter(Boolean).join(', ');
  return { text: [hlavni + (tx(f.vypinacSilovaCast) ? `; vypínač silové části: ${tx(f.vypinacSilovaCast)}` : ''), tx(f.popis)].filter(Boolean).join('\n'), hasivo: tx(f.hasivo) };
}

function textVody(v, gpsObjektu) {
  const prutok = v.typ === 'hydrant' && Number.isFinite(v.prutokLs) ? ` – průtok ${zCisla(v.prutokLs)} l/s${v.overenPrutok ? '' : ' (neověřeno)'}` : '';
  const objem = v.typ === 'nadrz' && Number.isFinite(v.objemM3) ? ` – ${zCisla(v.objemM3)} m³` : '';
  const g = gpsText(v.gps), d = vzdalenostM(gpsObjektu, v.gps);
  const vzd = d === null ? '' : ` (vzdušnou čarou cca ${(d < 100 ? Math.round(d / 5) * 5 : Math.round(d / 10) * 10).toLocaleString('cs-CZ')} m od objektu)`;
  return `${tx(v.popis)}${prutok}${objem}${g ? `, GPS: ${g}` : ''}${vzd}`;
}

export function sestavKartu(k, projekt) {
  const o = k.objekt, c = k.charakter, m = k.media, p = k.pbz;
  const pbzAno = PBZ.filter(([klic]) => stavPbz(p[klic]) === true).map(([klic, zkratka]) => ({ zkratka, upresneni: upresneniPbz(p[klic]) }));
  return {
    hlava: { stupen: tx(k.stupenPoplachu), stanice: tx(k.uzemniOdbor), objekt: tx(o.nazev), provozovatel: tx(o.provozovatel), ic: tx(o.ic), adresa: tx(o.adresa), gps: gpsText(o.gps),
      pracovniDoba: tx(o.provoz.pracovniDoba), kontakt: [tx(o.provoz.kontaktTelefon), tx(o.provoz.kontaktJmeno)].filter(Boolean).join(' – '), obsazeni: tx(o.obsazeniOsobami), prijezd: tx(o.prijezdZ), omezeni: tx(o.omezeni) },
    charakter: { ucel: tx(c.ucelStavby), podlazi: tx(c.podlazi), pudorys: tx(c.pudorysM), konstrukce: tx(c.konstrukce), unikoveCesty: tx(c.unikoveCesty), vyska: tx(c.celkovaVyskaM),
      steny: tx(c.steny), priccky: tx(c.priccky), vytahy: tx(c.vytahy), vytahE: c.vytahEvakuacni === true, vytahP: c.vytahPozarni === true, plocha: tx(c.zastavenaPlochaM2),
      stropy: tx(c.stropy), strecha: tx(c.strecha), typUnik: tx(c.typUnikoveCesty), useky: tx(c.pozarniUseky) },
    nebezpeci: k.nebezpeci.map((n) => ({ znackaId: n.znackaId || null, popis: tx(n.popis), hasivo: tx(n.hasivo) })),
    fve: textFve(k.fve),
    uzavery: [['V:plyn', m.hlavniUzaverPlynu], ['V:voda', m.hlavniUzaverVody], ['V:topeni', m.hlavniUzaverTopeni]].map(([znacka, t]) => ({ znacka, text: tx(t) })),
    vypinace: [['V:el', m.hlavniVypinacEl], ['V:total', m.totalStop], ['V:central', m.centralStop]].map(([znacka, t]) => ({ znacka, text: tx(t) })),
    ktpo: tx(p.ktpo), oppo: tx(p.oppo),
    pbz: pbzAno, pbzZadne: PBZ.every(([klic]) => stavPbz(p[klic]) === false),
    vody: k.vodniZdroje.map((v) => ({ znackaId: v.znackaId || null, text: textVody(v, o.gps) })),
    doporuceni: tx(k.doporuceni),
    znalost: { jmeno: tx(k.znalostObjektu.jmeno), mobil: tx(k.znalostObjektu.mobil), funkce: tx(k.znalostObjektu.funkce) },
    zpracoval: { jmeno: tx(k.zpracoval.jmeno), cislo: tx(k.zpracoval.cisloOsvedceni), datum: datumCz(k.zpracoval.datum) },
    schvalil: { jmeno: tx(k.schvalil.jmeno), funkce: tx(k.schvalil.funkce), datum: datumCz(k.schvalil.datum) },
    revize: projekt.revize.map((x) => `č. ${x.cislo} (${datumCz(x.datum)}): ${tx(x.popis)}`),
  };
}
