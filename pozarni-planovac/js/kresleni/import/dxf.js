// Import DXF (ASCII): čtení struktury, převod entit (včetně bloků a kót) na upravitelné prvky v metrech.
// Podporováno: LINE, LWPOLYLINE, POLYLINE/VERTEX (i oblouky z bulge), CIRCLE, ARC, ELLIPSE, SPLINE (přibližně), SOLID, LEADER,
// TEXT, ATTRIB, MTEXT (formátování, zalomení, Unicode, entity), INSERT (vnořené bloky, pole), DIMENSION (z anonymního bloku kóty).
// Přeskakuje se: HATCH, IMAGE, 3D entity, OLE, tělesa; počty se hlásí uživateli.
import { dekodujMtext, dekodujText } from './mtext.js';

const KODOVANI = { ANSI_1250: 'windows-1250', ANSI_1251: 'windows-1251', ANSI_1252: 'windows-1252', ANSI_1253: 'windows-1253', ANSI_1254: 'windows-1254', ANSI_1257: 'windows-1257', ANSI_932: 'shift_jis', ANSI_936: 'gbk', ANSI_949: 'euc-kr', ANSI_950: 'big5' };
export const JEDNOTKY = {
  1: { mNa: 0.0254, nazev: 'palce' }, 2: { mNa: 0.3048, nazev: 'stopy' }, 4: { mNa: 0.001, nazev: 'milimetry' }, 5: { mNa: 0.01, nazev: 'centimetry' },
  6: { mNa: 1, nazev: 'metry' }, 7: { mNa: 1000, nazev: 'kilometry' }, 10: { mNa: 0.9144, nazev: 'yardy' }, 14: { mNa: 0.1, nazev: 'decimetry' }, 15: { mNa: 10, nazev: 'dekametry' }, 16: { mNa: 100, nazev: 'hektometry' },
};
export const REGEX_STENA = /(^|[^a-z0-9])(st[eě]n|wall|zdi[vk]?|zed|obvod)/i;
export const REGEX_DVERE = /(dve[rř]|door|dvr|vrata|gate)/i;

// ---------- dekódování bajtů ----------
export function dekodujBajty(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const hlava = new TextDecoder('latin1').decode(b.subarray(0, 20000));
  if (hlava.startsWith('AutoCAD Binary DXF')) throw new Error('Binární DXF není podporováno. Uložte soubor z CADu jako ASCII DXF (např. verze 2000–2018).');
  const verze = /\$ACADVER\s*\r?\n\s*1\s*\r?\n\s*(AC\d+)/.exec(hlava)?.[1] || '';
  const stranka = /\$DWGCODEPAGE\s*\r?\n\s*3\s*\r?\n\s*(\S+)/.exec(hlava)?.[1] || '';
  let kodovani = 'utf-8';
  if (verze && verze < 'AC1021') kodovani = KODOVANI[stranka.toUpperCase()] || 'windows-1250';
  else if (!verze) kodovani = KODOVANI[stranka.toUpperCase()] || 'utf-8';
  let text = new TextDecoder(kodovani).decode(b);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return { text, kodovani, verze };
}

// ---------- barvy ----------
const ACI = { 1: '#ff0000', 2: '#ffff00', 3: '#00ff00', 4: '#00ffff', 5: '#0000ff', 6: '#ff00ff', 7: '#000000', 8: '#808080', 9: '#c0c0c0', 250: '#333333', 251: '#505050', 252: '#696969', 253: '#828282', 254: '#bebebe', 255: '#000000' };
function hsv(h, s, v) { const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c; const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x]; return '#' + [r, g, b].map((q) => Math.round((q + m) * 255).toString(16).padStart(2, '0')).join(''); }
export function barvaAci(n) {
  n = Math.abs(n | 0);
  if (ACI[n]) return ACI[n];
  if (n >= 10 && n <= 249) { const k = (n - 10) % 10; return hsv((Math.floor((n - 10) / 10)) * 15, k % 2 ? 0.5 : 1, [1, 0.65, 0.5, 0.3, 0.15][k >> 1]); }
  return '#000000';
}

