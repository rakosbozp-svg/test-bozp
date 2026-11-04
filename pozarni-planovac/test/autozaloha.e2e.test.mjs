// E2E automatické zálohy v Chromiu. Skutečné úložiště artefaktu (claude.ai) tu není, proto test podstrčí
// falešné db/user z test/falesne-uloziste.mjs (window.claude.use) a zkrátí prodlevu zálohy. Spuštění: npm run test:e2e
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { falesneUloziste } from './falesne-uloziste.mjs';

const require = createRequire(import.meta.url);
let chromium;
for (const m of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(m)); break; } catch { /* další */ } }
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8801, URL_ = `http://localhost:${PORT}/index.html`;
const ZDROJ = falesneUloziste.toString();

async function kontext(browser, { claude = true, uid = 'u1', dokumenty = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  if (claude) {
    await ctx.addInitScript(({ zdroj, uid: id, dokumenty: d }) => {
      const f = new Function(`return (${zdroj})`)()({ dokumenty: d, uid: id });
      window.__falesne = f; window.claude = f.claude; window.__PP_PRODLEVA_ZALOHY__ = 300;
    }, { zdroj: ZDROJ, uid, dokumenty });
  }
  return ctx;
}
async function stranka(ctx) {
  const page = await ctx.newPage(), chyby = [];
  page.on('pageerror', (e) => chyby.push(e.message)); page.on('console', (m) => m.type() === 'error' && chyby.push(m.text()));
  return { page, chyby };
}
async function novaDzp(page, nazev, objekt) {
  await page.goto(`${URL_}#/dzp`); await page.waitForSelector('.dash');
  await page.fill('#d-novy [name=nazev]', nazev); await page.click('#d-novy button'); await page.waitForSelector('.editor');
  await page.fill('[data-pole="objekt.nazev"]', objekt);
}
const zalohovano = (page) => page.waitForFunction(() => {
  const k = Object.keys(window.__falesne.dokumenty);
  return k.some((x) => /^data\/users\/u1\/[^/]+$/.test(x)) && k.some((x) => x.includes('/casti/'));
}, null, { timeout: 5000 });

test('automatická záloha: napojení na ukládání a karta na úvodní stránce', { skip: !chromium && 'Playwright není dostupný' }, async (t) => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    await t.test('úprava projektu se sama zazálohuje a karta ukáže stav', async () => {
      const ctx = await kontext(browser), { page, chyby } = await stranka(ctx);
      await novaDzp(page, 'DZP záloha', 'Hala zálohy');
      await zalohovano(page);
      await page.click('#logo'); await page.waitForSelector('.dash');
      await page.waitForFunction(() => /Zálohováno: 1 projekt/.test(document.querySelector('#d-autozaloha-stav')?.textContent || ''), null, { timeout: 5000 });
      assert.ok(await page.isVisible('#d-autozaloha'));
      assert.match(await page.textContent('#d-autozaloha-stav'), /^Zálohováno: 1 projekt · naposledy před chvílí$/);
      assert.deepEqual(chyby, []);
      await ctx.close();
    });

    await t.test('bez claude.use se karta nezobrazí a nic nespadne', async () => {
      const ctx = await kontext(browser, { claude: false }), { page, chyby } = await stranka(ctx);
      await novaDzp(page, 'DZP bez zálohy', 'Hala');
      await page.click('#logo'); await page.waitForSelector('.dash');
      await page.waitForTimeout(500);
      assert.equal(await page.locator('#d-autozaloha').count(), 1, 'karta je v přehledu, jen skrytá');
      assert.ok(await page.isHidden('#d-autozaloha'));
      assert.deepEqual(chyby, []);
      await ctx.close();
    });

    await t.test('odhlášený uživatel (uid null): karta skrytá, ukládání funguje', async () => {
      const ctx = await kontext(browser, { uid: null }), { page, chyby } = await stranka(ctx);
      await novaDzp(page, 'DZP odhlášený', 'Hala odhlášená');
      await page.waitForTimeout(600);
      await page.reload(); await page.waitForSelector('.editor');
      assert.equal(await page.inputValue('[data-pole="objekt.nazev"]'), 'Hala odhlášená');
      await page.click('#logo'); await page.waitForSelector('.dash');
      await page.waitForTimeout(500);
      assert.equal(await page.locator('#d-autozaloha').count(), 1, 'karta je v přehledu, jen skrytá');
      assert.ok(await page.isHidden('#d-autozaloha'));
      assert.deepEqual(Object.keys(await page.evaluate(() => window.__falesne.dokumenty)), []);
      assert.deepEqual(chyby, []);
      await ctx.close();
    });
  } finally { await browser.close(); srv.kill(); }
});
