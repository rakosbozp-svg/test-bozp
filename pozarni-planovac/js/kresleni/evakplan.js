// List „Evakuační plán – podlaží“: rozložení a vykreslení podle ČSN ISO 23601 (výtah požadavků: podklady/evakuace/ISO23601_pozadavky.md).
// Čistý modul bez DOM (běží v Node i v prohlížeči). Hodnoty z normy jsou v konstantách níže; barvy jsou PŘIBLIŽNÉ hodnoty sRGB
// (norma odkazuje na ISO 3864-4, kterou nemáme) – proto je v legendě i kontrole označeno „barvy ověřit“.

export const FORMATY = {   // rozměr na výšku (mm); z = min. výška záhlaví, p = min. výška velkých písmen záhlaví (tabulka 1 normy; A4 dopočteno z pravidla 7 % / 60 %)
  A4: { w: 210, h: 297, z: 15, p: 9 }, A3: { w: 297, h: 420, z: 21, p: 13 }, A2: { w: 420, h: 594, z: 30, p: 18 },
  A1: { w: 594, h: 841, z: 42, p: 26 }, A0: { w: 841, h: 1189, z: 59, p: 36 },
};
export const KATEGORIE = {
  velky: { nazev: 'Velkorozměrový objekt – min. 1 : 250', limit: 250 },
  maly: { nazev: 'Malý až středně velký objekt – min. 1 : 100', limit: 100 },
  mistnost: { nazev: 'Plán v jednotlivé místnosti – min. 1 : 350', limit: 350 },
};
export const BARVY = { zelena: '#237F52', svetleZelena: '#B5DCC0', modra: '#00508C', cerna: '#000000', varovani: '#c00000' };
export const MIN_ZNACKA_MM = 7, MIN_STENA_MM = 1.6, MIN_PRICKA_MM = 0.6, MIN_PISMO_MM = 2;
export const ID_VYCHOD = ['EVAK-001', 'EVAK-014'], ID_SHROMAZDISTE = 'EVAK-002';

export const prazdnyEvakPlan = () => ({
  kategorie: 'velky', objekt: '', podlazi: '',
  pokynyPozar: '', pokynyEvakuace: '',        // texty pokynů zadává zpracovatel (v příkladech normy se čísla linek liší – nepředvyplňují se)
  zhotovitel: '', datum: '', cisloPlanu: '', cisloRevize: '',
  jsteZde: null,                              // {x, y, dx, dy, text} – světové souřadnice (m), posun štítku v mm na papíře
  prehled: 'auto',                            // auto | ano | ne – přehledový plán celého objektu s vyznačenou zobrazenou částí
});

const f = (n) => (Math.round(n * 1000) / 1000).toString();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const datumCz = (d) => (d ? d.split('-').reverse().map((x) => String(Number(x))).join('. ') : '');

export function rozlozeniEvak(v) {
  const F = FORMATY[v.format] || FORMATY.A3, na = v.orientace === 'na_vysku';
  const W = na ? F.w : F.h, H = na ? F.h : F.w, M = 10, G = 3;
  const zah = { x: M, y: M, w: W - 2 * M, h: F.z }, vrch = M + F.z + G, podlH = Math.round(F.z * 0.8), dole = H - M;
  const Pw = Math.round(0.21 * (W - 2 * M)), popisH = 34, popis = { x: M, y: dole - popisH, w: Pw, h: popisH };
  const dostupna = popis.y - G - vrch, pokynyH = Math.round(Math.min(0.3 * dostupna, 70));
  const pokyny = { x: M, y: vrch, w: Pw, h: pokynyH };
  const lyY = vrch + pokynyH + G, legenda = { x: M, y: lyY, w: Pw, h: popis.y - G - lyY };
  const ram = { x: M + Pw + G, y: vrch + podlH, w: W - M - (M + Pw + G), h: dole - (vrch + podlH) };
  const pw = Math.round(0.28 * ram.w), ph = Math.round(0.28 * ram.h);
  return { W, H, ram, razitko: null, evak: { F, zahlavi: zah, podlazi: { x: ram.x, y: vrch, w: ram.w, h: podlH }, pokyny, legenda, popis, prehled: { x: ram.x + ram.w - pw - 2, y: ram.y + ram.h - ph - 2, w: pw, h: ph } } };
}

