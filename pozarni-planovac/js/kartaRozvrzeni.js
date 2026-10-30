// Rozvržení operativní karty do okének vzoru HZS SČK (podklady/VZOR_operativni_karta_list_A4.docx, list A4 na výšku).
// Mřížky sloupců jsou převzaté z tabulek vzoru (šířky v twipech přepočtené na 190 mm). Stejné rozvržení kreslí
// náhled (js/nahled.js) i PDF (js/pdf/karta.js), takže se nerozejdou.
import { sestavKartu } from './kartaData.js';

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

// Buňka: { span, rowspan, seg, zn (samostatná značka na střed), ikony (značky před textem), fill, stred, svisleStred, minH (mm) }
export function rozvrzeniKarty(d) {
  const h = d.hlava, c = d.charakter;
  const hlava = { mriz: MRIZ_HLAVA, radky: [
    { minH: 9, bunky: [
      { span: 4, seg: [S(rozpal('OPERATIVNÍ KARTA'), true, { velikost: 1.65 })], fill: ZLUTA, stred: true, svisleStred: true },
      { rowspan: 5, fill: ZLUTA, stred: true, svisleStred: true, seg: [S('STUPEŇ POPLACHU', true, { u: true, velikost: 1.2 }), S('\n'), h.stupen ? S(h.stupen, true, { velikost: 2.2 }) : hodnota(''), S('\n\n'), S('Stanice HZS', true, { velikost: 1.2 }), S('\n'), h.stanice ? S(h.stanice, true, { velikost: 1.2 }) : hodnota('')] },
    ] },
    { bunky: [{ span: 4, seg: [stitek('OBJEKT: '), hodnota(h.objekt), S('\n'), stitek('PROVOZOVATEL: '), hodnota(h.provozovatel), S(h.ic ? `, IČ: ${h.ic}` : '')] }] },
    { bunky: [{ span: 4, seg: [stitek('ADRESA: '), hodnota(h.adresa), S('\n'), stitek('GPS: '), hodnota(h.gps)] }] },
    { bunky: [{ span: 4, seg: [stitek('PROVOZ: '), stitek('Pracovní doba: '), hodnota(h.pracovniDoba), S('\n'), stitek('Kontakt: '), hodnota(h.kontakt)] }] },
    { bunky: [{ span: 4, seg: [stitek('OBSAZENÍ OSOBAMI: '), hodnota(h.obsazeni)] }] },
    { bunky: [{ seg: [stitek('PŘÍJEZD Z:')] }, { seg: [hodnota(h.prijezd)] }, { seg: [stitek('OMEZENÍ:')] }, { span: 2, seg: [hodnota(h.omezeni)] }] },
  ] };

  const hasivo = (t) => (t ? [S('\n'), stitek('hasivo: '), S(t)] : []);
  const radkyZnacka = (zn, seg) => ({ minH: 9, bunky: [{ zn }, { span: 12, seg, svisleStred: true }] });
  const pbzText = d.pbzZadne ? [S('NE')] : d.pbz.length ? d.pbz.flatMap((x, i) => [S(i ? '      ' : ''), S(`*${x.zkratka}`, true), S(x.upresneni ? ` (${x.upresneni})` : '')]) : [hodnota('')];
  const karta = { mriz: MRIZ_KARTA, radky: [
    pas('CHARAKTER OBJEKTU', ZLUTA),
    { bunky: [{ span: 3, seg: [stitek('ÚČEL STAVBY')] }, { span: 8, seg: [hodnota(c.ucel)] }, { seg: [stitek('PODLAŽÍ:')] }, { seg: [hodnota(c.podlazi)] }] },
    { bunky: [{ span: 2, seg: [stitek('PŮDORYS (m):')] }, { seg: [hodnota(c.pudorys)], stred: true }, { span: 8, seg: [stitek('KONSTRUKCE OBJEKTU: '), hodnota(c.konstrukce)] }, { seg: [stitek('ÚNIKOVÉ CESTY:')] }, { seg: [hodnota(c.unikoveCesty)], stred: true }] },
    { bunky: [{ span: 2, seg: [stitek('CELKOVÁ VÝŠKA (m):')] }, { seg: [hodnota(c.vyska)], stred: true }, { seg: [stitek('STĚNY:')] }, { span: 3, seg: [hodnota(c.steny)], stred: true },
      { seg: [stitek('PŘÍČKY:')] }, { span: 3, seg: [hodnota(c.priccky)], stred: true }, { seg: [stitek('VÝTAHY:')] },
      { ikony: [c.vytahE && 'V:vytahE', c.vytahP && 'V:vytahP'].filter(Boolean), seg: [hodnota(c.vytahy)] }] },
    { bunky: [{ span: 2, seg: [stitek('ZASTAVĚNÁ PLOCHA (m²):')] }, { seg: [hodnota(c.plocha)], stred: true }, { seg: [stitek('STROPY:')] }, { span: 3, seg: [hodnota(c.stropy)], stred: true },
      { seg: [stitek('STŘECHA:')] }, { span: 3, seg: [hodnota(c.strecha)], stred: true }, { seg: [stitek('TYP ÚNIKOVÉ CESTY:')] }, { seg: [hodnota(c.typUnik)], stred: true }] },
    { bunky: [{ span: 3, seg: [stitek('POŽÁRNÍ ÚSEKY:')] }, { span: 10, seg: [hodnota(c.useky)] }] },
    pas('!!! NEBEZPEČÍ !!!', CERVENA, true),
    ...(d.nebezpeci.length ? d.nebezpeci : [{ znackaId: null, popis: '', hasivo: '' }]).map((n) => radkyZnacka(n.znackaId, [hodnota(n.popis), ...hasivo(n.hasivo)])),
    radkyZnacka('V:fve', [hodnota(d.fve.text), ...hasivo(d.fve.hasivo)]),
    pas('UZÁVĚRY MÉDIÍ / POŽÁRNĚ BEZPEČNOSTNÍ ZAŘÍZENÍ', ZELENA),
    ...[d.uzavery, d.vypinace].map((r) => ({ minH: 9, bunky: [{ zn: r[0].znacka }, { span: 4, seg: [hodnota(r[0].text)], svisleStred: true }, { zn: r[1].znacka }, { span: 3, seg: [hodnota(r[1].text)], svisleStred: true }, { zn: r[2].znacka }, { span: 3, seg: [hodnota(r[2].text)], svisleStred: true }] })),
    { minH: 12, bunky: [{ seg: [S('PBZ', true, { velikost: 1.35 }), S('\n'), S('* nehodící se smaž', false, { velikost: 0.85 })], stred: true, svisleStred: true },
      { span: 12, svisleStred: true, seg: [S('KTPO', true, { odznak: true }), S('  '), hodnota(d.ktpo), S('            '), S('OPPO', true, { odznak: true }), S('  '), hodnota(d.oppo), S('\n\n'), ...pbzText] }] },
    pas('VODNÍ ZDROJE A HASEBNÍ LÁTKY', MODRA),
    ...(d.vody.length ? d.vody : [{ znackaId: null, text: '' }]).map((v) => radkyZnacka(v.znackaId, [hodnota(v.text)])),
    pas('DOPORUČENÍ PRO VELITELE ZÁSAHU', ZLUTA),
  ] };

  const z = d.znalost, znalost = [z.jmeno, z.mobil ? `mob.: ${z.mobil}` : '', z.funkce].filter(Boolean).join(', ');
  return {
    tabulky: [hlava, karta],
    doporuceni: [S('ZNALOST O OBJEKTU MÁ:', true, { u: true }), S(' '), hodnota(znalost), S('\n'), hodnota(d.doporuceni)],
    podpisy: [
      { nadpis: 'ZPRACOVAL', radky: [['JMÉNO A PŘÍJMENÍ', d.zpracoval.jmeno], ['ČÍSLO OSVĚDČENÍ', d.zpracoval.cislo], ['PODPIS', ''], ['DATUM', d.zpracoval.datum]] },
      { nadpis: 'SCHVÁLIL', radky: [['JMÉNO A PŘÍJMENÍ', d.schvalil.jmeno], ['FUNKCE', d.schvalil.funkce], ['PODPIS', ''], ['DATUM', d.schvalil.datum]] },
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
