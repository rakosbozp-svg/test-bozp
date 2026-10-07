// Obsah operativní karty jako prostá data (bez HTML). Jediný zdroj pro náhled na obrazovce i pro PDF, aby se nikdy nerozešly.
import { zCisla } from './formular.js';

const prazdne = (v) => v === null || v === undefined || String(v).trim() === '';
export const datumCz = (d) => (d ? d.split('-').reverse().join('. ') : '');

export function sestavKartu(k, projekt) {
  const o = k.objekt, c = k.charakter, f = k.fve, m = k.media, p = k.pbz;
  const gps = o.gps.sirka !== null && o.gps.delka !== null ? `${zCisla(o.gps.sirka)} N, ${zCisla(o.gps.delka)} E` : '';
  const nebezpeci = k.nebezpeci.map((n) => ({ znackaId: n.znackaId, text: [n.popis, n.hasivo ? `hasivo: ${n.hasivo}` : ''].filter((x) => !prazdne(x)).join('\n') }));
  if (f.pritomna === true) {
    const hlavni = ['FVE:', f.pocetPanelu ? ` ${f.pocetPanelu} panelů,` : '', f.vykonKWp !== null ? ` výkon ${zCisla(f.vykonKWp)} kWp` : ' výkon kWp: ', f.baterie === false ? ', bez bateriového úložiště' : f.baterie === true ? ', s bateriovým úložištěm' : '', f.vypinacSilovaCast ? `; vypínač silové části: ${f.vypinacSilovaCast}` : ''].join('').replace('FVE:, ', 'FVE: ');
    nebezpeci.push({ znackaId: null, fve: true, text: [hlavni, f.popis, f.hasivo ? `hasivo: ${f.hasivo}` : ''].filter((x) => !prazdne(x)).join('\n') });
  }
  return {
    hlava: { stupen: k.stupenPoplachu, uo: k.uzemniOdbor, objekt: o.nazev, provozovatel: o.provozovatel, ic: o.ic, adresa: o.adresa, gps, pracovniDoba: o.provoz.pracovniDoba, kontaktTelefon: o.provoz.kontaktTelefon, kontaktJmeno: o.provoz.kontaktJmeno, obsazeni: o.obsazeniOsobami, prijezd: o.prijezdZ, omezeni: o.omezeni },
    charakter: { ucel: c.ucelStavby, podlazi: c.podlazi, pudoryM: c.pudorysM, konstrukce: c.konstrukce, unikoveCesty: c.unikoveCesty, vyska: c.celkovaVyskaM, steny: c.steny, priccky: c.priccky, vytahy: c.vytahy, plocha: c.zastavenaPlochaM2, stropy: c.stropy, strecha: c.strecha, typUnik: c.typUnikoveCesty, useky: c.pozarniUseky },
    nebezpeci,
    media: [['Hlavní uzávěr vody', m.hlavniUzaverVody], ['Vedlejší uzávěr vody', m.vedlejsiUzaverVody], ['Hlavní uzávěr plynu', m.hlavniUzaverPlynu], ['Vedlejší uzávěr plynu', m.vedlejsiUzaverPlynu], ['Hlavní uzávěr topení', m.hlavniUzaverTopeni], ['Vedlejší uzávěr topení', m.vedlejsiUzaverTopeni], ['Hlavní vypínač el. proudu', m.hlavniVypinacEl], ['Vedlejší vypínač el. proudu', m.vedlejsiVypinacEl]],
    pbz: [['EPS', p.eps], ['ZDHPP', p.zdhpp], ['APZ', p.apz], ['ZDP', p.zdp], ['SHZ', p.shz], ['PSHZ', p.pshz], ['ZOKT', p.zokt], ['PK', p.pk], ['Evakuační výtah', p.vytahEvakuacni], ['Požární výtah', p.vytahPozarni]],
    vody: k.vodniZdroje.map((v) => ({
      znackaId: v.znackaId,
      text: [v.popis, v.typ === 'hydrant' ? ` – průtok ${v.prutokLs !== null ? `${zCisla(v.prutokLs)} l/s${v.overenPrutok ? '' : ' (neověřeno)'}` : ''}` : '', v.typ === 'nadrz' ? ` – ${v.objemM3 !== null ? `${zCisla(v.objemM3)} m³` : ''}` : '', v.gps?.sirka !== null && v.gps?.delka !== null ? `, GPS: ${zCisla(v.gps.sirka)} N, ${zCisla(v.gps.delka)} E` : ''].join(''),
    })),
    doporuceni: k.doporuceni,
    znalost: { jmeno: k.znalostObjektu.jmeno, mobil: k.znalostObjektu.mobil },
    zpracoval: { jmeno: k.zpracoval.jmeno, cislo: k.zpracoval.cisloOsvedceni, datum: datumCz(k.zpracoval.datum) },
    schvalil: { jmeno: k.schvalil.jmeno, funkce: k.schvalil.funkce, datum: datumCz(k.schvalil.datum) },
    revize: projekt.revize.map((x) => `${x.cislo}. ${datumCz(x.datum)} ${x.popis}`),
  };
}
