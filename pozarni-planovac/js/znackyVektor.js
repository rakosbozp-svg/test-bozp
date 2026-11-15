// Vektorové verze nejčastějších značek DZP (ČAHD, Hanuška 1996 příl. 1). Obrázky v katalogu (znacky/png) jsou vyřezané
// z nízko rozlišeného skenu, takže v PDF a při zvětšení byly rozmazané. Tyto přepisy jsou ostré v editoru, v legendě, v náhledech
// (img s data URI) i v PDF (svg2pdf je kreslí jako křivky). Tvar a barvy odpovídají obrázkům v katalogu, poměr stran také
// (kontroluje test/znackyVektor.test.mjs), takže se velikost a poloha značek v existujících projektech nemění.
// Jen prvky, které umí js/pdf/svg2pdf.js: g, line, polyline, polygon, rect, circle, ellipse, path, text. Výplně bez děr
// (svg2pdf vyplňuje každou podcestu zvlášť) – prstence jsou obtažené kružnice.

const f = (n) => (Math.round(n * 1000) / 1000).toString();
const fk = (n) => String(+n.toPrecision(7));   // měřítko značky: přesně, i když je výkres v metrech a značka malá
const MODRA = '#0000ff', ZLUTA = '#ffd700', CERVENA = '#ff0000', CERNA = '#000000', BILA = '#ffffff';
const PISMO = 'font-family="Arial,sans-serif"';

const kruh = (cx, cy, r, c, sw, vypln = 'none') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${vypln}" stroke="${c}" stroke-width="${f(sw)}"/>`;
const cara = (x1, y1, x2, y2, c, sw) => `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${c}" stroke-width="${f(sw)}"/>`;
const mnohouhelnik = (body, vypln, extra = '') => `<polygon points="${body.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="${vypln}"${extra}/>`;
const text = (x, y, vel, c, t, tucne = false) => `<text x="${f(x)}" y="${f(y)}" font-size="${f(vel)}" ${PISMO}${tucne ? ' font-weight="700"' : ''} text-anchor="middle" fill="${c}">${t}</text>`;
const krizRohy = (x0, y0, x1, y1, c, sw) => cara(x0, y0, x1, y1, c, sw) + cara(x1, y0, x0, y1, c, sw);

// hlavní uzávěr (DZP-055 voda, DZP-005 plyn, DZP-011 hořlavé kapaliny): dvě soustředné kružnice a kříž z rohů
const uzaverHlavni = (w, h, c, sw) => { const R = Math.min(w, h) / 2 - 0.55; return kruh(w / 2, h / 2, R, c, sw) + kruh(w / 2, h / 2, R * 0.49, c, sw) + krizRohy(0.4, 0.4, w - 0.4, h - 0.4, c, sw * 0.9); };
// vedlejší uzávěr (DZP-002, DZP-008, DZP-014): malá kružnice a kříž z rohů
const uzaverVedlejsi = (w, h, c, sw) => kruh(w / 2, h / 2, 2.35, c, sw) + krizRohy(0.5, 0.5, w - 0.5, h - 0.5, c, sw * 0.9);

// blesk se šipkou na konci (vypínače el. proudu): lomená čára shora dolů a plný hrot ve směru posledního úseku
function blesk(body, c, sw) {
  const [a, b] = body.slice(-2), d = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / d, uy = (b[1] - a[1]) / d;
  const L = 1.05, S = 0.42, hrot = [b[0] + ux * 0.25, b[1] + uy * 0.25], z = [hrot[0] - ux * L, hrot[1] - uy * L];
  return `<polyline points="${body.map(([x, y]) => `${f(x)},${f(y)}`).join(' ')}" fill="none" stroke="${c}" stroke-width="${f(sw)}" stroke-linejoin="round"/>`
    + mnohouhelnik([hrot, [z[0] - uy * S, z[1] + ux * S], [z[0] + uy * S, z[1] - ux * S]], c);
}

