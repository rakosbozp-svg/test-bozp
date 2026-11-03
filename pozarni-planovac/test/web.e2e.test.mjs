// E2E WEBOVÉ verze (jako na Vercelu): sestavená složka web/ + skutečná serverová funkce api/claude.js se skutečným SDK
// Anthropic, jen API Anthropic je falešné (test/falesne-anthropic.mjs). Ověřuje heslo, kreslení přes /api/claude
// se smyčkou nástrojů v prohlížeči, kontrolní kolo s obrázkem listu, zmenšení fotek, spotřebu, Zastavit a chyby nastavení.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { falesneApi, obsluhaSFalesnymApi } from './falesne-anthropic.mjs';

const require = createRequire(import.meta.url);
let chromium;
for (const m of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(m)); break; } catch { /* další */ } }
const root = join(dirname(fileURLToPath(import.meta.url)), '..'), WEB = join(root, 'web');
const PORT = 8795, URL_ = `http://localhost:${PORT}/`, HESLO = 'Požár-2026 heslo';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.txt': 'text/plain', '.ttf': 'font/ttf', '.woff2': 'font/woff2' };

const prostredi = { ANTHROPIC_API_KEY: 'sk-ant-test', PLANOVAC_HESLO: HESLO };
let api = falesneApi(), srv, browser;
const obsluha = obsluhaSFalesnymApi({ fetch: (...a) => api.fetch(...a) }, prostredi);

// Node http ↔ Web Request/Response jako na Vercelu; odpojení prohlížeče zruší request.signal.
async function naFunkci(req, res, url) {
  const ctl = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ctl.abort(); });
  const kusy = []; for await (const k of req) kusy.push(k);
  const hlavicky = {};
  for (const h of ['content-type', 'accept', 'x-planovac-heslo']) if (req.headers[h]) hlavicky[h] = req.headers[h];
  const r = await obsluha(new Request(url, { method: req.method, headers: hlavicky, body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(kusy), signal: ctl.signal }));
  res.writeHead(r.status, Object.fromEntries(r.headers));
  if (r.body) {
    const ctenar = r.body.getReader();
    res.on('close', () => ctenar.cancel().catch(() => {}));
    try { for (;;) { const { value, done } = await ctenar.read(); if (done) break; res.write(value); } } catch { /* odpojeno */ }
  }
  res.end();
}

