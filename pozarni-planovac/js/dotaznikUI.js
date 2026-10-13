// Obrazovka „Dotazník pro klienta“ (DZP): odpovědi, vyplnitelné PDF, načtení vyplněného PDF, převzetí do projektu.
import { esc, naCislo, zCisla } from './formular.js';
import { OTAZKY, SEKCE } from './dotaznik.js';
import { ikona } from './ikony.js';

const pole = (q, v) => {
  const a = `data-odp="${q.id}" aria-label="${esc(q.text)}"`;
  if (q.typ === 'area') return `<textarea rows="3" ${a}>${esc(v ?? '')}</textarea>`;
  if (q.typ === 'ano_ne') return `<select ${a} data-typ="ano_ne"><option value="">— neuvedeno —</option><option value="ano" ${v === true ? 'selected' : ''}>ano</option><option value="ne" ${v === false ? 'selected' : ''}>ne</option></select>`;
  if (q.typ === 'cislo') return `<input type="text" inputmode="decimal" data-typ="cislo" ${a} value="${esc(zCisla(v))}">`;
  return `<input type="text" ${a} value="${esc(v ?? '')}">`;
};

export function vykresliDotaznik(projekt, host, tlacitkoPbr = '') {
  const d = projekt.dotaznik, vyplneno = OTAZKY.filter((q) => d.odpovedi[q.id] !== undefined && d.odpovedi[q.id] !== '' && d.odpovedi[q.id] !== null).length;
  host.innerHTML = `<section class="sek sek-zluta"><h3>Dotazník pro klienta</h3>
    <p class="napoveda">Ptá se jen na to, co v PBŘ a výkresech zpravidla není nebo se mohlo změnit (skutečný stav, uzávěry a vypínače, nebezpečné látky, FVE, ověřený průtok hydrantu, provoz a kontakty, organizace PO). Konstrukce, požární úseky, únikové cesty a PBZ podle projektu čtěte z PBŘ a ověřte na místě.</p>
    <ol class="kroky-dotazniku"><li>Má-li klient PBŘ v PDF, načtěte z něj nejdřív údaje do karty a plánu – v dotazníku pak víte, na co se ptát.</li><li>Stáhněte vyplnitelné PDF a pošlete ho klientovi.</li><li>Vrácené PDF načtěte – odpovědi se zapíšou sem (nebo je opište ručně z papírové verze).</li><li>Tlačítkem „Převzít odpovědi do projektu“ je přenesete do karty a operativního plánu – před zápisem uvidíte přehled a nic se bez souhlasu nepřepíše.</li></ol>
    <div class="prevzit-lista">${tlacitkoPbr}
      <button type="button" class="btn" data-dq="pdf">${ikona('stahnout', 16)}Stáhnout PDF k vyplnění</button>
      <label class="btn">${ikona('import', 16)}Načíst vyplněné PDF<input type="file" class="sr-only" accept="application/pdf,.pdf" data-dq="nacist"></label>
      <button type="button" class="btn" data-dq="prevzit">${ikona('kopie', 16)}Převzít odpovědi do projektu…</button>
    </div>
    ${d.pbr ? `<div class="pbr-souhrn"><p><b>PBŘ „${esc(d.pbr.soubor)}“</b> načteno ${esc(d.pbr.datum)}.</p>${d.pbr.nenalezeno.length ? `<p>V PBŘ nezjištěno – zeptejte se klienta: ${esc(d.pbr.nenalezeno.join(', '))}.</p>` : ''}</div>` : ''}
    <p class="napoveda">Vyplněno ${vyplneno} z ${OTAZKY.length} otázek${d.nacteno ? ` · naposledy načteno z PDF ${esc(d.nacteno)}` : ''}.</p></section>
    ${SEKCE.map((s) => `<section class="sek sek-seda"><h3>${esc(s)}</h3><div class="mriz">${OTAZKY.filter((q) => q.sekce === s).map((q) => `<label class="f ${q.typ === 'area' ? '' : ''}"><span>${esc(q.text)}</span>${pole(q, d.odpovedi[q.id])}</label>`).join('')}</div></section>`).join('')}`;
}

export function pripojDotaznik(projekt, host, { onZmena, stahniPdf, nactiPdf, prevzit }) {
  const d = projekt.dotaznik;
  host.oninput = host.onchange = (e) => {
    const el = e.target;
    if (el.dataset.dq === 'nacist') { if (e.type === 'change' && el.files[0]) nactiPdf(el.files[0]); return; }
    if (!el.dataset.odp) return;
    if (e.type === 'change' && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text'))) return;
    let v = el.value;
    if (el.dataset.typ === 'cislo') { const n = naCislo(v); el.classList.toggle('neplatne', Number.isNaN(n)); if (Number.isNaN(n)) return; v = n; }
    if (el.dataset.typ === 'ano_ne') v = v === '' ? null : v === 'ano';
    if (v === null || v === '') delete d.odpovedi[el.dataset.odp]; else d.odpovedi[el.dataset.odp] = v;
    onZmena();
  };
  host.onclick = (e) => {
    const b = e.target.closest('button[data-dq]'); if (!b) return;
    if (b.dataset.dq === 'pdf') stahniPdf();
    if (b.dataset.dq === 'prevzit') prevzit();
  };
}
