// Výpočet sil a prostředků jednotek PO (SaP) podle Metodického návodu k vypracování DZP (Hanuška 1996), část druhá.
// Vzorce a tabulky převzaty ze stran 25–51 metodiky (podklady/Metodicky_navod_DZP_1996.pdf). Každý krok výpočtu se vypisuje
// i se vzorcem a dosazenými hodnotami, aby ho zpracovatel mohl zkontrolovat. Výsledek ověřuje zpracovatel / HZS.
//
// Pozn. ke zdroji: ve vzorci doby volného rozvoje (kap. 4.1, str. 28) je u doby bojového rozvinutí tiskem horní index „Po“.
// Jde o tiskovou chybu: vysvětlivka pod vzorcem, časové schéma na str. 29 i řešený příklad na str. 60
// („t_vr = t_ZP + t_OH + t_DO^Pr + t_BR^Pr = 30 + 5 + 8 + 2 = 45 min“) počítají s PRVNÍ jednotkou. Výpočet používá t_BR^Pr.
// Výpočet SaP se provádí pro LOKALIZACI požáru (kap. 3.3, str. 27) – bez doby do lokalizace t3 není výsledek úplný.

// Tabulka č. 1 – Io [l/m/min] na obvod, Ip [l/m²/min] na plochu, v1 [m/min] lineární rychlost šíření (null = neuvedeno)
export const TABULKA1 = [
  ['Třída 1 – Výroba, údržba', [
    ['Výrobní prostor a samostatný pomocný provoz včetně samostatných kotelen', 56.2, 11.2, 1.2],
    ['Pomocný provoz ve stejném požárním úseku jako výrobní prostor', 47.7, 10.0, 0.7],
    ['Lakovny, technické sušárny, vypalovny', 50.3, 10.1, 1.6],
    ['Svářecí dílny', 23.2, 4.6, 0.6],
    ['Laboratoře a zkušebny (mimo školních)', 36.0, 7.2, 0.5],
    ['Prostory ovládacích a řídicích zařízení a samočinných počítačů', 66.7, 13.3, 0.8],
    ['Prachové odlučovače, vzduchotechnika včetně potrubí, kompresorovny', 50.0, 10.0, 0.5],
    ['Elektrické rozvodny, měnírny, trafostanice a vedení el. proudu', 73.7, 14.7, 0.5],
    ['Prostor rozestavěného stavebního objektu', 34.1, 6.8, 1.0],
    ['Jiné (výroba, údržba)', 55.7, 11.1, 1.4]]],
  ['Třída 2 – Skladování, obchod', [
    ['Sklady paliv', 36.5, 7.3, 0.5], ['Sklady materiálu, výrobků (hořlavých)', 50.7, 10.1, 1.4], ['Staveništní sklady', 49.9, 10.0, 0.7],
    ['Zásobníky pevných a sypkých hmot', null, 10.3, null], ['Sklady a skládky odpadu', 43.0, 8.6, 0.9],
    ['Expedice, výdejna, balírna, překládací rampa', 45.0, 9.0, 1.4], ['Obchod – prodejní místnosti včetně příručních skladů', 52.5, 10.5, 0.6],
    ['Knihovny, archivy', 55.0, 11.0, 0.6], ['Šatny, úschovny', 36.4, 7.3, 0.6], ['Jiné (kolny, stodoly jako skladiště)', 35.8, 7.2, 0.7]]],
  ['Třída 3 – Skladování hořlavých kapalin a hořlavin', [
    ['Sklady hořlavých kapalin (budovy)', 51.9, 10.4, 2.5], ['Sklady výbušnin a trhavin (šíření neomezené)', 80.2, 16.0, null],
    ['Sklady acetonu', null, 24.0, null], ['Sklady etanolu (etylalkoholu)', null, 18.0, null], ['Sklady etylalkoholu (lihu)', null, 24.0, null],
    ['Gumové výrobky na hromadách', null, 10.8, 1.2], ['Kaprolaktam', null, 15.6, 1.1], ['Kaučuk', null, 8.4, 1.0], ['Polystyren', null, 30.0, 0.8],
    ['Termoplasty', null, 8.4, 0.7], ['Teplem tvrditelné pryskyřice, odřezky plastů', null, 6.0, 0.4], ['Plexisklo', null, 18.0, 1.0],
    ['Textolit, karbalit, triacetátový film', null, 6.0, 2.5], ['Benzin, motorová nafta a ropné produkty s bodem vzplanutí do 28 °C', null, 24.0, null],
    ['Mazuty a ropné produkty s bodem vzplanutí nad 28 °C', null, 12.0, null]]],
  ['Třída 4 – Shromažďovací prostory', [
    ['Jeviště, zákulisí, převlékárny, promítací kabiny', 42.3, 8.5, 2.3], ['Hlediště kin a divadel, stadiony, tělocvičny, cirkusy', 41.2, 8.5, 1.5],
    ['Učebny, posluchárny, třídy, přednáškové sály', 38.2, 7.6, 0.9], ['Školní dílny, laboratoře, kabinety', 37.6, 7.5, 1.2],
    ['Jídelny, kantýny, bufety, restaurace', 36.5, 7.3, 1.0], ['Výstavní síně, muzea, galerie, hrady, zámky, kostely', 37.6, 7.5, 1.1],
    ['Čekárny a nástupní prostory budov hromadné dopravy', 14.7, 2.9, 0.1], ['Taneční sály, veřejné místnosti, kluby, kavárny, bary', 39.6, 7.9, 0.6],
    ['Jiné (shromažďovací prostory)', 62.0, 12.4, 0.2]]],
  ['Třída 5 – Bydlení, služby, kanceláře, sociální zařízení', [
    ['Kanceláře, vrátnice v budovách', 43.4, 8.7, 0.6], ['Lékařské služby', 38.8, 7.8, 0.2], ['Pošty, banky', 20.2, 4.0, 0.6],
    ['Obytné místnosti a ložnice – trvalé bydlení, domovy důchodců', 43.2, 8.6, 0.7], ['Obytné místnosti – přechodné ubytování (hotely, internáty…)', 45.4, 9.1, 0.7],
    ['Jesle, lůžková část zdravotnických zařízení, psychiatrické léčebny', 43.9, 8.8, 0.6], ['Kuchyně včetně spíží', 46.3, 9.3, 0.7],
    ['Umývárny, koupelny, sauny, WC', 36.2, 7.2, 0.5], ['Altánky, boudy, maringotky, stánky, staveništní buňky', 51.5, 10.3, 0.9], ['Jiné (bydlení, služby)', 58.3, 11.7, 0.9]]],
  ['Třída 6 – Ostatní prostory u budov', [
    ['Garáže včetně plechových, hangáry', 55.0, 11.0, 0.8], ['Kotelny, výměníky', 48.6, 9.7, 0.6], ['Prádelny, sušárny, mandlovny, kočárkárny', 58.0, 11.6, 0.8],
    ['Půdy', 38.0, 7.6, 0.7], ['Sklepy (pro ukládání paliva apod.)', 44.0, 8.8, 0.5], ['Chodby, schodiště, výtahy, komunikační prostory', 42.0, 8.4, 0.7],
    ['Instalační šachty, kanály, technická podlaží, propan-butanové lahve, kabelové kanály', 61.1, 12.2, 0.6], ['Kůlny, dřevníky, udírny', 41.7, 8.3, 0.8],
    ['Jiné (vnější konstrukce spojené s budovou, mezistropní prostor)', 36.2, 7.2, 0.7]]],
  ['Třída 7 – Doprava', [
    ['Pásová doprava, dopravníky, pneumatická doprava', 76.7, 15.3, 0.8], ['Silniční, kolejová vozidla, lodě (požár na palubě)', 55.6, 11.1, 0.7],
    ['Konstrukce letadel (v1 2,5 a více)', 90.0, 18.0, 2.5]]],
  ['Třída 8 – Chov zvířat a rostlinná výroba', [
    ['Ustájení užitkových zvířat', 46.3, 9.3, 1.3], ['Drůbežárny, snáškové haly, umělé líhně', 33.7, 6.7, 1.4], ['Přípravna krmiv', 47.1, 9.4, 0.8],
    ['Sklady zemědělských plodin a píce (mimo stohů)', 32.6, 6.5, 1.3], ['Sušárny zemědělských plodin', 76.6, 15.3, 0.5],
    ['Úpravny produktů živočišné a rostlinné výroby', 40.4, 8.1, 0.8], ['Jiné (chov zvířat, rostlinná výroba)', 40.4, 8.0, 1.1]]],
  ['Třída 9 – Přírodní prostředí', [
    ['Obilí na poli', 12.1, 2.4, 3.1], ['Stohy slámy', 29.9, 6.0, 1.4], ['Stohy píce', 32.3, 6.5, 1.4], ['Sláma na poli, strniště, nesklizené pole', 11.2, 2.2, 2.1],
    ['Meze, náspy', 17.5, 3.5, 1.4], ['Sady, zahrady, skleníky, dvory', 29.1, 5.8, 1.4], ['Lesy, kosodřevina', 9.2, 1.8, 1.3], ['Jiné (přírodní prostředí)', 24.7, 5.0, 1.0]]],
];
export const PROSTORY = TABULKA1.flatMap(([trida, polozky], i) => polozky.map(([nazev, io, ip, v1], j) => ({ id: `${i + 1}.${j + 1}`, trida, nazev, io, ip, v1 })));
export const najdiProstor = (id) => PROSTORY.find((x) => x.id === id) || null;