test.before(async () => {
  if (!chromium) return;
  execFileSync(process.execPath, [join(root, 'tools/sestav_web.mjs')], { cwd: root, stdio: 'ignore' });
  srv = createServer(async (req, res) => {
    const url = new URL(req.url, URL_);
    if (url.pathname === '/api/claude') return naFunkci(req, res, url);
    const cesta = normalize(join(WEB, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
    if (!cesta.startsWith(WEB + sep)) { res.writeHead(403).end(); return; }
    try { const data = await readFile(cesta); res.writeHead(200, { 'content-type': MIME[extname(cesta)] || 'application/octet-stream' }); res.end(data); } catch { res.writeHead(404).end('Not found'); }
  });
  await new Promise((ok) => srv.listen(PORT, ok));
  browser = await chromium.launch();
});
test.after(async () => { await browser?.close(); await new Promise((ok) => (srv ? srv.close(ok) : ok())); });
test.beforeEach(() => { api = falesneApi(); prostredi.ANTHROPIC_API_KEY = 'sk-ant-test'; prostredi.PLANOVAC_HESLO = HESLO; });

async function nova({ heslo } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  if (heslo) await ctx.addInitScript((h) => localStorage.setItem('pp.claude.heslo', h), heslo);
  const p = await ctx.newPage();
  p.chyby = []; p.on('pageerror', (e) => p.chyby.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/status of 40[14]/.test(m.text()) && p.chyby.push(m.text()));   // 401/404 jsou v testu záměrné
  await p.goto(URL_);
  assert.equal(await p.evaluate(() => window.__WEB__ === true && !window.claude), true, 'webová verze bez window.claude');
  await p.fill('#d-novy [name=nazev]', 'Web AI'); await p.click('#d-novy button'); await p.waitForSelector('.editor');
  await p.selectOption('#l-typ', 'pudorys'); await p.click('#l-pridej');
  await p.waitForSelector('.dlg[open]'); await p.fill('.dlg input[name=hodnota]', 'Půdorys web'); await p.click('.dlg [data-vysledek=ok]');
  await p.waitForSelector('#svet', { state: 'attached' });
  p.klid = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  p.pocet = async (druh) => { await p.klid(); return p.locator(`#svet [data-druh=${druh}]`).count(); };
  p.hotovo = () => p.waitForFunction(() => document.querySelector('[data-ai-stop]')?.hidden === true && !document.querySelector('[data-ai-spust]').disabled && !document.querySelector('.ed-zamek:not([hidden])'), null, { timeout: 20000 });
  p.log = () => p.locator('[data-ai-log]').innerText();
  p.panel = async () => { await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel'); };
  return p;
}
const skip = { skip: !chromium && 'Playwright není dostupný' };
const PUDORYS = [
  { druh: 'stena', body: [[2, 2], [14, 2], [14, 10], [2, 10], [2, 2]], tloustka_m: 0.4 },
  { druh: 'stena', body: [[8, 2], [8, 10]], tloustka_m: 0.12 },
  { druh: 'dvere', x: 5, y: 10, sirka: 1.2 },
  { druh: 'trasa', body: [[11, 6], [8, 6], [5, 8], [5, 11]] },
  { druh: 'text', x: 3, y: 4, text: 'Kancelář' },
];
const bloky = (telo, typ) => telo.messages.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((b) => b.type === typ);

test('web: heslo, kreslení přes /api/claude (skutečné SDK), smyčka nástrojů v prohlížeči, kontrolní kolo s obrázkem listu, spotřeba', skip, async () => {
  const p = await nova();
  await p.panel();
  await p.waitForFunction(() => document.querySelector('[data-ai-heslo]') && !document.querySelector('[data-ai-spust]').disabled);
  assert.equal(await p.locator('[data-ai-stav]').isVisible(), false, 'funkce je nastavená (GET)');
  assert.deepEqual(await p.locator('[data-ai-model] option').evaluateAll((o) => o.map((x) => `${x.value}:${x.textContent}`)),
    ['default:Claude Opus 5.5 (doporučeno)', 'quick:Claude Sonnet 5.5 – rychlejší, levnější']);
  assert.equal(await p.locator('[data-ai-heslo]').isVisible(), true);
  // bez hesla formulář neodešle (required) a nic nejde na server
  await p.fill('[data-ai-zadani]', 'Nakresli kancelář.'); await p.click('[data-ai-spust]');
  await p.waitForTimeout(300);
  assert.equal(api.dotazy.length, 0);
  api.scenare.push(
    { premysleni: 'podpis-1', text: 'Kreslím půdorys kanceláře.', nastroje: [{ id: 'toolu_1', name: 'kresli', input: { prvky: PUDORYS } }], usage: { input_tokens: 9000, cache_creation_input_tokens: 0, output_tokens: 1200 } },
    { text: '• Nakreslil jsem kancelář 12 × 8 m.', usage: { input_tokens: 300, cache_read_input_tokens: 9000, output_tokens: 80 } },
    { text: '• Výkres je v pořádku.', usage: { input_tokens: 2500, cache_read_input_tokens: 7000, output_tokens: 60 } },
  );
  await p.fill('[data-ai-heslo]', HESLO);
  await p.click('[data-ai-spust]');
  await p.hotovo();
  assert.equal(await p.pocet('stena'), 2); assert.equal(await p.pocet('dvere'), 1); assert.equal(await p.pocet('trasa'), 1); assert.equal(await p.pocet('text'), 1);
  assert.equal(api.dotazy.length, 3, 'kolo s nástrojem + závěr + kontrolní kolo');
  const [d1, d2, d3] = api.dotazy.map((d) => d.telo);
  assert.equal(d1.model, 'claude-opus-5-5'); assert.equal(d1.stream, true); assert.deepEqual(d1.cache_control, { type: 'ephemeral' });
  assert.match(d1.system, /PRAVDIVOST/, 'pokyny jdou jako system');
  assert.deepEqual(d1.tools.map((t) => t.name), ['kresli', 'uprav', 'smaz', 'nastav_list', 'precti_vykres']);
  assert.ok(d1.tools.every((t) => t.input_schema?.type === 'object' && !('execute' in t)));
  assert.equal(d1.messages.length, 1); assert.match(bloky(d1, 'text')[0].text, /STAV LISTU:[\s\S]*ZADÁNÍ UŽIVATELE:\nNakresli kancelář\./);
  assert.equal(bloky(d1, 'image').length, 0, 'prázdný list: žádný obrázek');
  assert.equal(bloky(d2, 'thinking')[0].signature, 'podpis-1', 'přemýšlení se vrací beze změny');
  const vysledek = JSON.parse(bloky(d2, 'tool_result')[0].content);
  assert.equal(vysledek.pridano, 5); assert.equal(bloky(d2, 'tool_result')[0].tool_use_id, 'toolu_1');
  const obr = bloky(d3, 'image');
  assert.equal(obr.length, 1, 'kontrolní kolo posílá obrázek listu'); assert.equal(obr[0].source.media_type, 'image/png');
  const png = Buffer.from(obr[0].source.data, 'base64');
  assert.ok(png.length > 5000 && png.length < 700_000, `obrázek listu ${png.length} B`);
  assert.ok(Math.max(png.readUInt32BE(16), png.readUInt32BE(20)) <= 1568, 'delší strana nejvýš 1568 px');
  assert.match(bloky(d3, 'text').at(-1).text, /KONTROLNÍ KOLO/);
  assert.equal(api.dotazy[0].hlavicky['x-planovac-heslo'], undefined, 'heslo nejde do Anthropic');
  const log = await p.log();
  for (const t of ['Nakresli kancelář.', 'Kreslím půdorys kanceláře.', 'Nakresleno: stěny 2, dveře 1, únikové cesty 1, popisky 1', 'Nakreslil jsem kancelář 12 × 8 m.', 'Kontrola: Claude se dívá', 'Výkres je v pořádku.', 'Spotřeba Claude: vstup', 'USD']) assert.ok(log.includes(t), `log obsahuje „${t}“:\n${log}`);
  // heslo uložené v prohlížeči, pole se schová; jeden krok Zpět vrátí celý zásah
  assert.equal(await p.evaluate(() => localStorage.getItem('pp.claude.heslo')), HESLO);
  assert.equal(await p.locator('[data-ai-heslo]').isVisible(), false);
  assert.equal(await p.locator('[data-ai-heslo-ulozene]').isVisible(), true);
  await p.click('[data-akce=zpet]'); assert.equal(await p.pocet('stena'), 0);
  // navazující zadání s modelem Sonnet: historie konverzace, obrázek listu už v prvním kole
  api.scenare.push({ text: '• Hotovo.' }, { text: '• V pořádku.' });
  await p.click('[data-akce=vpred]'); await p.selectOption('[data-ai-model]', 'quick');
  await p.fill('[data-ai-zadani]', 'Přidej popisek Sklad.'); await p.click('[data-ai-spust]'); await p.hotovo();
  const d4 = api.dotazy[3].telo;
  assert.equal(d4.model, 'claude-sonnet-5-5');
  assert.deepEqual(d4.messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.match(d4.messages[1].content[0].text, /Nakreslil jsem kancelář/);
  assert.equal(bloky(d4, 'image').length, 1);
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('web: fotka se před odesláním zmenší (PNG zůstane PNG, velká fotka jde jako JPEG)', skip, async () => {
  const p = await nova({ heslo: HESLO });
  await p.panel();
  await p.waitForFunction(() => !document.querySelector('[data-ai-spust]').disabled);
  const obrazek = (w, h, sum) => p.evaluate(([w, h, sum]) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    if (sum) { const d = g.createImageData(w, h); for (let i = 0; i < d.data.length; i++) d.data[i] = (i % 4 === 3) ? 255 : Math.random() * 255; g.putImageData(d, 0, 0); }
    else { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#000'; g.lineWidth = 8; g.strokeRect(100, 100, w - 200, h - 200); }
    return c.toDataURL('image/png').split(',')[1];
  }, [w, h, sum]);
  await p.setInputFiles('[data-ai-soubor]', [
    { name: 'skica.png', mimeType: 'image/png', buffer: Buffer.from(await obrazek(2400, 1600, false), 'base64') },
    { name: 'fotka.png', mimeType: 'image/png', buffer: Buffer.from(await obrazek(1400, 1000, true), 'base64') },
  ]);
  await p.waitForFunction(() => document.querySelectorAll('.ai-priloha').length === 2);
  api.scenare.push({ text: '• Hotovo.' });
  await p.uncheck('[data-ai-volba=kontrola]');
  await p.fill('[data-ai-zadani]', 'Nakresli podle skici.'); await p.click('[data-ai-spust]'); await p.hotovo();
  const obr = bloky(api.dotazy[0].telo, 'image');
  assert.equal(obr.length, 2);
  assert.equal(obr[0].source.media_type, 'image/png');
  const png = Buffer.from(obr[0].source.data, 'base64');
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1568, 1045], 'skica zmenšená na 1568 px');
  assert.equal(obr[1].source.media_type, 'image/jpeg', 'šum v PNG je velký → JPEG');
  assert.ok(Buffer.from(obr[1].source.data, 'base64').length <= 700_000);
  assert.match(bloky(api.dotazy[0].telo, 'text')[0].text, /1\) příloha od uživatele „skica\.png“[\s\S]*2\) příloha od uživatele „fotka\.png“/);
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('web: špatné heslo se zapomene a zadání se vrátí do pole; Zastavit zruší i dotaz u Anthropic', skip, async () => {
  const p = await nova({ heslo: 'staré heslo' });
  await p.panel();
  await p.waitForFunction(() => !document.querySelector('[data-ai-spust]').disabled);
  assert.equal(await p.locator('[data-ai-heslo]').isVisible(), false, 'uložené heslo → pole schované');
  await p.fill('[data-ai-zadani]', 'Nakresli sklad.'); await p.click('[data-ai-spust]'); await p.hotovo();
  assert.equal(api.dotazy.length, 0, 'se špatným heslem nic nejde do Anthropic');
  assert.match(await p.log(), /Heslo ke Claude nesouhlasí/);
  assert.ok(!(await p.log()).includes('Spotřeba'), 'nic se neplatilo → žádný řádek o spotřebě');
  assert.equal(await p.evaluate(() => localStorage.getItem('pp.claude.heslo')), null);
  assert.equal(await p.locator('[data-ai-heslo]').isVisible(), true);
  assert.equal(await p.inputValue('[data-ai-zadani]'), 'Nakresli sklad.', 'zadání je zpět v poli');
  // správné heslo + Zastavit během dlouhé odpovědi
  api.scenare.push({ text: 'Přemýšlím o skladu…', cekej: 8000 });
  await p.fill('[data-ai-heslo]', HESLO); await p.click('[data-ai-spust]');
  await p.waitForFunction(() => document.querySelector('[data-ai-log]').innerText.includes('Přemýšlím o skladu'));
  await p.click('[data-ai-stop]'); await p.hotovo();
  assert.match(await p.log(), /Zastaveno – Claude ve výkresu nic nezměnil/);
  await p.waitForFunction(() => true);
  for (let i = 0; i < 20 && !api.dotazy[0]?.zruseno; i++) await p.waitForTimeout(100);
  assert.equal(api.dotazy[0].zruseno, true, 'dotaz u Anthropic je zrušený (neplatí se dál)');
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('web: bez API klíče na serveru panel hned řekne, co nastavit; chyba API se ukáže i s podrobností', skip, async () => {
  prostredi.ANTHROPIC_API_KEY = '';
  const p = await nova({ heslo: HESLO });
  await p.panel();
  await p.waitForFunction(() => document.querySelector('[data-ai-stav]').textContent.includes('ANTHROPIC_API_KEY a PLANOVAC_HESLO'));
  assert.equal(await p.locator('[data-ai-spust]').isDisabled(), true);
  await p.context().close();
  prostredi.ANTHROPIC_API_KEY = 'sk-ant-test';
  const q = await nova({ heslo: HESLO });
  await q.panel();
  await q.waitForFunction(() => !document.querySelector('[data-ai-spust]').disabled);
  api.scenare.push({ chyba: { status: 400, typ: 'invalid_request_error', zprava: 'Your credit balance is too low to access the Anthropic API.' } });
  await q.fill('[data-ai-zadani]', 'Nakresli.'); await q.click('[data-ai-spust]'); await q.hotovo();
  assert.match(await q.log(), /Dotaz na Claude byl neplatný \(chyba aplikace\)\. \(Your credit balance is too low/);
  assert.equal(await q.locator('[data-ai-spust]').isDisabled(), false, 'neplatný dotaz není trvalá chyba');
  assert.deepEqual(q.chyby, []);
  await q.context().close();
});