// ---------- pomocné geometrie ----------
export function bodNaTrase(b, d) {   // bod a směr ve vzdálenosti d (m) od začátku lomené čáry
  let zb = d;
  for (let i = 1; i < b.length; i++) {
    const dx = b[i][0] - b[i - 1][0], dy = b[i][1] - b[i - 1][1], l = Math.hypot(dx, dy);
    if (l > 1e-9 && (zb <= l || i === b.length - 1)) { const t = Math.min(zb / l, 1); return { x: b[i - 1][0] + dx * t, y: b[i - 1][1] + dy * t, ux: dx / l, uy: dy / l }; }
    zb -= l;
  }
  return null;
}
const delka = (b) => b.reduce((s, p, i) => (i ? s + Math.hypot(p[0] - b[i - 1][0], p[1] - b[i - 1][1]) : 0), 0);

// Šipka typu D (ISO 3864-3, obr. 1 normy): tvar blokové šipky; (ux,uy) = směr, A = délka v m.
export function sipkaSvg(x, y, ux, uy, A, barva) {
  const nx = -uy, ny = ux, P = (a, b) => `${f(x + ux * a * A + nx * b * A)},${f(y + uy * a * A + ny * b * A)}`;
  return `<polygon points="${[P(-0.5, -0.19), P(0.02, -0.19), P(0.02, -0.5), P(0.5, 0), P(0.02, 0.5), P(0.02, 0.19), P(-0.5, 0.19)].join(' ')}" fill="${barva}"/>`;
}

// Úniková cesta: světle zelený pás + šipky v bezpečnostní zelené po směru kreslení (norma 7.7.1).
export function trasaEvakSvg(p, k, id) {
  const b = p.body; if (b.length < 2) return '';
  const L = delka(b), A = k(MIN_ZNACKA_MM), krok = k(30), body = [];
  if (L > 0) { for (let d = k(14); d < L - k(5); d += krok) body.push(d); if (!body.length || L - body.at(-1) > k(18)) body.push(Math.max(L - k(6), 0)); }
  const sipky = body.map((d) => bodNaTrase(b, d)).filter(Boolean).map((q) => sipkaSvg(q.x, q.y, q.ux, q.uy, A, BARVY.zelena)).join('');
  const pts = b.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
  return `<g ${id}><polyline points="${pts}" fill="none" stroke="${BARVY.svetleZelena}" stroke-width="${f(k(MIN_ZNACKA_MM + 3))}" stroke-linejoin="round" stroke-linecap="round"/>${sipky}</g>`;
}

// „Jste zde“ (bezpečnostní modrá): bod s ukazatelem a štítkem, vykresluje se ve světových souřadnicích (m).
export function jsteZdeSvg(jz, k) {
  const r = k(2.6), w = k(30), h = k(9), cx = jz.x + k(jz.dx ?? 22), cy = jz.y + k(jz.dy ?? -16), t = jz.text || 'Jste zde';
  const vodorovne = Math.abs(cx - jz.x) * h > Math.abs(cy - jz.y) * w;
  const [b1, b2] = vodorovne
    ? (cx > jz.x ? [[cx - w / 2, cy - k(3)], [cx - w / 2, cy + k(3)]] : [[cx + w / 2, cy - k(3)], [cx + w / 2, cy + k(3)]])
    : (cy > jz.y ? [[cx - k(6), cy - h / 2], [cx + k(6), cy - h / 2]] : [[cx - k(6), cy + h / 2], [cx + k(6), cy + h / 2]]);
  return `<g data-jstezde="1"><polygon points="${f(jz.x)},${f(jz.y)} ${f(b1[0])},${f(b1[1])} ${f(b2[0])},${f(b2[1])}" fill="${BARVY.modra}"/>` +
    `<rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${f(w)}" height="${f(h)}" fill="${BARVY.modra}"/>` +
    `<text x="${f(cx)}" y="${f(cy + k(1.6))}" font-size="${f(k(4.6))}" font-family="Arial,sans-serif" font-weight="700" fill="#fff" text-anchor="middle">${esc(t)}</text>` +
    `<circle cx="${f(jz.x)}" cy="${f(jz.y)}" r="${f(r)}" fill="${BARVY.modra}" stroke="#fff" stroke-width="${f(k(0.5))}"/></g>`;
}

