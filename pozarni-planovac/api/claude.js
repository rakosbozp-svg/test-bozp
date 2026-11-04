// Serverová funkce Vercelu (Node.js) pro panel Claude ve WEBOVÉ verzi plánovače – v artefaktu na claude.ai se nepoužívá.
// Prohlížeč pošle jedno kolo konverzace (systémové pokyny, zprávy, definice nástrojů). Funkce ho s API klíčem Anthropic
// z proměnné prostředí ANTHROPIC_API_KEY (do prohlížeče se nikdy nedostane) pošle Claude a odpověď streamuje zpět jako
// NDJSON – jeden objekt JSON na řádek:
//   {"t":"ping"}                         udržuje spojení (hned na začátku a pak každých 10 s)
//   {"t":"text","d":"…"}                 další kus textu odpovědi
//   {"t":"final","message":{…}}          celá odpověď (obsah, stop_reason, usage) – poslední řádek
//   {"t":"chyba","status":429,"kod":"rate_limited","zprava":"…"}   chyba během odpovědi – poslední řádek
// Nástroje (kreslení do výkresu) spouští prohlížeč a výsledky pošle v dalším kole. Přístup chrání heslo z proměnné
// PLANOVAC_HESLO (hlavička x-planovac-heslo), aby kredit nemohl čerpat nikdo cizí. Funkce hlídá, co se smí poslat:
// jen povolené modely, vlastní nástroje (žádné placené serverové nástroje), obrázky jen v base64, omezený max_tokens.
import { createHash, timingSafeEqual } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';

// Úrovně z panelu → modely. Opus je výchozí (nejlepší výsledky), Sonnet je rychlejší a za poloviční cenu.
export const MODELY = { default: 'claude-opus-5-5', quick: 'claude-sonnet-5-5' };
export const MAX_TELO = 4_200_000;   // bajtů – Vercel přijme tělo dotazu nejvýš 4,5 MB
export const MAX_TOKENS = 32000;     // jedno kolo (přemýšlení + text + vstupy nástrojů) – vejde se do limitu funkce
const MAX_ZPRAV = 160, MAX_NASTROJU = 16, MAX_SYSTEM = 400_000, PING_MS = 10_000;
// Bloky, které panel posílá: text, obrázky, volání nástrojů a jejich výsledky, přemýšlení z předchozích kol (beze změny).
const TYPY_BLOKU = new Set(['text', 'image', 'tool_use', 'tool_result', 'thinking', 'redacted_thinking']);
const TYPY_OBRAZKU = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