// hydrant: „ventil“ (příčka a dřík) nad prstencem
const hydrant = (w) => { const cx = w / 2; return cara(1.25, 0.6, w - 1.25, 0.6, MODRA, 1.1) + cara(cx, 0.6, cx, 3.4, MODRA, 1.0) + kruh(cx, 6.45, 2.8, MODRA, 1.1); };
// podzemní hydrant: v prstenci šikmý pruh (dvě rovnoběžky stoupající doprava)
function pruhHydrantu(cx, cy) {
  const ux = Math.cos(-35 * Math.PI / 180), uy = Math.sin(-35 * Math.PI / 180), nx = -uy, ny = ux, r = 2.2, o = 0.55, pul = Math.sqrt(r * r - o * o);
  return [-o, o].map((s) => { const sx = cx + nx * s, sy = cy + ny * s; return cara(sx - ux * pul, sy - uy * pul, sx + ux * pul, sy + uy * pul, MODRA, 0.55); }).join('');
}

// výbuch (DZP-053): nepravidelná hvězda s úlomky uvnitř červeného trojúhelníku
function vybuch(cx, cy) {
  const R = [2.35, 1.95, 2.45, 1.85, 2.3, 2.05, 2.45, 1.9, 2.25, 2.0, 2.4, 1.8], body = [];
  R.forEach((r, i) => { const a = (i / R.length) * 2 * Math.PI - Math.PI / 2, a2 = a + Math.PI / R.length; body.push([cx + r * Math.cos(a), cy + r * Math.sin(a)], [cx + 1.05 * Math.cos(a2), cy + 1.05 * Math.sin(a2)]); });
  const ulomky = [[-2.75, -0.9, 0.32], [2.7, -1.1, 0.3], [-2.4, 1.75, 0.26], [2.55, 1.6, 0.28], [0.15, -2.95, 0.24]]
    .map(([dx, dy, s]) => mnohouhelnik([[cx + dx, cy + dy - s], [cx + dx + s, cy + dy + s * 0.8], [cx + dx - s, cy + dy + s * 0.8]], CERNA)).join('');
  return mnohouhelnik(body, CERNA) + ulomky;
}

// výstražný trojúhelník (DZP-003, DZP-050, DZP-053): bílý s červeným okrajem
const trojuhelnik = (w) => mnohouhelnik([[w / 2, 0.55], [w - 0.45, 9.5], [0.45, 9.5]], BILA, ` stroke="${CERVENA}" stroke-width="0.9" stroke-linejoin="round"`);

// zákaz hašení vodou (DZP-074): modrý kruh, bílý šikmý pruh s červenou čarou (rohy pruhů leží na kružnici – bez děr)
function zakazVody(cx, cy, r) {
  const ux = Math.cos(-0.62), uy = Math.sin(-0.62), nx = -uy, ny = ux;
  const pruh = (pul, rr) => { const L = Math.sqrt(rr * rr - pul * pul); return [[cx - ux * L - nx * pul, cy - uy * L - ny * pul], [cx + ux * L - nx * pul, cy + uy * L - ny * pul], [cx + ux * L + nx * pul, cy + uy * L + ny * pul], [cx - ux * L + nx * pul, cy - uy * L + ny * pul]]; };
  return kruh(cx, cy, r, MODRA, 0.01, MODRA) + mnohouhelnik(pruh(1.25, r - 0.05), BILA) + mnohouhelnik(pruh(0.62, r - 0.75), CERVENA);
}

// TOTAL / CENTRAL STOP: červený rámeček se značkou vypínače a písmenem vpravo dole
const stop = (vnitrek, pismeno, w) => `<rect x="0.35" y="0.35" width="9.3" height="9.3" fill="${BILA}" stroke="${CERVENA}" stroke-width="0.7"/>`
  + vnitrek + blesk([[8.55, 2.7], [7.35, 5.15], [8.35, 5.15], [7.15, 7.75]], CERVENA, 0.42) + text(w - 1.9, 9.6, 4.6, CERVENA, pismeno, true);

