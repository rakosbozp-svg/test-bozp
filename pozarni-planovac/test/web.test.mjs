// Claude ve webové verzi: serverová funkce api/claude.js (skutečné SDK, falešné API Anthropic) a klient js/ai/web.js
// (smyčka s nástroji v prohlížeči). Prohlížečový fetch je napojený přímo na obsluhu funkce, nic nejde do sítě.
import test from 'node:test';
import assert from 'node:assert/strict';
import Anthropic from '@anthropic-ai/sdk';
import { vytvorObsluhu, sestavParametry, popisChyby, hesloSedi, MODELY, MAX_TOKENS } from '../api/claude.js';
import { vytvorWebSample, naZpravy, pripojObrazky, odhadCeny, ChybaClaude } from '../js/ai/web.js';
import { falesneApi, obsluhaSFalesnymApi, fetchNaObsluhu } from './falesne-anthropic.mjs';

const HESLO = 'tajné heslo';
const OBR = { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'iVBORw0KGgo=' } };
function sestava({ heslo = HESLO, prostredi } = {}) {
  const api = falesneApi(), obsluha = obsluhaSFalesnymApi(api, prostredi);
  const sample = vytvorWebSample({ heslo: () => heslo, fetch: fetchNaObsluhu(obsluha), pripravObrazek: async () => OBR });
  return { api, obsluha, sample };
}
const dotaz = (obsluha, telo, { heslo = HESLO, metoda = 'POST' } = {}) => obsluha(new Request('http://planovac.test/api/claude', {
  method: metoda, headers: { 'content-type': 'application/json', 'x-planovac-heslo': encodeURIComponent(heslo) }, ...(metoda === 'POST' ? { body: typeof telo === 'string' ? telo : JSON.stringify(telo) } : {}),
}));
const radky = async (r) => (await r.text()).trim().split('\n').map((l) => JSON.parse(l));
const NASTROJ = { name: 'kresli', description: 'Kreslí', inputSchema: { type: 'object', properties: { prvky: { type: 'array' } } } };

// ---------- serverová funkce ----------
test('funkce: bez klíče nebo hesla v prostředí odmítne s „konfigurace“; GET řekne, jestli je nastavená', async () => {
  for (const prostredi of [{}, { ANTHROPIC_API_KEY: 'sk' }, { PLANOVAC_HESLO: 'x' }, { ANTHROPIC_API_KEY: ' ', PLANOVAC_HESLO: 'x' }]) {
    const o = vytvorObsluhu({ prostredi, pauzaPriChybe: 0 });
    const r = await dotaz(o, { messages: [{ role: 'user', content: 'a' }] });
    assert.equal(r.status, 503); const j = await r.json();
    assert.equal(j.kod, 'konfigurace'); assert.match(j.zprava, /ANTHROPIC_API_KEY|PLANOVAC_HESLO/);
    assert.deepEqual(await (await dotaz(o, null, { metoda: 'GET' })).json(), { ok: true, nastaveno: false });
  }
  const { obsluha } = sestava();
  assert.deepEqual(await (await dotaz(obsluha, null, { metoda: 'GET' })).json(), { ok: true, nastaveno: true });
  assert.equal((await dotaz(obsluha, null, { metoda: 'PUT' })).status, 405);
});

test('funkce: špatné nebo chybějící heslo → 401 a dotaz na Anthropic se neodešle; heslo s diakritikou a mezerou na konci projde', async () => {
  const { api, obsluha } = sestava();
  for (const h of ['', 'tajne heslo', 'tajné heslo2']) {
    const r = await dotaz(obsluha, { messages: [{ role: 'user', content: 'a' }] }, { heslo: h });
    assert.equal(r.status, 401); assert.deepEqual(await r.json(), { kod: 'heslo' });
  }
  assert.equal(api.dotazy.length, 0);
  const r = await dotaz(obsluha, { messages: [{ role: 'user', content: 'a' }] }, { heslo: 'tajné heslo ' });
  assert.equal(r.status, 200); await r.text();
  assert.equal(api.dotazy.length, 1);
  assert.ok(hesloSedi('abc', 'abc')); assert.ok(!hesloSedi('abc', 'abcd'));
});