const odpovedJson = (status, telo) => new Response(JSON.stringify(telo), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const pauza = (ms) => new Promise((ok) => setTimeout(ok, ms));
const otisk = (s) => createHash('sha256').update(String(s), 'utf8').digest();
// Porovnání v konstantním čase (otisky mají stejnou délku, délka hesla se tak neprozradí).
export const hesloSedi = (zadane, spravne) => timingSafeEqual(otisk(zadane), otisk(spravne));

// Ověří tělo dotazu z prohlížeče a sestaví parametry pro Messages API. Vrací { params } nebo { chyba } (text pro vývojáře).
export function sestavParametry(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return { chyba: 'Tělo dotazu musí být objekt JSON.' };
  const model = Object.hasOwn(MODELY, d.model ?? 'default') ? MODELY[d.model ?? 'default'] : null;
  if (!model) return { chyba: `Neznámý model „${d.model}“ (povolené: ${Object.keys(MODELY).join(', ')}).` };
  if (d.system !== undefined && (typeof d.system !== 'string' || d.system.length > MAX_SYSTEM)) return { chyba: 'system musí být text (nejvýš 400 000 znaků).' };
  const zpravy = d.messages;
  if (!Array.isArray(zpravy) || !zpravy.length || zpravy.length > MAX_ZPRAV) return { chyba: `messages musí být neprázdné pole (nejvýš ${MAX_ZPRAV} zpráv).` };
  for (const z of zpravy) {
    if (!z || (z.role !== 'user' && z.role !== 'assistant')) return { chyba: 'Každá zpráva musí mít roli user nebo assistant.' };
    if (typeof z.content === 'string') continue;
    if (!Array.isArray(z.content) || !z.content.length) return { chyba: 'Obsah zprávy musí být text nebo neprázdné pole bloků.' };
    for (const b of z.content) {
      if (!b || typeof b !== 'object' || !TYPY_BLOKU.has(b.type)) return { chyba: `Nepovolený typ bloku „${b?.type}“.` };
      // výsledek nástroje smí obsahovat jen text a obrázky (base64) – žádné odkazy, které by Anthropic stahoval
      const vnorene = b.type === 'tool_result' && Array.isArray(b.content) ? b.content : [];
      for (const v of [b, ...vnorene]) {
        if (v !== b && (!v || (v.type !== 'text' && v.type !== 'image'))) return { chyba: `Nepovolený typ bloku ve výsledku nástroje „${v?.type}“.` };
        if (v.type === 'image' && (v.source?.type !== 'base64' || !TYPY_OBRAZKU.has(v.source?.media_type))) return { chyba: 'Obrázek musí být base64 (JPEG, PNG, GIF nebo WebP).' };
      }
    }
  }
  const nastroje = d.tools ?? [];
  if (!Array.isArray(nastroje) || nastroje.length > MAX_NASTROJU) return { chyba: `tools musí být pole (nejvýš ${MAX_NASTROJU} nástrojů).` };
  const tools = [];
  for (const n of nastroje) {
    // Jen vlastní nástroje stránky – serverové nástroje (webové vyhledávání, spouštění kódu…) se platí zvlášť, ty se nepustí.
    if (!n || n.type !== undefined || typeof n.name !== 'string' || !n.name || !n.input_schema || typeof n.input_schema !== 'object') {
      return { chyba: 'Povolené jsou jen vlastní nástroje { name, description, input_schema }.' };
    }
    tools.push({ name: n.name, description: String(n.description ?? ''), input_schema: n.input_schema });
  }
  // Přemýšlení je u obou modelů zapnuté samo (adaptivní) a úsilí má výchozí hodnotu modelu. cache_control uloží
  // společný začátek dotazu (pokyny, nástroje, obrázky) do mezipaměti – další kola stejného kreslení ho čtou levněji.
  const params = { model, max_tokens: MAX_TOKENS, messages: zpravy, cache_control: { type: 'ephemeral' } };
  if (d.system) params.system = d.system;
  if (tools.length) params.tools = tools;
  return { params };
}

const KODY = { 400: 'invalid_request', 401: 'api_key', 402: 'billing', 403: 'permission', 404: 'model', 413: 'prompt_too_large', 429: 'rate_limited', 529: 'overloaded' };
// Chyba SDK → { status, kod, zprava?, id? } pro prohlížeč (kód podle typované chyby, ne podle textu zprávy).
export function popisChyby(e) {
  if (e instanceof Anthropic.APIUserAbortError) return { status: 499, kod: 'cancelled' };
  if (e instanceof Anthropic.APIConnectionError) return { status: 502, kod: 'upstream_error', zprava: 'Spojení se servery Anthropic selhalo.' };
  if (e instanceof Anthropic.APIError) {
    const kod = KODY[e.status] || (e.status >= 500 ? 'upstream_error' : 'invalid_request');
    const zprava = String(e.error?.error?.message || e.message || '').slice(0, 400);
    return { status: e.status ?? 502, kod, zprava, ...(e.requestID ? { id: e.requestID } : {}) };
  }
  return { status: 500, kod: 'upstream_error', zprava: String(e?.message || e).slice(0, 400) };
}

// Odpověď Claude jako stream NDJSON. Odpojí-li se prohlížeč (Zastavit, zavření stránky), zruší se i dotaz u Anthropic.
function streamuj(klient, params, signal) {
  const enc = new TextEncoder();
  let stream = null, tik = null;
  const telo = new ReadableStream({
    async start(ctl) {
      let zavreno = false;
      const posli = (o) => {
        if (zavreno) return;
        try { ctl.enqueue(enc.encode(`${JSON.stringify(o)}\n`)); } catch { zavreno = true; }
      };
      posli({ t: 'ping' });
      tik = setInterval(() => posli({ t: 'ping' }), PING_MS);
      try {
        stream = klient.messages.stream(params, { signal });
        stream.on('text', (d) => posli({ t: 'text', d }));
        const message = await stream.finalMessage();
        posli({ t: 'final', message });
      } catch (e) {
        const ch = popisChyby(e);
        if (ch.kod !== 'cancelled') console.error(`[api/claude] ${ch.status} ${ch.kod}${ch.id ? ` ${ch.id}` : ''}`);
        posli({ t: 'chyba', ...ch });
      } finally {
        clearInterval(tik);
        if (!zavreno) { zavreno = true; try { ctl.close(); } catch { /* už zavřeno */ } }
      }
    },
    cancel() { clearInterval(tik); stream?.abort(); },
  });
  return new Response(telo, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store, no-transform', 'x-accel-buffering': 'no' },
  });
}

