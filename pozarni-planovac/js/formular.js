// Formulář operativní karty podle vzoru HZS SČK (list A4). Pole jsou řízena daty (js/kartaPole.js); každý vstup má data-cesta,
// stejnou jako cesta v nálezech kontroly úplnosti, aby šlo z nálezu skočit na pole.
import { najdiZnacku, vyberZnacku } from './znacky.js';
import { textVzdalenosti, ctiGps } from './geo.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export { SEKCE } from './kartaPole.js';
import { SEKCE, PBZ, PBZ_UMISTENI, BEZ_NE, stavPbz, upresneniPbz } from './kartaPole.js';

export const dostan = (o, cesta) => cesta.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
export function nastav(o, cesta, v) {
  const k = cesta.split('.'); const last = k.pop();
  k.reduce((a, x) => a[x], o)[last] = v;
}
// Číslo z textu: desetinná čárka i tečka, mezery mezi tisíci („1 250,5“); cokoli jiného je NaN (pole se označí červeně).
export const naCislo = (t) => {
  let s = String(t ?? '').trim();
  if (s === '') return null;
  if (/^[-+]?\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?$/.test(s)) s = s.replace(/[ \u00a0\u202f]/g, '');
  if (!/^[-+]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(s)) return NaN;
  return Number(s.replace(',', '.'));
};
export const zCisla = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

const pole = (list, [cesta, label, typ, sirka]) => {
  const dc = `listy[${list.id}].karta.${cesta}`;
  const v = dostan(list.karta, cesta);
  const ne = (typ === 'text' || typ === 'area') && !BEZ_NE.has(cesta) ? `<button type="button" class="ne" data-ne="${cesta}" title="Nelze doplnit – vepsat NE" aria-label="Vyplnit NE: ${esc(label)}">NE</button>` : '';
  const vstup = typ === 'area'
    ? `<textarea rows="5" data-cesta="${dc}" data-pole="${cesta}" data-typ="${typ}">${esc(v)}</textarea>`
    : typ === 'anone'
      ? `<select data-cesta="${dc}" data-pole="${cesta}" data-typ="anone"><option value="">— neuvedeno —</option><option value="ano" ${v === true ? 'selected' : ''}>ano</option><option value="ne" ${v === false ? 'selected' : ''}>ne</option></select>`
      : `<input ${typ === 'datum' ? 'type="date"' : 'type="text"'} ${typ === 'cislo' ? 'inputmode="decimal"' : ''} data-cesta="${dc}" data-pole="${cesta}" data-typ="${typ}" value="${esc(typ === 'cislo' ? zCisla(v) : v)}">`;
  return `<label class="f ${sirka === 'S' ? 'f-s' : ''}"><span>${esc(label)}</span><span class="f-r">${vstup}${ne}</span></label>`;
};

const TYPY_VODY = [['hydrant', 'Vnější hydrant'], ['nadrz', 'Požární nádrž'], ['jiny', 'Jiný zdroj']];

export function vykresliKartu(list, host) {
  const sekce = (s) => `<section class="sek sek-${s.barva}" id="sek-${s.id}"><h3>${esc(s.nazev)}</h3>${s.napoveda ? `<p class="napoveda">${esc(s.napoveda)}</p>` : ''}<div class="mriz">${s.pole.map((p) => pole(list, p)).join('')}</div></section>`;
  const [hl, ch, me, dop, pod] = SEKCE;
  host.innerHTML = [
    mimoVzor(list), sekce(hl), sekce(ch),
    nebezpeci(list), fve(list),
    sekce(me), pbz(list), vody(list),
    sekce(dop), sekce(pod),
  ].join('');
}

