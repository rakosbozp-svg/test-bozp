// E2E panelu Claude v Chromiu. Skutečné window.claude (claude.ai) tu není, proto ho test podstrčí: simulovaný `sample`
// přehrává připravené scénáře – posílá text (onText), volá SKUTEČNÉ nástroje stránky (execute) a vrací odpověď.
// Ověřuje se celé napojení: kreslení přes nástroje, jeden krok Zpět, obrázky pro Claude, kontrolní kolo, chyby, Zastavit,
// přizpůsobení rámu, evakuační plán a chování bez Claude (soubor z disku). Webovou verzi (/api/claude) testuje web.e2e.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
for (const m of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(m)); break; } catch { /* další */ } }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8794, URL_ = `http://localhost:${PORT}/index.html`;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

let srv, browser;
test.before(async () => {
  if (!chromium) return;
  srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  browser = await chromium.launch();
});
test.after(async () => { await browser?.close(); srv?.kill(); });

// Simulace schopnosti „sample“ podle typů platformy (window.claude.use('sample'), limits, onText, tools[].execute, signal).
function simulaceClaude({ obrazky = true, stahovani = false } = {}) {
  const log = window.__ai = { volani: [], vysledky: [], scenare: [], ulozeno: [], odmitnout: false, pokusy: [], chybaUlozeni: null, opravneni: 'granted', manage: 0 };
  const cekej = (ms, signal) => new Promise((ok, ko) => {
    const t = setTimeout(ok, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); ko({ code: 'cancelled', message: 'aborted' }); });
  });
  const sample = async (input, opts = {}) => {
    const sc = log.scenare.shift() || { kroky: [], konec: '• Hotovo.' };
    const zaznam = { input: JSON.parse(JSON.stringify(input)), obrazky: [], nastroje: (opts.tools || []).map((t) => ({ name: t.name, schema: t.inputSchema })), modelTier: opts.modelTier, cache: opts.cache };
    log.volani.push(zaznam);
    zaznam.obrazky = await Promise.all([].concat(opts.images || []).map(async (b) => { let w = 0, h = 0; try { const bm = await createImageBitmap(b); w = bm.width; h = bm.height; } catch { /* nečitelné */ } return { typ: b.type, velikost: b.size, w, h }; }));
    if (opts.signal?.aborted) throw { code: 'cancelled', message: 'aborted' };
    let text = '';
    const pis = (t) => { text += (text ? '\n\n' : '') + t; opts.onText?.({ text, delta: t }); };
    for (const k of sc.kroky || []) {
      if (k.text) pis(k.text);
      for (const n of k.nastroje || []) {
        const t = opts.tools.find((x) => x.name === n.name);
        try { log.vysledky.push({ nastroj: n.name, vysledek: await t.execute(n.input, { signal: opts.signal }) }); } catch (e) { log.vysledky.push({ nastroj: n.name, chyba: e.message }); }
      }
      if (k.cekej) await cekej(k.cekej, opts.signal);
    }
    if (sc.chyba) throw sc.chyba;
    if (opts.signal?.aborted) throw { code: 'cancelled', message: 'aborted' };
    pis(sc.konec || '• Hotovo.');
    return { text, truncated: false, modelTierApplied: sc.tier || opts.modelTier || 'default' };
  };
  sample.limits = async () => ({ maxPromptBytes: 262144, tools: { maxCount: 16 }, ...(obrazky ? { images: { maxCount: 5, maxInputBytes: 20e6, mediaTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] } } : {}), modelTiers: ['default', 'complex', 'quick'] });
  // schopnost „downloads“: save({filename, data}) – zaznamená soubor; s log.odmitnout uživatel uložení odmítne
  // s log.chybaUlozeni save() odmítne s tímto kódem (jako claude.ai); „permissions“: stav oprávnění a panel Oprávnění (manage)
  const dl = { save: async ({ filename, data }) => {
    if (log.chybaUlozeni) { log.pokusy.push({ filename, kod: log.chybaUlozeni }); throw { code: log.chybaUlozeni, message: 'simulace' }; }
    const text = typeof data === 'string' ? data : await data.text(); log.ulozeno.push({ filename, text, velikost: data.size ?? text.length }); if (log.odmitnout) throw { code: 'declined', message: 'x' }; return { status: 'saved' };
  } };
  const prava = { state: async () => log.opravneni, request: async () => ({}), manage: async () => { log.manage++; if ('poManage' in log) log.chybaUlozeni = log.poManage; } };
  window.claude = { use: async (n) => (n === 'sample' ? sample : n === 'downloads' && stahovani ? dl : n === 'permissions' ? prava : null) };
}

