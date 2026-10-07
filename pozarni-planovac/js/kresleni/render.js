// Vykreslení listu výkresu do SVG (mm na papíře). Stejný kód pro editor i pro export (SVG/PNG/PDF).
import { rozlozeniListu, mmNaM, dvereGeom, delkaTrasy, formatDelky, meritkoOvereno, pouziteZnacky } from './prvky.js';
import { delkaLomene } from './geom.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (n) => (Math.round(n * 1000) / 1000).toString();
const pts = (b) => b.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
const DELKY_PRAVITKA = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

function dveře(d, prvky, s, k) {
  const g = dvereGeom(d, prvky), w = g.w;
  const u = [g.ux, g.uy], n = [-g.uy * d.smer, g.ux * d.smer];
  const A = [g.cx - u[0] * w / 2, g.cy - u[1] * w / 2], B = [g.cx + u[0] * w / 2, g.cy + u[1] * w / 2];
  const tl = Math.max(g.stena?.tloustkaM ?? 0.3, 0.5 / s), lw = k(0.35), out = [];
  if (g.pripojene) out.push(`<line x1="${f(A[0])}" y1="${f(A[1])}" x2="${f(B[0])}" y2="${f(B[1])}" stroke="#fff" stroke-width="${f(tl * 1.05)}"/>`);
  const cara = (a, b, ex = '') => `<line x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}" stroke="#000" stroke-width="${f(lw)}" ${ex}/>`;
  const oblouk = (c, z, kon, r) => {
    const cr = (z[0] - c[0]) * (kon[1] - c[1]) - (z[1] - c[1]) * (kon[0] - c[0]);
    return `<path d="M ${f(z[0])} ${f(z[1])} A ${f(r)} ${f(r)} 0 0 ${cr > 0 ? 1 : 0} ${f(kon[0])} ${f(kon[1])}" fill="none" stroke="#000" stroke-width="${f(k(0.2))}"/>`;
  };
  if (d.typ === 'vrata') {
    out.push(cara(A, B, `stroke-dasharray="${f(k(2.5))},${f(k(1.2))}" stroke-width="${f(k(0.8))}"`));
    for (const P of [A, B]) out.push(cara([P[0] - n[0] * tl * 0.6, P[1] - n[1] * tl * 0.6], [P[0] + n[0] * tl * 0.6, P[1] + n[1] * tl * 0.6]));
  } else if (d.typ === 'dvoukridle') {
    const h = w / 2;
    for (const [H, F] of [[A, [g.cx, g.cy]], [B, [g.cx, g.cy]]]) { const L = [H[0] + n[0] * h, H[1] + n[1] * h]; out.push(cara(H, L), oblouk(H, L, F, h)); }
  } else {
    const H = d.zavesy >= 0 ? A : B, F = d.zavesy >= 0 ? B : A, L = [H[0] + n[0] * w, H[1] + n[1] * w];
    out.push(cara(H, L), oblouk(H, L, F, w));
  }
  return `<g data-id="${d.id}" data-druh="dvere">${out.join('')}</g>`;
}

