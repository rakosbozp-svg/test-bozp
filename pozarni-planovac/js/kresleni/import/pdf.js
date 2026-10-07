// Import PDF pomocí pdf.js (Apache-2.0, vendor/pdfjs): vektorové cesty a texty → primitiva, nebo vykreslení strany jako rastrový podklad.
// Souřadnice primitiv: body (pt), osa y dolů (viewport strany). Měřítko skutečných rozměrů PDF neobsahuje – určuje se při importu.

let lib = null;
export async function nactiPdfJs() {
  if (lib) return lib;
  const zdroj = globalThis.__PDFJS_ZDROJE__;                       // jednosouborová sestava dodá vlastní adresy (blob:)
  lib = await import(zdroj?.lib || '../../../vendor/pdfjs/pdf.min.mjs');
  lib.GlobalWorkerOptions.workerSrc = zdroj?.worker || new URL('../../../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
  return lib;
}

export async function otevriPdf(buf) {
  const l = await nactiPdfJs();
  try { return await l.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise; }
  catch (e) { throw new Error(e?.name === 'PasswordException' ? 'PDF je chráněné heslem.' : `PDF se nepodařilo otevřít (${e?.message || e}).`); }
}

const nasob = (A, B) => [A[0] * B[0] + A[2] * B[1], A[1] * B[0] + A[3] * B[1], A[0] * B[2] + A[2] * B[3], A[1] * B[2] + A[3] * B[3], A[0] * B[4] + A[2] * B[5] + A[4], A[1] * B[4] + A[3] * B[5] + A[5]];
const bod = (M, x, y) => [M[0] * x + M[2] * y + M[4], M[1] * x + M[3] * y + M[5]];
const hex = (a) => '#' + [a[0], a[1], a[2]].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

function kubika(p0, p1, p2, p3, n = 8) { const o = []; for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; o.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } return o; }

