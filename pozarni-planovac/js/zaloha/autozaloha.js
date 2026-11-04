// Automatická záloha projektů do soukromého úložiště artefaktu: fronta změněných projektů, prodleva po poslední změně,
// dohánění po prvním načtení hlaviček, bezpečný přepis verzí (nejdřív části, pak hlavička), stav pro úvodní stránku a obnova.
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
// Po těchto kódech záloha pro toto otevření nemá smysl (přístup odebraný, schopnost vypnutá nebo nepovolená): karta zmizí.
const VYPINACI = new Set(['revoked', 'not_granted', 'capability_disabled', 'capability_removed']);

export function vytvorAutozalohu({ ulozeni, uloziste, prodlevaMs = 30000, ted = () => new Date(), cekej = (ms) => new Promise((r) => setTimeout(r, ms)), nahoda = Math.random }) {
  const hlav = new Map();          // pid → hlavička (i s pid) z posledního čtení úložiště nebo vlastního zápisu
  const cekaSmazani = new Map();   // pid → čas smazání v prohlížeči, dokud se nezapíše do úložiště (přehled ho hned nenabízí k obnově)
  const fronta = new Set();        // pid čekající na zálohu (změny během běžící zálohy sem přibudou a počkají na novou prodlevu)
  const posluchaci = new Set();
  let faze = 'pripojuje', chyba = null, hotovo = 0, celkem = 0, nacteno = false, zapsano = false, casovac = null, bezi = null, odhlasit = null;

  const prodlevaPokusu = () => 2000 + Math.floor(nahoda() * 3001);
  const sPrekryvem = () => [...hlav.values()].map((h) => (cekaSmazani.has(h.pid) && !h.smazano ? { ...h, smazano: cekaSmazani.get(h.pid) } : h));
  function stav() {
    const vse = sPrekryvem();
    const posledni = vse.reduce((m, h) => (typeof h.zalohovano === 'string' && (!m || h.zalohovano > m) ? h.zalohovano : m), null);
    return { faze, nacteno, pocet: vse.filter((h) => !h.smazano).length, smazanych: vse.filter((h) => h.smazano).length, posledni, hotovo, celkem, ceka: fronta.size, chyba };
  }
  const zmena = () => { const s = stav(); for (const fn of posluchaci) { try { fn(s); } catch { /* posluchač nesmí rozbít zálohu */ } } };
  const iso = () => ted().toISOString();
  const nazevProjektu = (pid) => ulozeni.zaznam(pid)?.nazev ?? hlav.get(pid)?.nazev ?? pid;

  function vypni() { faze = 'nedostupna'; clearTimeout(casovac); casovac = null; fronta.clear(); odhlasit?.(); zmena(); }
  function chybaUloziste(e) {
    const kod = kodChyby(e);
    if (VYPINACI.has(kod)) { vypni(); return; }
    chyba = { kod, text: TEXTY_CHYB[kod] ?? `Záloha selhala (kód ${kod}).` }; faze = 'chyba'; zmena();
  }
  // Do fronty projekty, které v záloze chybí nebo jsou v prohlížeči novější.
  function dohnat() { for (const r of ulozeni.seznam()) { const h = hlav.get(r.id); if (!h || String(r.zmeneno ?? '') > String(h.zmeneno ?? '')) fronta.add(r.id); } }
  // Načte hlavičky z úložiště (jeden nový pokus po přechodné chybě). Při prvním úspěchu zařadí dohánění.
  async function nactiHlavicky() {
    for (let pokus = 0; ; pokus++) {
      try {
        const h = await uloziste.hlavicky();
        hlav.clear(); for (const x of h) hlav.set(x.pid, x);
        if (!nacteno) { nacteno = true; dohnat(); }
        return true;
      } catch (e) {
        const kod = kodChyby(e);
        if (pokus === 0 && (kod === 'unavailable' || kod === 'resource_exhausted')) { await cekej(prodlevaPokusu()); continue; }
        chybaUloziste(e); return false;
      }
    }
  }

  // Záloha jednoho projektu; pořadí kroků je závazné (bezpečný přepis, viz specifikace).
  async function zalohujProjekt(pid) {
    const r = ulozeni.zaznam(pid), h = hlav.get(pid);
    if (!r) {
      if (h && !h.smazano) {
        const kdy = cekaSmazani.get(pid) ?? iso();
        if (await uloziste.oznacSmazany(pid, kdy)) { zapsano = true; hlav.set(pid, { ...h, smazano: kdy }); } else hlav.delete(pid);
      }
      cekaSmazani.delete(pid);
      return;
    }
    cekaSmazani.delete(pid);
    const sha = await otisk(r.text);
    if (h?.sha256 === sha) {
      if (h.smazano) { await uloziste.zrusSmazani(pid); zapsano = true; hlav.set(pid, { ...h, smazano: null }); }
      return;
    }
    const { data, komprese, velikost } = await zabal(r.text);
    const casti = rozdel(data), verze = novaVerze();
    await uloziste.zapisCasti(pid, verze, casti, iso(), () => { zapsano = true; });
    const nova = { format: 1, nazev: r.nazev, typ: r.typ, zmeneno: r.zmeneno, velikost, sha256: sha, verze, casti: casti.length, komprese, zalohovano: iso(), smazano: ulozeni.zaznam(pid) ? null : iso() };
    await uloziste.zapisHlavicku(pid, nova);
    hlav.set(pid, { ...nova, pid });
    await uloziste.uklid(pid, verze, h ? { verze: h.verze, casti: h.casti } : null, ted().getTime());
  }

  // 'ok' | 'preskoc' (chyba jen tohoto projektu) | 'stop' (fronta počká na další změnu nebo start)
  async function zalohujSPokusy(pid) {
    let pauzy = 0, pokusy = 0;
    for (;;) {
      try { await zalohujProjekt(pid); return 'ok'; } catch (e) {
        const kod = kodChyby(e);
        // odebraná schopnost, nebo úložiště jen ke čtení (prohlížeč, sdílení jen ke čtení): odmítnutý první zápis = vypnout
        if (VYPINACI.has(kod) || (kod === 'invalid_argument' && !zapsano)) { vypni(); return 'stop'; }
        if (kod === 'quota_exceeded') { chyba = { kod, text: TEXTY_CHYB.quota_exceeded }; return 'stop'; }
        if (kod === 'resource_exhausted' && pauzy++ < MAX_PAUZ) { chyba = { kod, text: TEXTY_CHYB.resource_exhausted }; zmena(); await cekej(PAUZA_PRETIZENI_MS); chyba = null; continue; }
        if (kod === 'unavailable' && pokusy++ < 1) { await cekej(prodlevaPokusu()); continue; }
        if (kod === 'unavailable' || kod === 'resource_exhausted') { chyba = { kod, text: TEXTY_CHYB[kod] }; return 'stop'; }
        chyba = { kod, text: `Záloha projektu „${nazevProjektu(pid)}“ selhala (kód ${kod}).` };
        return 'preskoc';
      }
    }
  }

  async function beh() {
    if (faze === 'nedostupna') return 'hotovo';
    if (!nacteno) {
      if (!(await nactiHlavicky())) return 'stop';
      if (!fronta.size) { chyba = null; faze = 'ok'; zmena(); return 'hotovo'; }
    }
    if (!fronta.size) return 'hotovo';
    // Dávka = co čeká teď. Změny během zálohy (i téhož projektu) přibudou do fronty a zpracují se po nové prodlevě.
    const davka = [...fronta]; fronta.clear();
    chyba = null; faze = 'probiha'; hotovo = 0; celkem = davka.length; zmena();
    let vysledek = 'hotovo';
    for (let i = 0; i < davka.length && faze !== 'nedostupna'; i++) {
      if ((await zalohujSPokusy(davka[i])) === 'stop') { vysledek = 'stop'; if (faze !== 'nedostupna') for (const pid of davka.slice(i)) fronta.add(pid); break; }
      hotovo++; zmena();
    }
    if (faze !== 'nedostupna') faze = chyba ? 'chyba' : 'ok';
    zmena();
    if (fronta.size && vysledek !== 'stop' && faze !== 'nedostupna') naplanuj();
    return vysledek;
  }
  function zpracuj() {
    if (!bezi) bezi = beh().finally(() => { bezi = null; });
    return bezi;
  }
  function naplanuj() {
    clearTimeout(casovac);
    casovac = setTimeout(() => { casovac = null; zpracuj().catch(() => { /* stav nese chybu */ }); }, prodlevaMs);
  }
  function zarad(pid) { fronta.add(pid); zmena(); naplanuj(); }

  return {
    stav,
    naZmenu(fn) { posluchaci.add(fn); return () => posluchaci.delete(fn); },
    async start() {
      if (odhlasit) return;
      odhlasit = ulozeni.sleduj(({ typ, id }) => {
        if (faze === 'nedostupna' || !id) return;
        if (typ === 'smazano') cekaSmazani.set(id, iso()); else cekaSmazani.delete(id);
        zarad(id);
      });
      if (!(await nactiHlavicky())) return;   // dohánění proběhne při prvním úspěšném načtení (i později, při další změně)
      faze = 'ok'; zmena();
      if (fronta.size) await zpracuj();
    },
    // Zpracuje frontu hned (bez prodlevy) – pro testy a pro „zálohovat teď“.
    async dokonci() {
      for (let i = 0; i < 5; i++) {
        if (bezi) await bezi;
        if (!fronta.size || faze === 'nedostupna') break;
        clearTimeout(casovac); casovac = null;
        if ((await zpracuj()) === 'stop') break;
      }
    },
    // Znovu načte hlavičky z úložiště (dialog zálohy, obnova): jiná karta nebo počítač mezitím mohl zálohovat.
    obnov: () => nactiHlavicky(),
    projekty: () => sPrekryvem().sort((a, b) => String(a.nazev).localeCompare(String(b.nazev), 'cs')),
    // Pro dialog obnovy (js/app.js → obnovZalohu): poškozený nebo neúplný projekt jde do chyb, ostatní se obnoví.
    async nactiProObnovu(pids) {
      await nactiHlavicky();   // čerstvé hlavičky; při chybě zůstanou poslední známé
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
    async odstranZeZalohy(pid) { await uloziste.odstran(pid); hlav.delete(pid); cekaSmazani.delete(pid); zmena(); },
  };
}
