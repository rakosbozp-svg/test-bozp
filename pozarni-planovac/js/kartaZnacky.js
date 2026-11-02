// Pevné značky operativní karty (okénka vzoru HZS SČK, která se nemažou): uzávěry médií, vypínače, TOTAL/CENTRAL STOP,
// FVE a výtah E/P. Jsou to vektorové přepisy značek ze vzoru (podklady/VZOR_operativni_karta_list_A4.docx, obrázky 2, 5–11),
// barvy převzaty ze vzoru; tvar odpovídá značkám ČAHD DZP-005, DZP-055, DZP-017, DZP-104, DZP-107 a DZP-039.
// Stejné SVG se vkládá do náhledu (HTML) i do PDF (js/pdf/svg2pdf.js), takže obě výstupy vypadají stejně.

const uzaver = (c) => `<g fill="none" stroke="${c}" stroke-width="0.6"><circle cx="5" cy="5" r="3.7"/><circle cx="5" cy="5" r="1.75"/><line x1="0.8" y1="0.8" x2="9.2" y2="9.2"/><line x1="9.2" y1="0.8" x2="0.8" y2="9.2"/></g>`;
const blesk = (x, y, s, c) => `<polyline points="${x + 0.9 * s},${y} ${x + 0.15 * s},${y + 1.25 * s} ${x + 0.8 * s},${y + 1.25 * s} ${x},${y + 2.6 * s}" fill="none" stroke="${c}" stroke-width="${0.32 * s}" stroke-linejoin="round"/>`;
const stop = (pismeno) => `<rect x="0.35" y="0.35" width="9.3" height="9.3" fill="#ffffff" stroke="#ff0000" stroke-width="0.7"/>`
  + `<g fill="none" stroke="#ff0000" stroke-width="0.45"><circle cx="4.2" cy="5" r="2.6"/><circle cx="4.2" cy="5" r="1.25"/><line x1="1.6" y1="2.4" x2="6.8" y2="7.6"/><line x1="6.8" y1="2.4" x2="1.6" y2="7.6"/></g>`
  + blesk(7.1, 2.6, 1.6, '#ff0000')
  + `<text x="12" y="9.6" font-size="4.6" font-weight="700" text-anchor="middle" fill="#ff0000">${pismeno}</text>`;
const vytah = (pismeno) => `<rect x="0.45" y="0.45" width="9.1" height="9.1" fill="#ffffff" stroke="#000000" stroke-width="0.9"/>`
  + `<g stroke="#686868" stroke-width="0.4" fill="none"><line x1="0.9" y1="0.9" x2="9.1" y2="9.1"/><line x1="9.1" y1="0.9" x2="0.9" y2="9.1"/><circle cx="5" cy="5" r="3"/></g>`
  + `<circle cx="5" cy="5" r="2.55" fill="#ffffff"/><text x="5" y="6.55" font-size="4.4" font-weight="700" text-anchor="middle" fill="#000000">${pismeno}</text>`;

// id → { w, h (jednotky viewBoxu), nazev, svg (obsah) }
export const ZNACKY_KARTY = {
  'V:plyn': { w: 10, h: 10, nazev: 'Hlavní uzávěr plynu', svg: uzaver('#ffd700') },
  'V:voda': { w: 10, h: 10, nazev: 'Hlavní uzávěr vody', svg: uzaver('#0000ff') },
  'V:topeni': { w: 10, h: 10, nazev: 'Hlavní uzávěr topení', svg: uzaver('#583112') },
  'V:el': { w: 12, h: 10, nazev: 'Hlavní vypínač el. proudu',
    svg: `<g fill="none" stroke="#ff0000" stroke-width="0.6"><circle cx="5" cy="5" r="3.9"/><circle cx="5" cy="5" r="2.7"/><circle cx="5" cy="5" r="1.4"/><line x1="0.8" y1="0.8" x2="9.2" y2="9.2"/><line x1="9.2" y1="0.8" x2="0.8" y2="9.2"/></g>${blesk(10, 5.6, 1.5, '#ff0000')}` },
  'V:total': { w: 14, h: 10, nazev: 'TOTAL STOP', svg: stop('T') },
  'V:central': { w: 14, h: 10, nazev: 'CENTRAL STOP', svg: stop('C') },
  'V:fve': { w: 10, h: 10, nazev: 'Fotovoltaická elektrárna',
    svg: '<rect x="0.35" y="0.35" width="9.3" height="9.3" fill="#ffffff" stroke="#ff0000" stroke-width="0.7"/>'
      + '<circle cx="1.9" cy="1.9" r="0.75" fill="none" stroke="#8c8c8c" stroke-width="0.3"/>'
      + '<polygon points="2.4,2.7 6.6,3.3 6.3,5.0 2.1,4.4" fill="#232323"/><line x1="6.5" y1="4.3" x2="7.4" y2="5.1" stroke="#232323" stroke-width="0.3"/>'
      + '<text x="3.9" y="8.9" font-size="3.5" text-anchor="middle" fill="#ff0000">FV</text>' + blesk(7.4, 4.6, 1.45, '#ff0000') },
  'V:vytahE': { w: 10, h: 10, nazev: 'Výtah evakuační', svg: vytah('E') },
  'V:vytahP': { w: 10, h: 10, nazev: 'Výtah požární', svg: vytah('P') },
};
export const jeZnackaKarty = (id) => typeof id === 'string' && id in ZNACKY_KARTY;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Samostatné SVG pro HTML: výška v mm, šířka podle poměru stran značky.
export function svgZnackyKarty(id, vyskaMm) {
  const z = ZNACKY_KARTY[id]; if (!z) return '';
  return `<svg class="zn-karta" viewBox="0 0 ${z.w} ${z.h}" width="${(vyskaMm * z.w / z.h).toFixed(2)}mm" height="${vyskaMm}mm" font-family="Roboto, Arial, sans-serif" role="img" aria-label="${esc(z.nazev)}"><title>${esc(z.nazev)}</title>${z.svg}</svg>`;
}

// Skupina pro SVG celé stránky (souřadnice v mm): značka vepsaná do obdélníku x, y, w, h se zachováním poměru stran.
export function skupinaZnackyKarty(id, x, y, w, h) {
  const z = ZNACKY_KARTY[id]; if (!z) return '';
  const k = Math.min(w / z.w, h / z.h), dx = x + (w - z.w * k) / 2, dy = y + (h - z.h * k) / 2;
  return `<g transform="translate(${dx.toFixed(3)} ${dy.toFixed(3)}) scale(${k.toFixed(4)})">${z.svg}</g>`;
}
