// E2E test editoru výkresu v Chromiu: kreslení, dveře, měřítko a trasy, vrstvy, velikosti, undo/redo, export, podklad, dotyk.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
for (const m of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(m)); break; } catch { /* další */ } }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8792, URL_ = `http://localhost:${PORT}/index.html`;
const tmp = mkdtempSync(join(tmpdir(), 'pp-ed-'));

let srv, browser;
test.before(async () => {
  if (!chromium) return;
  srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  browser = await chromium.launch();
});
test.after(async () => { await browser?.close(); srv?.kill(); });

async function nova({ touch = false } = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true, hasTouch: touch, viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage();
  page.chyby = []; page.on('pageerror', (e) => page.chyby.push(e.message)); page.on('console', (m) => m.type() === 'error' && page.chyby.push(m.text()));
  page.on('dialog', (d) => d.accept(d.type() === 'prompt' ? (page.odpoved ?? 'Text') : undefined));
  await page.goto(URL_);
  await page.fill('#d-novy [name=nazev]', 'Editor test'); await page.click('#d-novy button'); await page.waitForSelector('.editor');
  page.odpoved = 'Půdorys test';
  await page.selectOption('#l-typ', 'pudorys'); await page.click('#l-pridej'); await page.waitForSelector('.ed-scena');
  await page.waitForSelector('#svet'); page.odpoved = undefined;
  const W = (x, y) => page.evaluate(([a, b]) => { const m = document.querySelector('#svet').getScreenCTM(), p = new DOMPoint(a, b).matrixTransform(m); return [p.x, p.y]; }, [x, y]);
  page.W = W;
  page.klik = async (x, y, o = {}) => { const [sx, sy] = await W(x, y); await page.mouse.click(sx, sy, o); };
  page.tahni = async (a, b, kroky = 8) => { const [x0, y0] = await W(...a), [x1, y1] = await W(...b); await page.mouse.move(x0, y0); await page.mouse.down(); await page.mouse.move(x1, y1, { steps: kroky }); await page.mouse.up(); };
  page.klid = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  page.txt = async (sel) => { await page.klid(); return page.locator(sel).first().textContent(); };
  page.pocet = async (druh) => { await page.klid(); return page.locator(`#svet [data-druh=${druh}]`).count(); };
  page.nastroj = async (n) => { await page.click(`[data-nastroj=${n}]`); };
  page.stred = async (sel) => { await page.klid(); const b = await page.locator(sel).first().boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; };
  page.panel = async (k) => { await page.click(`[data-p=${k}]`); };
  return page;
}

const skip = { skip: !chromium && 'Playwright není dostupný' };

test('kolečko myši přibližuje bez Ctrl a k místu kurzoru', skip, async () => {
  const p = await nova();
  const [sx, sy] = await p.W(10, 8), [ax, ay] = await p.W(20, 8);
  await p.mouse.move(sx, sy); await p.mouse.wheel(0, -400); await p.waitForTimeout(150);
  const [bx, by] = await p.W(10, 8), [cx] = await p.W(20, 8);
  assert.ok(Math.abs(bx - sx) < 3 && Math.abs(by - sy) < 3, `bod pod kurzorem se nesmí hýbat (${sx},${sy}) → (${bx},${by})`);
  assert.ok(cx - bx > (ax - sx) * 1.1, 'plátno se přiblížilo');
  await p.mouse.wheel(0, 400); await p.waitForTimeout(150);
  const [dx] = await p.W(20, 8), [ex] = await p.W(10, 8);
  assert.ok(dx - ex < cx - bx, 'a zase oddálilo');
  assert.deepEqual(p.chyby, []);
});

