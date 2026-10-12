// Sběrný dotazník pro klienta (DZP). Ptá se jen na to, co v PBŘ a výkresech zpravidla není nebo se mohlo změnit:
// skutečný stav, uzávěry a vypínače, nebezpečné látky, FVE, ověřený průtok hydrantu, provoz a kontakty, organizace PO (pro SaP).
// Ostatní (konstrukce, požární úseky, únikové cesty, PBZ dle projektu) se čte z PBŘ a výkresů a ověřuje na místě.
// Každá otázka říká, kam se odpověď převezme (operativní karta / operativní plán / poznámka k ověření).
import { dostan } from './formular.js';

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
  { sekce: 'E. Požárně bezpečnostní zařízení a voda', id: 'pbzJine', text: 'Další požárně bezpečnostní zařízení (SHZ, odvod kouře a tepla, požární klapky, evakuační výtah…) a kde se ovládají', typ: 'area', kam: [{ cil: 'opText', cesta: 'udaje.pbz' }, { poznamka: true }] },
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
const tx = (v) => (nic(v) ? '' : String(v).trim());
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
    if (neVse && !k.nebezpeci.length) o.push({ cil: 'karta', pridat: 'nebezpeci', popis: 'Nebezpečí do karty: „NE“ (žádné nebezpečné látky)', hodnota: { popis: 'NE', hasivo: '', znackaId: null }, stavajici: null });
    for (const r of radky) if (!k.nebezpeci.some((x) => tx(x.popis).toLowerCase() === r.toLowerCase())) o.push({ cil: 'karta', pridat: 'nebezpeci', popis: 'Nebezpečí do karty (hasivo doplníte)', hodnota: { popis: r, hasivo: '', znackaId: null }, stavajici: null });
    if (!nic(odp.hydrant) && !k.vodniZdroje.some((x) => tx(x.popis).toLowerCase() === tx(odp.hydrant).toLowerCase())) {
      o.push({ cil: 'karta', pridat: 'vodniZdroje', popis: 'Vnější hydrant do karty', stavajici: null,
        hodnota: { typ: 'hydrant', popis: tx(odp.hydrant), prutokLs: nic(odp.hydrantPrutok) ? null : Number(odp.hydrantPrutok), overenPrutok: odp.hydrantOveren === true, objemM3: null, gps: { sirka: null, delka: null }, znackaId: null } });
    }
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

export function dotaznikJakoText(d, nazevObjektu = '') {
  const o = [`DOTAZNÍK PRO ZPRACOVÁNÍ DZP${nazevObjektu ? ` – ${nazevObjektu}` : ''}`, ''];
  for (const s of SEKCE) { o.push(s.toUpperCase()); for (const q of OTAZKY.filter((x) => x.sekce === s)) o.push(`${q.text}: ${textOdpovedi(q, d.odpovedi[q.id]) || '…'}`); o.push(''); }
  return o.join('\n');
}
