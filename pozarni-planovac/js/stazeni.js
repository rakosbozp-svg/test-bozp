// Uložení souboru, který aplikace vytvořila (záloha projektů, projekt, PDF, SVG, PNG). V artefaktu na claude.ai stránka sama
// stahovat nesmí: soubor se předá schopnosti artefaktu „downloads“ (claude.use('downloads').save) – platforma se uživatele
// zeptá a soubor uloží (v aplikaci Claude přes nabídku sdílení / Uložit do Souborů). Jinde (soubor z disku, web) obyčejný
// odkaz ke stažení – hned v obsluze kliknutí, bez čekání.
// Když uložení v artefaktu nevyjde, ukáže se dialog s důvodem a kódem chyby claude.ai a se stavem oprávnění; kde může pomoct
// oprávnění artefaktu, nabídne panel Oprávnění a po jeho zavření soubor uloží znovu. V artefaktu se nikdy nepředstírá úspěch
// obyčejným odkazem: sandbox artefaktu stahování odkazem zakazuje, soubor by se tiše neuložil.
// Vrací Promise<{ ok, kod?, oznameno? }>: ok:false jen když uložení nevyšlo; oznameno = důvod už ukázal dialog (zpravaUlozeni → '').
import { formular, oznam } from './dialogy.js';

const vArtefaktu = () => !!(globalThis.claude && typeof globalThis.claude.use === 'function');
const nacti = async (jmeno) => { if (!vArtefaktu()) return null; try { return await globalThis.claude.use(jmeno); } catch { return null; } };
let schopnost = null, zjisteno = false;
const slib = nacti('downloads').then((d) => { schopnost = d; zjisteno = true; return d; });

function odkaz(blob, jmeno) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

const TEXTY = {
  declined: 'Uložení souboru jste zrušili (nebo dialog claude.ai pro uložení vypršel).',
  rate_limited: 'Dialog claude.ai pro uložení už je otevřený – dokončete ho, nebo to zkuste za chvíli znovu.',
  too_large: 'Soubor je pro uložení příliš velký.',
  rejected_extension: 'Tento typ souboru claude.ai uložit nedovolí.',
  extension_not_enabled: 'Soubory tohoto typu (PDF, SVG) teď claude.ai v tomto zobrazení uložit nedovolí. Záloha projektů (.json) a obrázek PNG by měly jít.',
  not_granted: 'Ukládání souborů není pro tuto stránku povolené – zapněte ho v oprávněních artefaktu.',
  capability_disabled: 'Ukládání souborů je v tomto zobrazení vypnuté (nastavení claude.ai, účtu nebo organizace).',
  unavailable: 'Ukládání souborů teď claude.ai v tomto zobrazení nedovolil. Zkontrolujte oprávnění artefaktu, případně stránku obnovte (F5).',
  bad_request: 'Soubor se nepodařilo předat k uložení (chyba aplikace).',
};
TEXTY.capability_removed = TEXTY.unavailable; TEXTY.transform_error = TEXTY.bad_request;
const text = (kod) => TEXTY[kod] || TEXTY.unavailable;
const KRATCE = new Set(['declined', 'rate_limited']);   // stačí krátká hláška, bez dialogu
const OPRAVNENI = new Set(['not_granted', 'unavailable', 'capability_disabled', 'capability_removed']);   // může pomoct panel Oprávnění

async function uloz(d, blob, jmeno) {
  try { await d.save({ filename: jmeno, data: blob }); return { ok: true }; } catch (e) {
    const kod = typeof e?.code === 'string' && e.code ? e.code : 'unavailable';
    console.warn(`[stazeni] ${jmeno}: ${kod}${e?.message ? ` – ${e.message}` : ''}`);
    return { ok: false, kod };
  }
}

// Dialog s důvodem, kódem a stavem oprávnění. Vrací true, když uživatel otevřel panel Oprávnění (pak se uloží znovu).
async function vysvetli(r) {
  const p = await nacti('permissions');
  let stav = 'nezjištěno';
  try { if (p) stav = await p.state('downloads'); } catch { /* nezjištěno */ }
  const popis = `${text(r.kod)} (kód: ${r.kod}, oprávnění: ${stav})`;
  if (!p || !(OPRAVNENI.has(r.kod) || stav === 'denied')) { await oznam(popis, { titul: 'Soubor se neuložil' }); return false; }
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const volba = await formular({ titul: 'Soubor se neuložil', html: `<p class="dlg__text">${esc(popis)}</p><p class="dlg__text">V panelu Oprávnění zapněte ukládání souborů; po jeho zavření se soubor uloží znovu.</p>`, ano: 'Otevřít oprávnění', zrusit: 'Zavřít' });
  if (!volba?.ok) return false;
  try { await p.manage(); return true; } catch {
    await oznam('Panel Oprávnění se nepodařilo otevřít. Otevřete ho v nabídce artefaktu na claude.ai (Oprávnění) a soubor uložte znovu.', { titul: 'Oprávnění' });
    return false;
  }
}

export async function ulozSoubor(data, jmeno, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  if (!vArtefaktu()) { odkaz(blob, jmeno); return { ok: true }; }
  for (let pokus = 0; ; pokus++) {
    let d = zjisteno ? schopnost : await slib;
    if (!d) { d = await nacti('downloads'); if (d) schopnost = d; }   // další šance, kdyby se schopnost napoprvé nenačetla
    const r = d ? await uloz(d, blob, jmeno) : { ok: false, kod: 'unavailable' };
    if (r.ok || KRATCE.has(r.kod)) return r;
    if (!(pokus === 0 && (await vysvetli(r)))) return { ...r, oznameno: true };
  }
}

// Krátká hláška pro volajícího (prázdná, když uložení vyšlo nebo důvod už ukázal dialog).
export const zpravaUlozeni = (r) => (r?.ok || r?.oznameno ? '' : `${text(r?.kod)}${r?.kod && !KRATCE.has(r.kod) ? ` (kód: ${r.kod})` : ''}`);
