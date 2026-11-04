// Tematické pozadí úvodní stránky: DZP = situace DZP, Evakuační plány = únikový plán; v editoru projektu žádné.
// Spuštění: npm run test:e2e (potřebuje Playwright a Chromium).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
for (const m of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(m)); break; } catch { /* další */ } }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const bezPisem = (ctx) => ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const server = async (cwd, port) => { const s = spawn('python3', ['-m', 'http.server', String(port)], { cwd, stdio: 'ignore' }); await new Promise((r) => setTimeout(r, 800)); return s; };

// Vrstvy pozadí, které jsou za stránkou opravdu vidět (vykreslené, s obrázkem a nenulovým krytím).
const viditelnePozadi = (page) => page.evaluate(() => ['::before', '::after'].map((pe) => getComputedStyle(document.body, pe))
  .filter((s) => s.content !== 'none' && s.display !== 'none' && s.backgroundImage !== 'none' && parseFloat(s.opacity) > 0)
  .map((s) => ({ obrazek: s.backgroundImage, kryti: parseFloat(s.opacity), filtr: s.filter })));
const adresa = (obrazek) => /^url\("(.*)"\)$/.exec(obrazek)[1];
const rozmery = (page, url) => page.evaluate(async (u) => { const i = new Image(); i.src = u; await i.decode(); return [i.naturalWidth, i.naturalHeight]; }, url);

test('pozadí jen na úvodní stránce: situace DZP, po přepnutí únikový plán, v editoru žádné; tmavý režim a tisk', { skip: !chromium && 'Playwright není dostupný' }, async () => {
  const srv = await server(root, 8798), browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' }); await bezPisem(ctx);
    const page = await ctx.newPage(), chyby = [], soubory = [];
    page.on('pageerror', (e) => chyby.push(e.message)); page.on('console', (m) => m.type() === 'error' && chyby.push(m.text()));
    page.on('response', (r) => { if (r.url().includes('/pozadi/')) soubory.push([r.url(), r.status()]); });

    await page.goto('http://localhost:8798/index.html#/dzp'); await page.waitForSelector('.dash--dzp');
    const dzp = await viditelnePozadi(page);
    assert.equal(dzp.length, 1, 'na přehledu DZP je vidět právě jedno pozadí');
    assert.match(dzp[0].obrazek, /situace-dzp\.webp/);
    assert.ok(dzp[0].kryti > 0 && dzp[0].kryti <= 0.3, `pozadí je jen lehce vidět (krytí ${dzp[0].kryti})`);
    assert.ok((await rozmery(page, adresa(dzp[0].obrazek)))[0] >= 1200, 'obrázek situace se načte v dostatečném rozlišení');

    await page.click('#rezim [data-rezim=evakuace]'); await page.waitForSelector('.dash--evakuace');
    const evak = await viditelnePozadi(page);
    assert.equal(evak.length, 1, 'po přepnutí je vidět jen pozadí evakuačních plánů');
    assert.match(evak[0].obrazek, /unikovy-plan\.webp/);
    assert.ok((await rozmery(page, adresa(evak[0].obrazek)))[0] >= 1200, 'obrázek únikového plánu se načte v dostatečném rozlišení');

    await page.fill('#d-novy [name=nazev]', 'Evakuační plán – test pozadí'); await page.click('#d-novy button'); await page.waitForSelector('.editor');
    assert.deepEqual(await viditelnePozadi(page), [], 'v editoru projektu pozadí není');

    await page.click('#logo'); await page.waitForSelector('.dash--evakuace');
    assert.match((await viditelnePozadi(page))[0]?.obrazek ?? '', /unikovy-plan\.webp/, 'po návratu na přehled se pozadí vrátí');

    await page.emulateMedia({ colorScheme: 'dark' });
    const tmave = await viditelnePozadi(page);
    assert.match(tmave[0]?.filtr ?? '', /invert/, 'v tmavém režimu je obrázek převedený do tmavých tónů');
    assert.ok(tmave[0].kryti < evak[0].kryti, 'v tmavém režimu je pozadí slabší');

    await page.emulateMedia({ media: 'print', colorScheme: 'light' });
    assert.deepEqual(await viditelnePozadi(page), [], 'tisk je bez pozadí');

    assert.ok(soubory.length >= 2 && soubory.every(([, s]) => s === 200), `obrázky pozadí se načetly: ${JSON.stringify(soubory)}`);
    assert.deepEqual(chyby, []);
  } finally { await browser.close(); srv.kill(); }
});

