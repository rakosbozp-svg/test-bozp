// Formulář operativní karty podle vzoru HZS SCK (list A4). Pole jsou řízena daty; každý vstup má data-cesta,
// stejnou jako cesta v nálezech kontroly úplnosti, aby šlo z nálezu skočit na pole.
import { najdiZnacku, vyberZnacku } from './znacky.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const SEKCE = [
  { id: 'hlavicka', nazev: 'Objekt a provoz', barva: 'zluta', pole: [
    ['stupenPoplachu', 'Stupeň poplachu', 'text', 'S'], ['uzemniOdbor', 'Stanice / územní odbor HZS', 'text', 'S'],
    ['objekt.nazev', 'Objekt', 'text'], ['objekt.provozovatel', 'Provozovatel', 'text'], ['objekt.ic', 'IČ', 'text', 'S'],
    ['objekt.adresa', 'Adresa', 'text'],
    ['objekt.gps.sirka', 'GPS – šířka (N)', 'cislo', 'S'], ['objekt.gps.delka', 'GPS – délka (E)', 'cislo', 'S'],
    ['objekt.provoz.pracovniDoba', 'Pracovní doba', 'text'], ['objekt.provoz.kontaktJmeno', 'Kontakt – jméno a funkce', 'text'],
    ['objekt.provoz.kontaktTelefon', 'Kontakt – telefon', 'text', 'S'], ['objekt.obsazeniOsobami', 'Obsazení osobami', 'text'],
    ['objekt.prijezdZ', 'Příjezd z', 'text'], ['objekt.omezeni', 'Omezení (průjezdná výška, nosnost mostu…)', 'text'],
  ] },
  { id: 'charakter', nazev: 'Charakter objektu', barva: 'seda', pole: [
    ['charakter.ucelStavby', 'Účel stavby', 'text'], ['charakter.podlazi', 'Podlaží', 'text', 'S'], ['charakter.pudorysM', 'Půdorys (m)', 'text', 'S'],
    ['charakter.konstrukce', 'Konstrukce objektu (hořlavá/nehořlavá)', 'text'], ['charakter.unikoveCesty', 'Únikové cesty (počet)', 'text', 'S'],
    ['charakter.celkovaVyskaM', 'Celková výška (m)', 'text', 'S'], ['charakter.steny', 'Stěny', 'text'], ['charakter.priccky', 'Příčky', 'text'],
    ['charakter.vytahy', 'Výtahy', 'text', 'S'], ['charakter.zastavenaPlochaM2', 'Zastavěná plocha (m²)', 'text', 'S'],
    ['charakter.stropy', 'Stropy', 'text'], ['charakter.strecha', 'Střecha', 'text'], ['charakter.typUnikoveCesty', 'Typ únikové cesty', 'text', 'S'],
    ['charakter.pozarniUseky', 'Požární úseky', 'text'],
  ] },
  { id: 'media', nazev: 'Uzávěry médií a vypínače', barva: 'zelena', pole: [
    ['media.hlavniUzaverVody', 'Hlavní uzávěr vody', 'text'], ['media.vedlejsiUzaverVody', 'Vedlejší uzávěr vody', 'text'],
    ['media.hlavniUzaverPlynu', 'Hlavní uzávěr plynu', 'text'], ['media.vedlejsiUzaverPlynu', 'Vedlejší uzávěr plynu', 'text'],
    ['media.hlavniUzaverTopeni', 'Hlavní uzávěr topení', 'text'], ['media.vedlejsiUzaverTopeni', 'Vedlejší uzávěr topení', 'text'],
    ['media.hlavniVypinacEl', 'Hlavní vypínač el. proudu', 'text'], ['media.vedlejsiVypinacEl', 'Vedlejší vypínač el. proudu', 'text'],
  ] },
  { id: 'pbz', nazev: 'Požárně bezpečnostní zařízení (PBZ)', barva: 'zelena', napoveda: 'Vzor HZS: nehodící se škrtněte – zde vepište „NE“, nebo umístění (např. „Vstupní chodba“).', pole: [
    ['pbz.eps', 'EPS – ústředna', 'text'], ['pbz.zdhpp', 'ZDHPP (detekce hořlavých plynů a par)', 'text'], ['pbz.apz', 'APZ (protivýbuchové zařízení)', 'text'],
    ['pbz.zdp', 'ZDP (dálkový přenos)', 'text'], ['pbz.shz', 'SHZ (stabilní hasicí zařízení)', 'text'], ['pbz.pshz', 'PSHZ (polostabilní)', 'text'],
    ['pbz.zokt', 'ZOKT (odvod kouře a tepla)', 'text'], ['pbz.pk', 'PK (požární klapky)', 'text'],
    ['pbz.vytahEvakuacni', 'Výtah evakuační', 'text'], ['pbz.vytahPozarni', 'Výtah požární', 'text'],
  ] },
  { id: 'doporuceni', nazev: 'Doporučení pro velitele zásahu', barva: 'zluta', napoveda: 'Pouze podstatné informace; uveďte, co se stane při vypnutí energií (např. CENTRAL STOP / TOTAL STOP). Vhodné konzultovat s HZS.', pole: [
    ['doporuceni', 'Doporučení', 'area'],
    ['znalostObjektu.jmeno', 'Znalost o objektu má – jméno', 'text'], ['znalostObjektu.mobil', 'Znalost o objektu má – mobil', 'text', 'S'],
  ] },
  { id: 'podpisy', nazev: 'Zpracoval a schválil', barva: 'seda', pole: [
    ['zpracoval.jmeno', 'Zpracoval – jméno a příjmení', 'text'], ['zpracoval.cisloOsvedceni', 'Číslo osvědčení', 'text', 'S'], ['zpracoval.datum', 'Datum zpracování', 'datum', 'S'],
    ['schvalil.jmeno', 'Schválil – jméno a příjmení', 'text'], ['schvalil.funkce', 'Funkce', 'text'], ['schvalil.datum', 'Datum schválení', 'datum', 'S'],
  ] },
];

