// Jednosouborová sestava (dist/pozarni-planovac.html) otevřená přímo ze souboru (file://), bez serveru.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
for (const m of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(m)); break; } catch { /* další */ } }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'pp-1s-'));

test('jedna HTML bez serveru: projekt, kreslení, značky z vloženého katalogu, import DXF a PDF (worker pdf.js), export', { skip: !chromium && 'Playwright není dostupný' }, async () => {
  execSync('node tools/sestav_jeden_soubor.mjs', { cwd: root, stdio: 'pipe' });
  assert.ok(existsSync(join(root, 'dist/pozarni-planovac.html')));
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, acceptDownloads: true });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const p = await ctx.newPage(); const chyby = [];
    p.on('pageerror', (e) => chyby.push(e.message)); p.on('console', (m) => m.type() === 'error' && chyby.push(m.text()));
    await p.goto(pathToFileURL(join(root, 'dist/pozarni-planovac.html')).href);
    await p.waitForSelector('.dash');
    const ok = async () => { const h = await p.waitForSelector('.dlg[open]'); await p.click('.dlg [data-vysledek=ok]'); await p.waitForFunction((el) => !el.isConnected, h); };
    // referenční projekt je vložený
    await p.click('#d-litice'); await p.waitForSelector('.editor');
    assert.equal(await p.inputValue('[data-fve=vykonKWp]'), '460');
    // nový půdorys, stěna, značka z vloženého katalogu (data URI)
    await p.selectOption('#l-typ', 'pudorys'); await p.click('#l-pridej'); await p.fill('.dlg input[name=hodnota]', 'Půdorys'); await ok(); await p.waitForSelector('#svet');
    const W = (x, y) => p.evaluate(([a, b]) => { const m = document.querySelector('#svet').getScreenCTM(), q = new DOMPoint(a, b).matrixTransform(m); return [q.x, q.y]; }, [x, y]);
    await p.click('[data-nastroj=stena]'); for (const [x, y] of [[3, 3], [15, 3], [15, 12]]) await p.mouse.click(...await W(x, y)); await p.keyboard.press('Enter');
    await p.click('[data-nastroj=znacka]'); await p.fill('.znacky-dlg input[type=search]', 'hydrant');
    assert.match(await p.locator('.zd-bunka img').first().getAttribute('src'), /^data:image\/png;base64,/);
    await p.locator('.zd-bunka').first().click(); await p.waitForSelector('[data-nastroj=znacka].akt'); await p.mouse.click(...await W(8, 8));
    await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    assert.equal(await p.locator('#svet [data-druh=znacka]').count(), 1);
    // import DXF
    await p.setInputFiles('[data-podklad]', join(root, 'test/fixtury/hala_m.dxf')); await ok(); await ok();
    assert.ok((await p.locator('#svet [data-druh=stena]').count()) >= 3);
    // import vektorového PDF (pdf.js + worker z blob URL)
    const st = await ctx.newPage();
    await st.setContent('<body style="margin:0"><svg width="400" height="300" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="20" width="200" height="100" fill="none" stroke="black"/><text x="30" y="60" font-size="20">Sklad</text></svg></body>');
    const pdf = join(tmp, 'x.pdf'); writeFileSync(pdf, await st.pdf({ width: '400px', height: '300px', printBackground: true })); await st.close();
    await p.setInputFiles('[data-podklad]', pdf); await ok();
    await p.waitForSelector('.dlg[open]', { timeout: 60000 }); assert.match(await p.locator('.dlg').textContent(), /Převedeno/); await ok();
    assert.ok((await p.locator('#svet [data-druh=text]').allTextContents()).some((t) => t.includes('Sklad')));
    // export SVG s vloženými obrázky značek
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-akce=export-svg]')]);
    const f = join(tmp, 'v.svg'); await dl.saveAs(f);
    assert.match(require('node:fs').readFileSync(f, 'utf8'), /LEGENDA ZNAČEK/);
    assert.deepEqual(chyby, []);
  } finally { await browser.close(); }
});