async function nova({ claude = true, obrazky = true, evak = false, stahovani = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  if (claude) await ctx.addInitScript(simulaceClaude, { obrazky, stahovani });
  const p = await ctx.newPage();
  p.chyby = []; p.on('pageerror', (e) => p.chyby.push(e.message)); p.on('console', (m) => m.type() === 'error' && p.chyby.push(m.text()));
  await p.goto(evak ? `${URL_}#/evakuace` : URL_);
  await p.fill('#d-novy [name=nazev]', evak ? 'Evakuace AI' : 'AI test'); await p.click('#d-novy button'); await p.waitForSelector('.editor');
  if (evak) { await p.click('#listy li:nth-child(2) a'); }
  else {
    await p.selectOption('#l-typ', 'pudorys'); await p.click('#l-pridej');
    await p.waitForSelector('.dlg[open]'); await p.fill('.dlg input[name=hodnota]', 'Půdorys AI'); await p.click('.dlg [data-vysledek=ok]');
  }
  await p.waitForSelector('#svet', { state: 'attached' });   // prázdný list: skupina světa nemá rozměr
  p.klid = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  p.pocet = async (druh) => { await p.klid(); return p.locator(`#svet [data-druh=${druh}]`).count(); };
  p.scenare = (s) => p.evaluate((x) => window.__ai.scenare.push(...x), s);
  p.ai = () => p.evaluate(() => window.__ai);
  p.zadej = async (t) => { await p.fill('[data-ai-zadani]', t); await p.click('[data-ai-spust]'); };
  p.hotovo = () => p.waitForFunction(() => document.querySelector('[data-ai-stop]')?.hidden === true && document.querySelector('[data-ai-spust]') && !document.querySelector('[data-ai-spust]').disabled, null, { timeout: 15000 });
  p.log = () => p.locator('[data-ai-log]').innerText();
  p.klikSvet = async (x, y) => { const [sx, sy] = await p.evaluate(([a, b]) => { const m = document.querySelector('#svet').getScreenCTM(), q = new DOMPoint(a, b).matrixTransform(m); return [q.x, q.y]; }, [x, y]); await p.mouse.click(sx, sy); };
  p.dlgOk = async (text) => { await p.waitForSelector('.dlg[open]'); if (text !== undefined) await p.fill('.dlg input[name=hodnota]', text); await p.click('.dlg [data-vysledek=ok]'); await p.waitForSelector('.dlg', { state: 'detached' }); };
  return p;
}
const skip = { skip: !chromium && 'Playwright není dostupný' };

const PUDORYS = [
  { druh: 'stena', body: [[2, 2], [14, 2], [14, 10], [2, 10], [2, 2]], tloustka_m: 0.4 },
  { druh: 'stena', body: [[8, 2], [8, 10]], tloustka_m: 0.12 },
  { druh: 'dvere', x: 5, y: 10, sirka: 1.2 },
  { druh: 'dvere', x: 8, y: 6 },
  { druh: 'trasa', body: [[11, 6], [8, 6], [5, 8], [5, 11]] },
  { druh: 'text', x: 3, y: 4, text: 'Kancelář' }, { druh: 'text', x: 9, y: 4, text: 'Sklad' },
  { druh: 'znacka', x: 13, y: 9, znacka: 'DZP-007' },
];

test('kreslení podle zadání s fotkou: nástroje kreslí, kontrolní kolo s obrázkem listu, jeden krok Zpět, neověřené měřítko', skip, async () => {
  const p = await nova();
  await p.click('[data-p=claude]');
  await p.waitForSelector('.ai-panel');
  assert.equal(await p.locator('[data-p]').evaluateAll((b) => b.map((x) => x.dataset.p).join(',')), 'vlastnosti,vrstvy,claude,uplnost,metodika,projekt');
  await p.waitForFunction(() => !document.querySelector('[data-ai-stav]').textContent);
  await p.setInputFiles('[data-ai-soubor]', { name: 'dum.png', mimeType: 'image/png', buffer: PNG });
  await p.waitForSelector('.ai-priloha');
  await p.scenare([
    { kroky: [{ text: 'Kreslím půdorys podle fotky.', nastroje: [{ name: 'kresli', input: { prvky: PUDORYS } }] }], konec: '• Nakreslil jsem 2 místnosti.\n• Rozměry 12 × 8 m jsou odhad.' },
    { kroky: [{ text: 'Posunu popisek skladu.', nastroje: [{ name: 'uprav', input: { zmeny: [{ id: '__TEXT__', posun: [0.5, 0] }] } }] }], konec: '• Opraven popisek.' },
  ]);
  // id popisku pro kontrolní kolo dosadí stránka až po prvním kole (simulace čte stav listu ze zadání jako Claude)
  await p.evaluate(() => { const sc = window.__ai.scenare[1]; const orig = sc.kroky[0].nastroje[0]; Object.defineProperty(orig, 'input', { get: () => ({ zmeny: [{ id: [...document.querySelectorAll('#svet [data-druh=text]')].at(-1)?.dataset.id, posun: [0.5, 0] }] }) }); });
  await p.zadej('Nakresli půdorys domu podle fotky, popiš místnosti a vyznač únikovou cestu.');
  await p.hotovo();
  assert.equal(await p.pocet('stena'), 2); assert.equal(await p.pocet('dvere'), 2); assert.equal(await p.pocet('trasa'), 1);
  assert.equal(await p.pocet('text'), 2); assert.equal(await p.pocet('znacka'), 1);
  const ai = await p.ai();
  assert.equal(ai.volani.length, 2, 'první kolo + kontrolní kolo');
  const [v1, v2] = ai.volani;
  assert.deepEqual(v1.nastroje.map((t) => t.name), ['kresli', 'uprav', 'smaz', 'nastav_list', 'precti_vykres']);
  assert.equal(v1.cache, undefined, 'volání s nástroji nesmí mít cache');
  assert.equal(v1.modelTier, 'default');
  assert.deepEqual(v1.obrazky.map((o) => o.typ), ['image/png'], 'prázdný list: jen příloha, bez obrázku listu');
  const zadani1 = v1.input.at(-1).content;
  assert.match(v1.input[0].content, /PRAVDIVOST/); assert.match(v1.input[0].content, /DZP-007 Nástěnný požární hydrant/);
  assert.match(zadani1, /PŘILOŽENÉ OBRÁZKY:\n1\) příloha od uživatele „dum\.png“/);
  assert.match(zadani1, /STAV LISTU:\nList „Půdorys AI“ \(půdorys, DZP\)/); assert.match(zadani1, /list je prázdný/);
  assert.match(zadani1, /ZADÁNÍ UŽIVATELE:\nNakresli půdorys domu/);
  assert.equal(v2.obrazky.length, 2, 'kontrola: obrázek výsledku + příloha');
  assert.equal(v2.obrazky[0].typ, 'image/png'); assert.ok(v2.obrazky[0].velikost > 5000, `obrázek listu má ${v2.obrazky[0].velikost} B`);
  assert.match(v2.input.at(-1).content, /KONTROLNÍ KOLO/); assert.match(v2.input.at(-1).content, /"text":"Kancelář"/);
  assert.equal(ai.vysledky[1].vysledek.upraveno, 1, 'kontrolní kolo opravilo prvek');
  const dvere = await p.evaluate(() => window.__ai.vysledky[0].vysledek);
  assert.equal(dvere.pridano, 8); assert.equal(dvere.chyby, undefined);
  const log = await p.log();
  for (const t of ['Nakresli půdorys domu', 'Kreslím půdorys podle fotky.', 'Nakresleno: stěny 2, dveře 2, únikové cesty 1, popisky 2, značky 1', 'Rozměry 12 × 8 m jsou odhad', 'Kontrola: Claude se dívá', 'Upraveno prvků: 1', 'Opraven popisek', 'měřítko neověřeno']) assert.ok(log.includes(t), `log obsahuje „${t}“:\n${log}`);
  // rozměry z fotky: list označen jako neověřený (razítko i kontrola úplnosti), dveře připojené ke stěnám
  assert.match(await p.locator('.ed-svg svg').innerHTML(), /MĚŘÍTKO NEOVĚŘENO/);
  // celý zásah = jeden krok Zpět a Znovu
  await p.click('[data-akce=zpet]');
  assert.equal(await p.pocet('stena'), 0); assert.equal(await p.pocet('text'), 0);
  assert.doesNotMatch(await p.locator('.ed-svg svg').innerHTML(), /MĚŘÍTKO NEOVĚŘENO/);
  await p.click('[data-akce=vpred]'); assert.equal(await p.pocet('stena'), 2);
  // tlačítko „Vrátit změny od Claude“ (stav po zásahu je stále poslední)
  assert.equal(await p.locator('[data-ai-vratit]').isDisabled(), false);
  await p.click('[data-ai-vratit]'); assert.equal(await p.pocet('stena'), 0);
  assert.equal(await p.locator('[data-ai-vratit]').isDisabled(), true);
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('navazující zadání: obrázek listu se posílá, historie konverzace, přepnutí záložky panelu zachová log i rozepsané zadání', skip, async () => {
  const p = await nova();
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  await p.scenare([{ kroky: [{ nastroje: [{ name: 'kresli', input: { prvky: PUDORYS.slice(0, 2) } }] }], konec: '• Stěny hotové.' }]);
  await p.click('[data-ai-volba=kontrola]');   // bez kontrolního kola
  await p.zadej('Nakresli dvě místnosti.'); await p.hotovo();
  assert.equal((await p.ai()).volani.length, 1);
  await p.scenare([{ kroky: [{ nastroje: [{ name: 'kresli', input: { prvky: [{ druh: 'text', x: 3, y: 4, text: 'Kuchyň' }] } }] }], konec: '• Popisek přidán.' }]);
  await p.zadej('Přidej popisek Kuchyň.'); await p.hotovo();
  const v2 = (await p.ai()).volani[1];
  assert.deepEqual(v2.obrazky.map((o) => o.typ), ['image/png'], 'neprázdný list: posílá se obrázek listu s mřížkou');
  assert.match(v2.input.at(-1).content, /1\) kreslicí plocha aktuálního listu s purpurovou souřadnicovou mřížkou/);
  assert.deepEqual(v2.input.map((t) => t.role), ['user', 'user', 'assistant', 'user'], 'pokyny, předchozí zadání a odpověď, nové zadání');
  assert.match(v2.input[2].content, /Stěny hotové/);
  // přepnutí záložky panelu: konverzace i rozepsané zadání zůstanou
  await p.fill('[data-ai-zadani]', 'rozepsané');
  await p.click('[data-p=vlastnosti]'); await p.click('[data-p=claude]');
  assert.equal(await p.inputValue('[data-ai-zadani]'), 'rozepsané');
  assert.ok((await p.log()).includes('Popisek přidán'));
  // Nová konverzace zapomene historii
  await p.click('[data-ai-nova]');
  assert.ok((await p.log()).includes('Zatím žádná konverzace'));
  await p.scenare([{ kroky: [], konec: '• Nic.' }]);
  await p.zadej('Jen odpověz.'); await p.hotovo();
  assert.deepEqual((await p.ai()).volani[2].input.map((t) => t.role), ['user', 'user']);
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('chyby platformy: srozumitelná hláška; trvalé odmítnutí vypne tlačítko; chybné prvky se Claude vrátí', skip, async () => {
  const p = await nova();
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  await p.scenare([{ kroky: [{ text: 'Zkouším.' }], chyba: { code: 'rate_limited', message: 'x', text: 'Zkouším.' } }]);
  await p.zadej('Cokoli.'); await p.hotovo();
  assert.ok((await p.log()).includes('vyčerpaný limit'));
  assert.ok((await p.log()).includes('Zkouším.'), 'text, který smí zůstat (e.text), zůstane');
  await p.scenare([{ kroky: [{ text: 'Tohle bude stažené.' }], chyba: { code: 'refused', message: 'x' } }]);
  await p.zadej('Odmítni.'); await p.hotovo();
  assert.ok(!(await p.log()).includes('Tohle bude stažené.'), 'bez e.text se rozepsaný text stáhne');
  assert.ok((await p.log()).includes('Claude tento požadavek odmítl'));
  await p.scenare([{ kroky: [{ nastroje: [{ name: 'kresli', input: { prvky: [{ druh: 'znacka', x: 1, y: 1, znacka: 'NEEXISTUJE' }, { druh: 'stena', body: [[1, 1], [5, 1]] }] } }, { name: 'uprav', input: {} }] }], konec: '• Opraveno.' }]);
  await p.click('[data-ai-volba=kontrola]');
  await p.zadej('Kresli.'); await p.hotovo();
  const v = (await p.ai()).vysledky;
  assert.match(v[0].vysledek.chyby[0], /NEEXISTUJE.*není v katalogu/);
  assert.match(v[1].chyba, /chybí pole „zmeny“/);
  assert.ok((await p.log()).includes('Nástroj uprav: chybí pole'));
  await p.scenare([{ kroky: [], chyba: { code: 'not_granted', message: 'x' } }]);
  await p.zadej('Znovu.');
  await p.waitForFunction(() => document.querySelector('[data-ai-log]').innerText.includes('nebylo povoleno'));
  assert.equal(await p.locator('[data-ai-spust]').isDisabled(), true);
  assert.ok((await p.locator('[data-ai-stav]').innerText()).includes('nebylo povoleno'));
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('Zastavit: rozkreslené zůstane jako jeden krok Zpět; výkres mimo rám se přizpůsobí měřítkem', skip, async () => {
  const p = await nova();
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  await p.scenare([{ kroky: [{ text: 'Začínám.', nastroje: [{ name: 'kresli', input: { prvky: [{ druh: 'stena', body: [[0, 0], [80, 0], [80, 40]] }] } }], cekej: 20000 }], konec: 'nedojde' }]);
  await p.zadej('Velká hala.');
  await p.waitForFunction(() => document.querySelectorAll('#svet [data-druh=stena]').length === 1);
  assert.equal(await p.locator('[data-ai-stop]').isHidden(), false);
  assert.match(await p.locator('[data-ai-bezi]').innerText(), /Claude pracuje… \d+ s/);
  await p.click('[data-ai-stop]'); await p.hotovo();
  const log = await p.log();
  assert.ok(log.includes('Zastaveno.')); assert.ok(log.includes('měřítko listu je teď 1 : 500'), log);
  assert.match(await p.locator('.ed-svg svg').innerHTML(), /1 : 500/);
  assert.equal((await p.ai()).volani.length, 1, 'po zastavení se kontrolní kolo nespouští');
  await p.click('[data-akce=zpet]'); assert.equal(await p.pocet('stena'), 0);
  assert.match(await p.locator('.ed-svg svg').innerHTML(), /1 : 100/, 'Zpět vrátí i měřítko');
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('evakuační plán: bez nástupní plochy, se značkami evakuační knihovny a bodem „Jste zde“', skip, async () => {
  const p = await nova({ evak: true });
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  await p.scenare([{ kroky: [{ nastroje: [{ name: 'kresli', input: { prvky: [
    { druh: 'stena', body: [[2, 2], [20, 2], [20, 12], [2, 12], [2, 2]] },
    { druh: 'trasa', body: [[15, 7], [3, 7]] },
    { druh: 'znacka', x: 3, y: 9, znacka: 'EVAK-001' },
    { druh: 'jstezde', x: 10, y: 7 },
    { druh: 'plocha', body: [[0, 0], [1, 0], [1, 1]] },
  ] } }] }], konec: '• Hotovo.' }]);
  await p.click('[data-ai-volba=kontrola]');
  await p.zadej('Nakresli podlaží.'); await p.hotovo();
  const v1 = (await p.ai()).volani[0];
  const druhy = v1.nastroje[0].schema.properties.prvky.items.properties.druh.enum;
  assert.ok(druhy.includes('jstezde') && !druhy.includes('plocha'));
  assert.match(v1.input[0].content, /LIST EVAKUAČNÍHO PLÁNU/); assert.match(v1.input[0].content, /EVAK-002 Shromaždiště/);
  assert.doesNotMatch(v1.input[0].content, /DZP-001 Nadzemní/);
  assert.match((await p.ai()).vysledky[0].vysledek.chyby[0], /nepatří/);
  assert.equal(await p.pocet('stena'), 1); assert.equal(await p.pocet('znacka'), 1);
  await p.waitForSelector('#svet [data-jstezde]');
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('bez Claude (soubor z disku): panel vysvětlí, kde Claude funguje, a nic se neposílá; bez obrázků se přílohy skryjí', skip, async () => {
  const p = await nova({ claude: false });
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  await p.waitForFunction(() => /webové verzi plánovače a v artefaktu na claude\.ai.*soubor otevřený z disku/.test(document.querySelector('[data-ai-stav]').textContent));
  assert.equal(await p.locator('[data-ai-heslo]').count(), 0, 'mimo web žádné pole pro heslo');
  assert.equal(await p.locator('[data-ai-spust]').isDisabled(), true);
  assert.deepEqual(p.chyby, []);
  await p.context().close();
  const q = await nova({ obrazky: false });
  await q.click('[data-p=claude]'); await q.waitForSelector('.ai-panel');
  await q.waitForFunction(() => document.querySelector('[data-ai-soubor]').closest('[data-ai-obr-volby]').hidden);
  assert.equal(await q.locator('[data-ai-volba=kontrola]').isVisible(), false);
  await q.scenare([{ kroky: [{ nastroje: [{ name: 'kresli', input: { prvky: PUDORYS.slice(0, 1) } }] }], konec: '• Ok.' }]);
  await q.zadej('Stěna.'); await q.hotovo();
  assert.equal((await q.ai()).volani.length, 1, 'bez obrázků žádné kontrolní kolo');
  assert.deepEqual((await q.ai()).volani[0].obrazky, []);
  assert.deepEqual(q.chyby, []);
  await q.context().close();
});

test('přepnutí listu během kreslení zastaví Claude a rozkreslené uloží do původního listu', skip, async () => {
  const p = await nova();
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  await p.scenare([{ kroky: [{ nastroje: [{ name: 'kresli', input: { prvky: PUDORYS.slice(0, 2) } }], cekej: 20000 }], konec: 'nedojde' }]);
  await p.zadej('Kresli.');
  await p.waitForFunction(() => document.querySelectorAll('#svet [data-druh=stena]').length === 2);
  await p.click('#listy li:nth-child(1) a'); await p.waitForSelector('[data-pole="objekt.adresa"]');
  await p.click('#listy li:nth-child(3) a'); await p.waitForSelector('#svet');
  assert.equal(await p.pocet('stena'), 2, 'rozkreslené stěny zůstaly v listu');
  await p.waitForTimeout(800);   // odložené uložení (350 ms)
  await p.reload(); await p.waitForSelector('#svet');
  assert.equal(await p.pocet('stena'), 2, 'a jsou uložené');
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

// ---------- opravy po revizi ----------
test('během zásahu je editor zamčený (Zpět, nástroje, klávesy počkají); potom jeden krok Zpět vrátí celý zásah', skip, async () => {
  const p = await nova();
  await p.click('[data-nastroj=stena]'); await p.klikSvet(1, 1); await p.klikSvet(5, 1); await p.keyboard.press('Enter');
  assert.equal(await p.pocet('stena'), 1);
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  await p.click('[data-ai-volba=kontrola]');
  await p.scenare([{ kroky: [{ nastroje: [{ name: 'kresli', input: { prvky: PUDORYS.slice(0, 2) } }], cekej: 1500 }], konec: '• Hotovo.' }]);
  await p.zadej('Kresli.');
  await p.waitForFunction(() => document.querySelectorAll('#svet [data-druh=stena]').length === 3);
  assert.equal(await p.locator('.ed-zamek').isVisible(), true);
  assert.match(await p.locator('.ed-zamek').innerText(), /Claude kreslí do výkresu/);
  assert.equal(await p.locator('[data-akce=zpet]').isDisabled(), true);
  assert.equal(await p.locator('[data-ai-nova]').isDisabled(), true, 'Nová konverzace během běhu nejde');
  await p.locator('[data-nastroj=cara]').dispatchEvent('click');
  assert.equal(await p.locator('[data-nastroj=vyber].akt').count(), 1, 'nástroj se během zásahu nezmění');
  await p.locator('.ed-scena').focus(); await p.keyboard.press('Control+z'); await p.keyboard.press('Delete');
  assert.equal(await p.pocet('stena'), 3, 'Ctrl+Z ani Delete během zásahu nic nezmění');
  await p.hotovo();
  assert.equal(await p.locator('.ed-zamek').isVisible(), false);
  await p.click('[data-akce=zpet]');
  assert.equal(await p.pocet('stena'), 1, 'jeden krok Zpět vrátí celý zásah, uživatelova stěna zůstane');
  await p.click('[data-akce=zpet]'); assert.equal(await p.pocet('stena'), 0);
  await p.click('[data-akce=vpred]'); await p.click('[data-akce=vpred]'); assert.equal(await p.pocet('stena'), 3);
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('odchod na přehled projektů během kreslení zastaví Claude a uloží rozkreslené; smazaný projekt se už neobnoví', skip, async () => {
  const p = await nova();
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  await p.scenare([{ kroky: [{ nastroje: [{ name: 'kresli', input: { prvky: PUDORYS.slice(0, 2) } }], cekej: 3000 }], konec: 'nedojde' }]);
  await p.zadej('Kresli.');
  await p.waitForFunction(() => document.querySelectorAll('#svet [data-druh=stena]').length === 2);
  await p.click('#logo'); await p.waitForSelector('.dash');
  await p.click('.projekty li a'); await p.waitForSelector('.editor');
  await p.click('#listy li:nth-child(3) a'); await p.waitForSelector('#svet', { state: 'attached' });
  assert.equal(await p.pocet('stena'), 2, 'rozkreslené je uložené');
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  assert.ok((await p.log()).includes('Zastaveno při odchodu z listu'));
  await p.click('#logo'); await p.waitForSelector('.dash');
  await p.click('.projekty [data-akce=smaz]'); await p.dlgOk();
  await p.waitForTimeout(3500);   // déle než by běžel zastavený zásah
  assert.equal((await p.ai()).volani.length, 1, 'kontrolní kolo se po odchodu nespustilo');
  await p.reload(); await p.waitForSelector('.dash');
  assert.equal(await p.locator('.projekty li a').count(), 0, 'smazaný projekt se nevrátil');
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('selhání kontrolního kola nesmaže odpověď prvního kola ani historii; použitý model se oznámí', skip, async () => {
  const p = await nova();
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  await p.selectOption('[data-ai-model]', 'complex');
  await p.scenare([
    { kroky: [{ text: 'Kreslím.', nastroje: [{ name: 'kresli', input: { prvky: PUDORYS.slice(0, 2) } }] }], konec: '• Nakreslil jsem obvod.\n• Rozměry jsou odhad.', tier: 'default' },
    { kroky: [], chyba: { code: 'rate_limited', message: 'x' } },
  ]);
  await p.zadej('Nakresli obvod.'); await p.hotovo();
  const log = await p.log();
  assert.ok(log.includes('Rozměry jsou odhad'), log);
  assert.ok(log.includes('Kontrolu výsledku se nepodařilo dokončit (Příliš mnoho dotazů'), log);
  assert.ok(log.includes('Odpověděl model Vyvážený – zvolený model Nejschopnější teď není k dispozici'), log);
  assert.equal((await p.ai()).volani[0].modelTier, 'complex');
  await p.scenare([{ kroky: [], konec: '• Ok.' }]);
  await p.zadej('Další.'); await p.hotovo();
  const v = (await p.ai()).volani.at(-1);
  assert.deepEqual(v.input.map((t) => t.role), ['user', 'user', 'assistant', 'user']);
  assert.match(v.input[2].content, /Rozměry jsou odhad/);
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('obrázek pro Claude je jen kreslicí plocha (bez razítka); bez „Poslat i obrázek listu“ se kontrolní kolo nespustí', skip, async () => {
  const p = await nova();
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  await p.scenare([{ kroky: [{ nastroje: [{ name: 'kresli', input: { prvky: PUDORYS } }] }], konec: '• Ok.' }, { kroky: [], konec: '• V pořádku.' }]);
  await p.zadej('Kresli.'); await p.hotovo();
  const [o] = (await p.ai()).volani[1].obrazky;
  assert.equal(o.w, 1600);
  assert.ok(Math.abs(o.w / o.h - 283.648 / 172.648) < 0.01, `poměr ${o.w}×${o.h} odpovídá rámu A4 na šířku, ne celému listu (1,414)`);
  await p.click('[data-ai-volba=prilozitVykres]');
  assert.equal(await p.locator('[data-ai-volba=kontrola]').isDisabled(), true);
  await p.scenare([{ kroky: [{ nastroje: [{ name: 'uprav', input: { zmeny: [] } }] }], konec: '• Ok.' }]);
  const pred = (await p.ai()).volani.length;
  await p.scenare([{ kroky: [{ nastroje: [{ name: 'kresli', input: { prvky: [{ druh: 'text', x: 3, y: 5, text: 'Chodba' }] } }] }], konec: '• Ok.' }]);
  await p.evaluate(() => { window.__ai.scenare.shift(); });
  await p.zadej('Přidej popisek.'); await p.hotovo();
  const ai = await p.ai();
  assert.equal(ai.volani.length, pred + 1, 'bez obrázku listu žádné kontrolní kolo');
  assert.deepEqual(ai.volani.at(-1).obrazky, []);
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('trvalé odmítnutí platí pro všechny listy; stav panelu je po projektech (kopie projektu nemá cizí konverzaci)', skip, async () => {
  const p = await nova();
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  await p.scenare([{ kroky: [{ nastroje: [{ name: 'kresli', input: { prvky: PUDORYS.slice(0, 1) } }] }], konec: '• Stěna.' }]);
  await p.click('[data-ai-volba=kontrola]');
  await p.zadej('Stěna.'); await p.hotovo();
  // kopie projektu: stejná id listů, ale vlastní (prázdná) konverzace
  await p.click('#logo'); await p.waitForSelector('.dash');
  await p.click('.projekty [data-akce=kopie]'); await p.waitForSelector('.projekty li:nth-child(2)');
  await p.locator('.projekty li a', { hasText: '(kopie)' }).click(); await p.waitForSelector('.editor');
  await p.click('#listy li:nth-child(3) a'); await p.waitForSelector('#svet', { state: 'attached' });
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  assert.ok((await p.log()).includes('Zatím žádná konverzace'));
  // odmítnutí na tomto listu vypne Claude i na jiném listu
  await p.scenare([{ kroky: [], chyba: { code: 'not_granted', message: 'x' } }]);
  await p.zadej('Cokoli.');
  await p.waitForFunction(() => document.querySelector('[data-ai-log]').innerText.includes('nebylo povoleno'));
  await p.click('#listy li:nth-child(2) a'); await p.waitForSelector('#svet', { state: 'attached' });
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  assert.equal(await p.locator('[data-ai-spust]').isDisabled(), true);
  assert.ok((await p.locator('[data-ai-stav]').innerText()).includes('nebylo povoleno'));
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('„Vrátit změny od Claude“ funguje i po novém vytvoření editoru (přejmenování listu)', skip, async () => {
  const p = await nova();
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  await p.click('[data-ai-volba=kontrola]');
  await p.scenare([{ kroky: [{ nastroje: [{ name: 'kresli', input: { prvky: PUDORYS.slice(0, 2) } }] }], konec: '• Ok.' }]);
  await p.zadej('Kresli.'); await p.hotovo();
  await p.evaluate(() => { document.querySelector('.listy-sprava').open = true; });
  await p.click('#l-prejm'); await p.dlgOk('Půdorys přejmenovaný');
  await p.waitForSelector('#svet', { state: 'attached' });
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  assert.equal(await p.pocet('stena'), 2);
  assert.equal(await p.locator('[data-akce=zpet]').isDisabled(), true, 'nový editor nemá historii');
  assert.equal(await p.locator('[data-ai-vratit]').isDisabled(), false);
  await p.click('[data-ai-vratit]');
  assert.equal(await p.pocet('stena'), 0);
  assert.ok((await p.log()).includes('Obnovíte je tlačítkem Zpět'));
  await p.click('[data-akce=zpet]'); assert.equal(await p.pocet('stena'), 2, 'vrácení je samo krok, který jde vzít zpět');
  assert.deepEqual(p.chyby, []);
  await p.context().close();
});

test('stahování v artefaktu přes schopnost downloads; přenos projektů zálohou do jiné kopie plánovače (jiné úložiště)', skip, async () => {
  const p = await nova({ stahovani: true });   // „kopie AI“: projekt s nakreslenou stěnou
  await p.click('[data-p=claude]'); await p.waitForSelector('.ai-panel');
  await p.click('[data-ai-volba=kontrola]');
  await p.scenare([{ kroky: [{ nastroje: [{ name: 'kresli', input: { prvky: PUDORYS.slice(0, 2) } }] }], konec: '• Ok.' }]);
  await p.zadej('Kresli.'); await p.hotovo();
  // export listu do PDF a projektu do .pplan.json jde přes save(), ne přes odkaz
  await p.click('[data-akce=export-pdf]');
  await p.waitForFunction(() => window.__ai.ulozeno.some((u) => u.filename.endsWith('.pdf')), null, { timeout: 30000 });
  await p.click('#a-stahnout');
  await p.waitForFunction(() => window.__ai.ulozeno.some((u) => u.filename === 'AI_test.pplan.json'));
  // odmítnuté uložení zálohy: hláška a datum poslední zálohy se nezapíše
  await p.click('#logo'); await p.waitForSelector('.dash');
  await p.evaluate(() => { window.__ai.odmitnout = true; });
  await p.click('#d-zaloha');
  await p.waitForFunction(() => document.querySelector('#hlaska')?.textContent.includes('Uložení souboru jste zrušili'));
  assert.equal(await p.evaluate(() => localStorage.getItem('pp.zaloha')), null);
  await p.evaluate(() => { window.__ai.odmitnout = false; });
  await p.click('#d-zaloha');
  await p.waitForFunction(() => window.__ai.ulozeno.filter((u) => u.filename.endsWith('.pplan-zaloha.json')).length === 2);
  const zaloha = (await p.ai()).ulozeno.at(-1);
  assert.match(zaloha.filename, /^Pozarni_planovac_zaloha_\d{4}-\d{2}-\d{2}\.pplan-zaloha\.json$/);
  assert.match(await p.locator('#hlaska').textContent(), /Záloha je stažená/);
  // „původní plánovač“: nový kontext = jiné úložiště; import zálohy obnoví projekt i se stěnami
  const ctx2 = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  await ctx2.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const q = await ctx2.newPage(); const chyby2 = []; q.on('pageerror', (e) => chyby2.push(e.message));
  await q.goto(URL_); await q.waitForSelector('.dash');
  assert.equal(await q.locator('.projekty li a').count(), 0);
  await q.setInputFiles('#d-import', { name: zaloha.filename, mimeType: 'application/json', buffer: Buffer.from(zaloha.text) });
  await q.waitForSelector('.dlg[open] .zaloha-seznam'); await q.click('.dlg [data-vysledek=ok]'); await q.waitForSelector('.dlg', { state: 'detached' });
  await q.waitForSelector('.projekty li >> text=AI test');
  await q.click('.projekty li a'); await q.waitForSelector('.editor');
  await q.click('#listy li:nth-child(3) a'); await q.waitForSelector('#svet', { state: 'attached' });
  await q.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  assert.equal(await q.locator('#svet [data-druh=stena]').count(), 2, 'přenesený projekt má stěny nakreslené Claude');
  assert.deepEqual(p.chyby, []); assert.deepEqual(chyby2, []);
  await ctx2.close(); await p.context().close();
});

test('stahování v artefaktu: odmítnuté uložení ukáže důvod s kódem; u oprávnění otevře panel a uloží znovu; bez schopnosti se nestahuje odkazem', skip, async () => {
  const p = await nova({ stahovani: true });
  // 1) oprávnění odepřené: dialog s kódem a stavem → Otevřít oprávnění → po zavření panelu se soubor uloží
  await p.evaluate(() => Object.assign(window.__ai, { chybaUlozeni: 'not_granted', opravneni: 'denied', poManage: null }));
  await p.click('#a-stahnout');
  await p.waitForSelector('.dlg[open]');
  const t1 = await p.locator('.dlg[open]').innerText();
  assert.match(t1, /Soubor se neuložil/); assert.match(t1, /kód: not_granted, oprávnění: denied/); assert.match(t1, /Otevřít oprávnění/);
  await p.click('.dlg[open] [data-vysledek=ok]');
  await p.waitForFunction(() => window.__ai.ulozeno.some((u) => u.filename === 'AI_test.pplan.json'));
  assert.equal((await p.ai()).manage, 1); assert.equal(await p.locator('.dlg[open]').count(), 0);
  // 2) typ souboru v tomto zobrazení vypnutý: jen vysvětlení s kódem (bez panelu oprávnění) a žádná druhá hláška
  await p.evaluate(() => Object.assign(window.__ai, { chybaUlozeni: 'extension_not_enabled', opravneni: 'granted' }));
  await p.click('[data-akce=export-pdf]');
  await p.waitForSelector('.dlg[open]', { timeout: 30000 });
  assert.match(await p.locator('.dlg[open]').innerText(), /PDF, SVG[\s\S]*kód: extension_not_enabled/);
  assert.equal(await p.locator('.dlg[open] [data-vysledek=zrusit]').count(), 0, 'jen „Rozumím“');
  await p.click('.dlg[open] [data-vysledek=ok]'); await p.waitForSelector('.dlg', { state: 'detached' });
  await p.waitForTimeout(300); assert.equal(await p.locator('.dlg[open]').count(), 0, 'žádný druhý dialog');
  assert.equal((await p.ai()).pokusy.length, 2);
  assert.deepEqual(p.chyby, []);
  await p.context().close();
  // 3) artefakt, kde schopnost downloads není: žádné tiché „stažení“ odkazem (sandbox by ho zahodil), ale vysvětlení s kódem
  const q = await nova({ stahovani: false });
  let stazeno = false; q.on('download', () => { stazeno = true; });
  await q.click('#a-stahnout');
  await q.waitForSelector('.dlg[open]');
  assert.match(await q.locator('.dlg[open]').innerText(), /kód: unavailable/);
  assert.equal(stazeno, false);
  assert.deepEqual(q.chyby, []);
  await q.context().close();
});