// PBZ podle vzoru: „* nehodící se smaž“ – u každého zařízení se volí je / není; na kartě se vytisknou jen zařízení, která v objektu jsou.
function pbz(list) {
  const p = `listy[${list.id}].karta.pbz`, d = list.karta.pbz;
  const umisteni = PBZ_UMISTENI.map(([k, z, n]) => `<label class="f"><span>${z} (${n}) – umístění</span><span class="f-r"><input type="text" data-cesta="${p}.${k}" data-pole="pbz.${k}" data-typ="text" value="${esc(d[k])}"><button type="button" class="ne" data-ne="pbz.${k}" title="Nelze doplnit – vepsat NE">NE</button></span></label>`).join('');
  const zarizeni = PBZ.map(([k, z, n]) => {
    const st = stavPbz(d[k]);
    return `<div class="f pbz-radek" data-cesta="${p}.${k}"><span>${z} – ${n}</span><span class="f-r"><select data-pbz="${k}" aria-label="${z}: je v objektu?"><option value="">— neuvedeno —</option><option value="ano" ${st === true ? 'selected' : ''}>je v objektu</option><option value="ne" ${st === false ? 'selected' : ''}>není</option></select>${st === true ? `<input type="text" data-pbz-upresneni="${k}" placeholder="upřesnění (nepovinné), např. ústředna ve vrátnici" aria-label="${z}: upřesnění" value="${esc(upresneniPbz(d[k]))}">` : ''}</span></div>`;
  }).join('');
  return `<section class="sek sek-zelena" id="sek-pbz"><h3>Požárně bezpečnostní zařízení (PBZ)</h3><p class="napoveda">Vzor HZS SČK: „* nehodící se smaž“ – u každého zařízení zvolte, zda v objektu je. Na kartě se vytisknou jen zařízení, která v objektu jsou (je-li vše „není“, vytiskne se „NE“). KTPO a OPPO mají ve vzoru vlastní okénko – vepište umístění, nebo „NE“.</p>
    <div class="mriz">${umisteni}</div><div class="mriz pbz-mriz">${zarizeni}</div>
    <p><button type="button" class="btn mal" data-akce="pbz-vse-ne" title="Nastaví „není“ u zařízení, která jsou zatím neuvedená">Zbylá zařízení: není</button></p></section>`;
}