export const dostan = (o, cesta) => cesta.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export function nastav(o, cesta, v) {
  const k = cesta.split('.'); const last = k.pop();
  k.reduce((a, x) => a[x], o)[last] = v;
}
export const naCislo = (t) => {
  const s = String(t).trim().replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};
export const zCisla = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

const pole = (list, [cesta, label, typ, sirka]) => {
  const dc = `listy[${list.id}].karta.${cesta}`;
  const v = dostan(list.karta, cesta);
  const ne = typ !== 'cislo' && typ !== 'datum' ? `<button type="button" class="ne" data-ne="${cesta}" title="Nelze doplnit – vepsat NE" aria-label="Vyplnit NE: ${esc(label)}">NE</button>` : '';
  const vstup = typ === 'area'
    ? `<textarea rows="5" data-cesta="${dc}" data-pole="${cesta}" data-typ="${typ}">${esc(v)}</textarea>`
    : `<input ${typ === 'datum' ? 'type="date"' : 'type="text"'} ${typ === 'cislo' ? 'inputmode="decimal"' : ''} data-cesta="${dc}" data-pole="${cesta}" data-typ="${typ}" value="${esc(typ === 'cislo' ? zCisla(v) : v)}">`;
  return `<label class="f ${sirka === 'S' ? 'f-s' : ''}"><span>${esc(label)}</span><span class="f-r">${vstup}${ne}</span></label>`;
};

const TYPY_VODY = [['hydrant', 'Vnější hydrant'], ['nadrz', 'Požární nádrž'], ['jiny', 'Jiný zdroj']];

export function vykresliKartu(list, host) {
  const k = list.karta;
  const sekce = (s) => `<section class="sek sek-${s.barva}" id="sek-${s.id}"><h3>${esc(s.nazev)}</h3>${s.napoveda ? `<p class="napoveda">${esc(s.napoveda)}</p>` : ''}<div class="mriz">${s.pole.map((p) => pole(list, p)).join('')}</div></section>`;
  const [hl, ch, me, pb, dop, pod] = SEKCE;
  host.innerHTML = [
    sekce(hl), sekce(ch),
    nebezpeci(list), fve(list),
    sekce(me), sekce(pb), vody(list),
    sekce(dop), sekce(pod),
  ].join('');
  void k;
}

function znackaHtml(id) {
  const z = id && najdiZnacku(id);
  return z ? `<img class="zn" src="${z.png}" alt="${esc(z.nazev)}" title="${z.id} – ${esc(z.nazev)}">` : '<span class="zn zn-prazdna">bez značky</span>';
}

