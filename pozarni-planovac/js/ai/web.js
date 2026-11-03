// Claude ve WEBOVÉ verzi plánovače (Vercel). Náhrada schopnosti artefaktu claude.ai „sample“ se stejným rozhraním –
// sample(vstup, { tools, signal, modelTier, onText, images, system }) → { text, truncated, modelTierApplied, usage }
// a sample.limits() – takže panel Claude (asistent.js) funguje stejně jako v artefaktu. Dotazy jdou přes serverovou
// funkci /api/claude (api/claude.js), která drží API klíč Anthropic; v prohlížeči klíč není, posílá se jen heslo.
// Smyčka s nástroji běží tady: Claude navrhne volání nástroje, stránka ho provede (kreslí do výkresu) a výsledek
// pošle v dalším kole, dokud Claude neskončí. Bloky odpovědi (i přemýšlení) se vrací beze změny.

export const ENDPOINT = '/api/claude';
export const MAX_KOL = 12;                // nejvýš tolik dotazů na Claude v jednom volání (kolo = odpověď + nástroje)
export const MAX_TELO = 4_000_000;        // bajtů na dotaz (Vercel přijme 4,5 MB, serverová funkce 4,2 MB)
export const TYPY_OBRAZKU = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_STRANA = 1568, CIL_BAJTU = 700_000;   // doporučená delší strana obrázku pro Claude; cílová velikost jednoho obrázku

// Ceník Anthropic (USD za milion tokenů, listopad 2026) – jen pro orientační odhad útraty v panelu.
export const CENY = { default: { vstup: 4, vystup: 20, cteni: 0.2 }, quick: { vstup: 2, vystup: 10, cteni: 0.2 } };
export function odhadCeny(u, tier = 'default') {
  const c = CENY[tier] || CENY.default;
  return ((u.input_tokens || 0) * c.vstup + (u.cache_creation_input_tokens || 0) * c.vstup * 1.25
    + (u.cache_read_input_tokens || 0) * c.cteni + (u.output_tokens || 0) * c.vystup) / 1e6;
}
const POLE_SPOTREBY = ['input_tokens', 'cache_creation_input_tokens', 'cache_read_input_tokens', 'output_tokens'];
export function prictiSpotrebu(cil, u) { for (const k of POLE_SPOTREBY) cil[k] = (cil[k] || 0) + (Number(u?.[k]) || 0); return cil; }

// Chyba se stejnými kódy jako schopnost „sample“ (panel je přeloží) + kódy webu: heslo, konfigurace, api_key, billing,
// permission, model, overloaded, endpoint, timeout. detail = podrobnost ze serveru (text API) pro zprávu v panelu.
export class ChybaClaude extends Error {
  constructor(code, { message, detail, status, text, usage } = {}) {
    super(message || detail || code);
    this.name = 'ChybaClaude'; this.code = code;
    if (detail) this.detail = detail;
    if (status) this.status = status;
    if (text !== undefined) this.text = text;
    if (usage) this.usage = usage;
  }
}
const KOD_STAVU = { 401: 'heslo', 404: 'endpoint', 413: 'prompt_too_large', 429: 'rate_limited', 504: 'timeout' };
function chybaOdpovedi(status, j) {
  const kod = (j && typeof j.kod === 'string' && j.kod) || KOD_STAVU[status] || (status >= 500 ? 'upstream_error' : 'invalid_request');
  return new ChybaClaude(kod, { status, detail: j?.zprava ? String(j.zprava).slice(0, 400) : undefined });
}

