// Vykreslení listu výkresu do SVG (mm na papíře). Stejný kód pro editor i pro export (SVG/PNG/PDF).
import { rozlozeniListu, mmNaM, dvereGeom, delkaTrasy, formatDelky, meritkoOvereno, pouziteZnacky, bboxVsech, viditelnePrvky, prekryvaObdelnik } from './prvky.js';
import { trasaEvakSvg, jsteZdeSvg, slozEvakSvg, MIN_STENA_MM, MIN_PRICKA_MM } from './evakplan.js';
import { delkaLomene } from './geom.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const f = (n) => (Math.round(n * 1000) / 1000).toString();
const pts = (b) => b.map(([x, y]) => `${f(x)},${f(y)}`).join(' ');
const DELKY_PRAVITKA = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
// Hodnoty z dat projektu jdou do atributů SVG (i z cizího souboru): barva jen #rgb / #rrggbb, čísla jen konečná – jinak výchozí.
const barva = (c, d = '#000000') => (typeof c === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c) ? c : d);
const cislo = (n, d) => (typeof n === 'number' && Number.isFinite(n) ? n : d);

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
  return `<g data-id="${esc(d.id)}" data-druh="dvere">${out.join('')}</g>`;
}

function prvekSvg(p, ctx) {
  const { s, k, pomer, prvky, znacka } = ctx;
  const dash = { carkovana: `${f(k(3))},${f(k(1.5))}`, carkocara: `${f(k(5))},${f(k(1.2))},${f(k(1))},${f(k(1.2))}` };
  const id = `data-id="${esc(p.id)}" data-druh="${esc(p.druh)}"`;
  const tl = (d) => cislo(p.tloustka, d), vypln = p.vypln ? barva(p.vypln, 'none') : 'none', kryti = f(cislo(p.kryti, 1)), uhel = f(cislo(p.uhel, 0));
  switch (p.druh) {
    case 'stena': return `<polyline ${id} points="${pts(p.body)}" fill="none" stroke="${barva(p.barva)}" stroke-width="${f(Math.max(cislo(p.tloustkaM, 0.3), k(ctx.evak ? MIN_STENA_MM : 0.5)))}" stroke-linejoin="miter" stroke-linecap="square"/>`;
    case 'cara': return `<polyline ${id} points="${pts(p.body)}" fill="none" stroke="${barva(p.barva)}" stroke-width="${f(k(ctx.evak ? Math.max(tl(0.5), MIN_PRICKA_MM) : tl(0.5)))}" ${dash[p.styl] ? `stroke-dasharray="${dash[p.styl]}"` : ''} stroke-linejoin="round"/>`;
    case 'volna': return `<polyline ${id} points="${pts(p.body)}" fill="none" stroke="${barva(p.barva)}" stroke-width="${f(k(tl(0.5)))}" stroke-linejoin="round" stroke-linecap="round"/>`;
    case 'plocha': return `<polygon ${id} points="${pts(p.body)}" fill="${vypln}" fill-opacity="${kryti}" stroke="${barva(p.barva)}" stroke-width="${f(k(tl(0.3)))}" stroke-linejoin="round"/>`;
    case 'obdelnik': return `<rect ${id} x="${f(p.cx - p.w / 2)}" y="${f(p.cy - p.h / 2)}" width="${f(p.w)}" height="${f(p.h)}" fill="${vypln}" fill-opacity="${kryti}" stroke="${barva(p.barva)}" stroke-width="${f(k(tl(0.5)))}" transform="rotate(${uhel} ${f(p.cx)} ${f(p.cy)})"/>`;
    case 'elipsa': return `<ellipse ${id} cx="${f(p.cx)}" cy="${f(p.cy)}" rx="${f(p.rx)}" ry="${f(p.ry)}" fill="${vypln}" fill-opacity="${kryti}" stroke="${barva(p.barva)}" stroke-width="${f(k(tl(0.5)))}" transform="rotate(${uhel} ${f(p.cx)} ${f(p.cy)})"/>`;
    case 'trasa': {
      if (ctx.evak) return trasaEvakSvg(p, k, id);
      const b = p.body, n = b.length; if (n < 2) return '';
      const c = barva(p.barva, '#2f9e44');
      let arrow = '';
      if (p.sipka) {
        const a = b[n - 2], e = b[n - 1], L = Math.hypot(e[0] - a[0], e[1] - a[1]) || 1, u = [(e[0] - a[0]) / L, (e[1] - a[1]) / L], l = k(3.2), w = k(1.6);
        arrow = `<polygon points="${pts([e, [e[0] - u[0] * l - u[1] * w, e[1] - u[1] * l + u[0] * w], [e[0] - u[0] * l + u[1] * w, e[1] - u[1] * l - u[0] * w]])}" fill="${c}"/>`;
      }
      // popisek délky uprostřed trasy
      let half = delkaTrasy(p) / 2, m = b[0];
      for (let i = 1; i < n; i++) { const l = Math.hypot(b[i][0] - b[i - 1][0], b[i][1] - b[i - 1][1]); if (half <= l || i === n - 1) { const t = l ? Math.min(half / l, 1) : 0; m = [b[i - 1][0] + (b[i][0] - b[i - 1][0]) * t, b[i - 1][1] + (b[i][1] - b[i - 1][1]) * t]; break; } half -= l; }
      return `<g ${id}><polyline points="${pts(b)}" fill="none" stroke="${c}" stroke-width="${f(k(tl(0.8)))}" stroke-linejoin="round" stroke-dasharray="${f(k(2.4))},${f(k(1.2))}"/>${arrow}<text x="${f(m[0])}" y="${f(m[1] - k(1.2))}" font-size="${f(k(2.6))}" font-family="Arial,sans-serif" font-weight="700" text-anchor="middle" fill="${c}" stroke="#fff" stroke-width="${f(k(0.7))}" paint-order="stroke">${esc(formatDelky(delkaTrasy(p)))}</text></g>`;
    }
    case 'text': {
      const h = mmNaM(cislo(p.vyska, 3), pomer), lines = String(p.text ?? '').split('\n');
      return `<text ${id} x="${f(p.x)}" y="${f(p.y)}" font-size="${f(h)}" font-family="Arial,sans-serif" fill="${barva(p.barva)}" transform="rotate(${uhel} ${f(p.x)} ${f(p.y)})">${lines.map((l, i) => `<tspan x="${f(p.x)}" dy="${i ? f(h * 1.2) : 0}">${esc(l)}</tspan>`).join('')}</text>`;
    }
    case 'znacka': {
      const w = mmNaM(cislo(p.velikost, 8), pomer), z = znacka(p.znackaId);
      const r = `rotate(${uhel} ${f(p.x)} ${f(p.y)})`;
      return z
        ? `<image ${id} href="${esc(z)}" x="${f(p.x - w / 2)}" y="${f(p.y - w / 2)}" width="${f(w)}" height="${f(w)}" preserveAspectRatio="xMidYMid meet" transform="${r}"/>`
        : `<g ${id} transform="${r}"><rect x="${f(p.x - w / 2)}" y="${f(p.y - w / 2)}" width="${f(w)}" height="${f(w)}" fill="#fff" stroke="#c00" stroke-width="${f(k(0.4))}" stroke-dasharray="${f(k(1))}"/><text x="${f(p.x)}" y="${f(p.y)}" font-size="${f(w * 0.6)}" text-anchor="middle" dominant-baseline="central" fill="#c00">?</text></g>`;
    }
    case 'dvere': return dveře(p, prvky, s, k);
    default: return '';
  }
}
// Poškozený prvek (např. z cizího souboru) nesmí shodit vykreslení celého listu.
const prvekBezpecne = (p, ctx) => { try { return prvekSvg(p, ctx); } catch { return ''; } };
const kontext = (v, o) => { const pomer = v.meritko.pomer, s = 1000 / pomer; return { s, k: (mm) => mm / s, pomer, prvky: v.prvky, evak: !!v.evakPlan, znacka: (id) => (o.znacky.has(id) ? o.symbolHref(id) : null) }; };
// SVG jednoho prvku (stejné jako v celém listu) – editor jím při tažení překresluje jen tažené prvky.
export const svgPrvku = (v, p, o) => prvekBezpecne(p, kontext(v, o));

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
  return `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(cislo(uhel, 0))})"><circle r="8" fill="#fff" fill-opacity=".8" stroke="#000" stroke-width="0.3"/><polygon points="0,-7 3,3 0,1.2 -3,3" fill="#000"/><text y="-9.2" font-size="4" font-family="Arial,sans-serif" font-weight="700" text-anchor="middle">S</text></g>`;
}