function nebezpeci(list) {
  const p = `listy[${list.id}].karta`;
  const radky = list.karta.nebezpeci.map((n) => `
    <div class="polozka" data-cesta="${p}.nebezpeci[${n.id}]" data-id="${n.id}">
      <button type="button" class="zn-btn" data-akce="znacka" data-kolekce="nebezpeci" title="Vybrat značku z katalogu">${znackaHtml(n.znackaId)}</button>
      <label class="f"><span>Nebezpečná látka / nebezpečí (název, množství, umístění) – nebo „NE“</span><span class="f-r"><input type="text" data-pol="nebezpeci" data-id="${n.id}" data-klic="popis" value="${esc(n.popis)}"><button type="button" class="ne" data-akce="ne-pol" title="Vepsat NE">NE</button></span></label>
      <label class="f f-s"><span>Vhodné hasivo</span><input type="text" data-pol="nebezpeci" data-id="${n.id}" data-klic="hasivo" value="${esc(n.hasivo)}"></label>
      <button type="button" class="btn mal" data-akce="smaz" data-kolekce="nebezpeci" title="Odebrat položku">Odebrat</button>
    </div>`).join('') || '<p class="prazdno">Zatím žádná položka. Bez nebezpečí přidejte položku s textem „NE“.</p>';
  return `<section class="sek sek-cervena" id="sek-nebezpeci" data-cesta="${p}.nebezpeci"><h3>Nebezpečí</h3><div class="seznam">${radky}</div><button type="button" class="btn" data-akce="pridej" data-kolekce="nebezpeci">+ Přidat nebezpečí</button></section>`;
}

function fve(list) {
  const f = list.karta.fve, p = `listy[${list.id}].karta.fve`;
  const sel = (klic, v) => `<select data-fve="${klic}" ${klic === 'pritomna' ? `data-cesta="${p}.pritomna"` : ''}><option value="">— neuvedeno —</option><option value="ano" ${v === true ? 'selected' : ''}>ano</option><option value="ne" ${v === false ? 'selected' : ''}>ne</option></select>`;
  const t = (klic, label, extra = '') => `<label class="f ${extra}"><span>${label}</span><input type="text" data-fve="${klic}" data-cesta="${p}.${klic}" value="${esc(zCisla(f[klic]))}"></label>`;
  return `<section class="sek sek-cervena" id="sek-fve"><h3>Fotovoltaická elektrárna (FVE)</h3>
    <div class="mriz"><label class="f f-s"><span>Je v objektu FVE?</span>${sel('pritomna', f.pritomna)}</label>
    ${f.pritomna === true ? `${t('pocetPanelu', 'Počet panelů', 'f-s')}${t('vykonKWp', 'Výkon (kWp)', 'f-s')}
    <label class="f f-s"><span>Bateriové úložiště</span>${sel('baterie', f.baterie)}</label>
    ${t('vypinacSilovaCast', 'Vypínač silové části – umístění')}${t('hasivo', 'Vhodné hasivo', 'f-s')}
    <label class="f"><span>Popis (optimizéry, střídače, STOP FVE, DC trasy…)</span><textarea rows="3" data-fve="popis">${esc(f.popis)}</textarea></label>
    <p class="napoveda">DC část může být zásahově relevantní i po odpojení – uveďte to v doporučení veliteli zásahu.</p>` : ''}</div></section>`;
}

