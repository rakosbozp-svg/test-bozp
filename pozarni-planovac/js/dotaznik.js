// Sběrný dotazník pro klienta (DZP): skutečný stav, uzávěry a vypínače, nebezpečné látky, FVE, ověřený průtok hydrantu, provoz
// a kontakty, organizace PO (pro SaP). Konstrukce, požární úseky a únikové cesty se čtou z PBŘ a výkresů a ověřují na místě.
// Každá otázka říká, kam se odpověď převezme (operativní karta / operativní plán / poznámka k ověření).
// Dotazník se ptá JEN na to, co v operativní kartě projektu ještě chybí (otazkyProjektu): co karta už má – z PBŘ nebo zapsané
// ručně –, se klienta neptá; na údaje jen pro operativní plán se ptá, jen když je v projektu operativní plán.
import { dostan } from './formular.js';
import { PBZ, stavPbz, upresneniPbz } from './kartaPole.js';
import { KATEGORIE } from './grafikaDzp.js';

// kam: [{ cil: 'karta'|'opText'|'opZaklad', cesta }] | [{ poznamka: true }]; zvláštní převody: special
export const OTAZKY = [
  { sekce: 'A. Objekt a provoz', id: 'nazev', text: 'Název objektu (jak se v místě běžně nazývá)', typ: 'text', kam: [{ cil: 'karta', cesta: 'objekt.nazev' }] },
  { sekce: 'A. Objekt a provoz', id: 'provozovatel', text: 'Provozovatel (název firmy)', typ: 'text', kam: [{ cil: 'karta', cesta: 'objekt.provozovatel' }] },
  { sekce: 'A. Objekt a provoz', id: 'ic', text: 'IČ provozovatele', typ: 'text', kam: [{ cil: 'karta', cesta: 'objekt.ic' }] },
  { sekce: 'A. Objekt a provoz', id: 'adresa', text: 'Adresa objektu', typ: 'text', kam: [{ cil: 'karta', cesta: 'objekt.adresa' }] },
  { sekce: 'A. Objekt a provoz', id: 'provoz', text: 'Pracovní doba a směny (např. Po–Pá 6–22, dvousměnný provoz)', typ: 'text', kam: [{ cil: 'karta', cesta: 'objekt.provoz.pracovniDoba' }] },
  { sekce: 'A. Objekt a provoz', id: 'osoby', text: 'Počet osob v objektu – běžně, maximálně a mimo pracovní dobu (zaměstnanci, návštěvníci, osoby s omezenou schopností pohybu)', typ: 'area', kam: [{ cil: 'karta', cesta: 'objekt.obsazeniOsobami' }, { cil: 'opText', cesta: 'udaje.osoby' }, { cil: 'opZaklad', cesta: 'ots.osoby' }] },
  { sekce: 'A. Objekt a provoz', id: 'kontaktJmeno', text: 'Kontakt na provoz – jméno a funkce', typ: 'text', kam: [{ cil: 'karta', cesta: 'objekt.provoz.kontaktJmeno' }] },
  { sekce: 'A. Objekt a provoz', id: 'kontaktTelefon', text: 'Kontakt na provoz – telefon', typ: 'text', kam: [{ cil: 'karta', cesta: 'objekt.provoz.kontaktTelefon' }] },
  { sekce: 'A. Objekt a provoz', id: 'znalostJmeno', text: 'Osoba se znalostí objektu dosažitelná i mimo pracovní dobu – jméno', typ: 'text', kam: [{ cil: 'karta', cesta: 'znalostObjektu.jmeno' }] },
  { sekce: 'A. Objekt a provoz', id: 'znalostMobil', text: 'Osoba se znalostí objektu – mobil', typ: 'text', kam: [{ cil: 'karta', cesta: 'znalostObjektu.mobil' }] },
  { sekce: 'B. Změny proti projektu', id: 'zmeny', text: 'Změny od kolaudace / zpracování PBŘ (přístavby, změna užívání, dispozice, technologie). Pokud žádné, napište „NE“.', typ: 'area', kam: [{ poznamka: true }] },
  { sekce: 'C. Energie, uzávěry a FVE', id: 'vypinac', text: 'Hlavní vypínač elektrického proudu – umístění (místnost, rozvaděč)', typ: 'text', kam: [{ cil: 'karta', cesta: 'media.hlavniVypinacEl' }] },
  { sekce: 'C. Energie, uzávěry a FVE', id: 'totalStop', text: 'TOTAL STOP (vypnutí včetně napájení požárně bezpečnostních zařízení) – umístění tlačítka (nebo „NE“)', typ: 'text', kam: [{ cil: 'karta', cesta: 'media.totalStop' }] },
  { sekce: 'C. Energie, uzávěry a FVE', id: 'centralStop', text: 'CENTRAL STOP (vypnutí mimo napájení požárně bezpečnostních zařízení) – umístění tlačítka (nebo „NE“)', typ: 'text', kam: [{ cil: 'karta', cesta: 'media.centralStop' }] },
  { sekce: 'C. Energie, uzávěry a FVE', id: 'podNapetim', text: 'Zůstávají některé prostory pod napětím i po vypnutí hlavního vypínače? (UPS, záložní zdroj, FVE, baterie) – kde', typ: 'area', kam: [{ cil: 'opText', cesta: 'udaje.rozvody' }, { poznamka: true }] },
  { sekce: 'C. Energie, uzávěry a FVE', id: 'plyn', text: 'Hlavní uzávěr plynu – umístění (pokud plyn není, „NE“)', typ: 'text', kam: [{ cil: 'karta', cesta: 'media.hlavniUzaverPlynu' }] },
  { sekce: 'C. Energie, uzávěry a FVE', id: 'voda', text: 'Hlavní uzávěr vody – umístění', typ: 'text', kam: [{ cil: 'karta', cesta: 'media.hlavniUzaverVody' }] },
  { sekce: 'C. Energie, uzávěry a FVE', id: 'topeni', text: 'Hlavní uzávěr topení – umístění (nebo „NE“)', typ: 'text', kam: [{ cil: 'karta', cesta: 'media.hlavniUzaverTopeni' }] },
  { sekce: 'C. Energie, uzávěry a FVE', id: 'fve', text: 'Je na objektu fotovoltaická elektrárna (FVE)?', typ: 'ano_ne', kam: [{ cil: 'karta', cesta: 'fve.pritomna' }] },
  { sekce: 'C. Energie, uzávěry a FVE', id: 'fveKwp', text: 'FVE – instalovaný výkon (kWp)', typ: 'cislo', kam: [{ cil: 'karta', cesta: 'fve.vykonKWp' }] },
  { sekce: 'C. Energie, uzávěry a FVE', id: 'fvePanely', text: 'FVE – počet panelů', typ: 'cislo', kam: [{ cil: 'karta', cesta: 'fve.pocetPanelu' }] },
  { sekce: 'C. Energie, uzávěry a FVE', id: 'fveBaterie', text: 'FVE – je instalováno bateriové úložiště?', typ: 'ano_ne', kam: [{ cil: 'karta', cesta: 'fve.baterie' }] },
  { sekce: 'C. Energie, uzávěry a FVE', id: 'fveVypinac', text: 'FVE – umístění vypínače silové části / tlačítka STOP FVE', typ: 'text', kam: [{ cil: 'karta', cesta: 'fve.vypinacSilovaCast' }] },
  { sekce: 'D. Nebezpečné látky', id: 'latky', text: 'Nebezpečné látky – název, množství a umístění (každá látka na nový řádek; pokud žádné, „NE“)', typ: 'area', kam: [{ cil: 'karta', special: 'nebezpeci' }, { cil: 'opText', cesta: 'udaje.latky' }] },
  { sekce: 'D. Nebezpečné látky', id: 'lahve', text: 'Tlakové lahve – druh plynu, počet a umístění (nebo „NE“)', typ: 'area', kam: [{ cil: 'karta', special: 'nebezpeci' }, { poznamka: true }] },
  { sekce: 'E. Požárně bezpečnostní zařízení a voda', id: 'eps', text: 'EPS – kde je ústředna (nebo „NE“)', typ: 'text', kam: [{ cil: 'karta', cesta: 'pbz.eps' }] },
  { sekce: 'E. Požárně bezpečnostní zařízení a voda', id: 'pco', text: 'Je EPS připojena na pult centralizované ochrany (PCO) HZS? Kam je signál vyveden?', typ: 'text', kam: [{ cil: 'karta', cesta: 'pbz.zdp' }] },
  { sekce: 'E. Požárně bezpečnostní zařízení a voda', id: 'ktpo', text: 'Klíčový trezor požární ochrany (KTPO) – umístění (nebo „NE“)', typ: 'text', kam: [{ cil: 'karta', cesta: 'pbz.ktpo' }] },
  { sekce: 'E. Požárně bezpečnostní zařízení a voda', id: 'oppo', text: 'Obslužné pole požární ochrany (OPPO) – umístění (nebo „NE“)', typ: 'text', kam: [{ cil: 'karta', cesta: 'pbz.oppo' }] },
  { sekce: 'E. Požárně bezpečnostní zařízení a voda', id: 'pbzJine', text: 'Další požárně bezpečnostní zařízení (autonomní hlásiče kouře, SHZ, odvod kouře a tepla, požární klapky, evakuační výtah…) a kde se ovládají', typ: 'area', kam: [{ cil: 'opText', cesta: 'udaje.pbz' }, { poznamka: true }] },
  { sekce: 'E. Požárně bezpečnostní zařízení a voda', id: 'hydrant', text: 'Vnější hydrant – umístění (nejbližší k objektu)', typ: 'text', kam: [{ cil: 'karta', special: 'hydrant' }] },
  { sekce: 'E. Požárně bezpečnostní zařízení a voda', id: 'hydrantPrutok', text: 'Vnější hydrant – průtok podle poslední zkoušky (l/s)', typ: 'cislo', kam: [{ cil: 'karta', special: 'hydrant' }] },
  { sekce: 'E. Požárně bezpečnostní zařízení a voda', id: 'hydrantOveren', text: 'Byl průtok hydrantu ověřen měřením (protokol o zkoušce)?', typ: 'ano_ne', kam: [{ cil: 'karta', special: 'hydrant' }] },
  { sekce: 'E. Požárně bezpečnostní zařízení a voda', id: 'vodaJina', text: 'Jiné zdroje vody pro hašení (požární nádrž – objem, rybník, vodní tok) nebo „NE“', typ: 'area', kam: [{ cil: 'opText', cesta: 'voda.zdroje' }, { poznamka: true }] },
  { sekce: 'F. Organizace požární ochrany', id: 'zjisteni', text: 'Jak a za jak dlouho bude požár zjištěn mimo pracovní dobu? (ostraha, EPS, kamerový systém, odhad v minutách)', typ: 'text', kam: [{ cil: 'opZaklad', cesta: 'ots.dobaZpozorovani' }] },
  { sekce: 'F. Organizace požární ochrany', id: 'ohlasovna', text: 'Kdo a odkud ohlašuje požár (ohlašovna požárů)?', typ: 'text', kam: [{ cil: 'opZaklad', cesta: 'ots.signalizace' }] },
  { sekce: 'F. Organizace požární ochrany', id: 'jednotka', text: 'Má podnik vlastní jednotku požární ochrany? (početní stav, technika) – nebo „NE“', typ: 'text', kam: [{ cil: 'opZaklad', cesta: 'ots.jednotkaPodniku' }] },
  { sekce: 'G. Zásah a příjezd', id: 'prijezd', text: 'Příjezd a vstup do areálu (brána, závora, kde jsou klíče, omezení výšky/nosnosti)', typ: 'area', kam: [{ cil: 'karta', cesta: 'objekt.omezeni' }, { cil: 'opText', cesta: 'komunikace.pokyny' }] },
  { sekce: 'G. Zásah a příjezd', id: 'nebezpeciHasici', text: 'Místa nebezpečná pro hasiče (rozvodny, laboratoře, prostory s nebezpečím výbuchu, kde nelze hasit vodou)', typ: 'area', kam: [{ cil: 'opText', cesta: 'udaje.slozite' }, { poznamka: true }] },
  { sekce: 'G. Zásah a příjezd', id: 'shromazdiste', text: 'Kde se shromažďují evakuované osoby?', typ: 'text', kam: [{ poznamka: true }] },
];
export const SEKCE = [...new Set(OTAZKY.map((o) => o.sekce))];
export const prazdnyDotaznik = () => ({ odpovedi: {}, nacteno: '' });

