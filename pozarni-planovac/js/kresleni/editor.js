// Interaktivní editor výkresu (situace, půdorys, schéma). SVG + pointer events (myš, dotyk, pero).
import * as P from './prvky.js';
import * as G from './geom.js';
import { renderListu, esc } from './render.js';
import { najdiZnacku, vyberZnacku } from '../znacky.js';
import { naCislo } from '../formular.js';
import { zeptejSe, oznam } from '../dialogy.js';
import { ikona } from '../ikony.js';
import { vlozPodklad } from './podklad.js';
import { exportujPdf, stahniBajty, jmenoPdf } from '../pdf/export.js';
import { importujSoubor, vlozVektor, kalibrujVektor } from './import/index.js';

const NASTROJE = [
  ['vyber', 'Výběr', 'Výběr a úprava prvků (V)'], ['posun', 'Plátno', 'Posun plátna (H) – nebo střední tlačítko / mezerník'],
  ['stena', 'Stěna', 'Kreslení stěn: klik = bod, dvojklik / Enter = konec'], ['cara', 'Čára', 'Čára nebo lomená čára (hranice požárního úseku, plot…)'],
  ['trasa', 'Úniková cesta', 'Úniková cesta – délka se počítá v metrech'], ['plocha', 'Nástupní plocha a komunikace pro techniku', 'Uzavřená plocha: nástupní plocha a komunikace pro techniku'],
  ['obdelnik', 'Obdélník', 'Obdélník tažením'], ['elipsa', 'Elipsa', 'Elipsa tažením'], ['volna', 'Volně', 'Volná kresba'],
  ['text', 'Text', 'Textový popisek'], ['znacka', 'Značka', 'Vložení značky z katalogu'], ['dvere', 'Dveře', 'Dveře – klik na stěnu je připojí'], ['kalibrace', 'Kalibrace', 'Kalibrace měřítka podkladu podle známé délky'],
];
const NAPOVEDA = [
  'K BODŮM – kurzor se „chytí“ na koncové body a rohy už nakreslených prvků (vyznačí se oranžovým kroužkem). Čáry a stěny tak na sebe přesně navazují. Doporučeno nechat zapnuté.',
  '',
  'K MŘÍŽCE – body se zaokrouhlí na pravidelnou síť. Krok (0,1 až 10 m) volíte v rozbalovacím poli vedle. Hodí se, když kreslíte podle známých rozměrů, např. po celých metrech.',
  '',
  'ORTHO (rovně) – čára se srovná na vodorovnou, svislou nebo úhel 45°. Stejně funguje podržení klávesy Shift při kreslení, bez zapínání.',
  '',
  'ZKRATKY: V výběr · H plátno · W stěna · L čára · T trasa · R obdélník · E elipsa · D dveře · Esc zrušit · Enter dokončit · Delete smazat',
  'Ctrl+Z zpět · Ctrl+Y znovu · Ctrl+C / V kopírovat a vložit · Ctrl+D duplikovat · Ctrl+A vybrat vše · šipky posun (Shift = větší krok)',
  'Kolečko myši přibližuje k ukazateli, střední tlačítko nebo mezerník posouvá plátno, na dotyku dva prsty.',
].join('\n');
const IK = { vyber: 'vyber', posun: 'platno', stena: 'stena', cara: 'cara', trasa: 'trasa', plocha: 'plocha', obdelnik: 'obdelnik', elipsa: 'elipsa', volna: 'volna', text: 'text', znacka: 'znacka', dvere: 'dvere', kalibrace: 'kalibrace' };
const VYCHOZI_VRSTVA = { stena: 'zaklad', dvere: 'zaklad', cara: 'zaklad', obdelnik: 'zaklad', elipsa: 'zaklad', volna: 'zaklad', plocha: 'komunikace', znacka: 'znacky', trasa: 'trasy', text: 'popisky' };
const KROKY = [0.1, 0.5, 1, 5, 10];
const bezCarky = (n, d = 2) => String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',');

