// Kontrola úplnosti DZP. Kontroluje jen to, co je doložené ve vzoru a návodu HZS SČK, v Zásadách HZS SČK a v metodice
// Hanuška 1996 (podklady/); nevydává výstup za právně správný – to musí ověřit zpracovatel s HZS.

import { kontrolaEvak } from './evakuace.js';
import { kontrolaGrafikyDzp } from './grafikaDzp.js';
import { vypocetSaP } from './sap.js';
import { kontrolaOp, kontrolaOpZaklad, kontrolaOpText } from './operativniplan.js';
import { EVAK_SLOTY, jeEvakZnacka, stavSlotu } from './evakznacky.js';
import { KATEGORIE, MIN_ZNACKA_MM, ID_VYCHOD, ID_SHROMAZDISTE } from './kresleni/evakplan.js';
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
  const evak = projekt.typ === 'evakuacni_plan';
  if (projekt.typ === 'operativni_plan') kontrolaOp(projekt, chyba, upoz);
  if (!evak) kontrolaGrafikyDzp(projekt, upoz);
  if (!evak) upoz('LEGISLATIVA', 'projekt', 'Před vydáním ověřte DZP podle aktuální legislativy, PBŘ, skutečného stavu objektu a požadavků HZS.');
  else if (!projekt.listy.some((l) => l.typ === 'evak_text')) chyba('EVAK_BEZ_TEXTU', 'listy', 'Chybí textová část evakuačního plánu (přidejte list Evakuační plán – text).');

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
  if (!v.legenda.length) upoz('LEGENDA', `${p}.vykres.legenda`, `List „${list.nazev}“: chybí legenda (vložte značky do výkresu).`);
  if (!evak && !v.sit10m) upoz('SIT10', `${p}.vykres.sit10m`, `List „${list.nazev}“: je vypnutá síť 10 × 10 m (metodika ji vyžaduje pro odhad vzdáleností).`);
  // popisové pole: prázdné údaje se tisknou z operativní karty (zpracoval, schválil)
  if (!evak && prazdne(v.razitko.zpracoval) && prazdne(karta?.zpracoval.jmeno)) upoz('RAZITKO', `${p}.vykres.razitko`, `List „${list.nazev}“: v popisovém poli chybí zpracovatel.`);
  if (!evak && prazdne(v.razitko.schvalil) && prazdne(karta?.schvalil.jmeno)) upoz('RAZITKO_SCHVALIL', `${p}.vykres.razitko`, `List „${list.nazev}“: v popisovém poli chybí, kdo schválil – popisové pole nese razítko a podpis statutárního zástupce právnické nebo podnikající fyzické osoby (Hanuška 1996, kap. 2.3.1).`);
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

// Evakuační plán: značky musí být v souladu s ISO 7010 (ČSN ISO 23601, čl. 5 k). Náhradní značky z DZP a chybějící značky se hlásí.
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