// ---------- legenda ----------
export const POLOHY_LEGENDY = { 'vpravo-dole': 'Vpravo dole', 'vlevo-dole': 'Vlevo dole', 'vpravo-nahore': 'Vpravo nahoře', 'vlevo-nahore': 'Vlevo nahoře' };
const RADEK_LEG = 7.5, SLOUPEC_LEG = 78, HLAVA_LEG = 11, OKRAJ_LEG = 2;
const maSeverku = (v) => v.severka?.uhel !== null && v.severka?.uhel !== undefined;

// Obsah a umístění legendy listu DZP na papíře (mm), null = legenda se nekreslí. Jen značky a trasy, které se opravdu
// vykreslí (ne ze skrytých vrstev). Legenda se vždy vejde do rámu: sloupců nejvýš tolik, kolik se vejde na šířku, a když je
// i tak vyšší než rám, celá se zmenší (k < 1). Vlevo dole nechá místo grafickému měřítku, vpravo nahoře severce.
export function rozlozeniLegendy(v) {
  if (v.evakPlan || !v.legendaZobrazit) return null;
  const vid = viditelnePrvky(v), ids = pouziteZnacky(vid), maTrasu = vid.some((p) => p.druh === 'trasa'), n = ids.length + (maTrasu ? 1 : 0);
  if (!n) return null;
  const { ram } = rozlozeniListu(v), poloha = POLOHY_LEGENDY[v.legendaPoloha] ? v.legendaPoloha : 'vpravo-dole';
  const dole = poloha.endsWith('dole'), vlevo = poloha.startsWith('vlevo');
  const rezerva = dole && vlevo ? 12 : !dole && !vlevo && maSeverku(v) ? 26 : 0;
  const sloupcu = Math.max(1, Math.min(Math.ceil(n / 9), Math.floor((ram.w - 2 * OKRAJ_LEG - 4) / SLOUPEC_LEG))), radku = Math.ceil(n / sloupcu);
  const w0 = sloupcu * SLOUPEC_LEG + 4, h0 = radku * RADEK_LEG + HLAVA_LEG;
  const k = Math.min(1, (ram.w - 2 * OKRAJ_LEG) / w0, (ram.h - 2 * OKRAJ_LEG - rezerva) / h0), w = w0 * k, h = h0 * k;
  const x = vlevo ? ram.x + OKRAJ_LEG : ram.x + ram.w - w - OKRAJ_LEG, y = dole ? ram.y + ram.h - h - OKRAJ_LEG - rezerva : ram.y + OKRAJ_LEG + rezerva;
  return { x, y, w, h, k, sloupcu, radku, ids, maTrasu, poloha };
}