// ---------- čtení struktury ----------
export function parsujDxf(text) {
  const L = text.split(/\r?\n/);
  const pary = [];
  for (let i = 0; i + 1 < L.length; i += 2) { const k = parseInt(L[i], 10); if (Number.isNaN(k)) continue; pary.push([k, L[i + 1]]); }
  const vysl = { hlavicka: {}, vrstvy: new Map(), bloky: new Map(), entity: [], nepodporovane: {}, souradnice: 0 };
  let sekce = '', tabulka = '', cur = null, blok = null, polyline = null, hlavickaVar = null;
  const cil = () => (blok ? blok.entity : vysl.entity);
  const zavri = () => {
    if (!cur) return;
    if (cur.typ === 'VERTEX' && polyline) polyline.vertices.push(cur);
    else if (cur.typ === 'SEQEND') { polyline = null; }
    else if (cur.typ === 'POLYLINE') { cur.vertices = []; polyline = cur; cil().push(cur); }
    else if (['LAYER'].includes(cur.typ) && sekce === 'TABLES') {
      const n = prvniH(cur, 2), flags = Number(prvniH(cur, 70) || 0), barva = Number(prvniH(cur, 62) || 7);
      vysl.vrstvy.set(n, { nazev: n, vypnuta: barva < 0 || (flags & 1) === 1, barva: Math.abs(barva) });
    } else if (sekce === 'BLOCKS' && cur.typ === 'BLOCK') {
      blok = { nazev: prvniH(cur, 2), base: [Number(prvniH(cur, 10) || 0), Number(prvniH(cur, 20) || 0)], entity: [] }; vysl.bloky.set(blok.nazev, blok);
    } else if (sekce === 'BLOCKS' && cur.typ === 'ENDBLK') blok = null;
    else if (sekce === 'ENTITIES' || (sekce === 'BLOCKS' && blok)) {
      if (prvniH(cur, 67) === '1') { /* paper space – přeskočit */ } else cil().push(cur);
    }
    cur = null;
  };
  for (const [k, v] of pary) {
    if (k === 0) {
      zavri();
      const hodnota = v.trim();
      if (hodnota === 'SECTION') { sekce = '?'; continue; }
      if (hodnota === 'ENDSEC') { sekce = ''; continue; }
      if (hodnota === 'TABLE') { tabulka = '?'; continue; }
      if (hodnota === 'ENDTAB') { tabulka = ''; continue; }
      if (sekce === 'HEADER') continue;
      cur = { typ: hodnota, p: [] };
      continue;
    }
    if (sekce === '?' && k === 2) { sekce = v.trim(); continue; }
    if (sekce === 'HEADER') {
      if (k === 9) { hlavickaVar = v.trim(); vysl.hlavicka[hlavickaVar] = []; } else if (hlavickaVar) vysl.hlavicka[hlavickaVar].push([k, v.trim()]);
      continue;
    }
    if (tabulka === '?' && k === 2) { tabulka = v.trim(); continue; }
    if (cur) cur.p.push([k, v]);
  }
  zavri();
  return vysl;
}
const prvniH = (e, k) => e.p.find((x) => x[0] === k)?.[1]?.trim();
const cislo = (e, k, def = 0) => { const v = prvniH(e, k); const n = v === undefined ? NaN : parseFloat(v); return Number.isFinite(n) ? n : def; };
const vsechna = (e, k) => e.p.filter((x) => x[0] === k).map((x) => parseFloat(x[1]));
const retez = (e, k) => e.p.find((x) => x[0] === k)?.[1] ?? '';

export function jednotkyZHlavicky(vysl) {
  const v = vysl.hlavicka.$INSUNITS?.find((x) => x[0] === 70)?.[1];
  const n = v === undefined ? 0 : parseInt(v, 10);
  return JEDNOTKY[n] ? { kod: n, ...JEDNOTKY[n] } : null;
}

// ---------- matice a geometrie ----------
const I = [1, 0, 0, 1, 0, 0];
const nasob = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const bod = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
const meritkoM = (M) => Math.sqrt(Math.abs(M[0] * M[3] - M[1] * M[2]));
const jeUniformni = (M) => Math.abs(Math.hypot(M[0], M[1]) - Math.hypot(M[2], M[3])) < 1e-9 * Math.max(1, Math.hypot(M[0], M[1])) && Math.abs(M[0] * M[2] + M[1] * M[3]) < 1e-9 * Math.max(1, Math.hypot(M[0], M[1]) ** 2);
const rotM = (deg) => { const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r); return [c, s, -s, c, 0, 0]; };

