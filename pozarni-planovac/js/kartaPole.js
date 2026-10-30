// Pole operativní karty podle vzoru HZS Středočeského kraje (podklady/VZOR_operativni_karta_list_A4.docx) a návodu k vyplnění.
// Bez DOM: používá formulář (js/formular.js) i kontrola úplnosti (js/uplnost.js), aby hlášení nesla stejné popisky jako formulář.

// [cesta, popisek, typ, šířka ('S' = úzké pole), volby] – volby.ne === false: pole nesmí být „NE“ (údaj vždy existuje)
export const SEKCE = [
  { id: 'hlavicka', nazev: 'Objekt a provoz', barva: 'zluta', pole: [
    ['stupenPoplachu', 'Stupeň poplachu', 'text', 'S'], ['uzemniOdbor', 'Stanice HZS', 'text', 'S'],
    ['objekt.nazev', 'Objekt', 'text', '', { ne: false }], ['objekt.provozovatel', 'Provozovatel', 'text', '', { ne: false }], ['objekt.ic', 'IČ', 'text', 'S'],
    ['objekt.adresa', 'Adresa', 'text', '', { ne: false }],
    ['objekt.gps.sirka', 'GPS – šířka (N)', 'cislo', 'S'], ['objekt.gps.delka', 'GPS – délka (E)', 'cislo', 'S'],
    ['objekt.provoz.pracovniDoba', 'Pracovní doba', 'text'], ['objekt.provoz.kontaktJmeno', 'Kontakt – jméno a funkce', 'text'],
    ['objekt.provoz.kontaktTelefon', 'Kontakt – telefon', 'text', 'S'], ['objekt.obsazeniOsobami', 'Obsazení osobami', 'text'],
    ['objekt.prijezdZ', 'Příjezd z', 'text'], ['objekt.omezeni', 'Omezení (průjezdná výška, nosnost mostu…)', 'text'],
  ] },
  { id: 'charakter', nazev: 'Charakter objektu', barva: 'zluta', pole: [
    ['charakter.ucelStavby', 'Účel stavby', 'text'], ['charakter.podlazi', 'Podlaží', 'text', 'S'], ['charakter.pudorysM', 'Půdorys (m)', 'text', 'S'],
    ['charakter.konstrukce', 'Konstrukce objektu (hořlavá/nehořlavá)', 'text'], ['charakter.unikoveCesty', 'Únikové cesty (počet)', 'text', 'S'],
    ['charakter.celkovaVyskaM', 'Celková výška (m)', 'text', 'S'], ['charakter.steny', 'Stěny', 'text'], ['charakter.priccky', 'Příčky', 'text'],
    ['charakter.vytahy', 'Výtahy (počet, např. „1 X“)', 'text', 'S'],
    ['charakter.vytahEvakuacni', 'Výtah evakuační (značka E)', 'anone', 'S'], ['charakter.vytahPozarni', 'Výtah požární (značka P)', 'anone', 'S'],
    ['charakter.zastavenaPlochaM2', 'Zastavěná plocha (m²)', 'text', 'S'],
    ['charakter.stropy', 'Stropy', 'text'], ['charakter.strecha', 'Střecha', 'text'], ['charakter.typUnikoveCesty', 'Typ únikové cesty', 'text', 'S'],
    ['charakter.pozarniUseky', 'Požární úseky', 'text'],
  ] },
  { id: 'media', nazev: 'Uzávěry médií', barva: 'zelena', napoveda: 'Pořadí a značky podle vzoru HZS SČK. TOTAL STOP = vypnutí včetně napájení požárně bezpečnostních zařízení, CENTRAL STOP = vypnutí mimo napájení požárně bezpečnostních zařízení (značky DZP-104 a DZP-107). Co nelze doplnit, vepište „NE“.', pole: [
    ['media.hlavniUzaverPlynu', 'Hlavní uzávěr plynu – umístění', 'text'], ['media.hlavniUzaverVody', 'Hlavní uzávěr vody – umístění', 'text'],
    ['media.hlavniUzaverTopeni', 'Hlavní uzávěr topení – umístění', 'text'], ['media.hlavniVypinacEl', 'Hlavní vypínač el. proudu – umístění', 'text'],
    ['media.totalStop', 'TOTAL STOP – umístění', 'text'], ['media.centralStop', 'CENTRAL STOP – umístění', 'text'],
  ] },
  { id: 'doporuceni', nazev: 'Doporučení pro velitele zásahu', barva: 'zluta', napoveda: 'Uvádějte pouze podstatné informace (vhodné předem konzultovat s místně příslušným vedoucím pracoviště IZS a služeb ÚO HZS) a uveďte, co se stane při vypnutí energií – např. po vypnutí CENTRAL STOP / TOTAL STOP (vzor a návod HZS SČK). Textová část karty má podle metodiky obsahovat i vnitřní rozvod požární vody a zapojení nouzového osvětlení (Hanuška 1996, kap. 3.1 a) – nejsou-li zřejmé z jiných okének, uveďte je zde.', pole: [
    ['doporuceni', 'Doporučení', 'area'],
    ['znalostObjektu.jmeno', 'Znalost o objektu má – jméno', 'text'], ['znalostObjektu.mobil', 'Znalost o objektu má – mobil', 'text', 'S'],
    ['znalostObjektu.funkce', 'Znalost o objektu má – funkce (např. školník)', 'text', 'S'],
  ] },
  { id: 'podpisy', nazev: 'Zpracoval a schválil', barva: 'seda', pole: [
    ['zpracoval.jmeno', 'Zpracoval – jméno a příjmení', 'text', '', { ne: false }], ['zpracoval.cisloOsvedceni', 'Číslo osvědčení', 'text', 'S', { ne: false }], ['zpracoval.datum', 'Datum zpracování', 'datum', 'S'],
    ['schvalil.jmeno', 'Schválil – jméno a příjmení', 'text'], ['schvalil.funkce', 'Schválil – funkce', 'text'], ['schvalil.datum', 'Datum schválení', 'datum', 'S'],
  ] },
];

