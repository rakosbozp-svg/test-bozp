// Import SVG: vlastní tolerantní XML čtečka (běží i v Node), transformace, cesty (včetně křivek a oblouků), základní tvary a texty.
// Výsledek jsou primitiva (osa y dolů) ve jednotkách SVG; měřítko ve skutečných metrech SVG neobsahuje – určuje se při importu.
import { dekodujXmlEntity } from './mtext.js';

export function parsujXml(src) {
  const koren = { tag: '#root', attrs: {}, deti: [], text: '' }, zas = [koren];
  const re = /<!--[\s\S]*?-->|<!\[CDATA\[([\s\S]*?)\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE[^>]*>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(src))) {
    const top = zas[zas.length - 1];
    if (m[1] !== undefined) top.text += m[1];
    else if (m[2]) { const i = zas.map((z) => z.tag).lastIndexOf(m[2]); if (i > 0) zas.length = i; }
    else if (m[3]) {
      const attrs = {};
      for (const a of m[4].matchAll(/([^\s=]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) attrs[a[1]] = dekodujXmlEntity(a[2] ?? a[3] ?? a[4] ?? '');
      const el = { tag: m[3].replace(/^.*:/, ''), attrs, deti: [], text: '' };
      top.deti.push(el); if (!m[5]) zas.push(el);
    } else if (m[6] !== undefined && !/^<!/.test(m[0])) top.text += dekodujXmlEntity(m[6]);
  }
  return koren.deti[0] || null;
}

const NAZVY = { black: '#000000', white: '#ffffff', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00', orange: '#ffa500', gray: '#808080', grey: '#808080', cyan: '#00ffff', magenta: '#ff00ff', brown: '#a52a2a', purple: '#800080', lime: '#00ff00', navy: '#000080', silver: '#c0c0c0' };
export function barvaCss(v) {
  if (!v) return null; v = String(v).trim().toLowerCase();
  if (v === 'none' || v === 'transparent') return 'none';
  if (v === 'currentcolor') return '#000000';
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v)) return '#' + [...v.slice(1)].map((c) => c + c).join('');
  const rgb = /^rgba?\(\s*([\d.]+)(%?)\s*[, ]\s*([\d.]+)(%?)\s*[, ]\s*([\d.]+)(%?)/.exec(v);
  if (rgb) return '#' + [1, 3, 5].map((i) => { const x = parseFloat(rgb[i]) * (rgb[i + 1] ? 2.55 : 1); return Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0'); }).join('');
  return NAZVY[v] || null;
}

// ---------- matice ----------
const I = [1, 0, 0, 1, 0, 0];
const nasob = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const bod = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
export function parsujTransform(t) {
  let M = I;
  for (const m of String(t || '').matchAll(/(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g)) {
    const a = m[2].split(/[\s,]+/).filter(Boolean).map(Number); let T = I;
    if (m[1] === 'matrix' && a.length === 6) T = a;
    else if (m[1] === 'translate') T = [1, 0, 0, 1, a[0] || 0, a[1] || 0];
    else if (m[1] === 'scale') T = [a[0], 0, 0, a[1] ?? a[0], 0, 0];
    else if (m[1] === 'rotate') { const r = ((a[0] || 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), cx = a[1] || 0, cy = a[2] || 0; T = [c, s, -s, c, cx - c * cx + s * cy, cy - s * cx - c * cy]; }
    else if (m[1] === 'skewX') T = [1, 0, Math.tan(((a[0] || 0) * Math.PI) / 180), 1, 0, 0];
    else if (m[1] === 'skewY') T = [1, Math.tan(((a[0] || 0) * Math.PI) / 180), 0, 1, 0, 0];
    M = nasob(M, T);
  }
  return M;
}

// ---------- cesty ----------
function oblouk(x1, y1, rx, ry, fi, fa, fs, x2, y2) {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [[x2, y2]];
  rx = Math.abs(rx); ry = Math.abs(ry); const f = (fi * Math.PI) / 180, c = Math.cos(f), s = Math.sin(f);
  const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2, x1p = c * dx + s * dy, y1p = -s * dx + c * dy;
  const l = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry); if (l > 1) { rx *= Math.sqrt(l); ry *= Math.sqrt(l); }
  const k = (fa === fs ? -1 : 1) * Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p) / (rx * rx * y1p * y1p + ry * ry * x1p * x1p)));
  const cxp = (k * rx * y1p) / ry, cyp = (-k * ry * x1p) / rx, cx = c * cxp - s * cyp + (x1 + x2) / 2, cy = s * cxp + c * cyp + (y1 + y2) / 2;
  const ang = (ux, uy, vx, vy) => { const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; };
  const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry); let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!fs && dt > 0) dt -= 2 * Math.PI; else if (fs && dt < 0) dt += 2 * Math.PI;
  const n = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 18))), out = [];
  for (let i = 1; i <= n; i++) { const t = t1 + (dt * i) / n, x = rx * Math.cos(t), y = ry * Math.sin(t); out.push([c * x - s * y + cx, s * x + c * y + cy]); }
  out[out.length - 1] = [x2, y2]; return out;
}
const kubika = (p0, p1, p2, p3, n = 14) => { const o = []; for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } return o; };
const kvadrat = (p0, p1, p2, n = 10) => { const o = []; for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]); } return o; };