function obloukBody(cx, cy, r, a0, a1, krok = 4) {
  let d = a1 - a0; while (d <= 0) d += 360;
  const n = Math.max(2, Math.ceil(d / krok)), out = [];
  for (let i = 0; i <= n; i++) { const a = ((a0 + (d * i) / n) * Math.PI) / 180; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return out;
}
// Oblouk daný vrcholy p1, p2 a "bulge" b = tan(θ/4): θ je středový úhel (kladný = proti směru hodin). Vrací body za p1 až po p2.
function bulgeBody(p1, p2, b) {
  if (Math.abs(b) < 1e-9) return [p2];
  const th = 4 * Math.atan(b), d = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  if (d < 1e-12) return [p2];
  const nx = -(p2[1] - p1[1]) / d, ny = (p2[0] - p1[0]) / d, h = d / 2 / Math.tan(th / 2);
  const cx = (p1[0] + p2[0]) / 2 + nx * h, cy = (p1[1] + p2[1]) / 2 + ny * h, r = Math.hypot(p1[0] - cx, p1[1] - cy);
  const a0 = Math.atan2(p1[1] - cy, p1[0] - cx), n = Math.max(2, Math.ceil(Math.abs(th) / (Math.PI / 36))), out = [];
  for (let i = 1; i <= n; i++) { const a = a0 + (th * i) / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  out[out.length - 1] = p2;
  return out;
}

// ---------- převod entit na primitiva (jednotky výkresu, osa y nahoru) ----------
export function prevedEntity(vysl, opts = {}) {
  const out = [], nep = {}, koty = [], dvere = [];
  const rozpoznat = opts.rozpoznat !== false;
  const cachBbox = new Map();

  const barvaE = (e, vrstva, rodic) => {
    const tc = prvniH(e, 420); if (tc !== undefined) return '#' + (parseInt(tc, 10) & 0xffffff).toString(16).padStart(6, '0');
    const c = prvniH(e, 62);
    if (c === undefined || Number(c) === 256) { if (rodic?.barva && Number(prvniH(e, 8) ?? '0') === 0 && vrstva === rodic.vrstva) return rodic.barva; return barvaAci(vysl.vrstvy.get(vrstva)?.barva ?? 7); }
    if (Number(c) === 0) return rodic?.barva || '#000000';
    return barvaAci(Number(c));
  };

  const pridej = (p) => out.push(p);
  function entita(e, M, rodic, hloubka) {
    if (hloubka > 8) return;
    let vrstva = prvniH(e, 8) ?? '0';
    if (vrstva === '0' && rodic?.vrstva) vrstva = rodic.vrstva;
    const zaklad = { vrstva, barva: barvaE(e, vrstva, rodic) };
    const T = (x, y) => bod(M, x, y);
    switch (e.typ) {
      case 'LINE': pridej({ t: 'cara', body: [T(cislo(e, 10), cislo(e, 20)), T(cislo(e, 11), cislo(e, 21))], zav: false, ...zaklad }); break;
      case 'LWPOLYLINE': {
        const v = []; let kr = null;
        for (const [k, val] of e.p) { if (k === 10) { kr = { x: parseFloat(val), y: 0, b: 0 }; v.push(kr); } else if (k === 20 && kr) kr.y = parseFloat(val); else if (k === 42 && kr) kr.b = parseFloat(val); }
        polyBody(v, (cislo(e, 70) & 1) === 1, T, zaklad); break;
      }
      case 'POLYLINE': {
        const v = (e.vertices || []).filter((q) => (cislo(q, 70) & 16) === 0 || true).map((q) => ({ x: cislo(q, 10), y: cislo(q, 20), b: cislo(q, 42) }));
        if ((cislo(e, 70) & (16 | 64)) !== 0) { nep['POLYLINE (3D/síť)'] = (nep['POLYLINE (3D/síť)'] || 0) + 1; break; }
        polyBody(v, (cislo(e, 70) & 1) === 1, T, zaklad); break;
      }
      case 'CIRCLE': {
        const cx = cislo(e, 10), cy = cislo(e, 20), r = cislo(e, 40);
        if (jeUniformni(M)) { const c = T(cx, cy); pridej({ t: 'kruh', cx: c[0], cy: c[1], r: r * Math.hypot(M[0], M[1]), ...zaklad }); }
        else pridej({ t: 'cara', body: obloukBody(cx, cy, r, 0, 360).map(([x, y]) => T(x, y)), zav: true, ...zaklad });
        break;
      }
      case 'ARC': pridej({ t: 'cara', body: obloukBody(cislo(e, 10), cislo(e, 20), cislo(e, 40), cislo(e, 50), cislo(e, 51, 360)).map(([x, y]) => T(x, y)), zav: false, ...zaklad }); break;
      case 'ELLIPSE': {
        const cx = cislo(e, 10), cy = cislo(e, 20), mx = cislo(e, 11), my = cislo(e, 21), ratio = cislo(e, 40, 1), t0 = cislo(e, 41, 0), t1 = cislo(e, 42, 2 * Math.PI);
        const a = Math.hypot(mx, my), b = a * ratio, rot = Math.atan2(my, mx), n = 48, body = [];
        let d = t1 - t0; while (d <= 0) d += 2 * Math.PI;
        for (let i = 0; i <= n; i++) { const tt = t0 + (d * i) / n, x = a * Math.cos(tt), y = b * Math.sin(tt); body.push(T(cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot))); }
        const cela = Math.abs(d - 2 * Math.PI) < 1e-6;
        if (cela && jeUniformni(M)) { const c = T(cx, cy), k = Math.hypot(M[0], M[1]); pridej({ t: 'elipsa', cx: c[0], cy: c[1], rx: a * k, ry: b * k, uhel: ((rot * 180) / Math.PI) + (Math.atan2(M[1], M[0]) * 180) / Math.PI, ...zaklad }); }
        else pridej({ t: 'cara', body, zav: cela, ...zaklad });
        break;
      }
      case 'SPLINE': {
        const fit = [], ctrl = [];
        let tmp = null; for (const [k, val] of e.p) { if (k === 11) tmp = { x: parseFloat(val) }; else if (k === 21 && tmp) { tmp.y = parseFloat(val); fit.push([tmp.x, tmp.y]); tmp = null; } }
        tmp = null; for (const [k, val] of e.p) { if (k === 10) tmp = { x: parseFloat(val) }; else if (k === 20 && tmp) { tmp.y = parseFloat(val); ctrl.push([tmp.x, tmp.y]); tmp = null; } }
        const pts = fit.length >= 2 ? fit : ctrl;
        if (pts.length >= 2) { pridej({ t: 'cara', body: pts.map(([x, y]) => T(x, y)), zav: (cislo(e, 70) & 1) === 1, spline: true, ...zaklad }); nep['SPLINE (zjednodušeno na lomenou čáru)'] = (nep['SPLINE (zjednodušeno na lomenou čáru)'] || 0) + 1; }
        break;
      }
      case 'LEADER': { const b = []; let t = null; for (const [k, val] of e.p) { if (k === 10) t = { x: parseFloat(val) }; else if (k === 20 && t) { t.y = parseFloat(val); b.push(T(t.x, t.y)); t = null; } } if (b.length >= 2) pridej({ t: 'cara', body: b, zav: false, ...zaklad }); break; }
      case 'SOLID': case 'TRACE': {
        const p = [[10, 20], [11, 21], [13, 23], [12, 22]].map(([a, b2]) => T(cislo(e, a), cislo(e, b2)));
        const uniq = p.filter((q, i) => i === 0 || Math.hypot(q[0] - p[i - 1][0], q[1] - p[i - 1][1]) > 1e-12);
        if (uniq.length >= 3) pridej({ t: 'plocha', body: uniq, ...zaklad }); break;
      }
      case 'TEXT': case 'ATTRIB': case 'ATTDEF': {
        if (e.typ === 'ATTDEF') break;
        const t = dekodujText(retez(e, 1)); if (!t) break;
        const h1 = prvniH(e, 72), h2 = prvniH(e, 73);
        const al = (h1 && Number(h1) !== 0) || (h2 && Number(h2) !== 0) ? [cislo(e, 11), cislo(e, 21)] : [cislo(e, 10), cislo(e, 20)];
        pridej(textPrim(t, al[0], al[1], cislo(e, 40, 1), cislo(e, 50), M, zaklad, { halign: Number(h1 || 0), valign: Number(h2 || 0) }));
        break;
      }
      case 'MTEXT': {
        const raw = e.p.filter((x) => x[0] === 3).map((x) => x[1]).join('') + retez(e, 1);
        const t = dekodujMtext(raw); if (!t) break;
        let uhel = cislo(e, 50); if (prvniH(e, 11) !== undefined) uhel = (Math.atan2(cislo(e, 21), cislo(e, 11)) * 180) / Math.PI;
        const ap = cislo(e, 71, 1);
        pridej(textPrim(t, cislo(e, 10), cislo(e, 20), cislo(e, 40, 1), uhel, M, zaklad, { mtext: true, ap, sirka: cislo(e, 41, 0) }));
        break;
      }
      case 'INSERT': {
        const jmeno = prvniH(e, 2) ?? '';
        const blokD = vysl.bloky.get(jmeno);
        const sx = cislo(e, 41, 1), sy = cislo(e, 42, 1), rot = cislo(e, 50), ix = cislo(e, 10), iy = cislo(e, 20);
        const radku = Math.max(1, cislo(e, 71, 1) | 0), sloupcu = Math.max(1, cislo(e, 70, 1) | 0), dr = cislo(e, 45), ds = cislo(e, 44);
        if (rozpoznat && hloubka === 0 && REGEX_DVERE.test(jmeno) && blokD) {
          const bb = bboxBloku(jmeno, cachBbox);
          const w = bb ? Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0) * Math.max(Math.abs(sx), Math.abs(sy)) : 0.9;
          const pos = T(ix, iy);
          dvere.push({ t: 'dvere', x: pos[0], y: pos[1], sirka: w * meritkoM(M), uhel: rot + (Math.atan2(M[1], M[0]) * 180) / Math.PI, blok: jmeno, ...zaklad });
          break;
        }
        if (!blokD) { nep[`INSERT neexistujícího bloku`] = (nep[`INSERT neexistujícího bloku`] || 0) + 1; break; }
        for (let r = 0; r < radku; r++) for (let s = 0; s < sloupcu; s++) {
          const Mi = nasob(M, nasob([1, 0, 0, 1, ix + s * ds, iy + r * dr], nasob(rotM(rot), nasob([sx, 0, 0, sy, 0, 0], [1, 0, 0, 1, -blokD.base[0], -blokD.base[1]]))));
          for (const ch of blokD.entity) entita(ch, Mi, zaklad, hloubka + 1);
        }
        break;
      }
      case 'DIMENSION': {
        let m = cislo(e, 42, NaN);
        if (!Number.isFinite(m)) {   // měřená hodnota nemusí být v souboru – dopočítat z definičních bodů (lineární / zarovnaná kóta)
          const typ = cislo(e, 70) & 7;
          if ((typ === 0 || typ === 1) && prvniH(e, 13) !== undefined && prvniH(e, 14) !== undefined) {
            const dx = cislo(e, 14) - cislo(e, 13), dy = cislo(e, 24) - cislo(e, 23);
            m = typ === 1 ? Math.hypot(dx, dy) : Math.abs(dx * Math.cos((cislo(e, 50) * Math.PI) / 180) + dy * Math.sin((cislo(e, 50) * Math.PI) / 180));
          }
        }
        if (Number.isFinite(m) && m > 0) koty.push(m);
        const jmeno = prvniH(e, 2) ?? '', bl = vysl.bloky.get(jmeno);
        if (bl) for (const ch of bl.entity) entita(ch, M, { ...zaklad, koty: true }, hloubka + 1);
        else nep['DIMENSION bez bloku'] = (nep['DIMENSION bez bloku'] || 0) + 1;
        break;
      }
      case 'POINT': case 'VERTEX': case 'SEQEND': case 'ENDBLK': case 'ATTRIB_END': break;
      default: nep[e.typ] = (nep[e.typ] || 0) + 1;
    }
  }
  function polyBody(v, zav, T, zaklad) {
    if (v.length < 2) return;
    let body = [T(v[0].x, v[0].y)];
    const n = zav ? v.length : v.length - 1;
    for (let i = 0; i < n; i++) {
      const a = v[i], b = v[(i + 1) % v.length];
      if (Math.abs(a.b) > 1e-9) { for (const q of bulgeBody([a.x, a.y], [b.x, b.y], a.b)) body.push(T(q[0], q[1])); }
      else body.push(T(b.x, b.y));
    }
    pridej({ t: 'cara', body, zav, ...zaklad });
  }
  function textPrim(t, x, y, h, uhel, M, zaklad, o) {
    const k = meritkoM(M), rotM2 = (Math.atan2(M[1], M[0]) * 180) / Math.PI, vyska = h * k, pocetRadku = t.split('\n').length, dlouhy = Math.max(...t.split('\n').map((r) => r.length));
    let sirka = (o.sirka && o.sirka > 0 ? Math.min(o.sirka, dlouhy * h * 0.6) : dlouhy * h * 0.55) * (o.mtext ? 1 : 1);
    let dx = 0, dy = 0;                       // posun od místa vložení k levému dolnímu rohu prvního řádku (v jednotkách textu, před otočením)
    if (o.mtext) { const ap = o.ap; dy = ap <= 3 ? -h : ap <= 6 ? -h * (0.5 + (pocetRadku - 1) * 0.5) : (pocetRadku - 1) * h * 1.2 * -1 * 0 + 0; dx = [1, 4, 7].includes(ap) ? 0 : [2, 5, 8].includes(ap) ? -sirka / 2 : -sirka; if (ap >= 7) dy = (pocetRadku - 1) * h * 1.2; }
    else { dx = o.halign === 1 || o.halign === 4 ? -sirka / 2 : o.halign === 2 ? -sirka : 0; dy = o.valign === 3 ? -h : o.valign === 2 ? -h / 2 : 0; if (o.halign === 4) dy = -h / 2; }
    const r = (uhel * Math.PI) / 180, px = x + dx * Math.cos(r) - dy * Math.sin(r), py = y + dx * Math.sin(r) + dy * Math.cos(r);
    const P = bod(M, px, py);
    return { t: 'text', x: P[0], y: P[1], vyskaJ: vyska, uhel: uhel + rotM2, text: t, ...zaklad };
  }
  function bboxBloku(jmeno, cache) {
    if (cache.has(jmeno)) return cache.get(jmeno);
    const bl = vysl.bloky.get(jmeno); cache.set(jmeno, null); if (!bl) return null;
    const pod = prevedEntity({ ...vysl, entity: bl.entity }, { rozpoznat: false });
    const bb = bboxPrimitiv(pod.primitiva); cache.set(jmeno, bb); return bb;
  }

  for (const e of vysl.entity) entita(e, I, null, 0);
  return { primitiva: out.concat(dvere), nepodporovane: { ...vysl.nepodporovane, ...nep }, koty };
}