// id → { w, h (jednotky viewBoxu), svg (obsah bez obalu) }
export const VEKTOR = {
  'DZP-024': { w: 27.5, h: 10, svg: `<rect x="0.5" y="1" width="13" height="8" fill="${BILA}" stroke="${CERVENA}" stroke-width="0.7"/>` + blesk([[8.0, 1.9], [6.2, 5.0], [7.8, 5.0], [6.0, 8.1]], CERVENA, 0.45) + text(20.7, 7.3, 5.6, CERVENA, '22kV') },
  'DZP-074': { w: 10.6, h: 10, svg: zakazVody(5.3, 5, 4.75) },
  'DZP-105': { w: 9.4, h: 10, svg: mnohouhelnik([[4.7, 0], [9.4, 5], [6.9, 5], [6.9, 10], [2.5, 10], [2.5, 5], [0, 5]], CERNA) },
  'DZP-108': { w: 7.3, h: 10, svg: mnohouhelnik([[3.65, 0], [7.3, 3.7], [4.2, 3.7], [4.2, 10], [3.1, 10], [3.1, 3.7], [0, 3.7]], CERNA) },
  'DZP-001': { w: 8.1, h: 10, svg: hydrant(8.1) },
  'DZP-004': { w: 8.2, h: 10, svg: hydrant(8.2) + pruhHydrantu(4.1, 6.45) },
  'DZP-007': { w: 17.5, h: 10, svg: `<ellipse cx="4.6" cy="4.3" rx="4.1" ry="3.7" fill="none" stroke="${MODRA}" stroke-width="0.5"/>` + text(4.6, 6.15, 5.2, MODRA, 'H') + text(13.4, 9.6, 4.6, MODRA, 'C25') },
  'DZP-055': { w: 11.4, h: 10, svg: uzaverHlavni(11.4, 10, MODRA, 0.55) },
  'DZP-002': { w: 10, h: 10, svg: uzaverVedlejsi(10, 10, MODRA, 0.55) },
  'DZP-005': { w: 9.6, h: 10, svg: uzaverHlavni(9.6, 10, ZLUTA, 0.75) },
  'DZP-008': { w: 10.8, h: 10, svg: uzaverVedlejsi(10.8, 10, ZLUTA, 0.8) },
  'DZP-011': { w: 11.2, h: 10, svg: uzaverHlavni(11.2, 10, CERVENA, 0.5) },
  'DZP-014': { w: 10.9, h: 10, svg: uzaverVedlejsi(10.9, 10, CERVENA, 0.5) },
  'DZP-017': { w: 10.3, h: 10, svg: kruh(4.3, 4.6, 3.85, CERVENA, 0.45) + kruh(4.3, 4.6, 1.95, CERVENA, 0.45) + krizRohy(0.5, 0.8, 8.1, 8.4, CERVENA, 0.4) + blesk([[10.05, 4.3], [8.75, 6.85], [9.85, 6.85], [8.5, 9.45]], CERVENA, 0.42) },
  'DZP-020': { w: 10.4, h: 10, svg: kruh(3.9, 4.3, 1.9, CERVENA, 0.45) + krizRohy(0.5, 0.9, 7.3, 7.7, CERVENA, 0.4) + blesk([[10.1, 4.3], [8.8, 6.85], [9.9, 6.85], [8.55, 9.45]], CERVENA, 0.42) },
  'DZP-104': { w: 13.7, h: 10, svg: stop(kruh(4.2, 5, 2.6, CERVENA, 0.45) + kruh(4.2, 5, 1.25, CERVENA, 0.45) + krizRohy(1.6, 2.4, 6.8, 7.6, CERVENA, 0.42), 'T', 13.7) },
  'DZP-107': { w: 14.2, h: 10, svg: stop(kruh(4.2, 5, 1.3, CERVENA, 0.45) + krizRohy(1.7, 2.5, 6.7, 7.5, CERVENA, 0.42), 'C', 14.2) },
  'DZP-062': { w: 20, h: 2, svg: `<line x1="0.3" y1="1" x2="19.7" y2="1" stroke="${CERNA}" stroke-width="1.1" stroke-dasharray="4.6,1.4,1.2,1.4"/>` },
  'DZP-003': { w: 11.7, h: 10, svg: trojuhelnik(11.7) + `<path d="M4.1,8.5 C3.3,7.6 3.5,6.4 4.3,5.6 C4.4,6.4 4.8,6.8 5.2,6.9 C4.9,5.6 5.3,4.4 6.3,3.6 C6.2,4.7 6.9,5.3 7.4,6 C7.6,5.6 7.6,5.2 7.5,4.8 C8.4,5.7 8.6,7.4 7.6,8.5 Z" fill="${CERNA}"/><rect x="3.75" y="8.7" width="4.2" height="0.38" fill="${CERNA}"/>` },
  'DZP-050': { w: 11.7, h: 10, svg: trojuhelnik(11.7) + mnohouhelnik([[5.4, 3.2], [6.3, 3.2], [6.08, 7.1], [5.62, 7.1]], CERNA) + kruh(5.85, 8.05, 0.42, CERNA, 0.01, CERNA) },
  'DZP-053': { w: 12, h: 10, svg: trojuhelnik(12) + vybuch(6, 6.45) },
  'DZP-042': { w: 16.9, h: 10, svg: `<rect x="0.3" y="0.3" width="16.3" height="9.4" fill="${BILA}" stroke="${CERNA}" stroke-width="0.45"/>` + text(8.45, 4.5, 3.8, CERNA, 'ME') + text(8.45, 8.6, 3.8, CERNA, '„O“') },
  'DZP-045': { w: 8.7, h: 10, svg: mnohouhelnik([[4.35, 0.3], [8.4, 3.6], [8.4, 9.7], [0.3, 9.7], [0.3, 3.6]], BILA, ` stroke="${CERNA}" stroke-width="0.4" stroke-linejoin="round"`) + text(4.35, 8.55, 3.0, CERNA, 'MŘE') },
  'DZP-054': { w: 17.4, h: 10, svg: `<rect x="0.3" y="0.3" width="16.8" height="9.4" fill="${BILA}" stroke="${CERNA}" stroke-width="0.45"/><rect x="2.4" y="2.6" width="12.6" height="4.8" fill="none" stroke="${CERNA}" stroke-width="0.45"/>` + cara(4.0, 5, 13.4, 5, CERNA, 0.4) + kruh(8.7, 5, 0.85, CERNA, 0.4, BILA) },
  'DZP-058': { w: 27.9, h: 10, svg: `<path d="M2.2,2.6 C6,1.4 9,3.2 13,2.2 S20,1.2 24,2.4 C25.6,2.8 27.4,2 27.2,3.6 C27,5 26.2,5.6 27,6.8 C27.6,8 25.4,8.4 24,8 C20,7 17,8.8 13,8 S6,8.6 3,7.8 C1.4,7.4 0.4,7 1.6,5.8 C2.4,5 0.6,4.6 0.8,3.8 C1,3 1.6,2.8 2.2,2.6 Z" fill="#f6f884" stroke="${CERNA}" stroke-width="0.35" stroke-linejoin="round"/>` },
};

