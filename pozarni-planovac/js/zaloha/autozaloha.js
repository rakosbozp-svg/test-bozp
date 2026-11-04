// Automatická záloha projektů do soukromého úložiště artefaktu: fronta změněných projektů, prodleva po poslední změně,
// dohánění po startu, bezpečný přepis verzí (nejdřív části, pak hlavička), stav pro úvodní stránku a obnova.
// Ukládání do prohlížeče na záloze nezávisí – chyba zálohy se jen ukáže ve stavu.
import { otisk, zabal, rozbal, rozdel, novaVerze } from './kodovani.js';
import { kodChyby } from './uloziste.js';
import { nactiProjekt } from '../model.js';

export const TEXTY_CHYB = {
  quota_exceeded: 'Úložiště artefaktu je plné. Odstraňte ze zálohy smazané projekty, nebo zálohujte ručně.',
  resource_exhausted: 'Příliš mnoho požadavků, záloha pokračuje za minutu.',
  unavailable: 'Úložiště je dočasně nedostupné.',
};
const PAUZA_PRETIZENI_MS = 60000, MAX_PAUZ = 10;

export function vytvorAutozalohu({ ulozeni, uloziste, prodlevaMs = 30000, ted = () => new Date(), cekej = (ms) => new Promise((r) => setTimeout(r, ms)), nahoda = Math.random }) {
  const hlav = new Map();        // pid → hlavička (i s pid), jak je v úložišti
  const fronta = new Set();      // pid čekající na zálohu
  const posluchaci = new Set();
  let faze = 'pripojuje', chyba = null, hotovo = 0, celkem = 0, nacteno = false, casovac = null, bezi = null, odhlasit = null;

  function stav() {
    const vse = [...hlav.values()];
    const posledni = vse.reduce((m, h) => (typeof h.zalohovano === 'string' && (!m || h.zalohovano > m) ? h.zalohovano : m), null);
    return { faze, pocet: vse.filter((h) => !h.smazano).length, smazanych: vse.filter((h) => h.smazano).length, posledni, hotovo, celkem, ceka: fronta.size, chyba };
  }
  const zmena = () => { const s = stav(); for (const fn of posluchaci) { try { fn(s); } catch { /* posluchač nesmí rozbít zálohu */ } } };
  const iso = () => ted().toISOString();
  const nazevProjektu = (pid) => ulozeni.zaznam(pid)?.nazev ?? hlav.get(pid)?.nazev ?? pid;

  function vypni() { faze = 'nedostupna'; clearTimeout(casovac); casovac = null; odhlasit?.(); zmena(); }
  function chybaUloziste(e) {
    const kod = kodChyby(e);
    if (kod === 'revoked') { vypni(); return; }
    chyba = { kod, text: TEXTY_CHYB[kod] ?? `Záloha selhala (kód ${kod}).` }; faze = 'chyba'; zmena();
  }
  async function nactiHlavicky() {
    try { const h = await uloziste.hlavicky(); hlav.clear(); for (const x of h) hlav.set(x.pid, x); nacteno = true; return true; } catch (e) { chybaUloziste(e); return false; }
  }

  // Záloha jednoho projektu; pořadí kroků je závazné (bezpečný přepis, viz specifikace).
  async function zalohujProjekt(pid) {
    const r = ulozeni.zaznam(pid), h = hlav.get(pid);
    if (!r) {
      if (h && !h.smazano) { const kdy = iso(); if (await uloziste.oznacSmazany(pid, kdy)) hlav.set(pid, { ...h, smazano: kdy }); else hlav.delete(pid); }
      return;
    }
    const sha = await otisk(r.text);
    if (h?.sha256 === sha) {
      if (h.smazano) { await uloziste.zrusSmazani(pid); hlav.set(pid, { ...h, smazano: null }); }
      return;
    }
    const { data, komprese, velikost } = await zabal(r.text);
    const casti = rozdel(data), verze = novaVerze();
    await uloziste.zapisCasti(pid, verze, casti, iso());
    const nova = { format: 1, nazev: r.nazev, typ: r.typ, zmeneno: r.zmeneno, velikost, sha256: sha, verze, casti: casti.length, komprese, zalohovano: iso(), smazano: ulozeni.zaznam(pid) ? null : iso() };
    await uloziste.zapisHlavicku(pid, nova);
    hlav.set(pid, { ...nova, pid });
    await uloziste.uklid(pid, verze, h?.verze ?? null, ted().getTime());
  }

  // 'ok' | 'preskoc' (chyba jen tohoto projektu) | 'stop' (fronta počká na další změnu nebo start)
  async function zalohujSPokusy(pid) {
    let pauzy = 0, pokusy = 0;
    for (;;) {
      try { await zalohujProjekt(pid); return 'ok'; } catch (e) {
        const kod = kodChyby(e);
        if (kod === 'revoked') { vypni(); return 'stop'; }
        if (kod === 'quota_exceeded') { chyba = { kod, text: TEXTY_CHYB.quota_exceeded }; return 'stop'; }
        if (kod === 'resource_exhausted' && pauzy++ < MAX_PAUZ) { chyba = { kod, text: TEXTY_CHYB.resource_exhausted }; zmena(); await cekej(PAUZA_PRETIZENI_MS); chyba = null; continue; }
        if (kod === 'unavailable' && pokusy++ < 1) { await cekej(2000 + Math.floor(nahoda() * 3001)); continue; }
        if (kod === 'unavailable' || kod === 'resource_exhausted') { chyba = { kod, text: TEXTY_CHYB[kod] }; return 'stop'; }
        chyba = { kod, text: `Záloha projektu „${nazevProjektu(pid)}“ selhala (kód ${kod}).` };
        return 'preskoc';
      }
    }
  }

  async function beh() {
    if (faze === 'nedostupna') return 'hotovo';
    if (!nacteno && !(await nactiHlavicky())) return 'stop';
    if (!fronta.size) return 'hotovo';
    chyba = null; faze = 'probiha'; hotovo = 0; celkem = fronta.size; zmena();
    let vysledek = 'hotovo';
    while (fronta.size && faze !== 'nedostupna') {
      const pid = fronta.values().next().value;
      if ((await zalohujSPokusy(pid)) === 'stop') { vysledek = 'stop'; break; }
      fronta.delete(pid); hotovo++; celkem = Math.max(celkem, hotovo + fronta.size); zmena();
    }
    if (faze !== 'nedostupna') faze = chyba ? 'chyba' : 'ok';
    zmena();
    return vysledek;
  }
  function zpracuj() {
    if (!bezi) bezi = beh().finally(() => { bezi = null; });
    return bezi;
  }
  function zarad(pid) {
    fronta.add(pid); zmena();
    clearTimeout(casovac);
    casovac = setTimeout(() => { casovac = null; zpracuj().catch(() => { /* stav nese chybu */ }); }, prodlevaMs);
  }

  return {
    stav,
    naZmenu(fn) { posluchaci.add(fn); return () => posluchaci.delete(fn); },
    async start() {
      if (odhlasit) return;
      odhlasit = ulozeni.sleduj(({ id }) => { if (faze !== 'nedostupna' && id) zarad(id); });
      if (!(await nactiHlavicky())) return;
      for (const r of ulozeni.seznam()) { const h = hlav.get(r.id); if (!h || String(r.zmeneno ?? '') > String(h.zmeneno ?? '')) fronta.add(r.id); }
      faze = 'ok'; zmena();
      if (fronta.size) await zpracuj();
    },
    // Zpracuje frontu hned (bez prodlevy) – pro testy a pro „zálohovat teď“.
    async dokonci() {
      clearTimeout(casovac); casovac = null;
      for (let i = 0; i < 3 && fronta.size && faze !== 'nedostupna'; i++) if ((await zpracuj()) === 'stop') break;
      if (bezi) await bezi;
    },
    projekty: () => [...hlav.values()].sort((a, b) => String(a.nazev).localeCompare(String(b.nazev), 'cs')),
    // Pro dialog obnovy (js/app.js → obnovZalohu): poškozený nebo neúplný projekt jde do chyb, ostatní se obnoví.
    async nactiProObnovu(pids) {
      const projekty = [], chyby = [];
      let vytvoreno = null;
      for (const pid of pids) {
        const h = hlav.get(pid);
        if (!h) { chyby.push(`${pid}: v záloze není`); continue; }
        try {
          const text = await rozbal({ data: await uloziste.ctiData(pid, h), komprese: h.komprese });
          if ((await otisk(text)) !== h.sha256) throw new Error('záloha je poškozená (nesouhlasí otisk)');
          projekty.push(nactiProjekt(text));
          if (!vytvoreno || h.zalohovano > vytvoreno) vytvoreno = h.zalohovano;
        } catch (e) { chyby.push(`${h.nazev}: ${e?.code === 'chybi_cast' ? 'v záloze chybí část dat' : e?.message || `kód ${kodChyby(e)}`}`); }
      }
      return { projekty, chyby, vytvoreno };
    },
    async odstranZeZalohy(pid) { await uloziste.odstran(pid); hlav.delete(pid); zmena(); },
  };
}
