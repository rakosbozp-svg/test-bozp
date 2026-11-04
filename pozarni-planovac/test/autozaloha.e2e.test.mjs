// E2E automatické zálohy v Chromiu. Skutečné úložiště artefaktu (claude.ai) tu není, proto test podstrčí
// falešné db/user z test/falesne-uloziste.mjs (window.claude.use) a zkrátí prodlevu zálohy. Spuštění: npm run test:e2e
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, execSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
// Čeká, až se záloha uklidní (žádný zápis do úložiště 800 ms a aspoň jeden zápis proběhl).
const ticho = (page) => page.waitForFunction(() => {
  const n = window.__falesne.stav.zapisy.length;
  if (window.__pocetZapisu !== n) { window.__pocetZapisu = n; window.__casZapisu = Date.now(); return false; }
  return n > 0 && Date.now() - window.__casZapisu > 800;
}, null, { timeout: 15000, polling: 100 });
const hlavicka = (page) => page.evaluate(() => Object.entries(window.__falesne.dokumenty).find(([k]) => /^data\/users\/u1\/[^/]+$/.test(k)) || null);
const stavKarty = (page, re) => page.waitForFunction((r) => new RegExp(r).test(document.querySelector('#d-autozaloha-stav')?.textContent || ''), re.source, { timeout: 8000 });
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