// Vrací pole cest: { body:[[x,y]…], zav:boolean } v souřadnicích SVG (bez transformace).
// Čte znak po znaku: příznaky oblouku jsou jednoznakové a mohou být bez oddělovače („a5 5 0 0110 0“ z optimalizátorů SVG).
export function parsujCestu(d) {
  const t = String(d || ''), CISLO = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/y;
  let i = 0;
  const mezera = () => { while (i < t.length && /[\s,]/.test(t[i])) i++; };
  const n = () => { mezera(); CISLO.lastIndex = i; const m = CISLO.exec(t); if (!m) return null; i = CISLO.lastIndex; return parseFloat(m[0]); };
  const priznak = () => { mezera(); const c = t[i]; if (c !== '0' && c !== '1') return null; i++; return Number(c); };
  const cisla = (k) => { const a = []; for (let j = 0; j < k; j++) { const v = n(); if (v === null) return null; a.push(v); } return a; };
  const cesty = []; let cur = null, cmd = '', x = 0, y = 0, sx = 0, sy = 0, px = null, py = null, pk = '';
  for (;;) {
    mezera(); if (i >= t.length) break;
    const zac = i;
    if (/[a-zA-Z]/.test(t[i])) cmd = t[i++];
    else if (!cmd) { i++; continue; }
    else if (cmd === 'M') cmd = 'L'; else if (cmd === 'm') cmd = 'l';
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
    if (C === 'Z') { if (cur) { cur.zav = true; x = sx; y = sy; cesty.push(cur); cur = null; } pk = 'Z'; continue; }
    let a = null;
    if (C === 'M') { if ((a = cisla(2))) { if (cur && cur.body.length > 1) cesty.push(cur); x = ox + a[0]; y = oy + a[1]; sx = x; sy = y; cur = { body: [[x, y]], zav: false }; pk = 'M'; } }
    else {
      if (!cur) cur = { body: [[x, y]], zav: false };
      if (C === 'L' && (a = cisla(2))) { x = ox + a[0]; y = oy + a[1]; cur.body.push([x, y]); pk = C; }
      else if (C === 'H' && (a = cisla(1))) { x = (rel ? x : 0) + a[0]; cur.body.push([x, y]); pk = C; }
      else if (C === 'V' && (a = cisla(1))) { y = (rel ? y : 0) + a[0]; cur.body.push([x, y]); pk = C; }
      else if (C === 'C' && (a = cisla(6))) { const b1 = [ox + a[0], oy + a[1]], b2 = [ox + a[2], oy + a[3]], e = [ox + a[4], oy + a[5]]; cur.body.push(...kubika([x, y], b1, b2, e)); px = b2[0]; py = b2[1]; x = e[0]; y = e[1]; pk = 'C'; }
      else if (C === 'S' && (a = cisla(4))) { const b1 = pk === 'C' ? [2 * x - px, 2 * y - py] : [x, y], b2 = [ox + a[0], oy + a[1]], e = [ox + a[2], oy + a[3]]; cur.body.push(...kubika([x, y], b1, b2, e)); px = b2[0]; py = b2[1]; x = e[0]; y = e[1]; pk = 'C'; }
      else if (C === 'Q' && (a = cisla(4))) { const b1 = [ox + a[0], oy + a[1]], e = [ox + a[2], oy + a[3]]; cur.body.push(...kvadrat([x, y], b1, e)); px = b1[0]; py = b1[1]; x = e[0]; y = e[1]; pk = 'Q'; }
      else if (C === 'T' && (a = cisla(2))) { const b1 = pk === 'Q' ? [2 * x - px, 2 * y - py] : [x, y], e = [ox + a[0], oy + a[1]]; cur.body.push(...kvadrat([x, y], b1, e)); px = b1[0]; py = b1[1]; x = e[0]; y = e[1]; pk = 'Q'; }
      else if (C === 'A') {
        const r3 = cisla(3), fa = r3 ? priznak() : null, fs = fa !== null ? priznak() : null, e = fs !== null ? cisla(2) : null;
        if (e) { a = e; const ex = ox + e[0], ey = oy + e[1]; cur.body.push(...oblouk(x, y, r3[0], r3[1], r3[2], fa, fs, ex, ey)); x = ex; y = ey; pk = C; }
      }
    }
    if (!a && i === zac) i++;                       // nečitelná část: posunout se, nezacyklit
    else if (!a) break;                              // neúplné parametry: zbytek cesty se zahodí (jako v prohlížeči)
  }
  if (cur && cur.body.length > 1) cesty.push(cur);
  return cesty;
}

