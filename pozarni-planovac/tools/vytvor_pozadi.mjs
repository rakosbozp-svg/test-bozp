// Vytvoří obrázky tematického pozadí úvodní stránky do pozadi/ (WebP). Použití: npm run pozadi
//   situace-dzp.webp  – vzorová situace DZP Litice (podklady/priklady/Litice_situace_DZP_FVE.pdf), výřez bez razítka
//                       se jménem zpracovatele a bez severky; do webové verze se nepřibaluje (údaje o skutečném areálu).
//   unikovy-plan.webp – abstraktní únikový plán smyšleného podlaží (značky východů a shromaždiště dodané uživatelem).
// Potřebuje pdftoppm (poppler-utils) a Playwright s Chromiem. Hotové obrázky se commitují, aplikace je jen zobrazuje.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { EVAK_DODANE } from '../js/evakvychozi.js';

const require = createRequire(import.meta.url);
let chromium;
for (const m of ['playwright', '/opt/node-tools/node_modules/playwright']) { try { ({ chromium } = require(m)); break; } catch { /* další */ } }
if (!chromium) throw new Error('Chybí Playwright s Chromiem (require("playwright")).');
const koren = join(dirname(fileURLToPath(import.meta.url)), '..'), cil = join(koren, 'pozadi');
const SIRKA = 1600, KVALITA = 0.6;   // pozadí je vybledlé (krytí 12 %), větší rozlišení ani kvalita nejsou vidět

// Situace DZP: stránka A4 na šířku; síť s areálem končí nad severkou a razítkem (zlomky šířky/výšky stránky).
const VYREZ_SITUACE = { x: 0.055, y: 0.02, w: 0.93, h: 0.815 };

// Abstraktní únikový plán (pozadí evakuačních plánů): smyšlené podlaží 56 × 40 m – místnosti, sytě zelené únikové chodby
// s bílými šipkami k východům, značky nouzových východů a shromaždiště (dodané uživatelem) a bod „Jste zde“.
// Bez drobných textů a detailů, aby byl plán vidět i při krytí 12 % a kolem karet úvodní stránky.
function abstraktniPlan() {
  const W = 1600, H = 1000, X0 = -7, Y0 = -4, M = Math.min(W / 70, H / 48), ox = (W - 70 * M) / 2, oy = (H - 48 * M) / 2;
  const X = (x) => +(ox + (x - X0) * M).toFixed(1), Y = (y) => +(oy + (y - Y0) * M).toFixed(1), D = (m) => +(m * M).toFixed(1);
  const ZELENA = '#14a05a', TMAVE_ZELENA = '#0b7a43', STENA = '#1e293b', MISTNOST = '#e8eef5', MODRA = '#1f5fbf';
  const obd = (x, y, w, h, styl) => `<rect x="${X(x)}" y="${Y(y)}" width="${D(w)}" height="${D(h)}" ${styl}/>`;
  const pas = [0, 7, 14, 21, 28, 35, 42, 49];
  const mistnosti = [
    ...pas.flatMap((x) => [[x, 0, 7, 11], [x, 29, 7, 11]]),
    ...[[0, 9], [9, 9], [18, 8.75], [29.25, 9], [38.25, 9], [47.25, 8.75]].flatMap(([x, w]) => [[x, 13.5, w, 6.5], [x, 20, w, 6.5]]),
  ];
  const chodby = [[-0.6, 11, 57.2, 2.5], [-0.6, 26.5, 57.2, 2.5], [26.75, 13.5, 2.5, 13]];   // přesah ven = otvory východů v obvodové stěně
  // šipka (dřík + hrot) se středem v bodě, směr (ux, uy), délka 1,8 m
  const sipka = (x, y, ux, uy, barva = '#fff', a = 1.8) => {
    const tvar = [[-0.5, -0.17], [0.05, -0.17], [0.05, -0.42], [0.5, 0], [0.05, 0.42], [0.05, 0.17], [-0.5, 0.17]];
    return `<polygon points="${tvar.map(([p, q]) => `${X(x + (p * ux - q * uy) * a)},${Y(y + (p * uy + q * ux) * a)}`).join(' ')}" fill="${barva}"/>`;
  };
  const sipky = [
    ...[24, 19, 14, 9, 4].flatMap((x) => [sipka(x, 12.25, -1, 0), sipka(x, 27.75, -1, 0)]),
    ...[32, 37, 42, 47, 52].flatMap((x) => [sipka(x, 12.25, 1, 0), sipka(x, 27.75, 1, 0)]),
    sipka(28, 17, 0, -1), sipka(28, 23, 0, 1),
    // z místností do chodeb (zelené)
    ...[10.5, 24.5, 38.5, 52.5].map((x) => sipka(x, 8.6, 0, 1, ZELENA, 1.6)), ...[17.5, 31.5, 45.5].map((x) => sipka(x, 31.4, 0, -1, ZELENA, 1.6)),
    ...[13.5, 42.75].map((x) => sipka(x, 15.9, 0, -1, ZELENA, 1.6)), ...[4.5, 51.6].map((x) => sipka(x, 24.1, 0, 1, ZELENA, 1.6)),
  ];
  const schody = [];
  for (let y = 2; y <= 9.6; y += 0.6) schody.push(`M${X(49.8)} ${Y(y)}H${X(55.2)}`);
  for (let y = 30.8; y <= 38.4; y += 0.6) schody.push(`M${X(0.8)} ${Y(y)}H${X(6.2)}`);
  const znacka = (id, x, y, a = 3) => `<image href="${EVAK_DODANE[id]}" x="${X(x - a / 2)}" y="${Y(y - a / 2)}" width="${D(a)}" height="${D(a)}"/>`;
  const cestaVen = `<path d="M${X(-0.6)} ${Y(27.75)}H${X(-4.5)}V${Y(32.6)}" fill="none" stroke="${ZELENA}" stroke-width="${D(0.5)}" stroke-dasharray="${D(0.9)} ${D(0.6)}" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#fff"/>` +
    mistnosti.map(([x, y, w, h]) => obd(x, y, w, h, `fill="${MISTNOST}" stroke="${STENA}" stroke-width="${D(0.28)}"`)).join('') +
    `<path d="${schody.join('')}" stroke="${STENA}" stroke-width="${D(0.14)}"/>` +
    obd(0, 0, 56, 40, `fill="none" stroke="${STENA}" stroke-width="${D(0.7)}"`) +
    chodby.map(([x, y, w, h]) => obd(x, y, w, h, `fill="${ZELENA}"`)).join('') +
    sipky.join('') + cestaVen +
    `<rect x="${X(-5.4)}" y="${Y(7.8)}" width="${D(3.6)}" height="${D(3.6)}" rx="${D(0.3)}" fill="${TMAVE_ZELENA}"/>${znacka('EVAK-001', -3.6, 9.6)}` +
    `<rect x="${X(-5.4)}" y="${Y(23.3)}" width="${D(3.6)}" height="${D(3.6)}" rx="${D(0.3)}" fill="${TMAVE_ZELENA}"/>${znacka('EVAK-001', -3.6, 25.1)}` +
    `<rect x="${X(57.8)}" y="${Y(7.8)}" width="${D(3.6)}" height="${D(3.6)}" rx="${D(0.3)}" fill="${TMAVE_ZELENA}"/>${znacka('EVAK-014', 59.6, 9.6)}` +
    `<rect x="${X(57.8)}" y="${Y(23.3)}" width="${D(3.6)}" height="${D(3.6)}" rx="${D(0.3)}" fill="${TMAVE_ZELENA}"/>${znacka('EVAK-014', 59.6, 25.1)}` +
    znacka('EVAK-002', -4.5, 35, 3.6) +
    `<circle cx="${X(40)}" cy="${Y(12.25)}" r="${D(1.9)}" fill="${MODRA}" fill-opacity=".3"/>` +
    `<circle cx="${X(40)}" cy="${Y(12.25)}" r="${D(0.8)}" fill="${MODRA}" stroke="#fff" stroke-width="${D(0.25)}"/>` +
    `<path d="M${X(40.6)} ${Y(11.5)}L${X(42)} ${Y(9.4)}" stroke="${MODRA}" stroke-width="${D(0.35)}"/>` +
    `<rect x="${X(41.2)}" y="${Y(6.9)}" width="${D(7.4)}" height="${D(2.6)}" rx="${D(0.4)}" fill="${MODRA}"/>` +
    `<text x="${X(44.9)}" y="${Y(8.65)}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="${D(1.45)}" fill="#fff">Jste zde</text>` +
    '</svg>';
}

