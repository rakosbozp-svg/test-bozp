// Panel „Claude“ v editoru výkresu. Uživatel popíše, co nakreslit (a může přiložit fotku, skicu nebo plánek); Claude kreslí
// skutečné prvky výkresu nástroji z js/ai/nastroje.js a v kontrolním kole se podívá na obrázek listu a opraví, co nesedí.
// Volá se schopnost artefaktu claude.ai „sample“ (window.claude.use('sample')) na účtu toho, kdo stránku prohlíží.
// Mimo claude.ai (soubor z disku, web) Claude k dispozici není – panel to vysvětlí, zbytek aplikace běží beze změny.
// Celý zásah Claude je v historii JEDEN krok: nástroje mění model a překreslují, commit (uložení + krok Zpět) je až na konci.
import * as P from '../kresleni/prvky.js';
import { esc } from '../kresleni/render.js';
import * as A from './nastroje.js';

// ---------- přístup k Claude ----------
let slibSample = null;
export function claudeSample() {
  if (!slibSample) {
    slibSample = (async () => {
      const c = globalThis.claude;
      if (!c || typeof c.use !== 'function') return null;
      try { return await c.use('sample'); } catch { return null; }
    })();
  }
  return slibSample;
}
async function limity(sample) { try { return await sample.limits(); } catch { return null; } }

const CHYBY = {
  not_granted: 'Použití Claude v této stránce nebylo povoleno. Povolení změníte v nabídce artefaktu (Oprávnění).',
  sampling_disabled: 'Claude není pro tento účet nebo organizaci dostupný.',
  not_declared: 'Tato verze stránky nemá povolené volání Claude.',
  capability_disabled: 'Claude je v tomto zobrazení vypnutý.',
  capability_removed: 'Tato aplikace Claude volání ze stránky nepodporuje – zkuste claude.ai v prohlížeči.',
  tools_unavailable: 'V tomto zobrazení Claude nemůže ovládat nástroje stránky, kreslení nejde spustit. Zkuste claude.ai v prohlížeči nebo aktualizujte aplikaci Claude.',
  images_unavailable: 'Obrázky tu Claude poslat nejde – zkuste to bez přílohy a bez obrázku listu.',
  image_rejected: 'Obrázek se nepodařilo použít (typ, velikost nebo počet). Zkuste jiný soubor – JPG nebo PNG.',
  rate_limited: 'Příliš mnoho dotazů nebo vyčerpaný limit vašeho účtu Claude. Zkuste to později.',
  session_expired: 'Přihlášení ke Claude vypršelo – přihlaste se znovu a zkuste to.',
  refused: 'Claude tento požadavek odmítl. Zkuste zadání přeformulovat.',
  empty_completion: 'Claude nevrátil žádnou odpověď. Zkuste zadání zjednodušit nebo rozdělit.',
  prompt_too_large: 'Výkres nebo zadání je pro jeden dotaz příliš velké. Zkuste menší část výkresu nebo méně příloh.',
  invalid_request: 'Dotaz na Claude byl neplatný (chyba aplikace).',
  transform_error: 'Přílohy se nepodařilo připravit k odeslání.',
  queue_overflow: 'Příliš mnoho dotazů najednou.',
  upstream_error: 'Spojení s Claude selhalo. Zkuste to znovu.',
};
const zpravaChyby = (e) => CHYBY[e?.code] || (e?.code ? CHYBY.upstream_error : `Chyba: ${e?.message || e}`);
const TRVALE = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'tools_unavailable'];

// ---------- stav panelu (po listech; přežije přepnutí záložky panelu) ----------
const STAV = new Map();
function stavListu(id) {
  if (!STAV.has(id)) STAV.set(id, { zpravy: [], historie: [], prilohy: [], bezi: null, start: 0, predAi: null, poAi: null, kontrola: true, prilozitVykres: true, model: 'default', host: null, ed: null, nedostupne: '' });
  return STAV.get(id);
}
// Zastaví běžící zásah Claude (při zavření editoru – přepnutí listu, projektu). Rozkreslené zůstane a uloží se.
export function zastavClaude() { for (const st of STAV.values()) st.bezi?.abort(); }

