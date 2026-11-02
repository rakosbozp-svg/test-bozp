// E2E oprav editoru výkresu (Chromium): uložení nastavení listu, převod čára → stěna, Esc a druhý prst vrátí rozpracovanou
// úpravu, posun plátna u listu na výšku, výběr podle vrstev, nástroje evakuačního plánu, popisky exportu na telefonu,
// import cizího projektu (žádný skript, seznam projektů funguje i bez data změny).
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
const PORT = 8797, URL_ = `http://localhost:${PORT}/index.html`;
const skip = { skip: !chromium && 'Playwright není dostupný' };

let srv, browser;
test.before(async () => {
  if (!chromium) return;
  srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  browser = await chromium.launch();
});
test.after(async () => { await browser?.close(); srv?.kill(); });

async function stranka({ touch = false, viewport = { width: 1500, height: 900 } } = {}) {
  const ctx = await browser.newContext({ hasTouch: touch, viewport });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const p = await ctx.newPage();
  p.chyby = []; p.on('pageerror', (e) => p.chyby.push(e.message)); p.on('dialog', (d) => { p.chyby.push(`dialog: ${d.message()}`); d.dismiss(); });
  await p.goto(URL_); await p.waitForSelector('.dash');
  p.W = (x, y) => p.evaluate(([a, b]) => { const m = document.querySelector('#svet').getScreenCTM(), q = new DOMPoint(a, b).matrixTransform(m); return [q.x, q.y]; }, [x, y]);
  p.klik = async (x, y) => p.mouse.click(...await p.W(x, y));
  p.klid = () => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  p.cdp = touch ? await ctx.newCDPSession(p) : null;
  p.dotyk = (type, body) => p.cdp.send('Input.dispatchTouchEvent', { type, touchPoints: body.map(([x, y], i) => ({ x, y, id: i + 1 })) });
  return p;
}
async function situace(p, nazev = 'Test') {
  await p.fill('#d-novy [name=nazev]', nazev); await p.click('#d-novy button'); await p.waitForSelector('.editor');
  await p.click('#listy a:has-text("Situace")'); await p.waitForSelector('#svet'); await p.klid();
}
const ulozeno = (p) => p.waitForFunction(() => document.querySelector('#stav')?.textContent.startsWith('Uloženo'));

test('nastavení listu (orientace, razítko, poloha legendy) se uloží a undo je vrátí', skip, async () => {
  const p = await stranka(); await situace(p);
  await p.click('[data-p=vlastnosti]');
  const zpracoval = p.locator('#panel-obsah label.f:has-text("Zpracoval") input');
  await zpracoval.fill('Jan Novák'); await zpracoval.press('Tab');
  await p.selectOption('#panel-obsah label.f:has-text("Poloha legendy") select', 'vlevo-nahore');
  await p.selectOption('#panel-obsah label.f:has-text("Orientace") select', 'na_vysku');
  await ulozeno(p); await p.reload(); await p.waitForSelector('.editor');
  await p.click('#listy a:has-text("Situace")'); await p.waitForSelector('#svet'); await p.click('[data-p=vlastnosti]');
  assert.equal(await p.locator('#panel-obsah label.f:has-text("Zpracoval") input').inputValue(), 'Jan Novák');
  assert.equal(await p.locator('#panel-obsah label.f:has-text("Orientace") select').inputValue(), 'na_vysku');
  assert.equal(await p.locator('#panel-obsah label.f:has-text("Poloha legendy") select').inputValue(), 'vlevo-nahore');
  await p.selectOption('#panel-obsah label.f:has-text("Orientace") select', 'na_sirku'); await p.klid();
  await p.click('.ed-scena', { position: { x: 5, y: 5 } }); await p.keyboard.press('Control+z'); await p.klid();
  assert.equal(await p.locator('#panel-obsah label.f:has-text("Orientace") select').inputValue(), 'na_vysku', 'undo vrátí orientaci');
  assert.deepEqual(p.chyby, []);
});

test('převod čáry na stěnu z panelu; Esc během tažení vrátí prvek', skip, async () => {
  const p = await stranka(); await situace(p);
  await p.click('[data-nastroj=cara]'); await p.klik(20, 20); await p.klik(60, 20); await p.keyboard.press('Enter'); await p.klid();
  await p.click('[data-p=vlastnosti]'); await p.getByRole('button', { name: 'Převést na stěnu' }).click(); await p.klid();
  assert.equal(await p.locator('#svet [data-druh=stena]').count(), 1); assert.equal(await p.locator('#svet [data-druh=cara]').count(), 0);
  await p.click('[data-nastroj=vyber]');
  const pred = await p.locator('#svet [data-druh=stena]').getAttribute('points');
  const [x0, y0] = await p.W(30, 20), [x1, y1] = await p.W(30, 60);
  await p.mouse.move(x0, y0); await p.mouse.down(); await p.mouse.move(x1, y1, { steps: 6 }); await p.klid();
  assert.notEqual(await p.locator('#svet [data-druh=stena]').getAttribute('points'), pred, 'během tažení se prvek hýbe');
  await p.keyboard.press('Escape'); await p.mouse.up(); await p.klid();
  assert.equal(await p.locator('#svet [data-druh=stena]').getAttribute('points'), pred);
  assert.deepEqual(p.chyby, []);
});

