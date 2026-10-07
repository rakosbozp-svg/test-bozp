// Pravý panel: Úplnost, Metodika DZP, Projekt.
import { zkontrolujUplnost, souhrn, HLADINY } from './uplnost.js';
import { esc } from './formular.js';
import { pridejRevizi } from './model.js';

export function panelUplnosti(projekt, katalog, host) {
  const n = zkontrolujUplnost(projekt, katalog);
  const s = souhrn(n);
  const radek = (x) => `<li class="n-${x.hladina}"><button type="button" data-cesta="${esc(x.cesta)}"><b>${x.hladina === HLADINY.CHYBA ? 'Chybí' : 'Pozor'}</b> ${esc(x.text)}</button></li>`;
  const html = `<h3>Kontrola úplnosti</h3><p class="souhrn"><span class="odz cer">${s.chyby} chyb</span> <span class="odz zl">${s.upozorneni} upozornění</span></p>
  <p class="napoveda">Kontrola vychází z vzoru a návodu HZS SCK. Neověřuje právní správnost.</p>
  <ul class="nalezy">${n.filter((x) => x.hladina === HLADINY.CHYBA).map(radek).join('')}${n.filter((x) => x.hladina === HLADINY.UPOZORNENI).map(radek).join('')}</ul>`;
  if (host._html !== html) { host.innerHTML = html; host._html = html; }   // beze změny nepřekreslovat (neztratí se klik)
  return n;
}

export const METODIKA = `
<h3>Metodika DZP</h3>
<p class="napoveda">Shrnutí pravidel z dodaných podkladů. Metodika Hanuška (1996) je obsahový základ aplikace, <b>nikoli potvrzení aktuální právní správnosti</b>. Každou DZP před vydáním ověřte podle platné legislativy, PBŘ, skutečného stavu objektu a požadavků HZS.</p>
<details open><summary>Operativní plán × operativní karta</summary>
<p><b>Operativní karta</b> je zjednodušená forma pro objekty s méně složitými podmínkami zásahu, zpravidla v jednom stavebním objektu (Hanuška 1996, kap. 3.1; Zásady HZS SCK, kap. 3). Tvoří ji textová část (charakter objektu, hasicí látky, doporučení veliteli) a grafická část (plán objektu, komunikace, zdroje vody), A4 oboustranně.</p>
<p><b>Operativní plán</b> je pro složitější areály a objekty: základní text, operativně taktická studie, vyjímatelná příloha (text + grafika), případně výpočet sil a prostředků (kap. 2).</p></details>
<details><summary>Grafická část – barvy</summary><ul class="barvy">
<li><i style="background:#1f5fd0"></i> modrá – vše, co souvisí s hašením (vodní zdroje, sklady požárního nářadí)</li>
<li><i style="background:#d62b1f"></i> červená, oranžová – vše, co komplikuje zásah nebo vytváří nebezpečí</li>
<li><i style="background:#2f9e44"></i> zelená – plochy okolí bez úpravy pro zásah, vegetace</li>
<li><i style="background:#8b5a2b"></i> hnědá – objekty s hořlavým povrchem nebo konstrukcí (požární mosty)</li>
<li><i style="background:#f2d200"></i> žlutá – nástupní plochy a komunikace vhodné pro techniku</li></ul>
<p class="zdroj">Hanuška 1996, kap. 2.3.1</p></details>
<details><summary>Výkres – povinné prvky</summary><ul>
<li>Popisové pole s názvem objektu, osobou, razítkem a podpisem.</li><li>Síť 10 × 10 m pro odhad vzdáleností.</li><li>Světové strany (severka) a měřítko.</li>
<li>Značka, která není v příloze č. 1 metodiky, se popíše v legendě na témže výkresu.</li><li>Značky se kreslí shodnou tloušťkou čar a velikost se přizpůsobí měřítku.</li></ul>
<p class="zdroj">Hanuška 1996, kap. 2.3; vzor HZS SCK. <i>Aplikace nabízí barvy metodiky, síť 10 × 10 m, severku, měřítko, razítko a legendu; vše ověřuje zpracovatel.</i></p></details>
<details><summary>Pravidla vyplnění karty (HZS SCK)</summary><ul>
<li>Předpřipravená okénka nemažte; co nelze doplnit, vepište „NE“.</li><li>U chemických látek uveďte vhodná hasiva.</li><li>U FVE uveďte výkon v kWp.</li>
<li>U vnějších hydrantů uveďte ověřený průtok v l/s.</li><li>V doporučení veliteli jen podstatné informace a co se stane při vypnutí energií.</li>
<li>Kartu uložte jako PDF a odešlete ke konzultaci na místně příslušný ÚO HZS, nebo podejte ke schválení.</li></ul><p class="zdroj">Návod k vyplnění OK, HZS SCK. Vzor platí pro HZS Středočeského kraje.</p></details>
<details><summary>Kdo smí DZP zpracovat a jak se předkládá</summary>
<p>DZP smí zpracovat osoba podle § 11 odst. 1 nebo 2 zákona o požární ochraně (OZO nebo technik PO). Předkládá se ke schválení ve 2 listinných vyhotoveních se žádostí (Zásady HZS SCK, kap. 1 a 4).</p><p class="zdroj">Údaje jsou převzaty z dodaných Zásad HZS SCK; ověřte jejich aktuální znění.</p></details>
<details><summary>Co vyžaduje odborné nebo místní ověření</summary><ul>
<li>Aktuální znění právních předpisů (vyhláška 246/2001 Sb. a další).</li><li>Vhodnost hasiv u konkrétních látek.</li><li>Ověřený průtok hydrantů a skutečný stav uzávěrů a vypínačů.</li>
<li>Požadovaný druh a rozsah DZP – konzultace s HZS před předložením.</li><li>Použití značek ISO 7010 – podle PBŘ a konkrétního projektu.</li></ul></details>`;

export function panelProjektu(projekt, host, onZmena) {
  host.innerHTML = `<h3>Projekt</h3>
  <label class="f"><span>Název projektu</span><input type="text" id="p-nazev" value="${esc(projekt.nazev)}"></label>
  <h4>Revize</h4>
  <ol class="revize-seznam">${projekt.revize.map((r) => `<li>${esc(r.datum)} – ${esc(r.popis)}${r.autor ? ` (${esc(r.autor)})` : ''}</li>`).join('') || '<li class="prazdno">Zatím žádná revize.</li>'}</ol>
  <form id="p-rev" class="rev-form"><input type="text" name="popis" placeholder="Popis revize" required><input type="text" name="autor" placeholder="Autor"><button class="btn">Přidat revizi</button></form>
  ${projekt.poznamkyKOvereni.length ? `<h4>Poznámky k ověření</h4><ul class="poznamky">${projekt.poznamkyKOvereni.map((x) => `<li><b>${esc(x.tema)}:</b> ${esc(x.text)} <i>(${esc(x.stav)})</i></li>`).join('')}</ul>` : ''}
  <p class="napoveda">Projekty jsou uloženy lokálně v tomto prohlížeči a <b>automaticky se nesynchronizují</b> s webovou verzí ani jinými zařízeními. Zálohujte přes Stáhnout → Editovatelný projekt.</p>`;
  host.querySelector('#p-nazev').oninput = (e) => { projekt.nazev = e.target.value || 'Bez názvu'; onZmena(false); };
  host.querySelector('#p-rev').onsubmit = (e) => {
    e.preventDefault(); const d = new FormData(e.target);
    pridejRevizi(projekt, { popis: d.get('popis'), autor: d.get('autor') }); onZmena(true);
  };
}
