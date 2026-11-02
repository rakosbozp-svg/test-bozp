// Obrazovka „Dotazník pro klienta“ (DZP): odpovědi, vyplnitelné PDF, načtení vyplněného PDF, převzetí do projektu.
import { esc, naCislo, zCisla } from './formular.js';
import { oddily, otazkyProjektu, textOdpovedi } from './dotaznik.js';
import { ikona } from './ikony.js';

const pole = (q, v) => {
  const a = `data-odp="${q.id}" aria-label="${esc(q.text)}"`;
  if (q.typ === 'area') return `<textarea rows="3" ${a}>${esc(v ?? '')}</textarea>`;
  if (q.typ === 'ano_ne') return `<select ${a} data-typ="ano_ne"><option value="">— neuvedeno —</option><option value="ano" ${v === true ? 'selected' : ''}>ano</option><option value="ne" ${v === false ? 'selected' : ''}>ne</option></select>`;
  if (q.typ === 'cislo') return `<input type="text" inputmode="decimal" data-typ="cislo" ${a} value="${esc(zCisla(v))}">`;
  return `<input type="text" ${a} value="${esc(v ?? '')}">`;
};

export function vykresliDotaznik(projekt, host, tlacitkoPbr = '') {
  const d = projekt.dotaznik, vse = otazkyProjektu(projekt), ptat = vse.filter((q) => q.stav === 'ptat'), jinak = vse.filter((q) => q.stav !== 'ptat');
  const ma = (q) => d.odpovedi[q.id] !== undefined && d.odpovedi[q.id] !== '' && d.odpovedi[q.id] !== null, vyplneno = ptat.filter(ma).length;
  const karta = projekt.listy.some((l) => l.typ === 'karta');
  host.innerHTML = `<section class="sek sek-zluta"><h3>Dotazník pro klienta</h3>
    <p class="napoveda">${karta ? 'Ptá se jen na to, co v operativní kartě ještě chybí – na údaje, které karta už má (z PBŘ nebo zapsané ručně), se klienta neptá. Seznam vynechaných otázek je dole; otázky se přepočítají při každém otevření dotazníku.' : 'Projekt nemá operativní kartu – dotazník se ptá na všechny její údaje (převzít je půjde po přidání listu Operativní karta); na údaje plánu se ptá, jen když v plánu chybí.'} Konstrukce, požární úseky a únikové cesty se čtou z PBŘ a ověřují na místě.</p>
    <ol class="kroky-dotazniku"><li>Máte-li od klienta PBŘ nebo průvodní / souhrnnou zprávu (PDF i naskenované, Word .docx), načtěte z nich nejdřív údaje do karty a plánu – dotazník se pak zeptá jen na to, co v nich nebylo.</li><li>Stáhněte vyplnitelné PDF a pošlete ho klientovi.</li><li>Vrácené PDF načtěte – odpovědi se zapíšou sem (nebo je opište ručně z papírové verze).</li><li>Tlačítkem „Převzít odpovědi do projektu“ je přenesete do karty a operativního plánu – před zápisem uvidíte přehled a nic se bez souhlasu nepřepíše.</li></ol>
    <div class="prevzit-lista">${tlacitkoPbr}
      <button type="button" class="btn" data-dq="pdf">${ikona('stahnout', 16)}Stáhnout PDF k vyplnění</button>
      <label class="btn">${ikona('import', 16)}Načíst vyplněné PDF<input type="file" class="sr-only" accept="application/pdf,.pdf" data-dq="nacist"></label>
      <button type="button" class="btn" data-dq="prevzit">${ikona('kopie', 16)}Převzít odpovědi do projektu…</button>
    </div>
    ${d.pbr ? `<div class="pbr-souhrn"><p><b>Načteno z dokumentace</b> (${esc(d.pbr.soubor)}) ${esc(d.pbr.datum)}.</p>${d.pbr.nenalezeno.length ? `<p>V dokumentaci nezjištěno – zeptejte se klienta: ${esc(d.pbr.nenalezeno.join(', '))}.</p>` : ''}</div>` : ''}
    <p class="napoveda" data-dq-souhrn>Otázek pro klienta: ${ptat.length} · vyplněno ${vyplneno}${jinak.length ? ` · vynecháno ${jinak.length} (údaj už je${jinak.some((q) => q.stav === 'netyka') ? ' nebo se projektu netýká' : ''})` : ''}${d.nacteno ? ` · naposledy načteno z PDF ${esc(d.nacteno)}` : ''}.</p></section>
    ${oddily(ptat).map(([s, qs]) => `<section class="sek sek-seda"><h3>${esc(s)}</h3><div class="mriz">${qs.map((q) => `<label class="f"><span>${esc(q.text)}</span>${pole(q, d.odpovedi[q.id])}</label>`).join('')}</div></section>`).join('')}
    ${jinak.length ? `<details class="sek sek-seda dq-vynechane"><summary>Na tyto otázky se dotazník neptá (${jinak.length})</summary><ul>${jinak.map((q) => `<li data-dq-vynechano="${q.id}"><span>${esc(q.text)}</span> <small>${q.stav === 'vyplneno' ? `${esc(q.kde)}: ${esc(q.hodnota)}` : esc(q.duvod)}${ma(q) ? ` · odpověď klienta: ${esc(textOdpovedi(q, d.odpovedi[q.id]))}` : ''}</small></li>`).join('')}</ul></details>` : ''}`;
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
