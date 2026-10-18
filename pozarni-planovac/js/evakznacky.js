// Knihovna značek PRO EVAKUAČNÍ PLÁN – oddělená od katalogu značek DZP (ČAHD).
// Norma ČSN ISO 23601 (čl. 5 k) vyžaduje v plánu stejné značky, jaké jsou v objektu, v souladu s ISO 7010.
// Oficiální značky dodá uživatel (nahrání souboru). Tam, kde existuje podobná značka DZP (ČAHD), nabízí se jako NÁHRADA
// označená „ISO 7010 neověřeno“ – kontrola úplnosti na ni upozorní. Nic se nevymýšlí: chybějící značka zůstane prázdná.
import { najdiZnacku } from './znacky.js';
import { esc } from './formular.js';
import { EVAK_DODANE } from './evakvychozi.js';

export const EVAK_SLOTY = [
  { id: 'EVAK-001', nazev: 'Nouzový východ – směr vlevo', dzp: null },
  { id: 'EVAK-002', nazev: 'Shromaždiště (místo soustředění evakuovaných)', dzp: 'DZP-042' },
  { id: 'EVAK-003', nazev: 'Přenosný hasicí přístroj', dzp: null },
  { id: 'EVAK-004', nazev: 'Požární hadice / nástěnný hydrant', dzp: 'DZP-007' },
  { id: 'EVAK-005', nazev: 'První pomoc', dzp: 'DZP-102' },
  { id: 'EVAK-006', nazev: 'Hlásič požárního poplachu (tlačítko)', dzp: 'DZP-048' },
  { id: 'EVAK-007', nazev: 'Tísňové volání / telefon', dzp: 'DZP-051' },
  { id: 'EVAK-008', nazev: 'Evakuační výtah', dzp: 'DZP-039' },
  { id: 'EVAK-009', nazev: 'Výtah (neslouží k evakuaci)', dzp: null },
  { id: 'EVAK-010', nazev: 'Schodiště', dzp: null },
  { id: 'EVAK-011', nazev: 'Elektrické zařízení (rozvaděč)', dzp: null },
  { id: 'EVAK-012', nazev: 'Místo řízení evakuace', dzp: 'DZP-045' },
  { id: 'EVAK-013', nazev: 'Ústředna EPS', dzp: 'DZP-054' },
  { id: 'EVAK-014', nazev: 'Nouzový východ – směr vpravo', dzp: null },
  { id: 'EVAK-015', nazev: 'Směrová šipka (otáčí se na výkresu)', dzp: null },
  { id: 'EVAK-016', nazev: 'Směrová šipka šikmá', dzp: null },
];
export const jeEvakZnacka = (id) => typeof id === 'string' && id.startsWith('EVAK-');

// Stav jednoho slotu v projektu: 'nahrano' (soubor nahraný v projektu) | 'dodano' (soubor dodaný uživatelem, součást aplikace) | 'nahrada' (z DZP, ISO 7010 neověřeno) | 'chybi'.
export function stavSlotu(projekt, slot) {
  if (projekt?.evakZnacky?.[slot.id]?.png) return 'nahrano';
  if (EVAK_DODANE[slot.id]) return 'dodano';
  if (slot.dzp && najdiZnacku(slot.dzp)) return 'nahrada';
  return 'chybi';
}

// Značky použitelné v projektu (jen ty, které mají obrázek) ve tvaru katalogu DZP {id, nazev, png, zdroj, overeno}.
export function katalogEvak(projekt) {
  const o = [];
  for (const s of EVAK_SLOTY) {
    const st = stavSlotu(projekt, s);
    if (st === 'nahrano') o.push({ id: s.id, nazev: s.nazev, png: projekt.evakZnacky[s.id].png, zdroj: `Nahráno uživatelem (${projekt.evakZnacky[s.id].soubor || 'soubor'})`, overeno: false, stav: st });
    else if (st === 'dodano') o.push({ id: s.id, nazev: s.nazev, png: EVAK_DODANE[s.id], zdroj: 'Dodáno uživatelem (soulad s ISO 7010 ověřuje uživatel)', overeno: false, stav: st });
    else if (st === 'nahrada') { const z = najdiZnacku(s.dzp); o.push({ id: s.id, nazev: s.nazev, png: z.png, zdroj: `Náhrada z ČAHD (${s.dzp}) – ISO 7010 neověřeno`, overeno: false, stav: st }); }
  }
  return o;
}