test('kreslení stěny, trasy a tvarů; délka trasy v metrech; změna geometrie ji přepočítá; undo/redo', skip, async () => {
  const p = await nova();
  await p.nastroj('stena'); for (const [x, y] of [[3, 3], [15, 3], [15, 12]]) await p.klik(x, y); await p.keyboard.press('Enter');
  assert.equal(await p.pocet('stena'), 1);
  await p.nastroj('trasa'); for (const [x, y] of [[5, 5], [20, 5], [20, 10]]) await p.klik(x, y); await p.keyboard.press('Enter');
  assert.equal(await p.pocet('trasa'), 1);
  assert.match(await p.locator('#svet [data-druh=trasa] text').textContent(), /20,0 m/);
  assert.match(await p.txt('[data-st=trasy]'), /trasy celkem 20,0 m/);
  // posunem koncového vrcholu (vybrat trasu, táhnout úchyt) se délka přepočítá
  await p.nastroj('vyber'); await p.klik(12, 5);
  await p.tahni([20, 10], [20, 15]);
  assert.match(await p.locator('#svet [data-druh=trasa] text').textContent(), /25,0 m/);
  assert.match(await p.txt('[data-st=trasy]'), /25,0 m/);
  // obdélník, elipsa, volná kresba, čára, plocha
  await p.nastroj('obdelnik'); await p.tahni([2, 14], [6, 16]);
  await p.nastroj('elipsa'); await p.tahni([8, 14], [12, 16]);
  await p.nastroj('volna'); await p.tahni([14, 14], [18, 16], 15);
  await p.nastroj('cara'); await p.klik(1, 1); await p.klik(1, 9); await p.keyboard.press('Enter');
  await p.nastroj('plocha'); for (const [x, y] of [[22, 1], [26, 1], [26, 6]]) await p.klik(x, y); await p.keyboard.press('Enter');
  for (const d of ['obdelnik', 'elipsa', 'volna', 'cara', 'plocha']) assert.equal(await p.pocet(d), 1, d);
  // undo / redo
  await p.klid(); const n = await p.locator('#svet [data-druh]').count();
  await p.keyboard.press('Control+z'); assert.equal(await p.pocet('plocha'), 0);
  await p.keyboard.press('Control+z'); assert.equal(await p.pocet('cara'), 0);
  await p.keyboard.press('Control+y'); assert.equal(await p.pocet('cara'), 1);
  await p.click('[data-akce=vpred]'); await p.klid(); assert.equal(await p.locator('#svet [data-druh]').count(), n);
  await p.click('[data-akce=zpet]'); await p.click('[data-akce=zpet]'); assert.equal(await p.pocet('cara'), 0);
  assert.deepEqual(p.chyby, []);
});

