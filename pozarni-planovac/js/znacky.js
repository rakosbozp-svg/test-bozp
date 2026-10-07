// Katalog značek DZP (znacky/katalog.json) a výběr značky.
let katalog = null;
export async function nactiKatalog() {
  if (katalog) return katalog;
  if (globalThis.__KATALOG__) { katalog = globalThis.__KATALOG__; return katalog; }   // jednosouborová sestava má katalog (i obrázky) vložený
  const r = await fetch('znacky/katalog.json');
  if (!r.ok) throw new Error('Katalog značek se nepodařilo načíst');
  katalog = (await r.json()).znacky;
  return katalog;
}
export const najdiZnacku = (id) => (katalog || []).find((z) => z.id === id) || null;

const odstran = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Modální výběr značky; vrací Promise<id|null>.
export function vyberZnacku() {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'znacky-dlg';
    dlg.innerHTML = `<form method="dialog" class="zd-hlava"><input type="search" placeholder="Hledat značku (např. hydrant, plyn, výbuch)…" aria-label="Hledat značku"><button value="zrusit" class="btn">Zavřít</button></form><div class="zd-mriz" role="list"></div><p class="zd-pata">Zdroj: Značky DZP, ČAHD 11/2011. Použití značky ověřte podle PBŘ a konkrétního projektu.</p>`;
    const mriz = dlg.querySelector('.zd-mriz'), q = dlg.querySelector('input');
    const kresli = () => {
      const f = odstran(q.value);
      mriz.innerHTML = katalog.filter((z) => !f || odstran(z.nazev).includes(f) || z.id.toLowerCase().includes(f))
        .map((z) => `<button type="button" class="zd-bunka" role="listitem" data-id="${z.id}" title="${z.id}"><img loading="lazy" src="${z.png}" alt=""><span>${z.nazev}</span></button>`).join('') || '<p>Nic nenalezeno.</p>';
    };
    q.addEventListener('input', kresli);
    mriz.addEventListener('click', (e) => { const b = e.target.closest('[data-id]'); if (b) { dlg.dataset.vybrano = b.dataset.id; dlg.close(); } });
    dlg.addEventListener('close', () => { const v = dlg.dataset.vybrano || null; dlg.remove(); resolve(v); });
    document.body.appendChild(dlg); kresli(); dlg.showModal(); q.focus();
  });
}