function prvekSvg(p, ctx) {
  const { s, k, pomer, prvky, znacka } = ctx;
  const dash = { carkovana: `${f(k(3))},${f(k(1.5))}`, carkocara: `${f(k(5))},${f(k(1.2))},${f(k(1))},${f(k(1.2))}` };
  const id = `data-id="${p.id}" data-druh="${p.druh}"`;
  switch (p.druh) {
    case 'stena': return `<polyline ${id} points="${pts(p.body)}" fill="none" stroke="${p.barva}" stroke-width="${f(Math.max(p.tloustkaM, k(0.5)))}" stroke-linejoin="miter" stroke-linecap="square"/>`;
    case 'cara': return `<polyline ${id} points="${pts(p.body)}" fill="none" stroke="${p.barva}" stroke-width="${f(k(p.tloustka))}" ${dash[p.styl] ? `stroke-dasharray="${dash[p.styl]}"` : ''} stroke-linejoin="round"/>`;
    case 'volna': return `<polyline ${id} points="${pts(p.body)}" fill="none" stroke="${p.barva}" stroke-width="${f(k(p.tloustka))}" stroke-linejoin="round" stroke-linecap="round"/>`;
    case 'plocha': return `<polygon ${id} points="${pts(p.body)}" fill="${p.vypln || 'none'}" fill-opacity="${p.kryti}" stroke="${p.barva}" stroke-width="${f(k(p.tloustka))}" stroke-linejoin="round"/>`;
    case 'obdelnik': return `<rect ${id} x="${f(p.cx - p.w / 2)}" y="${f(p.cy - p.h / 2)}" width="${f(p.w)}" height="${f(p.h)}" fill="${p.vypln || 'none'}" fill-opacity="${p.kryti}" stroke="${p.barva}" stroke-width="${f(k(p.tloustka))}" transform="rotate(${f(p.uhel || 0)} ${f(p.cx)} ${f(p.cy)})"/>`;
    case 'elipsa': return `<ellipse ${id} cx="${f(p.cx)}" cy="${f(p.cy)}" rx="${f(p.rx)}" ry="${f(p.ry)}" fill="${p.vypln || 'none'}" fill-opacity="${p.kryti}" stroke="${p.barva}" stroke-width="${f(k(p.tloustka))}" transform="rotate(${f(p.uhel || 0)} ${f(p.cx)} ${f(p.cy)})"/>`;
    case 'trasa': {
      const b = p.body, n = b.length; if (n < 2) return '';
      let arrow = '';
      if (p.sipka) {
        const a = b[n - 2], e = b[n - 1], L = Math.hypot(e[0] - a[0], e[1] - a[1]) || 1, u = [(e[0] - a[0]) / L, (e[1] - a[1]) / L], l = k(3.2), w = k(1.6);
        arrow = `<polygon points="${pts([e, [e[0] - u[0] * l - u[1] * w, e[1] - u[1] * l + u[0] * w], [e[0] - u[0] * l + u[1] * w, e[1] - u[1] * l - u[0] * w]])}" fill="${p.barva}"/>`;
      }
      // popisek délky uprostřed trasy
      let half = delkaTrasy(p) / 2, m = b[0];
      for (let i = 1; i < n; i++) { const l = Math.hypot(b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]); if (half <= l || i === n - 1) { const t = l ? Math.min(half / l, 1) : 0; m = [b[i - 1][0] + (b[i][0] - b[i - 1][0]) * t, b[i - 1][1] + (b[i][1] - b[i - 1][1]) * t]; break; } half -= l; }
      return `<g ${id}><polyline points="${pts(b)}" fill="none" stroke="${p.barva}" stroke-width="${f(k(p.tloustka))}" stroke-linejoin="round" stroke-dasharray="${f(k(2.4))},${f(k(1.2))}"/>${arrow}<text x="${f(m[0])}" y="${f(m[1] - k(1.2))}" font-size="${f(k(2.6))}" font-family="Arial,sans-serif" font-weight="700" text-anchor="middle" fill="${p.barva}" stroke="#fff" stroke-width="${f(k(0.7))}" paint-order="stroke">${esc(formatDelky(delkaTrasy(p)))}</text></g>`;
    }
    case 'text': {
      const h = mmNaM(p.vyska, pomer), lines = String(p.text).split('\n');
      return `<text ${id} x="${f(p.x)}" y="${f(p.y)}" font-size="${f(h)}" font-family="Arial,sans-serif" fill="${p.barva}" transform="rotate(${f(p.uhel || 0)} ${f(p.x)} ${f(p.y)})">${lines.map((l, i) => `<tspan x="${f(p.x)}" dy="${i ? f(h * 1.2) : 0}">${esc(l)}</tspan>`).join('')}</text>`;
    }
    case 'znacka': {
      const w = mmNaM(p.velikost, pomer), z = znacka(p.znackaId);
      const r = `rotate(${f(p.uhel || 0)} ${f(p.x)} ${f(p.y)})`;
      return z
        ? `<image ${id} href="${esc(z)}" x="${f(p.x - w / 2)}" y="${f(p.y - w / 2)}" width="${f(w)}" height="${f(w)}" preserveAspectRatio="xMidYMid meet" transform="${r}"/>`
        : `<g ${id} transform="${r}"><rect x="${f(p.x - w / 2)}" y="${f(p.y - w / 2)}" width="${f(w)}" height="${f(w)}" fill="#fff" stroke="#c00" stroke-width="${f(k(0.4))}" stroke-dasharray="${f(k(1))}"/><text x="${f(p.x)}" y="${f(p.y)}" font-size="${f(w * 0.6)}" text-anchor="middle" dominant-baseline="central" fill="#c00">?</text></g>`;
    }
    case 'dvere': return dveře(p, prvky, s, k);
    default: return '';
  }
}

function pravitko(L, s, k) {
  const ram = L.ram; let d = DELKY_PRAVITKA.find((x) => x * s >= 15) ?? 5000;
  if (d * s > 70) d = [...DELKY_PRAVITKA].reverse().find((x) => x * s <= 70) ?? 1;
  const w = d * s, x = ram.x + 4, y = ram.y + ram.h - 8;
  void k;
  return `<g font-family="Arial,sans-serif" font-size="2.4"><rect x="${f(x)}" y="${f(y)}" width="${f(w / 2)}" height="1.6" fill="#000"/><rect x="${f(x + w / 2)}" y="${f(y)}" width="${f(w / 2)}" height="1.6" fill="#fff" stroke="#000" stroke-width="0.2"/><rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="1.6" fill="none" stroke="#000" stroke-width="0.2"/>` +
    `<text x="${f(x)}" y="${f(y - 1)}" text-anchor="middle">0</text><text x="${f(x + w)}" y="${f(y - 1)}" text-anchor="middle">${d} m</text></g>`;
}