export const DOBA_VYJEZDU = { profi: [2, 'profesionální hasiči (2 min)'], dobro: [10, 'dobrovolní hasiči (10 min)'], smis: [5, 'smíšená / smluvní pohotovost (5 min)'] };   // kap. 3.2
export const V_JIZDY = 45;                                                    // km/h, kap. 3.2
export const UHLY = { 180: 0.5, 90: 0.25, 60: 0.16, 45: 0.12, 30: 0.08 };     // kap. 4.2 b
// kap. 5.4 (tabulka str. 35): [qA dodávka vody, npr počet proudnic C, popis, počet pěnotvorných proudnic, smí obsluhovat proudnici B]
// Družstvo obslouží nejvýš JEDNU proudnici B (1+3: 1 C nebo 1 B; 1+5: 2 C nebo 1 C + 1 B; 1+8: 3 C nebo 2 C + 1 B); 1+2 jen 1 C.
export const DRUZSTVA = { '1+2': [200, 1, 'proudnice: 1 C', 1, false], '1+3': [400, 1, '1 C nebo 1 B', 1, true], '1+5': [600, 2, '2 C nebo 1 C + 1 B', 2, true], '1+8': [800, 3, '3 C nebo 2 C + 1 B', 2, true] };
export const PROUDNICE = [['200', 'C 52 – hubice 12,5 (200 l/min)'], ['337', 'C 52 – hubice 16 (337 l/min)'], ['400', 'B 75 – hubice 18 (400 l/min)'], ['800', 'B 75 – hubice 25 (800 l/min)']];   // tab. 4
const jeB = (k) => ['400', '800'].includes(String(k));   // proudnice B 75; 200 a 337 l/min jsou C 52
// Kap. 4.2: za plochu požáru se považuje celá plocha objektu nebo prostoru (zadává se do „plochaUseku“).
export const CELA_PLOCHA = [['', 'ne – plocha požáru z rádiusu šíření'], ['mistnost', 'malý prostor (místnost)'], ['kapaliny', 'hořlavé kapaliny (nádrž, jímka) – plocha hašení = plocha požáru'], ['vybuch', 'prostředí s nebezpečím výbuchu – okamžité zachvácení celé plochy']];
// Minimální jmenovitý výkon čerpadla podle vyhlášky č. 35/2007 Sb. (CAS 20 / CAS 30, při 10 bar dle ČSN EN 1028-1).
// Skutečný vůz může mít výkonnější čerpadlo (např. CAS 20/4000/240 s čerpadlem 3 000 l/min) – pak zadejte vlastní hodnotu.
export const CAS_VYKON = { cas20: [2000, 'CAS 20 – min. 2 000 l/min (vyhl. 35/2007 Sb.)'], cas30: [3000, 'CAS 30 – min. 3 000 l/min (vyhl. 35/2007 Sb.)'], vlastni: [null, 'vlastní hodnota (výkon konkrétního vozu)'] };
export const PRACE_MV = { klid: 13, lehky: 20, lehka: 25, stredni: 35, tezka: 45, max: 70 };   // kap. 5.5
export const HT = { 400: { konopne: 8, izolovane: 4 }, 600: { konopne: 16, izolovane: 8 }, 800: { konopne: 32, izolovane: 16 } };   // kap. 5.7, m v.sl. / 100 m

