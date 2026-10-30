// Operativní karta jako vektorová PDF stránka A4 na výšku podle vzoru HZS SČK (rozvržení: js/kartaRozvrzeni.js).
// Textová část karty se vejde na jeden list A4 (Hanuška 1996, kap. 3.1): písmo se zmenšuje od 8,5 do 7 pt. Když se karta nevejde
// ani tak, pokračuje na další straně – nic se nezahodí – a vykresliKartu to vrátí ({ stran > 1 }), aby aplikace upozornila.
import { rozvrzeniListu, umistiBunky, VELIKOSTI_PISMA, IKONA_MM as IKONA } from '../kartaRozvrzeni.js';
import { jeZnackaKarty, skupinaZnackyKarty } from '../kartaZnacky.js';
import { vykresliSvgDoPdf } from './svg2pdf.js';
import { bezpecnyText } from './pismo.js';

const MM = 72 / 25.4, W = 210, H = 297, OKRAJ = 10, SIRKA = W - 2 * OKRAJ, DOLE = H - OKRAJ, VYSKA = DOLE - OKRAJ;
const PADV = 1.1, PADH = 1.2, CARA = 0.6, RAM = 1.4, RADKOVANI = 1.2, ZNACKA_MAX = 8;
const PODPIS_RADEK = 5, PODPIS_SIRKA = 71, PODPIS_ODSAZENI = 5;
const rgb = (L, hex) => L.rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);

// Segmenty [{t, b, u, c, velikost, odznak, chybi}] → řádky [{ casti: [{s, t, w, sz}], w (pt), pt }] zalomené na šířku (mm).
export function zalomSegmenty(seg, sirkaMm, pt, fonty) {
  const max = sirkaMm * MM, radky = [{ casti: [], w: 0, pt: 0 }];
  const novy = () => radky.push({ casti: [], w: 0, pt: 0 });
  const font = (s) => (s.b ? fonty.bold : fonty.regular);
  const pridej = (s, t, w, sz) => { const r = radky.at(-1), p = r.casti.at(-1); if (p && p.s === s) { p.t += t; p.w += w; } else r.casti.push({ s, t, w, sz }); r.w += w; r.pt = Math.max(r.pt, sz); };
  for (const s of seg) {
    if (s.chybi) continue;                                                     // nevyplněno: v náhledu „…“, v PDF prázdné okénko
    const f = font(s), sz = pt * (s.velikost || 1), text = bezpecnyText(s.t, f);
    if (s.odznak) { const w = f.widthOfTextAtSize(text, sz) + 1.6 * MM; if (radky.at(-1).w + w > max && radky.at(-1).w > 0) novy(); pridej(s, text, w, sz); continue; }
    text.split('\n').forEach((odstavec, i) => {
      if (i > 0) novy();
      for (const slovo of odstavec.split(/( +)/)) {
        if (!slovo) continue;
        const mezera = /^ +$/.test(slovo), w = f.widthOfTextAtSize(slovo, sz);
        if (mezera && radky.at(-1).w === 0) continue;                         // mezera na začátku řádku se zahodí
        if (!mezera && radky.at(-1).w + w > max && radky.at(-1).w > 0) novy();
        if (w > max) {                                                         // příliš dlouhé slovo: zalomit po znacích
          let cast = '';
          for (const ch of slovo) { if (f.widthOfTextAtSize(cast + ch, sz) > max && cast) { pridej(s, cast, f.widthOfTextAtSize(cast, sz), sz); novy(); cast = ''; } cast += ch; }
          if (cast) pridej(s, cast, f.widthOfTextAtSize(cast, sz), sz);
          continue;
        }
        pridej(s, slovo, w, sz);
      }
    });
  }
  for (const r of radky) {                                                     // mezery na konci řádku se nepočítají
    while (r.casti.length && /^ +$/.test(r.casti.at(-1).t)) r.w -= r.casti.pop().w;
    const p = r.casti.at(-1), t = p?.t.replace(/ +$/, '');
    if (p && t !== p.t) { const w = (p.s.b ? fonty.bold : fonty.regular).widthOfTextAtSize(t, p.sz); r.w -= p.w - w; p.w = w; p.t = t; }
    if (!r.pt) r.pt = pt;
  }
  while (radky.length > 1 && !radky.at(-1).casti.length) radky.pop();
  return radky;
}
const vyskaRadku = (r) => (r.pt * RADKOVANI) / MM;
const vyskaTextu = (radky) => radky.reduce((a, r) => a + vyskaRadku(r), 0);