// Spojí navazující úsečky stejného stylu do lomených čar (CAD často exportuje každou úsečku zvlášť).
export function sloucCary(prim) {
  const klic = (p) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`;
  const out = [], skup = new Map();
  for (const p of prim) {
    if (p.t !== 'cara' || p.zav || p.body.length < 2) { out.push(p); continue; }
    const k = `${p.barva}|${p.tloustka}|${p.styl}`;
    if (!skup.has(k)) skup.set(k, []);
    skup.get(k).push(p);
  }
  for (const arr of skup.values()) {
    const idx = new Map(), pouzito = new Array(arr.length).fill(false);
    const pridej = (k, i) => { if (!idx.has(k)) idx.set(k, []); idx.get(k).push(i); };
    arr.forEach((p, i) => { pridej(klic(p.body[0]), i); pridej(klic(p.body.at(-1)), i); });
    for (let i = 0; i < arr.length; i++) {
      if (pouzito[i]) continue; pouzito[i] = true;
      let body = arr[i].body.slice();
      for (;;) {                                                   // prodlužování na konci
        const e = klic(body.at(-1)), j = (idx.get(e) || []).find((x) => !pouzito[x]);
        if (j === undefined) break; pouzito[j] = true;
        const q = arr[j].body; body.push(...(klic(q[0]) === e ? q : q.slice().reverse()).slice(1));
      }
      for (;;) {                                                   // prodlužování na začátku
        const z = klic(body[0]), j = (idx.get(z) || []).find((x) => !pouzito[x]);
        if (j === undefined) break; pouzito[j] = true;
        const q = arr[j].body, qq = klic(q.at(-1)) === z ? q : q.slice().reverse(); body = [...qq.slice(0, -1), ...body];
      }
      out.push({ ...arr[i], body, zav: body.length > 3 && klic(body[0]) === klic(body.at(-1)) });
    }
  }
  return out;
}

// Vektorová primitiva jedné strany. lib = pdfjs modul (kvůli OPS). Vrací { primitiva, nepodporovane, sirkaPt, vyskaPt }.
export async function pdfVektor(page, l, opts = {}) {
  const OPS = l.OPS, vp = page.getViewport({ scale: 1 });
  const ol = await page.getOperatorList();
  let ctm = vp.transform.slice(), vypln = '#000000', cara = '#000000', sirka = 1, carkovane = false;
  const zas = [], prim = [], nep = {};
  let podcesty = [], akt = null, maxPrvku = opts.max || 250000;
  const barvaE = (a) => (a && a.length >= 3 ? hex([a[0], a[1], a[2]]) : '#000000');
  const kScale = () => Math.sqrt(Math.abs(ctm[0] * ctm[3] - ctm[1] * ctm[2]));
  const nova = (x, y) => { akt = { body: [bod(ctm, x, y)], zav: false }; podcesty.push(akt); };
  const pridejCestu = (ops, a) => {
    let j = 0;
    for (const o of ops) {
      if (o === OPS.moveTo) { nova(a[j], a[j + 1]); j += 2; }
      else if (o === OPS.lineTo) { if (!akt) nova(a[j], a[j + 1]); else akt.body.push(bod(ctm, a[j], a[j + 1])); j += 2; }
      else if (o === OPS.curveTo || o === OPS.curveTo2 || o === OPS.curveTo3) {
        if (!akt) { nova(a[j], a[j + 1]); }
        const p0 = akt.body.at(-1); let c1, c2, e;
        if (o === OPS.curveTo) { c1 = bod(ctm, a[j], a[j + 1]); c2 = bod(ctm, a[j + 2], a[j + 3]); e = bod(ctm, a[j + 4], a[j + 5]); j += 6; }
        else if (o === OPS.curveTo2) { c1 = p0; c2 = bod(ctm, a[j], a[j + 1]); e = bod(ctm, a[j + 2], a[j + 3]); j += 4; }
        else { c1 = bod(ctm, a[j], a[j + 1]); e = bod(ctm, a[j + 2], a[j + 3]); c2 = e; j += 4; }
        akt.body.push(...kubika(p0, c1, c2, e));
      } else if (o === OPS.closePath) { if (akt) { akt.zav = true; akt = null; } }
      else if (o === OPS.rectangle) { const x = a[j], y = a[j + 1], w = a[j + 2], h = a[j + 3]; j += 4; podcesty.push({ body: [bod(ctm, x, y), bod(ctm, x + w, y), bod(ctm, x + w, y + h), bod(ctm, x, y + h)], zav: true }); akt = null; }
    }
  };
  const maluj = (caraJo, vyplnJo, zavrit) => {
    for (const c of podcesty) {
      if (zavrit) c.zav = true;
      if (c.body.length < 2 || prim.length > maxPrvku) continue;
      const tl = Math.max(0.15, Math.min(2, sirka * kScale() * 0.3528));
      if (vyplnJo && c.body.length >= 3) prim.push({ t: 'plocha', body: c.body.slice(), vypln, barva: caraJo ? cara : vypln, vrstva: 'PDF' });
      else if (caraJo) prim.push({ t: 'cara', body: c.zav && c.body.length > 2 ? [...c.body, c.body[0]] : c.body, zav: false, barva: cara, tloustka: Math.round(tl * 100) / 100, styl: carkovane ? 'carkovana' : 'plna', vrstva: 'PDF' });
    }
    podcesty = []; akt = null;
  };
  const fa = ol.fnArray, aa = ol.argsArray;
  for (let i = 0; i < fa.length; i++) {
    const f = fa[i], a = aa[i];
    if (f === OPS.save) zas.push({ ctm: ctm.slice(), vypln, cara, sirka, carkovane });
    else if (f === OPS.restore) { const s = zas.pop(); if (s) ({ vypln, cara, sirka, carkovane } = s), (ctm = s.ctm); }
    else if (f === OPS.transform) ctm = nasob(ctm, a);
    else if (f === OPS.constructPath) pridejCestu(a[0], a[1]);
    else if (f === OPS.stroke) maluj(true, false, false);
    else if (f === OPS.closeStroke) maluj(true, false, true);
    else if (f === OPS.fill || f === OPS.eoFill) maluj(false, true, true);
    else if (f === OPS.fillStroke || f === OPS.eoFillStroke) maluj(true, true, true);
    else if (f === OPS.closeFillStroke || f === OPS.closeEOFillStroke) maluj(true, true, true);
    else if (f === OPS.endPath) { podcesty = []; akt = null; }
    else if (f === OPS.setStrokeRGBColor) cara = barvaE(a);
    else if (f === OPS.setFillRGBColor) vypln = barvaE(a);
    else if (f === OPS.setLineWidth) sirka = a[0];
    else if (f === OPS.setDash) carkovane = Array.isArray(a[0]) && a[0].length > 0;
    else if (f === OPS.setGState) for (const [k, v] of a[0]) { if (k === 'LW') sirka = v; else if (k === 'D') carkovane = Array.isArray(v[0]) && v[0].length > 0; }
    else if (f === OPS.paintImageXObject || f === OPS.paintInlineImageXObject || f === OPS.paintImageMaskXObject) nep['vložený obrázek'] = (nep['vložený obrázek'] || 0) + 1;
    else if (f === OPS.shadingFill || f === OPS.paintShading) nep['přechod (shading)'] = (nep['přechod (shading)'] || 0) + 1;
  }
  // texty
  const tc = await page.getTextContent();
  const radky = [];
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;
    const M = nasob(vp.transform, it.transform), vyska = Math.hypot(M[0], M[1]);
    if (!(vyska > 0.5)) continue;
    const uhel = (Math.atan2(M[1], M[0]) * 180) / Math.PI, p = { x: M[4], y: M[5], vyska, uhel, str: it.str, sirka: Math.abs(it.width) };
    const pred = radky.at(-1);
    if (pred && Math.abs(pred.uhel - uhel) < 1 && Math.abs(pred.vyska - vyska) < vyska * 0.15) {
      const c = Math.cos((uhel * Math.PI) / 180), s = Math.sin((uhel * Math.PI) / 180), dx = p.x - pred.x, dy = p.y - pred.y;
      const podel = dx * c + dy * s, kolmo = -dx * s + dy * c;
      if (Math.abs(kolmo) < vyska * 0.3 && podel > pred.sirka - vyska * 0.3 && podel < pred.sirka + vyska * 1.2) { pred.str += (podel - pred.sirka > vyska * 0.25 ? ' ' : '') + p.str; pred.sirka = podel + p.sirka; continue; }
    }
    radky.push(p);
  }
  for (const r of radky) prim.push({ t: 'text', x: r.x, y: r.y, vyskaJ: r.vyska, uhel: r.uhel, text: r.str, barva: '#000000', vrstva: 'PDF' });
  const slouceno = opts.sloucit === false ? prim : sloucCary(prim);
  return { primitiva: slouceno, nepodporovane: nep, sirkaPt: vp.width, vyskaPt: vp.height, pocetPredSlucovanim: prim.length };
}

// Vykreslí stranu jako rastr (PNG data URL); delsiStrana = cílová délka delší strany v px.
export async function pdfRastr(page, delsiStrana = 3000) {
  const vp1 = page.getViewport({ scale: 1 }), k = Math.min(6, delsiStrana / Math.max(vp1.width, vp1.height)), vp = page.getViewport({ scale: k });
  const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
  const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: g, viewport: vp }).promise;
  return { mime: 'image/png', data: c.toDataURL('image/png'), w: c.width, h: c.height };
}