const NAZVY_DRUHU = { stena: 'stěny', dvere: 'dveře', trasa: 'únikové cesty', cara: 'čáry', plocha: 'plochy', obdelnik: 'obdélníky', elipsa: 'elipsy', text: 'popisky', znacka: 'značky' };
const PRIKLADY = {
  evak: 'Např.: Nakresli půdorys 1. NP podle přiložené skici: chodba uprostřed, kanceláře po stranách, dva východy. Vyznač únikové cesty k východům a bod „Jste zde“ u recepce.',
  situace: 'Např.: Nakresli situaci podle fotky: hala 40 × 20 m, příjezd od silnice ze západu, nástupní plocha u severní stěny.',
  pudorys: 'Např.: Nakresli půdorys podle přiložené fotky domu, strany, které nejsou vidět, odhadni. Popiš místnosti a vyznač únikovou cestu k hlavnímu vchodu.',
};

// ---------- obrázek listu pro Claude ----------
// List vykreslený stejně jako export (včetně podkladu) + pomocná mřížka souřadnic; PNG o delší straně maxPx.
export async function obrazekListu(ed, { mrizka = true, maxPx = 1600 } = {}) {
  let svg = await ed.exportSvg();
  if (mrizka) svg = svg.replace(/<\/svg>\s*$/, `${A.mrizkaSvg(ed.v)}</svg>`);
  const L = P.rozlozeniListu(ed.v), k = maxPx / Math.max(L.W, L.H), w = Math.round(L.W * k), h = Math.round(L.H * k);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error('Obrázek listu se nepodařilo vytvořit')); img.src = url; });
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
    return await new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('Obrázek listu se nepodařilo vytvořit'))), 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

const kontext = (ed) => ({
  v: ed.v, katalog: ed.katalog, evak: ed.projekt.typ === 'evakuacni_plan', nazevListu: ed.list.nazev, typListu: ed.list.typ,
  velikostZnacky: ed.projekt.nastaveni?.velikostZnacky ?? 8, velikostTextu: ed.projekt.nastaveni?.velikostTextu ?? 3,
});

function souhrnAkce(nazev, r, k) {
  const v = r.vysledek;
  if (nazev === 'kresli') {
    const pocty = {};
    for (const id of r.nove || []) { const p = P.najdi(k.v.prvky, id); if (p) pocty[p.druh] = (pocty[p.druh] || 0) + 1; }
    const casti = Object.entries(pocty).map(([d, n]) => `${NAZVY_DRUHU[d] || d} ${n}`);
    if (v.id?.includes('jstezde')) casti.push('bod „Jste zde“');
    return `Nakresleno: ${casti.join(', ') || 'nic'}${v.chyby ? ` · odmítnuto ${v.chyby.length} (Claude dostal důvod)` : ''}`;
  }
  if (nazev === 'uprav') return `Upraveno prvků: ${v.upraveno}${v.chyby ? ` · nepovedlo se ${v.chyby.length}` : ''}`;
  if (nazev === 'smaz') return `Smazáno prvků: ${v.smazano}${v.chyby ? ` · nepovedlo se ${v.chyby.length}` : ''}`;
  if (nazev === 'nastav_list') return `List: ${v.hotovo.join(', ')}`;
  return 'Čtení výkresu';
}