function severka(L, uhel) {
  const x = L.ram.x + L.ram.w - 12, y = L.ram.y + 16;
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(uhel)})"><circle r="8" fill="#fff" fill-opacity=".8" stroke="#000" stroke-width="0.3"/><polygon points="0,-7 3,3 0,1.2 -3,3" fill="#000"/><text y="-9.2" font-size="4" font-family="Arial,sans-serif" font-weight="700" text-anchor="middle">S</text></g>`;
}

function legenda(v, o, L) {
  const ids = pouziteZnacky(v.prvky), maTrasu = v.prvky.some((p) => p.druh === 'trasa');
  if (!v.legendaZobrazit || (!ids.length && !maTrasu)) return '';
  const polozky = ids.map((id) => ({ znacka: id, text: o.nazevZnacky(id) }));
  if (maTrasu) polozky.push({ trasa: true, text: 'Úniková / zásahová trasa (délka v metrech u trasy)' });
  const radek = 7.5, sloupcu = Math.ceil(polozky.length / 9), sl = 78, h = Math.ceil(polozky.length / sloupcu) * radek + 11, w = sloupcu * sl + 4;
  const x0 = L.ram.x + L.ram.w - w - 2, y0 = L.ram.y + L.ram.h - h - 2;
  const zalom = (t) => { const out = []; let cur = ''; for (const w2 of String(t).split(' ')) { if ((cur + ' ' + w2).trim().length > 36 && cur) { out.push(cur); cur = w2; } else cur = (cur + ' ' + w2).trim(); } if (cur) out.push(cur); return out.slice(0, 3); };
  const radky = polozky.map((it, i) => {
    const cx = x0 + 2 + Math.floor(i / Math.ceil(polozky.length / sloupcu)) * sl, cy = y0 + 8 + (i % Math.ceil(polozky.length / sloupcu)) * radek;
    const ikona = it.trasa ? `<line x1="${f(cx)}" y1="${f(cy + 3)}" x2="${f(cx + 6)}" y2="${f(cy + 3)}" stroke="#2f9e44" stroke-width="0.8" stroke-dasharray="2,1"/>` : `<image href="${esc(o.symbolHref(it.znacka))}" x="${f(cx)}" y="${f(cy)}" width="6" height="6" preserveAspectRatio="xMidYMid meet"/>`;
    const ls = zalom(it.text);
    return `${ikona}<text x="${f(cx + 7.5)}" y="${f(cy + 2.4)}" font-size="2.1" font-family="Arial,sans-serif">${ls.map((l, j) => `<tspan x="${f(cx + 7.5)}" dy="${j ? 2.4 : 0}">${esc(l)}</tspan>`).join('')}</text>`;
  });
  return `<g data-legenda="1"><rect x="${f(x0)}" y="${f(y0)}" width="${f(w)}" height="${f(h)}" fill="#fff" fill-opacity=".92" stroke="#000" stroke-width="0.3"/><text x="${f(x0 + 2)}" y="${f(y0 + 5)}" font-size="2.8" font-weight="700" font-family="Arial,sans-serif">LEGENDA ZNAČEK · PBŘ</text>${radky.join('')}</g>`;
}

function razitko(v, o, L) {
  const r = L.razitko, c1 = r.x + r.w * 0.45, c2 = r.x + r.w * 0.75, T = (x, y, t, sz = 2.8, ex = '') => `<text x="${f(x)}" y="${f(y)}" font-size="${sz}" font-family="Arial,sans-serif" ${ex}>${esc(t)}</text>`;
  const ov = meritkoOvereno(v);
  return `<g><rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="#fff" stroke="#000" stroke-width="0.5"/>` +
    `<line x1="${f(c1)}" y1="${f(r.y)}" x2="${f(c1)}" y2="${f(r.y + r.h)}" stroke="#000" stroke-width="0.3"/><line x1="${f(c2)}" y1="${f(r.y)}" x2="${f(c2)}" y2="${f(r.y + r.h)}" stroke="#000" stroke-width="0.3"/>` +
    T(r.x + 2, r.y + 4, 'NÁZEV:', 2.2, 'fill="#555"') + T(r.x + 2, r.y + 10, v.razitko.nazev || o.objektNazev || '', 4.2, 'font-weight="700"') + T(r.x + 2, r.y + 17, o.nazevListu || '', 3.2) +
    T(c1 + 2, r.y + 4, 'ZPRACOVAL:', 2.2, 'fill="#555"') + T(c1 + 2, r.y + 9, v.razitko.zpracoval || '') + T(c1 + 2, r.y + 14, 'SCHVÁLIL:', 2.2, 'fill="#555"') + T(c1 + 2, r.y + 19, v.razitko.schvalil || '') +
    T(c2 + 2, r.y + 4, 'MĚŘÍTKO:', 2.2, 'fill="#555"') + T(c2 + 2, r.y + 10, `1 : ${v.meritko.pomer}`, 4.2, 'font-weight="700"') +
    (ov ? '' : T(c2 + 2, r.y + 14.5, 'MĚŘÍTKO NEOVĚŘENO', 2.4, 'fill="#c00" font-weight="700"')) +
    T(c2 + 2, r.y + 20, `DATUM: ${v.razitko.datum ? v.razitko.datum.split('-').reverse().join('. ') : ''}`, 2.8) + `</g>`;
}