// List „Evakuační plán – podlaží“: požadavky ČSN ISO 23601 (nezávazná; výtah v podklady/evakuace/ISO23601_pozadavky.md).
function kontrolaEvakPlanu(list, projekt, p, chyba, upoz) {
  const v = list.vykres, e = v.evakPlan, n = `List „${list.nazev}“`, cesta = `${p}.vykres.evakPlan`;
  const objekt = e.objekt || projekt.listy.find((l) => l.evak)?.evak.objekt.nazev || '';
  const kat = KATEGORIE[e.kategorie] || KATEGORIE.velky;
  if (v.format === 'A4' && e.kategorie !== 'mistnost') chyba('EVAK_FORMAT', `${cesta}.format`, `${n}: formát A4 je podle normy jen pro plány v jednotlivých místnostech, jinak min. A3.`);
  if (v.meritko.pomer > kat.limit) chyba('EVAK_MERITKO', `${cesta}.kategorie`, `${n}: měřítko 1 : ${v.meritko.pomer} je menší než nejmenší povolené 1 : ${kat.limit} (${kat.nazev}).`);
  const povinne = [[objekt, 'EVAK_OBJEKT', 'Název objektu'], [e.podlazi, 'EVAK_PODLAZI', 'Označení podlaží'], [e.zhotovitel, 'EVAK_ZHOTOVITEL', 'Zhotovitel plánu'],
    [e.datum, 'EVAK_DATUM', 'Datum vyhotovení'], [e.cisloPlanu, 'EVAK_CISLO_PLANU', 'Číslo plánu'], [e.cisloRevize, 'EVAK_REVIZE', 'Číslo revize']];
  for (const [val, kod, nazev] of povinne) if (prazdne(val)) chyba(kod, cesta, `${n}: chybí údaj „${nazev}“ (ČSN ISO 23601, čl. 7.6).`);
  if (prazdne(e.pokynyPozar)) chyba('EVAK_POKYNY_POZAR', cesta, `${n}: chybí bezpečnostní pokyny pro případ požáru (čl. 7.4).`);
  if (prazdne(e.pokynyEvakuace)) chyba('EVAK_POKYNY_EVAK', cesta, `${n}: chybí bezpečnostní pokyny pro evakuaci (čl. 7.4).`);
  if (!e.jsteZde) chyba('EVAK_JSTE_ZDE', cesta, `${n}: chybí bod „Jste zde“ (čl. 5 a).`);
  if (!v.legendaZobrazit) chyba('EVAK_LEGENDA', cesta, `${n}: legenda je vypnutá – plán ji musí obsahovat (čl. 7.5).`);
  const znacky = v.prvky.filter((x) => x.druh === 'znacka');
  if (!znacky.some((x) => ID_VYCHOD.includes(x.znackaId))) chyba('EVAK_VYCHOD', `${p}.vykres.prvky`, `${n}: chybí nouzový východ (čl. 7.3 b).`);
  if (!znacky.some((x) => x.znackaId === ID_SHROMAZDISTE)) chyba('EVAK_SHROMAZDISTE', `${p}.vykres.prvky`, `${n}: chybí shromaždiště v plánu (čl. 5 n, 7.2 a).`);
  const male = znacky.filter((x) => x.velikost < MIN_ZNACKA_MM);
  if (male.length) chyba('EVAK_ZNACKA_VELIKOST', `${p}.vykres.prvky[${male[0].id}]`, `${n}: ${male.length}× značka menší než ${MIN_ZNACKA_MM} mm (čl. 6 c).`);
  upoz('EVAK_BARVY', cesta, `${n}: barvy (bezpečnostní zelená a modrá, světle zelená cesta) jsou přibližné hodnoty sRGB – před tiskem ověřte podle ISO 3864-4.`);
  upoz('EVAK_UMISTENI', cesta, `${n}: plán musí být pevně upevněn u vstupů na podlaží, výtahů a schodišť; orientace plánu odpovídá pohledu osoby před plánem (čl. 5 j, 9). Při změně objektu plán přezkoumejte (čl. 10).`);
}

// List výpočtu SaP: nehlásí chyby (výpočet je nepovinný), jen chybějící vstupy, pokud se SaP podle základního textu provádí.
function kontrolaSap(list, projekt, upoz) {
  const provadi = projekt.listy.find((l) => l.typ === 'op_zaklad')?.opZaklad.sap.provadi;
  if (provadi === false) return;
  const { chybi } = vypocetSaP(list.opSap);
  if (chybi.length) upoz('OP_SAP_VSTUPY', `listy[${list.id}].opSap`, `Výpočet SaP „${list.nazev}“ není úplný – chybí: ${chybi.join('; ')}.`);
  upoz('OP_SAP_OVERIT', `listy[${list.id}].opSap`, 'Výpočet SaP je pomůcka podle metodiky (Hanuška 1996, část druhá); vstupy i výsledek ověřte. Doba volného rozvoje počítá s bojovým rozvinutím první jednotky (vysvětlivka a schéma str. 28–29, řešený příklad str. 60; index „Po“ ve vzorci je tisková chyba).');
}
