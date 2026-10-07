// E2E test hlavních pracovních toků v Chromiu. Spuštění: npm run test:e2e (potřebuje Playwright a Chromium).
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
const dlg = async (page, text) => {
  await page.waitForSelector('.dlg[open]');
  if (text !== undefined) await page.fill('.dlg input[name=hodnota]', text);
  await page.click('.dlg [data-vysledek=ok]');
  await page.waitForSelector('.dlg', { state: 'detached' });
};
const PORT = 8791, URL_ = `http://localhost:${PORT}/index.html`;

test('E2E: dashboard, formulář, uložení, kontrola úplnosti, listy, záloha', { skip: !chromium && 'Playwright není dostupný' }, async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT)], { cwd: root, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ acceptDownloads: true });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));   // písma Google v testu nepotřebujeme
    const page = await ctx.newPage();
    const chyby = []; page.on('pageerror', (e) => chyby.push(e.message)); page.on('console', (m) => m.type() === 'error' && chyby.push(m.text()));

    await page.goto(URL_);
    await page.fill('#d-novy [name=nazev]', 'DZP Test');
    await page.click('#d-novy button');
    await page.waitForSelector('.editor');
    assert.match(page.url(), /#\/p\//);

    // vyplnění pole + persistence po reloadu
    await page.fill('[data-pole="objekt.nazev"]', 'Hala PREFA 1');
    await page.click('[data-ne="objekt.omezeni"]');
    await page.waitForFunction(() => document.querySelector('#stav')?.textContent.startsWith('Uloženo'));
    await page.reload();
    await page.waitForSelector('[data-pole="objekt.nazev"]');
    assert.equal(await page.inputValue('[data-pole="objekt.nazev"]'), 'Hala PREFA 1');
    assert.equal(await page.inputValue('[data-pole="objekt.omezeni"]'), 'NE');

    // kontrola úplnosti reaguje na změnu
    const pocetChyb = async () => Number((await page.textContent('.odz.cer')).split(' ')[0]);
    const pred = await pocetChyb();
    await page.fill('[data-pole="objekt.adresa"]', 'Litice nad Orlicí');
    assert.equal(await pocetChyb(), pred - 1);
    assert.ok(pred > 10);
    // klik na nález přeskočí na pole
    await page.click('.nalezy button >> nth=0');
    assert.ok(await page.evaluate(() => document.activeElement && document.activeElement.matches('input,select,textarea,button')));

    // desetinné číslo s čárkou (GPS) a nečíselný vstup se nepřijme
    await page.fill('[data-pole="objekt.gps.sirka"]', '49,3512');
    await page.fill('[data-pole="objekt.gps.delka"]', 'abc');
    assert.ok(await page.$('[data-pole="objekt.gps.delka"].neplatne'));

    // nebezpečí se značkou z katalogu
    await page.click('[data-akce="pridej"][data-kolekce="nebezpeci"]');
    await page.click('.zn-btn >> nth=0');
    await page.fill('.znacky-dlg input[type=search]', 'hydrant');
    await page.click('.zd-bunka >> nth=0');
    await page.waitForSelector('.zn-btn img.zn');
    // FVE
    await page.selectOption('[data-fve=pritomna]', 'ano');
    await page.fill('[data-fve=vykonKWp]', '460');
    // náhled A4
    await page.click('[data-z=nahled]');
    assert.ok((await page.textContent('#nahled-a4')).includes('Hala PREFA 1'));
    assert.ok((await page.textContent('#nahled-a4')).includes('460 kWp'));
    await page.click('[data-z=formular]');

    // listy: přidat, přejmenovat, kopie, smazat
    const pocetListu = () => page.locator('#listy li').count();
    const n0 = await pocetListu();
    await page.selectOption('#l-typ', 'text'); await page.click('#l-pridej'); await dlg(page, 'Poznámky');
    await page.waitForSelector('#t-text');
    assert.equal(await pocetListu(), n0 + 1);
    await page.click('#l-prejm'); await dlg(page, 'Přejmenovaný list');
    await page.waitForFunction(() => document.querySelector('#listy li.akt')?.textContent.includes('Přejmenovaný list'));
    const cekejListy = (n) => page.waitForFunction((x) => document.querySelectorAll('#listy li').length === x, n);
    await page.click('#l-kopie'); await cekejListy(n0 + 2);
    await page.click('#l-smaz'); await dlg(page); await cekejListy(n0 + 1);

    // metodika a revize
    await page.click('[data-p=metodika]'); assert.ok((await page.textContent('#panel-obsah')).includes('Operativní karta'));
    await page.click('[data-p=projekt]'); await page.fill('#p-rev [name=popis]', 'Zapracování připomínek'); await page.click('#p-rev button');
    assert.ok((await page.textContent('.revize-seznam')).includes('Zapracování připomínek'));

    // logo → dashboard, pokračovat
    await page.click('#logo'); await page.waitForSelector('.dash');
    assert.ok(await page.$('#d-pokracovat'));

    // záloha a import
    await page.click('.projekty [data-akce=stahnout]');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.projekty [data-akce=stahnout]')]);
    const f = join(mkdtempSync(join(tmpdir(), 'pp-')), 'z.pplan.json'); await dl.saveAs(f);
    const zaloha = JSON.parse(readFileSync(f, 'utf8'));
    assert.equal(zaloha.listy[0].karta.objekt.nazev, 'Hala PREFA 1');
    assert.equal(zaloha.listy[0].karta.fve.vykonKWp, 460);
    await page.setInputFiles('#d-import', f);
    await page.waitForSelector('.editor');
    assert.equal(await page.inputValue('[data-pole="objekt.nazev"]'), 'Hala PREFA 1');
    assert.deepEqual(chyby, []);
  } finally { await browser.close(); srv.kill(); }
});
