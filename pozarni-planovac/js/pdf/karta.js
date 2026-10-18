// Operativní karta jako vektorové PDF stránky (A4 na výšku): rozvržení podle vzoru HZS SCK, text s vloženým písmem (česká diakritika).
import { sestavKartu } from '../kartaData.js';

const MM = 72 / 25.4, W = 210, H = 297, OKRAJ = 10, SIRKA = W - 2 * OKRAJ, DOLE = H - OKRAJ;
const SEDA = '#d9d9d9', ZLUTA = '#ffff00', CERVENA = '#ff0000', ZELENA = '#00ff00', MODRA = '#00b0f0';
const rozloz = (hex) => [parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255];

// Řádky textu: segmenty [{t, b}] se zalomí na šířku (mm). Vrací pole řádků, řádek = pole segmentů.
function zalom(segmenty, sirkaMm, pt, fonty) {
  const max = sirkaMm * MM, radky = [[]]; let x = 0;
  const sirka = (t, b) => (b ? fonty.bold : fonty.regular).widthOfTextAtSize(t, pt);
  const pridej = (t, b) => { const r = radky.at(-1); if (r.length && r.at(-1).b === b) r.at(-1).t += t; else r.push({ t, b }); };
  for (const seg of segmenty) {
    for (const [i, odstavec] of String(seg.t ?? '').split('\n').entries()) {
      if (i > 0) { radky.push([]); x = 0; }
      for (const slovo of odstavec.split(/( +)/)) {
        if (slovo === '') continue;
        const w = sirka(slovo, seg.b);
        if (x + w > max && x > 0 && !/^ +$/.test(slovo)) { radky.push([]); x = 0; }
        if (/^ +$/.test(slovo) && x === 0) continue;                      // mezera na začátku řádku se zahodí
        if (w > max) {                                                      // příliš dlouhé slovo: zalomit po znacích
          let cast = '';
          for (const ch of slovo) { if (sirka(cast + ch, seg.b) > max && cast) { pridej(cast, seg.b); radky.push([]); cast = ''; } cast += ch; }
          pridej(cast, seg.b); x = sirka(cast, seg.b); continue;
        }
        pridej(slovo, seg.b); x += w;
      }
    }
  }
  return radky.map((r) => { while (r.length && /^ +$/.test(r.at(-1).t)) r.pop(); if (r.length) r.at(-1).t = r.at(-1).t.replace(/ +$/, ''); return r; });
}