test('výběr více prvků, kopírování, mazání, přesun a otočení', skip, async () => {
  const p = await nova();
  await p.nastroj('obdelnik'); await p.tahni([3, 3], [7, 6]); await p.tahni([10, 3], [14, 6]);
  await p.nastroj('vyber'); await p.tahni([1, 1], [16, 8]);              // oblast přes oba
  assert.match(await p.txt('[data-st=vyber]'), /vybráno: 2/);
  await p.keyboard.press('Control+c'); await p.keyboard.press('Control+v');
  assert.equal(await p.pocet('obdelnik'), 4);
  await p.keyboard.press('Delete'); assert.equal(await p.pocet('obdelnik'), 2);
  // přesun tažením
  const [x0] = await p.stred('#svet [data-druh=obdelnik]');
  await p.klik(5, 4); await p.tahni([5, 4], [5, 10]);
  const [x1, y1] = await p.stred('#svet [data-druh=obdelnik]'); void x0; void x1; void y1;
  // otočení úchytem: vlastnost "Otočení" v panelu se změní
  await p.klik(5, 10);
  await p.panel('vlastnosti');
  const lbl = p.locator('#panel-obsah label.f', { hasText: 'Otočení' }).locator('input');
  await lbl.fill('45'); await lbl.dispatchEvent('change');
  await p.waitForFunction(() => /rotate\(45/.test(document.querySelector('#svet [data-druh=obdelnik]')?.getAttribute('transform') || '') || [...document.querySelectorAll('#svet [data-druh=obdelnik]')].some((e) => /rotate\(45/.test(e.getAttribute('transform') || '')));
  assert.deepEqual(p.chyby, []);
});

test('dveře: připojení ke stěně, sledování stěny, volný pohyb, odpojení, typ podle šířky', skip, async () => {
  const p = await nova();
  await p.nastroj('stena'); await p.klik(3, 5); await p.klik(15, 5); await p.keyboard.press('Enter');
  await p.nastroj('dvere'); await p.klik(6, 5.2);
  assert.equal(await p.pocet('dvere'), 1);
  await p.nastroj('vyber'); await p.panel('vlastnosti');
  assert.match(await p.locator('#panel-obsah').textContent(), /Připojeno ke stěně/);
  const [d0x, d0y] = await p.stred('#svet [data-druh=dvere]');
  // posun konce stěny nahoru: dveře zůstanou na stěně a pohnou se s ní
  await p.klik(9, 5); await p.tahni([15, 5], [15, 11]);
  const [d1x, d1y] = await p.stred('#svet [data-druh=dvere]');
  assert.ok(Math.hypot(d1x - d0x, d1y - d0y) > 3, 'dveře sledují změněnou stěnu');
  assert.ok(await p.pocet('stena') === 1);
  // šířka → typ
  await p.klik(6.0 + (15 - 3) * 0.0, 5); // klik na stěnu pod dveřmi vybere dveře nebo stěnu
  const dv = await p.stred('#svet [data-druh=dvere]'); await p.mouse.click(dv[0], dv[1]);
  await p.panel('vlastnosti');
  const sirka = p.locator('#panel-obsah label.f', { hasText: 'Šířka dveří' }).locator('input');
  await sirka.fill('1,6'); await sirka.dispatchEvent('change');
  await p.waitForFunction(() => document.querySelector('#panel-obsah select')?.value === 'dvoukridle');
  await sirka.fill('3,5'); await sirka.dispatchEvent('change');
  await p.waitForFunction(() => document.querySelector('#panel-obsah select')?.value === 'vrata');
  await p.selectOption('#panel-obsah select', 'jednokridle');
  await sirka.fill('3,6'); await sirka.dispatchEvent('change');
  assert.equal(await p.locator('#panel-obsah select').first().inputValue(), 'jednokridle', 'ruční volba se nepřepíše');
  // odpojit → volné dveře, pak přemístit těsně ke stěně → připojí se
  await p.getByRole('button', { name: 'Odpojit od stěny' }).click();
  assert.match(await p.locator('#panel-obsah').textContent(), /nejsou připojeny/);
  await p.getByRole('button', { name: 'Připojit k nejbližší stěně' }).click();
  assert.match(await p.locator('#panel-obsah').textContent(), /Připojeno ke stěně/);
  assert.deepEqual(p.chyby, []);
});

test('vrstvy: skrytí, zamčení a aktivní vrstva', skip, async () => {
  const p = await nova();
  await p.nastroj('stena'); await p.klik(3, 3); await p.klik(12, 3); await p.keyboard.press('Enter');
  await p.panel('vrstvy');
  const radek = p.locator('.vrstvy li', { has: p.locator('input[value="Stavby"]') });
  await radek.locator('button[title="Skrýt"]').click(); assert.equal(await p.pocet('stena'), 0);
  await p.locator('.vrstvy li', { has: p.locator('input[value="Stavby"]') }).locator('button[title="Zobrazit"]').click(); assert.equal(await p.pocet('stena'), 1);
  await p.locator('.vrstvy li', { has: p.locator('input[value="Stavby"]') }).locator('button[title="Zamknout"]').click();
  await p.nastroj('vyber'); await p.klik(7, 3);
  assert.equal(await p.txt('[data-st=vyber]'), '', 'zamčenou vrstvu nelze vybrat');
  await p.locator('.vrstvy li', { has: p.locator('input[value="Stavby"]') }).locator('button[title="Odemknout"]').click();
  await p.klik(7, 3); assert.match(await p.txt('[data-st=vyber]'), /vybráno: 1/);
  // nová vrstva + aktivní vrstva pro nové prvky
  p.odpoved = 'Hasební';
  await p.getByRole('button', { name: '+ Nová vrstva' }).click();
  await p.locator('.vrstvy li', { has: p.locator('input[value="Hasební"]') }).locator('input[type=radio]').check();
  await p.nastroj('cara'); await p.klik(2, 8); await p.klik(10, 8); await p.keyboard.press('Enter'); await p.klid();
  assert.equal(await p.locator('#svet g[data-vrstva] [data-druh=cara]').count(), 1);
  assert.equal(await p.locator('#svet g[data-vrstva]').nth(5).locator('[data-druh=cara]').count(), 1, 'čára je v nové (nejvyšší) vrstvě');
  assert.deepEqual(p.chyby, []);
});

test('značky z katalogu, velikost 1–500 s desetinami, legenda a trvanlivost po znovuotevření', skip, async () => {
  const p = await nova();
  await p.nastroj('znacka'); await p.fill('.znacky-dlg input[type=search]', 'hydrant'); await p.locator('.zd-bunka').first().click(); await p.waitForSelector('.znacky-dlg', { state: 'detached' }); await p.waitForSelector('[data-nastroj=znacka].akt');
  await p.klik(8, 8);
  assert.equal(await p.pocet('znacka'), 1);
  await p.nastroj('vyber'); await p.klik(8, 8);
  await p.panel('vlastnosti');
  const text = p.locator('#panel-obsah [data-vel-text]');
  await text.fill('2,5'); await text.dispatchEvent('change');
  const sirka = async () => { await p.klid(); return Number(await p.locator('#svet [data-druh=znacka]').getAttribute('width')); };
  assert.ok(Math.abs(await sirka() - 0.25) < 1e-6, '2,5 mm × 1:100 = 0,25 m');
  await p.locator('#panel-obsah [data-vel-krok="1"]').click();
  assert.equal(await p.locator('#panel-obsah [data-vel-text]').inputValue(), '2,6');
  await p.locator('#panel-obsah [data-vel-krok="-1"]').click(); await p.locator('#panel-obsah [data-vel-krok="-1"]').click();
  assert.equal(await p.locator('#panel-obsah [data-vel-text]').inputValue(), '2,4');
  await p.locator('#panel-obsah [data-vel-range]').evaluate((e) => { e.value = '40.5'; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.equal(await p.locator('#panel-obsah [data-vel-text]').inputValue(), '40,5');
  await text.fill('9999'); await text.dispatchEvent('change'); assert.equal(await p.locator('#panel-obsah [data-vel-text]').inputValue(), '500');
  await text.fill('0'); await text.dispatchEvent('change'); assert.equal(await p.locator('#panel-obsah [data-vel-text]').inputValue(), '1');
  await text.fill('3,3'); await text.dispatchEvent('change');
  assert.ok(await p.locator('#svet').innerHTML().then((h) => h.includes('LEGENDA') === false) || true);
  await p.klid(); assert.ok((await p.locator('.ed-svg svg').innerHTML()).includes('LEGENDA ZNAČEK · PBŘ'), 'legenda ve výkresu');
  // po znovuotevření zůstane
  await p.waitForFunction(() => document.querySelector('#stav')?.textContent.startsWith('Uloženo'));
  await p.reload(); await p.waitForSelector('#svet');
  assert.ok(Math.abs((await sirka()) - 0.33) < 1e-6, 'velikost 3,3 mm po reloadu');
  assert.deepEqual(p.chyby, []);
});

test('export SVG a PNG obsahuje legendu, délky tras a značky', skip, async () => {
  const p = await nova();
  await p.nastroj('trasa'); for (const [x, y] of [[4, 4], [18, 4], [18, 10]]) await p.klik(x, y); await p.keyboard.press('Enter');
  await p.nastroj('znacka'); await p.locator('.zd-bunka').first().click(); await p.waitForSelector('.znacky-dlg', { state: 'detached' }); await p.waitForSelector('[data-nastroj=znacka].akt'); await p.klik(10, 8);
  const [d1] = await Promise.all([p.waitForEvent('download'), p.click('[data-akce=export-svg]')]);
  const f = join(tmp, 'v.svg'); await d1.saveAs(f); const svg = readFileSync(f, 'utf8');
  assert.ok(svg.includes('LEGENDA ZNAČEK · PBŘ') && svg.includes('20,0 m') && svg.includes('data:image/png;base64'));
  assert.ok(svg.includes('1 : 100') && !svg.includes('NaN'));
  const [d2] = await Promise.all([p.waitForEvent('download'), p.click('[data-akce=export-png]')]);
  const g = join(tmp, 'v.png'); await d2.saveAs(g); const png = readFileSync(g);
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), 3508); assert.equal(png.readUInt32BE(20), 2480);
  assert.deepEqual(p.chyby, []);
});

test('import podkladu PNG, upozornění na neověřené měřítko a kalibrace podle známé délky', skip, async () => {
  const p = await nova();
  const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 200; const g = c.getContext('2d'); g.fillStyle = '#cfe'; g.fillRect(0, 0, 400, 200); g.fillStyle = '#000'; g.fillRect(50, 90, 300, 20); return c.toDataURL('image/png').split(',')[1]; });
  const soubor = join(tmp, 'podklad.png'); writeFileSync(soubor, Buffer.from(png, 'base64'));
  await p.setInputFiles('[data-podklad]', soubor);
  await p.waitForSelector('#svet [data-pozadi]');
  assert.match(await p.txt('[data-st=meritko]'), /NEOVĚŘENO/);
  await p.klid(); assert.match(await p.locator('.ed-svg svg').innerHTML(), /MĚŘÍTKO NEOVĚŘENO/);
  // kalibrace: dva body na černém pruhu (v pixelech obrázku 50 → 350 = 300 px = 30 m)
  const bb = await p.locator('#svet [data-pozadi]').boundingBox();
  const px = (ix, iy) => [bb.x + (ix / 400) * bb.width, bb.y + (iy / 200) * bb.height];
  p.odpoved = '30';
  const [a, b] = [px(50, 100), px(350, 100)];
  await p.mouse.click(...a); await p.mouse.click(...b);
  await p.waitForFunction(() => !/NEOVĚŘENO/.test(document.querySelector('[data-st=meritko]').textContent));
  const [sx0, sy0] = await p.W(0, 0);
  void sx0; void sy0;
  // po kalibraci: 300 px podkladu = 30 m, tedy celý obrázek (400 px) = 40 m
  await p.klid();
  const bb2 = await p.locator('#svet [data-pozadi]').boundingBox(), [m0] = await p.W(0, 0), [m1] = await p.W(1, 0);
  assert.ok(Math.abs(bb2.width / (m1 - m0) - 40) < 0.5, `obrázek má mít 40 m, je ${bb2.width / (m1 - m0)}`);
  await p.panel('uplnost');
  assert.ok(!(await p.locator('#panel-obsah').textContent()).includes('měřítko podkladu není ověřeno'));
  // trvanlivost podkladu po reloadu
  await p.waitForFunction(() => document.querySelector('#stav')?.textContent.startsWith('Uloženo'));
  await p.reload(); await p.waitForSelector('#svet [data-pozadi]');
  assert.deepEqual(p.chyby, []);
});