const uid = () => `j_${Math.random().toString(36).slice(2, 10)}`;
export const novaJednotka = () => ({ id: uid(), nazev: '', druh: 'profi', L: null, tBR: null });
export const prazdnySap = () => ({
  tZP: null, tOH: null, jednotky: [],
  prostor: '', ioVlastni: null, ipVlastni: null, v1Vlastni: null,
  forma: 'kruh', uhel: '180', n: 1, a: null, plochaUseku: null, rPro: 'lokalizace',
  zpusob: 'plocha', Oh: null, h: 5,
  qprH: '200', qprO: '200', kH: 2, kO: 2,
  nadrzD: null, nadrzIo: 30, sousedniD: null, sousedniIo: 12, sousedniM: null, ochranaQ: null,
  druzstvo: '1+5', QcVolba: 'vlastni', Qc: null, vydatnost: null,
  celaPlocha: '',
  dych: { pL: null, VL: null, prace: 'stredni' },
  dalkova: { Lh: null, H: null, prutok: '600', hadice: 'izolovane' },
  kyvadlo: { L: null, Vnc: null, Qc: null, qv: null },
  pena: { N: null, qpr: null, pp: null },
  poznamka: '',
});

const cislo = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const kladne = (v) => { const n = cislo(v); return n !== null && Number.isFinite(n) && n > 0 ? n : null; };
const nezaporne = (v) => { const n = cislo(v); return n !== null && Number.isFinite(n) && n >= 0 ? n : null; };
const zaporne = (v) => { const n = cislo(v); return n !== null && Number.isFinite(n) && n < 0; };
const f = (n, d = 1) => (Number.isFinite(n) ? (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('cs-CZ') : '–');
const nahoru = (x) => Math.ceil(x - 1e-9);

// Údaje odvozené z ostatních listů projektu (nepatří do dat výpočtu, neukládají se): nastavKontextSaP(opSap, kontextSaP(projekt)).
const KONTEXT = new WeakMap();
export const nastavKontextSaP = (d, k) => { if (d && typeof d === 'object') KONTEXT.set(d, k); };
// Vydatnost zdroje vody z karty: jen hydrant s OVĚŘENÝM průtokem (zkouškou); požadavek normy z PBŘ se nepoužije.
export function kontextSaP(p) {
  const h = (p?.listy || []).flatMap((l) => l.karta?.vodniZdroje || []).filter((v) => v.typ === 'hydrant' && v.overenPrutok === true && kladne(v.prutokLs) !== null);
  if (!h.length) return {};
  const max = h.reduce((a, b) => (kladne(b.prutokLs) > kladne(a.prutokLs) ? b : a));
  return { vydatnost: { lmin: kladne(max.prutokLs) * 60, popis: `ověřený průtok hydrantu „${String(max.popis || '').trim().slice(0, 60) || 'bez popisu'}“ ${f(kladne(max.prutokLs))} l/s × 60${h.length > 1 ? ` (největší z ${h.length} ověřených hydrantů)` : ''}` } };
}

// Hlavní výpočet. Vrací { kroky: [{oddil, nazev, vzorec, vysledek}], chybi: [text], vysledky: {...} }
export function vypocetSaP(d) {
  const kroky = [], chybi = [], v = {};
  const krok = (oddil, nazev, vzorec, vysledek) => kroky.push({ oddil, nazev, vzorec, vysledek });

  // ---- 1. Doby (kap. 3.2, 4.1) ----
  const jed = d.jednotky.map((j) => {
    const tv = DOBA_VYJEZDU[j.druh]?.[0], L = nezaporne(j.L);
    if (L === null || tv === undefined) return null;
    const tj = (60 * L) / V_JIZDY;
    return { ...j, tv, tj, tDO: tv + tj, tBR: nezaporne(j.tBR) };
  }).filter(Boolean);
  if (!d.jednotky.length) chybi.push('jednotky PO podle požárního poplachového plánu (druh, vzdálenost, doba bojového rozvinutí)');
  else if (jed.length < d.jednotky.length) chybi.push('u některé jednotky chybí vzdálenost L (nebo je záporná)');
  if (d.jednotky.some((j) => zaporne(j.tBR))) chybi.push('doba bojového rozvinutí tBR nesmí být záporná');
  for (const j of jed) krok('Doby', `Dojezd – ${j.nazev || 'jednotka'}`, `tDO = tv + 60·L/vJ = ${f(j.tv)} + 60·${f(j.L, 2)}/${V_JIZDY}`, `${f(j.tDO)} min`);
  let tVR = null, t1 = null, t2 = null, t3 = null, tUh = null;
  const tZP = nezaporne(d.tZP), tOH = nezaporne(d.tOH);
  if (tZP === null) chybi.push(`doba zpozorování požáru tZP${zaporne(d.tZP) ? ' (nesmí být záporná)' : ''}`);
  if (tOH === null) chybi.push(`doba ohlášení požáru tOH${zaporne(d.tOH) ? ' (nesmí být záporná)' : ''}`);
  if (jed.length) {
    const pr = jed.reduce((a, b) => (b.tDO < a.tDO ? b : a)), po = jed.reduce((a, b) => (b.tDO > a.tDO ? b : a));
    v.prvni = pr.nazev; v.posledni = po.nazev;
    const tR = po.tDO - pr.tDO; v.tR = tR;
    krok('Doby', 'Rozdíl dojezdů poslední a první jednotky', `tR = tDO(Po) − tDO(Pr) = ${f(po.tDO)} − ${f(pr.tDO)}`, `${f(tR)} min`);
    if (pr.tBR === null) chybi.push('doba bojového rozvinutí první jednotky tBR (informativně tab. 10)');
    if (po !== pr && po.tBR === null) chybi.push('doba bojového rozvinutí poslední jednotky tBR – bez ní nelze určit dobu do lokalizace t3');
    if (tZP !== null && tOH !== null && pr.tBR !== null) {
      tVR = tZP + tOH + pr.tDO + pr.tBR; v.tVR = tVR;
      krok('Doby', 'Doba volného rozvoje požáru', `tVR = tZP + tOH + tDO(Pr) + tBR(Pr) = ${f(tZP)} + ${f(tOH)} + ${f(pr.tDO)} + ${f(pr.tBR)}  [str. 28: u tBR je ve vzorci tisková chyba „Po“ – vysvětlivka, schéma str. 29 i řešený příklad str. 60 počítají s první jednotkou]`, `${f(tVR)} min`);
      t1 = Math.min(10, tVR); t2 = Math.max(0, tVR - 10);
      krok('Doby', 'Doba rozhořívání a volného rozvoje', `t1 = min(10; tVR), t2 = tVR − t1`, `t1 = ${f(t1)} min, t2 = ${f(t2)} min`);
    }
    if (po.tBR !== null && pr.tBR !== null) v._tBR = [pr.tBR, po.tBR];
  }

  // ---- 2. Prostor a parametry požáru (tab. 1, kap. 3.4, 4.2, 4.3) ----
  const pro = najdiProstor(d.prostor);
  for (const [x, n] of [[d.ioVlastni, 'Io'], [d.ipVlastni, 'Ip'], [d.v1Vlastni, 'v1']]) if (cislo(x) !== null && kladne(x) === null) chybi.push(`vlastní ${n} musí být kladné číslo`);
  const ioV = kladne(d.ioVlastni), ipV = kladne(d.ipVlastni), v1V = kladne(d.v1Vlastni);
  const io = ioV ?? pro?.io ?? null, ip = ipV ?? pro?.ip ?? null, v1 = v1V ?? pro?.v1 ?? null;
  const Np = kladne(d.pena.N);
  // Hořlavé kapaliny hašené pěnou (bez prostoru z tab. 1): voda se počítá jen na ochlazování (řešený příklad LTO, str. 63–64)
  const jenPena = !pro && ipV === null && ioV === null && Np !== null;
  if (!pro && ipV === null && !jenPena) chybi.push('druh prostoru podle tabulky č. 1 (nebo vlastní intenzita); hořlavé kapaliny hašené pěnou – vyplňte oddíl Pěna');
  if (pro) krok('Požár', 'Prostor (tabulka č. 1)', `${pro.trida}: ${pro.nazev}`, `Io = ${io === null ? 'neuvedeno' : `${f(io)} l/m/min`}, Ip = ${f(ip)} l/m²/min, v1 = ${v1 === null ? 'neuvedeno' : `${f(v1)} m/min`}${/letadel/i.test(pro.nazev) && v1V === null ? ' (tab. 1: „2,5 a více“ – použita dolní mez)' : ''}${(ioV ?? ipV ?? v1V) !== null ? ' (část hodnot zadána ručně)' : ''}`);
  if (jenPena) { tUh = 10; krok('Požár', 'Hašení hořlavých kapalin pěnou', 'normativní doba uhasínání (kap. 3.4, str. 27)', '10 min'); }
  else if (v1 !== null) {
    tUh = v1 <= 2 ? 5 : v1 <= 3 ? 10 : 15;
    krok('Požár', 'Doba uhasínání (lokalizace) po nasazení posledních SaP', `v1 = ${f(v1)} m/min → ${v1 <= 2 ? 'do 2' : v1 <= 3 ? 'nad 2 do 3' : 'nad 3'} m/min (kap. 3.4, str. 27; v PDF chybně číslována jako druhá 3.3)`, `${tUh} min`);
  }
  if (v._tBR && tUh !== null && v.tR !== undefined) {
    t3 = v.tR + v._tBR[1] - v._tBR[0] + tUh; v.t3 = t3;
    krok('Požár', 'Doba od nasazení prvních proudů do lokalizace', `t3 = tR + tBR(Po) − tBR(Pr) + tuh = ${f(v.tR)} + ${f(v._tBR[1])} − ${f(v._tBR[0])} + ${tUh}`, `${f(t3)} min`);
  }
  const h = kladne(d.h) ?? 5, Oh = kladne(d.Oh), Su = kladne(d.plochaUseku);
  if (cislo(d.plochaUseku) !== null && Su === null) chybi.push('plocha úseku / prostoru musí být kladné číslo');
  // Kap. 4.2: celá plocha objektu nebo prostoru (v1 > 2 m/min, malé prostory, nebezpečí výbuchu, hořlavé kapaliny)
  const CELA = { mistnost: 'malý prostor (místnost)', kapaliny: 'hořlavé kapaliny (nádrž, jímka)', vybuch: 'prostředí s nebezpečím výbuchu – okamžité zachvácení celé půdorysné plochy' };
  let celaDuvod = CELA[d.celaPlocha] ? CELA[d.celaPlocha] : null;
  if (!celaDuvod && !jenPena && v1 !== null && v1 > 2) celaDuvod = `vysoká lineární rychlost šíření v1 = ${f(v1)} m/min > 2 m/min`;
  if (!celaDuvod && !jenPena && pro && v1 === null) celaDuvod = 'v tabulce č. 1 není lineární rychlost uvedena („–“ / „neomez.“)';
  let R = null, Sp = null, Sh = null, cela = false;
  if (celaDuvod) {
    if (Su === null) chybi.push(`plocha objektu nebo prostoru (m²) – ${celaDuvod}: plochou požáru je celá plocha (kap. 4.2)`);
    else { Sp = Su; cela = true; krok('Požár', 'Plocha požáru – celá plocha objektu / prostoru (kap. 4.2, str. 28)', celaDuvod, `Sp = ${f(Sp)} m²`); }
  } else if (!jenPena) {
    if (v1 === null && pro === null && ipV !== null && d.zpusob !== 'fronta') chybi.push('lineární rychlost šíření v1 (vlastní hodnota) – nebo zvolte výpočet podle fronty hašení');
    if (v1 !== null && tVR !== null) {
      const R1 = tVR <= 10 ? 0.5 * v1 * tVR : 5 * v1 + v1 * t2;
      krok('Požár', 'Rádius v době nasazení prvních proudů', tVR <= 10 ? `R = 0,5·v1·t1 = 0,5·${f(v1)}·${f(tVR)}` : `R = 5·v1 + v1·t2 = 5·${f(v1)} + ${f(v1)}·${f(t2)}`, `${f(R1, 2)} m`);
      if (d.rPro === 'prvni') { R = R1; v.rPrvni = true; }
      else if (t3 !== null) {
        R = R1 + 0.5 * v1 * t3;
        krok('Požár', 'Rádius v době lokalizace', `R = R(prvních proudů) + 0,5·v1·t3 = ${f(R1, 2)} + 0,5·${f(v1)}·${f(t3)}`, `${f(R, 2)} m`);
      } else chybi.push('doba do lokalizace t3 – výpočet SaP se provádí pro lokalizaci požáru (kap. 3.3); doplňte tBR první i poslední jednotky');
    }
  }
  if (R !== null) {
    const shTxt = (vz) => (R <= h ? 'Sh = Sp (R ≤ h, kap. 4.3)' : vz);
    if (d.forma === 'kruh') { Sp = Math.PI * R ** 2; Sh = R <= h ? Sp : Math.PI * (R ** 2 - (R - h) ** 2); krok('Požár', 'Plocha požáru a hašení – kruhová forma', `Sp = π·R², ${shTxt('Sh = π·[R² − (R − h)²]')}, h = ${f(h)} m`, `Sp = ${f(Sp)} m², Sh = ${f(Sh)} m²`); }
    if (d.forma === 'uhel') { const fk = UHLY[d.uhel] ?? 0.5; Sp = fk * Math.PI * R ** 2; Sh = R <= h ? Sp : fk * Math.PI * (R ** 2 - (R - h) ** 2); krok('Požár', `Plocha požáru a hašení – úhlová forma (β = ${d.uhel}°, f = ${f(fk, 3)})`, `Sp = f·π·R², ${shTxt('Sh = f·π·[R² − (R − h)²]')}, h = ${f(h)} m`, `Sp = ${f(Sp)} m², Sh = ${f(Sh)} m²`); }
    if (d.forma === 'pravouhla') {
      const a = kladne(d.a), n = kladne(d.n) ?? 1;
      if (a === null) chybi.push('šířka prostoru a (pravoúhlá forma)');
      else { Sp = n * R * a; Sh = R <= h ? Sp : n * h * a; krok('Požár', `Plocha požáru a hašení – pravoúhlá forma (n = ${n}, a = ${f(a)} m)`, `Sp = n·R·a, ${shTxt('Sh = n·h·a')}, h = ${f(h)} m`, `Sp = ${f(Sp)} m², Sh = ${f(Sh)} m²`); }
    }
    if (Sp !== null && Su !== null && Sp > 0.85 * Su) {
      krok('Požár', 'Zasaženo více než 85 % plochy požárního úseku', `Sp ${f(Sp)} m² > 85 % z ${f(Su)} m² → počítá se celá plocha úseku (kap. 4.2)`, `Sp = ${f(Su)} m²`);
      Sp = Su; cela = true;
    }
  }
  // Plocha hašení: obecně Sh = Oh·h (kap. 4.3). Když hoří celá plocha, plochu hašení neurčuje forma šíření, ale fronta hašení
  // (řešený příklad str. 60–61); Sh = Sp jen u hořlavých kapalin v nádržích a malých prostor.
  if (d.zpusob === 'fronta') {
    if (Oh !== null) { Sh = Oh * h; krok('Požár', 'Plocha hašení podle fronty', `Sh = Oh·h = ${f(Oh)}·${f(h)}`, `${f(Sh)} m²`); }
    else Sh = null;
  } else if (cela) {
    if (['mistnost', 'kapaliny'].includes(d.celaPlocha)) { Sh = Sp; krok('Požár', 'Plocha hašení', `Sh = Sp (${d.celaPlocha === 'kapaliny' ? 'hořlavé kapaliny – kap. 4.3' : 'malý prostor – hasí se celá plocha'})`, `${f(Sh)} m²`); }
    else { Sh = null; chybi.push('fronta hašení Oh – hoří celá plocha, plocha hašení se určí z fronty Sh = Oh·h (kap. 4.3; řešený příklad str. 60–61): zvolte „Dodávka na hašení podle fronty hašení“'); }
  }
  Object.assign(v, { Sp, Sh, R, cela, Oh: d.zpusob === 'fronta' ? Oh : null });

  // ---- 3. Dodávka hasiva (kap. 5.2) ----
  let Qh = null;
  if (jenPena) { Qh = 0; krok('Hasivo', 'Hašení pěnou', 'voda na hašení se nepočítá – pěnotvorné proudnice a zásoba pěnidla v oddílu Pěna (kap. 5.8)', '0 l/min'); }
  else if (d.zpusob === 'fronta') {
    if (Oh === null) chybi.push('fronta hašení Oh'); else if (io === null) chybi.push('intenzita na obvod Io (v tab. 1 pro tento prostor neuvedena)');
    else { Qh = Oh * io; krok('Hasivo', 'Dodávka na hašení – podle fronty', `Qh = Oh·Io = ${f(Oh)}·${f(io)}`, `${f(Qh, 0)} l/min`); }
  } else if (Sh !== null && ip !== null) { Qh = Sh * ip; krok('Hasivo', 'Dodávka na hašení – podle plochy', `Qh = Sh·Ip = ${f(Sh)}·${f(ip)}`, `${f(Qh, 0)} l/min`); }
  let Qo = 0;
  const D = kladne(d.nadrzD), Ds = kladne(d.sousedniD), m = kladne(d.sousedniM), Qochr = kladne(d.ochranaQ);
  if (D !== null) { const x = Math.PI * D * (kladne(d.nadrzIo) ?? 30); Qo += x; krok('Hasivo', 'Ochlazování hořící nádrže', `Qo = π·D·Io = π·${f(D)}·${f(kladne(d.nadrzIo) ?? 30)}`, `${f(x, 0)} l/min`); }
  if (Ds !== null && m !== null) { const x = 0.5 * Math.PI * Ds * (kladne(d.sousedniIo) ?? 12) * m; Qo += x; krok('Hasivo', 'Ochlazování sousedních nádrží', `Qo = 0,5·π·D·Io·m = 0,5·π·${f(Ds)}·${f(kladne(d.sousedniIo) ?? 12)}·${f(m, 0)}`, `${f(x, 0)} l/min`); }
  if (Qochr !== null) { Qo += Qochr; krok('Hasivo', 'Ochrana ostatních objektů (zadáno)', 'dle počtu míst ochrany / tab. 2', `${f(Qochr, 0)} l/min`); }
  if (jenPena && Qo === 0) chybi.push('ochlazování nádrže (průměr D) – u hašení pěnou se voda počítá na ochlazování');
  const Qp = Qh !== null ? Qh + Qo : null;
  if (Qp !== null) krok('Hasivo', 'Celková potřebná dodávka vody', `Qp = Qh + Qo = ${f(Qh, 0)} + ${f(Qo, 0)}`, `${f(Qp, 0)} l/min`);
  v.Qh = Qh; v.Qo = Qo; v.Qp = Qp;

  // ---- 4. Proudy, technika, hasiči (kap. 5.3, 5.4) ----
  const qh = kladne(d.qprH), qo = kladne(d.qprO) ?? qh;
  let soucetK = null;
  const kH = kladne(d.kH) ?? 2, kO = kladne(d.kO) ?? 2;
  if (Qh !== null && qh !== null && Qp > 0) {
    const Nh = Qh > 0 ? nahoru(Qh / qh) : 0, No = Qo > 0 ? nahoru(Qo / qo) : 0, Npr = Nh + No;
    krok('SaP', 'Počet proudů', `Nh = Qh/qpr = ${f(Qh, 0)}/${f(qh, 0)}; No = Qo/qpr = ${f(Qo, 0)}/${f(qo, 0)}; Npr = Nh + No`, `Nh = ${Nh}, No = ${No}, Npr = ${Npr} (zaokrouhleno nahoru)`);
    const dr = DRUZSTVA[d.druzstvo] || DRUZSTVA['1+5'], Qc = kladne(d.Qc);
    const b = (jeB(d.qprH) ? Nh : 0) + (jeB(d.qprO) ? No : 0);
    if (b > 0 && !dr[4]) chybi.push(`družstvo ${d.druzstvo} obsluhuje jen proudnici C – pro proudnice B zvolte větší družstvo (tabulka kap. 5.4)`);
    const NA1 = nahoru(Qp / dr[0]), NA2 = Math.max(b, nahoru(Npr / dr[1]));
    krok('SaP', `Počet automobilů pro družstva ${d.druzstvo}`, `NA = Qp/qA = ${f(Qp, 0)}/${dr[0]}; NA = Npr/npr = ${Npr}/${dr[1]}${b ? `, nejméně počet proudnic B = ${b} (družstvo obslouží nejvýš 1 B)` : ''}`, `${NA1} podle dodávky, ${NA2} podle proudnic → ${Math.max(NA1, NA2)} (zaokrouhleno nahoru)`);
    let NA = Math.max(NA1, NA2), NApena = 0;
    if (Np !== null) { NApena = nahoru(Np / dr[3]); NA += NApena; krok('SaP', 'Družstva pro pěnotvorné proudnice', `${f(Np, 0)} proudnic / ${dr[3]} na družstvo ${d.druzstvo} (tabulka kap. 5.4)`, `+ ${NApena} → celkem ${NA}`); }
    let NAN = null;
    if (Qc === null) chybi.push('výkon čerpadla Qc (vyberte CAS 20 / CAS 30 podle vyhl. 35/2007 Sb. nebo zadejte výkon konkrétního vozu)');
    else { NAN = nahoru((Nh * qh + No * qo) / (0.75 * Qc)); krok('SaP', 'Technika nutná k dodávce hasiva', `NA(N) = Σ(Npr·qpr)/(0,75·Qc) = ${f(Nh * qh + No * qo, 0)}/(0,75·${f(Qc, 0)})`, `${NAN} (zaokrouhleno nahoru)`); }
    soucetK = kH * Nh + kO * No;
    const NHa = nahoru(1.25 * soucetK);
    krok('SaP', 'Přibližný počet hasičů', `NHa = 1,25·Σ(ki·Npri) = 1,25·(${f(kH)}·${Nh} + ${f(kO)}·${No})`, `${NHa} (zaokrouhleno nahoru)`);
    Object.assign(v, { Nh, No, Npr, NA, NApena, NAN, NAcelkem: Math.max(NA, NAN ?? 0), NHa });
    const zKarty = kladne(d.vydatnost) === null ? KONTEXT.get(d)?.vydatnost : null, vyd = kladne(d.vydatnost) ?? zKarty?.lmin ?? null;
    if (vyd !== null) { const sp = Nh * qh + No * qo; krok('SaP', 'Porovnání se zdrojem vody', `skutečná spotřeba ${f(sp, 0)} l/min, vydatnost zdroje ${f(vyd, 0)} l/min${zKarty ? ` (vydatnost nezadána – z karty: ${zKarty.popis})` : ''}`, sp <= vyd ? 'vyhovuje' : `chybí ${f(sp - vyd, 0)} l/min → dálková doprava vody`); v.voda = sp <= vyd; }
  }

  // ---- 5. Dýchací technika (kap. 5.5) ----
  const pL = kladne(d.dych.pL), VL = kladne(d.dych.VL), MV = PRACE_MV[d.dych.prace];
  if (pL !== null && VL !== null && MV) {
    const To = (10 * pL * VL) / MV; v.To = To;
    const nutna100 = t3 !== null && t3 >= To;
    const pozn = t3 === null ? ' → porovnání s dobou lokalizace t3 nelze (t3 chybí)' : nutna100 ? ' → doba lokalizace t3 není kratší: nutná 100% záloha hasičů (str. 35–36)' : ' → doba lokalizace t3 je kratší: záloha 25 % (obsažena v koeficientu 1,25)';
    krok('Dýchací technika', 'Ochranná doba přístroje', `To = 10·pL·VL/MV = 10·${f(pL)}·${f(VL)}/${MV}`, `${f(To)} min${t3 !== null ? ` (t3 = ${f(t3)} min)` : ''}${pozn}`);
    if (nutna100 && soucetK !== null) {
      v.NHa100 = v.NHa + nahoru(soucetK);
      krok('Dýchací technika', 'Hasiči se 100% zálohou pro dýchací techniku', `NHa + Σ(ki·Npri) = ${v.NHa} + ${f(soucetK)}  [přibližně: k počtu s 25% rezervou se připočte záloha za všechny hasiče na proudech – str. 35 b) a 36]`, `${v.NHa100}`);
    }
  }

  // ---- 6. Dálková doprava (kap. 5.7) ----
  const Lh = kladne(d.dalkova.Lh);
  if (Lh !== null) {
    const H = cislo(d.dalkova.H) ?? 0, Ht = HT[d.dalkova.prutok]?.[d.dalkova.hadice] ?? 8, Nc = nahoru((H + 0.01 * Lh * Ht + 7.5) / 65);
    krok('Dálková doprava', 'Počet čerpadel – hadicové vedení B', `Nč = (H + 0,01·Lh·Ht + Ha)/65 = (${f(H)} + 0,01·${f(Lh, 0)}·${Ht} + 7,5)/65`, `${Nc} (zaokrouhleno nahoru)`); v.Ncerp = Nc;
  }
  const kv = d.kyvadlo, Lk = kladne(kv.L), Vnc = kladne(kv.Vnc), Qck = kladne(kv.Qc), qv = kladne(kv.qv);
  if (Lk !== null && Vnc !== null && Qck !== null && qv !== null) {
    const T1 = (60 * Lk) / V_JIZDY, T2 = Vnc / Qck, T4 = Vnc / qv, x = (2 * T1 + T2) / T4;
    krok('Dálková doprava', 'Počet cisteren – kyvadlová doprava', `Nc = (T1 + T2 + T3)/T4 + (2 až 3); T1 = T3 = 60·L/45 = ${f(T1)}, T2 = Vnc/Qc = ${f(T2)}, T4 = Vnc/qv = ${f(T4)}`, `${f(x)} + 2 až 3 → ${nahoru(x) + 2} až ${nahoru(x) + 3}`); v.Ncist = [nahoru(x) + 2, nahoru(x) + 3];
  }

  // ---- 7. Pěna (kap. 5.8) ----
  const qpp = kladne(d.pena.qpr), pp = kladne(d.pena.pp);
  if (Np !== null && qpp !== null && pp !== null) {
    const qp = 0.01 * qpp * pp, Vp = Np * qp * 10 * 3;
    krok('Pěna', 'Zásoba pěnidla', `qp = 0,01·qpr·pp = 0,01·${f(qpp, 0)}·${f(pp)}; Vp = Npr·qp·tn·z = ${f(Np, 0)}·${f(qp, 2)}·10·3`, `${f(Vp, 0)} l`); v.Vp = Vp;
  } else if (jenPena) chybi.push('průtok roztoku pěnotvornou proudnicí a přimísení pěnidla (oddíl Pěna)');
  v.Npena = Np;
  return { kroky, chybi, vysledky: v };
}

// Krátké shrnutí výsledku (do základního textu OP).
// 1 proud, 2–4 proudy, 5 proudů (čeština); n je celé číslo
const poc = (n, jeden, dva, pet) => `${f(n, 0)} ${n === 1 ? jeden : n >= 2 && n <= 4 ? dva : pet}`;
export function shrnutiSaP(d) {
  const { vysledky: v, chybi } = vypocetSaP(d);
  if (v.Npr === undefined) return `Výpočet SaP není úplný – chybí: ${chybi.join('; ')}.`;
  const NAc = v.NAcelkem, hasici = v.NHa100 ?? v.NHa;
  return [`Výpočet SaP (Hanuška 1996, část druhá): Qp = ${f(v.Qp, 0)} l/min, ${poc(v.Npr, 'proud', 'proudy', 'proudů')} (${v.Nh} hašení, ${v.No} ochlazování/ochrana)${v.Npena ? `, ${poc(v.Npena, 'pěnotvorná proudnice', 'pěnotvorné proudnice', 'pěnotvorných proudnic')}` : ''}, ${poc(NAc, 'požární automobil', 'požární automobily', 'požárních automobilů')} (${v.NA} pro družstva ${d.druzstvo}${v.NAN !== null ? `, ${v.NAN} k dodávce hasiva` : ''}), přibližně ${poc(hasici, 'hasič', 'hasiči', 'hasičů')}${v.NHa100 ? ' včetně 100% zálohy pro dýchací techniku' : ''}.`,
    v.Sp !== null && v.Sp !== undefined ? `Plocha požáru ${f(v.Sp)} m²${v.cela ? ' (celá plocha)' : ''}${v.Oh ? `, fronta hašení ${f(v.Oh)} m (plocha hašení ${f(v.Sh)} m²)` : v.Sh !== null && v.Sh !== undefined ? `, plocha hašení ${f(v.Sh)} m²` : ''}.` : v.Oh ? `Fronta hašení ${f(v.Oh)} m.` : '',
    v.rPrvni ? 'POZOR: rádius je počítán k nasazení prvních proudů, ne k lokalizaci – metodika počítá SaP pro lokalizaci požáru (kap. 3.3); výsledek je jen orientační.' : '',
    v.voda === false ? 'Vydatnost zdroje vody nestačí – nutná dálková doprava vody.' : v.voda === true ? 'Vydatnost zdroje vody vyhovuje.' : '',
    v.To !== undefined ? `Ochranná doba dýchacího přístroje ${f(v.To)} min${v.t3 !== undefined ? (v.t3 < v.To ? ' (lokalizace do ochranné doby – záloha 25 %)' : ' (lokalizace delší – 100% záloha hasičů)') : ''}.` : '',
    v.Vp !== undefined ? `Zásoba pěnidla ${f(v.Vp, 0)} l.` : '',
    chybi.length ? `Nevyplněno: ${chybi.join('; ')}.` : ''].filter(Boolean).join(' ');
}

export function sapJakoText(d) {
  const { kroky, chybi } = vypocetSaP(d), o = ['VÝPOČET SIL A PROSTŘEDKŮ (Hanuška 1996, část druhá)', ''];
  let odd = '';
  // vzorec a výsledek na zvláštních řádcích – vzorec bývá i popis nebo více vzorců, „ = výsledek“ by tvořilo nepravdivé rovnice
  for (const k of kroky) { if (k.oddil !== odd) { odd = k.oddil; o.push(odd.toUpperCase()); } o.push(`${k.nazev}: ${k.vzorec}`, `    výsledek: ${k.vysledek}`); }
  if (chybi.length) o.push('', `CHYBÍ VSTUPY: ${chybi.join('; ')}`);
  o.push('', 'SHRNUTÍ', shrnutiSaP(d));
  if (d.poznamka?.trim()) o.push('', 'POZNÁMKA', d.poznamka.trim());
  o.push('', 'Výpočet je pomůcka podle metodiky; správnost vstupů a výsledku ověřuje zpracovatel.');
  return o.join('\n');
}
