// Kontrola úplnosti DZP. Kontroluje jen to, co je doložené ve vzoru a návodu HZS SČK, v Zásadách HZS SČK a v metodice
// Hanuška 1996 (podklady/); nevydává výstup za právně správný – to musí ověřit zpracovatel s HZS.

import { kontrolaEvak } from './evakuace.js';
import { kontrolaGrafikyDzp } from './grafikaDzp.js';
import { vypocetSaP } from './sap.js';
import { kontrolaOp, kontrolaOpZaklad, kontrolaOpText } from './operativniplan.js';
import { EVAK_SLOTY, jeEvakZnacka, stavSlotu } from './evakznacky.js';
import { KATEGORIE, MIN_ZNACKA_MM, MIN_PISMO_MM, MIN_VELIKOST_PISMA, ID_VYCHOD, ID_SHROMAZDISTE, rozlozeniEvak, rozlozeniPokynu, rozlozeniLegendy, rozlozeniPopisu, polozkyLegendy, prehledJeZobrazen } from './kresleni/evakplan.js';
import { bboxVsech, bboxPrvku, pouziteZnacky, viditelnePrvky } from './kresleni/prvky.js';
import { udajeRazitka, prekryvaLegenda } from './kresleni/render.js';
import { KAPITALKY } from './sirkaPisma.js';
import { najdiZnacku } from './znacky.js';
import { SEKCE, POPISEK, PBZ, PBZ_UMISTENI, BEZ_NE, stavPbz } from './kartaPole.js';

const dostan = (o, cesta) => cesta.split('.').reduce((a, x) => (a == null ? a : a[x]), o);

const prazdne = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const vyplneno = (v) => !prazdne(v);

export const HLADINY = { CHYBA: 'chyba', UPOZORNENI: 'upozorneni' };

export function zkontrolujUplnost(projekt, katalogZnacek = null) {
  const n = [];
  const add = (hladina, kod, cesta, text) => n.push({ hladina, kod, cesta, text });
  const chyba = (kod, cesta, text) => add(HLADINY.CHYBA, kod, cesta, text);
  const upoz = (kod, cesta, text) => add(HLADINY.UPOZORNENI, kod, cesta, text);

  const ids = new Set(projekt.typ === 'evakuacni_plan' ? EVAK_SLOTY.map((z) => z.id) : (katalogZnacek ? katalogZnacek.map((z) => z.id) : []));

  if (!projekt.listy.length) chyba('PROJ_BEZ_LISTU', 'listy', 'Projekt nemá žádný list.');
  if (!projekt.revize.length) upoz('REVIZE_CHYBI', 'revize', 'Chybí záznam o revizi dokumentace.');
  if (projekt.vyrazeneListy?.length) upoz('VYRAZENE_LISTY', 'listy', `Při načtení byly vyřazeny listy, které do tohoto druhu dokumentace nepatří (DZP a evakuační plán se nemíchají): ${projekt.vyrazeneListy.map((l) => `${l.nazev || l.typ} (${l.typ})`).join(', ')}. Zůstávají uložené v souboru projektu.`);
  const evak = projekt.typ === 'evakuacni_plan';
  if (projekt.typ === 'operativni_plan') kontrolaOp(projekt, chyba, upoz);
  if (!evak) kontrolaGrafikyDzp(projekt, upoz);
  if (!evak) upoz('LEGISLATIVA', 'projekt', 'Před vydáním ověřte DZP podle aktuální legislativy, PBŘ, skutečného stavu objektu a požadavků HZS.');
  else if (!projekt.listy.some((l) => l.typ === 'evak_text')) chyba('EVAK_BEZ_TEXTU', 'listy', 'Chybí textová část evakuačního plánu (přidejte list Evakuační plán – text).');

  const meritkaPlanu = new Set(projekt.listy.filter((l) => l.typ === 'evak_plan').map((l) => l.vykres.meritko.pomer));
  if (evak && meritkaPlanu.size > 1) upoz('EVAK_MERITKA', 'listy', `Plány podlaží mají různá měřítka (${[...meritkaPlanu].map((x) => `1 : ${x}`).join(', ')}) – soubor plánů téhož objektu má být ve stejném měřítku (ČSN ISO 23601 – nezávazná, čl. 5).`);

  for (const list of projekt.listy) {
    const p = `listy[${list.id}]`;
    if (list.typ === 'karta') kontrolaKarty(list.karta, p, chyba, upoz);
    if (list.typ === 'evak_text') kontrolaEvak(list, projekt, chyba, upoz);
    if (list.typ === 'op_zaklad') kontrolaOpZaklad(list, chyba, upoz, projekt);
    if (list.typ === 'op_sap') kontrolaSap(list, projekt, upoz);
    if (list.typ === 'op_text') kontrolaOpText(list, chyba, upoz);
    if (list.vykres) kontrolaVykresu(list, p, chyba, upoz, ids, !evak && katalogZnacek !== null, evak, projekt.listy.find((l) => l.karta)?.karta);
    if (evak && list.vykres) kontrolaEvakZnacek(list, projekt, p, chyba, upoz);
    if (list.typ === 'evak_plan') kontrolaEvakPlanu(list, projekt, p, chyba, upoz);
  }
  return n;
}