test('funkce: ověří tělo dotazu – modely jen ze seznamu, jen vlastní nástroje, obrázky jen base64, velikost', async () => {
  const z = [{ role: 'user', content: 'Ahoj' }];
  assert.equal(sestavParametry({ messages: z }).params.model, 'claude-opus-5-5');
  assert.equal(sestavParametry({ messages: z, model: 'quick' }).params.model, 'claude-sonnet-5-5');
  assert.deepEqual(MODELY, { default: 'claude-opus-5-5', quick: 'claude-sonnet-5-5' });
  for (const [telo, re] of [
    [null, /objekt/], [[], /objekt/], [{ messages: z, model: 'claude-opus-4-1' }, /Neznámý model/], [{ messages: z, model: 'toString' }, /Neznámý model/],
    [{ messages: [] }, /neprázdné/], [{ messages: [{ role: 'system', content: 'x' }] }, /roli/],
    [{ messages: [{ role: 'user', content: [{ type: 'document', source: {} }] }] }, /Nepovolený typ/],
    [{ messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'url', url: 'https://x/y.png' } }] }] }, /base64/],
    [{ messages: z, tools: [{ type: 'web_search_20260209', name: 'web_search' }] }, /vlastní nástroje/],
    [{ messages: z, tools: [{ name: 'x' }] }, /vlastní nástroje/], [{ messages: z, system: 5 }, /system/],
    [{ messages: [{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: [{ type: 'image', source: { type: 'url', url: 'https://x/y.png' } }] }] }] }, /base64/],
    [{ messages: [{ role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: [{ type: 'document', source: {} }] }] }] }, /ve výsledku nástroje/],
  ]) assert.match(sestavParametry(telo).chyba || '', re, JSON.stringify(telo));
  const p = sestavParametry({ messages: z, system: 'Pokyny', max_tokens: 999999, temperature: 1, tools: [{ name: 'kresli', description: 'K', input_schema: { type: 'object' }, cache_control: { type: 'ephemeral' }, execute: 'x' }] }).params;
  assert.deepEqual(p, { model: 'claude-opus-5-5', max_tokens: MAX_TOKENS, messages: z, cache_control: { type: 'ephemeral' }, system: 'Pokyny', tools: [{ name: 'kresli', description: 'K', input_schema: { type: 'object' } }] }, 'jen povolená pole, max_tokens ze serveru, žádné temperature');
  const { obsluha } = sestava();
  assert.equal((await dotaz(obsluha, '{nejson')).status, 400);
  const velky = await dotaz(obsluha, { messages: [{ role: 'user', content: 'x'.repeat(4_300_000) }] });
  assert.equal(velky.status, 413); assert.equal((await velky.json()).kod, 'prompt_too_large');
});

test('funkce: odpověď streamuje jako NDJSON (ping, text, final) a do Anthropic jde ověřený dotaz se skutečným SDK', async () => {
  const { api, obsluha } = sestava();
  api.scenare.push({ premysleni: 'podpis-1', text: 'Kreslím stěny.', nastroje: [{ id: 'toolu_1', name: 'kresli', input: { prvky: [{ druh: 'stena', body: [[0, 0], [5, 0]] }] } }] });
  const r = await dotaz(obsluha, { model: 'quick', system: 'Pokyny', messages: [{ role: 'user', content: 'Nakresli' }], tools: [{ name: 'kresli', description: 'K', input_schema: { type: 'object' } }] });
  assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /ndjson/); assert.match(r.headers.get('cache-control'), /no-store/);
  const l = await radky(r);
  assert.deepEqual(l[0], { t: 'ping' });
  assert.equal(l.filter((x) => x.t === 'text').map((x) => x.d).join(''), 'Kreslím stěny.');
  const final = l.at(-1);
  assert.equal(final.t, 'final'); assert.equal(final.message.stop_reason, 'tool_use');
  assert.deepEqual(final.message.content.map((b) => b.type), ['thinking', 'text', 'tool_use']);
  assert.equal(final.message.content[0].signature, 'podpis-1');
  assert.deepEqual(final.message.content[2].input, { prvky: [{ druh: 'stena', body: [[0, 0], [5, 0]] }] });
  assert.ok(!('__json_buf' in JSON.parse(JSON.stringify(final.message.content[2]))));
  const d = api.dotazy[0];
  assert.match(d.url, /\/v1\/messages$/);
  assert.equal(d.telo.model, 'claude-sonnet-5-5'); assert.equal(d.telo.stream, true); assert.equal(d.telo.max_tokens, MAX_TOKENS);
  assert.deepEqual(d.telo.cache_control, { type: 'ephemeral' }); assert.equal(d.telo.system, 'Pokyny');
  assert.equal(d.telo.temperature, undefined); assert.equal(d.telo.thinking, undefined);
  assert.ok(Object.values(d.hlavicky).some((v) => v.includes('sk-ant-test')), 'klíč jde jen do Anthropic');
});