// Rozměří celou kartu při dané velikosti písma (bez kreslení).
function zmer(R, pt, fonty) {
  const tabulky = R.tabulky.map((t) => {
    const radky = umistiBunky(t).map((r) => {
      const bunky = r.bunky.map((b) => {
        const vnitrni = b.w - 2 * PADH - (b.ikony?.length ? b.ikony.length * (IKONA + 0.8) : 0);
        const radkyTextu = b.seg ? zalomSegmenty(b.seg, Math.max(5, vnitrni), pt, fonty) : [];
        const obsah = b.zn !== undefined ? 0 : Math.max(vyskaTextu(radkyTextu), b.ikony?.length ? IKONA : 0);
        return { ...b, radkyTextu, vyskaObsahu: obsah + 2 * PADV };
      });
      const h = Math.max(r.minH ?? 0, (pt * RADKOVANI) / MM + 2 * PADV, ...bunky.filter((b) => (b.rowspan || 1) === 1).map((b) => b.vyskaObsahu));
      return { ...r, bunky, h };
    });
    radky.forEach((r, i) => r.bunky.filter((b) => (b.rowspan || 1) > 1).forEach((b) => {   // buňka přes více řádků: případně prodloužit poslední z nich
      const pres = radky.slice(i, i + b.rowspan), soucet = pres.reduce((a, x) => a + x.h, 0);
      if (b.vyskaObsahu > soucet) pres.at(-1).h += b.vyskaObsahu - soucet;
    }));
    return { radky, h: radky.reduce((a, r) => a + r.h, 0) };
  });
  const dop = zalomSegmenty(R.doporuceni, SIRKA - 4, pt, fonty);
  const revize = R.revize ? zalomSegmenty([{ t: R.revize }], SIRKA - 4, Math.min(pt, 6.5), fonty) : [];
  const podpisy = (R.podpisy[0].radky.length + 1) * PODPIS_RADEK;
  const celkem = tabulky.reduce((a, t) => a + t.h, 0) + vyskaTextu(dop) + 2 * 1.5 + 3 + podpisy + 3 + (revize.length ? vyskaTextu(revize) + 1 : 0);
  return { pt, tabulky, dop, revize, podpisy, celkem };
}

