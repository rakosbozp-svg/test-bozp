// Lokální ukládání projektů v prohlížeči. Primárně IndexedDB (kvůli importovaným podkladům), záložně localStorage.
// Čtení je synchronní z paměťové cache načtené při startu (init); zápis jde do úložiště asynchronně.
// Bez backendu se projekty nesynchronizují s webovou verzí – zálohou je soubor (jeden projekt, nebo všechny najednou).
import { nactiProjekt, serializuj, FORMAT_ZALOHY } from './model.js';

const DB = 'pplan', OBJ = 'projekty', LS_IDX = 'pp.index.v1', LS_PROJ = 'pp.projekt.', POSL = 'pp.posledni', ZALOHA = 'pp.zaloha';
let db = null, rezim = 'pamet';             // 'idb' | 'ls' | 'pamet' (nic se neukládá)
const cache = new Map();                    // id -> {id, nazev, typ, zmeneno, text}
let fronta = Promise.resolve();

const ls = () => { try { return window.localStorage; } catch { return null; } };
const lsCti = (k) => { try { return ls()?.getItem(k) ?? null; } catch { return null; } };
const lsPis = (k, v) => { try { ls().setItem(k, v); return true; } catch { return false; } };
const lsMaz = (k) => { try { ls()?.removeItem(k); } catch { /* nic */ } };

const otevri = () => new Promise((ok, ko) => {
  if (typeof indexedDB === 'undefined') return ko(new Error('IndexedDB není dostupná'));
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => r.result.createObjectStore(OBJ, { keyPath: 'id' });
  r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error);
});
const tx = (mode, fn) => new Promise((ok, ko) => { const t = db.transaction(OBJ, mode), r = fn(t.objectStore(OBJ)); t.oncomplete = () => ok(r?.result); t.onerror = () => ko(t.error); t.onabort = () => ko(t.error || new Error('Zápis přerušen')); });

const zaznam = (p) => ({ id: p.id, nazev: p.nazev, typ: p.typ, zmeneno: p.zmeneno, text: serializuj(p) });

export async function init() {
  try {
    db = await otevri();
    for (const r of await tx('readonly', (s) => s.getAll())) cache.set(r.id, r);
    rezim = 'idb';
    // jednorázová migrace ze starého ukládání do localStorage
    let idx = []; try { idx = JSON.parse(lsCti(LS_IDX) || '[]'); } catch { idx = []; }
    for (const m of idx) {
      const text = lsCti(LS_PROJ + m.id);
      if (text && !cache.has(m.id)) { const r = { id: m.id, nazev: m.nazev, typ: m.typ, zmeneno: m.zmeneno, text }; cache.set(r.id, r); await tx('readwrite', (s) => s.put(r)); }
      lsMaz(LS_PROJ + m.id);
    }
    lsMaz(LS_IDX);
  } catch {
    // záloha: localStorage
    rezim = ls() && lsPis('pp.test', '1') ? 'ls' : 'pamet';
    if (rezim === 'ls') { try { for (const m of JSON.parse(lsCti(LS_IDX) || '[]')) { const t = lsCti(LS_PROJ + m.id); if (t) cache.set(m.id, { ...m, text: t }); } } catch { /* nic */ } }
  }
}

export const rezimUloziste = () => rezim;
export const dostupne = () => rezim !== 'pamet';
// Řazení od naposledy změněného; starší záznamy bez data (nebo s jiným typem) nesmí seznam shodit.
const txt = (x) => (typeof x === 'string' ? x : x == null ? '' : String(x));
export const seznam = () => [...cache.values()].map(({ id, nazev, typ, zmeneno }) => ({ id, nazev, typ, zmeneno })).sort((a, b) => txt(b.zmeneno).localeCompare(txt(a.zmeneno)));
export const nacti = (id) => (cache.has(id) ? nactiProjekt(cache.get(id).text) : null);

// Vrací Promise<{ok, chyba?}>. Cache se aktualizuje okamžitě; ok:true znamená, že je zápis opravdu dokončen.
export function uloz(p) {
  if (typeof p?.id !== 'string' || !p.id) return Promise.resolve({ ok: false, chyba: 'Projekt nemá identifikátor' });   // nic nevložit do cache, co nejde uložit
  const r = zaznam(p); cache.set(r.id, r);
  if (rezim === 'idb') {
    fronta = fronta.then(() => tx('readwrite', (s) => s.put(r))).then(() => ({ ok: true }), (e) => ({ ok: false, chyba: e?.message || 'Zápis do úložiště prohlížeče selhal' }));
    return fronta;
  }
  if (rezim === 'ls') {
    const idx = seznam();
    const ok = lsPis(LS_PROJ + r.id, r.text) && lsPis(LS_IDX, JSON.stringify(idx));
    return Promise.resolve(ok ? { ok: true } : { ok: false, chyba: 'Úložiště prohlížeče je plné' });
  }
  return Promise.resolve({ ok: false, chyba: 'Úložiště prohlížeče není dostupné (soukromé okno nebo zablokovaná data)' });
}

export function smaz(id) {
  cache.delete(id);
  if (lsCti(POSL) === id) lsMaz(POSL);
  if (rezim === 'idb') fronta = fronta.then(() => tx('readwrite', (s) => s.delete(id))).then(() => ({ ok: true }), () => ({ ok: false }));
  if (rezim === 'ls') { lsMaz(LS_PROJ + id); lsPis(LS_IDX, JSON.stringify(seznam())); }
  return fronta;
}

export const nastavPosledni = (id) => lsPis(POSL, id);
export const posledni = () => { const id = lsCti(POSL); return id && cache.has(id) ? id : null; };

function stahniText(text, soubor) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = soubor;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function stahni(p) {
  const jmeno = p.nazev.replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'projekt';
  stahniText(serializuj(p), `${jmeno}.pplan.json`);
}

// Záloha VŠECH projektů v prohlížeči (DZP i evakuační plány) do jednoho souboru; obnova přes „Importovat projekt“.
export function zalohaJakoText(kdy = new Date()) {
  const projekty = [...cache.values()].sort((a, b) => txt(a.nazev).localeCompare(txt(b.nazev), 'cs')).map((r) => JSON.parse(r.text));
  return JSON.stringify({ format: FORMAT_ZALOHY, verze: 1, vytvoreno: kdy.toISOString(), pocet: projekty.length, projekty }, null, 1);
}
export function stahniZalohu() {
  const kdy = new Date();
  stahniText(zalohaJakoText(kdy), `Pozarni_planovac_zaloha_${kdy.toISOString().slice(0, 10)}.pplan-zaloha.json`);
  lsPis(ZALOHA, kdy.toISOString());
  return cache.size;
}
export const posledniZaloha = () => lsCti(ZALOHA);