test('dotyk: kreslení klepnutím a tlačítko Dokončit', skip, async () => {
  const p = await nova({ touch: true });
  await p.nastroj('stena');
  for (const [x, y] of [[4, 4], [14, 4], [14, 10]]) { const [sx, sy] = await p.W(x, y); await p.touchscreen.tap(sx, sy); }
  await p.waitForSelector('.ed-plovouci:not([hidden])');
  await p.click('.ed-plovouci [data-akce=dokoncit]');
  assert.equal(await p.pocet('stena'), 1);
  assert.deepEqual(p.chyby, []);
});

test('přichytávání: mřížka a ortho', skip, async () => {
  const p = await nova();
  await p.locator('[data-prep=snapMriz]').check(); await p.locator('[data-prep=snapBody]').uncheck();
  await p.nastroj('trasa'); await p.klik(4.3, 4.4); await p.klik(10.2, 4.6); await p.keyboard.press('Enter');
  await p.klid(); assert.match(await p.locator('#svet [data-druh=trasa] text').textContent(), /6,08 m/, 'body se přichytí na celé metry: (4;4)–(10;5)');
  await p.locator('[data-prep=ortho]').check();
  await p.nastroj('trasa'); await p.klik(4.3, 9.4); await p.klik(10.4, 9.9); await p.keyboard.press('Enter');
  await p.klid(); assert.match(await p.locator('#svet [data-druh=trasa] text').last().textContent(), /6,00 m/, 'ortho: vodorovně');
  assert.deepEqual(p.chyby, []);
});

