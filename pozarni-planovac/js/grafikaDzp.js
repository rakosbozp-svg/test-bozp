// Kontrola obsahu grafické části DZP (situace, půdorys) podle Hanušky 1996, kap. 2.3.2 a 2.3.3, a souladu výkresů s operativní kartou.
// Pozná jen to, co je ve výkresu jako značka ČAHD (znacky/katalog.json), úniková cesta nebo žlutá plocha. Text a podklad (obrázek, DXF)
// aplikace nečte – proto jsou všechny nálezy jen UPOZORNĚNÍ („ověřte“), nikdy chyby.
import { stavPbz } from './kartaPole.js';

const R = (od, ...ids) => new Set(ids.map((n) => `DZP-${String(n).padStart(3, '0')}`).concat(od || []));

// Skupiny značek podle přílohy č. 1 metodiky (Hanuška 1996) a jejich čísla v katalogu ČAHD.
export const KATEGORIE = {
  voda: R(null, 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34, 37),               // „I. Zdroje vody“: hydranty, studna, stanoviště čerpání, nádrže, toky, stavidlo, vodojem, kanalizace
  vodaPudorys: R(null, 1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34, 37, 40, 43, 68, 71),   // 2.3.3 i): i suchovody, čerpací stanice, žebříky se suchovodem
  hydrant: R(null, 1, 4),                                                          // vnější hydrant (nadzemní, podzemní) – nástěnný je vnitřní
  uzaver: R(null, 2, 5, 8, 11, 14, 17, 20, 24, 26, 55, 104, 107),                 // 2.3.2 b) / 2.3.3 g): uzávěry, vypínače, rozvodna, ovládací centrum, TOTAL/CENTRAL STOP
  uzaverVoda: R(null, 55), uzaverPlyn: R(null, 5), vypinac: R(null, 17, 104, 107),   // HLAVNÍ uzávěry a vypínač (okénka karty)
  totalStop: R(null, 104), centralStop: R(null, 107),
  fveVypnuti: R(null, 17, 20, 104, 107),
  nastup: R(null, 58),                                                            // komunikace / nástupní plochy (navíc žlutá plocha)
  evakuace: R(null, 42),                                                          // místo soustředění evakuovaných
  poplach: R(null, 45, 48, 51),                                                   // 2.3.2 g): místo řízení evakuace, tlačítko poplachu, telefon s ohlašovnou
  nebezpeci: R(null, 3, 6, 9, 12, 15, 18, 21, 27, 29, 32, 35, 41, 47, 50, 53, 56, 74),   // výstrahy, nebezpečné látky, zákaz hašení vodou
  eps: R(null, 54),
  vchod: R(null, 105, 108),
  useky: R(null, 62),                                                             // 2.3.3 c): hranice požárního úseku
};
const ZLUTA = '#f2d200';
const ne = (v) => v === null || v === undefined || String(v).trim() === '' || String(v).trim().toUpperCase() === 'NE';

const maZnacku = (prvky, kat) => prvky.some((p) => p.druh === 'znacka' && KATEGORIE[kat].has(p.znackaId));
const maNastup = (prvky) => maZnacku(prvky, 'nastup') || prvky.some((p) => ['plocha', 'obdelnik'].includes(p.druh) && String(p.vypln || '').toLowerCase() === ZLUTA);