// o: { objektNazev, nazevListu, znacky: Map(id -> {nazev, png}), symbolHref(id), prilohy, rezim }
export function renderListu(v, o) {
  const L = rozlozeniListu(v), pomer = v.meritko.pomer, s = 1000 / pomer, k = (mm) => mm / s;
  const ram = L.ram, ox = ram.x - v.okno.x * s, oy = ram.y - v.okno.y * s;
  const ctx = { s, k, pomer, prvky: v.prvky, znacka: (id) => (o.znacky.has(id) ? o.symbolHref(id) : null) };
  const oo = { ...o, nazevZnacky: (id) => o.znacky.get(id)?.nazev || id };
  const sirkaSvete = ram.w / s, vyskaSvete = ram.h / s;

  let grid = '';
  if (v.sit10m) {
    const x0 = Math.floor(v.okno.x / 10) * 10, y0 = Math.floor(v.okno.y / 10) * 10, ln = [];
    for (let x = x0; x <= v.okno.x + sirkaSvete; x += 10) ln.push(`M${f(x)} ${f(v.okno.y)}V${f(v.okno.y + vyskaSvete)}`);
    for (let y = y0; y <= v.okno.y + vyskaSvete; y += 10) ln.push(`M${f(v.okno.x)} ${f(y)}H${f(v.okno.x + sirkaSvete)}`);
    grid = `<path d="${ln.join('')}" stroke="#7a7a7a" stroke-opacity=".55" stroke-width="${f(k(0.12))}" fill="none" data-sit="1"/>`;
  }

  let pozadi = '';
  const pz = v.pozadi, pr = pz && o.prilohy?.[pz.prilohaId];
  if (pz && pr) pozadi = `<image data-pozadi="1" href="${esc(pr.data)}" x="${f(pz.x)}" y="${f(pz.y)}" width="${f(pz.sirkaPx * pz.mNaPx)}" height="${f(pz.vyskaPx * pz.mNaPx)}" opacity="${pz.kryti ?? 1}" preserveAspectRatio="none"/>`;

  const vrstvy = v.vrstvy.filter((l) => l.viditelna).map((l) => `<g data-vrstva="${l.id}">${v.prvky.filter((p) => p.vrstva === l.id).map((p) => prvekSvg(p, ctx)).join('')}</g>`).join('');
  const bezVrstvy = v.prvky.filter((p) => !v.vrstvy.some((l) => l.id === p.vrstva)).map((p) => prvekSvg(p, ctx)).join('');   // osiřelé prvky se nesmí ztratit

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${L.W} ${L.H}" width="${L.W}mm" height="${L.H}mm" font-family="Arial,sans-serif">` +
    `<defs><clipPath id="ramClip"><rect x="${ram.x}" y="${ram.y}" width="${ram.w}" height="${ram.h}"/></clipPath></defs>` +
    `<rect width="${L.W}" height="${L.H}" fill="#fff"/>` +
    `<g clip-path="url(#ramClip)"><rect x="${ram.x}" y="${ram.y}" width="${ram.w}" height="${ram.h}" fill="#fff"/>` +
    `<g id="svet" transform="translate(${f(ox)} ${f(oy)}) scale(${f(s)})">${pozadi}${grid}${vrstvy}${bezVrstvy}</g>` +
    `${pravitko(L, s, k)}${v.severka.uhel !== null ? severka(L, v.severka.uhel) : ''}${legenda(v, oo, L)}</g>` +
    `<rect x="${ram.x}" y="${ram.y}" width="${ram.w}" height="${ram.h}" fill="none" stroke="#000" stroke-width="0.5"/>${razitko(v, oo, L)}</svg>`;
}

export { delkaLomene };