export const maVektor = (id) => typeof id === 'string' && Object.hasOwn(VEKTOR, id);

// Značka se středem v (cx, cy), delší strana = velikost (jako obrázek vepsaný do čtverce), otočená o uhel kolem středu.
export function skupinaVektoru(id, cx, cy, velikost, uhel = 0, atributy = '') {
  if (!maVektor(id)) return '';
  const z = VEKTOR[id], k = velikost / Math.max(z.w, z.h);
  return `<g ${atributy ? `${atributy} ` : ''}transform="translate(${f(cx)} ${f(cy)}) rotate(${f(uhel)}) scale(${fk(k)}) translate(${f(-z.w / 2)} ${f(-z.h / 2)})">${z.svg}</g>`;
}

// Značka vepsaná do obdélníku x, y, w, h se zachováním poměru stran (legenda, okénka karty).
export function vektorDoBoxu(id, x, y, w, h) {
  if (!maVektor(id)) return '';
  const z = VEKTOR[id], k = Math.min(w / z.w, h / z.h);
  return `<g transform="translate(${f(x + (w - z.w * k) / 2)} ${f(y + (h - z.h * k) / 2)}) scale(${fk(k)})">${z.svg}</g>`;
}

export function svgVektoru(id) {
  if (!maVektor(id)) return '';
  const z = VEKTOR[id];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${z.w} ${z.h}" width="${f(z.w * 12)}" height="${f(z.h * 12)}">${z.svg}</svg>`;
}

const uri = new Map();
const base64 = (s) => { let bin = ''; for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b); return btoa(bin); };
export function dataUriVektoru(id) {
  if (!maVektor(id)) return '';
  if (!uri.has(id)) uri.set(id, `data:image/svg+xml;base64,${base64(svgVektoru(id))}`);
  return uri.get(id);
}

// Zdroj obrázku značky pro <img> v rozhraní: ostrý vektor, jinak PNG z katalogu.
export const obrazekZnacky = (z) => (z ? (maVektor(z.id) ? dataUriVektoru(z.id) : (z.png || '')) : '');