// Údaje ze starší verze karty, které vzor HZS SČK nemá (vedlejší uzávěry apod.): nezahazují se, ale netisknou.
function mimoVzor(list) {
  const m = list.karta.mimoVzor || [];
  if (!m.length) return '';
  return `<section class="sek sek-seda" id="sek-mimovzor" data-cesta="listy[${list.id}].karta.mimoVzor"><h3>Údaje mimo vzor karty</h3><p class="napoveda">Tyto údaje pocházejí ze starší verze karty. Vzor HZS SČK pro ně nemá okénko, proto se na kartě netisknou. Je-li údaj podstatný, přepište ho do doporučení pro velitele zásahu nebo do grafické části a pak ho odeberte.</p>
    <ul class="mimo-vzor">${m.map((x, i) => `<li><b>${esc(x.nazev)}:</b> ${esc(x.hodnota)} <button type="button" class="btn mal" data-akce="mimo-vzor-smaz" data-i="${i}">Odebrat</button></li>`).join('')}</ul></section>`;
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
  return `<section class="sek sek-cervena" id="sek-nebezpeci" data-cesta="${p}.nebezpeci"><h3>Nebezpečí</h3><p class="napoveda">Vzor HZS SČK má dva předtištěné řádky – hořlavé látky a výbušniny (předpřipravená okénka se nemažou). Nehodí-li se, vepište „NE“; u chemických látek uveďte vhodná hasiva. Další nebezpečí přidejte tlačítkem.</p><div class="seznam">${radky}</div><button type="button" class="btn" data-akce="pridej" data-kolekce="nebezpeci">+ Přidat nebezpečí</button></section>`;
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
      <output class="vystup" data-vzdalenost="${v.id}">${esc(textVzdalenosti(list.karta.objekt.gps, v.gps))}</output>
      <button type="button" class="btn mal" data-akce="smaz" data-kolekce="vodniZdroje">Odebrat</button>
    </div>`).join('') || '<p class="prazdno">Zatím žádný zdroj vody.</p>';
  return `<section class="sek sek-modra" id="sek-voda" data-cesta="${p}.vodniZdroje"><h3>Vodní zdroje a hasební látky</h3><p class="napoveda">U vnějších hydrantů doplňte ověřený průtok v l/s (návod HZS). GPS lze vložit najednou do pole šířky (např. „50.1452539N, 14.0968236E“ z Mapy.cz) – délka se doplní sama; je-li vyplněno GPS objektu, spočte se vzdálenost.</p><div class="seznam">${radky}</div><button type="button" class="btn" data-akce="pridej" data-kolekce="vodniZdroje">+ Přidat vodní zdroj</button></section>`;
}

const uid = () => `p_${Math.random().toString(36).slice(2, 10)}`;
export const novaPolozka = (kolekce) => (kolekce === 'nebezpeci'
  ? { id: uid(), popis: '', hasivo: '', znackaId: null }
  : { id: uid(), typ: 'hydrant', popis: '', prutokLs: null, overenPrutok: false, objemM3: null, gps: { sirka: null, delka: null }, znackaId: null });

// Jedna souřadnice: číslo, případně se světovou stranou („50.1428769N“, „N 50,14“); S a W jsou záporné.
export function ctiSouradnici(text) {
  const m = /^\s*([NSEW])?\s*([-+]?\d+(?:[.,]\d+)?)\s*°?\s*([NSEW])?\s*$/i.exec(String(text ?? ''));
  if (!m || (m[1] && m[3])) return naCislo(text);
  const v = Number(m[2].replace(',', '.')), sm = (m[1] || m[3] || '').toUpperCase();
  return sm === 'S' || sm === 'W' ? -Math.abs(v) : v;
}
// Text, který vypadá jako rozepsaná dvojice souřadnic (oddělovač, světová strana, stupně) – při psaní se nechá být.
const rozepsanaDvojice = (t) => /[;°'"′″]|\d\s*[NSEW]\s*\S|\d\s*,\s+|\d\s+\d|,\s*$/i.test(String(t).trim());

// Připojí obsluhu. onZmena(prekreslit) se volá po každé změně modelu.
export function pripoj(list, host, onZmena) {
  const k = list.karta;
  const obnovVzdalenosti = () => host.querySelectorAll('[data-vzdalenost]').forEach((o) => { const v = k.vodniZdroje.find((x) => x.id === o.dataset.vzdalenost); o.textContent = v ? textVzdalenosti(k.objekt.gps, v.gps) : ''; });
  const polozka = (el) => k[el.dataset.pol].find((x) => x.id === el.dataset.id);
  // GPS vložené jedním textem do pole šířky („50.14N, 14.09E“, i ve stupních/minutách) → šířka i délka. Rozdělí se při vložení
  // najednou (schránka, automatické vyplnění) nebo po opuštění pole – při psaní po znacích by se rozdělilo uprostřed čísla.
  function gpsSirka(el, e, g0, zapis) {
    const t = el.value, najednou = t.length - (el._predchozi ?? '').length > 1; el._predchozi = t;
    const g = ctiGps(t);
    if (g && (najednou || e.type === 'change')) {
      el.value = zCisla(g.sirka); el._predchozi = el.value; delete el.dataset.ceka; el.classList.remove('neplatne');
      const d = el.closest('.polozka, .mriz, section')?.querySelector(el.dataset.pole ? '[data-pole="objekt.gps.delka"]' : `[data-id="${el.dataset.id}"][data-klic="gps.delka"]`);
      if (d) { d.value = zCisla(g.delka); d.classList.remove('neplatne'); }
      zapis(g); return true;
    }
    if (e.type === 'input' && rozepsanaDvojice(t)) { el.dataset.ceka = '1'; el.classList.remove('neplatne'); return true; }
    delete el.dataset.ceka;
    const v = ctiSouradnici(t); el.classList.toggle('neplatne', Number.isNaN(v) || (v !== null && Math.abs(v) > 90));
    if (!Number.isNaN(v) && !(v !== null && Math.abs(v) > 90)) zapis({ sirka: v, delka: g0.delka }, true);
    return true;
  }
  host.oninput = host.onchange = (e) => {
    const el = e.target;
    // U textových polí stačí 'input'; 'change' při opuštění pole by zbytečně překreslil panel dřív než proběhne klik.
    // Výjimka: pole šířky GPS s rozepsanou dvojicí souřadnic se zpracuje až po opuštění.
    if (e.type === 'change' && !el.dataset.ceka && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'checkbox'))) return;
    if (el.dataset.pole === 'objekt.gps.sirka') {
      gpsSirka(el, e, k.objekt.gps, (g, jenSirka) => { k.objekt.gps.sirka = g.sirka; if (!jenSirka) k.objekt.gps.delka = g.delka; obnovVzdalenosti(); onZmena(false); });
    } else if (el.dataset.pole) {
      let v = el.value;
      if (el.dataset.typ === 'anone') v = v === '' ? null : v === 'ano';
      else if (el.dataset.typ === 'cislo') {
        v = el.dataset.pole.startsWith('objekt.gps') ? ctiSouradnici(v) : naCislo(v);
        const mimo = Number.isFinite(v) && el.dataset.pole === 'objekt.gps.delka' && Math.abs(v) > 180;
        el.classList.toggle('neplatne', Number.isNaN(v) || mimo); if (Number.isNaN(v) || mimo) return;
      }
      nastav(k, el.dataset.pole, v); if (el.dataset.pole.startsWith('objekt.gps')) obnovVzdalenosti(); onZmena(false);
    } else if (el.dataset.pol) {
      const it = polozka(el); if (!it) return;
      if (el.dataset.klic === 'gps.sirka') {
        it.gps ||= { sirka: null, delka: null };
        gpsSirka(el, e, it.gps, (g, jenSirka) => { it.gps.sirka = g.sirka; if (!jenSirka) it.gps.delka = g.delka; obnovVzdalenosti(); onZmena(false); });
        return;
      }
      let v = el.type === 'checkbox' ? el.checked : el.value;
      if (el.dataset.typ === 'cislo') {
        v = el.dataset.klic === 'gps.delka' ? ctiSouradnici(v) : naCislo(v);
        const spatne = Number.isNaN(v) || (Number.isFinite(v) && (el.dataset.klic === 'gps.delka' ? Math.abs(v) > 180 : v < 0));
        el.classList.toggle('neplatne', spatne); if (spatne) return;
      }
      const kl = el.dataset.klic.split('.'); const last = kl.pop();
      kl.reduce((a, x) => (a[x] ||= {}), it)[last] = v;
      if (el.dataset.klic.startsWith('gps.')) obnovVzdalenosti();
      onZmena(e.type === 'change' && (el.tagName === 'SELECT'));   // změna typu mění zobrazená pole
    } else if (el.dataset.fve) {
      const kl = el.dataset.fve;
      if (el.tagName === 'SELECT') { k.fve[kl] = el.value === '' ? null : el.value === 'ano'; onZmena(kl === 'pritomna'); }
      else if (['pocetPanelu', 'vykonKWp'].includes(kl)) {                 // celé nezáporné číslo panelů, nezáporný výkon; jinak červeně a model beze změny
        const n = naCislo(el.value), spatne = Number.isNaN(n) || (n !== null && (n < 0 || (kl === 'pocetPanelu' && !Number.isInteger(n))));
        el.classList.toggle('neplatne', spatne); if (spatne) return;
        k.fve[kl] = n; onZmena(false);
      } else { k.fve[kl] = el.value; onZmena(false); }
    } else if (el.dataset.pbz) {
      const kl = el.dataset.pbz;
      k.pbz[kl] = el.value === '' ? '' : el.value === 'ne' ? 'NE' : (upresneniPbz(k.pbz[kl]) || 'ANO');
      onZmena(e.type === 'change');                                        // u „je v objektu“ se ukáže pole pro upřesnění
    } else if (el.dataset.pbzUpresneni) {
      const kl = el.dataset.pbzUpresneni, t = el.value.trim();
      k.pbz[kl] = !t || ['NE', 'ANO'].includes(t.toUpperCase()) ? 'ANO' : t; onZmena(false);
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
    } else if (b.dataset.akce === 'pbz-vse-ne') {
      for (const [kl] of PBZ) if (stavPbz(k.pbz[kl]) === null) k.pbz[kl] = 'NE';
      onZmena(true);
    } else if (b.dataset.akce === 'mimo-vzor-smaz') {
      k.mimoVzor.splice(Number(b.dataset.i), 1); onZmena(true);
    }
  };
}