export function vytvorEditor({ host, projekt, list, katalog, naZmenu, naVyber, naStav }) {
  const v = list.vykres;
  const zn = new Map(katalog.map((z) => [z.id, z]));
  const S = {
    nastroj: 'vyber', vyber: new Set(), vb: null, snapMriz: false, snapBody: true, ortho: false, krok: 1,
    kresleni: null, tah: null, ukazatele: new Map(), mezernik: false, schranka: [], vkladani: 0,
    aktVrstva: null, zvolenaZnacka: null, kurzor: null, snapIndikator: null, kalibrace: null,
  };
  const H = new P.Historie(P.snimek(v));
  const L = () => P.rozlozeniListu(v);
  const s = () => 1000 / v.meritko.pomer;
  const vrstvaZamcena = (id) => !!v.vrstvy.find((x) => x.id === id)?.zamcena;
  const vrstvaViditelna = (id) => v.vrstvy.find((x) => x.id === id)?.viditelna !== false;
  const volne = (p) => vrstvaViditelna(p.vrstva) && !vrstvaZamcena(p.vrstva);
  const vybrane = () => v.prvky.filter((p) => S.vyber.has(p.id));

  const tl = (k) => { const [id, n, t] = NASTROJE.find((x) => x[0] === k); return `<button type="button" class="nast" data-nastroj="${id}" title="${esc(t)}" aria-label="${esc(n)}">${ikona(IK[id] || id, 18)}<span class="nast__txt">${n}</span></button>`; };
  const ak = (a, ik, t) => `<button type="button" class="nast nast--ik" data-akce="${a}" title="${esc(t)}" aria-label="${esc(t)}">${ikona(ik, 18)}</button>`;
  host.innerHTML = `<div class="ed">
    <div class="ed-nastroje" role="toolbar" aria-label="Nástroje výkresu">
      <div class="nast-skupina">${tl('vyber')}${tl('posun')}</div>
      <div class="nast-skupina">${['stena', 'cara', 'trasa', 'plocha', 'obdelnik', 'elipsa', 'volna'].map(tl).join('')}</div>
      <div class="nast-skupina">${['text', ...(projekt.typ === 'evakuacni_plan' ? [] : ['znacka']), 'dvere', 'kalibrace'].map(tl).join('')}</div>
      <div class="nast-skupina">${ak('zpet', 'zpet', 'Zpět (Ctrl+Z)')}${ak('vpred', 'vpred', 'Znovu (Ctrl+Y)')}</div>
      <div class="nast-skupina">${ak('priblizit', 'priblizit', 'Přiblížit')}${ak('oddalit', 'oddalit', 'Oddálit')}${ak('cely', 'cely', 'Zobrazit celý list')}${ak('obsah', 'obsah', 'Přiblížit na obsah výkresu')}</div>
      <div class="nast-skupina">
        <label class="prep" title="Kurzor se při kreslení a posouvání „chytí“ na koncové body a rohy už nakreslených prvků, takže na sebe čáry přesně navazují."><input type="checkbox" data-prep="snapBody" checked> K bodům</label>
        <label class="prep" title="Body se zaokrouhlují na pravidelnou síť s krokem vpravo (např. po 1 m). Hodí se pro přesné rozměry."><input type="checkbox" data-prep="snapMriz"> K mřížce</label>
        <select data-krok title="Krok mřížky v metrech – platí jen při zapnutém „K mřížce“" aria-label="Krok mřížky v metrech">${KROKY.map((k) => `<option value="${k}" ${k === S.krok ? 'selected' : ''}>${bezCarky(k, 1)} m</option>`).join('')}</select>
        <label class="prep" title="Ortho: čára se při kreslení srovná na vodorovnou, svislou nebo 45°. Totéž udělá podržení klávesy Shift."><input type="checkbox" data-prep="ortho"> Ortho (rovně)</label>
        ${ak('napoveda', 'info', 'Nápověda k přichytávání a zkratkám')}
      </div>
      <div class="nast-skupina">
        <label class="nast" title="Import podkladu: DXF, SVG, PDF, PNG, JPG">${ikona('import', 18)}<span class="nast__txt">Import…</span><input type="file" class="sr-only" data-podklad accept=".dxf,.svg,.pdf,.png,.jpg,.jpeg,.dwg,image/png,image/jpeg,image/svg+xml,application/pdf"></label>
        <button type="button" class="nast" data-akce="export-svg" title="Stáhnout list jako SVG">${ikona('stahnout', 18)}<span class="nast__txt">SVG</span></button><button type="button" class="nast" data-akce="export-png" title="Stáhnout list jako PNG (300 dpi)">${ikona('stahnout', 18)}<span class="nast__txt">PNG</span></button><button type="button" class="nast" data-akce="export-pdf" title="Stáhnout tento list jako PDF (vektorově)">${ikona('stahnout', 18)}<span class="nast__txt">PDF</span></button>
      </div>
    </div>
    <div class="ed-scena" tabindex="0"><div class="ed-svg"></div>
      <div class="ed-plovouci" hidden><button type="button" class="btn pri" data-akce="dokoncit">Dokončit</button><button type="button" class="btn" data-akce="zrusit">Zrušit</button></div>
      <div class="ed-napoveda"></div></div>
    <div class="ed-stav"><span data-st="kurzor"></span><span data-st="zoom"></span><span data-st="meritko"></span><span data-st="trasy"></span><span data-st="vyber"></span></div>
  </div>`;
  const wrap = host.querySelector('.ed-svg'), scena = host.querySelector('.ed-scena'), napoveda = host.querySelector('.ed-napoveda'), plovouci = host.querySelector('.ed-plovouci');
  const stav = (k, t, cls = '') => { const e = host.querySelector(`[data-st=${k}]`); if (e) { e.textContent = t; e.className = cls; } };

  // ---------- souřadnice ----------
  const svgEl = () => wrap.querySelector('svg');
  const klientNaPapir = (e) => { const el = svgEl(), m = el.getScreenCTM().inverse(), p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m); return [p.x, p.y]; };
  const papirNaSvet = ([px, py]) => [v.okno.x + (px - L().ram.x) / s(), v.okno.y + (py - L().ram.y) / s()];
  const svetNaPapir = ([x, y]) => [L().ram.x + (x - v.okno.x) * s(), L().ram.y + (y - v.okno.y) * s()];
  const mmNaPx = () => S.vb.w / (svgEl().getBoundingClientRect().width || 1);
  const tolM = (px = 8) => (px * mmNaPx()) / s();
  const svetZ = (e) => papirNaSvet(klientNaPapir(e));

  function celyList() { const l = L(); S.vb = { x: -4, y: -4, w: l.W + 8, h: l.H + 8 }; }
  function naObsah() {
    const b = P.bboxVsech(v.prvky, v.meritko.pomer); if (!b) return celyList();
    const a = svetNaPapir([b.x0, b.y0]), z = svetNaPapir([b.x1, b.y1]), w = Math.max(z[0] - a[0], 10) * 1.2, h = Math.max(z[1] - a[1], 10) * 1.2, r = svgEl().getBoundingClientRect();
    const k = Math.max(w / r.width, h / r.height); S.vb = { x: (a[0] + z[0]) / 2 - (r.width * k) / 2, y: (a[1] + z[1]) / 2 - (r.height * k) / 2, w: r.width * k, h: r.height * k }; vykresli();
  }
  function zoom(faktor, stred) {
    const r = svgEl().getBoundingClientRect(), c = stred || [S.vb.x + S.vb.w / 2, S.vb.y + S.vb.h / 2];
    const nw = Math.min(Math.max(S.vb.w / faktor, 4), 4000), f = S.vb.w / nw, nh = S.vb.h / f;
    S.vb = { x: c[0] - (c[0] - S.vb.x) / f, y: c[1] - (c[1] - S.vb.y) / f, w: nw, h: nh }; void r; vykresli();
  }

  // ---------- přichytávání ----------
  const bodyPrvku = (p) => {
    if (p.body) return p.body;
    if (p.druh === 'obdelnik') { const bb = P.bboxPrvku(p, v.meritko.pomer); return [[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x1, bb.y1], [bb.x0, bb.y1], [p.cx, p.cy]]; }
    if (p.druh === 'elipsa') return [[p.cx, p.cy]];
    if (p.druh === 'znacka' || p.druh === 'text') return [[p.x, p.y]];
    return [];
  };
  function snap(w, { od = null, ignor = new Set(), ortho = S.ortho } = {}) {
    let b = [...w], ind = null; const tol = tolM(10);
    if (od && ortho) {
      const dx = b[0] - od[0], dy = b[1] - od[1], a = Math.atan2(dy, dx), q = Math.round(a / (Math.PI / 4)) * (Math.PI / 4), d = Math.hypot(dx, dy);
      b = [od[0] + Math.cos(q) * d, od[1] + Math.sin(q) * d];
    }
    if (S.snapBody) {
      let best = null;
      for (const p of v.prvky) {
        if (ignor.has(p.id) || !volne(p)) continue;
        for (const q of bodyPrvku(p)) { const d = G.dist(q, b); if (d <= tol && (!best || d < best.d)) best = { d, q }; }
      }
      if (best) { b = [...best.q]; ind = b; }
    }
    if (!ind && S.snapMriz) b = [G.zaokrouhli(b[0], S.krok), G.zaokrouhli(b[1], S.krok)];
    S.snapIndikator = ind;
    return b;
  }

  // ---------- historie ----------
  function commit() {
    P.obnovDvere(v.prvky); P.synchronizujLegendu(v);
    S.vyber = new Set([...S.vyber].filter((id) => v.prvky.some((p) => p.id === id)));
    if (H.push(P.snimek(v))) naZmenu();
    vykresli(); naVyber?.();
  }
  function obnov(text) { if (!text) return; P.obnovZeSnimku(v, text); P.synchronizujLegendu(v); S.vyber = new Set([...S.vyber].filter((id) => v.prvky.some((p) => p.id === id))); naZmenu(); vykresli(); naVyber?.(); }
  const zpet = () => obnov(H.undo()), vpred = () => obnov(H.redo());

  // ---------- vykreslení ----------
  const symbolHref = (id) => zn.get(id)?.png || '';
  const mkO = (extra = {}) => ({ objektNazev: projekt.listy.find((l) => l.karta)?.karta.objekt.nazev || '', nazevListu: list.nazev, znacky: zn, symbolHref, prilohy: projekt.prilohy, ...extra });
  let planovano = false;
  function vykresli() { if (planovano) return; planovano = true; requestAnimationFrame(() => { planovano = false; vykresliTed(); }); }
  function vykresliTed() {
    if (!wrap.isConnected) return;
    if (!S.vb) { wrap.innerHTML = renderListu(v, mkO()); celyList(); }
    wrap.innerHTML = renderListu(v, mkO());
    const el = svgEl(); el.removeAttribute('width'); el.removeAttribute('height'); el.setAttribute('viewBox', `${S.vb.x} ${S.vb.y} ${S.vb.w} ${S.vb.h}`);
    el.style.cssText = 'width:100%;height:100%;display:block;touch-action:none;background:var(--bg-300)';
    const ov = document.createElementNS('http://www.w3.org/2000/svg', 'g'); ov.setAttribute('pointer-events', 'none'); ov.innerHTML = overlay(); el.appendChild(ov);
    host.querySelectorAll('[data-nastroj]').forEach((b) => b.classList.toggle('akt', b.dataset.nastroj === S.nastroj));
    host.querySelector('[data-akce=zpet]').disabled = !H.lzeZpet; host.querySelector('[data-akce=vpred]').disabled = !H.lzeVpred;
    stav('zoom', `zoom ${Math.round((L().W / S.vb.w) * 100)} %`);
    stav('meritko', `1 : ${v.meritko.pomer}${P.meritkoOvereno(v) ? '' : ' – MĚŘÍTKO NEOVĚŘENO (kalibrujte podklad)'}`, P.meritkoOvereno(v) ? '' : 'varuj');
    const celkem = P.celkovaDelkaTras(v.prvky); stav('trasy', celkem > 0 ? `trasy celkem ${P.formatDelky(celkem)}` : '');
    stav('vyber', S.vyber.size ? `vybráno: ${S.vyber.size}` : '');
    plovouci.hidden = !(S.kresleni && S.kresleni.body.length >= 1);
    const n = { vyber: 'Klik vybere prvek, tažení vybere oblast, Shift přidá. Táhněte úchyty pro změnu velikosti a otočení.', stena: 'Klik přidá bod stěny. Dvojklik nebo Enter dokončí, Esc zruší.', trasa: 'Klik přidá bod trasy. Dvojklik / Enter dokončí. Délka se počítá v metrech.', cara: 'Klik přidá bod. Dvojklik / Enter dokončí.', plocha: 'Klik přidá vrchol plochy. Dvojklik / Enter dokončí (min. 3 body).', obdelnik: 'Táhněte z rohu do rohu.', elipsa: 'Táhněte z rohu do rohu.', volna: 'Táhněte pro volnou kresbu.', text: 'Klik umístí text.', znacka: S.zvolenaZnacka ? `Klik vloží značku ${S.zvolenaZnacka}. Esc ukončí.` : 'Vyberte značku…', dvere: 'Klik na stěnu připojí dveře; mimo stěnu je vloží volně (jdou pak přesunout ke stěně).', kalibrace: (v.pozadi || (v.meritkoZdroj && !v.meritkoZdroj.overeno)) ? (S.kalibrace?.a ? 'Klikněte na druhý bod známé vzdálenosti.' : 'Klikněte na první bod známé vzdálenosti (rozměr, který znáte).') : 'Není co kalibrovat: naimportujte podklad nebo výkres s neověřeným měřítkem (tlačítko Import…).', posun: 'Táhněte plátno. Kolečko myši přibližuje k ukazateli.' };
    napoveda.innerHTML = n[S.nastroj] ? `<span>${esc(n[S.nastroj])}</span>` : '';
  }

  // ---------- úchyty a overlay ----------
  function bboxVyberu() { const a = vybrane(); return a.length ? P.bboxVsech(a, v.meritko.pomer) : null; }
  function uchyty() {
    const out = [], sel = vybrane(); if (!sel.length || S.kresleni) return out;
    const b = bboxVyberu(); if (!b) return out;
    const jedna = sel.length === 1 ? sel[0] : null;
    if (jedna && jedna.druh === 'dvere') return out;   // dveře se vedou po stěně; vlastnosti v panelu
    if (jedna && ['stena', 'cara', 'trasa', 'plocha', 'volna'].includes(jedna.druh)) {
      jedna.body.forEach((q, i) => out.push({ typ: 'vrchol', i, w: q }));
      const n = jedna.body.length, m = jedna.druh === 'plocha' ? n : n - 1;
      for (let i = 0; i < m && jedna.druh !== 'volna'; i++) { const a = jedna.body[i], c = jedna.body[(i + 1) % n]; out.push({ typ: 'stred', i, w: [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2] }); }
    } else {
      const xs = [b.x0, (b.x0 + b.x1) / 2, b.x1], ys = [b.y0, (b.y0 + b.y1) / 2, b.y1];
      for (let a = 0; a < 3; a++) for (let c = 0; c < 3; c++) if (!(a === 1 && c === 1)) out.push({ typ: 'meritko', ix: a, iy: c, w: [xs[a], ys[c]] });
    }
    const [cx, cy] = [(b.x0 + b.x1) / 2, b.y0 - 24 * mmNaPx() / s()];
    out.push({ typ: 'otoceni', w: [cx, cy] });
    return out;
  }
  function overlay() {
    const mp = mmNaPx(), r = 4.5 * mp, sw = 1.4 * mp, o = [], st = `stroke="#1e5fd0" stroke-width="${sw}"`;
    for (const p of vybrane()) {
      const bb = P.bboxPrvku(p, v.meritko.pomer, v.prvky); if (!bb) continue;
      const a = svetNaPapir([bb.x0, bb.y0]), z = svetNaPapir([bb.x1, bb.y1]);
      o.push(`<rect x="${a[0]}" y="${a[1]}" width="${z[0] - a[0]}" height="${z[1] - a[1]}" fill="none" ${st} stroke-dasharray="${4 * mp},${3 * mp}"/>`);
    }
    for (const p of v.prvky) {
      if (!p.kKontrole || !vrstvaViditelna(p.vrstva)) continue;
      const bb = P.bboxPrvku(p, v.meritko.pomer, v.prvky); if (!bb) continue;
      const a = svetNaPapir([bb.x0, bb.y0]), z = svetNaPapir([bb.x1, bb.y1]), pad = 3 * mp;
      o.push(`<rect x="${a[0] - pad}" y="${a[1] - pad}" width="${z[0] - a[0] + 2 * pad}" height="${z[1] - a[1] + 2 * pad}" fill="none" stroke="#f57c00" stroke-width="${sw}" stroke-dasharray="${3 * mp},${2 * mp}"/>`);
    }
    for (const h of uchyty()) {
      const [x, y] = svetNaPapir(h.w);
      if (h.typ === 'otoceni') { const bb = bboxVyberu(), top = svetNaPapir([(bb.x0 + bb.x1) / 2, bb.y0]); o.push(`<line x1="${top[0]}" y1="${top[1]}" x2="${x}" y2="${y}" ${st}/><circle cx="${x}" cy="${y}" r="${r}" fill="#fff" ${st}/>`); }
      else if (h.typ === 'stred') o.push(`<circle cx="${x}" cy="${y}" r="${r * 0.7}" fill="#fff" fill-opacity=".8" ${st}/>`);
      else o.push(`<rect x="${x - r}" y="${y - r}" width="${2 * r}" height="${2 * r}" fill="#fff" ${st}/>`);
    }
    if (S.tah?.typ === 'oblast') { const a = svetNaPapir(S.tah.od), b = svetNaPapir(S.tah.do); o.push(`<rect x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(b[0] - a[0])}" height="${Math.abs(b[1] - a[1])}" fill="#1e5fd0" fill-opacity=".1" ${st}/>`); }
    const k = S.kresleni;
    if (k && k.body.length) {
      const body = [...k.body, ...(k.kurzor ? [k.kurzor] : [])].map(svetNaPapir);
      o.push(`<polyline points="${body.map((q) => q.join(',')).join(' ')}" fill="none" stroke="#d62b1f" stroke-width="${sw}" stroke-dasharray="${4 * mp},${2 * mp}"/>`);
      k.body.forEach((q) => { const [x, y] = svetNaPapir(q); o.push(`<circle cx="${x}" cy="${y}" r="${r * 0.6}" fill="#d62b1f"/>`); });
      if (k.kurzor && k.body.length) { const len = G.delkaLomene([...k.body, k.kurzor]); const [x, y] = svetNaPapir(k.kurzor); o.push(`<text x="${x + 8 * mp}" y="${y - 8 * mp}" font-size="${12 * mp}" fill="#d62b1f" font-family="Arial" font-weight="700">${P.formatDelky(len)}</text>`); }
    }
    if (S.tah?.typ === 'tvar') { const a = svetNaPapir(S.tah.od), b = svetNaPapir(S.tah.do); o.push(`<rect x="${Math.min(a[0], b[0])}" y="${Math.min(a[1], b[1])}" width="${Math.abs(b[0] - a[0])}" height="${Math.abs(b[1] - a[1])}" fill="none" stroke="#d62b1f" stroke-width="${sw}" stroke-dasharray="${4 * mp}"/>`); }
    if (S.tah?.typ === 'volna' && S.tah.body.length > 1) o.push(`<polyline points="${S.tah.body.map((q) => svetNaPapir(q).join(',')).join(' ')}" fill="none" stroke="#d62b1f" stroke-width="${sw}"/>`);
    if (S.snapIndikator) { const [x, y] = svetNaPapir(S.snapIndikator); o.push(`<circle cx="${x}" cy="${y}" r="${r * 1.3}" fill="none" stroke="#f57c00" stroke-width="${sw}"/>`); }
    if (S.kalibrace?.a && v.pozadi) { const [x, y] = svetNaPapir(S.kalibrace.aSvet); o.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#f57c00"/>`); }
    return o.join('');
  }

  // ---------- zásahy ----------
  function zasahNaBodu(w) { const tol = tolM(8); for (let i = v.prvky.length - 1; i >= 0; i--) { const p = v.prvky[i]; if (volne(p) && P.zasah(p, w, tol, v.meritko.pomer, v.prvky)) return p; } return null; }
  function uchytNaBodu(e) {
    const mp = mmNaPx(), pt = e.pointerType === 'touch' ? 16 : 9, pap = klientNaPapir(e);
    const blizko = (h) => { const q = svetNaPapir(h.w); return Math.hypot(q[0] - pap[0], q[1] - pap[1]) <= pt * mp; };
    const vse = uchyty();
    return vse.find((h) => h.typ === 'otoceni' && blizko(h)) || vse.find(blizko) || null;   // otočení má přednost
  }
  const vrstvaPro = (druh) => (S.aktVrstva && v.vrstvy.some((l) => l.id === S.aktVrstva) ? S.aktVrstva : (v.vrstvy.some((l) => l.id === VYCHOZI_VRSTVA[druh]) ? VYCHOZI_VRSTVA[druh] : v.vrstvy[0].id));
  const velikost = () => projekt.nastaveni.velikostZnacky ?? 8;
  const velikostTextu = () => projekt.nastaveni.velikostTextu ?? 3;
  function pridej(p) { v.prvky.push(p); S.vyber = new Set([p.id]); commit(); return p; }

  function dokonciKresleni() {
    const k = S.kresleni; if (!k) return;
    let body = k.body.filter((q, i) => i === 0 || G.dist(q, k.body[i - 1]) > 1e-6);
    S.kresleni = null;
    const min = k.nastroj === 'plocha' ? 3 : 2;
    if (body.length < min) { vykresli(); return; }
    const druh = k.nastroj;
    pridej(P.novyPrvek(druh, { body, vrstva: vrstvaPro(druh), ...(druh === 'trasa' ? {} : {}) }));
  }
  const zrusKresleni = () => { S.kresleni = null; S.tah = null; vykresli(); };

  // ---------- ukazatel ----------
  let pinch = null;
  function dolu(e) {
    scena.focus({ preventScroll: true });
    if (Date.now() < (S.ignorDo || 0)) return;   // zbytek dvojkliku, kterým se právě dokončila stěna
    wrap.setPointerCapture?.(e.pointerId);
    S.ukazatele.set(e.pointerId, [e.clientX, e.clientY]);
    if (S.ukazatele.size === 2) { const [a, b] = [...S.ukazatele.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), vb: { ...S.vb }, c: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; S.tah = null; return; }
    if (e.button === 1 || e.button === 2 || S.mezernik || S.nastroj === 'posun') { S.tah = { typ: 'pan', start: [e.clientX, e.clientY], vb: { ...S.vb } }; return; }
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const w0 = svetZ(e), t = S.nastroj;
    if (t === 'vyber') {
      const u = uchytNaBodu(e);
      if (u) { S.tah = { typ: u.typ, u, orig: vybrane().map((p) => structuredClone(p)), od: w0, bb: bboxVyberu(), moved: false }; return; }
      const p = zasahNaBodu(w0);
      if (p) {
        if (e.shiftKey) { S.vyber.has(p.id) ? S.vyber.delete(p.id) : S.vyber.add(p.id); }
        else if (!S.vyber.has(p.id)) S.vyber = new Set([p.id]);
        naVyber?.(); vykresli();
        if (S.vyber.has(p.id)) S.tah = { typ: 'presun', orig: vybrane().map((q) => structuredClone(q)), od: w0, moved: false };
      } else { if (!e.shiftKey) { S.vyber = new Set(); naVyber?.(); } S.tah = { typ: 'oblast', od: w0, do: w0, shift: e.shiftKey, zaklad: new Set(S.vyber) }; vykresli(); }
      return;
    }
    if (['stena', 'cara', 'trasa', 'plocha'].includes(t)) {
      const k = S.kresleni || (S.kresleni = { nastroj: t, body: [], kurzor: null });
      const prev = k.body[k.body.length - 1] || null;
      const b = snap(w0, { od: prev, ortho: S.ortho || e.shiftKey });
      if (t === 'stena' && k.body.length >= 3 && G.dist(b, k.body[0]) <= tolM(10)) { k.body.push([...k.body[0]]); S.ignorDo = Date.now() + 450; dokonciKresleni(); return; }
      k.body.push(b); vykresli(); return;
    }
    if (t === 'obdelnik' || t === 'elipsa') { const b = snap(w0); S.tah = { typ: 'tvar', nastroj: t, od: b, do: b }; return; }
    if (t === 'volna') { S.tah = { typ: 'volna', body: [w0] }; return; }
    if (t === 'text') {
      zeptejSe('Text popisku', '', { popisek: 'Text popisku (víc řádků upravíte ve vlastnostech)' }).then((txt) => { if (txt) pridej(P.novyPrvek('text', { x: snap(w0)[0], y: snap(w0)[1], text: txt, vyska: velikostTextu(), vrstva: vrstvaPro('text') })); }); return;
    }
    if (t === 'znacka') { if (!S.zvolenaZnacka) return; const b = snap(w0); pridej(P.novyPrvek('znacka', { x: b[0], y: b[1], znackaId: S.zvolenaZnacka, velikost: velikost(), vrstva: vrstvaPro('znacka') })); return; }
    if (t === 'dvere') {
      const d = P.novyPrvek('dvere', { vrstva: vrstvaPro('dvere'), x: w0[0], y: w0[1] }); v.prvky.push(d);
      P.pripojDvere(d, v.prvky, w0, tolM(14)); S.vyber = new Set([d.id]); commit(); return;
    }
    if (t === 'kalibrace') {
      const vektorNeoverene = !v.pozadi && v.meritkoZdroj && !v.meritkoZdroj.overeno;
      if (!v.pozadi && !vektorNeoverene) { vykresli(); return; }
      if (!S.kalibrace) S.kalibrace = { a: null };
      if (vektorNeoverene) {
        if (!S.kalibrace.a) { S.kalibrace = { a: w0, aSvet: w0 }; vykresli(); return; }
        const A = S.kalibrace.a; S.kalibrace = null; vykresli();
        zeptejSe('Skutečná vzdálenost mezi oběma body', '', { popisek: 'Vzdálenost v metrech (např. 12,5). Přeškáluje se celý obsah listu.' }).then((zad) => {
          const m = zad === null ? NaN : naCislo(zad);
          if (!(m > 0)) return;
          try { kalibrujVektor(v, A, w0, m); S.nastroj = 'vyber'; commit(); naObsah(); } catch (err) { oznam(err.message); }
        });
        return;
      }
      const pz = v.pozadi, px = [(w0[0] - pz.x) / pz.mNaPx, (w0[1] - pz.y) / pz.mNaPx];
      if (!S.kalibrace.a) { S.kalibrace = { a: px, aSvet: w0 }; vykresli(); return; }
      const a = S.kalibrace.a, aSvet = S.kalibrace.aSvet; S.kalibrace = null; vykresli();
      zeptejSe('Skutečná vzdálenost mezi oběma body', '', { popisek: 'Vzdálenost v metrech (např. 12,5)' }).then((zad) => {
        const m = zad === null ? NaN : naCislo(zad);
        if (!(m > 0)) return;
        try { P.kalibruj(pz, a, px, m); pz.x = aSvet[0] - a[0] * pz.mNaPx; pz.y = aSvet[1] - a[1] * pz.mNaPx; S.nastroj = 'vyber'; commit(); } catch (err) { oznam(err.message); }
      });
    }
  }

  function pohyb(e) {
    if (S.ukazatele.has(e.pointerId)) S.ukazatele.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && S.ukazatele.size >= 2) {
      const [a, b] = [...S.ukazatele.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const k = pinch.vb.w / (svgEl().getBoundingClientRect().width || 1), f = d / pinch.d, nw = Math.min(Math.max(pinch.vb.w / f, 4), 4000), nk = nw / (svgEl().getBoundingClientRect().width || 1);
      const r = svgEl().getBoundingClientRect(), px0 = pinch.vb.x + (pinch.c[0] - r.left) * k, py0 = pinch.vb.y + (pinch.c[1] - r.top) * k;
      S.vb = { w: nw, h: pinch.vb.h * (nw / pinch.vb.w), x: px0 - (c[0] - r.left) * nk, y: py0 - (c[1] - r.top) * nk }; vykresli(); return;
    }
    if (!svgEl()) return;
    const w = svetZ(e); S.kurzor = w; stav('kurzor', `x ${bezCarky(w[0])} m, y ${bezCarky(w[1])} m`);
    const t = S.tah;
    if (t?.typ === 'pan') { const r = svgEl().getBoundingClientRect(), k = t.vb.w / r.width; S.vb = { ...t.vb, x: t.vb.x - (e.clientX - t.start[0]) * k, y: t.vb.y - (e.clientY - t.start[1]) * k }; vykresli(); return; }
    if (S.kresleni) { const prev = S.kresleni.body[S.kresleni.body.length - 1] || null; S.kresleni.kurzor = snap(w, { od: prev, ortho: S.ortho || e.shiftKey }); vykresli(); return; }
    if (!t) { if (['stena', 'cara', 'trasa', 'plocha', 'znacka', 'text', 'obdelnik', 'elipsa'].includes(S.nastroj)) { snap(w); vykresli(); } return; }
    if (t.typ === 'oblast') { t.do = w; vykresli(); return; }
    if (t.typ === 'tvar') { t.do = snap(w); vykresli(); return; }
    if (t.typ === 'volna') { t.body.push(w); vykresli(); return; }
    if (t.typ === 'presun') {
      const sel = vybrane(); t.moved = true;
      if (sel.length === 1 && sel[0].druh === 'dvere') { const d = sel[0]; Object.assign(d, structuredClone(t.orig[0])); P.posunDvere(d, v.prvky, w, tolM(14)); vykresli(); return; }
      let dx = w[0] - t.od[0], dy = w[1] - t.od[1];
      const ref = t.orig.find((p) => p.body) || t.orig[0]; const rp = ref.body ? ref.body[0] : [ref.cx ?? ref.x ?? 0, ref.cy ?? ref.y ?? 0];
      const sn = snap([rp[0] + dx, rp[1] + dy], { ignor: new Set(S.vyber), od: S.ortho || e.shiftKey ? rp : null, ortho: S.ortho || e.shiftKey });
      if (S.snapIndikator || S.snapMriz) { dx = sn[0] - rp[0]; dy = sn[1] - rp[1]; }
      sel.forEach((p, i) => { Object.assign(p, structuredClone(t.orig[i])); P.posunPrvek(p, dx, dy); });
      P.obnovDvere(v.prvky); vykresli(); return;
    }
    if (t.typ === 'vrchol' || t.typ === 'stred') {
      const p = vybrane()[0]; t.moved = true;
      const b = snap(w, { ignor: new Set([p.id]) });
      if (t.typ === 'stred' && !t.vlozeno) { p.body.splice(t.u.i + 1, 0, [...b]); t.vlozeno = true; t.idx = t.u.i + 1; }
      const i = t.typ === 'stred' ? t.idx : t.u.i; p.body[i] = b; P.obnovDvere(v.prvky); vykresli(); return;
    }
    if (t.typ === 'otoceni') {
      t.moved = true; const b = t.bb, c = [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
      let a = Math.atan2(w[1] - c[1], w[0] - c[0]) - Math.atan2(t.od[1] - c[1], t.od[0] - c[0]);
      if (e.shiftKey) a = Math.round(G.deg(a) / 15) * (Math.PI / 12);
      vybrane().forEach((p, i) => { Object.assign(p, structuredClone(t.orig[i])); P.otocPrvek(p, c, a); }); P.obnovDvere(v.prvky); vykresli(); return;
    }
    if (t.typ === 'meritko') {
      t.moved = true; const b = t.bb, { ix, iy } = t.u;
      const ax = ix === 0 ? b.x1 : ix === 2 ? b.x0 : b.x0, ay = iy === 0 ? b.y1 : iy === 2 ? b.y0 : b.y0;
      const hx = ix === 0 ? b.x0 : ix === 2 ? b.x1 : null, hy = iy === 0 ? b.y0 : iy === 2 ? b.y1 : null;
      let sx = hx === null ? 1 : (w[0] - ax) / (hx - ax || 1), sy = hy === null ? 1 : (w[1] - ay) / (hy - ay || 1);
      if (e.shiftKey && hx !== null && hy !== null) { const k = Math.max(Math.abs(sx), Math.abs(sy)); sx = Math.sign(sx) * k; sy = Math.sign(sy) * k; }
      sx = Math.max(Math.abs(sx), 0.02); sy = Math.max(Math.abs(sy), 0.02);
      vybrane().forEach((p, i) => { Object.assign(p, structuredClone(t.orig[i])); P.meritkujPrvek(p, [ax, ay], sx, sy); }); P.obnovDvere(v.prvky); vykresli(); return;
    }
  }

  function nahoru(e) {
    S.ukazatele.delete(e.pointerId);
    if (pinch) { if (S.ukazatele.size < 2) pinch = null; return; }
    const t = S.tah; S.tah = null; S.snapIndikator = null;
    if (!t) return;
    if (t.typ === 'pan') { vykresli(); return; }
    if (t.typ === 'oblast') {
      const a = t.od, b = t.do, r = { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) };
      if (r.x1 - r.x0 > tolM(3) || r.y1 - r.y0 > tolM(3)) { const nova = v.prvky.filter((p) => volne(p) && P.prekryvaObdelnik(p, r, v.meritko.pomer, v.prvky)).map((p) => p.id); S.vyber = new Set([...(t.shift ? t.zaklad : []), ...nova]); }
      naVyber?.(); vykresli(); return;
    }
    if (t.typ === 'tvar') {
      const a = t.od, b = t.do, w = Math.abs(b[0] - a[0]), h = Math.abs(b[1] - a[1]);
      if (w > tolM(3) && h > tolM(3)) { const c = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; pridej(t.nastroj === 'obdelnik' ? P.novyPrvek('obdelnik', { cx: c[0], cy: c[1], w, h, uhel: 0, vrstva: vrstvaPro('obdelnik') }) : P.novyPrvek('elipsa', { cx: c[0], cy: c[1], rx: w / 2, ry: h / 2, uhel: 0, vrstva: vrstvaPro('elipsa') })); } else vykresli();
      return;
    }
    if (t.typ === 'volna') { const body = G.zjednodus(t.body, tolM(1.5)); if (body.length >= 2) pridej(P.novyPrvek('volna', { body, vrstva: vrstvaPro('volna') })); else vykresli(); return; }
    if (['presun', 'vrchol', 'stred', 'otoceni', 'meritko'].includes(t.typ)) {
      if (t.typ === 'presun' && t.moved) {
        const sel = vybrane();
        if (sel.length === 1 && sel[0].druh === 'dvere' && !sel[0].stenaId) P.pripojDvere(sel[0], v.prvky, [sel[0].x, sel[0].y], tolM(14));
      }
      if (t.moved) commit(); else vykresli();
    }
  }

  function dvojklik() {
    if (Date.now() < (S.ignorDo || 0)) return;
    if (S.kresleni) { if (S.kresleni.body.length > 1 && G.dist(S.kresleni.body.at(-1), S.kresleni.body.at(-2)) < 1e-6) S.kresleni.body.pop(); dokonciKresleni(); return; }
    if (S.nastroj !== 'vyber') return;
    const u = S.dblPozice && vybrane().length === 1 ? uchyty().find((h) => h.typ === 'vrchol' && G.dist(h.w, S.dblPozice) <= tolM(10)) : null;
    if (u) { const p = vybrane()[0], min = p.druh === 'plocha' ? 3 : 2; if (p.body.length > min) { p.body.splice(u.i, 1); commit(); } }
  }

  function kolecko(e) {
    e.preventDefault();   // přiblížení kolečkem bez Ctrl, k místu kurzoru
    const faktor = Math.exp(-Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120) * 0.0016 * (e.deltaMode === 1 ? 20 : 1));
    zoom(faktor, klientNaPapir(e));
  }

  function klavesa(e) {
    if (!host.isConnected) return;
    const t = e.target; if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
    if (!host.contains(document.activeElement) && document.activeElement !== document.body) return;
    const ctrl = e.ctrlKey || e.metaKey, kl = e.key.toLowerCase();
    if (e.key === ' ') { S.mezernik = true; e.preventDefault(); return; }
    if (e.key === 'Escape') { if (S.kresleni || S.tah) zrusKresleni(); else if (S.nastroj !== 'vyber') nastavNastroj('vyber'); else { S.vyber = new Set(); naVyber?.(); vykresli(); } return; }
    if (e.key === 'Enter') { dokonciKresleni(); return; }
    if (ctrl && kl === 'z' && !e.shiftKey) { e.preventDefault(); zpet(); return; }
    if (ctrl && (kl === 'y' || (kl === 'z' && e.shiftKey))) { e.preventDefault(); vpred(); return; }
    if (ctrl && kl === 'a') { e.preventDefault(); S.vyber = new Set(v.prvky.filter(volne).map((p) => p.id)); naVyber?.(); vykresli(); return; }
    if (ctrl && kl === 'c') { S.schranka = vybrane().map((p) => structuredClone(p)); S.vkladani = 0; return; }
    if (ctrl && kl === 'v') { e.preventDefault(); vloz(); return; }
    if (ctrl && kl === 'd') { e.preventDefault(); S.schranka = vybrane().map((p) => structuredClone(p)); S.vkladani = 0; vloz(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (S.kresleni) { S.kresleni.body.pop(); if (!S.kresleni.body.length) S.kresleni = null; vykresli(); e.preventDefault(); return; }
      smazVyber(); e.preventDefault(); return;
    }
    if (e.key.startsWith('Arrow') && S.vyber.size) { e.preventDefault(); const k = e.shiftKey ? 1 : 0.1, d = { ArrowLeft: [-k, 0], ArrowRight: [k, 0], ArrowUp: [0, -k], ArrowDown: [0, k] }[e.key]; vybrane().forEach((p) => P.posunPrvek(p, d[0], d[1])); commit(); return; }
    if (e.key === '+' || e.key === '=') { zoom(1.25); return; }
    if (e.key === '-') { zoom(1 / 1.25); return; }
    const sk = { v: 'vyber', h: 'posun', w: 'stena', l: 'cara', t: 'trasa', r: 'obdelnik', e: 'elipsa', d: 'dvere' }[kl];
    if (sk && !ctrl) nastavNastroj(sk);
  }
  const klavesaNahoru = (e) => { if (e.key === ' ') S.mezernik = false; };

  function smazVyber() { if (!S.vyber.size) return; v.prvky = v.prvky.filter((p) => !S.vyber.has(p.id)); S.vyber = new Set(); commit(); }
  function vloz() {
    if (!S.schranka.length) return; S.vkladani++;
    const d = (5 * S.vkladani) / s(); const k = P.kopiePrvku(S.schranka, v.prvky, d, d);
    k.forEach((p) => { if (!v.vrstvy.some((l) => l.id === p.vrstva)) p.vrstva = v.vrstvy[0].id; });
    v.prvky.push(...k); S.vyber = new Set(k.map((p) => p.id)); commit();
  }
  async function nastavNastroj(n) {
    if (n === 'znacka') { const id = await vyberZnacku(); if (!id) return; S.zvolenaZnacka = id; }
    S.nastroj = n; S.kresleni = null; S.tah = null; S.kalibrace = null; S.snapIndikator = null; vykresli();
  }

  // ---------- podklad (PNG / JPG) ----------
  async function importPodkladu(soubor) {
    if (!soubor) return;
    let r;
    try { r = await importujSoubor(soubor); } catch (err) { oznam(err.message); return; }
    if (!r) return;
    if (r.typ === 'raster') { vlozPodklad(projekt, v, r.obrazek); S.nastroj = 'kalibrace'; S.kalibrace = null; commit(); return; }
    vlozVektor(v, r.vysledek); S.vyber = new Set(); S.nastroj = 'vyber'; commit(); naObsah();
    oznam(r.souhrn.join('\n') || 'Hotovo.', { titul: 'Import dokončen' });
  }

  // ---------- export ----------
  async function dataUriZnacek() {
    const mapa = new Map();
    for (const id of new Set(v.prvky.filter((p) => p.druh === 'znacka').map((p) => p.znackaId).concat(P.pouziteZnacky(v.prvky)))) {
      const z = zn.get(id); if (!z) continue;
      if (z.png.startsWith('data:')) { mapa.set(id, z.png); continue; }   // jednosouborová sestava má obrázky už vložené
      const b = await (await fetch(z.png)).blob(); mapa.set(id, await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(b); }));
    }
    return mapa;
  }
  async function exportSvg() { const m = await dataUriZnacek(); return renderListu(v, mkO({ symbolHref: (id) => m.get(id) || '' })); }
  const stahni = (blob, jmeno) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = jmeno; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const jmenoSouboru = (pripona) => `${(list.nazev || 'vykres').replace(/[^\p{L}\p{N}_-]+/gu, '_')}.${pripona}`;
  async function exportPng() {
    const svg = await exportSvg(), l = L(), px = Math.round((l.W / 25.4) * 300), py = Math.round((l.H / 25.4) * 300);
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })), img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = () => ko(new Error('Export PNG selhal')); img.src = url; });
    const c = document.createElement('canvas'); c.width = px; c.height = py; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, px, py); g.drawImage(img, 0, 0, px, py); URL.revokeObjectURL(url);
    c.toBlob((b) => stahni(b, jmenoSouboru('png')), 'image/png');
  }

  // ---------- ovládání lišty ----------
  host.querySelector('.ed-nastroje').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.nastroj) return nastavNastroj(b.dataset.nastroj);
    ({ napoveda: () => oznam(NAPOVEDA, { titul: 'Přichytávání a zkratky' }), zpet, vpred, priblizit: () => zoom(1.25), oddalit: () => zoom(1 / 1.25), cely: () => { celyList(); vykresli(); }, obsah: naObsah, 'export-svg': async () => stahni(new Blob([await exportSvg()], { type: 'image/svg+xml' }), jmenoSouboru('svg')), 'export-png': exportPng, 'export-pdf': async () => { try { stahniBajty(await exportujPdf(projekt, { listy: [list.id], katalog: zn }), jmenoPdf(`${projekt.nazev}_${list.nazev}`)); } catch (err) { oznam(`PDF se nepodařilo vytvořit: ${err.message}`); } } })[b.dataset.akce]?.();
  });
  host.querySelector('.ed-nastroje').addEventListener('change', (e) => {
    if (e.target.dataset.prep) S[e.target.dataset.prep] = e.target.checked;
    if (e.target.dataset.krok !== undefined) S.krok = Number(e.target.value);
    if (e.target.dataset.podklad !== undefined) { importPodkladu(e.target.files[0]); e.target.value = ''; }
  });
  plovouci.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b?.dataset.akce === 'dokoncit') dokonciKresleni(); if (b?.dataset.akce === 'zrusit') zrusKresleni(); });
  wrap.addEventListener('pointerdown', dolu); wrap.addEventListener('pointermove', pohyb); wrap.addEventListener('pointerup', nahoru); wrap.addEventListener('pointercancel', nahoru);
  wrap.addEventListener('dblclick', (e) => { S.dblPozice = svetZ(e); dvojklik(); });
  wrap.addEventListener('wheel', kolecko, { passive: false }); wrap.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('keydown', klavesa); document.addEventListener('keyup', klavesaNahoru);
  const ro = new ResizeObserver(() => vykresli()); ro.observe(wrap);

  P.obnovDvere(v.prvky); P.synchronizujLegendu(v);
  celyList(); vykresliTed();

  // ---------- rozhraní pro panely ----------
  return {
    v, projekt, list, S, H, katalog: zn,
    vyber: vybrane, nastavVyber(ids) { S.vyber = new Set(ids); naVyber?.(); vykresli(); },
    uloz: naZmenu, commit, vykresli, zpet, vpred, smazVyber, vloz, naObsah, nastavNastroj, exportSvg, exportPng, importPodkladu,
    prvkyKopie: () => { S.schranka = vybrane().map((p) => structuredClone(p)); S.vkladani = 0; vloz(); },
    nastavAktVrstvu(id) { S.aktVrstva = id; },
    stavNastroj: () => S.nastroj,
    zmenaZnacky: async (p) => { const id = await vyberZnacku(); if (id) { p.znackaId = id; commit(); } },
    zrusit() { document.removeEventListener('keydown', klavesa); document.removeEventListener('keyup', klavesaNahoru); ro.disconnect(); },
  };
}
export { najdiZnacku };