// ---------- běh zásahu ----------
async function spust(st, zadani) {
  // Stav „běží“ hned při odeslání (synchronně): žádné dvojí odeslání, Zastavit je vidět od začátku.
  const ed = st.ed, ctl = new AbortController(), zprava = (typ, text) => { const z = { typ, text }; st.zpravy.push(z); obnovUI(st); return z; };
  st.bezi = ctl; st.start = Date.now();
  zprava('ty', zadani + (st.prilohy.length ? `\n(přílohy: ${st.prilohy.map((f) => f.name || 'obrázek').join(', ')})` : ''));
  const sample = await claudeSample(), lim = sample && (await limity(sample));
  if (!sample || !lim?.tools || ctl.signal.aborted) {
    st.bezi = null;
    zprava(ctl.signal.aborted ? 'info' : 'chyba', ctl.signal.aborted ? 'Zastaveno.' : !sample ? st.nedostupne || 'Claude není k dispozici.' : CHYBY.tools_unavailable);
    return;
  }
  const k = kontext(ed), byloPrazdne = !ed.v.prvky.length, pridane = new Set(), maxObr = lim.images?.maxCount ?? 0, bubliny = [];
  let zmeneno = false, odpoved = '', kolo = null;
  st.predAi = ed.H.s[ed.H.i]; st.poAi = null;
  const nastroje = A.definiceNastroju(k).map((d) => ({
    ...d,
    execute: (vstup, kx) => {
      if (ctl.signal.aborted || kx?.signal?.aborted) throw new Error('Zastaveno uživatelem');
      kolo?.rez();   // text dalšího kola Claude půjde do nové bubliny pod touto akcí
      try {
        const r = A.provedNastroj(d.name, vstup, k);
        if (r.zmena) { zmeneno = true; ed.vykresli(); }
        for (const id of r.nove || []) pridane.add(id);
        for (const id of r.smazane || []) pridane.delete(id);
        zprava('akce', souhrnAkce(d.name, r, k));
        return r.vysledek;
      } catch (e) { zprava('akce', `Nástroj ${d.name}: ${e.message}`); throw e; }
    },
  }));
  // Jedno volání Claude (může mít několik kol s nástroji). onText dává CELÝ dosavadní text všech kol; text po akci nástroje
  // se ukazuje v nové bublině (od místa řezu), aby pořadí text → akce → text odpovídalo průběhu.
  const zavolej = async (vstup, obrazky) => {
    let rez = 0, posledni = '', bub = null;
    kolo = { rez: () => { rez = posledni.length; bub = null; } };
    const ukaz = (text) => {
      posledni = text;
      const cast = text.slice(rez).trim();
      if (!cast) return;
      if (!bub) { bub = zprava('claude', ''); bubliny.push(bub); }
      bub.text = cast; obnovUI(st);
    };
    const opt = { tools: nastroje, signal: ctl.signal, modelTier: st.model, onText: ({ text }) => ukaz(text) };
    if (obrazky.length) opt.images = obrazky;
    const r = await sample(vstup, opt);
    ukaz(r.text); kolo = null;
    if (r.truncated) zprava('info', 'Odpověď byla zkrácena – příště zadejte menší část výkresu.');
    return r;
  };
  try {
    const obrazky = [...st.prilohy], popisObr = [];
    st.prilohy.forEach((f, i) => popisObr.push(`${i + 1}) příloha od uživatele „${f.name || 'obrázek'}“ (bez souřadnic – rozměry odhadni, pokud nejsou kótované)`));
    if (st.prilozitVykres && (ed.v.prvky.length || ed.v.pozadi) && obrazky.length < maxObr) { obrazky.push(await obrazekListu(ed)); popisObr.push(`${obrazky.length}) aktuální list s purpurovou souřadnicovou mřížkou v metrech`); }
    if (obrazky.length && !lim.images) throw { code: 'images_unavailable' };
    if (obrazky.length > maxObr) throw { code: 'image_rejected', message: `nejvýš ${maxObr} obrázků` };
    const vstup = [{ role: 'user', content: A.pokyny(k) }, ...st.historie.slice(-6),
      { role: 'user', content: `${popisObr.length ? `PŘILOŽENÉ OBRÁZKY:\n${popisObr.join('\n')}\n\n` : ''}STAV LISTU:\n${A.popisStavu(k)}\n\nZADÁNÍ UŽIVATELE:\n${zadani}` }];
    const r1 = await zavolej(vstup, obrazky);
    odpoved = r1.text;
    // Kontrolní kolo: Claude se podívá na výsledek (obrázek listu s mřížkou) a opraví, co nesedí.
    if (st.kontrola && zmeneno && lim.images && maxObr > 0 && !ctl.signal.aborted) {
      const obr = [await obrazekListu(ed), ...st.prilohy].slice(0, maxObr);
      const vstup2 = [{ role: 'user', content: A.pokyny(k) },
        { role: 'user', content: `KONTROLNÍ KOLO. Zadání uživatele bylo:\n${zadani}\n\nPrávě jsi list nakreslil/upravil. Obrázek 1 je výsledek s purpurovou souřadnicovou mřížkou v metrech${obr.length > 1 ? ', další obrázky jsou přílohy uživatele' : ''}.\n\nSTAV LISTU:\n${A.popisStavu(k)}\n\nZkontroluj výkres proti zadání: navazující stěny, dveře na stěnách, únikové cesty vedoucí k východům, překrývající se popisky a značky, prvky mimo rám, chybějící části zadání. Chyby oprav nástroji uprav/kresli/smaz (vše v co nejméně voláních). Je-li vše v pořádku, nic neměň. Na konci napiš 1–3 řádky „• “ co jsi opravil (nebo že je výkres v pořádku).` }];
      zprava('info', 'Kontrola: Claude se dívá na obrázek výsledku a opraví, co nesedí…');
      const r2 = await zavolej(vstup2, obr);
      odpoved += `\n${r2.text}`;
    }
    st.historie.push({ role: 'user', content: `ZADÁNÍ UŽIVATELE:\n${zadani}` }, { role: 'assistant', content: odpoved.slice(0, 4000) });
  } catch (e) {
    if (e?.code === 'cancelled' || ctl.signal.aborted) zprava('info', 'Zastaveno. Co Claude stihl nakreslit, zůstává ve výkresu (vrátíte to tlačítkem níže nebo Zpět).');
    else {
      // Bez e.text (např. „refused“) je rozepsaný text stažený – bubliny tohoto běhu zmizí; s e.text zůstane, co už je vidět.
      if (e?.text === undefined && bubliny.length) st.zpravy = st.zpravy.filter((z) => !bubliny.includes(z));
      zprava('chyba', zpravaChyby(e));
      if (TRVALE.includes(e?.code)) st.nedostupne = zpravaChyby(e);
    }
  } finally {
    st.bezi = null;
    if (zmeneno) {
      if (pridane.size && A.mimoRam(ed.v, [...pridane])) { const n = A.prizpusobRam(ed.v); if (n) zprava('info', `Výkres přesahoval rám listu – měřítko listu je teď 1 : ${n} a obsah je vycentrovaný.`); }
      if (st.prilohy.length && byloPrazdne && !ed.v.pozadi && !ed.v.meritkoZdroj && ed.v.prvky.length) {
        ed.v.meritkoZdroj = { zdroj: 'claude', popis: 'rozměry odhadl Claude z obrázku', overeno: false };
        zprava('info', 'Rozměry jsou odhad z obrázku – list je označen „měřítko neověřeno“. Až budete znát skutečný rozměr, použijte nástroj Kalibrace (dva body a známá délka).');
      }
      ed.commit();
      st.poAi = ed.H.s[ed.H.i];
      if (pridane.size && st.host?.isConnected) ed.naObsah();
    }
    obnovUI(st);
  }
}