// Katalog značek pro daný projekt: DZP má katalog ČAHD, evakuační plán svou knihovnu.
export const katalogProjektu = (projekt, dzpKatalog) => (projekt?.typ === 'evakuacni_plan' ? katalogEvak(projekt) : dzpKatalog);

// Nahraný soubor (PNG, JPG, SVG) → PNG data URL (max 512 px; SVG se vykreslí přes canvas, protože PDF umí vložit jen PNG/JPG).
export async function souborNaPng(soubor) {
  const url = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Soubor se nepodařilo přečíst')); r.readAsDataURL(soubor); });
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Soubor není platný obrázek (použijte PNG, JPG nebo SVG)')); i.src = url; });
  const w0 = img.naturalWidth || img.width || 256, h0 = img.naturalHeight || img.height || 256;
  const k = Math.min(1, 512 / Math.max(w0, h0)) || 1, w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/png');
}

// Modální výběr značky evakuačního plánu; vrací Promise<id|null>. naZmena() se volá po nahrání/odebrání (uložení projektu).
export function vyberEvakZnacku(projekt, naZmena) {
  return new Promise((resolve) => {
    projekt.evakZnacky ||= {};
    const dlg = document.createElement('dialog'); dlg.className = 'znacky-dlg';
    const popis = { nahrano: 'Nahráno v projektu', dodano: 'Dodáno uživatelem (lze přepsat vlastním souborem)', nahrada: 'Náhrada z ČAHD (DZP) – ISO 7010 neověřeno', chybi: 'Chybí – nahrajte oficiální značku' };
    const kresli = () => {
      dlg.innerHTML = `<form method="dialog" class="zd-hlava"><b>Značky evakuačního plánu</b><button value="zrusit" class="btn mal">Zavřít</button></form>
        <p class="napoveda">Norma ČSN ISO 23601 vyžaduje stejné značky jako v objektu (ISO 7010). Nahrajte oficiální soubory (PNG, JPG nebo SVG); značky ČAHD z DZP jsou jen náhradní.</p>
        <div class="zd-mriz" role="list">${EVAK_SLOTY.map((s) => {
          const st = stavSlotu(projekt, s), z = katalogEvak(projekt).find((x) => x.id === s.id);
          return `<div class="zd-bunka" role="listitem" data-slot="${s.id}">
            <button type="button" class="zd-vyber" data-vyber="${s.id}" ${st === 'chybi' ? 'disabled' : ''} title="${esc(popis[st])}">${z ? `<img src="${z.png}" alt="">` : '<span class="zn zn-prazdna">chybí</span>'}<span>${esc(s.nazev)}</span></button>
            <small>${esc(popis[st])}</small>
            <label class="btn mal">Nahrát…<input type="file" class="sr-only" accept="image/png,image/jpeg,image/svg+xml" data-nahrat="${s.id}"></label>
            ${st === 'nahrano' ? `<button type="button" class="btn mal" data-odebrat="${s.id}">Odebrat</button>` : ''}</div>`;
        }).join('')}</div>`;
    };
    dlg.addEventListener('click', (e) => {
      const v = e.target.closest('[data-vyber]'); if (v && !v.disabled) { dlg.dataset.vybrano = v.dataset.vyber; dlg.close(); return; }
      const o = e.target.closest('[data-odebrat]'); if (o) { delete projekt.evakZnacky[o.dataset.odebrat]; naZmena(); kresli(); }
    });
    dlg.addEventListener('change', async (e) => {
      const inp = e.target.closest('[data-nahrat]'); if (!inp || !inp.files[0]) return;
      try { projekt.evakZnacky[inp.dataset.nahrat] = { png: await souborNaPng(inp.files[0]), soubor: inp.files[0].name }; naZmena(); kresli(); }
      catch (err) { dlg.querySelector('.napoveda').textContent = `Nahrání se nezdařilo: ${err.message}`; }
    });
    dlg.addEventListener('close', () => { const v = dlg.dataset.vybrano || null; dlg.remove(); resolve(v); });
    document.body.appendChild(dlg); kresli(); dlg.showModal();
  });
}
