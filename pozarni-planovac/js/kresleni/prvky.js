// Prvky výkresu (situace, půdorys, schéma). Souřadnice v metrech. Velikosti značek a textu v mm na papíře
// (1–500, krok 0,1); jejich skutečná velikost = mm × měřítko / 1000. Čisté funkce, bez DOM, testovatelné v Node.
import { dist, rad, deg, delkaLomene, nejblizsiNaLomene, bodNaLomene, bodVPolygonu, otoc, bbox, spojBbox } from './geom.js';
import { normalizujVelikost } from '../model.js';

export const DRUHY = ['stena', 'cara', 'trasa', 'plocha', 'obdelnik', 'elipsa', 'volna', 'text', 'znacka', 'dvere'];
export const TYPY_DVERI = ['jednokridle', 'dvoukridle', 'vrata'];
export const MERITKA = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 1500, 2000, 2500, 5000, 10000];

// Barvy podle metodiky Hanuška 1996, kap. 2.3.1
export const BARVY = {
  modra: ['#1e5fd0', 'modrá – hašení (vodní zdroje, sklady nářadí)'],
  cervena: ['#d62b1f', 'červená – komplikace a nebezpečí'],
  oranzova: ['#f57c00', 'oranžová – komplikace a nebezpečí'],
  zelena: ['#2f9e44', 'zelená – okolí bez úpravy, vegetace'],
  hneda: ['#8b5a2b', 'hnědá – hořlavý povrch, požární mosty'],
  zluta: ['#f2d200', 'žlutá – nástupní plochy, komunikace'],
  cerna: ['#000000', 'černá – stavební konstrukce'],
};

const uid = () => `e_${Math.random().toString(36).slice(2, 10)}`;
export const mmNaM = (mm, pomer) => (mm * pomer) / 1000;

const VYCHOZI = {
  stena: { tloustkaM: 0.3, barva: '#000000' },
  cara: { tloustka: 0.5, barva: '#000000', styl: 'plna' },
  trasa: { tloustka: 0.8, barva: '#2f9e44', sipka: true },
  plocha: { tloustka: 0.3, barva: '#000000', vypln: '#f2d200', kryti: 0.6 },
  obdelnik: { tloustka: 0.5, barva: '#000000', vypln: null, kryti: 1 },
  elipsa: { tloustka: 0.5, barva: '#000000', vypln: null, kryti: 1 },
  volna: { tloustka: 0.5, barva: '#000000' },
  text: { vyska: 3, barva: '#000000', uhel: 0 },
  znacka: { velikost: 8, uhel: 0 },
  dvere: { sirkaM: 0.9, typ: 'jednokridle', typAuto: true, smer: 1, zavesy: 1, stenaId: null, seg: 0, t: 0.5, x: 0, y: 0, uhel: 0 },
};

export function novyPrvek(druh, props = {}, vrstva = 'zaklad') {
  if (!DRUHY.includes(druh)) throw new Error(`Neznámý druh prvku: ${druh}`);
  return { id: uid(), druh, vrstva, ...structuredClone(VYCHOZI[druh]), ...props };
}

export const jeLomena = (p) => ['stena', 'cara', 'trasa', 'plocha', 'volna'].includes(p.druh);
export const jeUzavrena = (p) => p.druh === 'plocha';
export const najdi = (prvky, id) => prvky.find((p) => p.id === id) || null;

// ---------- dveře ----------
export function typDveriPodleSirky(w) { return w <= 1.1 ? 'jednokridle' : w <= 2.2 ? 'dvoukridle' : 'vrata'; }

export function dvereGeom(d, prvky) {
  const stena = d.stenaId ? najdi(prvky, d.stenaId) : null;
  if (stena && stena.druh === 'stena' && stena.body.length >= 2) {
    const r = bodNaLomene(stena.body, d.seg, d.t);
    return { cx: r.bod[0], cy: r.bod[1], ux: r.smer[0], uy: r.smer[1], w: d.sirkaM, pripojene: true, stena };
  }
  const r = rad(d.uhel || 0);
  return { cx: d.x, cy: d.y, ux: Math.cos(r), uy: Math.sin(r), w: d.sirkaM, pripojene: false, stena: null };
}

// Po každé úpravě: dveře navázané na smazanou stěnu se odpojí a zůstanou na posledním místě;
// u ostatních se aktualizuje uložená poloha (x, y, uhel) a segment se ořízne na existující.
export function obnovDvere(prvky) {
  for (const d of prvky) {
    if (d.druh !== 'dvere') continue;
    if (d.stenaId) {
      const s = najdi(prvky, d.stenaId);
      if (!s || s.druh !== 'stena' || s.body.length < 2) { d.stenaId = null; continue; }
      d.seg = Math.max(0, Math.min(s.body.length - 2, d.seg));
      d.t = Math.max(0, Math.min(1, d.t));
    }
    const g = dvereGeom(d, prvky);
    d.x = g.cx; d.y = g.cy; d.uhel = deg(Math.atan2(g.uy, g.ux));
  }
}

