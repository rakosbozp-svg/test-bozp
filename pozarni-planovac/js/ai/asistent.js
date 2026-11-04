// Panel „Claude“ v editoru výkresu. Uživatel popíše, co nakreslit (a může přiložit fotku, skicu nebo plánek); Claude kreslí
// skutečné prvky výkresu nástroji z js/ai/nastroje.js a v kontrolním kole se podívá na obrázek listu a opraví, co nesedí.
// V artefaktu na claude.ai se volá schopnost „sample“ (window.claude.use('sample')) na účtu toho, kdo stránku prohlíží.
// Ve WEBOVÉ verzi (Vercel, window.__WEB__) jde Claude přes serverovou funkci /api/claude s API klíčem na serveru
// (js/ai/web.js, stejné rozhraní); přístup chrání heslo, které si prohlížeč pamatuje. Jinde (soubor z disku) Claude
// k dispozici není – panel to vysvětlí, zbytek aplikace běží beze změny.
// Celý zásah Claude je v historii JEDEN krok: editor je během zásahu zamčený (jen prohlížení), nástroje mění model
// a překreslují, commit (uložení + krok Zpět) je až na konci – i při zastavení nebo odchodu z listu (zastavClaude).
import * as P from '../kresleni/prvky.js';
import { esc } from '../kresleni/render.js';
import * as A from './nastroje.js';
import { vytvorWebSample, odhadCeny, prictiSpotrebu } from './web.js';

// ---------- přístup k Claude ----------
// Webová verze = stránka sestavená pro web (window.__WEB__) a zároveň NE artefakt claude.ai (ten má window.claude).
export const jeWeb = () => !(globalThis.claude && typeof globalThis.claude.use === 'function') && !!globalThis.__WEB__;
const KLIC_HESLA = 'pp.claude.heslo';
let hesloPamet = '';   // když prohlížeč nedovolí localStorage, heslo platí do zavření stránky
export function nactiHeslo() { try { return localStorage.getItem(KLIC_HESLA) || hesloPamet; } catch { return hesloPamet; } }
export function ulozHeslo(h) {
  hesloPamet = h || '';
  try { if (h) localStorage.setItem(KLIC_HESLA, h); else localStorage.removeItem(KLIC_HESLA); } catch { /* jen v paměti */ }
}
let slibSample = null;
export function claudeSample() {
  if (!slibSample) {
    slibSample = (async () => {
      const c = globalThis.claude;
      if (!c || typeof c.use !== 'function') return jeWeb() ? vytvorWebSample({ heslo: nactiHeslo }) : null;
      try { return await c.use('sample'); } catch { return null; }
    })();
  }
  return slibSample;
}
async function limity(sample) { try { return await sample.limits(); } catch { return null; } }

const CHYBY = {
  not_granted: 'Použití Claude v této stránce nebylo povoleno. Povolení změníte v nabídce artefaktu (Oprávnění) a pak stránku otevřete znovu.',
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
  // webová verze (serverová funkce /api/claude)
  heslo: 'Heslo ke Claude nesouhlasí. Zadejte ho znovu nahoře v panelu (nastavuje se na Vercelu v proměnné PLANOVAC_HESLO).',
  konfigurace: 'Na serveru chybí nastavení pro Claude: na Vercelu doplňte proměnné ANTHROPIC_API_KEY a PLANOVAC_HESLO a web znovu nasaďte (postup je v README plánovače).',
  endpoint: 'Na tomto webu chybí serverová funkce /api/claude – web je potřeba nasadit z aktuální verze (se složkou api/).',
  api_key: 'Anthropic odmítl API klíč uložený na serveru (neplatný nebo zrušený). Vytvořte nový na console.anthropic.com a vložte ho na Vercelu do ANTHROPIC_API_KEY.',
  billing: 'Na účtu Anthropic chybí kredit nebo je problém s platbou – doplňte ho na console.anthropic.com (Billing).',
  permission: 'API klíč na serveru nemá k Claude přístup (oprávnění organizace nebo pracovního prostoru na console.anthropic.com).',
  model: 'Zvolený model není pro API klíč na serveru dostupný – zkuste druhý model.',
  overloaded: 'Claude je teď přetížený. Zkuste to za chvíli.',
  timeout: 'Odpověď Claude se nevešla do časového limitu serverové funkce. Zkuste menší část výkresu nebo rychlejší model (Sonnet).',
};
// Podrobnost ze serveru (text chyby API) se přidá do závorky – pomůže při hledání příčiny.
const zpravaChyby = (e) => {
  const z = CHYBY[e?.code] || (e?.code ? CHYBY.upstream_error : `Chyba: ${e?.message || e}`);
  return e?.detail && e.code !== 'heslo' && e.code !== 'cancelled' ? `${z} (${e.detail})` : z;
};
// Kódy, po kterých Claude v tomto zobrazení stránky už nefunguje (platí pro všechny listy, znovu se neptá).
const TRVALE = ['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed', 'tools_unavailable', 'konfigurace', 'endpoint', 'api_key'];
const MODELY = { default: 'Vyvážený', complex: 'Nejschopnější', quick: 'Rychlý' };
let nedostupne = '';   // proč Claude v tomto zobrazení nejde (prázdné = jde)
const NEDOSTUPNE_MIMO = 'Kreslení s Claude funguje ve webové verzi plánovače a v artefaktu na claude.ai (v prohlížeči nebo v aplikaci Claude). V této kopii (soubor otevřený z disku) Claude k dispozici není – vše ostatní funguje.';
const NEDOSTUPNE_NULL = 'Claude není v tomto zobrazení k dispozici (artefakt nemá povolené volání Claude nebo nejste přihlášeni).';