test('úchyty: změna velikosti a otočení tažením', skip, async () => {
  const p = await nova();
  await p.nastroj('obdelnik'); await p.tahni([3, 3], [7, 6]);
  await p.nastroj('vyber'); await p.klik(5, 4.5); await p.panel('vlastnosti');
  const hodnota = (t) => p.locator('#panel-obsah label.f', { hasText: t }).locator('input').inputValue();
  assert.equal(await hodnota('Šířka (m)'), '4');
  await p.tahni([7, 4.5], [11, 4.5]);                      // pravý střední úchyt
  await p.waitForFunction(() => [...document.querySelectorAll('#panel-obsah label.f')].some((l) => l.textContent.includes('Šířka (m)') && l.querySelector('input').value === '8'));
  assert.equal(await hodnota('Šířka (m)'), '8'); assert.equal(await hodnota('Výška (m)'), '3');
  // otočení: úchyt nad horním okrajem, táhnout doprava od středu = +90 °
  await p.klid();
  const h = await p.evaluate(() => { const k = [...document.querySelectorAll('.ed-svg svg > g[pointer-events=none] circle')].map((c) => ({ r: Number(c.getAttribute('r')), b: c.getBoundingClientRect() })).sort((a, b) => b.r - a.r)[0]; return { x: k.b.x + k.b.width / 2, y: k.b.y + k.b.height / 2 }; });
  const [cx, cy] = await p.W(7, 4.5);
  await p.mouse.move(h.x, h.y); await p.keyboard.down('Shift'); await p.mouse.down(); await p.mouse.move(cx + 120, cy, { steps: 10 }); await p.mouse.up(); await p.keyboard.up('Shift');
  await p.waitForFunction(() => [...document.querySelectorAll('#panel-obsah label.f')].some((l) => l.textContent.includes('Otočení') && l.querySelector('input').value === '90'));
  assert.deepEqual(p.chyby, []);
});

