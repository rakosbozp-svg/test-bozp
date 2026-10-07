// Náhled textové části operativní karty (rozvržení podle vzoru HZS SCK, list A4). Obsah dodává kartaData.js (sdílený s PDF).
import { esc } from './formular.js';
import { najdiZnacku } from './znacky.js';
import { sestavKartu } from './kartaData.js';

const hodn = (v) => (v === null || v === undefined || String(v).trim() === '' ? '<span class="chybi">…</span>' : esc(v));
const radky = (v) => (v === null || v === undefined || String(v).trim() === '' ? '<span class="chybi">…</span>' : esc(v).replace(/\n/g, '<br>'));
const znacka = (id) => { const z = id && najdiZnacku(id); return z ? `<img src="${z.png}" alt="${esc(z.nazev)}">` : ''; };

export function nahledKarty(list, projekt) {
  const d = sestavKartu(list.karta, projekt), h = d.hlava, c = d.charakter;
  const dvojice = (x) => { const v = [...x.media, ...x.pbz]; let o = ''; for (let i = 0; i < v.length; i += 2) { const a = v[i], b = v[i + 1]; o += `<tr><th>${a[0]}</th><td>${hodn(a[1])}</td>${b ? `<th>${b[0]}</th><td>${hodn(b[1])}</td>` : '<th></th><td></td>'}</tr>`; } return o; };
  return `<article class="a4">
  <table class="ok hlava"><tr><td class="nadpis zl" colspan="2">O P E R A T I V N Í &nbsp; K A R T A</td><td class="zl stupen">STUPEŇ POPLACHU<br><b>${hodn(h.stupen)}</b><br>${hodn(h.uo)}</td></tr>
    <tr><td colspan="2"><b>OBJEKT:</b> ${hodn(h.objekt)}</td><td><b>PROVOZOVATEL:</b> ${hodn(h.provozovatel)}${h.ic ? `, IČ: ${esc(h.ic)}` : ''}</td></tr>
    <tr><td colspan="2"><b>ADRESA:</b> ${hodn(h.adresa)}</td><td><b>GPS:</b> ${hodn(h.gps)}</td></tr>
    <tr><td colspan="2"><b>PROVOZ:</b> pracovní doba: ${hodn(h.pracovniDoba)}<br>kontakt: ${hodn(h.kontaktTelefon)} – ${hodn(h.kontaktJmeno)}</td><td><b>OBSAZENÍ OSOBAMI:</b> ${hodn(h.obsazeni)}</td></tr>
    <tr><td colspan="2"><b>PŘÍJEZD Z:</b> ${hodn(h.prijezd)}</td><td><b>OMEZENÍ:</b> ${hodn(h.omezeni)}</td></tr></table>
  <div class="pruh sed">CHARAKTER OBJEKTU</div>
  <table class="ok"><tr><td colspan="2"><b>ÚČEL STAVBY:</b> ${hodn(c.ucel)}</td><td><b>PODLAŽÍ:</b> ${hodn(c.podlazi)}</td></tr>
    <tr><td><b>PŮDORYS (m):</b> ${hodn(c.pudoryM)}</td><td><b>KONSTRUKCE:</b> ${hodn(c.konstrukce)}</td><td><b>ÚNIKOVÉ CESTY:</b> ${hodn(c.unikoveCesty)}</td></tr>
    <tr><td><b>CELKOVÁ VÝŠKA (m):</b> ${hodn(c.vyska)}</td><td><b>STĚNY:</b> ${hodn(c.steny)}</td><td><b>PŘÍČKY:</b> ${hodn(c.priccky)} &nbsp; <b>VÝTAHY:</b> ${hodn(c.vytahy)}</td></tr>
    <tr><td><b>ZASTAVĚNÁ PLOCHA (m²):</b> ${hodn(c.plocha)}</td><td><b>STROPY:</b> ${hodn(c.stropy)}</td><td><b>STŘECHA:</b> ${hodn(c.strecha)}</td></tr>
    <tr><td colspan="2"><b>POŽÁRNÍ ÚSEKY:</b> ${hodn(c.useky)}</td><td><b>TYP ÚNIKOVÉ CESTY:</b> ${hodn(c.typUnik)}</td></tr></table>
  <div class="pruh cer">!!! N E B E Z P E Č Í !!!</div>
  <table class="ok">${d.nebezpeci.map((n) => `<tr><td class="zn">${znacka(n.znackaId)}</td><td colspan="3">${radky(n.text)}</td></tr>`).join('') || '<tr><td colspan="4"><span class="chybi">…</span></td></tr>'}</table>
  <div class="pruh zel">ZÁVĚRY MÉDIÍ / POŽÁRNĚ BEZPEČNOSTNÍ ZAŘÍZENÍ</div>
  <table class="ok media">${dvojice(d)}</table>
  <div class="pruh mod">VODNÍ ZDROJE A HASEBNÍ LÁTKY</div>
  <table class="ok">${d.vody.map((v) => `<tr><td class="zn">${znacka(v.znackaId)}</td><td colspan="3">${radky(v.text)}</td></tr>`).join('') || '<tr><td colspan="4"><span class="chybi">…</span></td></tr>'}</table>
  <div class="pruh zl">DOPORUČENÍ PRO VELITELE ZÁSAHU</div>
  <div class="dop">${radky(d.doporuceni)}<p>Znalost o objektu má: ${hodn(d.znalost.jmeno)}${d.znalost.mobil ? `, mob.: ${esc(d.znalost.mobil)}` : ''}</p></div>
  <table class="ok podpisy"><tr><td><b>ZPRACOVAL</b><br>${hodn(d.zpracoval.jmeno)}<br>č. osvědčení: ${hodn(d.zpracoval.cislo)}<br>datum: ${esc(d.zpracoval.datum)}</td><td><b>SCHVÁLIL</b><br>${hodn(d.schvalil.jmeno)}<br>${esc(d.schvalil.funkce)}<br>datum: ${esc(d.schvalil.datum)}</td></tr></table>
  ${d.revize.length ? `<p class="revize">Revize: ${d.revize.map(esc).join('; ')}</p>` : ''}
</article>`;
}