// Obsluha dotazu. Parametry jsou kvůli testům (vlastní prostředí, falešný klient Anthropic, bez čekání po špatném hesle).
export function vytvorObsluhu({ prostredi = process.env, vytvorKlienta = (apiKey) => new Anthropic({ apiKey }), pauzaPriChybe = 700 } = {}) {
  let klient = null, klicKlienta = null;
  return async function obsluha(request) {
    const apiKey = String(prostredi.ANTHROPIC_API_KEY || '').trim(), heslo = String(prostredi.PLANOVAC_HESLO || '').trim();
    // GET: panel si při otevření ověří, že funkce existuje a je nastavená (bez hesla, nic dalšího neprozradí).
    if (request.method === 'GET') return odpovedJson(200, { ok: true, nastaveno: !!(apiKey && heslo) });
    if (request.method !== 'POST') return odpovedJson(405, { kod: 'metoda', zprava: 'Použijte POST.' });
    if (!apiKey || !heslo) {
      const chybi = [!apiKey && 'ANTHROPIC_API_KEY', !heslo && 'PLANOVAC_HESLO'].filter(Boolean).join(' a ');
      return odpovedJson(503, { kod: 'konfigurace', zprava: `Na serveru chybí proměnná prostředí ${chybi}.` });
    }
    let zadane = '';
    try { zadane = decodeURIComponent(request.headers.get('x-planovac-heslo') || '').trim(); } catch { zadane = ''; }
    if (!zadane || !hesloSedi(zadane, heslo)) {
      await pauza(pauzaPriChybe);   // zpomalí zkoušení hesel
      return odpovedJson(401, { kod: 'heslo' });
    }
    if (Number(request.headers.get('content-length') || 0) > MAX_TELO) return odpovedJson(413, { kod: 'prompt_too_large' });
    let text;
    try { text = await request.text(); } catch { return odpovedJson(400, { kod: 'invalid_request', zprava: 'Tělo dotazu se nepodařilo přečíst.' }); }
    if (Buffer.byteLength(text, 'utf8') > MAX_TELO) return odpovedJson(413, { kod: 'prompt_too_large' });
    let dotaz;
    try { dotaz = JSON.parse(text); } catch { return odpovedJson(400, { kod: 'invalid_request', zprava: 'Tělo dotazu není platný JSON.' }); }
    const { params, chyba } = sestavParametry(dotaz);
    if (chyba) return odpovedJson(400, { kod: 'invalid_request', zprava: chyba });
    if (!klient || klicKlienta !== apiKey) { klient = vytvorKlienta(apiKey); klicKlienta = apiKey; }
    return streamuj(klient, params, request.signal);
  };
}

export default { fetch: vytvorObsluhu() };