export function bboxPrimitiv(prim) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const p = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
  for (const q of prim) {
    if (q.body) q.body.forEach(([x, y]) => p(x, y));
    else if (q.t === 'kruh') { p(q.cx - q.r, q.cy - q.r); p(q.cx + q.r, q.cy + q.r); }
    else if (q.t === 'elipsa') { const m = Math.max(q.rx, q.ry); p(q.cx - m, q.cy - m); p(q.cx + m, q.cy + m); }
    else if (q.t === 'text' || q.t === 'dvere') p(q.x, q.y);
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
}

// ---------- odhad jednotek (jen když v souboru nejsou) ----------
export function odhadJednotek(prim, koty = []) {
  const bb = bboxPrimitiv(prim); if (!bb) return null;
  const rozmer = Math.max(bb.x1 - bb.x0, bb.y1 - bb.y0);
  const kandidati = [{ id: 'mm', nazev: 'milimetry', mNa: 0.001 }, { id: 'cm', nazev: 'centimetry', mNa: 0.01 }, { id: 'm', nazev: 'metry', mNa: 1 }, { id: 'in', nazev: 'palce', mNa: 0.0254 }]
    .map((k) => ({ ...k, rozmerM: [(bb.x1 - bb.x0) * k.mNa, (bb.y1 - bb.y0) * k.mNa] }));
  let dop = rozmer >= 3000 ? 'mm' : rozmer >= 300 ? 'cm' : 'm';
  let duvod = `největší rozměr výkresu je ${Math.round(rozmer * 100) / 100} jednotek`;
  if (koty.length) { const s = [...koty].sort((a, b) => a - b)[koty.length >> 1]; dop = s >= 1000 ? 'mm' : s >= 100 ? 'cm' : 'm'; duvod = `typická kóta ve výkresu má hodnotu ${Math.round(s * 100) / 100}`; }
  return { doporuceno: dop, duvod, kandidati, rozmerJednotek: rozmer };
}