test('funkce: chyby API se přeloží na kódy (i uprostřed streamu); zrušení prohlížečem zruší i dotaz u Anthropic', async () => {
  for (const [status, typ, kod] of [[400, 'invalid_request_error', 'invalid_request'], [401, 'authentication_error', 'api_key'], [402, 'billing_error', 'billing'], [403, 'permission_error', 'permission'], [404, 'not_found_error', 'model'], [429, 'rate_limit_error', 'rate_limited'], [500, 'api_error', 'upstream_error'], [529, 'overloaded_error', 'overloaded']]) {
    const { api, obsluha } = sestava();
    api.scenare.push({ chyba: { status, typ, zprava: `Zpráva ${status}` } });
    const l = await radky(await dotaz(obsluha, { messages: [{ role: 'user', content: 'a' }] }));
    const ch = l.at(-1);
    assert.equal(ch.t, 'chyba'); assert.equal(ch.kod, kod, `${status}`); assert.equal(ch.status, status); assert.equal(ch.zprava, `Zpráva ${status}`); assert.equal(ch.id, 'req_test');
  }
  assert.equal(popisChyby(new Anthropic.APIUserAbortError()).kod, 'cancelled');
  assert.equal(popisChyby(new Anthropic.APIConnectionError({ message: 'x' })).kod, 'upstream_error');
  assert.equal(popisChyby(new Error('jiná')).kod, 'upstream_error');
  // zrušení: prohlížeč přeruší čtení → request.signal → SDK zruší dotaz u Anthropic
  const { api, sample } = sestava();
  api.scenare.push({ text: 'Dlouhá odpověď…', cekej: 5000 });
  const ctl = new AbortController();
  const bezi = sample([{ role: 'user', content: 'a' }], { signal: ctl.signal });
  await new Promise((r) => setTimeout(r, 150));
  ctl.abort();
  await assert.rejects(bezi, (e) => e.code === 'cancelled');
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(api.dotazy[0].zruseno, true, 'dotaz u Anthropic je zrušený');
});

// ---------- klient v prohlížeči ----------
test('klient: tahy → zprávy (prázdné pryč, stejné role spojené, začíná uživatel); obrázky před text poslední zprávy uživatele', () => {
  assert.deepEqual(naZpravy([{ role: 'assistant', content: 'úvod' }, { role: 'user', content: 'A' }, { role: 'user', content: 'B' }, { role: 'assistant', content: '  ' }, { role: 'user', content: 'C' }, { role: 'x', content: 'y' }]),
    [{ role: 'user', content: [{ type: 'text', text: 'A' }, { type: 'text', text: 'B' }, { type: 'text', text: 'C' }] }]);
  assert.deepEqual(naZpravy([{ role: 'user', content: 'A' }, { role: 'assistant', content: [{ type: 'text', text: '' }, { type: 'text', text: 'Ok' }] }, { role: 'user', content: 'B' }]).map((z) => [z.role, z.content.length]), [['user', 1], ['assistant', 1], ['user', 1]]);
  const z = pripojObrazky(naZpravy([{ role: 'user', content: 'A' }, { role: 'assistant', content: 'B' }, { role: 'user', content: 'C' }]), [OBR]);
  assert.deepEqual(z[2].content, [OBR, { type: 'text', text: 'C' }]); assert.equal(z[0].content.length, 1);
  assert.ok(Math.abs(odhadCeny({ input_tokens: 1e6, output_tokens: 1e6 }) - 24) < 1e-9);
  assert.ok(Math.abs(odhadCeny({ cache_creation_input_tokens: 1e6, cache_read_input_tokens: 1e6 }, 'quick') - 2.7) < 1e-9);
});