// ---------- vykreslení panelu ----------
const muzeVratit = (st) => !!st.poAi && !st.bezi && st.ed && st.ed.H.i > 0 && st.ed.H.s[st.ed.H.i] === st.poAi && st.ed.H.s[st.ed.H.i - 1] === st.predAi;

// Log se aktualizuje po zprávách (ne celý najednou) – streamovaný text nepřekresluje celou konverzaci.
function vykresliLog(log, st) {
  if (!st.zpravy.length) { if (!log.querySelector('.napoveda')) log.innerHTML = '<p class="napoveda">Zatím žádná konverzace.</p>'; return; }
  log.querySelector('.napoveda')?.remove();
  while (log.children.length > st.zpravy.length) log.lastElementChild.remove();
  st.zpravy.forEach((z, i) => {
    let el = log.children[i];
    if (!el) { el = document.createElement('div'); log.appendChild(el); }
    const cls = `ai-zprava ai-${z.typ}`;
    if (el.className !== cls) el.className = cls;
    if (el.textContent !== z.text) el.textContent = z.text;
  });
}

function obnovUI(st) {
  const root = st.host?.isConnected ? st.host.querySelector('.ai-panel') : null;
  if (!root) return;
  const log = root.querySelector('[data-ai-log]');
  const blizkoKonce = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  vykresliLog(log, st);
  if (blizkoKonce) log.scrollTop = log.scrollHeight;
  root.querySelector('[data-ai-spust]').disabled = !!st.bezi || !!st.nedostupne;
  root.querySelector('[data-ai-stop]').hidden = !st.bezi;
  root.querySelector('[data-ai-vratit]').disabled = !muzeVratit(st);
  root.querySelector('[data-ai-bezi]').hidden = !st.bezi;
  root.querySelector('[data-ai-bezi]').textContent = st.bezi ? `Claude pracuje… ${Math.round((Date.now() - st.start) / 1000)} s` : '';
  root.querySelector('[data-ai-stav]').textContent = st.nedostupne;
  root.querySelector('[data-ai-stav]').hidden = !st.nedostupne;
  const pr = root.querySelector('[data-ai-prilohy]'), podpis = st.prilohy.map((f) => f.nahled).join('|');
  if (pr.dataset.podpis !== podpis) {
    pr.dataset.podpis = podpis;
    pr.innerHTML = st.prilohy.map((f, i) => `<span class="ai-priloha"><img src="${esc(f.nahled || '')}" alt=""><span>${esc(f.name || 'obrázek')}</span><button type="button" class="btn mal" data-ai-odeber="${i}" aria-label="Odebrat přílohu ${esc(f.name || '')}">×</button></span>`).join('');
  }
}