export async function vykresliKartu(ctx, list, projekt) {
  const L = ctx.lib, fonty = ctx.fonty, R = rozvrzeniListu(list, projekt);
  let m = null;
  for (const pt of VELIKOSTI_PISMA) { m = zmer(R, pt, fonty); if (m.celkem <= VYSKA) break; }
  const jednaStrana = m.celkem <= VYSKA;
  const strany = [];
  let page = null, y = 0, vektory = [];
  const Y = (mm) => (H - mm) * MM;
  const nova = () => { page = ctx.pdfDoc.addPage([W * MM, H * MM]); strany.push({ page, vektory: (vektory = []) }); y = OKRAJ; };
  nova();

  function kresliText(radky, x, yTop, sirkaMm, stred, odRadku = 0, doRadku = radky.length) {
    let yy = yTop;
    for (let i = odRadku; i < doRadku; i++) {
      const r = radky[i], base = Y(yy) - r.pt * 0.94;
      let px = x * MM + (stred ? Math.max(0, (sirkaMm * MM - r.w) / 2) : 0);
      for (const c of r.casti) {
        const s = c.s, f = s.b ? fonty.bold : fonty.regular, sz = c.sz;
        const barva = rgb(L, s.odznak ? '#ff0000' : s.c || '#000000');
        if (s.odznak) {
          page.drawRectangle({ x: px + 0.15 * MM, y: base - sz * 0.28, width: c.w - 0.3 * MM, height: sz * 1.12, borderColor: barva, borderWidth: 0.7 });
          page.drawText(c.t, { x: px + 0.8 * MM, y: base, size: sz, font: f, color: barva });
        } else if (c.t.trim()) {
          page.drawText(c.t, { x: px, y: base, size: sz, font: f, color: barva });
          if (s.u) page.drawLine({ start: { x: px, y: base - sz * 0.14 }, end: { x: px + c.w, y: base - sz * 0.14 }, thickness: Math.max(0.4, sz * 0.06), color: barva });
        }
        px += c.w;
      }
      yy += vyskaRadku(r);
    }
  }
  function kresliZnacku(id, x, yTop, w, h) {
    if (!id) return;
    const s = Math.min(w - 2 * PADH, h - 2 * PADV, ZNACKA_MAX);
    if (jeZnackaKarty(id)) { vektory.push(skupinaZnackyKarty(id, x + PADH, yTop + (h - s) / 2, w - 2 * PADH, s)); return; }
    const img = ctx.znacka(id); if (!img) return;
    const k = Math.min((w - 2 * PADH) * MM / img.width, s * MM / img.height);
    page.drawImage(img, { x: x * MM + (w * MM - img.width * k) / 2, y: Y(yTop + h / 2) - (img.height * k) / 2, width: img.width * k, height: img.height * k });
  }
  function kresliBunku(b, x, yTop, h, odRadku = 0, doRadku = b.radkyTextu.length) {
    if (b.fill) page.drawRectangle({ x: x * MM, y: Y(yTop + h), width: b.w * MM, height: h * MM, color: rgb(L, b.fill) });
    page.drawRectangle({ x: x * MM, y: Y(yTop + h), width: b.w * MM, height: h * MM, borderColor: L.rgb(0, 0, 0), borderWidth: CARA });
    if (b.zn !== undefined) { if (odRadku === 0) kresliZnacku(b.zn, x, yTop, b.w, h); return; }
    let tx = x + PADH;
    if (b.ikony?.length && odRadku === 0) for (const id of b.ikony) { vektory.push(skupinaZnackyKarty(id, tx, yTop + (h - IKONA) / 2, IKONA, IKONA)); tx += IKONA + 0.8; }
    else if (b.ikony?.length) tx += b.ikony.length * (IKONA + 0.8);
    const radky = b.radkyTextu, vyska = vyskaTextu(radky.slice(odRadku, doRadku));
    const top = yTop + PADV + (b.svisleStred ? Math.max(0, (h - 2 * PADV - vyska) / 2) : 0);
    kresliText(radky, tx, top, b.w - (tx - x) - PADH, b.stred, odRadku, doRadku);
  }
  // Řádek tabulky; v pokračovacím režimu se příliš vysoký řádek rozdělí po řádcích textu na více stran.
  function kresliRadekTabulky(r, vyskaSkupiny) {
    if (!jednaStrana && y + vyskaSkupiny > DOLE && y > OKRAJ + 0.1) nova();
    if (r.h <= DOLE - y || jednaStrana) { for (const b of r.bunky) kresliBunku(b, OKRAJ + b.x, y, (b.rowspan || 1) > 1 ? b.hSkupiny : r.h); y += r.h; return; }
    const od = new Map(r.bunky.map((b) => [b, 0]));
    while ([...od].some(([b, i]) => b.radkyTextu && i < b.radkyTextu.length)) {
      const volno = DOLE - y, hotovo = new Map();
      for (const b of r.bunky) {
        let i = od.get(b), v = 0; const rt = b.radkyTextu || [];
        while (i < rt.length && v + vyskaRadku(rt[i]) <= volno - 2 * PADV) { v += vyskaRadku(rt[i]); i++; }
        if (i === od.get(b) && i < rt.length) i++;                             // aspoň jeden řádek, ať se neuvízne
        hotovo.set(b, i);
      }
      const h = Math.min(volno, Math.max(...r.bunky.map((b) => vyskaTextu((b.radkyTextu || []).slice(od.get(b), hotovo.get(b))) + 2 * PADV), r.minH ?? 0));
      for (const b of r.bunky) kresliBunku(b, OKRAJ + b.x, y, h, od.get(b), hotovo.get(b));
      y += h; for (const [b, i] of hotovo) od.set(b, i);
      if ([...od].some(([b, i]) => b.radkyTextu && i < b.radkyTextu.length)) nova();
    }
  }

  for (const t of m.tabulky) {
    t.radky.forEach((r, i) => {
      for (const b of r.bunky) if ((b.rowspan || 1) > 1) b.hSkupiny = t.radky.slice(i, i + b.rowspan).reduce((a, x) => a + x.h, 0);
      const skupina = Math.max(r.h, ...r.bunky.filter((b) => b.hSkupiny).map((b) => b.hSkupiny), r.pas ? r.h + (t.radky[i + 1]?.h ?? 0) : 0);   // pás nezůstane sám dole
      kresliRadekTabulky(r, skupina);
    });
  }

  // doporučení: volný text pod žlutým pásem (vzor nemá ohraničení), podpisy dole na listu
  const podpisyY = () => DOLE - 3 - m.podpisy - (m.revize.length ? vyskaTextu(m.revize) + 1 : 0);
  y += 1.5;
  for (let i = 0; i < m.dop.length; i++) {
    const v = vyskaRadku(m.dop[i]);
    if (!jednaStrana && y + v > DOLE - 1) nova();
    kresliText(m.dop, OKRAJ + 2, y, SIRKA - 4, false, i, i + 1); y += v;
  }
  y += 1.5;
  if (!jednaStrana && y + 3 > podpisyY()) nova();
  const yp = podpisyY();
  R.podpisy.forEach((p, k) => {
    const x = k === 0 ? OKRAJ + PODPIS_ODSAZENI : W - OKRAJ - PODPIS_ODSAZENI - PODPIS_SIRKA;
    [[p.nadpis, '', true], ...p.radky.map(([a, b]) => [a, b, false])].forEach(([stitek, hodnota, nadpis], j) => {
      const yy = yp + j * PODPIS_RADEK;
      page.drawRectangle({ x: x * MM, y: Y(yy + PODPIS_RADEK), width: PODPIS_SIRKA * MM, height: PODPIS_RADEK * MM, borderColor: L.rgb(0, 0, 0), borderWidth: CARA });
      const f = fonty.bold, sz = nadpis ? 7.5 : 6, t = bezpecnyText(stitek, f), w = f.widthOfTextAtSize(t, sz);
      page.drawText(t, { x: nadpis ? (x + PODPIS_SIRKA / 2) * MM - w / 2 : (x + 1.2) * MM, y: Y(yy + PODPIS_RADEK) + 1.3 * MM, size: sz, font: f, color: L.rgb(0, 0, 0) });
      if (hodnota) {
        const fr = fonty.regular, max = (PODPIS_SIRKA - 2.4) * MM - w - 2 * MM;
        let tv = bezpecnyText(hodnota, fr), szv = 7.5;
        while (fr.widthOfTextAtSize(tv, szv) > max && szv > 5.5) szv -= 0.25;
        while (fr.widthOfTextAtSize(tv, szv) > max && tv.length > 1) tv = `${tv.slice(0, -2)}…`;
        page.drawText(tv, { x: (x + 1.2) * MM + w + 2 * MM, y: Y(yy + PODPIS_RADEK) + 1.3 * MM, size: szv, font: fr, color: L.rgb(0, 0, 0) });
      }
    });
  });
  if (m.revize.length) kresliText(m.revize, OKRAJ + 2, DOLE - 1 - vyskaTextu(m.revize), SIRKA - 4, false);

  for (const s of strany) {   // rámeček listu jako ve vzoru a vektorové značky karty
    s.page.drawRectangle({ x: OKRAJ * MM, y: OKRAJ * MM, width: SIRKA * MM, height: VYSKA * MM, borderColor: L.rgb(0, 0, 0), borderWidth: RAM });
    if (s.vektory.length) await vykresliSvgDoPdf(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${s.vektory.join('')}</svg>`, { ...ctx, page: s.page });
  }
  return { stran: strany.length, pt: m.pt, jednaStrana };
}

// Textový list: nadpis a odstavce na stránkách A4 na výšku.
export async function vykresliTextovyList(ctx, list) {
  const L = ctx.lib, PT = 10, V = PT * 1.4 / MM;
  let page = ctx.pdfDoc.addPage([W * MM, H * MM]), y = OKRAJ;
  const Y = (mm) => (H - mm) * MM;
  const nadpis = zalomSegmenty([{ t: list.nazev, b: true }], SIRKA, 15, ctx.fonty);
  for (const r of nadpis) { page.drawText(r.casti.map((c) => c.t).join(''), { x: OKRAJ * MM, y: Y(y + 6), size: 15, font: ctx.fonty.bold, color: L.rgb(0, 0, 0) }); y += 7; }
  y += 5;
  for (const r of zalomSegmenty([{ t: list.text || '' }], SIRKA, PT, ctx.fonty)) {
    if (y + V > DOLE) { page = ctx.pdfDoc.addPage([W * MM, H * MM]); y = OKRAJ; }
    let px = OKRAJ * MM;
    for (const c of r.casti) { if (c.t.trim()) page.drawText(c.t, { x: px, y: Y(y + V * 0.75), size: PT, font: c.s.b ? ctx.fonty.bold : ctx.fonty.regular, color: L.rgb(0, 0, 0) }); px += c.w; }
    y += V;
  }
}