// Prvky listu (id), jejichž obrys zasahuje pod legendu – legenda je na výkresu i v PDF zakryje. Jen vykreslované prvky;
// u evakuačního plánu (legenda mimo výkres) a bez legendy prázdné pole.
export function prekryvaLegenda(v) {
  const r = rozlozeniLegendy(v); if (!r) return [];
  const { ram } = rozlozeniListu(v), pomer = v.meritko.pomer, s = 1000 / pomer, X = (x) => v.okno.x + (x - ram.x) / s, Y = (y) => v.okno.y + (y - ram.y) / s;
  const box = { x0: X(r.x), y0: Y(r.y), x1: X(r.x + r.w), y1: Y(r.y + r.h) };
  return viditelnePrvky(v).filter((p) => { try { return prekryvaObdelnik(p, box, pomer, v.prvky); } catch { return false; } }).map((p) => p.id);
}

function legenda(v, o) {
  const r = rozlozeniLegendy(v); if (!r) return '';
  const polozky = r.ids.map((id) => ({ znacka: id, text: o.nazevZnacky(id) }));
  if (r.maTrasu) polozky.push({ trasa: true, text: 'Úniková / zásahová trasa (délka v metrech u trasy)' });
  const zalom = (t) => { const out = []; let cur = ''; for (const w2 of String(t).split(' ')) { if ((cur + ' ' + w2).trim().length > 36 && cur) { out.push(cur); cur = w2; } else cur = (cur + ' ' + w2).trim(); } if (cur) out.push(cur); return out.slice(0, 3); };
  const radky = polozky.map((it, i) => {   // souřadnice uvnitř legendy (před zmenšením)
    const cx = 2 + Math.floor(i / r.radku) * SLOUPEC_LEG, cy = 8 + (i % r.radku) * RADEK_LEG;
    const ikona = it.trasa ? `<line x1="${f(cx)}" y1="${f(cy + 3)}" x2="${f(cx + 6)}" y2="${f(cy + 3)}" stroke="#2f9e44" stroke-width="0.8" stroke-dasharray="2,1"/>` : `<image href="${esc(o.symbolHref(it.znacka))}" x="${f(cx)}" y="${f(cy)}" width="6" height="6" preserveAspectRatio="xMidYMid meet"/>`;
    const ls = zalom(it.text);
    return `${ikona}<text x="${f(cx + 7.5)}" y="${f(cy + 2.4)}" font-size="2.1" font-family="Arial,sans-serif">${ls.map((l, j) => `<tspan x="${f(cx + 7.5)}" dy="${j ? 2.4 : 0}">${esc(l)}</tspan>`).join('')}</text>`;
  });
  return `<g data-legenda="1" transform="translate(${f(r.x)} ${f(r.y)})${r.k < 1 ? ` scale(${f(r.k)})` : ''}"><rect x="0" y="0" width="${f(r.w / r.k)}" height="${f(r.h / r.k)}" fill="#fff" stroke="#000" stroke-width="0.3"/><text x="2" y="5" font-size="2.8" font-weight="700" font-family="Arial,sans-serif">LEGENDA ZNAČEK</text>${radky.join('')}</g>`;
}