test('dotyk: přiblížení dvěma prsty při kreslení nepřidá bod ani značku', skip, async () => {
  const p = await stranka({ touch: true, viewport: { width: 1200, height: 900 } }); await situace(p);
  const tap = async (x, y) => { await p.dotyk('touchStart', [[x, y]]); await p.dotyk('touchEnd', []); await p.waitForTimeout(350); };
  const pinch = async ([x, y]) => {
    await p.dotyk('touchStart', [[x, y]]); await p.waitForTimeout(30); await p.dotyk('touchStart', [[x, y], [x + 60, y]]);
    for (let i = 1; i <= 5; i++) await p.dotyk('touchMove', [[x - i * 10, y], [x + 60 + i * 10, y]]);
    await p.dotyk('touchEnd', []); await p.waitForTimeout(300);
  };
  await p.click('[data-nastroj=stena]'); await tap(...await p.W(20, 30)); await tap(...await p.W(120, 30));
  await pinch(await p.W(70, 80));
  await p.click('.ed-plovouci [data-akce=dokoncit]'); await p.klid();
  assert.equal((await p.locator('#svet [data-druh=stena]').getAttribute('points')).split(' ').length, 2);
  await p.click('[data-nastroj=znacka]'); await p.locator('.zd-bunka').first().click(); await p.waitForSelector('[data-nastroj=znacka].akt');
  await pinch(await p.W(60, 60)); await p.klid();
  assert.equal(await p.locator('#svet [data-druh=znacka]').count(), 0);
  assert.deepEqual(p.chyby, []);
});

test('list na výšku: plátno se posouvá s ukazatelem; klik na značku nad plochou vybere značku', skip, async () => {
  const p = await stranka(); await situace(p);
  await p.click('[data-p=vlastnosti]'); await p.selectOption('#panel-obsah label.f:has-text("Orientace") select', 'na_vysku'); await p.click('[data-akce=cely]'); await p.klid();
  const box = await p.locator('.ed-svg svg').boundingBox(), a = await p.W(50, 50);
  await p.click('[data-nastroj=posun]'); await p.mouse.move(box.x + 300, box.y + 300); await p.mouse.down(); await p.mouse.move(box.x + 500, box.y + 400, { steps: 8 }); await p.mouse.up(); await p.klid();
  const b = await p.W(50, 50); assert.ok(Math.abs(b[0] - a[0] - 200) < 2 && Math.abs(b[1] - a[1] - 100) < 2, `posun ${b[0] - a[0]}, ${b[1] - a[1]}`);
  await p.click('[data-nastroj=znacka]'); await p.locator('.zd-bunka').first().click(); await p.waitForSelector('[data-nastroj=znacka].akt'); await p.klik(100, 100); await p.keyboard.press('Escape');
  await p.click('[data-nastroj=plocha]'); for (const [x, y] of [[60, 60], [140, 60], [140, 140], [60, 140]]) await p.klik(x, y); await p.keyboard.press('Enter'); await p.klid();
  await p.click('[data-nastroj=vyber]'); await p.keyboard.press('Escape'); await p.klik(100, 100); await p.klid();
  assert.equal(await p.locator('#panel-obsah h3').first().textContent(), 'Značka');
  assert.deepEqual(p.chyby, []);
});

