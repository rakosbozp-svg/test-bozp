// Rozvržení operativní karty do okének vzoru HZS SČK (podklady/VZOR_operativni_karta_list_A4.docx, list A4 na výšku).
// Mřížky sloupců jsou převzaté z tabulek vzoru (šířky v twipech přepočtené na 190 mm). Stejné rozvržení kreslí
// náhled (js/nahled.js) i PDF (js/pdf/karta.js), takže se nerozejdou.
import { sestavKartu } from './kartaData.js';
import { jeNe } from './kartaPole.js';

export const ZLUTA = '#ffff00', CERVENA = '#ff0000', ZELENA = '#00ff00', MODRA = '#00b0f0';
// Základní písmo karty (pt): zkouší se od největšího, dokud se karta nevejde na jeden list A4 (náhled i PDF stejně).
export const VELIKOSTI_PISMA = [8.5, 8, 7.5, 7];
export const IKONA_MM = 5.5;   // značka výtahu E/P v okénku VÝTAHY
// tabulka 1 vzoru (hlavička): 1271, 2550, 1277, 3119, 2698 twipů
export const MRIZ_HLAVA = [22.12, 44.39, 22.23, 54.29, 46.97];
// tabulka 2 vzoru (charakter objektu až doporučení): 13 sloupců
export const MRIZ_KARTA = [22.161, 0.729, 16.43, 21.796, 0.347, 9.847, 17.211, 22.143, 12.348, 12.313, 4.915, 24.627, 25.131];

// Segment textu: { t, b (tučně), u (podtrženo), c (barva), velikost (násobek základního písma), odznak (rámeček – KTPO/OPPO), chybi (nevyplněno) }
const S = (t, b = false, x = {}) => ({ t, b, ...x });
const stitek = (t) => S(t, true);
const hodnota = (v) => (v ? S(v) : S('…', false, { chybi: true }));
// Pás s nadpisem jako ve vzoru: písmena slov proložená mezerou („C H A R A K T E R     O B J E K T U“), „!!!“ a „/“ beze změny.
const rozpal = (text) => text.split(/\s+/).map((slovo) => (/\p{L}/u.test(slovo) ? slovo.split('').join(' ') : slovo)).join('     ');
const pas = (text, fill, bily = false) => ({ pas: true, bunky: [{ span: MRIZ_KARTA.length, seg: [S(rozpal(text), true, { c: bily ? '#ffffff' : undefined, velikost: 1.12 })], fill, stred: true, svisleStred: true }] });

// Řádek mřížky z dvojic štítek + hodnota ({ skryt, stitek?, hodnota }). Dvojice s „NE“ (skryt) se netiskne a její sloupce převezme
// hodnota předchozí viditelné dvojice (u první dvojice následující), takže řádek dál vyplní celou šířku. Bez viditelné dvojice null.
function radekDvojic(dvojice) {
  const sloupce = (x) => (x.stitek ? x.stitek.span || 1 : 0) + (x.hodnota.span || 1);
  const out = [];
  let dluh = 0;                                                               // sloupce skrytých dvojic před první viditelnou
  for (const x of dvojice) {
    if (x.skryt) { if (out.length) out.at(-1).hodnota.span = (out.at(-1).hodnota.span || 1) + sloupce(x); else dluh += sloupce(x); continue; }
    out.push({ stitek: x.stitek && { ...x.stitek }, hodnota: { ...x.hodnota, span: (x.hodnota.span || 1) + dluh } });
    dluh = 0;
  }
  return out.length ? { bunky: out.flatMap((x) => (x.stitek ? [x.stitek, x.hodnota] : [x.hodnota])) } : null;
}
// Sekce karty: pás s nadpisem jen tehdy, když pod ním zbyl aspoň jeden řádek (všechna okénka „NE“ = bez sekce).
const sekce = (nadpis, radky) => { const r = radky.filter(Boolean); return r.length ? [nadpis, ...r] : []; };
// Šířky textových okének uzávěrů a vypínačů (sloupce mřížky) podle počtu viditelných okének v řádku; značka má vždy 1 sloupec.
const SIRKY_MEDII = { 3: [4, 3, 3], 2: [6, 5], 1: [12] };