// Obrázek (data URL) → výřez (zlomky) → šířka SIRKA px → WebP. Kreslí Chromium, ať je výsledek stejný jako v prohlížeči.
async function naWebp(page, src, vyrez = { x: 0, y: 0, w: 1, h: 1 }) {
  const url = await page.evaluate(async ([s, o, sirka, q]) => {
    const i = new Image(); i.src = s; await i.decode();
    const sx = i.naturalWidth * o.x, sy = i.naturalHeight * o.y, sw = i.naturalWidth * o.w, sh = i.naturalHeight * o.h;
    const c = document.createElement('canvas'); c.width = sirka; c.height = Math.round(sirka * sh / sw);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(i, sx, sy, sw, sh, 0, 0, c.width, c.height);
    return c.toDataURL('image/webp', q);
  }, [src, vyrez, SIRKA, KVALITA]);
  if (!url.startsWith('data:image/webp;base64,')) throw new Error('Prohlížeč neumí kódovat WebP');
  return Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
}

const tmp = mkdtempSync(join(tmpdir(), 'pp-pozadi-'));
const browser = await chromium.launch();
try {
  mkdirSync(cil, { recursive: true });
  const page = await browser.newPage();
  execFileSync('pdftoppm', ['-r', '200', '-png', '-singlefile', join(koren, 'podklady/priklady/Litice_situace_DZP_FVE.pdf'), join(tmp, 'situace')]);
  const situace = await naWebp(page, `data:image/png;base64,${readFileSync(join(tmp, 'situace.png')).toString('base64')}`, VYREZ_SITUACE);
  const plan = await naWebp(page, `data:image/svg+xml;base64,${Buffer.from(abstraktniPlan(), 'utf8').toString('base64')}`);
  writeFileSync(join(cil, 'situace-dzp.webp'), situace);
  writeFileSync(join(cil, 'unikovy-plan.webp'), plan);
  console.log(`pozadi/situace-dzp.webp ${(situace.length / 1024).toFixed(0)} kB, pozadi/unikovy-plan.webp ${(plan.length / 1024).toFixed(0)} kB`);
} finally { await browser.close(); rmSync(tmp, { recursive: true, force: true }); }