// Tahy z panelu → zprávy Messages API: prázdné texty pryč (API je odmítne), po sobě jdoucí tahy stejné role se spojí,
// první zpráva musí být od uživatele.
export function naZpravy(tahy) {
  const out = [];
  for (const t of [].concat(tahy || [])) {
    if (!t || (t.role !== 'user' && t.role !== 'assistant')) continue;
    const bloky = typeof t.content === 'string'
      ? (t.content.trim() ? [{ type: 'text', text: t.content }] : [])
      : (Array.isArray(t.content) ? t.content.filter((b) => b && !(b.type === 'text' && !String(b.text ?? '').trim())) : []);
    if (!bloky.length) continue;
    const pred = out.at(-1);
    if (pred?.role === t.role) pred.content.push(...bloky); else out.push({ role: t.role, content: [...bloky] });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}
// Obrázky patří do poslední zprávy uživatele, před její text.
export function pripojObrazky(zpravy, bloky) {
  const z = [...zpravy].reverse().find((x) => x.role === 'user');
  if (z && bloky.length) z.content = [...bloky, ...z.content];
  return zpravy;
}
const textBloku = (content) => (content || []).filter((b) => b?.type === 'text').map((b) => b.text).join('');
const spoj = (a, b) => (a && b ? `${a}\n\n${b}` : a || b);

// ---------- obrázky: zmenšení na doporučenou velikost a převod do base64 ----------
async function nactiBitmapu(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch { return createImageBitmap(blob); }
}
const naBlob = (c, typ, q) => new Promise((ok, ko) => c.toBlob((b) => (b ? ok(b) : ko(new Error('toBlob'))), typ, q));
const naBase64 = (blob) => new Promise((ok, ko) => {
  const r = new FileReader();
  r.onload = () => { const s = String(r.result); ok(s.slice(s.indexOf(',') + 1)); };
  r.onerror = () => ko(r.error);
  r.readAsDataURL(blob);
});
// Delší strana nejvýš 1568 px a do ~700 kB: výkres (PNG s čarami) zůstane PNG, fotky a velké obrázky jdou jako JPEG.
export async function obrazekProClaude(blob) {
  const jmeno = blob?.name || 'obrázek';
  let bmp;
  try { bmp = await nactiBitmapu(blob); } catch { throw new ChybaClaude('image_rejected', { detail: `${jmeno}: soubor se nepodařilo načíst jako obrázek` }); }
  try {
    const delsi = Math.max(bmp.width, bmp.height);
    let vysledek = null;
    if (delsi <= MAX_STRANA && TYPY_OBRAZKU.includes(blob.type) && blob.size <= CIL_BAJTU) vysledek = blob;
    for (const strana of [MAX_STRANA, 1200, 900]) {
      if (vysledek) break;
      const k = Math.min(1, strana / delsi), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.drawImage(bmp, 0, 0, w, h);
      if (blob.type === 'image/png') { const png = await naBlob(c, 'image/png'); if (png.size <= CIL_BAJTU) { vysledek = png; break; } }
      for (const q of [0.85, 0.7, 0.55]) { const jpg = await naBlob(c, 'image/jpeg', q); if (jpg.size <= CIL_BAJTU) { vysledek = jpg; break; } }
    }
    if (!vysledek) throw new ChybaClaude('image_rejected', { detail: `${jmeno}: obrázek se nepodařilo zmenšit` });
    return { type: 'image', source: { type: 'base64', media_type: vysledek.type, data: await naBase64(vysledek) } };
  } finally { bmp.close?.(); }
}

// ---------- napojení na serverovou funkci ----------
// heslo() vrací aktuální heslo (panel ho drží v prohlížeči); fetch a pripravObrazek jdou podstrčit v testech.
export function vytvorWebSample({ endpoint = ENDPOINT, heslo = () => '', fetch: f = (...a) => globalThis.fetch(...a), pripravObrazek = obrazekProClaude, maxKol = MAX_KOL } = {}) {
  // Jedno kolo: POST na funkci, čtení NDJSON (ping/text/final/chyba). Vrací celou zprávu Claude.
  async function dotaz(telo, naText, signal) {
    const json = JSON.stringify(telo);
    if (new Blob([json]).size > MAX_TELO) throw new ChybaClaude('prompt_too_large');
    let res;
    try {
      res = await f(endpoint, {
        method: 'POST', body: json, signal,
        headers: { 'content-type': 'application/json', accept: 'application/x-ndjson', 'x-planovac-heslo': encodeURIComponent(heslo() || '') },
      });
    } catch (e) {
      if (signal?.aborted) throw new ChybaClaude('cancelled');
      throw new ChybaClaude('upstream_error', { detail: 'server plánovače neodpovídá – zkontrolujte připojení k internetu' });
    }
    if (!res.ok) {
      let j = null;
      try { j = await res.json(); } catch { /* není JSON (např. stránka chyby Vercelu) */ }
      throw chybaOdpovedi(res.status, j);
    }
    const ctenar = res.body.getReader(), dek = new TextDecoder();
    let buf = '', zprava = null;
    try {
      for (;;) {
        const { value, done } = await ctenar.read();
        if (done) break;
        buf += dek.decode(value, { stream: true });
        for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
          const radek = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
          if (!radek) continue;
          let o;
          try { o = JSON.parse(radek); } catch { continue; }
          if (o.t === 'text' && typeof o.d === 'string') naText(o.d);
          else if (o.t === 'final') zprava = o.message;
          else if (o.t === 'chyba') throw chybaOdpovedi(o.status, o);
        }
      }
    } catch (e) {
      if (signal?.aborted) throw new ChybaClaude('cancelled');
      if (e instanceof ChybaClaude) throw e;
      throw new ChybaClaude('upstream_error', { detail: 'spojení se serverem se přerušilo' });
    }
    if (signal?.aborted) throw new ChybaClaude('cancelled');
    if (!zprava || !Array.isArray(zprava.content)) throw new ChybaClaude('timeout', { detail: 'odpověď skončila dřív, než Claude dopověděl' });
    return zprava;
  }

  async function sample(vstup, opts = {}) {
    const { tools = [], signal, modelTier = 'default', onText, images = [], system } = opts;
    if (signal?.aborted) throw new ChybaClaude('cancelled');
    const zpravy = naZpravy(typeof vstup === 'string' ? [{ role: 'user', content: vstup }] : vstup);
    if (!zpravy.length) throw new ChybaClaude('invalid_request', { detail: 'prázdné zadání' });
    const obrazky = [];
    for (const img of [].concat(images || [])) obrazky.push(await pripravObrazek(img));
    pripojObrazky(zpravy, obrazky);
    const defs = tools.map((t) => ({ name: t.name, description: t.description || '', input_schema: t.inputSchema || t.input_schema || { type: 'object', properties: {} } }));
    const podleJmena = new Map(tools.map((t) => [t.name, t]));
    const usage = {};
    let hotovo = '', truncated = false, akci = 0;
    const chyba = (code, o = {}) => new ChybaClaude(code, { ...o, usage, ...(hotovo || akci ? { text: hotovo } : {}) });
    for (let kolo = 0; ; kolo++) {
      if (kolo >= maxKol) { truncated = true; break; }
      let cast = '';
      let zprava;
      try {
        zprava = await dotaz({ model: modelTier, ...(system ? { system } : {}), messages: zpravy, ...(defs.length ? { tools: defs } : {}) },
          (d) => { cast += d; onText?.({ text: spoj(hotovo, cast) }); }, signal);
      } catch (e) {
        throw e instanceof ChybaClaude ? chyba(e.code, { detail: e.detail, status: e.status }) : e;
      }
      prictiSpotrebu(usage, zprava.usage);
      if (!cast) { cast = textBloku(zprava.content); if (cast) onText?.({ text: spoj(hotovo, cast) }); }
      hotovo = spoj(hotovo, cast);
      const stop = zprava.stop_reason;
      if (stop === 'refusal') throw chyba('refused');   // nástroje odmítnuté odpovědi se nespouští
      if (stop === 'max_tokens' || stop === 'model_context_window_exceeded') { truncated = true; break; }   // vstup nástroje může být useknutý
      zpravy.push({ role: 'assistant', content: zprava.content });
      if (stop === 'pause_turn') continue;
      const volani = zprava.content.filter((b) => b?.type === 'tool_use');
      if (stop !== 'tool_use' || !volani.length) break;
      const vysledky = [];
      for (const v of volani) {
        if (signal?.aborted) throw chyba('cancelled');
        const t = podleJmena.get(v.name);
        if (!t) { vysledky.push({ type: 'tool_result', tool_use_id: v.id, is_error: true, content: `Neznámý nástroj „${v.name}“.` }); continue; }
        try {
          const r = await t.execute(v.input ?? {}, { signal });
          akci++;
          vysledky.push({ type: 'tool_result', tool_use_id: v.id, content: typeof r === 'string' ? r : JSON.stringify(r ?? null) });
        } catch (e) {
          if (signal?.aborted) throw chyba('cancelled');
          vysledky.push({ type: 'tool_result', tool_use_id: v.id, is_error: true, content: String(e?.message || e) || 'Chyba nástroje.' });
        }
      }
      if (signal?.aborted) throw chyba('cancelled');
      zpravy.push({ role: 'user', content: vysledky });
    }
    if (!hotovo.trim() && !akci && !truncated) throw chyba('empty_completion');
    return { text: hotovo, truncated, modelTierApplied: modelTier, usage };
  }

  // Je funkce na webu a má nastavený klíč i heslo? (GET bez hesla; jen jednou za načtení stránky)
  let slibStavu = null;
  async function zjistiStav() {
    try {
      const r = await f(endpoint, { method: 'GET', headers: { accept: 'application/json' } });
      if (r.status === 404) return { code: 'endpoint' };
      if (!r.ok) return { ok: false };
      const j = await r.json().catch(() => null);
      return j?.ok && j.nastaveno === false ? { code: 'konfigurace' } : { ok: true };
    } catch { return { ok: false }; }   // nevíme (offline) – neblokovat
  }
  sample.stav = () => (slibStavu ||= zjistiStav());
  sample.limits = async () => ({ tools: true, images: { maxCount: 3, mediaTypes: [...TYPY_OBRAZKU], maxInputBytes: 30 * 1024 * 1024 }, modelTiers: ['default', 'quick'] });
  sample.web = true;   // panel posílá pokyny jako system, ukazuje pole pro heslo a spotřebu
  return sample;
}