function vody(list) {
  const p = `listy[${list.id}].karta`;
  const radky = list.karta.vodniZdroje.map((v) => `
    <div class="polozka" data-cesta="${p}.vodniZdroje[${v.id}]" data-id="${v.id}">
      <button type="button" class="zn-btn" data-akce="znacka" data-kolekce="vodniZdroje" title="Vybrat značku z katalogu">${znackaHtml(v.znackaId)}</button>
      <label class="f f-s"><span>Typ</span><select data-pol="vodniZdroje" data-id="${v.id}" data-klic="typ">${TYPY_VODY.map(([k, n]) => `<option value="${k}" ${v.typ === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="f"><span>Popis a umístění</span><input type="text" data-pol="vodniZdroje" data-id="${v.id}" data-klic="popis" value="${esc(v.popis)}"></label>
      ${v.typ === 'hydrant' ? `<label class="f f-s"><span>Průtok (l/s)</span><input type="text" inputmode="decimal" data-pol="vodniZdroje" data-id="${v.id}" data-klic="prutokLs" data-typ="cislo" value="${esc(zCisla(v.prutokLs))}"></label>
      <label class="chk"><input type="checkbox" data-pol="vodniZdroje" data-id="${v.id}" data-klic="overenPrutok" ${v.overenPrutok ? 'checked' : ''}> průtok je ověřen</label>` : ''}
      ${v.typ === 'nadrz' ? `<label class="f f-s"><span>Objem (m³)</span><input type="text" inputmode="decimal" data-pol="vodniZdroje" data-id="${v.id}" data-klic="objemM3" data-typ="cislo" value="${esc(zCisla(v.objemM3))}"></label>` : ''}
      <label class="f f-s"><span>GPS – šířka</span><input type="text" inputmode="decimal" data-pol="vodniZdroje" data-id="${v.id}" data-klic="gps.sirka" data-typ="cislo" value="${esc(zCisla(v.gps?.sirka))}"></label>
      <label class="f f-s"><span>GPS – délka</span><input type="text" inputmode="decimal" data-pol="vodniZdroje" data-id="${v.id}" data-klic="gps.delka" data-typ="cislo" value="${esc(zCisla(v.gps?.delka))}"></label>
      <button type="button" class="btn mal" data-akce="smaz" data-kolekce="vodniZdroje">Odebrat</button>
    </div>`).join('') || '<p class="prazdno">Zatím žádný zdroj vody.</p>';
  return `<section class="sek sek-modra" id="sek-voda" data-cesta="${p}.vodniZdroje"><h3>Vodní zdroje a hasební látky</h3><p class="napoveda">U vnějších hydrantů doplňte ověřený průtok v l/s (návod HZS).</p><div class="seznam">${radky}</div><button type="button" class="btn" data-akce="pridej" data-kolekce="vodniZdroje">+ Přidat vodní zdroj</button></section>`;
}

const uid = () => `p_${Math.random().toString(36).slice(2, 10)}`;
export const novaPolozka = (kolekce) => (kolekce === 'nebezpeci'
  ? { id: uid(), popis: '', hasivo: '', znackaId: null }
  : { id: uid(), typ: 'hydrant', popis: '', prutokLs: null, overenPrutok: false, objemM3: null, gps: { sirka: null, delka: null }, znackaId: null });

// Připojí obsluhu. onZmena(prekreslit) se volá po každé změně modelu.
export function pripoj(list, host, onZmena) {
  const k = list.karta;
  const polozka = (el) => k[el.dataset.pol].find((x) => x.id === el.dataset.id);
  host.oninput = host.onchange = (e) => {
    const el = e.target;
    // U textových polí stačí 'input'; 'change' při opuštění pole by zbytečně překreslil panel dřív než proběhne klik.
    if (e.type === 'change' && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'checkbox'))) return;
    if (el.dataset.pole) {
      let v = el.value;
      if (el.dataset.typ === 'cislo') { v = naCislo(v); el.classList.toggle('neplatne', Number.isNaN(v)); if (Number.isNaN(v)) return; }
      nastav(k, el.dataset.pole, v); onZmena(false);
    } else if (el.dataset.pol) {
      const it = polozka(el); if (!it) return;
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.typ === 'cislo') { v = naCislo(v); el.classList.toggle('neplatne', Number.isNaN(v)); if (Number.isNaN(v)) return; }
      const kl = el.dataset.klic.split('.'); const last = kl.pop();
      kl.reduce((a, x) => a[x], it)[last] = v;
      onZmena(e.type === 'change' && (el.tagName === 'SELECT'));   // změna typu mění zobrazená pole
    } else if (el.dataset.fve) {
      const kl = el.dataset.fve;
      if (el.tagName === 'SELECT') { k.fve[kl] = el.value === '' ? null : el.value === 'ano'; onZmena(kl === 'pritomna'); }
      else { k.fve[kl] = ['pocetPanelu', 'vykonKWp'].includes(kl) ? (Number.isNaN(naCislo(el.value)) ? k.fve[kl] : naCislo(el.value)) : el.value; onZmena(false); }
    }
  };
  host.onclick = async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ne) {
      nastav(k, b.dataset.ne, 'NE');
      const inp = b.parentElement.querySelector('[data-pole]'); inp.value = 'NE'; onZmena(false);
    } else if (b.dataset.akce === 'ne-pol') {
      const it = polozka(b.closest('.polozka').querySelector('[data-pol]')); it.popis = 'NE';
      b.parentElement.querySelector('input').value = 'NE'; onZmena(false);
    } else if (b.dataset.akce === 'pridej') { k[b.dataset.kolekce].push(novaPolozka(b.dataset.kolekce)); onZmena(true); }
    else if (b.dataset.akce === 'smaz') {
      const id = b.closest('.polozka').dataset.id; k[b.dataset.kolekce] = k[b.dataset.kolekce].filter((x) => x.id !== id); onZmena(true);
    } else if (b.dataset.akce === 'znacka') {
      const id = await vyberZnacku(); if (!id) return;
      const it = k[b.dataset.kolekce].find((x) => x.id === b.closest('.polozka').dataset.id); it.znackaId = id; onZmena(true);
    }
  };
}