export function nejblizsiStena(prvky, bod, tol, jenOdemcene = true, vrstvyZamk = new Set()) {
  let best = null;
  for (const s of prvky) {
    if (s.druh !== 'stena' || s.body.length < 2) continue;
    if (jenOdemcene && vrstvyZamk.has(s.vrstva)) continue;
    const r = nejblizsiNaLomene(bod, s.body);
    if (r.d <= tol && (!best || r.d < best.d)) best = { stena: s, seg: r.seg, t: r.t, d: r.d };
  }
  return best;
}

export function pripojDvere(d, prvky, bod, tol = Infinity) {
  const r = nejblizsiStena(prvky, bod, tol);
  if (!r) return false;
  Object.assign(d, { stenaId: r.stena.id, seg: r.seg, t: r.t });
  obnovDvere(prvky);
  return true;
}
export const odpojDvere = (d, prvky) => { obnovDvere(prvky); d.stenaId = null; };

// Posun dveří ukazatelem. Připojené dveře se pohybují po stěně a mohou přeskočit na jinou stěnu v toleranci;
// volné dveře se pohybují volně a po puštění se připojí, jsou-li dost blízko stěny.
export function posunDvere(d, prvky, bod, tol, uvolnit = false) {
  const cizi = nejblizsiStena(prvky, bod, tol);
  if (cizi) { Object.assign(d, { stenaId: cizi.stena.id, seg: cizi.seg, t: cizi.t }); }
  else if (d.stenaId) {
    const s = najdi(prvky, d.stenaId);
    if (s) { const r = nejblizsiNaLomene(bod, s.body); d.seg = r.seg; d.t = r.t; }
  } else { d.x = bod[0]; d.y = bod[1]; }
  void uvolnit;
  obnovDvere(prvky);
}

export function nastavSirkuDveri(d, w, prvky) {
  d.sirkaM = Math.max(0.3, Math.round(w * 100) / 100);
  if (d.typAuto) d.typ = typDveriPodleSirky(d.sirkaM);
  obnovDvere(prvky);
}
export function nastavTypDveri(d, typ) { if (!TYPY_DVERI.includes(typ)) throw new Error('Neznámý typ dveří'); d.typ = typ; d.typAuto = false; }

// ---------- rozměry, výběr, transformace ----------
export function bboxPrvku(p, pomer, prvky = []) {
  switch (p.druh) {
    case 'stena': { const b = bbox(p.body), r = p.tloustkaM / 2; return b && { x0: b.x0 - r, y0: b.y0 - r, x1: b.x1 + r, y1: b.y1 + r }; }
    case 'cara': case 'trasa': case 'plocha': case 'volna': return bbox(p.body);
    case 'obdelnik': { const h = [[-p.w / 2, -p.h / 2], [p.w / 2, -p.h / 2], [p.w / 2, p.h / 2], [-p.w / 2, p.h / 2]].map(([x, y]) => otoc([p.cx + x, p.cy + y], [p.cx, p.cy], rad(p.uhel || 0))); return bbox(h); }
    case 'elipsa': { const pts = []; for (let i = 0; i < 24; i++) { const a = (i / 24) * 2 * Math.PI; pts.push(otoc([p.cx + p.rx * Math.cos(a), p.cy + p.ry * Math.sin(a)], [p.cx, p.cy], rad(p.uhel || 0))); } return bbox(pts); }
    case 'text': { const h = mmNaM(p.vyska, pomer), lines = String(p.text).split('\n'), w = Math.max(...lines.map((l) => l.length), 1) * h * 0.55; return bbox([[p.x, p.y - h], [p.x + w, p.y - h], [p.x + w, p.y + (lines.length - 1) * h * 1.2], [p.x, p.y + (lines.length - 1) * h * 1.2]].map((q) => otoc(q, [p.x, p.y], rad(p.uhel || 0)))); }
    case 'znacka': { const s = mmNaM(p.velikost, pomer) / 2; return bbox([[-s, -s], [s, -s], [s, s], [-s, s]].map(([x, y]) => otoc([p.x + x, p.y + y], [p.x, p.y], rad(p.uhel || 0)))); }
    case 'dvere': { const g = dvereGeom(p, prvky), n = [-g.uy, g.ux], w = g.w; return bbox([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [g.cx + g.ux * a * w / 2 + n[0] * b * w, g.cy + g.uy * a * w / 2 + n[1] * b * w])); }
    default: return null;
  }
}

export const bboxVsech = (prvky, pomer) => prvky.reduce((a, p) => spojBbox(a, bboxPrvku(p, pomer, prvky)), null);