const jeNe = (v) => typeof v === 'string' && v.trim().toUpperCase() === 'NE';
const NE_NAVOD = '(návod HZS SČK: co nelze doplnit, vepište „NE“)';

// Operativní karta podle vzoru a návodu HZS SČK: každé předpřipravené okénko je vyplněné, nebo má „NE“.
function kontrolaKarty(k, p, chyba, upoz) {
  const o = k.objekt, c = `${p}.karta`, pop = (cesta) => POPISEK[cesta] || cesta;
  const povinne = [
    ['KARTA_STANICE', 'uzemniOdbor'], ['ID_OBJEKT', 'objekt.nazev'], ['ID_PROVOZOVATEL', 'objekt.provozovatel'], ['ADRESA', 'objekt.adresa'],
    ['PRACOVNI_DOBA', 'objekt.provoz.pracovniDoba'], ['KONTAKT', 'objekt.provoz.kontaktTelefon'], ['KONTAKT_JMENO', 'objekt.provoz.kontaktJmeno'],
    ['OBSAZENI', 'objekt.obsazeniOsobami'], ['PRIJEZD', 'objekt.prijezdZ'], ['OMEZENI', 'objekt.omezeni'],
    ['ZNALOST', 'znalostObjektu.jmeno'], ['ZNALOST_MOBIL', 'znalostObjektu.mobil'], ['ZPRACOVAL', 'zpracoval.jmeno'], ['OSVEDCENI', 'zpracoval.cisloOsvedceni'],
  ];
  for (const [kod, cesta] of povinne) {
    const v = dostan(k, cesta);
    if (prazdne(v)) chyba(kod, `${c}.${cesta}`, `${pop(cesta)}: nevyplněno${BEZ_NE.has(cesta) ? '.' : ` ${NE_NAVOD}.`}`);
    else if (BEZ_NE.has(cesta) && jeNe(v)) chyba(kod, `${c}.${cesta}`, `${pop(cesta)}: „NE“ zde nelze – údaj musí být uveden${cesta.startsWith('zpracoval') ? ' (DZP smí zpracovat jen osoba podle § 11 odst. 1 nebo 2 zákona o požární ochraně – Zásady HZS SČK, kap. 1)' : ''}.`);
  }
  if (prazdne(k.stupenPoplachu)) upoz('KARTA_POPLACH', `${c}.stupenPoplachu`, 'Stupeň poplachu: doplňte podle požárního poplachového plánu kraje po konzultaci s HZS. U osamocených a dispozičně jednoduchých objektů se OK zpracovává bez stanovení stupně poplachu – pak vepište „NE“ (Zásady HZS SČK, kap. 3).');
  if (!Number.isFinite(o.gps.sirka) || !Number.isFinite(o.gps.delka)) chyba('GPS', `${c}.objekt.gps`, 'GPS souřadnice objektu nejsou vyplněné (vzor je uvádí v záhlaví karty).');

  const sekce = (id) => SEKCE.find((s) => s.id === id).pole.map((x) => x[0]);
  const vytahy = String(k.charakter.vytahy ?? '').trim();
  for (const cesta of sekce('charakter')) {
    const v = dostan(k, cesta);
    if (cesta === 'charakter.vytahEvakuacni' || cesta === 'charakter.vytahPozarni') { if (v === null && vytahy && !jeNe(vytahy)) upoz('CHARAKTER_VYTAH', `${c}.${cesta}`, `${pop(cesta)}: uveďte ano/ne (v okénku VÝTAHY se podle toho zobrazí značka).`); continue; }
    if (prazdne(v)) upoz('CHARAKTER', `${c}.${cesta}`, `Charakter objektu – ${pop(cesta)}: nevyplněno ${NE_NAVOD}.`);
  }
  for (const cesta of sekce('media')) if (prazdne(dostan(k, cesta))) upoz('MEDIA', `${c}.${cesta}`, `Uzávěry médií – ${pop(cesta)}: nevyplněno ${NE_NAVOD}.`);
  for (const [kl] of PBZ_UMISTENI) if (prazdne(k.pbz[kl])) upoz('PBZ_UMISTENI', `${c}.pbz.${kl}`, `${pop(`pbz.${kl}`)}: nevyplněno ${NE_NAVOD}.`);
  const neuvedene = PBZ.filter(([kl]) => stavPbz(k.pbz[kl]) === null);
  if (neuvedene.length) upoz('PBZ', `${c}.pbz.${neuvedene[0][0]}`, `PBZ: u zařízení ${neuvedene.map((x) => x[1]).join(', ')} není uvedeno, zda v objektu jsou (vzor: „* nehodící se smaž“).`);
  if (k.mimoVzor?.length) upoz('MIMO_VZOR', `${c}.mimoVzor`, `Karta obsahuje údaje ze starší verze, které vzor HZS SČK nemá a na kartě se netisknou (${k.mimoVzor.map((x) => x.nazev).join(', ')}). Podstatné přepište do doporučení nebo grafické části.`);

  if (!k.nebezpeci.length) chyba('NEBEZPECI', `${c}.nebezpeci`, 'Nebezpečí: žádný řádek (vzor má řádky pro hořlaviny a výbušniny; nehodí-li se, vepište „NE“).');
  for (const nb of k.nebezpeci) {
    if (prazdne(nb.popis)) chyba('NEBEZPECI_POPIS', `${c}.nebezpeci[${nb.id}]`, 'Nebezpečí: řádek bez popisu – vyplňte, nebo vepište „NE“ (předtištěné řádky vzoru HZS SČK se nemažou).');
    else if (!jeNe(nb.popis) && prazdne(nb.hasivo)) chyba('NEBEZPECI_HASIVO', `${c}.nebezpeci[${nb.id}]`, `Nebezpečí „${nb.popis}“: chybí vhodné hasivo (návod HZS SČK).`);
  }

  if (k.fve.pritomna === null) chyba('FVE_ROZHODNUTI', `${c}.fve.pritomna`, 'Není uvedeno, zda je v objektu FVE (okénko FVE vzoru – uveďte ano/ne).');
  if (k.fve.pritomna === true) {
    if (prazdne(k.fve.vykonKWp)) chyba('FVE_VYKON', `${c}.fve.vykonKWp`, 'FVE: chybí výkon v kWp (návod HZS SČK).');
    if (prazdne(k.fve.vypinacSilovaCast)) chyba('FVE_VYPINAC', `${c}.fve.vypinacSilovaCast`, 'FVE: chybí umístění vypínače silové části.');
    if (!/FVE|fotovolt|stejnosměr|\bDC\b|panel/i.test(k.doporuceni || '')) upoz('FVE_DC', `${c}.doporuceni`, 'FVE: stejnosměrná (DC) část zůstává pod napětím i po vypnutí hlavního vypínače – uveďte to v doporučení veliteli zásahu (srov. Hanuška 1996, kap. 2.2.2: prostory pod napětím i po vypnutí hlavního vypínače).');
  }

  if (!k.vodniZdroje.length) chyba('VODA', `${c}.vodniZdroje`, 'Vodní zdroje: žádná položka – uveďte zdroj vody pro hašení (nebo položku „NE“).');
  for (const v of k.vodniZdroje) {
    if (v.typ === 'hydrant' && (prazdne(v.prutokLs) || !v.overenPrutok)) chyba('HYDRANT_PRUTOK', `${c}.vodniZdroje[${v.id}]`, 'Vnější hydrant: chybí ověřený průtok v l/s (návod HZS SČK).');
    if (v.typ === 'nadrz' && prazdne(v.objemM3)) chyba('NADRZ_OBJEM', `${c}.vodniZdroje[${v.id}]`, 'Požární nádrž: chybí objem v m³.');
    if (!jeNe(v.popis) && (prazdne(v.gps?.sirka) || prazdne(v.gps?.delka))) upoz('VODA_GPS', `${c}.vodniZdroje[${v.id}]`, 'Vodní zdroj: chybí GPS (vzor ji uvádí).');
  }

  if (prazdne(k.doporuceni)) chyba('DOPORUCENI', `${c}.doporuceni`, 'Doporučení pro velitele zásahu není vyplněné (uveďte i, co se stane při vypnutí energií).');
  else if (!/vyp[ií]n|vypn|odpoj|energi|STOP|elektr|\bel\.|plyn|proud/i.test(k.doporuceni)) upoz('DOPORUCENI_ENERGIE', `${c}.doporuceni`, 'Doporučení: uveďte, co se stane při vypnutí energií (návod HZS SČK).');
  if (prazdne(k.schvalil.jmeno) || prazdne(k.schvalil.funkce)) upoz('SCHVALIL', `${c}.schvalil.jmeno`, 'Schválil: doplňte jméno a funkci (tabulka SCHVÁLIL vzoru HZS SČK).');
}

