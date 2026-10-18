// Převodník SVG (podmnožina, kterou generuje js/kresleni/render.js) na vektorový obsah stránky pdf-lib.
// Zdroj pravdy je jeden: stejné SVG, které vidí uživatel v editoru a v exportu SVG/PNG, se vykreslí do PDF jako vektory
// (čáry, plochy, texty s vloženým písmem, obrázky). Souřadnice SVG jsou v mm, osa y dolů; PDF má pt a osu y nahoru.
import { parsujXml, parsujCestu, parsujTransform, barvaCss } from '../kresleni/import/svg.js';

const MM = 72 / 25.4;
const nasob = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const bod = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
const meritko = (M) => Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2]));
const rgb = (hex, lib) => { const h = hex.replace('#', ''); return lib.rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255); };
const cisla = (s) => String(s || '').split(/[\s,]+/).filter(Boolean).map(Number);

function dataUriNaBajty(uri) {
  const m = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(uri);
  if (!m) return null;
  const bin = m[2] ? atob(m[3]) : decodeURIComponent(m[3]);
  const b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return { mime: m[1], bajty: b };
}

// svgText: řetězec z renderListu(); ctx: { lib (pdf-lib), pdfDoc, page, fonty:{regular,bold}, obrazky:Map }
export async function vykresliSvgDoPdf(svgText, ctx) {
  const L = ctx.lib, page = ctx.page, koren = parsujXml(svgText);
  const vb = (koren.attrs.viewBox || '0 0 210 297').split(/[\s,]+/).map(Number), vyskaMm = vb[3];
  const M0 = [MM, 0, 0, -MM, 0, vyskaMm * MM];
  const clipy = new Map(), gsCache = new Map();
  (function sber(el) { if (el.tag === 'clipPath') { const r = el.deti.find((d) => d.tag === 'rect'); if (r) clipy.set(el.attrs.id, [+r.attrs.x, +r.attrs.y, +r.attrs.width, +r.attrs.height]); } el.deti.forEach(sber); })(koren);

  const gstav = (o) => {
    const k = Math.round(o * 1000) / 1000; if (gsCache.has(k)) return gsCache.get(k);
    const jmeno = `GSo${gsCache.size}`;
    page.node.setExtGState(L.PDFName.of(jmeno), page.doc.context.obj({ Type: 'ExtGState', ca: k, CA: k }));
    gsCache.set(k, jmeno); return jmeno;
  };
  const operatory = (...o) => page.pushOperators(...o);
  const nastavStyl = (st, kresli) => {
    const ops = [L.pushGraphicsState()];
    const op = (st.opacity ?? 1), fo = op * (st['fill-opacity'] ?? 1), so = op * (st['stroke-opacity'] ?? 1);
    if (fo < 1 || so < 1) ops.push(L.setGraphicsState(gstav(Math.min(fo, so) === Math.max(fo, so) ? fo : fo)));
    operatory(...ops); kresli(); operatory(L.popGraphicsState());
  };

  async function obrazek(el, M, st) {
    const href = el.attrs.href || el.attrs['xlink:href'] || ''; if (!href.startsWith('data:')) return;
    let emb = ctx.obrazky.get(href);
    if (!emb) {
      const d = dataUriNaBajty(href); if (!d) return;
      try { emb = /jpe?g/.test(d.mime) ? await ctx.pdfDoc.embedJpg(d.bajty) : await ctx.pdfDoc.embedPng(d.bajty); } catch { return; }
      ctx.obrazky.set(href, emb);
    }
    const x = +el.attrs.x || 0, y = +el.attrs.y || 0, w = +el.attrs.width, h = +el.attrs.height; if (!(w > 0 && h > 0)) return;
    // zachovat poměr stran (xMidYMid meet)
    let dw = w, dh = h, dx = x, dy = y;
    if (el.attrs.preserveAspectRatio !== 'none') { const k = Math.min(w / emb.width, h / emb.height); dw = emb.width * k; dh = emb.height * k; dx = x + (w - dw) / 2; dy = y + (h - dh) / 2; }
    const T = nasob(M, [dw, 0, 0, -dh, dx, dy + dh]);
    const klic = page.node.newXObject('Im', emb.ref);
    const op = (st.opacity ?? 1);
    operatory(L.pushGraphicsState(), ...(op < 1 ? [L.setGraphicsState(gstav(op))] : []), L.concatTransformationMatrix(T[0], T[1], T[2], T[3], T[4], T[5]), L.drawObject(klic), L.popGraphicsState());
  }

  function cesta(body, zav, st, M) {
    if (body.length < 2) return;
    const fill = st.fill && st.fill !== 'none' && zav, stroke = st.stroke && st.stroke !== 'none';
    if (!fill && !stroke) return;
    const k = meritko(M), ops = [L.pushGraphicsState()];
    const op = st.opacity ?? 1, fo = op * (st['fill-opacity'] ?? 1), so = op * (st['stroke-opacity'] ?? 1);
    if ((fill && fo < 1) || (stroke && so < 1)) ops.push(L.setGraphicsState(gstav(fill ? fo : so)));
    if (fill) ops.push(L.setFillingColor(rgb(st.fill, L)));
    if (stroke) {
      ops.push(L.setStrokingColor(rgb(st.stroke, L)), L.setLineWidth(Math.max(0.05, (st['stroke-width'] ?? 1) * k)));
      ops.push(L.setLineCap(st['stroke-linecap'] === 'round' ? 1 : st['stroke-linecap'] === 'square' ? 2 : 0), L.setLineJoin(st['stroke-linejoin'] === 'round' ? 1 : st['stroke-linejoin'] === 'bevel' ? 2 : 0));
      const da = cisla(st['stroke-dasharray']); if (da.length) ops.push(L.setDashPattern(da.map((d) => Math.max(0.01, d * k)), 0));
    }
    const P = body.map(([x, y]) => bod(M, x, y));
    ops.push(L.moveTo(P[0][0], P[0][1])); for (let i = 1; i < P.length; i++) ops.push(L.lineTo(P[i][0], P[i][1]));
    if (zav) ops.push(L.closePath());
    ops.push(fill && stroke ? L.fillAndStroke() : fill ? L.fill() : L.stroke(), L.popGraphicsState());
    operatory(...ops);
  }

  function text(radky, st, M) {
    const font = (st['font-weight'] === '700' || st['font-weight'] === 'bold' || +st['font-weight'] >= 600) ? ctx.fonty.bold : ctx.fonty.regular;
    const barva = st.fill && st.fill !== 'none' ? st.fill : '#000000', velikost = (st['font-size'] ?? 12) * meritko(M);
    const halo = st['paint-order'] === 'stroke' && st.stroke && st.stroke !== 'none';
    for (const r of radky) {
      const t = r.text; if (!t) continue;
      let [x, y] = bod(M, r.x, r.y);
      const ang = Math.atan2(M[1], M[0]), sirka = font.widthOfTextAtSize(t, velikost);
      const posun = st['text-anchor'] === 'middle' ? sirka / 2 : st['text-anchor'] === 'end' ? sirka : 0;
      x -= Math.cos(ang) * posun; y -= Math.sin(ang) * posun;
      if (st['dominant-baseline'] === 'central') { x += Math.sin(ang) * velikost * 0.35; y -= Math.cos(ang) * velikost * 0.35; }
      const stupne = (ang * 180) / Math.PI;
      if (halo) { const rr = Math.max(0.2, (st['stroke-width'] ?? 0.5) * meritko(M) / 2); for (let i = 0; i < 8; i++) { const a = (i / 8) * 2 * Math.PI; page.drawText(t, { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr, size: velikost, font, color: rgb(st.stroke, L), rotate: L.degrees(stupne) }); } }
      page.drawText(t, { x, y, size: velikost, font, color: rgb(barva, L), rotate: L.degrees(stupne), opacity: (st.opacity ?? 1) * (st['fill-opacity'] ?? 1) });
    }
  }

  async function prvek(el, M, rodic) {
    if (['defs', 'clipPath', 'title', 'desc', 'metadata'].includes(el.tag)) return;
    const M2 = nasob(M, parsujTransform(el.attrs.transform)), st = { ...rodic };
    for (const k of ['stroke', 'fill']) if (el.attrs[k] !== undefined) st[k] = barvaCss(el.attrs[k]) ?? st[k];
    for (const k of ['stroke-width', 'font-size', 'opacity', 'fill-opacity', 'stroke-opacity']) if (el.attrs[k] !== undefined && !Number.isNaN(parseFloat(el.attrs[k]))) st[k] = parseFloat(el.attrs[k]);
    for (const k of ['stroke-dasharray', 'stroke-linejoin', 'stroke-linecap', 'font-weight', 'text-anchor', 'paint-order', 'dominant-baseline']) if (el.attrs[k] !== undefined) st[k] = el.attrs[k];
    const a = (k, d = 0) => { const v = parseFloat(el.attrs[k]); return Number.isFinite(v) ? v : d; };
    switch (el.tag) {
      case 'svg': case 'g': {
        const clip = /url\(#([^)]+)\)/.exec(el.attrs['clip-path'] || '')?.[1], r = clip && clipy.get(clip);
        if (r) { const p1 = bod(M2, r[0], r[1]), p2 = bod(M2, r[0] + r[2], r[1] + r[3]); operatory(L.pushGraphicsState(), L.rectangle(Math.min(p1[0], p2[0]), Math.min(p1[1], p2[1]), Math.abs(p2[0] - p1[0]), Math.abs(p2[1] - p1[1])), L.clip(), L.endPath()); }
        for (const d of el.deti) await prvek(d, M2, st);
        if (r) operatory(L.popGraphicsState());
        break;
      }
      case 'rect': { const x = a('x'), y = a('y'), w = a('width'), h = a('height'); cesta([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true, st, M2); break; }
      case 'line': cesta([[a('x1'), a('y1')], [a('x2'), a('y2')]], false, st, M2); break;
      case 'polyline': case 'polygon': { const n = cisla(el.attrs.points), b = []; for (let i = 0; i + 1 < n.length; i += 2) b.push([n[i], n[i + 1]]); cesta(b, el.tag === 'polygon', st, M2); break; }
      case 'circle': case 'ellipse': {
        const rx = el.tag === 'circle' ? a('r') : a('rx'), ry = el.tag === 'circle' ? a('r') : a('ry'), cx = a('cx'), cy = a('cy'), b = [];
        const n = 64; for (let i = 0; i < n; i++) { const t = (i / n) * 2 * Math.PI; b.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); }
        cesta(b, true, st, M2); break;
      }
      case 'path': for (const c of parsujCestu(el.attrs.d)) cesta(c.body, c.zav, st, M2); break;
      case 'text': {
        const radky = [];
        const sbirej = (t, tx, ty) => {                          // tx, ty = výsledná poloha prvku (po x/y a dy)
          const vlastni = t.text.replace(/\s+/g, ' ').trim(); if (vlastni) radky.push({ x: tx, y: ty, text: vlastni });
          let cx = tx, cy = ty;
          for (const d of t.deti) if (d.tag === 'tspan') {      // dy se v SVG sčítá od předchozího řádku
            cx = d.attrs.x !== undefined ? parseFloat(d.attrs.x) : cx; cy = (d.attrs.y !== undefined ? parseFloat(d.attrs.y) : cy) + (d.attrs.dy ? parseFloat(d.attrs.dy) : 0);
            sbirej(d, cx, cy);
          }
        };
        sbirej(el, a('x'), a('y') + (el.attrs.dy ? parseFloat(el.attrs.dy) : 0));
        // dy u tspan je v em × font-size (SVG z render.js používá jednotky souřadnic) – stačí číselná hodnota
        text(radky, st, M2); break;
      }
      case 'image': await obrazek(el, M2, st); break;
      default: for (const d of el.deti) await prvek(d, M2, st);
    }
  }
  void nastavStyl;
  await prvek(koren, M0, { fill: '#000000', stroke: null, 'font-size': 12 });
}
