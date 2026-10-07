// Lokální ukládání projektů v prohlížeči (localStorage). Bez backendu se nic nesynchronizuje s webovou verzí –
// zálohou je Stáhnout → Editovatelný projekt (.json).
import { nactiProjekt, serializuj } from './model.js';

const IDX = 'pp.index.v1', PROJ = 'pp.projekt.', POSL = 'pp.posledni';

function ls() {
  try { return window.localStorage; } catch { return null; }
}
const cti = (k) => { try { return ls()?.getItem(k) ?? null; } catch { return null; } };
function pis(k, v) {
  try { ls().setItem(k, v); return { ok: true }; } catch (e) { return { ok: false, chyba: e?.message || 'Úložiště prohlížeče není dostupné nebo je plné' }; }
}

export function seznam() {
  try { return JSON.parse(cti(IDX) || '[]').sort((a, b) => b.zmeneno.localeCompare(a.zmeneno)); } catch { return []; }
}

export function uloz(p) {
  const r = pis(PROJ + p.id, serializuj(p));
  if (!r.ok) return r;
  const idx = seznam().filter((x) => x.id !== p.id);
  idx.push({ id: p.id, nazev: p.nazev, typ: p.typ, zmeneno: p.zmeneno });
  return pis(IDX, JSON.stringify(idx));
}

export function nacti(id) {
  const t = cti(PROJ + id);
  return t ? nactiProjekt(t) : null;
}

export function smaz(id) {
  try { ls().removeItem(PROJ + id); } catch { /* nic */ }
  pis(IDX, JSON.stringify(seznam().filter((x) => x.id !== id)));
  if (cti(POSL) === id) try { ls().removeItem(POSL); } catch { /* nic */ }
}

export const nastavPosledni = (id) => pis(POSL, id);
export const posledni = () => { const id = cti(POSL); return id && seznam().some((x) => x.id === id) ? id : null; };
export const dostupne = () => pis('pp.test', '1').ok;

export function stahni(p) {
  const blob = new Blob([serializuj(p)], { type: 'application/json' });
  const a = document.createElement('a');
  const jmeno = p.nazev.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'projekt';
  a.href = URL.createObjectURL(blob);
  a.download = `${jmeno}.pplan.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