const nic = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const jeNe = (v) => typeof v === 'string' && v.trim().toUpperCase() === 'NE';
const tx = (v) => (nic(v) ? '' : String(v).trim());

// ---------- Na co se ptát: jen na to, co v kartě chybí ----------
export const cileDotazniku = (p) => ({ karta: p.listy.find((l) => l.typ === 'karta')?.karta, opText: p.listy.find((l) => l.typ === 'op_text')?.opText, opZaklad: p.listy.find((l) => l.typ === 'op_zaklad')?.opZaklad, projekt: p });
// Další PBZ (otázka pbzJine) – EPS a ZDP mají vlastní otázky; názvy srozumitelné pro klienta.
const PBZ_DALSI = PBZ.filter(([kl]) => kl !== 'eps' && kl !== 'zdp').map(([kl, z, n]) => [kl, z, kl === 'adsp' ? 'autonomní hlásiče kouře' : n]);
// Zkrácení dlouhého textu: na konci věty (slovo z 5+ znaků, tečka, velké písmeno – ne za zkratkou „max.“, „např.“), jinak na hranici slova.
const zkrat = (t, n = 100) => { const s = tx(t).replace(/\s+/g, ' '); if (s.length <= n) return s; const v = /^(.{20,}?[\p{L}\d]{5,})\.\s+(?=\p{Lu})/u.exec(s.slice(0, n + 2)); return v ? v[1] : `${s.slice(0, n).replace(/\s+\S*$/u, '')}…`; };
// Hydrant pro klienta: bez poznámek zpracovatele („(dle PBŘ)“, text za pomlčkou).
const nazevHydrantu = (popis) => { const t = tx(popis).replace(/\s*\((?:dle|podle) (?:PBŘ|dokumentace|projektu)\)/giu, ''), i = t.indexOf(' – '); return zkrat(i >= 15 ? t.slice(0, i) : t); };
const NEBEZPECI_VZORU = { 'DZP-003': 'hořlaviny', 'DZP-053': 'výbušniny' };   // předtištěné řádky vzoru HZS SČK
const hodnotaKarty = (cesta, v) => (cesta.startsWith('pbz.') && PBZ.some(([kl]) => `pbz.${kl}` === cesta) ? (stavPbz(v) === false ? 'není' : upresneniPbz(v) || 'je') : v === true ? 'ano' : v === false ? 'ne' : typeof v === 'number' ? String(v).replace('.', ',') : zkrat(v, 80));
const realneVody = (k) => k.vodniZdroje.filter((v) => !nic(v.popis) && !jeNe(v.popis));
const hydrantyKarty = (k) => realneVody(k).filter((v) => v.typ === 'hydrant');
// Hydrant, na jehož průtok se dotazník ptá jmenovitě: první hydrant karty bez ověřeného průtoku (návod HZS SČK: ověřený průtok v l/s).
export const hydrantKDotazu = (k) => hydrantyKarty(k).find((h) => nic(h.prutokLs) || h.overenPrutok !== true) ?? null;
const vodaNe = (k) => k.vodniZdroje.some((v) => jeNe(v.popis));   // položka „NE“ (návod: nelze-li doplnit, „NE“)
// Výtahy: evakuační / požární se zjišťuje, jen když okénko VÝTAHY není „NE“ a karta to ještě neuvádí.
const vytahZjistit = (k) => !jeNe(k.charakter.vytahy) && (k.charakter.vytahEvakuacni === null || k.charakter.vytahPozarni === null);
const dalsiChybi = (k) => [...PBZ_DALSI.filter(([kl]) => stavPbz(k.pbz[kl]) === null).map(([, z, n]) => `${n} (${z})`), ...(vytahZjistit(k) ? ['evakuační nebo požární výtah'] : [])];