// ---------- hlavní převod ----------
const JEDNOTKY_MM = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96, '': 25.4 / 96 };
function delka(v) { const m = /^\s*([\d.]+)\s*([a-z%]*)\s*$/i.exec(v || ''); if (!m || m[2] === '%') return null; return { hodnota: parseFloat(m[1]), jednotka: m[2].toLowerCase() }; }

// Pravidla CSS z <style> – jen jednoduché selektory (značka, .třída, #id a jejich spojení, seznam s čárkami), bez kombinátorů.
// Exporty z Illustratoru, Inkscapu a CADů tak zadávají výplň a obrys (např. .st0{fill:none;stroke:#000}).
function pravidlaCss(koren) {
  const css = []; (function sber(el) { if (el.tag === 'style') css.push(el.text); el.deti.forEach(sber); })(koren);
  const out = []; let poradi = 0;
  for (const m of css.join('\n').replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const dekl = {}; for (const d of m[2].matchAll(/([a-z-]+)\s*:\s*([^;]+)/gi)) dekl[d[1].toLowerCase()] = d[2].replace(/!important/i, '').trim();
    for (const sel of m[1].split(',').map((x) => x.trim())) {
      const sm = /^([a-zA-Z][\w-]*)?(#[\w-]+)?((?:\.[\w-]+)*)$/.exec(sel); if (!sm || !sel) continue;
      const tridy = sm[3] ? sm[3].slice(1).split('.') : [];
      out.push({ tag: sm[1] || null, id: sm[2]?.slice(1) || null, tridy, vaha: (sm[2] ? 100 : 0) + tridy.length * 10 + (sm[1] ? 1 : 0), poradi: poradi++, dekl });
    }
  }
  return out.sort((a, b) => a.vaha - b.vaha || a.poradi - b.poradi);
}
const cssPrvku = (pravidla, el) => {
  if (!pravidla.length) return {};
  const tridy = String(el.attrs.class || '').split(/\s+/).filter(Boolean), o = {};
  for (const r of pravidla) if ((!r.tag || r.tag === el.tag) && (!r.id || r.id === el.attrs.id) && r.tridy.every((c) => tridy.includes(c))) Object.assign(o, r.dekl);
  return o;
};

export function nactiSvg(text) {
  const koren = parsujXml(text);
  if (!koren || koren.tag !== 'svg') throw new Error('Soubor není platné SVG (chybí kořenový prvek svg).');
  const pravidla = pravidlaCss(koren);
  const vb = (koren.attrs.viewBox || '').split(/[\s,]+/).map(Number);
  const W = delka(koren.attrs.width), Hh = delka(koren.attrs.height);
  const maViewBox = vb.length === 4 && vb.every(Number.isFinite);
  const sirkaJ = maViewBox ? vb[2] : W?.hodnota || 0, vyskaJ = maViewBox ? vb[3] : Hh?.hodnota || 0;
  // mm papíru na jednotku SVG: z absolutních rozměrů (width/height v mm, cm, in, pt) je jisté, jinak 96 dpi (odhad)
  let mmNaJ = JEDNOTKY_MM.px, jisteMm = false;
  if (W && JEDNOTKY_MM[W.jednotka] !== undefined && W.jednotka !== 'px' && W.jednotka !== '' && sirkaJ) { mmNaJ = (W.hodnota * JEDNOTKY_MM[W.jednotka]) / sirkaJ; jisteMm = true; }
  else if (W && sirkaJ && maViewBox) mmNaJ = ((W.hodnota * JEDNOTKY_MM.px) / sirkaJ);
  const root = maViewBox ? [1, 0, 0, 1, -vb[0], -vb[1]] : I;
  const prim = [], nep = {}, ids = new Map();
  (function sbirej(el) { if (el.attrs.id) ids.set(el.attrs.id, el); el.deti.forEach(sbirej); })(koren);

  const styl = (el, rodic) => {
    const s = { ...rodic };
    const inl = {}; for (const m of String(el.attrs.style || '').matchAll(/([a-z-]+)\s*:\s*([^;]+)/gi)) inl[m[1].toLowerCase()] = m[2].trim();
    const css = cssPrvku(pravidla, el), g = (k) => inl[k] ?? css[k] ?? el.attrs[k];   // inline styl > pravidlo CSS > atribut
    for (const k of ['stroke', 'fill']) { const v = g(k); if (v !== undefined) s[k] = barvaCss(v) ?? s[k]; }
    for (const k of ['stroke-width', 'font-size']) { const v = g(k); if (v !== undefined && !Number.isNaN(parseFloat(v))) s[k] = parseFloat(v); }
    const a = g('text-anchor'); if (a) s['text-anchor'] = a;
    if (g('display') === 'none' || g('visibility') === 'hidden') s.skryte = true;
    return s;
  };
  function prochazej(el, M, st, hloubka) {
    if (hloubka > 40) return;
    if (['defs', 'clipPath', 'mask', 'symbol', 'metadata', 'title', 'desc', 'style', 'pattern', 'linearGradient', 'radialGradient', 'marker', 'filter', 'script'].includes(el.tag)) return;
    const M2 = nasob(M, parsujTransform(el.attrs.transform)), s = styl(el, st); if (s.skryte) return;
    const a = (k, d = 0) => { const v = parseFloat(el.attrs[k]); return Number.isFinite(v) ? v : d; };
    const T = (x, y) => bod(M2, x, y);
    const cara = (body, zav) => { const b = body.map(([x, y]) => T(x, y)); if (b.length < 2) return; const vyp = s.fill && s.fill !== 'none' && zav ? s.fill : null; prim.push({ t: vyp ? 'plocha' : 'cara', body: b, zav, barva: s.stroke && s.stroke !== 'none' ? s.stroke : (s.fill && s.fill !== 'none' ? s.fill : '#000000'), vypln: vyp, tloust: s['stroke-width'] }); };
    switch (el.tag) {
      case 'svg': case 'g': case 'a': el.deti.forEach((d) => prochazej(d, M2, s, hloubka + 1)); break;
      case 'use': {
        const h = (el.attrs.href || el.attrs['xlink:href'] || '').replace(/^#/, ''), t = ids.get(h); if (!t) break;
        const Mu = nasob(M2, [1, 0, 0, 1, a('x'), a('y')]);
        if (t.tag !== 'symbol') { prochazej(t, Mu, s, hloubka + 1); break; }
        const vb = String(t.attrs.viewBox || '').split(/[\s,]+/).map(Number), w = a('width', NaN), hh = a('height', NaN);
        let Ms = Mu;
        if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) {
          const kx = Number.isFinite(w) ? w / vb[2] : 1, ky = Number.isFinite(hh) ? hh / vb[3] : kx, k = Number.isFinite(w) && Number.isFinite(hh) ? Math.min(kx, ky) : Number.isFinite(w) ? kx : ky;
          const dx = Number.isFinite(w) ? (w - vb[2] * k) / 2 : 0, dy = Number.isFinite(hh) ? (hh - vb[3] * k) / 2 : 0;
          Ms = nasob(Mu, [k, 0, 0, k, dx - vb[0] * k, dy - vb[1] * k]);
        }
        const st = styl(t, s); if (!st.skryte) t.deti.forEach((d) => prochazej(d, Ms, st, hloubka + 1));
        break;
      }
      case 'line': cara([[a('x1'), a('y1')], [a('x2'), a('y2')]], false); break;
      case 'polyline': case 'polygon': { const n = (el.attrs.points || '').split(/[\s,]+/).filter(Boolean).map(Number); const b = []; for (let i = 0; i + 1 < n.length; i += 2) b.push([n[i], n[i + 1]]); cara(b, el.tag === 'polygon'); break; }
      case 'rect': { const x = a('x'), y = a('y'), w = a('width'), h = a('height'); if (w > 0 && h > 0) cara([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true); break; }
      case 'circle': case 'ellipse': {
        const rx = el.tag === 'circle' ? a('r') : a('rx'), ry = el.tag === 'circle' ? a('r') : a('ry'), cx = a('cx'), cy = a('cy'), b = [];
        for (let i = 0; i < 48; i++) { const t = (i / 48) * 2 * Math.PI; b.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); }
        cara(b, true); break;
      }
      case 'path': for (const c of parsujCestu(el.attrs.d)) cara(c.body, c.zav); break;
      case 'text': {
        const fs0 = s['font-size'] || 12;
        const radky = []; const sbirka = (t, tx, ty, st2) => {      // tx, ty = výsledná poloha prvku (po x/y a dy)
          const vlastni = t.text.replace(/\s+/g, ' ').trim();
          if (vlastni) radky.push({ x: tx, y: ty, text: vlastni, fs: st2['font-size'] || fs0, kotva: st2['text-anchor'] || 'start' });
          let cx = tx, cy = ty;
          for (const d of t.deti) if (d.tag === 'tspan') {        // dy se v SVG sčítá od předchozího řádku
            cx = d.attrs.x !== undefined ? parseFloat(d.attrs.x) : cx; cy = (d.attrs.y !== undefined ? parseFloat(d.attrs.y) : cy) + (d.attrs.dy ? parseFloat(d.attrs.dy) : 0);
            sbirka(d, cx, cy, styl(d, st2));
          }
        };
        sbirka(el, a('x'), a('y') + (el.attrs.dy ? parseFloat(el.attrs.dy) : 0), s);
        for (const r of radky) {
          const sirka = r.text.length * r.fs * 0.55, dx = r.kotva === 'middle' ? -sirka / 2 : r.kotva === 'end' ? -sirka : 0;
          const P = T(r.x + dx, r.y), k = Math.sqrt(Math.abs(M2[0] * M2[3] - M2[1] * M2[2]));
          prim.push({ t: 'text', x: P[0], y: P[1], vyskaJ: r.fs * k, uhel: (Math.atan2(M2[1], M2[0]) * 180) / Math.PI, text: r.text, barva: s.fill && s.fill !== 'none' ? s.fill : '#000000' });
        }
        break;
      }
      case 'image': nep['image (vložený obrázek)'] = (nep['image (vložený obrázek)'] || 0) + 1; break;
      default: if (el.tag !== '#root') nep[el.tag] = (nep[el.tag] || 0) + 1;
    }
  }
  prochazej(koren, root, { stroke: null, fill: '#000000' }, 0);
  return { primitiva: prim, nepodporovane: nep, sirkaJ, vyskaJ, mmNaJednotku: mmNaJ, jisteMm, viewBox: maViewBox };
}
