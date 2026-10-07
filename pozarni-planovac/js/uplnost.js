// Kontrola úplnosti DZP. Kontroluje jen to, co je doložené ve vzoru a návodu HZS SCK
// (podklady/); nevydává výstup za právně správný – to musí ověřit zpracovatel s HZS.

import { kontrolaEvak } from './evakuace.js';

const prazdne = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const vyplneno = (v) => !prazdne(v);

export const HLADINY = { CHYBA: 'chyba', UPOZORNENI: 'upozorneni' };

export function zkontrolujUplnost(projekt, katalogZnacek = null) {
  const n = [];
  const add = (hladina, kod, cesta, text) => n.push({ hladina, kod, cesta, text });
  const chyba = (kod, cesta, text) => add(HLADINY.CHYBA, kod, cesta, text);
  const upoz = (kod, cesta, text) => add(HLADINY.UPOZORNENI, kod, cesta, text);

  const ids = new Set(katalogZnacek ? katalogZnacek.map((z) => z.id) : []);

  if (!projekt.listy.length) chyba('PROJ_BEZ_LISTU', 'listy', 'Projekt nemá žádný list.');
  if (!projekt.revize.length) upoz('REVIZE_CHYBI', 'revize', 'Chybí záznam o revizi dokumentace.');
  const evak = projekt.typ === 'evakuacni_plan';
  if (!evak) upoz('LEGISLATIVA', 'projekt', 'Před vydáním ověřte DZP podle aktuální legislativy, PBŘ, skutečného stavu objektu a požadavků HZS.');
  else if (!projekt.listy.some((l) => l.typ === 'evak_text')) chyba('EVAK_BEZ_TEXTU', 'listy', 'Chybí textová část evakuačního plánu (přidejte list Evakuační plán – text).');

  for (const list of projekt.listy) {
    const p = `listy[${list.id}]`;
    if (list.typ === 'karta') kontrolaKarty(list.karta, p, chyba, upoz);
    if (list.typ === 'evak_text') kontrolaEvak(list, projekt, chyba, upoz);
    if (list.vykres) kontrolaVykresu(list, p, chyba, upoz, ids, katalogZnacek !== null, evak);
  }
  return n;
}

function kontrolaKarty(k, p, chyba, upoz) {
  const o = k.objekt;
  const povinne = [
    [k.stupenPoplachu, 'KARTA_POPLACH', 'stupenPoplachu', 'Stupeň poplachu'],
    [k.uzemniOdbor, 'KARTA_UO', 'uzemniOdbor', 'Územní odbor HZS'],
    [o.nazev, 'ID_OBJEKT', 'objekt.nazev', 'Název objektu'],
    [o.provozovatel, 'ID_PROVOZOVATEL', 'objekt.provozovatel', 'Provozovatel'],
    [o.adresa, 'ADRESA', 'objekt.adresa', 'Adresa'],
    [o.provoz.kontaktTelefon, 'KONTAKT', 'objekt.provoz.kontaktTelefon', 'Kontakt na provoz (telefon)'],
    [o.prijezdZ, 'PRIJEZD', 'objekt.prijezdZ', 'Příjezd z'],
    [o.omezeni, 'OMEZENI', 'objekt.omezeni', 'Omezení průjezdu (nebo „NE“)'],
    [k.znalostObjektu.jmeno, 'ZNALOST', 'znalostObjektu.jmeno', 'Osoba se znalostí objektu'],
    [k.zpracoval.jmeno, 'ZPRACOVAL', 'zpracoval.jmeno', 'Zpracovatel'],
    [k.zpracoval.cisloOsvedceni, 'OSVEDCENI', 'zpracoval.cisloOsvedceni', 'Číslo osvědčení zpracovatele'],
  ];
  for (const [v, kod, cesta, nazev] of povinne) if (prazdne(v)) chyba(kod, `${p}.karta.${cesta}`, `${nazev}: nevyplněno (vzor HZS: nelze-li doplnit, vepište „NE“).`);
  if (prazdne(o.gps.sirka) || prazdne(o.gps.delka)) chyba('GPS', `${p}.karta.objekt.gps`, 'Chybí GPS souřadnice objektu.');

  for (const [klic, v] of Object.entries(k.charakter)) if (prazdne(v)) upoz('CHARAKTER', `${p}.karta.charakter.${klic}`, `Charakter objektu – ${klic}: nevyplněno (nebo „NE“).`);
  for (const [klic, v] of Object.entries(k.media)) if (prazdne(v)) upoz('MEDIA', `${p}.karta.media.${klic}`, `Uzávěry a vypínače – ${klic}: nevyplněno (nebo „NE“).`);
  for (const [klic, v] of Object.entries(k.pbz)) if (prazdne(v)) upoz('PBZ', `${p}.karta.pbz.${klic}`, `Požárně bezpečnostní zařízení – ${klic}: nevyplněno (nebo „NE“).`);

  if (!k.nebezpeci.length) chyba('NEBEZPECI', `${p}.karta.nebezpeci`, 'Nebezpečí: žádná položka (bez nebezpečí uveďte „NE“).');
  for (const nb of k.nebezpeci) {
    if (prazdne(nb.popis)) chyba('NEBEZPECI_POPIS', `${p}.karta.nebezpeci[${nb.id}]`, 'Nebezpečí bez popisu.');
    else if (nb.popis.trim().toUpperCase() !== 'NE' && prazdne(nb.hasivo)) chyba('NEBEZPECI_HASIVO', `${p}.karta.nebezpeci[${nb.id}]`, `Nebezpečí „${nb.popis}“: chybí vhodné hasivo (návod HZS).`);
  }

  if (k.fve.pritomna === null) chyba('FVE_ROZHODNUTI', `${p}.karta.fve.pritomna`, 'Není uvedeno, zda je v objektu FVE (uveďte ano/ne).');
  if (k.fve.pritomna === true) {
    if (prazdne(k.fve.vykonKWp)) chyba('FVE_VYKON', `${p}.karta.fve.vykonKWp`, 'FVE: chybí výkon v kWp (návod HZS).');
    if (prazdne(k.fve.vypinacSilovaCast)) chyba('FVE_VYPINAC', `${p}.karta.fve.vypinacSilovaCast`, 'FVE: chybí umístění vypínače silové části.');
    upoz('FVE_DC', `${p}.karta.fve`, 'FVE: DC část může být zásahově relevantní i po odpojení – uveďte v doporučení veliteli.');
  }

  if (!k.vodniZdroje.length) chyba('VODA', `${p}.karta.vodniZdroje`, 'Chybí vodní zdroje (nebo „NE“).');
  for (const v of k.vodniZdroje) {
    if (v.typ === 'hydrant' && (prazdne(v.prutokLs) || !v.overenPrutok)) chyba('HYDRANT_PRUTOK', `${p}.karta.vodniZdroje[${v.id}]`, 'Vnější hydrant: chybí ověřený průtok v l/s (návod HZS).');
    if (v.typ === 'nadrz' && prazdne(v.objemM3)) chyba('NADRZ_OBJEM', `${p}.karta.vodniZdroje[${v.id}]`, 'Nádrž: chybí objem v m³.');
    if (prazdne(v.gps?.sirka) || prazdne(v.gps?.delka)) upoz('VODA_GPS', `${p}.karta.vodniZdroje[${v.id}]`, 'Vodní zdroj: chybí GPS (vzor je uvádí).');
  }

  if (prazdne(k.doporuceni)) chyba('DOPORUCENI', `${p}.karta.doporuceni`, 'Chybí doporučení pro velitele zásahu (uveďte i co se stane při vypnutí energií).');
}

