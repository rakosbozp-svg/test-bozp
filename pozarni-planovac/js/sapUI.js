// Formulář výpočtu SaP (list „OP – výpočet SaP“). Výsledek se přepočítává při každé změně a ukazuje vzorce s dosazenými hodnotami.
import { esc, dostan, nastav, naCislo, zCisla } from './formular.js';
import { PROSTORY, TABULKA1, DOBA_VYJEZDU, UHLY, DRUZSTVA, PROUDNICE, PRACE_MV, CAS_VYKON, CELA_PLOCHA, vypocetSaP, shrnutiSaP, novaJednotka } from './sap.js';

const vyber = (c, label, volby, d, sirka = '') => `<label class="f ${sirka}"><span>${esc(label)}</span><select data-sap="${c}">${volby.map(([k, n]) => `<option value="${esc(k)}" ${String(dostan(d, c)) === String(k) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`;
const cis = (c, label, d, tip = '') => `<label class="f f-s"><span>${esc(label)}</span><input type="text" inputmode="decimal" data-sap="${c}" data-typ="cislo" value="${esc(zCisla(dostan(d, c)))}" ${tip ? `title="${esc(tip)}"` : ''}></label>`;
const sek = (id, nazev, zdroj, obsah) => `<section class="sek sek-seda" id="sek-sap-${id}"><h3>${esc(nazev)}</h3>${zdroj ? `<p class="napoveda">${zdroj}</p>` : ''}<div class="mriz">${obsah}</div></section>`;

function prostorSelect(d) {
  return `<label class="f"><span>Druh prostoru (tabulka č. 1)</span><select data-sap="prostor"><option value="">— vyberte —</option>${TABULKA1.map(([trida], i) => `<optgroup label="${esc(trida)}">${PROSTORY.filter((p) => p.id.startsWith(`${i + 1}.`)).map((p) => `<option value="${p.id}" ${d.prostor === p.id ? 'selected' : ''}>${esc(p.nazev)} (Ip ${zCisla(p.ip)}${p.v1 !== null ? `, v1 ${zCisla(p.v1)}` : ''})</option>`).join('')}</optgroup>`).join('')}</select></label>`;
}

function vysledkyHtml(d) {
  const { kroky, chybi } = vypocetSaP(d);
  let odd = '';
  const radky = kroky.map((k) => { const h = k.oddil !== odd ? `<tr class="oddil"><th colspan="3">${esc((odd = k.oddil))}</th></tr>` : ''; return `${h}<tr><td>${esc(k.nazev)}</td><td class="vzorec">${esc(k.vzorec)}</td><td class="hodnota">${esc(k.vysledek)}</td></tr>`; }).join('');
  return `<h3>Výpočet</h3>${kroky.length ? `<table class="sap-kroky">${radky}</table>` : '<p class="prazdno">Zadejte vstupy výše.</p>'}
    ${chybi.length ? `<p class="varuj">Chybí vstupy: ${esc(chybi.join('; '))}.</p>` : ''}
    <p class="sap-shrnuti"><b>Shrnutí:</b> ${esc(shrnutiSaP(d))}</p>
    <button type="button" class="btn" data-sap-akce="zapsat">Zapsat shrnutí do základního textu OP</button>`;
}

export function vykresliSap(list, host) {
  const d = list.opSap;
  const jed = d.jednotky.map((j) => `<div class="polozka" data-id="${j.id}" data-cesta="listy[${list.id}].opSap.jednotky[${j.id}]">
      <label class="f"><span>Jednotka</span><input type="text" data-jed="${j.id}" data-klic="nazev" value="${esc(j.nazev)}"></label>
      <label class="f"><span>Druh (doba výjezdu tv)</span><select data-jed="${j.id}" data-klic="druh">${Object.entries(DOBA_VYJEZDU).map(([k, [, n]]) => `<option value="${k}" ${j.druh === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <label class="f f-s"><span>Vzdálenost L (km)</span><input type="text" inputmode="decimal" data-jed="${j.id}" data-klic="L" data-typ="cislo" value="${esc(zCisla(j.L))}"></label>
      <label class="f f-s"><span>Bojové rozvinutí tBR (min)</span><input type="text" inputmode="decimal" data-jed="${j.id}" data-klic="tBR" data-typ="cislo" value="${esc(zCisla(j.tBR))}"></label>
      <button type="button" class="btn mal" data-sap-akce="smaz" data-id="${j.id}">Odebrat</button></div>`).join('') || '<p class="prazdno">Zatím žádná jednotka.</p>';
  host.innerHTML = `<p class="napoveda">Výpočet podle Metodického návodu (Hanuška 1996), část druhá. Každý krok se vypisuje se vzorcem a dosazenými hodnotami. Aplikace nenahrazuje úvahu zpracovatele (volba nejsložitější varianty, hlavní směr nasazení, forma šíření) – správnost ověřuje zpracovatel a HZS.</p>
    ${sek('doby', '1. Soustředění jednotek a doby', 'Kap. 3.2 a 4.1: tDO = tv + 60·L/45; tVR = tZP + tOH + tDO + tBR první jednotky (řešený příklad str. 60). Doby tZP a tOH vyplývají z operativně taktické studie; tBR informativně podle tab. 10. Výpočet se provádí pro lokalizaci požáru – vyplňte tBR první i poslední jednotky.',
      `${cis('tZP', 'Doba zpozorování tZP (min)', d)}${cis('tOH', 'Doba ohlášení tOH (min)', d)}`)}
    <section class="sek sek-seda" id="sek-sap-jednotky"><h3>Jednotky PO podle poplachového plánu</h3><div class="seznam">${jed}</div><button type="button" class="btn" data-sap-akce="pridej">+ Přidat jednotku</button></section>
    ${sek('pozar', '2. Parametry požáru', 'Kap. 4.2 a 4.3, tabulka č. 1. Vlastní hodnoty Io/Ip/v1 zadávejte jen se zdůvodněním (např. smáčedlo 2/3–1/2 Ip, údaje výrobce). Při v1 > 2 m/min, v malých prostorách, v prostředí s nebezpečím výbuchu a u hořlavých kapalin je plochou požáru celá plocha objektu nebo prostoru (kap. 4.2) – zadejte ji níže.',
      `${prostorSelect(d)}${cis('ioVlastni', 'Vlastní Io (l/m/min)', d)}${cis('ipVlastni', 'Vlastní Ip (l/m²/min)', d)}${cis('v1Vlastni', 'Vlastní v1 (m/min)', d)}
      ${vyber('forma', 'Forma šíření', [['kruh', 'kruhová (neomezená)'], ['uhel', 'úhlová (omezená dvěma stěnami)'], ['pravouhla', 'pravoúhlá (po celé šířce prostoru)']], d)}
      ${d.forma === 'uhel' ? vyber('uhel', 'Úhel šíření β', Object.keys(UHLY).sort((a, b) => b - a).map((k) => [k, `${k}° (f = ${zCisla(UHLY[k])})`]), d, 'f-s') : ''}
      ${d.forma === 'pravouhla' ? `${cis('a', 'Šířka prostoru a (m)', d)}${cis('n', 'Počet směrů šíření n', d)}` : ''}
      ${vyber('h', 'Hloubka hašení h', [['5', '5 m – ruční proudnice C, B'], ['10', '10 m – lafetové proudnice']], d)}
      ${cis('plochaUseku', 'Plocha požárního úseku / objektu nebo prostoru (m²)', d, 'Pro pravidlo 85 % a pro případy, kdy je plochou požáru celá plocha (kap. 4.2)')}
      ${vyber('celaPlocha', 'Celá plocha je plochou požáru', CELA_PLOCHA, d)}
      ${vyber('rPro', 'Rádius pro výpočet', [['lokalizace', 'v době lokalizace (kap. 4.2 c) – metodika'], ['prvni', 'v době nasazení prvních proudů – jen orientačně']], d)}`)}
    ${sek('haseni', '3. Hašení a proudy', 'Kap. 5.2–5.3, tabulka č. 4. Počet hasičů na proudnici k: C 1–2, B 2–3, v zakouření 3–4 (tab. 10). Hoří-li celá plocha, počítejte podle fronty hašení (kap. 4.3, řešený příklad str. 60–61). Družstvo obslouží nejvýš jednu proudnici B (kap. 5.4).',
      `${vyber('zpusob', 'Dodávka na hašení podle', [['plocha', 'plochy hašení: Qh = Sh·Ip'], ['fronta', 'fronty hašení: Qh = Oh·Io']], d)}${d.zpusob === 'fronta' ? cis('Oh', 'Fronta hašení Oh (m)', d) : ''}
      ${vyber('qprH', 'Proudnice na hašení', PROUDNICE, d)}${vyber('qprO', 'Proudnice na ochlazování', PROUDNICE, d)}${cis('kH', 'Hasičů na proudnici – hašení', d)}${cis('kO', 'Hasičů na proudnici – ochlazování', d)}`)}
    ${sek('ochlazovani', '4. Ochlazování a ochrana (nepovinné)', 'Kap. 5.2, tabulka č. 2: hořící nádrž 30 l/m/min (při hoření v jímce 60), sousední nádrž 12 l/m/min na polovinu obvodu.',
      `${cis('nadrzD', 'Hořící nádrž – průměr D (m)', d)}${vyber('nadrzIo', 'Intenzita – hořící nádrž', [['30', '30 l/m/min'], ['60', '60 l/m/min (hoření v jímce)']], d, 'f-s')}
      ${cis('sousedniD', 'Sousední nádrž – průměr D (m)', d)}${cis('sousedniIo', 'Intenzita – sousední (l/m/min)', d)}${cis('sousedniM', 'Počet sousedních nádrží m', d)}${cis('ochranaQ', 'Ochrana ostatních objektů (l/min)', d)}`)}
    ${sek('technika', '5. Technika a voda', 'Kap. 5.4: možnosti družstva (tabulka v kap. 5.4). Výkon čerpadla Qc: minimum podle vyhlášky č. 35/2007 Sb. (CAS 20 = 2 000, CAS 30 = 3 000 l/min) je bezpečný předpoklad; skutečný výkon vozu jednotky zjistěte u HZS / jednotky (tab. 9 metodiky je z roku 1996). Vydatnost zdroje: zkouška hydrantu, tab. 7 a 8.',
      `${vyber('druzstvo', 'Složení družstva', Object.entries(DRUZSTVA).map(([k, [q, n, t]]) => [k, `${k} – ${t}, až ${q} l/min`]), d)}${vyber('QcVolba', 'Technika (výkon čerpadla)', Object.entries(CAS_VYKON).map(([k, [, n]]) => [k, n]), d)}${cis('Qc', 'Výkon čerpadla Qc (l/min)', d)}${cis('vydatnost', 'Vydatnost zdroje vody (l/min)', d)}`)}
    ${sek('dych', '6. Dýchací technika (nepovinné)', 'Kap. 5.5: To = 10·pL·VL/MV.',
      `${vyber('dych.pL', 'Tlak v lahvi pL', [['', '—'], ['20', '20 MPa'], ['30', '30 MPa']], d, 'f-s')}${cis('dych.VL', 'Objem lahve VL (l)', d)}${vyber('dych.prace', 'Druh práce (MV)', Object.entries(PRACE_MV).map(([k, x]) => [k, `${({ klid: 'klid', lehky: 'lehký pohyb', lehka: 'lehká práce', stredni: 'střední práce', tezka: 'těžká práce', max: 'nejvyšší vypětí' })[k]} (${x} l/min)`]), d)}`)}
    ${sek('dalkova', '7. Dálková doprava vody (nepovinné)', 'Kap. 5.7: Nč = (H + 0,01·Lh·Ht + 7,5)/65; kyvadlová doprava Nc = (T1+T2+T3)/T4 + (2 až 3).',
      `${cis('dalkova.Lh', 'Hadicové vedení – vzdálenost Lh (m)', d)}${cis('dalkova.H', 'Převýšení H (m)', d)}${vyber('dalkova.prutok', 'Průtok vedením B', [['400', '400 l/min'], ['600', '600 l/min'], ['800', '800 l/min']], d, 'f-s')}${vyber('dalkova.hadice', 'Hadice', [['izolovane', 'izolované'], ['konopne', 'konopné']], d, 'f-s')}
      ${cis('kyvadlo.L', 'Kyvadlo – vzdálenost ke zdroji L (km)', d)}${cis('kyvadlo.Vnc', 'Objem nádrže cisterny (l)', d)}${cis('kyvadlo.Qc', 'Výkon čerpadla při plnění (l/min)', d)}${cis('kyvadlo.qv', 'Průtok vyprazdňování qv (l/min)', d)}`)}
    ${sek('pena', '8. Pěna (nepovinné)', 'Kap. 5.8: Vp = Npr·qp·10·3, qp = 0,01·qpr·pp; hodnoty proudnic tab. 5 a 6, intenzity u konkrétního pěnidla podle výrobce.',
      `${cis('pena.N', 'Počet pěnotvorných proudnic', d)}${cis('pena.qpr', 'Průtok roztoku proudnicí qpr (l/min)', d)}${cis('pena.pp', 'Přimísení pěnidla pp (%)', d)}`)}
    <section class="sek sek-seda"><h3>Poznámka ke výpočtu</h3><label class="f"><span>Zdůvodnění volby varianty, hlavního směru, formy šíření…</span><textarea rows="4" data-sap="poznamka">${esc(d.poznamka)}</textarea></label></section>
    <section class="sek sek-zluta" id="sap-vysledky">${vysledkyHtml(d)}</section>`;
}

export function pripojSap(list, host, { onZmena, prekresli, zapisShrnuti }) {
  const d = list.opSap, obnov = () => { const el = host.querySelector('#sap-vysledky'); if (el) el.innerHTML = vysledkyHtml(d); };
  const hodnota = (el) => { if (el.dataset.typ !== 'cislo') return el.value; const n = naCislo(el.value); el.classList.toggle('neplatne', Number.isNaN(n)); return Number.isNaN(n) ? undefined : n; };
  host.oninput = host.onchange = (e) => {
    const el = e.target;
    if (e.type === 'change' && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text'))) return;   // jinak by překreslení výsledků při opuštění pole „spolklo“ klik
    const v = hodnota(el); if (v === undefined) return;
    if (el.dataset.sap === 'QcVolba') { d.QcVolba = v; if (CAS_VYKON[v]?.[0]) d.Qc = CAS_VYKON[v][0]; onZmena(); prekresli(); return; }
    if (el.dataset.sap === 'Qc') d.QcVolba = 'vlastni';
    if (el.dataset.sap) { nastav(d, el.dataset.sap, v); onZmena(); if (el.tagName === 'SELECT' && ['forma', 'zpusob'].includes(el.dataset.sap)) prekresli(); else obnov(); }
    else if (el.dataset.jed) { const j = d.jednotky.find((x) => x.id === el.dataset.jed); if (j) { j[el.dataset.klic] = v; onZmena(); obnov(); } }
  };
  host.onclick = (e) => {
    const b = e.target.closest('[data-sap-akce]'); if (!b) return;
    if (b.dataset.sapAkce === 'pridej') { d.jednotky.push(novaJednotka()); onZmena(); prekresli(); }
    if (b.dataset.sapAkce === 'smaz') { d.jednotky = d.jednotky.filter((x) => x.id !== b.dataset.id); onZmena(); prekresli(); }
    if (b.dataset.sapAkce === 'zapsat') zapisShrnuti(shrnutiSaP(d));
  };
}