// ---------- stav panelu (po listech projektu; přežije přepnutí záložky panelu i nové vytvoření editoru) ----------
const STAV = new Map();
const klicListu = (ed) => `${ed.projekt.id}|${ed.list.id}`;
function stavListu(ed) {
  const k = klicListu(ed);
  if (!STAV.has(k)) STAV.set(k, { zpravy: [], historie: [], prilohy: [], beh: null, predAi: null, poAi: null, kontrola: true, prilozitVykres: true, model: 'default', host: null, ed: null, koncept: '' });
  return STAV.get(k);
}
const bezi = (st) => !!st.beh && !st.beh.hotovo;
function zprava(st, typ, text) { const z = { typ, text }; st.zpravy.push(z); obnovUI(st); return z; }

// Zastaví běžící zásahy Claude HNED (synchronně): rozkreslené se zapíše jako jeden krok a uloží do listu, kde začalo – ještě
// než aplikace zavře editor (přechod na jiný list, projekt nebo přehled projektů). Volá app.js před každou změnou obrazovky.
export function zastavClaude() {
  for (const st of STAV.values()) {
    if (!bezi(st)) continue;
    const beh = st.beh; beh.odchod = true; beh.ctl.abort();
    zprava(st, 'info', beh.zmeneno ? 'Zastaveno při odchodu z listu. Co Claude stihl nakreslit, je uložené ve výkresu – vrátíte to tlačítkem „Vrátit změny od Claude“.' : 'Zastaveno při odchodu z listu – Claude ve výkresu nic nezměnil.');
    dokonci(st, beh);
  }
}

const NAZVY_DRUHU = { stena: 'stěny', dvere: 'dveře', trasa: 'únikové cesty', cara: 'čáry', plocha: 'plochy', obdelnik: 'obdélníky', elipsa: 'elipsy', text: 'popisky', znacka: 'značky' };
const PRIKLADY = {
  evak: 'Např.: Nakresli půdorys 1. NP podle přiložené skici: chodba uprostřed, kanceláře po stranách, dva východy. Vyznač únikové cesty k východům a bod „Jste zde“ u recepce.',
  situace: 'Např.: Nakresli situaci podle fotky: hala 40 × 20 m, příjezd od silnice ze západu, nástupní plocha u severní stěny.',
  pudorys: 'Např.: Nakresli půdorys podle přiložené fotky domu, strany, které nejsou vidět, odhadni. Popiš místnosti a vyznač únikovou cestu k hlavnímu vchodu.',
};