// ---------- razítko (vzor HZS SČK: podklady/VZOR_operativni_karta_list_A4.docx, poslední tabulka) ----------
const TYP_LISTU = { situace: 'SITUACE', pudorys: 'PŮDORYS', schema: 'SCHÉMA' };
const spoj = (casti, odd) => casti.map((x) => String(x ?? '').trim()).filter(Boolean).join(odd);
const datumCz = (d) => { const t = String(d ?? '').trim(), m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t); return m ? `${Number(m[3])}. ${Number(m[2])}. ${m[1]}` : t; };

// Údaje razítka: vlastní hodnota listu, jinak z operativní karty projektu (zpracoval + č. osvědčení, schválil + funkce, datum)
// a název objektu. zKarty = hodnoty, které by se doplnily z karty (nápověda v panelu).
export function udajeRazitka(v, { karta = null, objektNazev = '' } = {}) {
  const r = v.razitko || {}, zp = karta?.zpracoval || {}, sch = karta?.schvalil || {};
  const zKarty = { nazev: String(objektNazev ?? '').trim(), zpracoval: spoj([zp.jmeno, zp.cisloOsvedceni], ' '), schvalil: spoj([sch.jmeno, sch.funkce], ', '), datum: String(zp.datum ?? '').trim() };
  const vl = (k) => String(r[k] ?? '').trim();
  return { nazev: vl('nazev') || zKarty.nazev, zpracoval: vl('zpracoval') || zKarty.zpracoval, schvalil: vl('schvalil') || zKarty.schvalil, datum: vl('datum') || zKarty.datum, zKarty };
}
export { datumCz };

