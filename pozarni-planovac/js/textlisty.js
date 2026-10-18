// Obecné textové listy řízené schématem (sekce s poli + opakované položky). Používá operativní plán (js/operativniplan.js).
// schema.sekce[]: { id, nazev, zdroj?, napoveda?, pole?: [[cesta, popisek, typ, sirka?, volby?]], kolekce?: { klic, nazev, pole: [[klic, popisek, typ, sirka?, volby?]], pridat, prazdno, vystup?(polozka) } }
// typy: text | area | datum | cislo | ano_ne (true/false/null) | vyber (volby = [[hodnota, popis]]) | volby (pole hodnot, zaškrtávací seznam)
import { esc, dostan, nastav, naCislo, zCisla } from './formular.js';

const uid = () => `t_${Math.random().toString(36).slice(2, 10)}`;
export const novaPolozka = (kol) => ({ ...Object.fromEntries([['id', uid()], ...kol.pole.map(([k, , typ, , volby]) => [k, typ === 'volby' ? [] : typ === 'cislo' || typ === 'ano_ne' ? null : typ === 'vyber' ? (volby?.[0]?.[0] ?? '') : ''])]), ...(kol.vychozi || {}) });

function vstup(cesta, dc, v, typ, volby, attr) {
  if (typ === 'area') return `<textarea rows="4" data-cesta="${dc}" ${attr}>${esc(v)}</textarea>`;
  if (typ === 'ano_ne') return `<select data-cesta="${dc}" data-typ="ano_ne" ${attr}><option value="">— neuvedeno —</option><option value="ano" ${v === true ? 'selected' : ''}>ano</option><option value="ne" ${v === false ? 'selected' : ''}>ne</option></select>`;
  if (typ === 'vyber') return `<select data-cesta="${dc}" ${attr}>${volby.map(([k, n]) => `<option value="${esc(k)}" ${k === v ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  if (typ === 'volby') return `<span class="volby" data-cesta="${dc}">${volby.map(([k, n]) => `<label class="chk"><input type="checkbox" value="${esc(k)}" data-typ="volby" ${attr} ${(v || []).includes(k) ? 'checked' : ''}> ${esc(n)}</label>`).join('')}</span>`;
  return `<input type="${typ === 'datum' ? 'date' : 'text'}" ${typ === 'cislo' ? 'inputmode="decimal" data-typ="cislo"' : ''} data-cesta="${dc}" ${attr} value="${esc(typ === 'cislo' ? zCisla(v) : v)}">`;
}
const ne = (attr, label) => `<button type="button" class="ne" ${attr} title="Nelze doplnit – vepsat NE" aria-label="Vyplnit NE: ${esc(label)}">NE</button>`;

export function vykresliSchema(data, schema, prefix, host, uvod = '') {
  const pole = ([c, label, typ, sirka, volby]) => {
    const dc = `${prefix}.${c}`, attr = `data-pole="${c}"`;
    return `<label class="f ${sirka === 'S' ? 'f-s' : ''} ${typ === 'volby' ? 'f-volby' : ''}"><span>${esc(label)}</span><span class="f-r">${vstup(c, dc, dostan(data, c), typ, volby, attr)}${['text', 'area'].includes(typ) ? ne(`data-ne="${c}"`, label) : ''}</span></label>`;
  };
  const kolekce = (k) => {
    const radky = (data[k.klic] || []).map((it) => `<div class="polozka" data-cesta="${prefix}.${k.klic}[${it.id}]" data-id="${it.id}">${k.pole.map(([c, label, typ, sirka, volby]) =>
      `<label class="f ${sirka === 'S' ? 'f-s' : ''}"><span>${esc(label)}</span>${vstup(c, `${prefix}.${k.klic}[${it.id}].${c}`, it[c], typ, volby, `data-pol="${k.klic}" data-id="${it.id}" data-klic="${c}"`)}</label>`).join('')}
      ${k.vystup ? `<output class="vystup" data-vystup="${it.id}">${esc(k.vystup(it))}</output>` : ''}<button type="button" class="btn mal" data-akce="smaz" data-kolekce="${k.klic}">Odebrat</button></div>`).join('') || `<p class="prazdno">${esc(k.prazdno)}</p>`;
    return `<div class="seznam" data-cesta="${prefix}.${k.klic}"><h4>${esc(k.nazev)}</h4>${radky}</div><button type="button" class="btn" data-akce="pridej" data-kolekce="${k.klic}">${esc(k.pridat)}</button>`;
  };
  host.innerHTML = uvod + schema.sekce.map((s) => `<section class="sek sek-seda" id="sek-${s.id}"><h3>${esc(s.nazev)}</h3>${s.zdroj ? `<p class="napoveda">${esc(s.zdroj)}</p>` : ''}${s.napoveda ? `<p class="napoveda">${s.napoveda}</p>` : ''}${s.pole ? `<div class="mriz">${s.pole.map(pole).join('')}</div>` : ''}${s.kolekce ? kolekce(s.kolekce) : ''}</section>`).join('');
}

const kolekceSchema = (schema, klic) => schema.sekce.find((s) => s.kolekce?.klic === klic)?.kolekce;

export function pripojSchema(data, schema, host, onZmena) {
  const hodnota = (el) => {
    if (el.dataset.typ === 'cislo') { const n = naCislo(el.value); el.classList.toggle('neplatne', Number.isNaN(n)); return Number.isNaN(n) ? undefined : n; }
    if (el.dataset.typ === 'ano_ne') return el.value === '' ? null : el.value === 'ano';
    return el.value;
  };
  host.oninput = host.onchange = (e) => {
    const el = e.target;
    if (e.type === 'change' && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type === 'text'))) return;
    if (el.dataset.typ === 'volby') {
      const cil = el.dataset.pol ? data[el.dataset.pol].find((x) => x.id === el.dataset.id) : data, kl = el.dataset.pol ? el.dataset.klic : el.dataset.pole;
      const akt = new Set(el.dataset.pol ? cil[kl] : dostan(data, kl)); if (el.checked) akt.add(el.value); else akt.delete(el.value);
      if (el.dataset.pol) cil[kl] = [...akt]; else nastav(data, kl, [...akt]);
      onZmena(false); return;
    }
    const v = hodnota(el); if (v === undefined) return;
    if (el.dataset.pole) { nastav(data, el.dataset.pole, v); onZmena(false); return; }
    if (el.dataset.pol) {
      const it = data[el.dataset.pol].find((x) => x.id === el.dataset.id); if (!it) return;
      it[el.dataset.klic] = v;
      const k = kolekceSchema(schema, el.dataset.pol), out = host.querySelector(`[data-vystup="${el.dataset.id}"]`);
      if (k?.vystup && out) out.textContent = k.vystup(it);
      onZmena(false);
    }
  };
  host.onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ne) { nastav(data, b.dataset.ne, 'NE'); const i = b.parentElement.querySelector('[data-pole]'); if (i) i.value = 'NE'; onZmena(false); }
    else if (b.dataset.akce === 'pridej') { (data[b.dataset.kolekce] ||= []).push(novaPolozka(kolekceSchema(schema, b.dataset.kolekce))); onZmena(true); }
    else if (b.dataset.akce === 'smaz') { const id = b.closest('.polozka').dataset.id; data[b.dataset.kolekce] = data[b.dataset.kolekce].filter((x) => x.id !== id); onZmena(true); }
  };
}