// Požárně bezpečnostní zařízení v pořadí vzoru („* nehodící se smaž“); názvy podle návodu HZS SČK.
export const PBZ = [
  ['eps', 'EPS', 'elektrická požární signalizace'], ['zdhpp', 'ZDHPP', 'zařízení pro detekci hořlavých plynů a par'],
  ['apz', 'APZ', 'automatické protivýbuchové zařízení'], ['zdp', 'ZDP', 'zařízení dálkového přenosu'],
  ['shz', 'SHZ', 'stabilní hasicí zařízení'], ['pshz', 'PSHZ', 'polostabilní hasicí zařízení'],
  ['zokt', 'ZOKT', 'zařízení pro odvod kouře a tepla'], ['pk', 'PK', 'požární klapky'],
];
// KTPO a OPPO mají ve vzoru vlastní okénka s umístěním.
export const PBZ_UMISTENI = [['ktpo', 'KTPO', 'klíčový trezor požární ochrany'], ['oppo', 'OPPO', 'obslužné pole požární ochrany']];

// Hodnota PBZ: '' = neuvedeno, 'NE' = v objektu není, jinak je (text = upřesnění, nebo „ANO“ bez upřesnění).
export const stavPbz = (v) => { const t = String(v ?? '').trim(); return t === '' ? null : t.toUpperCase() === 'NE' ? false : true; };
export const upresneniPbz = (v) => { const t = String(v ?? '').trim(); return t && !['ANO', 'NE'].includes(t.toUpperCase()) ? t : ''; };

export const POPISEK = Object.fromEntries([
  ...SEKCE.flatMap((s) => s.pole.map(([c, p]) => [c, p])),
  ...PBZ.map(([k, z, n]) => [`pbz.${k}`, `${z} (${n})`]),
  ...PBZ_UMISTENI.map(([k, z, n]) => [`pbz.${k}`, `${z} (${n}) – umístění`]),
]);
export const BEZ_NE = new Set(SEKCE.flatMap((s) => s.pole.filter((p) => p[4]?.ne === false).map((p) => p[0])));