// Přibližná šířka znaku písma Arial v em (diakritika jako základní písmeno) – zalomení textu v razítku platí stejně pro obrazovku i PDF.
function em(c) {
  const z = c.normalize('NFD')[0] || c;
  if (z === ' ') return 0.28;
  if ('iljI.,:;\'!|'.includes(z)) return 0.25;
  if ('ft()[]/-'.includes(z)) return 0.31;
  if (z === 'r') return 0.34;
  if (z === 'm' || z === 'M') return 0.84;
  if (z === 'w') return 0.73;
  if (z === 'W') return 0.95;
  if (z >= '0' && z <= '9') return 0.56;
  if (z >= 'A' && z <= 'Z') return 0.7;
  if (z >= 'a' && z <= 'z') return 0.54;
  return 0.62;
}
export const sirkaTextu = (t, vel, tucne = false) => { let s = 0; for (const c of String(t)) s += em(c); return s * vel * (tucne ? 1.08 : 1); };
function rozdel(text, sirka, vel, tucne) {
  const out = []; let cur = '';
  for (const slovo of text.split(' ')) {
    const zkus = cur ? `${cur} ${slovo}` : slovo;
    if (sirkaTextu(zkus, vel, tucne) <= sirka) { cur = zkus; continue; }
    if (cur) out.push(cur);
    let zb = slovo;                                     // slovo delší než buňka: zalomit po znacích
    while (zb.length > 1 && sirkaTextu(zb, vel, tucne) > sirka) { let i = zb.length - 1; while (i > 1 && sirkaTextu(zb.slice(0, i), vel, tucne) > sirka) i--; out.push(zb.slice(0, i)); zb = zb.slice(i); }
    cur = zb;
  }
  if (cur) out.push(cur);
  return out;
}
const vypustka = (t, sirka, vel, tucne) => { if (sirkaTextu(t, vel, tucne) <= sirka) return t; let s = t; while (s.length > 1 && sirkaTextu(`${s}…`, vel, tucne) > sirka) s = s.slice(0, -1); return `${s.trimEnd()}…`; };
// Zalomí text do šířky buňky (mm): nejvýš `max` řádků, když se nevejde, zmenší písmo až na `min` a zbytek zkrátí výpustkou.
export function zalomDoBunky(t, sirka, vel, { max = 2, min = vel * 0.75, tucne = false } = {}) {
  const text = String(t ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return { radky: [], vel };
  for (let v = vel; ; v = Math.max(min, v * 0.9)) {
    const radky = rozdel(text, sirka, v, tucne);
    if (radky.length <= max) return { radky, vel: v };
    if (v <= min) return { radky: [...radky.slice(0, max - 1), vypustka(radky.slice(max - 1).join(' '), sirka, v, tucne)], vel: v };
  }
}

function razitko(v, o, L) {
  const r = L.razitko, H1 = 13, P = 1.6, u = udajeRazitka(v, o), ov = meritkoOvereno(v);
  const x1 = r.x + r.w * 0.3006, x2 = r.x + r.w * 0.6327, xd = r.x + r.w * 0.466, x3 = r.x + r.w, yd = r.y + H1;
  const T = (x, y, t, sz, ex = '') => `<text x="${f(x)}" y="${f(y)}" font-size="${f(sz)}" font-family="Arial,sans-serif" ${ex}>${esc(t)}</text>`;
  const stitek = (x, y, t) => T(x, y, t, 2.2, 'fill="#555"');
  const radky = (x, y0, z, ex = '') => z.radky.map((t, i) => T(x, y0 + i * z.vel * 1.08, t, z.vel, ex)).join('');
  // 1. řádek: MĚŘÍTKO | NÁZEV (objekt, pod ním název listu) | žluté pole s druhem listu
  let nazev = zalomDoBunky(u.nazev, x2 - x1 - 2 * P, 3.4, { tucne: true, min: 2.4 });
  if (nazev.radky.length > 1 && nazev.vel > 2.9) nazev = zalomDoBunky(u.nazev, x2 - x1 - 2 * P, 2.9, { tucne: true, min: 2.4 });
  const yN = r.y + 3.2 + nazev.vel + 0.4, list = zalomDoBunky(o.nazevListu, x2 - x1 - 2 * P, 2.2, { max: 1, min: 1.8 });
  const yL = nazev.radky.length ? yN + (nazev.radky.length - 1) * nazev.vel * 1.08 + list.vel + 0.7 : r.y + 7;
  const druh = TYP_LISTU[o.typListu] ? [...TYP_LISTU[o.typListu]].join(' ') : '', szDruh = druh ? Math.min(5, ((x3 - x2 - 2 * P) / sirkaTextu(druh, 1, true)) * 0.98) : 5;
  // 2. řádek: SCHVÁLIL | ZPRACOVAL (jméno, č. osvědčení) + datum
  const sch = zalomDoBunky(u.schvalil, xd - r.x - 2 * P, 2.8, { min: 2.2 }), zpr = zalomDoBunky(u.zpracoval, x3 - xd - 2 * P, 2.8, { min: 2.2 });
  return `<g><rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="#fff"/><rect x="${f(x2)}" y="${f(r.y)}" width="${f(x3 - x2)}" height="${f(H1)}" fill="#FFFF00"/>` +
    `<rect x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" fill="none" stroke="#000" stroke-width="0.5"/>` +
    `<line x1="${f(r.x)}" y1="${f(yd)}" x2="${f(x3)}" y2="${f(yd)}" stroke="#000" stroke-width="0.3"/><line x1="${f(x1)}" y1="${f(r.y)}" x2="${f(x1)}" y2="${f(yd)}" stroke="#000" stroke-width="0.3"/><line x1="${f(x2)}" y1="${f(r.y)}" x2="${f(x2)}" y2="${f(yd)}" stroke="#000" stroke-width="0.3"/><line x1="${f(xd)}" y1="${f(yd)}" x2="${f(xd)}" y2="${f(r.y + r.h)}" stroke="#000" stroke-width="0.3"/>` +
    stitek(r.x + P, r.y + 3.2, 'MĚŘÍTKO:') + T(r.x + P, r.y + 8.6, `1 : ${v.meritko.pomer}`, 4.2, 'font-weight="700"') +
    (ov ? '' : T(r.x + P, r.y + 11.9, 'MĚŘÍTKO NEOVĚŘENO', 2.1, 'fill="#c00" font-weight="700"')) +
    stitek(x1 + P, r.y + 3.2, 'NÁZEV:') + radky(x1 + P, yN, nazev, 'font-weight="700"') + radky(x1 + P, yL, list) +
    (druh ? T((x2 + x3) / 2, r.y + H1 / 2 + szDruh * 0.36, druh, szDruh, 'font-weight="700" text-anchor="middle"') : '') +
    stitek(r.x + P, yd + 3.2, 'SCHVÁLIL:') + radky(r.x + P, yd + 6.6, sch) +
    stitek(xd + P, yd + 3.2, 'ZPRACOVAL:') + T(x3 - P, yd + 3.2, `datum: ${datumCz(u.datum)}`, 2.4, 'text-anchor="end"') + radky(xd + P, yd + 6.6, zpr) + `</g>`;
}

// o: { objektNazev, nazevListu, typListu (situace|pudorys|schema), karta (první operativní karta projektu nebo null),
//      znacky: Map(id -> {nazev, png}), symbolHref(id), prilohy, rezim }
export function renderListu(v, o) {
  const L = rozlozeniListu(v), pomer = v.meritko.pomer, s = 1000 / pomer, k = (mm) => mm / s;
  const ram = L.ram, ox = ram.x - v.okno.x * s, oy = ram.y - v.okno.y * s;
  const ctx = kontext(v, o);
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
  if (pz && pr) pozadi = `<image data-pozadi="1" href="${esc(pr.data)}" x="${f(pz.x)}" y="${f(pz.y)}" width="${f(pz.sirkaPx * pz.mNaPx)}" height="${f(pz.vyskaPx * pz.mNaPx)}" opacity="${f(cislo(pz.kryti, 1))}" preserveAspectRatio="none"/>`;

  const vrstvy = v.vrstvy.filter((l) => l.viditelna).map((l) => `<g data-vrstva="${esc(l.id)}">${v.prvky.filter((p) => p.vrstva === l.id).map((p) => prvekBezpecne(p, ctx)).join('')}</g>`).join('');
  const bezVrstvy = v.prvky.filter((p) => !v.vrstvy.some((l) => l.id === p.vrstva)).map((p) => prvekBezpecne(p, ctx)).join('');   // osiřelé prvky se nesmí ztratit

  if (v.evakPlan) {
    const jz = v.evakPlan.jsteZde ? jsteZdeSvg(v.evakPlan.jsteZde, k) : '';
    return slozEvakSvg({ v, L, o: { ...oo, pouziteZnacky: pouziteZnacky(viditelnePrvky(v)) }, svet: `${pozadi}${grid}${vrstvy}${bezVrstvy}${jz}`, pravitko: pravitko(L, s, k), ox, oy, s, bb: bboxVsech(v.prvky, pomer), objekt: o.objektNazev });
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${L.W} ${L.H}" width="${L.W}mm" height="${L.H}mm" font-family="Arial,sans-serif">` +
    `<defs><clipPath id="ramClip"><rect x="${ram.x}" y="${ram.y}" width="${ram.w}" height="${ram.h}"/></clipPath></defs>` +
    `<rect width="${L.W}" height="${L.H}" fill="#fff"/>` +
    `<g clip-path="url(#ramClip)"><rect x="${ram.x}" y="${ram.y}" width="${ram.w}" height="${ram.h}" fill="#fff"/>` +
    `<g id="svet" transform="translate(${f(ox)} ${f(oy)}) scale(${f(s)})">${pozadi}${grid}${vrstvy}${bezVrstvy}</g>` +
    `${pravitko(L, s, k)}${maSeverku(v) ? severka(L, v.severka.uhel) : ''}${legenda(v, oo)}</g>` +
    `<rect x="${ram.x}" y="${ram.y}" width="${ram.w}" height="${ram.h}" fill="none" stroke="#000" stroke-width="0.5"/>${razitko(v, oo, L)}</svg>`;
}

export { delkaLomene };