export function zasah(p, bod, tol, pomer, prvky = []) {
  const near = (body, zav) => { const r = nejblizsiNaLomene(bod, body, zav); return r && r.d; };
  switch (p.druh) {
    case 'stena': return (near(p.body) ?? Infinity) <= Math.max(tol, p.tloustkaM / 2);
    case 'cara': case 'trasa': case 'volna': return (near(p.body) ?? Infinity) <= tol;
    case 'plocha': return bodVPolygonu(bod, p.body) || (near(p.body, true) ?? Infinity) <= tol;
    case 'obdelnik': { const q = otoc(bod, [p.cx, p.cy], -rad(p.uhel || 0)); return Math.abs(q[0] - p.cx) <= p.w / 2 + tol && Math.abs(q[1] - p.cy) <= p.h / 2 + tol; }   // vybírá se i uvnitř (pohodlné na dotyku); nad ním ležící prvky mají přednost
    case 'elipsa': { const q = otoc(bod, [p.cx, p.cy], -rad(p.uhel || 0)); return ((q[0] - p.cx) / (p.rx + tol)) ** 2 + ((q[1] - p.cy) / (p.ry + tol)) ** 2 <= 1; }
    default: { const b = bboxPrvku(p, pomer, prvky); return !!b && bod[0] >= b.x0 - tol && bod[0] <= b.x1 + tol && bod[1] >= b.y0 - tol && bod[1] <= b.y1 + tol; }
  }
}

export function prekryvaObdelnik(p, r, pomer, prvky = []) {
  const b = bboxPrvku(p, pomer, prvky);
  return !!b && b.x0 <= r.x1 && b.x1 >= r.x0 && b.y0 <= r.y1 && b.y1 >= r.y0;
}

export function posunPrvek(p, dx, dy) {
  if (p.body) p.body = p.body.map(([x, y]) => [x + dx, y + dy]);
  if ('cx' in p) { p.cx += dx; p.cy += dy; }
  if (p.druh === 'text' || p.druh === 'znacka' || (p.druh === 'dvere' && !p.stenaId)) { p.x += dx; p.y += dy; }
}

export function otocPrvek(p, c, r) {
  if (p.body) p.body = p.body.map((q) => otoc(q, c, r));
  if ('cx' in p) { [p.cx, p.cy] = otoc([p.cx, p.cy], c, r); p.uhel = (p.uhel || 0) + deg(r); }
  if (p.druh === 'text' || p.druh === 'znacka' || (p.druh === 'dvere' && !p.stenaId)) { [p.x, p.y] = otoc([p.x, p.y], c, r); p.uhel = (p.uhel || 0) + deg(r); }
}

export function meritkujPrvek(p, c, sx, sy) {
  const T = ([x, y]) => [c[0] + (x - c[0]) * sx, c[1] + (y - c[1]) * sy];
  const prum = (Math.abs(sx) + Math.abs(sy)) / 2;
  if (p.body) p.body = p.body.map(T);
  if (p.druh === 'obdelnik' || p.druh === 'elipsa') {
    [p.cx, p.cy] = T([p.cx, p.cy]);
    const osy = Math.abs(((p.uhel || 0) % 180 + 180) % 180) < 1e-6;
    const kx = osy ? Math.abs(sx) : prum, ky = osy ? Math.abs(sy) : prum;
    if (p.druh === 'obdelnik') { p.w *= kx; p.h *= ky; } else { p.rx *= kx; p.ry *= ky; }
  }
  if (p.druh === 'text') { [p.x, p.y] = T([p.x, p.y]); p.vyska = normalizujVelikost(p.vyska * prum); }
  if (p.druh === 'znacka') { [p.x, p.y] = T([p.x, p.y]); p.velikost = normalizujVelikost(p.velikost * prum); }
  if (p.druh === 'dvere' && !p.stenaId) { [p.x, p.y] = T([p.x, p.y]); p.sirkaM = Math.max(0.3, p.sirkaM * prum); }
}

export function stredVyberu(prvky, pomer) {
  const b = bboxVsech(prvky, pomer);
  return b ? [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2] : [0, 0];
}

// Kopie prvků pro vložení; dveře navázané na stěnu, která se nekopíruje, se odpojí.
export function kopiePrvku(vybrane, prvky, dx = 0, dy = 0) {
  const mapa = new Map(), out = [];
  for (const p of vybrane) { const k = structuredClone(p); k.id = uid(); mapa.set(p.id, k.id); out.push(k); }
  for (const k of out) { if (k.druh === 'dvere' && k.stenaId) { if (mapa.has(k.stenaId)) k.stenaId = mapa.get(k.stenaId); else { obnovDvere(prvky); k.stenaId = null; } } }
  for (const k of out) posunPrvek(k, dx, dy);
  return out;
}