test('klient: smyčka s nástroji – nástroj se provede, výsledek a přemýšlení se vrátí beze změny, text přibývá po kolech', async () => {
  const { api, sample } = sestava();
  api.scenare.push(
    { premysleni: 'podpis-A', text: 'Kreslím.', nastroje: [{ id: 'toolu_1', name: 'kresli', input: { prvky: [1, 2] } }, { id: 'toolu_2', name: 'neznamy', input: {} }], usage: { input_tokens: 5000, cache_creation_input_tokens: 4000, output_tokens: 300 } },
    { nastroje: [{ id: 'toolu_3', name: 'kresli', input: { prvky: [] } }], usage: { input_tokens: 200, cache_read_input_tokens: 9000, output_tokens: 100 } },
    { text: '• Hotovo, 2 stěny.', usage: { input_tokens: 100, cache_read_input_tokens: 9500, output_tokens: 50 } },
  );
  const volani = [], texty = [];
  const kresli = { ...NASTROJ, execute: async (vstup, kx) => { volani.push(vstup); assert.ok(kx.signal); if (!vstup.prvky.length) throw new Error('Prázdné pole prvky.'); return { pridano: vstup.prvky.length, id: ['a', 'b'] }; } };
  const r = await sample([{ role: 'user', content: 'Nakresli dům' }], { tools: [kresli], modelTier: 'default', system: 'POKYNY', images: [new Blob(['x'])], signal: new AbortController().signal, onText: ({ text }) => texty.push(text) });
  assert.equal(r.text, 'Kreslím.\n\n• Hotovo, 2 stěny.'); assert.equal(r.truncated, false); assert.equal(r.modelTierApplied, 'default');
  assert.deepEqual(r.usage, { input_tokens: 5300, cache_creation_input_tokens: 4000, cache_read_input_tokens: 18500, output_tokens: 450 });
  assert.equal(texty.at(-1), r.text);
  for (let i = 1; i < texty.length; i++) assert.ok(texty[i].startsWith(texty[i - 1]), 'text jen přibývá (panel ho řeže po akcích)');
  assert.deepEqual(volani, [{ prvky: [1, 2] }, { prvky: [] }]);
  assert.equal(api.dotazy.length, 3);
  const [d1, d2, d3] = api.dotazy.map((d) => d.telo);
  assert.equal(d1.system, 'POKYNY'); assert.equal(d1.model, 'claude-opus-5-5');
  assert.deepEqual(d1.tools, [{ name: 'kresli', description: 'Kreslí', input_schema: NASTROJ.inputSchema }]);
  assert.deepEqual(d1.messages, [{ role: 'user', content: [OBR, { type: 'text', text: 'Nakresli dům' }] }]);
  assert.deepEqual(d2.messages.slice(0, 1), d1.messages, 'začátek konverzace se nemění (mezipaměť, podpisy přemýšlení)');
  assert.deepEqual(d2.messages[1].content.map((b) => b.type), ['thinking', 'text', 'tool_use', 'tool_use']);
  assert.equal(d2.messages[1].content[0].signature, 'podpis-A');
  assert.deepEqual(d2.messages[2], { role: 'user', content: [
    { type: 'tool_result', tool_use_id: 'toolu_1', content: '{"pridano":2,"id":["a","b"]}' },
    { type: 'tool_result', tool_use_id: 'toolu_2', is_error: true, content: 'Neznámý nástroj „neznamy“.' },
  ] });
  assert.deepEqual(d3.messages.slice(0, 3), d2.messages);
  assert.deepEqual(d3.messages[4].content, [{ type: 'tool_result', tool_use_id: 'toolu_3', is_error: true, content: 'Prázdné pole prvky.' }]);
});