test('evakuační plán nemá nástroj nástupní plochy; telefon: export SVG/PNG/PDF s popiskem', skip, async () => {
  const p = await stranka();
  await p.evaluate(() => { location.hash = '#/evakuace'; }); await p.waitForSelector('#d-novy');
  await p.fill('#d-novy [name=nazev]', 'Evak'); await p.click('#d-novy button'); await p.waitForSelector('.editor');
  await p.click('#listy a:has-text("Únikový plán")'); await p.waitForSelector('.ed-svg svg');
  assert.equal(await p.locator('[data-nastroj=plocha]').count(), 0);
  assert.doesNotMatch(await p.locator('[data-nastroj=cara]').getAttribute('title'), /požárního úseku/);
  const t = await stranka({ touch: true, viewport: { width: 390, height: 844 } }); await situace(t);
  assert.equal(await t.locator('[data-nastroj=plocha]').count(), 1, 'DZP nástroj má');
  for (const [a, txt] of [['export-svg', 'SVG'], ['export-png', 'PNG'], ['export-pdf', 'PDF']]) assert.ok(await t.locator(`[data-akce=${a}]`).getByText(txt, { exact: true }).isVisible(), txt);
  assert.equal(await t.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
  assert.deepEqual([...p.chyby, ...t.chyby], []);
});

test('import cizího projektu: hodnoty se nespustí jako skript; projekt bez data změny nerozbije přehled', skip, async () => {
  const p = await stranka();
  const zlo = await p.evaluate(async () => {
    const M = await import('./js/model.js'), x = M.novyProjekt({ nazev: 'Od kolegy' }), v = x.listy[1].vykres;
    v.prvky.push({ id: 'e_zlo', druh: 'cara', vrstva: 'zaklad', body: [[0, 0], [50, 30]], tloustka: 0.5, styl: 'plna', barva: '#000"/><image href="x:" onerror="window.__xss=1"/><polyline points="0,0" stroke="#000' });
    x.prilohy.p = { nazev: 'a', mime: 'image/png', data: 'data:image/png;base64,iVBORw0KGgo=' };
    v.pozadi = { prilohaId: 'p', nazev: 'a', x: 0, y: 0, sirkaPx: '<img src=x onerror="window.__xss=2">', vyskaPx: 1, mNaPx: 1, kryti: 0.8, kalibrace: null };
    delete x.zmeneno; return M.serializuj(x);
  });
  await p.setInputFiles('#d-import', { name: 'kolega.pplan.json', mimeType: 'application/json', buffer: Buffer.from(zlo) });
  await p.waitForSelector('.editor'); await p.click('#listy a:has-text("Situace")'); await p.waitForSelector('#svet'); await p.click('[data-p=vlastnosti]'); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => window.__xss), undefined);
  await p.evaluate(() => { location.hash = '#/'; }); await p.waitForSelector('.dash');
  await p.fill('#d-novy [name=nazev]', 'Další'); await p.click('#d-novy button'); await p.waitForSelector('.editor');
  await p.evaluate(() => { location.hash = '#/dzp'; }); await p.waitForSelector('.dash');
  assert.doesNotMatch(await p.locator('.dash').textContent(), /Invalid Date/);
  assert.deepEqual(p.chyby, []);
});

test('evakuační plán: poloha přehledového plánu a pokyny vedle plánu (uloží se, undo, skrytí polí)', skip, async () => {
  const p = await stranka();
  await p.evaluate(() => { location.hash = '#/evakuace'; }); await p.waitForSelector('#d-novy');
  await p.fill('#d-novy [name=nazev]', 'Evak D'); await p.click('#d-novy button'); await p.waitForSelector('.editor');
  await p.click('#listy a:has-text("Únikový plán")'); await p.waitForSelector('.ed-svg svg'); await p.click('[data-p=vlastnosti]');
  const poloha = () => p.locator('#panel-obsah label.f:has-text("Poloha přehledového plánu") select');
  assert.equal(await poloha().inputValue(), 'vpravo-dole');
  await poloha().selectOption('vlevo-nahore');
  const vedle = p.locator('#panel-obsah label.chk:has-text("vyvěšeny vedle plánu") input');
  assert.equal(await p.locator('#panel-obsah textarea').count(), 2);
  await vedle.check(); await p.waitForFunction(() => document.querySelectorAll('#panel-obsah textarea').length === 0);
  await p.click('.ed-scena', { position: { x: 5, y: 5 } }); await p.keyboard.press('Control+z');
  await p.waitForFunction(() => document.querySelectorAll('#panel-obsah textarea').length === 2);   // undo vrátí pokyny na plán
  await p.keyboard.press('Control+y'); await p.waitForFunction(() => document.querySelectorAll('#panel-obsah textarea').length === 0);
  await ulozeno(p); await p.reload(); await p.waitForSelector('.editor');
  await p.click('#listy a:has-text("Únikový plán")'); await p.waitForSelector('.ed-svg svg'); await p.click('[data-p=vlastnosti]');
  assert.equal(await poloha().inputValue(), 'vlevo-nahore'); assert.equal(await p.locator('#panel-obsah label.chk:has-text("vyvěšeny vedle plánu") input').isChecked(), true);
  await p.selectOption('#panel-obsah label.f:has-text("Přehledový plán") select', 'ne');
  await p.waitForFunction(() => ![...document.querySelectorAll('#panel-obsah label.f')].some((l) => l.textContent.includes('Poloha přehledového plánu')));
  assert.deepEqual(p.chyby, []);
});