// host = #panel-obsah, ed = rozhraní editoru (vytvorEditor)
export function vykresliPanelClaude(host, ed) {
  const st = stavListu(ed.list.id);
  st.host = host; st.ed = ed;
  const evak = ed.projekt.typ === 'evakuacni_plan', priklad = evak ? PRIKLADY.evak : ed.list.typ === 'situace' ? PRIKLADY.situace : PRIKLADY.pudorys;
  host.innerHTML = `<div class="ai-panel">
    <h3>Claude</h3>
    <p class="napoveda">Popište, co má Claude nakreslit nebo upravit, případně přiložte fotku, skicu nebo plánek. Claude kreslí skutečné prvky výkresu (stěny, dveře, únikové cesty, značky, popisky), pak se na výsledek podívá a opraví ho. Vše, co udělá, vrátíte jedním <b>Zpět</b>. Výkres je návrh – za správnost odpovídá zpracovatel.</p>
    <p class="varuj" data-ai-stav hidden></p>
    <div class="ai-log" data-ai-log role="log" aria-live="polite"></div>
    <p class="ai-bezi" data-ai-bezi role="status" hidden></p>
    <form class="ai-form" data-ai-form>
      <label class="f"><span>Zadání</span><textarea rows="4" data-ai-zadani placeholder="${esc(priklad)}"></textarea></label>
      <div class="ai-prilohy" data-ai-prilohy></div>
      <div class="ai-radek" data-ai-obr-volby>
        <label class="btn mal" title="Fotka, skica nebo plánek (JPG, PNG). PDF a DXF vložte do listu tlačítkem Import… – Claude je pak uvidí na obrázku listu.">Přiložit fotku / skicu…<input type="file" class="sr-only" multiple data-ai-soubor></label>
      </div>
      <label class="chk" data-ai-obr-volby><input type="checkbox" data-ai-volba="prilozitVykres" ${st.prilozitVykres ? 'checked' : ''}> Poslat i obrázek listu (se souřadnicovou mřížkou)</label>
      <label class="chk" data-ai-obr-volby><input type="checkbox" data-ai-volba="kontrola" ${st.kontrola ? 'checked' : ''}> Po nakreslení výsledek zkontrolovat a opravit</label>
      <label class="f"><span>Model</span><select data-ai-model><option value="default">Vyvážený (doporučeno)</option><option value="complex">Nejschopnější – pomalejší, víc čerpá limit</option></select></label>
      <div class="ai-tlacitka">
        <button type="submit" class="btn pri" data-ai-spust>Nakreslit</button>
        <button type="button" class="btn" data-ai-stop hidden>Zastavit</button>
      </div>
      <div class="ai-tlacitka">
        <button type="button" class="btn mal" data-ai-vratit title="Vrátí výkres do stavu před posledním zásahem Claude (jde, dokud jste výkres dál neupravili; jinak použijte Zpět)">Vrátit změny od Claude</button>
        <button type="button" class="btn mal" data-ai-nova title="Claude zapomene předchozí zadání (výkres zůstane)">Nová konverzace</button>
      </div>
    </form></div>`;
  const root = host.querySelector('.ai-panel'), $ = (s) => root.querySelector(s);
  $('[data-ai-model]').value = st.model;
  $('[data-ai-zadani]').value = st.koncept || '';   // rozepsané zadání přežije přepnutí záložky panelu
  root.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = $('[data-ai-zadani]'), zadani = t.value.trim();
    if (!zadani || st.bezi || st.nedostupne) { if (!zadani) t.focus(); return; }
    t.value = ''; st.koncept = ''; spust(st, zadani);
  });
  $('[data-ai-zadani]').addEventListener('input', (e) => { st.koncept = e.target.value; });
  $('[data-ai-zadani]').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('[data-ai-form]').requestSubmit(); } });
  $('[data-ai-stop]').addEventListener('click', () => st.bezi?.abort());
  $('[data-ai-vratit]').addEventListener('click', () => { if (muzeVratit(st)) { st.ed.zpet(); st.poAi = null; st.zpravy.push({ typ: 'info', text: 'Změny od Claude vráceny (znovu je vrátíte tlačítkem Znovu).' }); obnovUI(st); } });
  $('[data-ai-nova]').addEventListener('click', () => { st.historie = []; st.zpravy = []; obnovUI(st); });
  $('[data-ai-model]').addEventListener('change', (e) => { st.model = e.target.value; });
  root.addEventListener('change', (e) => { const o = e.target.dataset.aiVolba; if (o) st[o] = e.target.checked; });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ai-odeber]'); if (!b) return;
    const [f] = st.prilohy.splice(Number(b.dataset.aiOdeber), 1); if (f?.nahled) URL.revokeObjectURL(f.nahled); obnovUI(st);
  });
  const soubor = $('[data-ai-soubor]');
  soubor.addEventListener('change', async () => {
    const sample = await claudeSample(), lim = sample && (await limity(sample)), im = lim?.images;
    for (const f of soubor.files) {
      if (im && !im.mediaTypes.includes(f.type)) { st.zpravy.push({ typ: 'chyba', text: `${f.name}: tento typ souboru Claude nepřijme (${im.mediaTypes.map((t) => t.replace('image/', '')).join(', ')}). PDF a DXF vložte do listu tlačítkem Import….` }); continue; }
      if (im && f.size > im.maxInputBytes) { st.zpravy.push({ typ: 'chyba', text: `${f.name}: soubor je příliš velký.` }); continue; }
      if (im && st.prilohy.length >= Math.max(1, im.maxCount - 1)) { st.zpravy.push({ typ: 'chyba', text: `Najednou lze přiložit nejvýš ${Math.max(1, im.maxCount - 1)} obrázky.` }); break; }
      f.nahled = URL.createObjectURL(f); st.prilohy.push(f);
    }
    soubor.value = ''; obnovUI(st);
  });
  // Časomíra běhu (Claude u delších výkresů přemýšlí desítky sekund).
  const tik = setInterval(() => { if (!root.isConnected) clearInterval(tik); else if (st.bezi) obnovUI(st); }, 1000);
  obnovUI(st);
  // Dostupnost Claude v tomto zobrazení (mimo claude.ai není; přílohy jen tam, kde jdou obrázky).
  claudeSample().then(async (sample) => {
    if (!sample) st.nedostupne = globalThis.claude ? 'Claude není v tomto zobrazení k dispozici (artefakt nemá povolené volání Claude nebo nejste přihlášeni).' : 'Kreslení s Claude funguje, když plánovač otevřete jako artefakt na claude.ai (v prohlížeči nebo v aplikaci Claude). V této kopii (soubor z disku, web) Claude k dispozici není – vše ostatní funguje.';
    else {
      const lim = await limity(sample);
      if (!lim?.tools) st.nedostupne = CHYBY.tools_unavailable;
      if (root.isConnected) {
        root.querySelectorAll('[data-ai-obr-volby]').forEach((el) => { el.hidden = !lim?.images; });
        if (lim?.images) soubor.accept = lim.images.mediaTypes.join(',');
        const tiers = lim?.modelTiers, sel = root.querySelector('[data-ai-model]');
        if (tiers) { sel.querySelectorAll('option').forEach((o) => { o.disabled = !tiers.includes(o.value); }); if (!tiers.includes(st.model)) { st.model = 'default'; sel.value = 'default'; } }
      }
    }
    obnovUI(st);
  });
}