test('klient: odmítnutí, useknutí (max_tokens), limit kol a chyby serveru → kódy pro panel; nástroje useknuté odpovědi se nespustí', async () => {
  let s = sestava(); s.api.scenare.push({ text: 'Ne.', stop: 'refusal' });
  await assert.rejects(s.sample('Nakresli', { tools: [] }), (e) => e instanceof ChybaClaude && e.code === 'refused');
  s = sestava(); s.api.scenare.push({ text: 'Kreslím', nastroje: [{ id: 't1', name: 'kresli', input: { prvky: [1] } }], stop: 'max_tokens' });
  let spusteno = 0;
  const kresli = { ...NASTROJ, execute: async () => { spusteno++; return { ok: true }; } };
  const r = await s.sample('Nakresli', { tools: [kresli] });
  assert.equal(r.truncated, true); assert.equal(spusteno, 0); assert.equal(r.text, 'Kreslím');
  s = sestava();
  const api = falesneApi(), o = obsluhaSFalesnymApi(api);
  const maly = vytvorWebSample({ heslo: () => HESLO, fetch: fetchNaObsluhu(o), maxKol: 2 });
  api.scenare.push({ nastroje: [{ id: 't1', name: 'kresli', input: { prvky: [1] } }] }, { nastroje: [{ id: 't2', name: 'kresli', input: { prvky: [2] } }] });
  const r2 = await maly('Nakresli', { tools: [kresli] });
  assert.equal(r2.truncated, true); assert.equal(spusteno, 2); assert.equal(api.dotazy.length, 2);
  s = sestava(); s.api.scenare.push({ stop: 'end_turn' });
  await assert.rejects(s.sample('Nakresli', {}), (e) => e.code === 'empty_completion');
  s = sestava(); s.api.scenare.push({ chyba: { status: 429, typ: 'rate_limit_error', zprava: 'Pomaleji' } });
  await assert.rejects(s.sample('a', {}), (e) => e.code === 'rate_limited' && e.detail === 'Pomaleji' && e.status === 429);
  s = sestava({ heslo: 'spatne' });
  await assert.rejects(s.sample('a', {}), (e) => e.code === 'heslo');
  s = sestava({ prostredi: { PLANOVAC_HESLO: HESLO } });
  await assert.rejects(s.sample('a', {}), (e) => e.code === 'konfigurace' && /ANTHROPIC_API_KEY/.test(e.detail));
  assert.deepEqual(await s.sample.stav(), { code: 'konfigurace' });
  // chyba v 2. kole: text a spotřeba z 1. kola zůstanou u chyby (panel nesmaže, co už Claude řekl)
  s = sestava(); s.api.scenare.push({ text: 'Kreslím.', nastroje: [{ id: 't1', name: 'kresli', input: { prvky: [1] } }], usage: { input_tokens: 10, output_tokens: 5 } }, { chyba: { status: 529, typ: 'overloaded_error' } });
  await assert.rejects(s.sample('a', { tools: [kresli] }), (e) => e.code === 'overloaded' && e.text === 'Kreslím.' && e.usage.output_tokens === 5);
  // příliš velký dotaz se neodešle
  s = sestava();
  await assert.rejects(s.sample('x'.repeat(4_100_000), {}), (e) => e.code === 'prompt_too_large');
  assert.equal(s.api.dotazy.length, 0);
});

test('klient: stav funkce (GET) – chybí na webu (404), není nastavená, nebo v pořádku; síťová chyba neblokuje', async () => {
  const s404 = vytvorWebSample({ fetch: async () => new Response('Not found', { status: 404 }) });
  assert.deepEqual(await s404.stav(), { code: 'endpoint' });
  await assert.rejects(s404('a', {}), (e) => e.code === 'endpoint');
  const offline = vytvorWebSample({ fetch: async () => { throw new TypeError('Failed to fetch'); } });
  assert.deepEqual(await offline.stav(), { ok: false });
  await assert.rejects(offline('a', {}), (e) => e.code === 'upstream_error');
  const { sample } = sestava();
  assert.deepEqual(await sample.stav(), { ok: true });
  const lim = await sample.limits();
  assert.equal(lim.tools, true); assert.deepEqual(lim.modelTiers, ['default', 'quick']); assert.equal(lim.images.maxCount, 3);
  assert.equal(sample.web, true);
  // přerušená odpověď (časový limit funkce: stream skončí bez „final“)
  const useknuty = vytvorWebSample({ fetch: async () => new Response('{"t":"ping"}\n{"t":"text","d":"Kres"}\n', { status: 200 }) });
  await assert.rejects(useknuty('a', {}), (e) => e.code === 'timeout');
  const vercel504 = vytvorWebSample({ fetch: async () => new Response('An error occurred', { status: 504 }) });
  await assert.rejects(vercel504('a', {}), (e) => e.code === 'timeout');
});