// ---------- převod primitiv na prvky modelu (metry, osa y dolů) ----------
const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase().slice(0, 40) || 'vrstva';
export function primitivaNaPrvky(vysl, prim, mNaJednotku, opts = {}) {
  const rozpoznat = opts.rozpoznat !== false, k = mNaJednotku;
  const idVrstev = new Map(), vrstvy = [];
  const vrstva = (nazev) => {
    if (idVrstev.has(nazev)) return idVrstev.get(nazev);
    const meta = vysl.vrstvy.get(nazev); let id = `dxf_${slug(nazev)}`; let n = 2; while (vrstvy.some((v) => v.id === id)) id = `dxf_${slug(nazev)}_${n++}`;
    idVrstev.set(nazev, id); vrstvy.push({ id, nazev: `DXF: ${nazev}`, viditelna: !meta?.vypnuta, zamcena: false }); return id;
  };
  const uid = () => `e_${Math.random().toString(36).slice(2, 10)}`;
  const nahoru = opts.osaYNahoru !== false;
  const X = (x) => x * k, Y = (y) => (nahoru ? -y * k : y * k), znam = nahoru ? -1 : 1;
  const prvky = [], stat = { cara: 0, stena: 0, text: 0, dvere: 0, elipsa: 0, plocha: 0 };
  for (const q of prim) {
    const vr = vrstva(q.vrstva);
    const spolecne = { id: uid(), vrstva: vr, puvod: 'dxf' };
    if (q.t === 'cara') {
      let body = q.body.map(([x, y]) => [X(x), Y(y)]);
      if (q.zav && body.length > 2) body.push([...body[0]]);
      body = body.filter((p, i) => i === 0 || Math.hypot(p[0] - body[i - 1][0], p[1] - body[i - 1][1]) > 1e-9);
      if (body.length < 2) continue;
      const stena = rozpoznat && REGEX_STENA.test(q.vrstva) && !q.spline;
      prvky.push(stena ? { ...spolecne, druh: 'stena', body, tloustkaM: 0.05, barva: q.barva } : { ...spolecne, druh: 'cara', body, tloustka: 0.25, barva: q.barva, styl: 'plna' });
      stat[stena ? 'stena' : 'cara']++;
    } else if (q.t === 'kruh') { prvky.push({ ...spolecne, druh: 'elipsa', cx: X(q.cx), cy: Y(q.cy), rx: q.r * k, ry: q.r * k, uhel: 0, tloustka: 0.25, barva: q.barva, vypln: null, kryti: 1 }); stat.elipsa++; }
    else if (q.t === 'elipsa') { prvky.push({ ...spolecne, druh: 'elipsa', cx: X(q.cx), cy: Y(q.cy), rx: q.rx * k, ry: q.ry * k, uhel: znam * q.uhel, tloustka: 0.25, barva: q.barva, vypln: null, kryti: 1 }); stat.elipsa++; }
    else if (q.t === 'plocha') { prvky.push({ ...spolecne, druh: 'plocha', body: q.body.map(([x, y]) => [X(x), Y(y)]), tloustka: 0.1, barva: q.barva, vypln: q.vypln ?? q.barva, kryti: 1 }); stat.plocha++; }
    else if (q.t === 'text') { prvky.push({ ...spolecne, druh: 'text', x: X(q.x), y: Y(q.y), text: q.text, vyska: 3, vyskaM: q.vyskaJ * k, uhel: znam * q.uhel, barva: q.barva }); stat.text++; }
    else if (q.t === 'dvere') {
      prvky.push({ ...spolecne, vrstva: vr, druh: 'dvere', sirkaM: Math.max(0.5, Math.min(6, q.sirka * k)), typ: 'jednokridle', typAuto: true, smer: 1, zavesy: 1, stenaId: null, seg: 0, t: 0.5, x: X(q.x), y: Y(q.y), uhel: znam * q.uhel, kKontrole: true, blok: q.blok });
      stat.dvere++;
    }
  }
  return { prvky, vrstvy, statistika: stat };
}

// Zpracuje celý soubor: bajty → { vysl, primitiva, jednotky (z hlavičky) | odhad, ... }
export function nactiDxf(buf, opts = {}) {
  const dek = dekodujBajty(buf);
  const vysl = parsujDxf(dek.text);
  const { primitiva, nepodporovane, koty } = prevedEntity(vysl, opts);
  const jednotky = jednotkyZHlavicky(vysl);
  return { vysl, primitiva, nepodporovane, koty, jednotky, odhad: jednotky ? null : odhadJednotek(primitiva, koty), kodovani: dek.kodovani, verze: dek.verze, pocetVrstev: vysl.vrstvy.size, bbox: bboxPrimitiv(primitiva) };
}