// Prostý text listu podle schématu (náhled a PDF). Prázdné údaje „…“, nic se nedomýšlí.
export function schemaJakoText(data, schema) {
  const h = (v, typ, volby) => {
    if (typ === 'ano_ne') return v === true ? 'ano' : v === false ? 'ne' : '…';
    if (typ === 'vyber') return volby.find(([k]) => k === v)?.[1] ?? '…';
    if (typ === 'volby') return (v || []).length ? v.map((x) => volby.find(([k]) => k === x)?.[1] ?? x).join('; ') : '…';
    if (typ === 'cislo') return v === null || v === undefined || v === '' ? '…' : zCisla(v);
    return v === null || v === undefined || String(v).trim() === '' ? '…' : String(v);
  };
  const o = [];
  for (const s of schema.sekce) {
    o.push(s.nazev.toUpperCase());
    for (const [c, label, typ, , volby] of s.pole || []) o.push(typ === 'area' ? `${label}:\n${h(dostan(data, c), typ, volby)}` : `${label}: ${h(dostan(data, c), typ, volby)}`);
    if (s.kolekce) {
      const k = s.kolekce, pol = data[k.klic] || [];
      o.push(`${k.nazev}:`);
      if (!pol.length) o.push('…');
      pol.forEach((it, i) => o.push(`${i + 1}. ${k.pole.map(([c, label, typ, , volby]) => `${label}: ${h(it[c], typ, volby)}`).join(', ')}${k.vystup ? ` → ${k.vystup(it)}` : ''}`));
      if (k.souhrn) o.push(k.souhrn(pol));
    }
    o.push('');
  }
  return o.join('\n');
}

export function nahledSchema(nadpis, pozn, text) {
  const t = text.split('\n').map((r) => (/^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9 ().,–-]{4,}$/.test(r) ? `<h4>${esc(r)}</h4>` : r === '' ? '' : `<p>${esc(r).replace(/…/g, '<span class="chybi">…</span>')}</p>`)).join('');
  return `<article class="a4 evak-nahled"><h2>${esc(nadpis)}</h2><p class="napoveda">${esc(pozn)}</p>${t}</article>`;
}