test('jedna HTML (artefakt): obrázky pozadí jsou vložené jako data:, bez odkazu na soubory', { skip: !chromium && 'Playwright není dostupný' }, async () => {
  execSync('node tools/sestav_jeden_soubor.mjs', { cwd: root, stdio: 'pipe' });
  for (const f of ['dist/pozarni-planovac.html', 'dist/pozarni-planovac.artifact.html']) assert.ok(!readFileSync(join(root, f), 'utf8').includes('pozadi/'), `${f} neodkazuje na soubory pozadí`);
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' }); await bezPisem(ctx);
    const page = await ctx.newPage(), chyby = [];
    page.on('pageerror', (e) => chyby.push(e.message)); page.on('console', (m) => m.type() === 'error' && chyby.push(m.text()));
    await page.goto(`${pathToFileURL(join(root, 'dist/pozarni-planovac.html')).href}#/dzp`); await page.waitForSelector('.dash--dzp');
    const dzp = await viditelnePozadi(page);
    assert.equal(dzp.length, 1); assert.match(dzp[0].obrazek, /^url\("data:image\/webp;base64,/);
    await page.click('#rezim [data-rezim=evakuace]'); await page.waitForSelector('.dash--evakuace');
    const evak = await viditelnePozadi(page);
    assert.equal(evak.length, 1); assert.match(evak[0].obrazek, /^url\("data:image\/webp;base64,/);
    assert.notEqual(evak[0].obrazek, dzp[0].obrazek, 'každý režim má svůj obrázek');
    assert.deepEqual(chyby, []);
  } finally { await browser.close(); }
});

test('webová verze: situace Litice se nepřibalí ani nenačítá (DZP bez obrázku), únikový plán ano', { skip: !chromium && 'Playwright není dostupný' }, async () => {
  execSync('node tools/sestav_web.mjs', { cwd: root, stdio: 'pipe' });
  assert.ok(existsSync(join(root, 'web/pozadi/unikovy-plan.webp')), 'únikový plán je ve webové verzi');
  assert.ok(!existsSync(join(root, 'web/pozadi/situace-dzp.webp')), 'situace Litice ve webové verzi není');
  const srv = await server(join(root, 'web'), 8799), browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' }); await bezPisem(ctx);
    const page = await ctx.newPage(), chyby = [], pozadavky = [];
    page.on('pageerror', (e) => chyby.push(e.message)); page.on('console', (m) => m.type() === 'error' && chyby.push(m.text()));
    page.on('request', (r) => { if (r.url().includes('/pozadi/')) pozadavky.push(r.url()); });
    await page.goto('http://localhost:8799/index.html#/dzp'); await page.waitForSelector('.dash--dzp');
    assert.deepEqual(await viditelnePozadi(page), [], 'DZP na webu bez obrázku');
    await page.click('#rezim [data-rezim=evakuace]'); await page.waitForSelector('.dash--evakuace');
    assert.match((await viditelnePozadi(page))[0]?.obrazek ?? '', /unikovy-plan\.webp/);
    assert.ok(!pozadavky.some((u) => u.includes('situace-dzp')), `web situaci nenačítá: ${JSON.stringify(pozadavky)}`);
    assert.deepEqual(chyby, []);
  } finally { await browser.close(); srv.kill(); }
});