// ---------- nálezy revize ----------
test('funkce: klíč nikdy neodejde do prohlížeče – klíč přes dva řádky = „konfigurace“ bez klíče; jiné chyby jen obecným textem', async () => {
  const api = falesneApi();
  for (const klic of ['sk-ant-TAJNE\nDRUHA', 'sk-ant-TAJNE DRUHA', 'sk-ant-TAJNÉ']) {
    const o = obsluhaSFalesnymApi(api, { ANTHROPIC_API_KEY: klic, PLANOVAC_HESLO: HESLO });
    const r = await dotaz(o, { messages: [{ role: 'user', content: 'a' }] });
    const t = await r.text();
    assert.equal(r.status, 503); assert.equal(JSON.parse(t).kod, 'konfigurace'); assert.match(JSON.parse(t).zprava, /jeden řádek/);
    assert.ok(!t.includes('TAJN'), t);
  }
  assert.equal(api.dotazy.length, 0);
  // bez pojistky by SDK vyhodilo chybu hlavičky i s klíčem – do prohlížeče jde jen obecný text
  const ch = popisChyby(new TypeError('Headers.append: "Bearer sk-ant-TAJNE\nX" is an invalid header value.'));
  assert.deepEqual(ch, { status: 500, kod: 'upstream_error', zprava: 'Neočekávaná chyba serverové funkce.' });
  const api2 = new Anthropic.APIError(400, { error: { type: 'invalid_request_error', message: 'bad key sk-ant-api03-ABC_def-123 here' } }, 'x', new Headers());
  assert.equal(popisChyby(api2).zprava, 'bad key sk-ant-… here');
});

test('funkce: chyba uprostřed streamu (přetížení) má správný kód a spotřebu rozpracované odpovědi; po limitu odpovědi se dotaz zruší', async () => {
  const { api, obsluha } = sestava();
  api.scenare.push({ text: 'Kreslím', chybaStreamu: { typ: 'overloaded_error', zprava: 'Overloaded' }, usage: { input_tokens: 1234 } });
  const l = await radky(await dotaz(obsluha, { messages: [{ role: 'user', content: 'a' }] }));
  const ch = l.at(-1);
  assert.equal(ch.t, 'chyba'); assert.equal(ch.kod, 'overloaded'); assert.equal(ch.zprava, 'Overloaded');
  assert.equal(ch.usage.input_tokens, 1234, 'rozpracovaná odpověď se počítá do spotřeby');
  assert.equal(l.filter((x) => x.t === 'text').map((x) => x.d).join(''), 'Kreslím');
  for (const [typ, kod] of [['api_error', 'upstream_error'], ['rate_limit_error', 'rate_limited'], ['neznamy_typ', 'upstream_error']]) {
    const s = sestava(); s.api.scenare.push({ chybaStreamu: { typ } });
    assert.equal((await radky(await dotaz(s.obsluha, { messages: [{ role: 'user', content: 'a' }] }))).at(-1).kod, kod, typ);
  }
  // limit odpovědi (na Vercelu 285 s, tady 300 ms)
  const api3 = falesneApi();
  const o3 = vytvorObsluhu({ prostredi: { ANTHROPIC_API_KEY: 'sk-ant-test', PLANOVAC_HESLO: HESLO }, vytvorKlienta: (k) => new Anthropic({ apiKey: k, fetch: api3.fetch, maxRetries: 0 }), pauzaPriChybe: 0, limitMs: 300 });
  api3.scenare.push({ text: 'Dlouho…', cekej: 10_000 });
  const t0 = Date.now();
  const l3 = await radky(await dotaz(o3, { messages: [{ role: 'user', content: 'a' }] }));
  assert.ok(Date.now() - t0 < 3000);
  assert.equal(l3.at(-1).kod, 'timeout'); assert.equal(l3.at(-1).status, 504);
  assert.equal(api3.dotazy[0].zruseno, true, 'dotaz u Anthropic je po limitu zrušený');
});

test('klient: odmítnutí zahodí text; přerušené kolo nechá rozepsaný text i spotřebu; bez spotřeby (špatné heslo) žádná spotřeba', async () => {
  let s = sestava(); s.api.scenare.push({ text: 'Tohle nenakreslím, protože…', stop: 'refusal', usage: { input_tokens: 50, output_tokens: 20 } });
  await assert.rejects(s.sample('Nakresli', {}), (e) => e.code === 'refused' && e.text === undefined && e.usage.output_tokens === 20);
  s = sestava(); s.api.scenare.push({ text: 'Kreslím stěny', chybaStreamu: { typ: 'overloaded_error', zprava: 'Overloaded' }, usage: { input_tokens: 777 } });
  await assert.rejects(s.sample('Nakresli', {}), (e) => e.code === 'overloaded' && e.text === 'Kreslím stěny' && e.usage.input_tokens === 777 && e.detail === 'Overloaded');
  s = sestava({ heslo: 'spatne' });
  await assert.rejects(s.sample('a', {}), (e) => e.code === 'heslo' && e.usage === undefined && e.text === undefined);
});