function kontrolaVykresu(list, p, chyba, upoz, ids, mameKatalog, evak = false) {
  const v = list.vykres;
  if (v.pozadi && !v.pozadi.kalibrace) upoz('MERITKO', `${p}.vykres.pozadi`, `List „${list.nazev}“: měřítko podkladu není ověřeno – zkalibrujte ho podle známé délky. Délky tras jsou orientační.`);
  if (v.meritkoZdroj && !v.meritkoZdroj.overeno) upoz('MERITKO_IMPORT', `${p}.vykres.meritkoZdroj`, `List „${list.nazev}“: měřítko importovaného výkresu není ověřeno (${v.meritkoZdroj.popis}) – zkalibrujte podle známé délky.`);
  if (!evak && v.severka.uhel === null) upoz('SEVERKA', `${p}.vykres.severka`, `List „${list.nazev}“: není určena severka.`);
  if (!v.legenda.length) upoz('LEGENDA', `${p}.vykres.legenda`, `List „${list.nazev}“: chybí legenda (vložte značky do výkresu).`);
  if (!evak && !v.sit10m) upoz('SIT10', `${p}.vykres.sit10m`, `List „${list.nazev}“: je vypnutá síť 10 × 10 m (metodika ji vyžaduje pro odhad vzdáleností).`);
  if (prazdne(v.razitko.zpracoval)) upoz('RAZITKO', `${p}.vykres.razitko`, `List „${list.nazev}“: razítko bez zpracovatele.`);
  if (!v.prvky.length) upoz('VYKRES_PRAZDNY', `${p}.vykres.prvky`, `List „${list.nazev}“: výkres je prázdný.`);
  for (const pr of v.prvky) {
    if (pr.znackaId && mameKatalog && !ids.has(pr.znackaId)) chyba('ZNACKA_NEEXISTUJE', `${p}.vykres.prvky[${pr.id}]`, `Prvek odkazuje na neexistující značku ${pr.znackaId} – označeno ke kontrole.`);
    if (pr.kKontrole) upoz('PRVEK_KE_KONTROLE', `${p}.vykres.prvky[${pr.id}]`, 'Prvek je označen ke kontrole (nejednoznačné mapování starší značky).');
  }
}

export const souhrn = (nalezy) => ({
  chyby: nalezy.filter((x) => x.hladina === HLADINY.CHYBA).length,
  upozorneni: nalezy.filter((x) => x.hladina === HLADINY.UPOZORNENI).length,
});