// ---------- texty a rámečky ----------
function zalom(text, maxZnaku) {
  const out = [];
  for (const odst of String(text ?? '').split('\n')) {
    let cur = '';
    for (const w of odst.split(/\s+/).filter(Boolean)) { if (cur && (cur + ' ' + w).length > maxZnaku) { out.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w; }
    out.push(cur);
  }
  return out;
}
const T = (x, y, t, sz, ex = '') => `<text x="${f(x)}" y="${f(y)}" font-size="${f(sz)}" font-family="Arial,sans-serif" ${ex}>${esc(t)}</text>`;
const ramecek = (r, nadpis) => `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="#fff" stroke="#000" stroke-width="0.3"/>` +
  (nadpis ? `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="7" fill="#e6e6e6" stroke="#000" stroke-width="0.3"/>${T(r.x + 2, r.y + 5, nadpis, 3.4, 'font-weight="700"')}` : '');

function pokynySvg(r, e, idKlip) {
  const polozky = [['POŽÁR', e.pokynyPozar], ['EVAKUACE', e.pokynyEvakuace]];
  let sz = 3.2, radky;
  for (const kandidat of [3.2, 3, 2.8, 2.6, 2.4, 2.2]) {
    sz = kandidat; const max = Math.floor((r.w - 6) / (sz * 0.5));
    radky = polozky.map(([n, t]) => [n, t.trim() ? zalom(t, max) : null]);
    const celkem = radky.reduce((s, [, l]) => s + 1.6 + (l ? l.length : 1), 0) * sz * 1.25;
    if (celkem <= r.h - 12) break;
  }
  let y = r.y + 7 + 4.5; const o = [];
  for (const [n, l] of radky) {
    o.push(T(r.x + 2, y, n, sz + 0.2, 'font-weight="700"')); y += sz * 1.25;
    if (!l) { o.push(T(r.x + 2, y, 'DOPLNIT TEXT POKYNŮ', sz, `fill="${BARVY.varovani}" font-weight="700"`)); y += sz * 1.25; }
    else for (const t of l) { o.push(T(r.x + 2, y, t, sz)); y += sz * 1.25; }
    y += sz * 0.35;
  }
  return `<clipPath id="${idKlip}"><rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}"/></clipPath>${ramecek(r, 'BEZPEČNOSTNÍ POKYNY')}<g clip-path="url(#${idKlip})">${o.join('')}</g>`;
}

function legendaSvg(r, v, o) {
  const e = v.evakPlan, polozky = [];
  if (e.jsteZde) polozky.push({ kruh: true, text: 'Jste zde' });
  if (v.prvky.some((p) => p.druh === 'trasa')) polozky.push({ cesta: true, text: 'Úniková cesta' });
  for (const id of o.pouziteZnacky) polozky.push({ znacka: id, text: o.nazevZnacky(id) });
  const rad = Math.max(Math.min(9, (r.h - 10) / Math.max(polozky.length, 1)), 8), max = Math.floor((r.w - 14) / (3 * 0.5)), sym = 7;
  const o2 = polozky.map((it, i) => {
    const y = r.y + 9 + i * rad, x = r.x + 2;
    let ik = '';
    if (it.kruh) ik = `<circle cx="${f(x + sym / 2)}" cy="${f(y + sym / 2)}" r="2.6" fill="${BARVY.modra}"/>`;
    else if (it.cesta) ik = `<rect x="${f(x)}" y="${f(y + 0.5)}" width="${sym}" height="6" fill="${BARVY.svetleZelena}"/>${sipkaSvg(x + sym / 2, y + 3.5, 1, 0, 5, BARVY.zelena)}`;
    else ik = `<image href="${esc(o.symbolHref(it.znacka))}" x="${f(x)}" y="${f(y)}" width="${sym}" height="${sym}" preserveAspectRatio="xMidYMid meet"/>`;
    const ls = zalom(it.text, max).slice(0, 2);
    return ik + `<text x="${f(x + sym + 2)}" y="${f(y + (ls.length > 1 ? 3 : 4.4))}" font-size="3" font-family="Arial,sans-serif">${ls.map((l, j) => `<tspan x="${f(x + sym + 2)}" dy="${j ? 3.4 : 0}">${esc(l)}</tspan>`).join('')}</text>`;
  });
  return ramecek(r, 'LEGENDA') + (polozky.length ? o2.join('') : T(r.x + 2, r.y + 14, 'Zatím žádné značky.', 3, 'fill="#777"'));
}

function popisSvg(r, v, objekt) {
  const e = v.evakPlan, c = r.x + r.w * 0.45, radky = [['Zhotovitel', e.zhotovitel], ['Datum vyhotovení', datumCz(e.datum)], ['Číslo plánu', e.cisloPlanu], ['Číslo revize', e.cisloRevize]];
  const nazev = zalom(e.objekt || objekt || '', Math.floor((r.w - 4) / (4.2 * 0.55))).slice(0, 2), vy = 11.5;
  return `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="#fff" stroke="#000" stroke-width="0.3"/>` +
    (nazev.length && nazev[0] ? nazev.map((l, i) => T(r.x + 2, r.y + 5 + i * 4.6, l, 4.2, 'font-weight="700"')).join('') : T(r.x + 2, r.y + 5, 'NÁZEV OBJEKTU DOPLNIT', 3.4, `fill="${BARVY.varovani}" font-weight="700"`)) +
    radky.map(([n, h], i) => { const y = r.y + vy + i * ((r.h - vy) / 4); return `<line x1="${f(r.x)}" y1="${f(y)}" x2="${f(r.x + r.w)}" y2="${f(y)}" stroke="#000" stroke-width="0.2"/>` + T(r.x + 2, y + 4.1, n, 2.6, 'fill="#444"') + (h ? T(c + 1, y + 4.1, h, 3) : T(c + 1, y + 4.1, '…', 3, `fill="${BARVY.varovani}"`)); }).join('') +
    `<line x1="${f(c)}" y1="${f(r.y + vy)}" x2="${f(c)}" y2="${f(r.y + r.h)}" stroke="#000" stroke-width="0.2"/>`;
}

// Přehledový plán: celý obsah listu zmenšený do rámečku, zobrazená část vyznačena, shromaždiště zvýrazněna (norma 7.2).
function prehledSvg(L, v, bb, o) {
  const e = v.evakPlan, r = L.evak.prehled; if (e.prehled === 'ne' || !bb) return '';
  const s = 1000 / v.meritko.pomer, vw = L.ram.w / s, vh = L.ram.h / s, o0 = v.okno;
  const vse = bb.x0 >= o0.x && bb.y0 >= o0.y && bb.x1 <= o0.x + vw && bb.y1 <= o0.y + vh;
  if (e.prehled === 'auto' && vse) return '';
  const pad = 3, ax = r.x + pad, ay = r.y + 7 + pad, aw = r.w - 2 * pad, ah = r.h - 7 - 2 * pad;
  const x0 = Math.min(bb.x0, o0.x), y0 = Math.min(bb.y0, o0.y), x1 = Math.max(bb.x1, o0.x + vw), y1 = Math.max(bb.y1, o0.y + vh);
  const sc = Math.min(aw / Math.max(x1 - x0, 1e-6), ah / Math.max(y1 - y0, 1e-6)), X = (x) => ax + (x - x0) * sc + (aw - (x1 - x0) * sc) / 2, Y = (y) => ay + (y - y0) * sc + (ah - (y1 - y0) * sc) / 2;
  const pl = (b) => b.map(([x, y]) => `${f(X(x))},${f(Y(y))}`).join(' '), kres = [];
  for (const p of v.prvky) {
    if (p.druh === 'stena') kres.push(`<polyline points="${pl(p.body)}" fill="none" stroke="#000" stroke-width="0.7"/>`);
    else if (p.druh === 'cara') kres.push(`<polyline points="${pl(p.body)}" fill="none" stroke="#555" stroke-width="0.3"/>`);
    else if (p.druh === 'trasa') kres.push(`<polyline points="${pl(p.body)}" fill="none" stroke="${BARVY.zelena}" stroke-width="0.6"/>`);
    else if (p.druh === 'plocha') kres.push(`<polygon points="${pl(p.body)}" fill="#cfcfcf" stroke="#555" stroke-width="0.3"/>`);
    else if (p.druh === 'obdelnik') kres.push(`<rect x="${f(X(p.cx - p.w / 2))}" y="${f(Y(p.cy - p.h / 2))}" width="${f(p.w * sc)}" height="${f(p.h * sc)}" fill="none" stroke="#555" stroke-width="0.3"/>`);
    else if (p.druh === 'znacka' && p.znackaId === ID_SHROMAZDISTE) kres.push(`<image href="${esc(o.symbolHref(p.znackaId))}" x="${f(X(p.x) - 3)}" y="${f(Y(p.y) - 3)}" width="6" height="6" preserveAspectRatio="xMidYMid meet"/>`);
  }
  kres.push(`<rect x="${f(X(o0.x))}" y="${f(Y(o0.y))}" width="${f(vw * sc)}" height="${f(vh * sc)}" fill="${BARVY.modra}" fill-opacity=".18" stroke="${BARVY.modra}" stroke-width="0.6"/>`);
  return `<g data-prehled="1">${ramecek(r, 'PŘEHLEDOVÝ PLÁN')}${kres.join('')}</g>`;
}

// Složí celý list (SVG v mm). svet = obsah světové skupiny (výkres, m), pravitko = měřítková úsečka (mm).
export function slozEvakSvg({ v, L, o, svet, pravitko, ox, oy, s, bb, objekt }) {
  const E = L.evak, F = E.F, e = v.evakPlan, ram = L.ram, z = E.zahlavi;
  const sipka = `<clipPath id="ramClip"><rect x="${ram.x}" y="${ram.y}" width="${ram.w}" height="${ram.h}"/></clipPath>`;
  const fsH = F.p / 0.716;   // výška velkých písmen záhlaví ≥ 60 % výšky záhlaví (tabulka 1)
  const hlava = `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" fill="${BARVY.zelena}"/>` +
    `<text x="${f(z.x + z.w / 2)}" y="${f(z.y + z.h * 0.84)}" font-size="${f(fsH)}" font-family="Arial,sans-serif" font-weight="700" fill="#fff" text-anchor="middle">ÚNIKOVÝ PLÁN</text>`;
  const pod = E.podlazi, podlazi = e.podlazi.trim() ? T(pod.x, pod.y + pod.h * 0.8, e.podlazi, pod.h * 0.78, 'font-weight="700"') : T(pod.x, pod.y + pod.h * 0.8, 'OZNAČENÍ PODLAŽÍ DOPLNIT', pod.h * 0.45, `fill="${BARVY.varovani}" font-weight="700"`);
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${L.W} ${L.H}" width="${L.W}mm" height="${L.H}mm" font-family="Arial,sans-serif">` +
    `<defs>${sipka}</defs><rect width="${L.W}" height="${L.H}" fill="#fff"/>${hlava}${podlazi}` +
    `<g clip-path="url(#ramClip)"><rect x="${ram.x}" y="${ram.y}" width="${ram.w}" height="${ram.h}" fill="#fff"/><g id="svet" transform="translate(${f(ox)} ${f(oy)}) scale(${f(s)})">${svet}</g>${pravitko}</g>` +
    `<rect x="${ram.x}" y="${ram.y}" width="${ram.w}" height="${ram.h}" fill="none" stroke="#000" stroke-width="0.5"/>` +
    prehledSvg(L, v, bb, o) + pokynySvg(E.pokyny, e, 'pokClip') + (v.legendaZobrazit ? legendaSvg(E.legenda, v, o) : '') + popisSvg(E.popis, v, objekt) + `</svg>`;
}
