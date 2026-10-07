// Náhled textové části operativní karty (rozvržení podle vzoru HZS SCK, list A4). Barvy pruhů dle vzoru.
import { esc, zCisla } from './formular.js';
import { najdiZnacku } from './znacky.js';

const hodn = (v) => (v === null || v === undefined || String(v).trim() === '' ? '<span class="chybi">…</span>' : esc(v));
const znacka = (id) => { const z = id && najdiZnacku(id); return z ? `<img src="${z.png}" alt="${esc(z.nazev)}">` : ''; };
const datum = (d) => (d ? d.split('-').reverse().join('. ') : '');

export function nahledKarty(list, projekt) {
  const k = list.karta, o = k.objekt, c = k.charakter, f = k.fve, m = k.media, p = k.pbz;
  const r = (a, b) => `<tr><th>${a}</th><td>${b}</td></tr>`;
  const gps = o.gps.sirka !== null && o.gps.delka !== null ? `${zCisla(o.gps.sirka)} N, ${zCisla(o.gps.delka)} E` : '';
  const nebezpeciRadky = k.nebezpeci.map((n) => `<tr><td class="zn">${znacka(n.znackaId)}</td><td colspan="3">${hodn(n.popis)}${n.hasivo ? `<br>hasivo: ${esc(n.hasivo)}` : ''}</td></tr>`);
  if (f.pritomna === true) nebezpeciRadky.push(`<tr><td class="zn"></td><td colspan="3"><b>FVE:</b> ${f.pocetPanelu ? `${esc(f.pocetPanelu)} panelů, ` : ''}${f.vykonKWp !== null ? `výkon ${zCisla(f.vykonKWp)} kWp` : '<span class="chybi">výkon kWp…</span>'}${f.baterie === false ? ', bez bateriového úložiště' : f.baterie === true ? ', s bateriovým úložištěm' : ''}${f.vypinacSilovaCast ? `; vypínač silové části: ${esc(f.vypinacSilovaCast)}` : ''}${f.popis ? `<br>${esc(f.popis)}` : ''}${f.hasivo ? `<br>hasivo: ${esc(f.hasivo)}` : ''}</td></tr>`);
  const med = [['Hlavní uzávěr vody', m.hlavniUzaverVody], ['Vedlejší uzávěr vody', m.vedlejsiUzaverVody], ['Hlavní uzávěr plynu', m.hlavniUzaverPlynu], ['Vedlejší uzávěr plynu', m.vedlejsiUzaverPlynu], ['Hlavní uzávěr topení', m.hlavniUzaverTopeni], ['Vedlejší uzávěr topení', m.vedlejsiUzaverTopeni], ['Hlavní vypínač el. proudu', m.hlavniVypinacEl], ['Vedlejší vypínač el. proudu', m.vedlejsiVypinacEl]];
  const pbz = [['EPS', p.eps], ['ZDHPP', p.zdhpp], ['APZ', p.apz], ['ZDP', p.zdp], ['SHZ', p.shz], ['PSHZ', p.pshz], ['ZOKT', p.zokt], ['PK', p.pk], ['Evakuační výtah', p.vytahEvakuacni], ['Požární výtah', p.vytahPozarni]];
  return `<article class="a4">
  <table class="ok hlava"><tr><td class="nadpis zl" colspan="2">O P E R A T I V N Í &nbsp; K A R T A</td><td class="zl stupen">STUPEŇ POPLACHU<br><b>${hodn(k.stupenPoplachu)}</b><br>${hodn(k.uzemniOdbor)}</td></tr>
    <tr><td colspan="2"><b>OBJEKT:</b> ${hodn(o.nazev)}</td><td><b>PROVOZOVATEL:</b> ${hodn(o.provozovatel)}${o.ic ? `, IČ: ${esc(o.ic)}` : ''}</td></tr>
    <tr><td colspan="2"><b>ADRESA:</b> ${hodn(o.adresa)}</td><td><b>GPS:</b> ${hodn(gps)}</td></tr>
    <tr><td colspan="2"><b>PROVOZ:</b> pracovní doba: ${hodn(o.provoz.pracovniDoba)}<br>kontakt: ${hodn(o.provoz.kontaktTelefon)} – ${hodn(o.provoz.kontaktJmeno)}</td><td><b>OBSAZENÍ OSOBAMI:</b> ${hodn(o.obsazeniOsobami)}</td></tr>
    <tr><td colspan="2"><b>PŘÍJEZD Z:</b> ${hodn(o.prijezdZ)}</td><td><b>OMEZENÍ:</b> ${hodn(o.omezeni)}</td></tr></table>
  <div class="pruh sed">CHARAKTER OBJEKTU</div>
  <table class="ok"><tr><td colspan="2"><b>ÚČEL STAVBY:</b> ${hodn(c.ucelStavby)}</td><td><b>PODLAŽÍ:</b> ${hodn(c.podlazi)}</td></tr>
    <tr><td><b>PŮDORYS (m):</b> ${hodn(c.pudorysM)}</td><td><b>KONSTRUKCE:</b> ${hodn(c.konstrukce)}</td><td><b>ÚNIKOVÉ CESTY:</b> ${hodn(c.unikoveCesty)}</td></tr>
    <tr><td><b>CELKOVÁ VÝŠKA (m):</b> ${hodn(c.celkovaVyskaM)}</td><td><b>STĚNY:</b> ${hodn(c.steny)}</td><td><b>PŘÍČKY:</b> ${hodn(c.priccky)} &nbsp; <b>VÝTAHY:</b> ${hodn(c.vytahy)}</td></tr>
    <tr><td><b>ZASTAVĚNÁ PLOCHA (m²):</b> ${hodn(c.zastavenaPlochaM2)}</td><td><b>STROPY:</b> ${hodn(c.stropy)}</td><td><b>STŘECHA:</b> ${hodn(c.strecha)}</td></tr>
    <tr><td colspan="2"><b>POŽÁRNÍ ÚSEKY:</b> ${hodn(c.pozarniUseky)}</td><td><b>TYP ÚNIKOVÉ CESTY:</b> ${hodn(c.typUnikoveCesty)}</td></tr></table>
  <div class="pruh cer">!!! N E B E Z P E Č Í !!!</div>
  <table class="ok">${nebezpeciRadky.join('') || '<tr><td colspan="4"><span class="chybi">…</span></td></tr>'}</table>
  <div class="pruh zel">ZÁVĚRY MÉDIÍ / POŽÁRNĚ BEZPEČNOSTNÍ ZAŘÍZENÍ</div>
  <table class="ok">${med.map(([a, b]) => r(a, hodn(b))).join('')}${pbz.map(([a, b]) => r(a, hodn(b))).join('')}</table>
  <div class="pruh mod">VODNÍ ZDROJE A HASEBNÍ LÁTKY</div>
  <table class="ok">${k.vodniZdroje.map((v) => `<tr><td class="zn">${znacka(v.znackaId)}</td><td colspan="3">${hodn(v.popis)}${v.typ === 'hydrant' ? ` – průtok ${v.prutokLs !== null ? `${zCisla(v.prutokLs)} l.s<sup>-1</sup>${v.overenPrutok ? '' : ' (neověřeno)'}` : '<span class="chybi">…</span>'}` : ''}${v.typ === 'nadrz' ? ` – ${v.objemM3 !== null ? `${zCisla(v.objemM3)} m³` : '<span class="chybi">…</span>'}` : ''}${v.gps?.sirka !== null && v.gps?.delka !== null ? `, GPS: ${zCisla(v.gps.sirka)} N, ${zCisla(v.gps.delka)} E` : ''}</td></tr>`).join('') || '<tr><td colspan="4"><span class="chybi">…</span></td></tr>'}</table>
  <div class="pruh zl">DOPORUČENÍ PRO VELITELE ZÁSAHU</div>
  <div class="dop">${k.doporuceni ? esc(k.doporuceni).replace(/\n/g, '<br>') : '<span class="chybi">…</span>'}<p>Znalost o objektu má: ${hodn(k.znalostObjektu.jmeno)}${k.znalostObjektu.mobil ? `, mob.: ${esc(k.znalostObjektu.mobil)}` : ''}</p></div>
  <table class="ok podpisy"><tr><td><b>ZPRACOVAL</b><br>${hodn(k.zpracoval.jmeno)}<br>č. osvědčení: ${hodn(k.zpracoval.cisloOsvedceni)}<br>datum: ${esc(datum(k.zpracoval.datum))}</td><td><b>SCHVÁLIL</b><br>${hodn(k.schvalil.jmeno)}<br>${esc(k.schvalil.funkce)}<br>datum: ${esc(datum(k.schvalil.datum))}</td></tr></table>
  ${projekt.revize.length ? `<p class="revize">Revize: ${projekt.revize.map((x) => `${x.cislo}. ${esc(datum(x.datum))} ${esc(x.popis)}`).join('; ')}</p>` : ''}
</article>`;
}