export async function vykresliKartu(ctx, list, projekt) {
  const L = ctx.lib, d = sestavKartu(list.karta, projekt), PT = 8.5, VEDENI = PT * 1.28 / MM, PAD = 1.1;
  let page = null, y = 0;
  const nova = () => { page = ctx.pdfDoc.addPage([W * MM, H * MM]); y = OKRAJ; };
  const Y = (mm) => (H - mm) * MM;
  nova();

  const hlavickaFont = (b) => (b ? ctx.fonty.bold : ctx.fonty.regular);
  function textRadek(r, x, yBase, pt, center, sirkaBunky) {
    let celkem = 0; for (const s of r) celkem += hlavickaFont(s.b).widthOfTextAtSize(s.t, pt);
    let px = center ? x + (sirkaBunky * MM - celkem) / 2 : x;
    for (const s of r) { const f = hlavickaFont(s.b); if (s.t) page.drawText(s.t, { x: px, y: yBase, size: pt, font: f, color: L.rgb(0, 0, 0) }); px += f.widthOfTextAtSize(s.t, pt); }
  }
  // buňka: { x, w (mm), seg, fill, center, pt, minH, znackaId }
  const merBunku = (b) => {
    const pt = b.pt ?? PT, vnitrni = b.w - 2 * PAD - (b.znackaId !== undefined ? 0 : 0);
    const radky = b.znackaId !== undefined ? [] : zalom(b.seg || [], vnitrni, pt, ctx.fonty);
    return { ...b, pt, radky, h: Math.max(b.minH ?? 0, radky.length * (pt * 1.28 / MM) + 2 * PAD) };
  };
  function radek(bunky, { zachovejSNasledujicim = 0 } = {}) {
    const m = bunky.map(merBunku), h = Math.max(...m.map((b) => b.h));
    if (y + h + zachovejSNasledujicim > DOLE) nova();
    for (const b of m) {
      const x0 = OKRAJ + b.x;
      if (b.fill) page.drawRectangle({ x: x0 * MM, y: Y(y + h), width: b.w * MM, height: h * MM, color: L.rgb(...rozloz(b.fill)) });
      page.drawRectangle({ x: x0 * MM, y: Y(y + h), width: b.w * MM, height: h * MM, borderColor: L.rgb(0, 0, 0), borderWidth: 0.6 });
      if (b.znackaId !== undefined) {
        const img = ctx.znacka(b.znackaId);
        if (img) { const s = Math.min(b.w - 2, h - 2, 12), k = Math.min(s * MM / img.width, s * MM / img.height); page.drawImage(img, { x: x0 * MM + (b.w * MM - img.width * k) / 2, y: Y(y + h / 2) - (img.height * k) / 2, width: img.width * k, height: img.height * k }); }
        continue;
      }
      const vyskaTextu = b.radky.length * (b.pt * 1.28 / MM), start = y + PAD + (b.centrovatSvisle ? (h - 2 * PAD - vyskaTextu) / 2 : 0);
      b.radky.forEach((r, i) => textRadek(r, (x0 + PAD) * MM, Y(start + (i + 0.82) * (b.pt * 1.28 / MM)), b.pt, b.center, b.w - 2 * PAD));
    }
    y += h;
  }
  const S = (t, b = false) => ({ t, b });
  const popis = (nadpis, hodnota) => [S(`${nadpis} `, true), S(hodnota ?? '')];
  const pas = (text, barva, bila = false, drz = 14) => {
    const rozstrel = text.split('').join(' '), m = merBunku({ x: 0, w: SIRKA, seg: [S(rozstrel, true)], center: true, pt: 9.5, minH: 6 });
    if (y + m.h + drz > DOLE) nova();
    page.drawRectangle({ x: OKRAJ * MM, y: Y(y + m.h), width: SIRKA * MM, height: m.h * MM, color: L.rgb(...rozloz(barva)), borderColor: L.rgb(0, 0, 0), borderWidth: 0.6 });
    const f = ctx.fonty.bold, pt = 9.5, w = f.widthOfTextAtSize(rozstrel, pt);
    page.drawText(rozstrel, { x: OKRAJ * MM + (SIRKA * MM - w) / 2, y: Y(y + m.h / 2) - pt * 0.35, size: pt, font: f, color: bila ? L.rgb(1, 1, 1) : L.rgb(0, 0, 0) });
    y += m.h;
  };

  // --- záhlaví ---
  const h = d.hlava, lev = 125, prav = SIRKA - lev;
  radek([{ x: 0, w: lev, seg: [S('O P E R A T I V N Í    K A R T A', true)], pt: 14, center: true, fill: ZLUTA, minH: 22, centrovatSvisle: true },
    { x: lev, w: prav, seg: [S('STUPEŇ POPLACHU\n'), S(h.stupen || '', true), S(`\n${h.uo || ''}`)], center: true, fill: ZLUTA, pt: 9, centrovatSvisle: true }]);
  radek([{ x: 0, w: lev, seg: popis('OBJEKT:', h.objekt) }, { x: lev, w: prav, seg: [...popis('PROVOZOVATEL:', h.provozovatel), S(h.ic ? `, IČ: ${h.ic}` : '')] }]);
  radek([{ x: 0, w: lev, seg: popis('ADRESA:', h.adresa) }, { x: lev, w: prav, seg: popis('GPS:', h.gps) }]);
  radek([{ x: 0, w: lev, seg: [...popis('PROVOZ:', ''), S(`pracovní doba: ${h.pracovniDoba || ''}\nkontakt: ${[h.kontaktTelefon, h.kontaktJmeno].filter(Boolean).join(' – ')}`)] }, { x: lev, w: prav, seg: popis('OBSAZENÍ OSOBAMI:', h.obsazeni) }]);
  radek([{ x: 0, w: lev, seg: popis('PŘÍJEZD Z:', h.prijezd) }, { x: lev, w: prav, seg: popis('OMEZENÍ:', h.omezeni) }]);

  // --- charakter objektu ---
  const c = d.charakter, t3 = SIRKA / 3;
  pas('CHARAKTER OBJEKTU', SEDA);
  radek([{ x: 0, w: 2 * t3, seg: popis('ÚČEL STAVBY:', c.ucel) }, { x: 2 * t3, w: t3, seg: popis('PODLAŽÍ:', c.podlazi) }]);
  radek([{ x: 0, w: t3, seg: popis('PŮDORYS (m):', c.pudoryM) }, { x: t3, w: t3, seg: popis('KONSTRUKCE:', c.konstrukce) }, { x: 2 * t3, w: t3, seg: popis('ÚNIKOVÉ CESTY:', c.unikoveCesty) }]);
  radek([{ x: 0, w: t3, seg: popis('CELKOVÁ VÝŠKA (m):', c.vyska) }, { x: t3, w: t3, seg: popis('STĚNY:', c.steny) }, { x: 2 * t3, w: t3, seg: [...popis('PŘÍČKY:', c.priccky), S('   '), ...popis('VÝTAHY:', c.vytahy)] }]);
  radek([{ x: 0, w: t3, seg: popis('ZASTAVĚNÁ PLOCHA (m²):', c.plocha) }, { x: t3, w: t3, seg: popis('STROPY:', c.stropy) }, { x: 2 * t3, w: t3, seg: popis('STŘECHA:', c.strecha) }]);
  radek([{ x: 0, w: 2 * t3, seg: popis('POŽÁRNÍ ÚSEKY:', c.useky) }, { x: 2 * t3, w: t3, seg: popis('TYP ÚNIKOVÉ CESTY:', c.typUnik) }]);

  // --- nebezpečí ---
  const sym = 20;
  pas('!!! NEBEZPEČÍ !!!', CERVENA, true);
  const nebezpeci = d.nebezpeci.length ? d.nebezpeci : [{ znackaId: null, text: '' }];
  for (const n of nebezpeci) radek([{ x: 0, w: sym, znackaId: n.znackaId ?? null, minH: 9 }, { x: sym, w: SIRKA - sym, seg: [S(n.text)], minH: 9 }]);

  // --- média a PBZ ---
  pas('ZÁVĚRY MÉDIÍ / POŽÁRNĚ BEZPEČNOSTNÍ ZAŘÍZENÍ', ZELENA);
  const dvojice = [...d.media, ...d.pbz], pul = SIRKA / 2, lw = 36;     // dva sloupce štítek | hodnota na řádek (karta se vejde na jednu stránku)
  for (let i = 0; i < dvojice.length; i += 2) {
    const [a, b] = dvojice[i], dalsi = dvojice[i + 1];
    radek([{ x: 0, w: lw, seg: [S(a, true)] }, { x: lw, w: pul - lw, seg: [S(b ?? '')] }, { x: pul, w: lw, seg: dalsi ? [S(dalsi[0], true)] : [] }, { x: pul + lw, w: pul - lw, seg: dalsi ? [S(dalsi[1] ?? '')] : [] }]);
  }

  // --- voda ---
  pas('VODNÍ ZDROJE A HASEBNÍ LÁTKY', MODRA);
  const vody = d.vody.length ? d.vody : [{ znackaId: null, text: '' }];
  for (const v of vody) radek([{ x: 0, w: sym, znackaId: v.znackaId ?? null, minH: 9 }, { x: sym, w: SIRKA - sym, seg: [S(v.text)], minH: 9 }]);

  // --- doporučení ---
  pas('DOPORUČENÍ PRO VELITELE ZÁSAHU', ZLUTA, false, 60);
  radek([{ x: 0, w: SIRKA, seg: [S(d.doporuceni || ''), S(`${d.doporuceni ? '\n\n' : ''}Znalost o objektu má: ${d.znalost.jmeno || ''}${d.znalost.mobil ? `, mob.: ${d.znalost.mobil}` : ''}`)], minH: 26 }]);

  // --- podpisy ---
  const pol = SIRKA / 2;
  radek([{ x: 0, w: pol, seg: [S('ZPRACOVAL\n', true), S(`${d.zpracoval.jmeno || ''}\nč. osvědčení: ${d.zpracoval.cislo || ''}\ndatum: ${d.zpracoval.datum || ''}\n\npodpis:`)], minH: 24 },
    { x: pol, w: pol, seg: [S('SCHVÁLIL\n', true), S(`${d.schvalil.jmeno || ''}\n${d.schvalil.funkce || ''}\ndatum: ${d.schvalil.datum || ''}\n\npodpis:`)], minH: 24 }]);
  if (d.revize.length) {
    const m = merBunku({ x: 0, w: SIRKA, seg: [S(`Revize: ${d.revize.join('; ')}`)], pt: 7 });
    if (y + m.h > DOLE) nova();
    m.radky.forEach((r, i) => textRadek(r, OKRAJ * MM, Y(y + 1 + (i + 0.82) * (7 * 1.28 / MM)), 7, false, SIRKA));
    y += m.h;
  }
}

// Textový list: nadpis a odstavce na stránkách A4 na výšku.
export async function vykresliTextovyList(ctx, list) {
  const L = ctx.lib, PT = 10, V = PT * 1.4 / MM;
  let page = ctx.pdfDoc.addPage([W * MM, H * MM]), y = OKRAJ;
  const Y = (mm) => (H - mm) * MM;
  page.drawText(list.nazev, { x: OKRAJ * MM, y: Y(y + 6), size: 15, font: ctx.fonty.bold, color: L.rgb(0, 0, 0) }); y += 12;
  for (const r of zalom([{ t: list.text || '' }], SIRKA, PT, ctx.fonty)) {
    if (y + V > DOLE) { page = ctx.pdfDoc.addPage([W * MM, H * MM]); y = OKRAJ; }
    let px = OKRAJ * MM; for (const s of r) { if (s.t) page.drawText(s.t, { x: px, y: Y(y + V * 0.75), size: PT, font: s.b ? ctx.fonty.bold : ctx.fonty.regular, color: L.rgb(0, 0, 0) }); px += (s.b ? ctx.fonty.bold : ctx.fonty.regular).widthOfTextAtSize(s.t, PT); }
    y += V;
  }
}