function kontrolaVykresu(list, p, chyba, upoz, ids, mameKatalog, evak = false, karta = null) {
  const v = list.vykres;
  if (v.pozadi && !v.pozadi.kalibrace) upoz('MERITKO', `${p}.vykres.pozadi`, `List „${list.nazev}“: měřítko podkladu není ověřeno – zkalibrujte ho podle známé délky. Délky tras jsou orientační.`);
  if (v.meritkoZdroj && !v.meritkoZdroj.overeno) upoz('MERITKO_IMPORT', `${p}.vykres.meritkoZdroj`, `List „${list.nazev}“: měřítko importovaného výkresu není ověřeno (${v.meritkoZdroj.popis}) – zkalibrujte podle známé délky.`);
  if (!evak && v.severka.uhel === null) upoz('SEVERKA', `${p}.vykres.severka`, `List „${list.nazev}“: není určena severka.`);
  if (!evak && !v.legendaZobrazit && v.prvky.some((x) => x.druh === 'znacka')) upoz('LEGENDA', `${p}.vykres.legenda`, `List „${list.nazev}“: legenda je vypnutá – značka, která není v příloze č. 1 metodiky, se musí uvést a popsat v legendě na tomtéž výkresu (Hanuška 1996, kap. 2.3).`);
  if (!evak && !v.sit10m) upoz('SIT10', `${p}.vykres.sit10m`, `List „${list.nazev}“: je vypnutá síť 10 × 10 m (metodika ji vyžaduje pro odhad vzdáleností).`);
  // popisové pole: prázdné údaje se tisknou z operativní karty (zpracoval, schválil) – kontroluje se to, co se vytiskne
  const raz = evak ? null : udajeRazitka(v, { karta });
  if (raz && prazdne(raz.zpracoval)) upoz('RAZITKO', `${p}.vykres.razitko`, `List „${list.nazev}“: v popisovém poli chybí zpracovatel.`);
  if (raz && prazdne(raz.schvalil)) upoz('RAZITKO_SCHVALIL', `${p}.vykres.razitko`, `List „${list.nazev}“: v popisovém poli chybí, kdo schválil – popisové pole nese razítko a podpis statutárního zástupce právnické nebo podnikající fyzické osoby (Hanuška 1996, kap. 2.3.1).`);
  const podLegendou = evak ? [] : prekryvaLegenda(v);
  if (podLegendou.length) upoz('LEGENDA_PREKRYV', `${p}.vykres.prvky[${podLegendou[0]}]`, `List „${list.nazev}“: legenda zakrývá ${podLegendou.length}× prvek výkresu – přesuňte legendu do jiného rohu (panel List) nebo posuňte výřez.`);
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

// Evakuační plán: značky mají být shodné se značkami v objektu podle ISO 7010 (ČSN ISO 23601, čl. 5). Náhradní značky z DZP a chybějící značky se hlásí.
function kontrolaEvakZnacek(list, projekt, p, chyba, upoz) {
  const pouzite = new Set(list.vykres.prvky.filter((x) => jeEvakZnacka(x.znackaId)).map((x) => x.znackaId));
  for (const id of pouzite) {
    const slot = EVAK_SLOTY.find((s) => s.id === id); if (!slot) continue;
    const st = stavSlotu(projekt, slot);
    if (st === 'nahrada') upoz('EVAK_ZNACKA_NAHRADA', `${p}.vykres.prvky`, `List „${list.nazev}“: značka „${slot.nazev}“ je náhrada z ČAHD (${slot.dzp}), ne ISO 7010 – nahrajte oficiální značku.`);
    if (st === 'chybi') chyba('EVAK_ZNACKA_CHYBI', `${p}.vykres.prvky`, `List „${list.nazev}“: značka „${slot.nazev}“ nemá obrázek – nahrajte ji.`);
  }
  if (list.vykres.prvky.some((x) => x.znackaId && !jeEvakZnacka(x.znackaId))) chyba('EVAK_ZNACKA_DZP', `${p}.vykres.prvky`, `List „${list.nazev}“: obsahuje značku DZP – do evakuačního plánu nepatří (použijte značky evakuačního plánu).`);
}

// List „Evakuační plán – podlaží“. Zákonná náležitost (§ 33 odst. 2 písm. f vyhl. 246/2001 Sb.: grafické znázornění směru
// únikových cest) je chyba; požadavky ČSN ISO 23601 (nezávazná norma, výtah v podklady/evakuace/ISO23601_pozadavky.md) jsou
// upozornění. Kontroluje se vytištěný list: co je mimo výřez, ve skryté vrstvě nebo pod přehledovým plánem, na listu není.
function kontrolaEvakPlanu(list, projekt, p, chyba, upoz) {
  const v = list.vykres, e = v.evakPlan, n = `List „${list.nazev}“`, cesta = `${p}.vykres.evakPlan`, prv = `${p}.vykres.prvky`, ISO = 'ČSN ISO 23601 – nezávazná';
  const objekt = e.objekt || projekt.listy.find((l) => l.evak)?.evak.objekt.nazev || '';
  const kat = KATEGORIE[e.kategorie] || KATEGORIE.velky;
  const L = rozlozeniEvak(v), s = 1000 / v.meritko.pomer, ram = L.ram, okno = { x0: v.okno.x, y0: v.okno.y, x1: v.okno.x + ram.w / s, y1: v.okno.y + ram.h / s };
  const bb = bboxVsech(v.prvky, v.meritko.pomer), P = L.evak.prehled;
  const pod = prehledJeZobrazen(v, L, bb) ? { x0: v.okno.x + (P.x - ram.x) / s, y0: v.okno.y + (P.y - ram.y) / s, x1: v.okno.x + (P.x + P.w - ram.x) / s, y1: v.okno.y + (P.y + P.h - ram.y) / s } : null;
  const vrstvaVidet = (x) => v.vrstvy.find((l) => l.id === x.vrstva)?.viditelna !== false;
  const vOkne = (x, y) => x >= okno.x0 && x <= okno.x1 && y >= okno.y0 && y <= okno.y1;
  const podPrehledem = (x, y) => !!pod && x >= pod.x0 && x <= pod.x1 && y >= pod.y0 && y <= pod.y1;
  const naListu = (x, y) => vOkne(x, y) && !podPrehledem(x, y);
  const znacky = v.prvky.filter((x) => x.druh === 'znacka'), videt = (x) => vrstvaVidet(x) && naListu(x.x, x.y);

  if (v.format === 'A4' && e.kategorie !== 'mistnost') upoz('EVAK_FORMAT', `${cesta}.format`, `${n}: formát A4 je podle normy jen pro plány v jednotlivých místnostech, jinak nejméně A3 (${ISO}, čl. 5).`);
  if (v.meritko.pomer > kat.limit) upoz('EVAK_MERITKO', `${cesta}.kategorie`, `${n}: měřítko 1 : ${v.meritko.pomer} je menší než nejmenší doporučené 1 : ${kat.limit} (${kat.nazev}; ${ISO}, čl. 5).`);
  const chybiUdaje = [[objekt, 'název objektu'], [e.podlazi, 'označení podlaží'], [e.zhotovitel, 'zhotovitel'], [e.datum, 'datum vyhotovení'], [e.cisloPlanu, 'číslo plánu'], [e.cisloRevize, 'číslo revize']].filter(([x]) => prazdne(x)).map(([, t]) => t);
  if (chybiUdaje.length) upoz('EVAK_POPIS', cesta, `${n}: v popisovém poli chybí ${chybiUdaje.join(', ')} (${ISO}, čl. 7.6).`);
  if (rozlozeniPopisu(L.evak.popis, e, objekt, L.evak.uzky).zkraceno) upoz('EVAK_POPIS_ZKRACENO', cesta, `${n}: údaj v popisovém poli je delší, než se vejde – na listu je zkrácený výpustkou (zkraťte ho, nebo zvětšete formát).`);
  if (!e.pokynyVedle) {
    if (prazdne(e.pokynyPozar) || prazdne(e.pokynyEvakuace)) upoz('EVAK_POKYNY', cesta, `${n}: chybí bezpečnostní pokyny pro případ ${prazdne(e.pokynyPozar) ? 'požáru' : 'evakuace'} – na listu je místo nich „DOPLNIT TEXT POKYNŮ“. Jsou-li pokyny vyvěšené vedle plánu, zaškrtněte to (${ISO}, čl. 7.4).`);
    else if (rozlozeniPokynu(L.evak.pokyny, e).preteka) upoz('EVAK_POKYNY_PRETEKA', cesta, `${n}: bezpečnostní pokyny se do rámečku nevejdou ani při nejmenším písmu (výška velkých písmen 2 mm) – konec textu na listu chybí. Zkraťte je, zvětšete formát, nebo je vyvěste vedle plánu.`);
  }
  if (!e.jsteZde) upoz('EVAK_JSTE_ZDE', cesta, `${n}: chybí bod „Jste zde“ (${ISO}, čl. 7.3).`);
  else if (!naListu(e.jsteZde.x, e.jsteZde.y)) upoz('EVAK_JSTE_ZDE_MIMO', cesta, `${n}: bod „Jste zde“ leží mimo výřez listu nebo pod přehledovým plánem – na vytištěném plánu není vidět.`);
  if (!v.legendaZobrazit) upoz('EVAK_LEGENDA', cesta, `${n}: legenda je vypnutá – plán ji má obsahovat (${ISO}, čl. 7.5).`);
  else {
    const nazev = (id) => EVAK_SLOTY.find((z) => z.id === id)?.nazev || id, Lg = rozlozeniLegendy(L.evak.legenda, polozkyLegendy(v, pouziteZnacky(viditelnePrvky(v)), nazev));
    if (Lg.skryto) upoz('EVAK_LEGENDA_PRETEKA', cesta, `${n}: do legendy se nevejde ${Lg.skryto} ${Lg.skryto === 1 ? 'položka' : Lg.skryto <= 4 ? 'položky' : 'položek'} – zvětšete formát listu nebo omezte počet druhů značek (${ISO}, čl. 7.5).`);
  }
  const vychody = znacky.filter((x) => ID_VYCHOD.includes(x.znackaId));
  if (!vychody.length) upoz('EVAK_VYCHOD', prv, `${n}: chybí značka nouzového východu (${ISO}, čl. 7.3).`);
  else if (!vychody.some(videt)) upoz('EVAK_VYCHOD_MIMO', prv, `${n}: žádný nouzový východ není na vytištěném listu vidět (mimo výřez, ve skryté vrstvě nebo pod přehledovým plánem).`);
  const shrom = znacky.filter((x) => x.znackaId === ID_SHROMAZDISTE);
  if (!shrom.length) upoz('EVAK_SHROMAZDISTE', prv, `${n}: v plánu chybí shromaždiště – v podrobném nebo v přehledovém plánu (${ISO}, čl. 5 a 7.2).`);
  else if (!shrom.some(videt) && !pod) upoz('EVAK_SHROMAZDISTE_MIMO', prv, `${n}: shromaždiště leží mimo výřez listu a přehledový plán se nezobrazuje – na plánu není vidět (zapněte přehledový plán nebo upravte výřez).`);
  // § 33 odst. 2 písm. f): na listu musí být vidět směr únikových cest
  const trasy = v.prvky.filter((x) => x.druh === 'trasa' && x.body?.length >= 2);
  if (trasy.length && !trasy.some((t) => vrstvaVidet(t) && t.body.some(([x, y]) => naListu(x, y)))) chyba('EVAK_F_TRASA_MIMO', prv, `§ 33/2/f: ${n} – únikové cesty nejsou na vytištěném listu vidět (mimo výřez, ve skryté vrstvě nebo pod přehledovým plánem).`);
  // směr šipek = směr kreslení; cesta má končit u nouzového východu nebo u dveří
  const dvere = v.prvky.filter((x) => x.druh === 'dvere').map((d) => bboxPrvku(d, v.meritko.pomer, v.prvky)).filter(Boolean).map((b) => [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2]);
  const cile = [...vychody.map((x) => [x.x, x.y]), ...dvere], dosah = Math.max(3, (15 * v.meritko.pomer) / 1000);
  const spatne = trasy.filter((t) => { const [x, y] = t.body.at(-1); return !cile.some(([a, b]) => Math.hypot(a - x, b - y) <= dosah); });
  if (cile.length && spatne.length) upoz('EVAK_TRASA_KONEC', `${prv}[${spatne[0].id}]`, `${n}: ${spatne.length === 1 ? 'úniková cesta nekončí' : `${spatne.length} únikové cesty nekončí`} u nouzového východu ani u dveří – šipky ukazují ve směru kreslení; zkontrolujte směr (případně cestu nakreslete znovu od místa k východu).`);
  if (pod) {
    const pod1 = v.prvky.filter((x) => vrstvaVidet(x) && x.druh !== 'trasa' && (() => { const b = bboxPrvku(x, v.meritko.pomer, v.prvky); return b && b.x0 < pod.x1 && b.x1 > pod.x0 && b.y0 < pod.y1 && b.y1 > pod.y0 && vOkne((b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2); })());
    const pod2 = trasy.filter((t) => vrstvaVidet(t) && t.body.some(([x, y]) => podPrehledem(x, y)));
    if (pod1.length + pod2.length) upoz('EVAK_PREHLED_PREKRYV', cesta, `${n}: přehledový plán zakrývá část výkresu (${pod1.length + pod2.length}× prvek) – posuňte výřez, přesuňte přehled do jiného rohu, nebo ho vypněte.`);
  }
  const male = znacky.filter((x) => {                                       // skutečně nakreslená značka: u nečtvercové náhrady je kratší strana menší
    const slot = EVAK_SLOTY.find((z) => z.id === x.znackaId), dzp = slot?.dzp && stavSlotu(projekt, slot) === 'nahrada' ? najdiZnacku(slot.dzp) : null;
    const pomer = dzp?.sirka && dzp?.vyska ? Math.min(dzp.sirka, dzp.vyska) / Math.max(dzp.sirka, dzp.vyska) : 1;
    return x.velikost * pomer < MIN_ZNACKA_MM;
  });
  if (male.length) upoz('EVAK_ZNACKA_VELIKOST', `${prv}[${male[0].id}]`, `${n}: ${male.length}× značka menší než ${MIN_ZNACKA_MM} mm (u nečtvercových značek se počítá kratší strana; ${ISO}, čl. 6).`);
  const drobne = v.prvky.filter((x) => x.druh === 'text' && x.vyska * KAPITALKY < MIN_PISMO_MM);
  if (drobne.length) upoz('EVAK_PISMO', `${prv}[${drobne[0].id}]`, `${n}: ${drobne.length}× text s výškou velkých písmen pod ${MIN_PISMO_MM} mm (velikost písma pod ${String(MIN_VELIKOST_PISMA).replace('.', ',')} mm; ${ISO}, čl. 6).`);
  if (!znacky.some((x) => ['EVAK-003', 'EVAK-004'].includes(x.znackaId))) upoz('EVAK_PROSTREDKY_PO', prv, `${n}: plán neukazuje žádný věcný prostředek požární ochrany pro první zásah (hasicí přístroj, hydrant) – norma požaduje jejich umístění a typ (${ISO}, čl. 7.3). Nemá-li značka obrázek, nahrajte oficiální soubor ve výběru značek.`);
  upoz('EVAK_BARVY', cesta, `${n}: barvy (bezpečnostní zelená a modrá, světle zelená cesta) jsou přibližné hodnoty sRGB – před tiskem ověřte podle ISO 3864-4 (${ISO}, čl. 7.7).`);
  upoz('EVAK_UMISTENI', cesta, `${n}: plán se pevně upevní na viditelném místě – u vstupů na podlaží, u výtahů a schodišť a na uzlech cest; je orientován podle pohledu osoby před plánem. Po každé změně objektu nebo postupů se přezkoumá (${ISO}, čl. 5, 9 a 10).`);
}

// List výpočtu SaP: nehlásí chyby (výpočet je nepovinný), jen chybějící vstupy, pokud se SaP podle základního textu provádí.
function kontrolaSap(list, projekt, upoz) {
  const provadi = projekt.listy.find((l) => l.typ === 'op_zaklad')?.opZaklad.sap.provadi;
  if (provadi === false) return;
  const { chybi } = vypocetSaP(list.opSap);
  if (chybi.length) upoz('OP_SAP_VSTUPY', `listy[${list.id}].opSap`, `Výpočet SaP „${list.nazev}“ není úplný – chybí: ${chybi.join('; ')}.`);
  upoz('OP_SAP_OVERIT', `listy[${list.id}].opSap`, 'Výpočet SaP je pomůcka podle metodiky (Hanuška 1996, část druhá); vstupy i výsledek ověřte. Doba volného rozvoje počítá s bojovým rozvinutím první jednotky (vysvětlivka a schéma str. 28–29, řešený příklad str. 60; index „Po“ ve vzorci je tisková chyba).');
}