// ---------- trasy, legenda, měřítko ----------
export const delkaTrasy = (t) => delkaLomene(t.body);
export const celkovaDelkaTras = (prvky) => prvky.filter((p) => p.druh === 'trasa').reduce((s, t) => s + delkaTrasy(t), 0);
export const formatDelky = (m) => `${m.toFixed(m < 10 ? 2 : 1).replace('.', ',')} m`;

export const pouziteZnacky = (prvky) => [...new Set(prvky.filter((p) => p.druh === 'znacka' && p.znackaId).map((p) => p.znackaId))];
export function synchronizujLegendu(vykres) { vykres.legenda = pouziteZnacky(vykres.prvky); }

// Rozložení listu A4 (mm): rám výkresu a razítko dole.
export function rozlozeniListu(vykres) {
  const na = vykres.orientace === 'na_vysku';
  const W = na ? 210 : 297, H = na ? 297 : 210, M = 10, R = 24;
  return { W, H, ram: { x: M, y: M, w: W - 2 * M, h: H - 2 * M - R }, razitko: { x: M, y: H - M - R, w: W - 2 * M, h: R } };
}

export function navrhniMeritko(vykres) {
  const { ram } = rozlozeniListu(vykres);
  let b = bboxVsech(vykres.prvky, vykres.meritko.pomer);
  const pz = vykres.pozadi;
  if (pz) b = spojBbox(b, { x0: pz.x, y0: pz.y, x1: pz.x + pz.sirkaPx * pz.mNaPx, y1: pz.y + pz.vyskaPx * pz.mNaPx });
  if (!b) return null;
  const w = Math.max(b.x1 - b.x0, 0.01), h = Math.max(b.y1 - b.y0, 0.01);
  return MERITKA.find((m) => (w * 1000) / m <= ram.w * 0.95 && (h * 1000) / m <= ram.h * 0.95) ?? MERITKA[MERITKA.length - 1];
}

export function vycentrujOkno(vykres) {
  const { ram } = rozlozeniListu(vykres), pomer = vykres.meritko.pomer;
  let b = bboxVsech(vykres.prvky, pomer);
  const pz = vykres.pozadi;
  if (pz) b = spojBbox(b, { x0: pz.x, y0: pz.y, x1: pz.x + pz.sirkaPx * pz.mNaPx, y1: pz.y + pz.vyskaPx * pz.mNaPx });
  if (!b) return;
  vykres.okno = { x: (b.x0 + b.x1) / 2 - (ram.w * pomer) / 2000, y: (b.y0 + b.y1) / 2 - (ram.h * pomer) / 2000 };
}

// Měřítko je ověřené, když výkres nemá podklad (kreslí se přímo v metrech) nebo je podklad zkalibrován známou délkou;
// po vektorovém importu musí být ověřené i měřítko importu (jednotky z hlavičky DXF, nebo kalibrace).
export const meritkoOvereno = (vykres) => (vykres.pozadi ? !!vykres.pozadi.kalibrace : true) && (vykres.meritkoZdroj ? !!vykres.meritkoZdroj.overeno : true);

export function kalibruj(pozadi, bodA, bodB, delkaM) {
  // bodA, bodB jsou v pixelech podkladu; délka v metrech musí být kladná.
  if (!(delkaM > 0)) throw new Error('Známá délka musí být kladné číslo');
  const px = dist(bodA, bodB);
  if (px < 1e-6) throw new Error('Body kalibrace splývají');
  pozadi.mNaPx = delkaM / px;
  pozadi.kalibrace = { bodA, bodB, delkaM };
}

// ---------- historie (undo / redo) ----------
export class Historie {
  constructor(snap) { this.s = [snap]; this.i = 0; }
  push(snap) {
    if (snap === this.s[this.i]) return false;
    this.s = this.s.slice(0, this.i + 1); this.s.push(snap);
    if (this.s.length > 150) this.s.shift();
    this.i = this.s.length - 1; return true;
  }
  undo() { return this.i > 0 ? this.s[--this.i] : null; }
  redo() { return this.i < this.s.length - 1 ? this.s[++this.i] : null; }
  get lzeZpet() { return this.i > 0; }
  get lzeVpred() { return this.i < this.s.length - 1; }
}

export const snimek = (v) => JSON.stringify({ prvky: v.prvky, vrstvy: v.vrstvy, okno: v.okno, pomer: v.meritko.pomer, pozadi: v.pozadi });
export function obnovZeSnimku(v, text) {
  const s = JSON.parse(text);
  v.prvky = s.prvky; v.vrstvy = s.vrstvy; v.okno = s.okno; v.meritko.pomer = s.pomer; v.pozadi = s.pozadi;
}

export { dist, delkaLomene };