// Buňka: { span, rowspan, seg, zn (samostatná značka na střed), ikony (značky před textem), fill, stred, svisleStred, minH (mm) }
// Okénka s „NE“ se netisknou (zadání uživatele; jeNe v js/kartaPole.js), nevyplněná okénka se tisknou prázdná („…“ v náhledu).
export function rozvrzeniKarty(d) {
  const h = d.hlava, c = d.charakter, vidim = (v) => !jeNe(v);
  const provoz = [vidim(h.pracovniDoba) && [stitek('Pracovní doba: '), hodnota(h.pracovniDoba)], vidim(h.kontakt) && [stitek('Kontakt: '), hodnota(h.kontakt)]].filter(Boolean);
  const vedleStupne = [   // řádky hlavičky vedle okénka STUPEŇ POPLACHU
    { bunky: [{ span: 4, seg: [stitek('OBJEKT: '), hodnota(h.objekt), S('\n'), stitek('PROVOZOVATEL: '), hodnota(h.provozovatel), S(h.ic && vidim(h.ic) ? `, IČ: ${h.ic}` : '')] }] },
    { bunky: [{ span: 4, seg: [stitek('ADRESA: '), hodnota(h.adresa), S('\n'), stitek('GPS: '), hodnota(h.gps)] }] },
    provoz.length ? { bunky: [{ span: 4, seg: [stitek('PROVOZ: '), ...provoz.flatMap((x, i) => (i ? [S('\n'), ...x] : x))] }] } : null,
    vidim(h.obsazeni) ? { bunky: [{ span: 4, seg: [stitek('OBSAZENÍ OSOBAMI: '), hodnota(h.obsazeni)] }] } : null,
  ].filter(Boolean);
  // STUPEŇ POPLACHU doplňuje HZS: okénko zůstává prázdné (bez „…“), ať je místo na ruční zápis
  const stanice = vidim(h.stanice) ? [S('Stanice HZS', true, { velikost: 1.2 }), S('\n'), h.stanice ? S(h.stanice, true, { velikost: 1.2 }) : hodnota('')] : [];
  const hlava = { mriz: MRIZ_HLAVA, radky: [
    { minH: 9, bunky: [
      { span: 4, seg: [S(rozpal('OPERATIVNÍ KARTA'), true, { velikost: 1.65 })], fill: ZLUTA, stred: true, svisleStred: true },
      { rowspan: 1 + vedleStupne.length, fill: ZLUTA, stred: true, svisleStred: true, seg: [S('STUPEŇ POPLACHU', true, { u: true, velikost: 1.2 }), S('\n\n\n'), ...stanice] },
    ] },
    ...vedleStupne,
    radekDvojic([
      { skryt: jeNe(h.prijezd), stitek: { seg: [stitek('PŘÍJEZD Z:')] }, hodnota: { seg: [hodnota(h.prijezd)] } },
      { skryt: jeNe(h.omezeni), stitek: { seg: [stitek('OMEZENÍ:')] }, hodnota: { span: 2, seg: [hodnota(h.omezeni)] } },
    ]),
  ].filter(Boolean) };

  const hasivo = (t) => (t ? [S('\n'), stitek('hasivo: '), S(t)] : []);
  const radkyZnacka = (zn, seg) => ({ minH: 9, bunky: [{ zn }, { span: 12, seg, svisleStred: true }] });
  // dvojice štítek + hodnota v charakteru objektu (hodnota s vlastním štítkem v textu, např. KONSTRUKCE OBJEKTU, nemá stitek)
  const dv = (text, v, spanStitku, spanHodnoty, x = {}) => ({ skryt: jeNe(v), stitek: { span: spanStitku, seg: [stitek(text)] }, hodnota: { span: spanHodnoty, seg: [hodnota(v)], ...x } });
  const str = { stred: true };
  const charakter = sekce(pas('CHARAKTER OBJEKTU', ZLUTA), [
    radekDvojic([dv('ÚČEL STAVBY', c.ucel, 3, 8), dv('PODLAŽÍ:', c.podlazi, 1, 1)]),
    radekDvojic([dv('PŮDORYS (m):', c.pudorys, 2, 1, str), { skryt: jeNe(c.konstrukce), hodnota: { span: 8, seg: [stitek('KONSTRUKCE OBJEKTU: '), hodnota(c.konstrukce)] } }, dv('ÚNIKOVÉ CESTY:', c.unikoveCesty, 1, 1, str)]),
    radekDvojic([dv('CELKOVÁ VÝŠKA (m):', c.vyska, 2, 1, str), dv('STĚNY:', c.steny, 1, 3, str), dv('PŘÍČKY:', c.priccky, 1, 3, str),
      { skryt: jeNe(c.vytahy), stitek: { seg: [stitek('VÝTAHY:')] }, hodnota: { ikony: [c.vytahE && 'V:vytahE', c.vytahP && 'V:vytahP'].filter(Boolean), seg: [hodnota(c.vytahy)] } }]),
    radekDvojic([dv('ZASTAVĚNÁ PLOCHA (m²):', c.plocha, 2, 1, str), dv('STROPY:', c.stropy, 1, 3, str), dv('STŘECHA:', c.strecha, 1, 3, str), dv('TYP ÚNIKOVÉ CESTY:', c.typUnik, 1, 1, str)]),
    radekDvojic([dv('POŽÁRNÍ ÚSEKY:', c.useky, 3, 10)]),
  ]);

  // nebezpečí: řádky s „NE“ se netisknou; karta bez jediného řádku má jeden nevyplněný (vzor má předtištěné řádky)
  const nebezpeci = d.nebezpeci.length ? d.nebezpeci.filter((n) => vidim(n.popis)) : [{ znackaId: null, popis: '', hasivo: '' }];
  const radkyNebezpeci = sekce(pas('!!! NEBEZPEČÍ !!!', CERVENA, true), [
    ...nebezpeci.map((n) => radkyZnacka(n.znackaId, [hodnota(n.popis), ...hasivo(n.hasivo)])),
    vidim(d.fve.text) ? radkyZnacka('V:fve', [hodnota(d.fve.text), ...hasivo(d.fve.hasivo)]) : null,
  ]);

  const radekMedii = (r) => { const vid = r.filter((x) => vidim(x.text)); return vid.length ? { minH: 9, bunky: vid.flatMap((x, i) => [{ zn: x.znacka }, { span: SIRKY_MEDII[vid.length][i], seg: [hodnota(x.text)], svisleStred: true }]) } : null; };
  const ktpo = vidim(d.ktpo) ? [S('KTPO', true, { odznak: true }), S('  '), hodnota(d.ktpo)] : [], oppo = vidim(d.oppo) ? [S('OPPO', true, { odznak: true }), S('  '), hodnota(d.oppo)] : [];
  const umisteni = [...ktpo, ...(ktpo.length && oppo.length ? [S('            ')] : []), ...oppo];
  const pbzText = d.pbzZadne ? [] : d.pbz.length ? d.pbz.flatMap((x, i) => [S(i ? '      ' : ''), S(`*${x.zkratka}`, true), S(x.upresneni ? ` (${x.upresneni})` : '')]) : [hodnota('')];
  const obsahPbz = [...umisteni, ...(umisteni.length && pbzText.length ? [S('\n\n')] : []), ...pbzText];
  const media = sekce(pas('UZÁVĚRY MÉDIÍ / POŽÁRNĚ BEZPEČNOSTNÍ ZAŘÍZENÍ', ZELENA), [
    radekMedii(d.uzavery), radekMedii(d.vypinace),
    obsahPbz.length ? { minH: 12, bunky: [{ seg: [S('PBZ', true, { velikost: 1.35 }), S('\n'), S('* nehodící se smaž', false, { velikost: 0.85 })], stred: true, svisleStred: true },
      { span: 12, svisleStred: true, seg: obsahPbz }] } : null,
  ]);

  const vody = d.vody.length ? d.vody.filter((v) => !v.ne) : [{ znackaId: null, text: '' }];
  const karta = { mriz: MRIZ_KARTA, radky: [
    ...charakter, ...radkyNebezpeci, ...media,
    ...sekce(pas('VODNÍ ZDROJE A HASEBNÍ LÁTKY', MODRA), vody.map((v) => radkyZnacka(v.znackaId, [hodnota(v.text)]))),
    pas('DOPORUČENÍ PRO VELITELE ZÁSAHU', ZLUTA),
  ] };

  const z = d.znalost, castiZnalosti = [z.jmeno, z.mobil, z.funkce];
  const znalost = [vidim(z.jmeno) && z.jmeno, z.mobil && vidim(z.mobil) ? `mob.: ${z.mobil}` : '', vidim(z.funkce) && z.funkce].filter(Boolean).join(', ');
  const radekZnalosti = !znalost && castiZnalosti.some(jeNe) ? [] : [S('ZNALOST O OBJEKTU MÁ:', true, { u: true }), S(' '), hodnota(znalost)];
  const dop = vidim(d.doporuceni) ? [hodnota(d.doporuceni)] : [];
  const bezNe = (v) => (vidim(v) ? v : '');
  return {
    tabulky: [hlava, karta],
    doporuceni: [...radekZnalosti, ...(radekZnalosti.length && dop.length ? [S('\n')] : []), ...dop],
    podpisy: [
      { nadpis: 'ZPRACOVAL', radky: [['JMÉNO A PŘÍJMENÍ', d.zpracoval.jmeno], ['ČÍSLO OSVĚDČENÍ', d.zpracoval.cislo], ['PODPIS', ''], ['DATUM', d.zpracoval.datum]] },
      { nadpis: 'SCHVÁLIL', radky: [['JMÉNO A PŘÍJMENÍ', bezNe(d.schvalil.jmeno)], ['FUNKCE', bezNe(d.schvalil.funkce)], ['PODPIS', ''], ['DATUM', d.schvalil.datum]] },
    ],
    revize: d.revize.length ? `Revize: ${d.revize.join('; ')}` : '',
  };
}

export const rozvrzeniListu = (list, projekt) => rozvrzeniKarty(sestavKartu(list.karta, projekt));

// Šířky buněk řádku (mm) podle mřížky; respektuje sloupce obsazené buňkami s rowspan z předchozích řádků.
export function umistiBunky(tabulka) {
  const n = tabulka.mriz.length, obsazeno = new Array(n).fill(0), x0 = [0];
  for (const w of tabulka.mriz) x0.push(x0.at(-1) + w);
  return tabulka.radky.map((r) => {
    let sl = 0;
    const bunky = r.bunky.map((b) => {
      while (sl < n && obsazeno[sl] > 0) sl++;
      const span = b.span || 1, od = sl;
      sl += span;
      if ((b.rowspan || 1) > 1) for (let i = od; i < od + span; i++) obsazeno[i] = b.rowspan;   // včetně tohoto řádku
      return { ...b, x: x0[od], w: x0[od + span] - x0[od] };
    });
    for (let i = 0; i < n; i++) if (obsazeno[i] > 0) obsazeno[i]--;
    return { ...r, bunky };
  });
}