// ---------- obrázek listu pro Claude ----------
// Jen KRESLICÍ PLOCHA listu (rám s malým okrajem), vykreslená stejně jako export (včetně podkladu) + pomocná mřížka souřadnic;
// PNG o delší straně maxPx. Razítko, popisové pole a pokyny listu (jména z operativní karty, zhotovitel…) se neposílají.
export async function obrazekListu(ed, { mrizka = true, maxPx = 1600 } = {}) {
  let svg = await ed.exportSvg();
  const { ram } = P.rozlozeniListu(ed.v), o = Math.max(ram.w, ram.h) * 0.012, x = ram.x - o, y = ram.y - o, w = ram.w + 2 * o, h = ram.h + 2 * o;
  if (mrizka) svg = svg.replace(/<\/svg>\s*$/, `${A.mrizkaSvg(ed.v, { px: maxPx })}</svg>`);
  svg = svg.replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\sviewBox="[^"]*"/, ` viewBox="${x} ${y} ${w} ${h}"`).replace(/\swidth="[^"]*"/, ` width="${w}mm"`).replace(/\sheight="[^"]*"/, ` height="${h}mm"`));
  const k = maxPx / Math.max(w, h), pw = Math.round(w * k), ph = Math.round(h * k);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error('Obrázek listu se nepodařilo vytvořit')); img.src = url; });
    const c = document.createElement('canvas'); c.width = pw; c.height = ph;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, pw, ph); g.drawImage(img, 0, 0, pw, ph);
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
    if (v.id?.includes(A.ID_JSTEZDE)) casti.push('bod „Jste zde“');
    return `Nakresleno: ${casti.join(', ') || 'nic'}${v.chyby ? ` · odmítnuto ${v.id.filter((x) => x === null).length} (Claude dostal důvod)` : ''}`;
  }
  if (nazev === 'uprav') return `Upraveno prvků: ${v.upraveno}${v.chyby ? ` · nepovedlo se ${v.chyby.length}` : ''}`;
  if (nazev === 'smaz') return `Smazáno prvků: ${v.smazano}${v.chyby ? ` · nepovedlo se ${v.chyby.length}` : ''}`;
  if (nazev === 'nastav_list') return `List: ${v.hotovo.join(', ')}`;
  return 'Čtení výkresu';
}

// ---------- běh zásahu ----------
// Konec zásahu (dokončení, chyba, Zastavit, odchod z listu) – jen jednou: odemknout editor, pojistky, jeden commit.
function dokonci(st, beh) {
  if (beh.hotovo) return;
  beh.hotovo = true;
  const ed = beh.ed;
  ed.odemkni?.();
  if (beh.zmeneno) {
    if (beh.pridane.size && A.mimoRam(ed.v, [...beh.pridane])) {
      const r = A.vejdiSeDoRamu(ed.v);
      zprava(st, 'info', r.zmenaMeritka ? `Nakreslené přesahovalo rám listu – měřítko listu je teď 1 : ${r.pomer} a obsah je vycentrovaný.` : 'Nakreslené přesahovalo rám listu – obsah je vycentrovaný, měřítko zůstalo.');
    }
    // Rozměry odhadnuté z obrázku (prázdný list bez podkladu, dosud bez neověřeného měřítka) → list „měřítko neověřeno“.
    if (beh.sFotkou && beh.byloPrazdne && !ed.v.pozadi && (!ed.v.meritkoZdroj || ed.v.meritkoZdroj.overeno) && ed.v.prvky.length) {
      ed.v.meritkoZdroj = { zdroj: 'claude', popis: 'rozměry odhadl Claude z obrázku', overeno: false };
      zprava(st, 'info', 'Rozměry jsou odhad z obrázku – list je označen „měřítko neověřeno“. Až budete znát skutečný rozměr, použijte nástroj Kalibrace (dva body a známá délka).');
    }
    ed.commit();
    st.predAi = beh.predAi; st.poAi = ed.H.s[ed.H.i];
    if (beh.pridane.size && !beh.odchod && st.host?.isConnected) ed.naObsah();
  }
  if (beh.spotreba) zprava(st, 'info', textSpotreby(beh));
  obnovUI(st);
}

