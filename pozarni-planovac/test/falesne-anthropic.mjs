// Falešné API Anthropic pro testy webové verze: SKUTEČNÉ SDK @anthropic-ai/sdk (v api/claude.js) dostane podstrčený
// fetch, který místo sítě odpovídá streamem SSE podle připravených scénářů a zaznamenává dotazy. Nic nejde do sítě.
// Scénář: { text, nastroje: [{ id, name, input }], premysleni: 'podpis', stop, cekej (ms před koncem), chyba: { status, typ, zprava } }
import Anthropic from '@anthropic-ai/sdk';
import { vytvorObsluhu } from '../api/claude.js';

const kusy = (s, n = 7) => { const out = []; for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n)); return out; };

export function udalostiSse(sc, telo, cislo) {
  const ev = [], u = sc.usage || {};
  ev.push({ type: 'message_start', message: { id: `msg_${cislo}`, type: 'message', role: 'assistant', model: telo.model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: u.input_tokens ?? 1000, output_tokens: 1, cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0, cache_read_input_tokens: u.cache_read_input_tokens ?? 0 } } });
  let i = 0;
  if (sc.premysleni) {
    ev.push({ type: 'content_block_start', index: i, content_block: { type: 'thinking', thinking: '', signature: '' } });
    ev.push({ type: 'content_block_delta', index: i, delta: { type: 'signature_delta', signature: sc.premysleni } });
    ev.push({ type: 'content_block_stop', index: i }); i++;
  }
  if (sc.text) {
    ev.push({ type: 'content_block_start', index: i, content_block: { type: 'text', text: '' } });
    for (const k of kusy(sc.text)) ev.push({ type: 'content_block_delta', index: i, delta: { type: 'text_delta', text: k } });
    ev.push({ type: 'content_block_stop', index: i }); i++;
  }
  for (const n of sc.nastroje || []) {
    ev.push({ type: 'content_block_start', index: i, content_block: { type: 'tool_use', id: n.id, name: n.name, input: {} } });
    for (const k of kusy(JSON.stringify(n.input), 40)) ev.push({ type: 'content_block_delta', index: i, delta: { type: 'input_json_delta', partial_json: k } });
    ev.push({ type: 'content_block_stop', index: i }); i++;
  }
  ev.push({ type: 'message_delta', delta: { stop_reason: sc.stop || (sc.nastroje?.length ? 'tool_use' : 'end_turn'), stop_sequence: null }, usage: { output_tokens: u.output_tokens ?? 200 } });
  ev.push({ type: 'message_stop' });
  return ev;
}

export function falesneApi() {
  const dotazy = [], scenare = [];
  let cislo = 0;
  async function fetch(url, init = {}) {
    const telo = JSON.parse(init.body);
    dotazy.push({ url: String(url), telo, hlavicky: Object.fromEntries(new Headers(init.headers).entries()), zruseno: false });
    const zaznam = dotazy.at(-1), sc = scenare.shift() || { text: 'Hotovo.' }, signal = init.signal;
    signal?.addEventListener('abort', () => { zaznam.zruseno = true; });
    if (sc.chyba) {
      return new Response(JSON.stringify({ type: 'error', error: { type: sc.chyba.typ, message: sc.chyba.zprava || 'chyba' }, request_id: 'req_test' }),
        { status: sc.chyba.status, headers: { 'content-type': 'application/json', 'request-id': 'req_test' } });
    }
    const ev = udalostiSse(sc, telo, ++cislo), enc = new TextEncoder();
    const body = new ReadableStream({
      async start(ctl) {
        const pis = (e) => ctl.enqueue(enc.encode(`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`));
        const konec = ev.length - 2;   // message_delta + message_stop až po čekání
        try {
          for (let k = 0; k < konec; k++) pis(ev[k]);
          if (sc.cekej) {
            await new Promise((ok, ko) => {
              const t = setTimeout(ok, sc.cekej);
              signal?.addEventListener('abort', () => { clearTimeout(t); ko(new DOMException('Zrušeno', 'AbortError')); });
            });
          }
          for (let k = konec; k < ev.length; k++) pis(ev[k]);
          ctl.close();
        } catch (e) { ctl.error(e); }
      },
    });
    return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
  }
  return { fetch, dotazy, scenare };
}

// Obsluha /api/claude se skutečným SDK napojeným na falešné API.
export function obsluhaSFalesnymApi(api, prostredi = { ANTHROPIC_API_KEY: 'sk-ant-test', PLANOVAC_HESLO: 'tajné heslo' }) {
  return vytvorObsluhu({ prostredi, vytvorKlienta: (apiKey) => new Anthropic({ apiKey, fetch: api.fetch, maxRetries: 0 }), pauzaPriChybe: 0 });
}

// fetch prohlížeče → obsluha v témže procesu (zrušení signálem přeruší čtení odpovědi jako u skutečného fetch).
export function fetchNaObsluhu(obsluha, zaklad = 'http://planovac.test') {
  return async (url, init = {}) => {
    const r = await obsluha(new Request(new URL(url, zaklad), init));
    if (!r.body || !init.signal) return r;
    const ctenar = r.body.getReader(), signal = init.signal;
    const body = new ReadableStream({
      async pull(ctl) {
        if (signal.aborted) { ctenar.cancel().catch(() => {}); ctl.error(new DOMException('Zrušeno', 'AbortError')); return; }
        const zruseni = new Promise((_, ko) => signal.addEventListener('abort', () => ko(new DOMException('Zrušeno', 'AbortError')), { once: true }));
        try {
          const { value, done } = await Promise.race([ctenar.read(), zruseni]);
          if (done) ctl.close(); else ctl.enqueue(value);
        } catch (e) { ctenar.cancel().catch(() => {}); ctl.error(e); }
      },
      cancel() { return ctenar.cancel(); },
    });
    return new Response(body, { status: r.status, headers: r.headers });
  };
}
