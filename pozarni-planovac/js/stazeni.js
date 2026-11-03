// Uložení souboru, který aplikace vytvořila (záloha projektů, projekt, PDF, SVG, PNG). V artefaktu na claude.ai stránka sama
// stahovat nesmí: soubor se předá schopnosti artefaktu „downloads“ (claude.use('downloads').save) – platforma se uživatele
// zeptá a soubor uloží (v aplikaci Claude přes nabídku sdílení / Uložit do Souborů). Jinde (soubor z disku, web) obyčejný
// odkaz ke stažení. Schopnost se zjišťuje hned při načtení, aby se odkaz mimo artefakt otevřel ještě v obsluze kliknutí.
// Vrací Promise<{ ok, kod? }>: ok:false jen když uložení nevyšlo (uživatel odmítl, ukládání tu nejde…) – viz zpravaUlozeni.
let schopnost = null, zjisteno = false;
const slib = (async () => {
  const c = globalThis.claude;
  if (!c || typeof c.use !== 'function') return null;
  try { return await c.use('downloads'); } catch { return null; }
})().then((d) => { schopnost = d; zjisteno = true; return d; });

function odkaz(blob, jmeno) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export async function ulozSoubor(data, jmeno, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  const d = zjisteno ? schopnost : await slib;
  if (!d) { odkaz(blob, jmeno); return { ok: true }; }
  try { await d.save({ filename: jmeno, data: blob }); return { ok: true }; } catch (e) { return { ok: false, kod: e?.code || 'unavailable' }; }
}

const ZPRAVY = {
  declined: 'Uložení souboru jste zrušili.',
  rate_limited: 'Dialog pro uložení už je otevřený – dokončete ho, nebo to zkuste za chvíli znovu.',
  too_large: 'Soubor je pro uložení příliš velký.',
  rejected_extension: 'Tento typ souboru tu uložit nejde.',
  extension_not_enabled: 'Tento typ souboru tu uložit nejde.',
};
export const zpravaUlozeni = (r) => (r?.ok ? '' : ZPRAVY[r?.kod] || 'Soubor se v tomto zobrazení nepodařilo uložit. Otevřete plánovač v claude.ai v prohlížeči, nebo jako soubor HTML.');