export function kontrolaGrafikyDzp(projekt, upoz) {
  const vykresy = projekt.listy.filter((l) => l.vykres && ['situace', 'pudorys', 'schema'].includes(l.typ));
  if (!vykresy.length) return;
  const vse = vykresy.flatMap((l) => l.vykres.prvky);
  const n = (l) => `List „${l.nazev}“`;

  for (const l of vykresy) {
    const pr = l.vykres.prvky, c = `listy[${l.id}].vykres.prvky`;
    if (!pr.length) continue;   // prázdný výkres hlásí obecná kontrola
    if (l.typ === 'situace') {
      if (!maZnacku(pr, 'voda')) upoz('GRAF_SIT_VODA', c, `${n(l)}: chybí značka zdroje vody (příloha č. 1, skupina I; Hanuška 2.3.2 e) – ověřte.`);
      if (!maNastup(pr)) upoz('GRAF_SIT_NASTUP', c, `${n(l)}: chybí nástupní plocha / komunikace pro techniku (žlutá plocha nebo značka, Hanuška 2.3.2 c) – ověřte.`);
      if (!maZnacku(pr, 'uzaver')) upoz('GRAF_SIT_UZAVERY', c, `${n(l)}: chybí uzávěry vody, el. energie, plynu a ovládací a řídicí centra (Hanuška 2.3.2 b) – ověřte.`);
      if (!maZnacku(pr, 'evakuace')) upoz('GRAF_SIT_EVAKUACE', c, `${n(l)}: chybí místo soustředění evakuovaných osob (Hanuška 2.3.2 d) – ověřte, zda je určeno.`);
      if (!maZnacku(pr, 'poplach')) upoz('GRAF_SIT_POPLACH', c, `${n(l)}: chybí místo, odkud lze vyhlásit požární poplach nebo řídit evakuaci (Hanuška 2.3.2 g) – ověřte.`);
    }
    if (l.typ === 'pudorys') {
      if (!pr.some((p) => p.druh === 'trasa')) upoz('GRAF_PUD_CESTY', c, `${n(l)}: nejsou zakresleny únikové a zásahové cesty (Hanuška 2.3.3 a) – ověřte.`);
      if (!pr.some((p) => p.druh === 'dvere') && !maZnacku(pr, 'vchod')) upoz('GRAF_PUD_VCHODY', c, `${n(l)}: nejsou zakresleny vchody (dveře nebo značka vchodu, Hanuška 2.3.3 a) – ověřte.`);
      if (!maZnacku(pr, 'useky')) upoz('GRAF_PUD_USEKY', c, `${n(l)}: nejsou vyznačeny hranice požárních úseků (značka DZP-062; Hanuška 2.3.3 c, návod HZS SČK) – ověřte.`);
      if (!maZnacku(pr, 'uzaver')) upoz('GRAF_PUD_UZAVERY', c, `${n(l)}: chybí rozvodny a hlavní uzávěry vody, el. energie a plynu (Hanuška 2.3.3 g) – ověřte.`);
      if (!maZnacku(pr, 'vodaPudorys')) upoz('GRAF_PUD_VODA', c, `${n(l)}: chybí zdroje vody, hydranty nebo suchovody (Hanuška 2.3.3 i) – ověřte.`);
    }
  }
  // Operativní karta: návod HZS SČK chce v grafické části jednoduchý půdorys podlaží s hranicemi požárních úseků a značkami.
  if (projekt.typ === 'operativni_karta' && !vykresy.some((l) => l.typ === 'pudorys') && !maZnacku(vse, 'useky')) upoz('KARTA_PUDORYS', 'listy', 'Grafická část karty: návod HZS SČK požaduje jednoduché schematické zobrazení půdorysu jednotlivých podlaží s hranicemi požárních úseků a značkami – přidejte list Půdorys, nebo půdorys a hranice úseků (DZP-062) zakreslete do situace.');

  // Soulad s operativní kartou: co karta uvádí, má být vidět ve výkresech projektu.
  const karty = projekt.listy.filter((l) => l.typ === 'karta');
  for (const k of karty) {
    const d = k.karta, c = `listy[${vykresy[0].id}].vykres.prvky`, kn = `karta „${k.nazev}“`;
    if (d.vodniZdroje.some((v) => v.typ === 'hydrant') && !maZnacku(vse, 'hydrant')) upoz('GRAF_KARTA_HYDRANT', c, `Výkresy: ${kn} uvádí vnější hydrant, ve výkresech chybí značka nadzemního nebo podzemního hydrantu.`);
    if (d.vodniZdroje.some((v) => !ne(v.popis)) && !maZnacku(vse, 'voda')) upoz('GRAF_KARTA_VODA', c, `Výkresy: ${kn} uvádí vodní zdroje, ve výkresech chybí jejich značka.`);
    if (!ne(d.media.hlavniUzaverPlynu) && !maZnacku(vse, 'uzaverPlyn')) upoz('GRAF_KARTA_PLYN', c, `Výkresy: ${kn} uvádí hlavní uzávěr plynu, ve výkresech chybí jeho značka.`);
    if (!ne(d.media.hlavniUzaverVody) && !maZnacku(vse, 'uzaverVoda')) upoz('GRAF_KARTA_VODA_UZAVER', c, `Výkresy: ${kn} uvádí hlavní uzávěr vody, ve výkresech chybí jeho značka.`);
    if (!ne(d.media.hlavniVypinacEl) && !maZnacku(vse, 'vypinac')) upoz('GRAF_KARTA_VYPINAC', c, `Výkresy: ${kn} uvádí hlavní vypínač el. proudu, ve výkresech chybí značka hlavního vypínače / STOP.`);
    if (!ne(d.media.totalStop) && !maZnacku(vse, 'totalStop')) upoz('GRAF_KARTA_TOTAL', c, `Výkresy: ${kn} uvádí TOTAL STOP, ve výkresech chybí jeho značka (DZP-104).`);
    if (!ne(d.media.centralStop) && !maZnacku(vse, 'centralStop')) upoz('GRAF_KARTA_CENTRAL', c, `Výkresy: ${kn} uvádí CENTRAL STOP, ve výkresech chybí jeho značka (DZP-107).`);
    if (d.fve.pritomna === true && !maZnacku(vse, 'fveVypnuti')) upoz('GRAF_KARTA_FVE', c, `Výkresy: ${kn} uvádí FVE, ve výkresech chybí značka vypínače silové části / TOTAL STOP / CENTRAL STOP.`);
    if (stavPbz(d.pbz.eps) === true && !maZnacku(vse, 'eps')) upoz('GRAF_KARTA_EPS', c, `Výkresy: ${kn} uvádí ústřednu EPS, ve výkresech chybí její značka.`);
    if (d.nebezpeci.some((x) => !ne(x.popis)) && !maZnacku(vse, 'nebezpeci')) upoz('GRAF_KARTA_NEBEZPECI', c, `Výkresy: ${kn} uvádí nebezpečí, ve výkresech chybí výstražná značka.`);
  }
}