// Webová verze se platí podle spotřeby – po zásahu panel ukáže tokeny a orientační cenu (ceník v js/ai/web.js).
const cislo = (n) => Math.round(n || 0).toLocaleString('cs-CZ');
function textSpotreby(beh) {
  const u = beh.spotreba, vstup = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
  const cena = beh.cena < 0.005 ? 'méně než 0,01 USD' : `${beh.cena.toLocaleString('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
  return `Spotřeba Claude: vstup ${cislo(vstup)} tokenů (z mezipaměti ${cislo(u.cache_read_input_tokens)}), výstup ${cislo(u.output_tokens)} – odhadem ${cena}.`;
}
function zapisSpotrebu(beh, usage, tier) {
  if (!usage) return;
  prictiSpotrebu(beh.spotreba ||= {}, usage);
  beh.cena = (beh.cena || 0) + odhadCeny(usage, tier);
}

async function spust(st, zadani) {
  const ed = st.ed;
  // Stav „běží“ hned při odeslání (synchronně): žádné dvojí odeslání, Zastavit je vidět od začátku, editor se zamkne.
  const beh = { ed, ctl: new AbortController(), hotovo: false, odchod: false, zmeneno: false, pridane: new Set(), sFotkou: st.prilohy.length > 0, byloPrazdne: !ed.v.prvky.length, predAi: ed.H.s[ed.H.i], start: Date.now(), kolo: null, modelOznamen: false };
  st.beh = beh; st.poAi = null;
  zprava(st, 'ty', zadani + (st.prilohy.length ? `\n(přílohy: ${st.prilohy.map((f) => f.name || 'obrázek').join(', ')})` : ''));
  ed.zamkni('Claude kreslí do výkresu – ruční úpravy a Zpět počkají na dokončení. Zastavit můžete v panelu Claude.');
  try {
    const sample = await claudeSample(), lim = sample && (await limity(sample));
    if (beh.ctl.signal.aborted) throw { code: 'cancelled' };
    if (!sample || !lim?.tools) { nedostupne ||= !sample ? (globalThis.claude ? NEDOSTUPNE_NULL : NEDOSTUPNE_MIMO) : CHYBY.tools_unavailable; zprava(st, 'chyba', nedostupne); return; }
    const k = kontext(ed), maxObr = lim.images?.maxCount ?? 0, obrOk = !!lim.images && maxObr > 0;
    const nastroje = A.definiceNastroju(k).map((d) => ({
      ...d,
      execute: (vstup, kx) => {
        if (beh.hotovo || beh.ctl.signal.aborted || kx?.signal?.aborted) throw new Error('Zastaveno uživatelem');
        beh.kolo?.rez();   // text dalšího kola Claude půjde do nové bubliny pod touto akcí
        try {
          const r = A.provedNastroj(d.name, vstup, k);
          if (r.zmena) { beh.zmeneno = true; ed.vykresli(); }
          for (const id of r.nove || []) beh.pridane.add(id);
          for (const id of r.smazane || []) beh.pridane.delete(id);
          zprava(st, 'akce', souhrnAkce(d.name, r, k));
          return r.vysledek;
        } catch (e) { zprava(st, 'akce-chyba', `Nástroj ${d.name}: ${e.message}`); throw e; }
      },
    }));
    // Jedno volání Claude (může mít několik kol s nástroji). onText dává CELÝ dosavadní text všech kol; text po akci nástroje
    // se ukazuje v nové bublině (od místa řezu). Selže-li volání bez e.text, zmizí jen bubliny TOHOTO volání.
    // Pokyny jdou v artefaktu jako první zpráva uživatele, ve webové verzi jako systémové pokyny (API je ukládá do mezipaměti).
    const zavolej = async (tahy, obrazky) => {
      let rez = 0, posledni = '', bub = null;
      const moje = [];
      beh.kolo = { rez: () => { rez = posledni.length; bub = null; } };
      const ukaz = (text) => {
        posledni = text;
        const cast = text.slice(rez).trim();
        if (!cast || beh.hotovo) return;
        if (!bub) { bub = zprava(st, 'claude', ''); moje.push(bub); }
        bub.text = cast; obnovUI(st);
      };
      const opt = { tools: nastroje, signal: beh.ctl.signal, modelTier: st.model, onText: ({ text }) => ukaz(text) };
      if (obrazky.length) opt.images = obrazky;
      const pokyny = A.pokyny(k);
      let vstup = tahy;
      if (sample.web) opt.system = pokyny; else vstup = [{ role: 'user', content: pokyny }, ...tahy];
      try {
        const r = await sample(vstup, opt);
        if (sample.web) zapisSpotrebu(beh, r.usage, opt.modelTier);   // artefakt se platí předplatným, ne po tokenech
        ukaz(r.text);
        if (r.truncated) zprava(st, 'info', 'Odpověď byla zkrácena – příště zadejte menší část výkresu.');
        if (r.modelTierApplied && r.modelTierApplied !== st.model && !beh.modelOznamen) { beh.modelOznamen = true; zprava(st, 'info', `Odpověděl model ${MODELY[r.modelTierApplied] || r.modelTierApplied} – zvolený model ${MODELY[st.model] || st.model} teď není k dispozici.`); }
        return r;
      } catch (e) {
        if (sample.web) zapisSpotrebu(beh, e?.usage, opt.modelTier);
        if (e?.text === undefined && moje.length) st.zpravy = st.zpravy.filter((z) => !moje.includes(z));
        throw e;
      } finally { beh.kolo = null; }
    };
    const obrazky = [...st.prilohy], popisObr = [];
    st.prilohy.forEach((f, i) => popisObr.push(`${i + 1}) příloha od uživatele „${f.name || 'obrázek'}“ (bez souřadnic – rozměry odhadni, pokud nejsou kótované)`));
    if (st.prilozitVykres && obrOk && (ed.v.prvky.length || ed.v.pozadi) && obrazky.length < maxObr) { obrazky.push(await obrazekListu(ed)); popisObr.push(`${obrazky.length}) kreslicí plocha aktuálního listu s purpurovou souřadnicovou mřížkou v metrech`); }
    if (obrazky.length && !obrOk) throw { code: 'images_unavailable' };
    if (obrazky.length > maxObr) throw { code: 'image_rejected', message: `nejvýš ${maxObr} obrázků` };
    const tahy = [...st.historie.slice(-6),
      { role: 'user', content: `${popisObr.length ? `PŘILOŽENÉ OBRÁZKY:\n${popisObr.join('\n')}\n\n` : ''}STAV LISTU:\n${A.popisStavu(k)}\n\nZADÁNÍ UŽIVATELE:\n${zadani}` }];
    const r1 = await zavolej(tahy, obrazky);
    st.historie.push({ role: 'user', content: `ZADÁNÍ UŽIVATELE:\n${zadani}` }, { role: 'assistant', content: r1.text.slice(0, 4000) });
    // Kontrolní kolo: Claude se podívá na výsledek (obrázek kreslicí plochy s mřížkou) a opraví, co nesedí. Posílá obrázek
    // listu, proto jen se zapnutým „Poslat i obrázek listu“. Když selže, výsledek prvního kola zůstává.
    if (st.kontrola && st.prilozitVykres && beh.zmeneno && obrOk && !beh.ctl.signal.aborted) {
      zprava(st, 'info', 'Kontrola: Claude se dívá na obrázek výsledku a opraví, co nesedí…');
      try {
        const obr = [await obrazekListu(ed), ...st.prilohy].slice(0, maxObr);
        const tahy2 = [
          { role: 'user', content: `KONTROLNÍ KOLO. Zadání uživatele bylo:\n${zadani}\n\nPrávě jsi list nakreslil/upravil. Obrázek 1 je kreslicí plocha listu s výsledkem a purpurovou souřadnicovou mřížkou v metrech${obr.length > 1 ? ', další obrázky jsou přílohy uživatele' : ''}.\n\nSTAV LISTU:\n${A.popisStavu(k)}\n\nZkontroluj výkres proti zadání: navazující stěny, dveře na stěnách, únikové cesty vedoucí k východům, překrývající se popisky a značky, prvky mimo rám nebo pod legendou, chybějící části zadání. Chyby oprav nástroji uprav/kresli/smaz (vše v co nejméně voláních). Je-li vše v pořádku, nic neměň. Na konci napiš 1–3 řádky „• “ co jsi opravil (nebo že je výkres v pořádku).` }];
        const r2 = await zavolej(tahy2, obr);
        const h = st.historie[st.historie.length - 1]; h.content = `${h.content}\n${r2.text}`.slice(0, 4000);
      } catch (e) {
        if (e?.code === 'cancelled' || beh.ctl.signal.aborted) throw e;
        zprava(st, 'info', `Kontrolu výsledku se nepodařilo dokončit (${zpravaChyby(e)}). Výkres z prvního kola zůstává.`);
        if (TRVALE.includes(e?.code)) nedostupne = zpravaChyby(e);
      }
    }
  } catch (e) {
    if (beh.odchod) return;   // zastaveno odchodem z listu – zpráva i commit už proběhly v zastavClaude
    if (e?.code === 'cancelled' || beh.ctl.signal.aborted) zprava(st, 'info', beh.zmeneno ? 'Zastaveno. Co Claude stihl nakreslit, zůstává ve výkresu – vrátíte to tlačítkem „Vrátit změny od Claude“.' : 'Zastaveno – Claude ve výkresu nic nezměnil.');
    else {
      zprava(st, 'chyba', zpravaChyby(e));
      if (TRVALE.includes(e?.code)) nedostupne = zpravaChyby(e);
      // Špatné heslo: zapomenout ho a vrátit zadání do pole, ať jde po zadání hesla jen znovu odeslat.
      if (e?.code === 'heslo') {
        ulozHeslo('');
        if (!st.koncept) st.koncept = zadani;
        const t = st.host?.isConnected ? st.host.querySelector('[data-ai-zadani]') : null;
        if (t && !t.value) t.value = zadani;
      }
    }
  } finally {
    dokonci(st, beh);
  }
}

// ---------- vrácení zásahu ----------
// Jde, dokud se list od konce zásahu nezměnil (porovnává se snímek listu, takže i po novém vytvoření editoru).
const muzeVratit = (st) => !bezi(st) && st.poAi != null && st.predAi != null && !!st.ed && st.ed.H.s[st.ed.H.i] === st.poAi;
function vratit(st) {
  const ed = st.ed;
  if (!muzeVratit(st)) { zprava(st, 'info', 'Vrátit už nejde – po zásahu Claude se výkres změnil. Použijte tlačítko Zpět v liště editoru.'); return; }
  if (ed.H.i > 0 && ed.H.s[ed.H.i - 1] === st.predAi) { ed.zpet(); zprava(st, 'info', 'Změny od Claude jsou vrácené. Obnovíte je tlačítkem Znovu v liště editoru.'); }
  else { P.obnovZeSnimku(ed.v, st.predAi); ed.commit(); zprava(st, 'info', 'Změny od Claude jsou vrácené. Obnovíte je tlačítkem Zpět v liště editoru.'); }
  st.poAi = null; obnovUI(st);
}

// ---------- vykreslení panelu ----------
const AUTOR = { ty: 'Vy', claude: 'Claude', akce: 'Akce', 'akce-chyba': 'Chyba nástroje', info: 'Informace', chyba: 'Chyba' };
// Log se aktualizuje po zprávách (ne celý najednou); každá zpráva má pro čtečky obrazovky skrytý popisek autora.
function vykresliLog(log, st) {
  if (!st.zpravy.length) { if (!log.querySelector('.napoveda')) log.innerHTML = '<p class="napoveda">Zatím žádná konverzace.</p>'; return; }
  log.querySelector('.napoveda')?.remove();
  while (log.children.length > st.zpravy.length) log.lastElementChild.remove();
  st.zpravy.forEach((z, i) => {
    let el = log.children[i];
    if (!el) { el = document.createElement('div'); const sr = document.createElement('span'); sr.className = 'sr-only'; el.append(sr, document.createTextNode('')); log.appendChild(el); }
    const cls = `ai-zprava ai-${z.typ}`, [sr, t] = el.childNodes, autor = `${AUTOR[z.typ] || ''}: `;
    if (el.className !== cls) el.className = cls;
    if (sr.textContent !== autor) sr.textContent = autor;
    if (t.nodeValue !== z.text) t.nodeValue = z.text;
  });
}

function obnovUI(st) {
  const root = st.host?.isConnected ? st.host.querySelector('.ai-panel') : null;
  if (!root) return;
  const b = bezi(st), $ = (s) => root.querySelector(s), log = $('[data-ai-log]');
  const blizkoKonce = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
  vykresliLog(log, st);
  log.setAttribute('aria-busy', b ? 'true' : 'false');   // čtečka přečte odpověď až celou
  if (blizkoKonce) log.scrollTop = log.scrollHeight;
  $('[data-ai-spust]').disabled = b || !!nedostupne;
  $('[data-ai-stop]').hidden = !b;
  $('[data-ai-nova]').disabled = b;
  $('[data-ai-soubor]').disabled = b;
  $('[data-ai-vratit]').disabled = !muzeVratit(st);
  $('[data-ai-volba=kontrola]').disabled = !st.prilozitVykres;
  $('[data-ai-bezi]').hidden = !b;
  $('[data-ai-bezi]').textContent = b ? `Claude pracuje… ${Math.round((Date.now() - st.beh.start) / 1000)} s` : '';
  $('[data-ai-stav]').textContent = nedostupne;
  $('[data-ai-stav]').hidden = !nedostupne;
  if ($('[data-ai-heslo-blok]')) {   // webová verze: pole pro heslo, dokud ho prohlížeč nemá uložené
    const ulozene = !!nactiHeslo(), vstup = $('[data-ai-heslo]');
    $('[data-ai-heslo-zadat]').hidden = ulozene;
    vstup.required = !ulozene; vstup.disabled = b;
    $('[data-ai-heslo-ulozene]').hidden = !ulozene;
    $('[data-ai-heslo-zapomen]').disabled = b;
  }
  const pr = $('[data-ai-prilohy]'), podpis = `${b}|${st.prilohy.map((f) => f.nahled).join('|')}`;
  if (pr.dataset.podpis !== podpis) {
    pr.dataset.podpis = podpis;
    pr.innerHTML = st.prilohy.map((f, i) => `<span class="ai-priloha"><img src="${esc(f.nahled || '')}" alt=""><span>${esc(f.name || 'obrázek')}</span><button type="button" class="btn mal" data-ai-odeber="${i}" ${b ? 'disabled' : ''} aria-label="Odebrat přílohu ${esc(f.name || '')}">×</button></span>`).join('')
      + (st.prilohy.length ? '<p class="napoveda">Přílohy se pošlou s každým dalším zadáním, dokud je neodeberete (×).</p>' : '');
  }
}

// host = #panel-obsah, ed = rozhraní editoru (vytvorEditor)
export function vykresliPanelClaude(host, ed) {
  const st = stavListu(ed);
  st.host = host; st.ed = ed;
  const evak = ed.projekt.typ === 'evakuacni_plan', priklad = evak ? PRIKLADY.evak : ed.list.typ === 'situace' ? PRIKLADY.situace : PRIKLADY.pudorys;
  const web = jeWeb();
  const volbyModelu = web
    ? '<option value="default">Claude Opus 5.5 (doporučeno)</option><option value="quick">Claude Sonnet 5.5 – rychlejší, levnější</option>'
    : '<option value="default">Vyvážený (doporučeno)</option><option value="complex">Nejschopnější – pomalejší, víc čerpá limit</option>';
  host.innerHTML = `<div class="ai-panel">
    <h3>Claude</h3>
    <p class="napoveda">Popište, co má Claude nakreslit nebo upravit, případně přiložte fotku, skicu nebo plánek. Claude kreslí skutečné prvky výkresu (stěny, dveře, únikové cesty, značky, popisky), pak se na výsledek podívá a opraví ho. Vše, co udělá, vrátíte jedním <b>Zpět</b>. Výkres je návrh – za správnost odpovídá zpracovatel.${web ? ' Ve webové verzi se Claude platí z API klíče podle spotřeby – po každém kreslení panel ukáže spotřebu a odhad ceny.' : ''}</p>
    <p class="varuj" data-ai-stav hidden></p>
    <div class="ai-log" data-ai-log role="log" aria-live="polite" aria-label="Konverzace s Claude"></div>
    <p class="ai-bezi" data-ai-bezi hidden></p>
    <form class="ai-form" data-ai-form>
      ${web ? `<div class="ai-heslo" data-ai-heslo-blok>
        <label class="f" data-ai-heslo-zadat><span>Heslo ke Claude</span><input id="ai-heslo" name="heslo" type="password" autocomplete="current-password" data-ai-heslo></label>
        <p class="napoveda" data-ai-heslo-ulozene>Heslo ke Claude je uložené v tomto prohlížeči. <button type="button" class="btn mal" data-ai-heslo-zapomen>Zapomenout heslo</button></p>
      </div>` : ''}
      <label class="f"><span>Zadání</span><textarea id="ai-zadani" rows="4" data-ai-zadani placeholder="${esc(priklad)}"></textarea></label>
      <div class="ai-prilohy" data-ai-prilohy></div>
      <div class="ai-radek" data-ai-obr-volby>
        <label class="btn mal" title="Fotka, skica nebo plánek (JPG, PNG). PDF a DXF vložte do listu tlačítkem Import… – Claude je pak uvidí na obrázku listu.">Přiložit fotku / skicu…<input id="ai-soubor" type="file" class="sr-only" multiple data-ai-soubor></label>
      </div>
      <label class="chk" data-ai-obr-volby><input id="ai-obr-listu" type="checkbox" data-ai-volba="prilozitVykres" ${st.prilozitVykres ? 'checked' : ''}> Poslat i obrázek listu (kreslicí plocha s mřížkou, bez razítka)</label>
      <label class="chk" data-ai-obr-volby><input id="ai-kontrola" type="checkbox" data-ai-volba="kontrola" ${st.kontrola ? 'checked' : ''}> Po nakreslení výsledek zkontrolovat a opravit (pošle obrázek listu)</label>
      <label class="f"><span>Model</span><select id="ai-model" data-ai-model>${volbyModelu}</select></label>
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
    if (!zadani || bezi(st) || nedostupne) { if (!zadani) t.focus(); return; }
    if (web && !nactiHeslo()) {   // (prázdné pole hesla zastaví už kontrola formuláře – required)
      const h = $('[data-ai-heslo]');
      if (!h.value.trim()) { h.focus(); return; }
      ulozHeslo(h.value.trim()); h.value = '';
    }
    t.value = ''; st.koncept = ''; spust(st, zadani);
  });
  $('[data-ai-heslo-zapomen]')?.addEventListener('click', () => { ulozHeslo(''); obnovUI(st); $('[data-ai-heslo]')?.focus(); });
  $('[data-ai-zadani]').addEventListener('input', (e) => { st.koncept = e.target.value; });
  $('[data-ai-zadani]').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('[data-ai-form]').requestSubmit(); } });
  $('[data-ai-stop]').addEventListener('click', () => { if (bezi(st)) st.beh.ctl.abort(); });
  $('[data-ai-vratit]').addEventListener('click', () => vratit(st));
  $('[data-ai-nova]').addEventListener('click', () => { if (bezi(st)) return; st.historie = []; st.zpravy = []; obnovUI(st); });
  $('[data-ai-model]').addEventListener('change', (e) => { st.model = e.target.value; });
  root.addEventListener('change', (e) => { const o = e.target.dataset.aiVolba; if (o) { st[o] = e.target.checked; obnovUI(st); } });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ai-odeber]'); if (!b || bezi(st)) return;
    const [f] = st.prilohy.splice(Number(b.dataset.aiOdeber), 1); if (f?.nahled) URL.revokeObjectURL(f.nahled); obnovUI(st);
  });
  const soubor = $('[data-ai-soubor]');
  soubor.addEventListener('change', async () => {
    const sample = await claudeSample(), lim = sample && (await limity(sample)), im = lim?.images;
    for (const f of soubor.files) {
      if (bezi(st)) break;
      if (im && !im.mediaTypes.includes(f.type)) { zprava(st, 'chyba', `${f.name}: tento typ souboru Claude nepřijme (${im.mediaTypes.map((t) => t.replace('image/', '')).join(', ')}). PDF a DXF vložte do listu tlačítkem Import….`); continue; }
      if (im && f.size > im.maxInputBytes) { zprava(st, 'chyba', `${f.name}: soubor je příliš velký.`); continue; }
      if (im && st.prilohy.length >= Math.max(1, im.maxCount - 1)) { zprava(st, 'chyba', `Najednou lze přiložit nejvýš ${Math.max(1, im.maxCount - 1)} obrázky.`); break; }
      f.nahled = URL.createObjectURL(f); st.prilohy.push(f);
    }
    soubor.value = ''; obnovUI(st);
  });
  // Časomíra běhu a stav tlačítka „Vrátit“ (editor může historii změnit i mimo panel).
  const tik = setInterval(() => { if (!root.isConnected) clearInterval(tik); else if (bezi(st)) obnovUI(st); else $('[data-ai-vratit]').disabled = !muzeVratit(st); }, 1000);
  obnovUI(st);
  // Dostupnost Claude v tomto zobrazení (mimo claude.ai není; přílohy jen tam, kde jdou obrázky).
  claudeSample().then(async (sample) => {
    if (!sample) nedostupne ||= globalThis.claude ? NEDOSTUPNE_NULL : NEDOSTUPNE_MIMO;
    else {
      if (sample.web) { const s = await sample.stav?.(); if (s?.code) nedostupne ||= zpravaChyby({ code: s.code }); }   // funkce na webu chybí / není nastavená
      const lim = await limity(sample);
      if (!lim?.tools) nedostupne ||= CHYBY.tools_unavailable;
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