test('automatická záloha: obnova, dialog zálohy, připomínka', { skip: !chromium && 'Playwright není dostupný' }, async (t) => {
  const srv = spawn('python3', ['-m', 'http.server', '8802'], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch(), U2 = 'http://localhost:8802/index.html';
  const novaDzp2 = async (page, nazev, objekt) => {
    await page.goto(`${U2}#/dzp`); await page.waitForSelector('.dash');
    await page.fill('#d-novy [name=nazev]', nazev); await page.click('#d-novy button'); await page.waitForSelector('.editor');
    await page.fill('[data-pole="objekt.nazev"]', objekt);
  };
  const ok = async (page) => { const d = page.locator('.dlg[open]').last(); await d.locator('[data-vysledek=ok]').click(); };
  try {
    await t.test('nový prohlížeč se stejnou zálohou nabídne obnovu a vrátí projekt', async () => {
      const ctxA = await kontext(browser), { page: a, chyby: chybyA } = await stranka(ctxA);
      await novaDzp2(a, 'DZP obnova', 'Hala obnovy');
      await ticho(a);
      const dokumenty = await a.evaluate(() => window.__falesne.dokumenty);
      await ctxA.close();
      const ctxB = await kontext(browser, { dokumenty }), { page: b, chyby } = await stranka(ctxB);
      await b.goto(`${U2}#/dzp`); await b.waitForSelector('#d-obnova-zalohy', { timeout: 8000 });
      assert.equal((await b.textContent('#d-obnova-zalohy .rk-alert__body')).trim(), 'V automatické záloze je 1 projekt, který v tomto prohlížeči není.');
      await b.click('#d-obnovit-zalohu');
      await b.waitForSelector('.dlg[open]'); await ok(b); await b.waitForSelector('.dlg', { state: 'detached' });
      await b.waitForFunction(() => [...document.querySelectorAll('.projekty li')].some((li) => li.textContent.includes('DZP obnova')));
      await b.waitForFunction(() => !document.querySelector('#d-obnova-zalohy'));
      await b.click('.projekty li a'); await b.waitForSelector('.editor');
      assert.equal(await b.inputValue('[data-pole="objekt.nazev"]'), 'Hala obnovy');
      assert.deepEqual([...chybyA, ...chyby], []);
      await ctxB.close();
    });

    await t.test('smazaný projekt zůstane v záloze a jde odstranit', async () => {
      const ctx = await kontext(browser), { page, chyby } = await stranka(ctx);
      await novaDzp2(page, 'DZP smazání', 'Hala smazání');
      await ticho(page);
      const [cesta] = await hlavicka(page), seg = cesta.split('/').pop();
      await page.click('#logo'); await page.waitForSelector('.dash');
      await page.click('.projekty [data-akce=smaz]'); await ok(page);
      await page.waitForSelector('.dlg', { state: 'detached' }); await page.waitForSelector('.dash');
      assert.equal(await page.locator('#d-obnova-zalohy').count(), 0, 'hned po smazání se smazaný projekt nenabízí k obnově');
      await page.waitForFunction((c) => window.__falesne.dokumenty[c]?.smazano, cesta, { timeout: 8000 });
      assert.equal(await page.locator('#d-obnova-zalohy').count(), 0, 'smazaný projekt se v nabídce obnovy neukáže');
      await page.click('#d-autozaloha-zobrazit'); await page.waitForSelector('.dlg[open]');
      assert.match(await page.textContent('.dlg[open]'), /smazán v prohlížeči/);
      await page.click('.dlg[open] [data-odstranit-zalohu]');
      await page.waitForFunction(() => document.querySelectorAll('.dlg[open]').length === 2);
      await ok(page);
      await page.waitForFunction((s2) => !Object.keys(window.__falesne.dokumenty).some((k) => k.split('/').includes(s2)), seg, { timeout: 8000 });
      await page.click('.dlg[open] [data-vysledek=zrusit]'); await page.waitForSelector('.dlg', { state: 'detached' });
      assert.deepEqual(chyby, []);
      await ctx.close();
    });

    await t.test('plné úložiště: hláška na kartě', async () => {
      const ctx = await kontext(browser), { page, chyby } = await stranka(ctx);
      await page.goto(`${U2}#/dzp`); await page.waitForSelector('.dash');
      await page.evaluate(() => { window.__falesne.stav.pred = (v) => { if (v === 'set') throw { code: 'quota_exceeded', message: 'plné' }; }; });
      await page.fill('#d-novy [name=nazev]', 'DZP plno'); await page.click('#d-novy button'); await page.waitForSelector('.editor');
      await page.waitForTimeout(1200);
      await page.click('#logo'); await page.waitForSelector('.dash');
      await stavKarty(page, /Úložiště artefaktu je plné\./);
      assert.match(await page.textContent('#d-autozaloha-stav'), /Zkusí se znovu při další změně\.$/);
      assert.deepEqual(chyby, []);
      await ctx.close();
    });

    await t.test('připomínka ruční zálohy při běžící záloze až po 30 dnech', async () => {
      const ctx = await kontext(browser), { page, chyby } = await stranka(ctx);
      await novaDzp2(page, 'DZP připomínka', 'Hala');
      await ticho(page);
      await page.evaluate(() => localStorage.setItem('pp.zaloha', new Date(Date.now() - 10 * 86400000).toISOString()));
      await page.goto(`${U2}#/dzp`); await page.reload(); await page.waitForSelector('.dash');
      await stavKarty(page, /^Zálohováno: 1 projekt/);
      assert.equal(await page.locator('#d-pripominka').count(), 0, 'po 10 dnech bez připomínky');
      await page.evaluate(() => localStorage.setItem('pp.zaloha', new Date(Date.now() - 31 * 86400000).toISOString()));
      await page.reload(); await page.waitForSelector('.dash');
      await stavKarty(page, /^Zálohováno: 1 projekt/);
      await page.waitForSelector('#d-pripominka');
      assert.match(await page.textContent('#d-pripominka'), /Automatická záloha běží\. Jednou za měsíc si stáhněte i kopii mimo claude\.ai \(Zálohovat všechny projekty\)\./);
      assert.deepEqual(chyby, []);
      await ctx.close();
    });
  } finally { await browser.close(); srv.kill(); }
});

test('jednosouborová sestava obsahuje automatickou zálohu', { skip: !chromium && 'Playwright není dostupný' }, async () => {
  execSync('node tools/sestav_jeden_soubor.mjs', { cwd: root, stdio: 'pipe' });
  const browser = await chromium.launch();
  try {
    const ctx = await kontext(browser), { page, chyby } = await stranka(ctx);
    await page.goto(`${pathToFileURL(join(root, 'dist/pozarni-planovac.html')).href}#/dzp`); await page.waitForSelector('.dash');
    await page.fill('#d-novy [name=nazev]', 'DZP jedna HTML'); await page.click('#d-novy button'); await page.waitForSelector('.editor');
    await page.fill('[data-pole="objekt.nazev"]', 'Hala jedna HTML');
    await zalohovano(page);
    await page.click('#logo'); await page.waitForSelector('.dash');
    await page.waitForFunction(() => /Zálohováno: 1 projekt/.test(document.querySelector('#d-autozaloha-stav')?.textContent || ''), null, { timeout: 8000 });
    assert.ok(await page.isVisible('#d-autozaloha'));
    assert.deepEqual(chyby, []);
    await ctx.close();
  } finally { await browser.close(); }
});