const vKarte = (hodnota) => ({ stav: 'vyplneno', kde: 'v kartě', hodnota });
const obecne = (k, q) => {   // pole karty podle cesty: vyplněno je i „NE“ a ano/ne
  const pole = q.kam.filter((x) => x.cil === 'karta' && x.cesta);
  return pole.length && pole.every((x) => !nic(dostan(k, x.cesta))) ? vKarte(pole.map((x) => hodnotaKarty(x.cesta, dostan(k, x.cesta))).join('; ')) : null;
};
const fveDetail = (k, q) => (k.fve.pritomna === false ? { stav: 'netyka', duvod: 'FVE v objektu není (karta)' } : obecne(k, q));
const nebezpeci = (k) => (k.nebezpeci.length && k.nebezpeci.every((x) => !nic(x.popis)) ? vKarte(k.nebezpeci.map((x) => `${NEBEZPECI_VZORU[x.znackaId] ? `${NEBEZPECI_VZORU[x.znackaId]}: ` : ''}${zkrat(x.popis, 60)}`).join('; ')) : null);
const prutok = (k) => {
  const h = hydrantyKarty(k);
  if (!h.length) return vodaNe(k) ? vKarte('vodní zdroj „NE“') : null;
  return hydrantKDotazu(k) ? null : vKarte(h.map((x) => `${zkrat(x.popis, 50)} – ${String(x.prutokLs).replace('.', ',')} l/s, ověřeno`).join('; '));
};
// Jak karta odpovídá na otázku: null = v kartě chybí (zeptat se), jinak { stav: 'vyplneno' | 'netyka', … }.
const KARTA = {
  fveKwp: fveDetail, fvePanely: fveDetail, fveBaterie: fveDetail, fveVypinac: fveDetail,
  pco: (k, q) => (stavPbz(k.pbz.eps) === false && nic(k.pbz.zdp) ? { stav: 'netyka', duvod: 'EPS v objektu není (karta)' } : obecne(k, q)),
  latky: nebezpeci, lahve: nebezpeci,
  hydrant: (k) => (hydrantyKarty(k).length ? vKarte(hydrantyKarty(k).map((x) => zkrat(x.popis, 60)).join('; ')) : vodaNe(k) ? vKarte('vodní zdroj „NE“') : null),
  hydrantPrutok: prutok, hydrantOveren: prutok,
  pbzJine: (k) => (dalsiChybi(k).length ? null : vKarte('všechna PBZ jsou v kartě uvedena (je / není)')),
  vodaJina: (k) => { const j = realneVody(k).filter((v) => v.typ !== 'hydrant'); return j.length ? vKarte(j.map((x) => zkrat(x.popis, 60)).join('; ')) : vodaNe(k) ? vKarte('vodní zdroj „NE“') : null; },
  shromazdiste: (k, q, c) => (c.projekt.listy.some((l) => l.vykres?.prvky?.some((x) => x.druh === 'znacka' && KATEGORIE.evakuace.has(x.znackaId))) ? { stav: 'vyplneno', kde: 've výkresu', hodnota: 'značka místa soustředění evakuovaných (DZP-042)' } : null),
};
// Text otázky podle karty: u dalších PBZ jen zařízení, která karta neuvádí; u průtoku jmenovitě hydrant z karty.
function textOtazky(q, c) {
  const k = c.karta; if (!k) return q.text;
  if (q.id === 'pbzJine') { const d = dalsiChybi(k); return d.length ? `Jsou v objektu tato požárně bezpečnostní zařízení: ${d.join(', ')}? U každého uveďte ano / ne, u „ano“ i kde se ovládá. Není-li žádné, napište „NE“.` : q.text; }
  const h = (q.id === 'hydrantPrutok' || q.id === 'hydrantOveren') && hydrantKDotazu(k);
  if (h) return q.id === 'hydrantPrutok' ? `Vnější hydrant „${nazevHydrantu(h.popis)}“ – průtok podle poslední zkoušky (l/s)` : `Vnější hydrant „${nazevHydrantu(h.popis)}“ – byl průtok ověřen měřením (protokol o zkoušce)?`;
  return q.text;
}
function stavOtazky(q, c) {
  const k = c.karta, h = KARTA[q.id];
  if (k && (h || q.kam.some((x) => x.cil === 'karta'))) return (h ? h(k, q, c) : obecne(k, q)) ?? { stav: 'ptat' };   // o kartě rozhoduje karta
  const pole = q.kam.filter((x) => x.cesta && x.cil !== 'karta' && c[x.cil]);
  if (pole.length) return pole.every((x) => !nic(dostan(c[x.cil], x.cesta))) ? { stav: 'vyplneno', kde: 'v operativním plánu', hodnota: pole.map((x) => zkrat(dostan(c[x.cil], x.cesta), 80)).join('; ') } : { stav: 'ptat' };
  if (q.kam.some((x) => x.poznamka || x.cil === 'karta')) return { stav: 'ptat' };   // poznámka k ověření; projekt bez karty se ptá na údaje karty jako dřív
  return { stav: 'netyka', duvod: 'údaj pro operativní plán – projekt ho nemá' };
}
// Všechny otázky s textem a stavem pro projekt: stav 'ptat' (zeptat se klienta), 'vyplneno' (údaj už je – kde, hodnota),
// 'netyka' (v projektu se nepoužije – duvod).
export function otazkyProjektu(projekt) {
  const c = cileDotazniku(projekt);
  return OTAZKY.map((q) => ({ ...q, text: textOtazky(q, c), ...stavOtazky(q, c) }));
}
export const otazkyKDotazu = (projekt) => otazkyProjektu(projekt).filter((q) => q.stav === 'ptat');
// Oddíly s otázkami k dotazu, písmena popořadě (vynechaný oddíl nenechá v PDF pro klienta mezeru A, B, C, E…).
export const oddily = (otazky) => SEKCE.map((s) => [s, otazky.filter((q) => q.sekce === s)]).filter(([, qs]) => qs.length).map(([s, qs], i) => [`${String.fromCharCode(65 + i)}. ${s.replace(/^[A-Z]\.\s*/, '')}`, qs]);
// Číslo z odpovědi klienta: „49,5 kWp“, „1 200 ks“, „cca 8 l/s“ → číslo. Odpověď s více čísly („4–6 l/s“, „6,5 l/s (zkouška 2024)“)
// je nejednoznačná → null (zpracovatel ji přepíše ručně, nic se nedomýšlí).
export function cisloZOdpovedi(text) {
  const t = String(text ?? '').trim();
  const cisla = [...t.matchAll(/[-+]?\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d+)?|[-+]?\d+(?:[.,]\d+)?/g)];
  if (cisla.length !== 1) return null;
  const n = Number(cisla[0][0].replace(/[ \u00a0\u202f]/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}
export const textOdpovedi = (o, v) => (o.typ === 'ano_ne' ? (v === true ? 'ano' : v === false ? 'ne' : '') : o.typ === 'cislo' ? (nic(v) ? '' : String(v).replace('.', ',')) : tx(v));

// Návrh převzetí odpovědí do projektu (stejný formát jako js/prebirani.js → pouzijNavrh). cile = { karta, opText, opZaklad, projekt }.
export function navrhZDotazniku(odp, cile) {
  const o = [];
  const st = (data, cesta) => { const v = dostan(data, cesta); return nic(v) ? null : String(v); };
  for (const q of OTAZKY) {
    const v = odp[q.id]; if (nic(v)) continue;
    for (const k of q.kam) {
      if (k.special || k.poznamka) continue;
      const data = cile[k.cil]; if (!data) continue;
      const hodnota = q.typ === 'ano_ne' || q.typ === 'cislo' ? v : tx(v), s = st(data, k.cesta);
      if (s !== null && s === String(hodnota)) continue;
      o.push({ cil: k.cil, cesta: k.cesta, popis: `${q.text} → ${{ karta: 'karta', opText: 'OP – příloha', opZaklad: 'OP – základní text' }[k.cil]}`, hodnota, stavajici: s });
    }
  }
  if (cile.karta) {
    const k = cile.karta, radky = ['latky', 'lahve'].flatMap((id) => tx(odp[id]).split('\n').map((r) => r.trim()).filter((r) => r && r.toUpperCase() !== 'NE'));
    const neVse = ['latky', 'lahve'].some((id) => tx(odp[id]).toUpperCase() === 'NE') && !radky.length;
    if (neVse && !k.nebezpeci.some((x) => !nic(x.popis))) o.push({ cil: 'karta', pridat: 'nebezpeci', popis: 'Nebezpečí do karty: „NE“ (žádné nebezpečné látky)', hodnota: { popis: 'NE', hasivo: '', znackaId: null }, stavajici: null });
    for (const r of radky) if (!k.nebezpeci.some((x) => tx(x.popis).toLowerCase() === r.toLowerCase())) o.push({ cil: 'karta', pridat: 'nebezpeci', popis: 'Nebezpečí do karty (hasivo doplníte)', hodnota: { popis: r, hasivo: '', znackaId: null }, stavajici: null });
    // skutečné látky vs. dřívější „NE“ (např. z PBŘ) – „NE“ se nabídne k odebrání, jinak by karta říkala obojí
    const ne = k.nebezpeci.find((x) => tx(x.popis).toUpperCase() === 'NE' && !x.znackaId);   // „NE“ v předtištěném řádku vzoru (se značkou) platí jen pro tu kategorii
    if (radky.length && ne) o.push({ cil: 'karta', odebrat: { kolekce: 'nebezpeci', id: ne.id }, popis: 'Nebezpečí v kartě: odebrat dřívější „NE“ (klient uvádí látky)', hodnota: 'odebere položku „NE“', stavajici: null });
    // „NE“ u dalších PBZ: dotazník vyjmenoval jen zařízení, která karta neuvádí → u nich „není“ (výtahy ne)
    if (tx(odp.pbzJine).toUpperCase() === 'NE') {
      for (const [kl, z, n] of PBZ_DALSI) if (stavPbz(k.pbz[kl]) === null) o.push({ cil: 'karta', cesta: `pbz.${kl}`, popis: `${z} (${n}) – podle klienta v objektu není`, hodnota: 'NE', stavajici: null });
      if (vytahZjistit(k)) for (const [kl, n] of [['vytahEvakuacni', 'Výtah evakuační'], ['vytahPozarni', 'Výtah požární']]) if (k.charakter[kl] === null) o.push({ cil: 'karta', cesta: `charakter.${kl}`, popis: `${n} – podle klienta v objektu není`, hodnota: false, stavajici: null });
    }
    const prutok = nic(odp.hydrantPrutok) || !Number.isFinite(Number(odp.hydrantPrutok)) ? null : Number(odp.hydrantPrutok), overen = odp.hydrantOveren === true && prutok !== null;   // ověřený je jen průtok, který známe
    const hydranty = k.vodniZdroje.filter((x) => x.typ === 'hydrant');
    const stejny = !nic(odp.hydrant) && hydranty.find((x) => tx(x.popis).toLowerCase() === tx(odp.hydrant).toLowerCase());
    const doplnPrutok = (h, upresneni, neoznacit) => {   // průtok a ověření k hydrantu, který už v kartě je
      if (prutok !== null && h.prutokLs !== prutok) o.push({ cil: 'karta', polozka: { kolekce: 'vodniZdroje', id: h.id, pole: 'prutokLs' }, popis: `Průtok hydrantu „${tx(h.popis).slice(0, 60)}“ (l/s)${upresneni}`, hodnota: prutok, stavajici: h.prutokLs == null ? null : String(h.prutokLs), neoznacit });
      if (overen && h.overenPrutok !== true) o.push({ cil: 'karta', polozka: { kolekce: 'vodniZdroje', id: h.id, pole: 'overenPrutok' }, popis: `Průtok hydrantu „${tx(h.popis).slice(0, 60)}“ je ověřený zkouškou${upresneni}`, hodnota: true, stavajici: null, neoznacit });
    };
    const jmenovite = hydrantKDotazu(k);   // poloha je v kartě – dotazník se ptal na průtok tohoto hydrantu jmenovitě
    if (stejny) doplnPrutok(stejny, '', false);
    else if (nic(odp.hydrant) && jmenovite) doplnPrutok(jmenovite, '', false);
    else if (!nic(odp.hydrant)) {
      o.push({ cil: 'karta', pridat: 'vodniZdroje', popis: 'Vnější hydrant do karty', stavajici: null,
        hodnota: { typ: 'hydrant', popis: tx(odp.hydrant), prutokLs: prutok, overenPrutok: overen, objemM3: null, gps: { sirka: null, delka: null }, znackaId: null } });
    } else if (hydranty.length === 1) doplnPrutok(hydranty[0], ' – klient neuvedl polohu, jediný hydrant v kartě: ověřte, že jde o něj', true);
  }
  if (cile.projekt) {
    for (const q of OTAZKY.filter((x) => x.kam.some((k) => k.poznamka))) {
      const v = tx(odp[q.id]); if (!v || v.toUpperCase() === 'NE') continue;
      if (cile.projekt.poznamkyKOvereni.some((p) => p.tema === `Dotazník: ${q.text}` && p.text === v)) continue;
      o.push({ cil: 'projekt', pridat: 'poznamkyKOvereni', popis: `Poznámka k ověření: ${q.text}`, hodnota: { tema: `Dotazník: ${q.text}`, text: v, stav: 'k ověření' }, stavajici: null });
    }
  }
  return o;
}

// otazky: jen otázky, na které se dotazník ptá (otazkyKDotazu); výchozí všechny.
export function dotaznikJakoText(d, nazevObjektu = '', otazky = OTAZKY) {
  const o = [`DOTAZNÍK PRO ZPRACOVÁNÍ DZP${nazevObjektu ? ` – ${nazevObjektu}` : ''}`, ''];
  for (const [s, qs] of oddily(otazky)) { o.push(s.toUpperCase()); for (const q of qs) o.push(`${q.text}: ${textOdpovedi(q, d.odpovedi[q.id]) || '…'}`); o.push(''); }
  return o.join('\n');
}