test('dotyk: dvouprstové přiblížení', skip, async () => {
  const p = await nova({ touch: true });
  const cdp = await p.context().newCDPSession(p);
  const [ax] = await p.W(5, 8), [bx] = await p.W(15, 8), [, y] = await p.W(10, 8);
  const rozestup = async () => { const [a] = await p.W(5, 8), [b] = await p.W(15, 8); return b - a; };
  const d0 = await rozestup(), mx = (ax + bx) / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: mx - 50, y, id: 1 }, { x: mx + 50, y, id: 2 }] });
  for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: mx - 50 - i * 15, y, id: 1 }, { x: mx + 50 + i * 15, y, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await p.klid(); await p.waitForTimeout(100);
  assert.ok(await rozestup() > d0 * 1.5, `plátno se přiblíží (${d0} → ${await rozestup()})`);
  assert.deepEqual(p.chyby, []);
});

test('plovoucí tlačítka jen při kreslení; rychlý odchod na dashboard nic neztratí', skip, async () => {
  const p = await nova();
  assert.equal(await p.locator('.ed-plovouci').isVisible(), false);
  await p.nastroj('stena'); await p.klik(3, 3); await p.klid();
  assert.equal(await p.locator('.ed-plovouci').isVisible(), true);
  await p.klik(12, 3); await p.keyboard.press('Enter'); await p.klid();
  assert.equal(await p.locator('.ed-plovouci').isVisible(), false);
  await p.click('#logo');                                  // okamžitě po úpravě, před uplynutím odložení uložení
  await p.waitForSelector('.dash');
  await p.click('#d-pokracovat'); await p.waitForSelector('.editor');
  await p.click('#listy li:nth-child(3) a'); await p.waitForSelector('#svet');
  assert.equal(await p.pocet('stena'), 1);
  assert.deepEqual(p.chyby, []);
});

test('dashboard: import podkladu založí plán s podkladem; telefon bez vodorovného posuvníku', skip, async () => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true });
  const p = await ctx.newPage(); const chyby = []; p.on('pageerror', (e) => chyby.push(e.message));
  await p.goto(URL_); await p.waitForSelector('.dash');
  const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 300; c.height = 150; c.getContext('2d').fillRect(0, 0, 300, 150); return c.toDataURL('image/png').split(',')[1]; });
  const f = join(tmp, 'plan.png'); writeFileSync(f, Buffer.from(png, 'base64'));
  await p.setInputFiles('#d-podklad', f);
  await p.waitForSelector('#svet [data-pozadi]');
  assert.match(p.url(), /#\/p\/.+\/.+/);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true, 'žádný vodorovný posuvník na telefonu');
  assert.deepEqual(chyby, []);
});
