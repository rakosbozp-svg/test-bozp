// Výpočet sil a prostředků jednotek PO (SaP) podle Metodického návodu k vypracování DZP (Hanuška 1996), část druhá.
// Vzorce a tabulky převzaty ze stran 25–51 metodiky (podklady/Metodicky_navod_DZP_1996.pdf). Každý krok výpočtu se vypisuje
// i se vzorcem a dosazenými hodnotami, aby ho zpracovatel mohl zkontrolovat. Výsledek ověřuje zpracovatel / HZS.
//
// Pozn. k nejasnosti ve zdroji: ve vzorci doby volného rozvoje (kap. 4.1) je u doby bojového rozvinutí horní index „Po“,
// ale vysvětlivka pod vzorcem i časové schéma na str. 29 uvádějí dobu bojového rozvinutí PRVNÍ jednotky (t_BR^Pr).
// Výpočet používá t_BR^Pr (schéma a vysvětlivka) a v protokolu to uvádí.

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
export const DRUZSTVA = { '1+2': [200, 1, 'proudnice: 1 C'], '1+3': [400, 1, '1 C nebo 1 B'], '1+5': [600, 2, '2 C nebo 1 C + 1 B'], '1+8': [800, 3, '3 C nebo 2 C + 1 B'] };   // kap. 5.4 [qA, npr]
export const PROUDNICE = [['200', 'C 52 – hubice 12,5 (200 l/min)'], ['337', 'C 52 – hubice 16 (337 l/min)'], ['400', 'B 75 – hubice 18 (400 l/min)'], ['800', 'B 75 – hubice 25 (800 l/min)']];   // tab. 4
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
  dych: { pL: null, VL: null, prace: 'stredni' },
  dalkova: { Lh: null, H: null, prutok: '600', hadice: 'izolovane' },
  kyvadlo: { L: null, Vnc: null, Qc: null, qv: null },
  pena: { N: null, qpr: null, pp: null },
  poznamka: '',
});

const cislo = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const kladne = (v) => { const n = cislo(v); return n !== null && Number.isFinite(n) && n > 0 ? n : null; };
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
// opt.tbrPo: varianta podle vzorce v metodice (doba bojového rozvinutí POSLEDNÍ jednotky) – počítá se jen pro kontrolu.
export function vypocetSaP(d, opt = {}) {
  const kroky = [], chybi = [], v = {};
  const krok = (oddil, nazev, vzorec, vysledek) => kroky.push({ oddil, nazev, vzorec, vysledek });

  // ---- 1. Doby (kap. 3.2, 4.1, 4.2) ----
  const jed = d.jednotky.map((j) => {
    const tv = DOBA_VYJEZDU[j.druh]?.[0], L = cislo(j.L);
    if (L === null || tv === undefined) return null;
    const tj = (60 * L) / V_JIZDY;
    return { ...j, tv, tj, tDO: tv + tj, tBR: cislo(j.tBR) };
  }).filter(Boolean);
  if (!d.jednotky.length) chybi.push('jednotky PO podle požárního poplachového plánu (druh, vzdálenost, doba bojového rozvinutí)');
  else if (jed.length < d.jednotky.length) chybi.push('u některé jednotky chybí vzdálenost L');
  for (const j of jed) krok('Doby', `Dojezd – ${j.nazev || 'jednotka'}`, `tDO = tv + 60·L/vJ = ${f(j.tv)} + 60·${f(j.L, 2)}/${V_JIZDY}`, `${f(j.tDO)} min`);
  let tVR = null, t1 = null, t2 = null, t3 = null, tUh = null;
  const tZP = cislo(d.tZP), tOH = cislo(d.tOH);
  if (tZP === null) chybi.push('doba zpozorování požáru tZP'); if (tOH === null) chybi.push('doba ohlášení požáru tOH');
  if (jed.length) {
    const pr = jed.reduce((a, b) => (b.tDO < a.tDO ? b : a)), po = jed.reduce((a, b) => (b.tDO > a.tDO ? b : a));
    v.prvni = pr.nazev; v.posledni = po.nazev;
    const tR = po.tDO - pr.tDO; v.tR = tR;
    krok('Doby', 'Rozdíl dojezdů poslední a první jednotky', `tR = tDO(Po) − tDO(Pr) = ${f(po.tDO)} − ${f(pr.tDO)}`, `${f(tR)} min`);
    if (pr.tBR === null || po.tBR === null) chybi.push('doba bojového rozvinutí první a poslední jednotky tBR (informativně tab. 10)');
    const tbr = opt.tbrPo ? po.tBR : pr.tBR;
    if (tZP !== null && tOH !== null && tbr !== null) {
      tVR = tZP + tOH + pr.tDO + tbr; v.tVR = tVR;
      krok('Doby', 'Doba volného rozvoje požáru', opt.tbrPo ? `tVR = tZP + tOH + tDO(Pr) + tBR(Po) = ${f(tZP)} + ${f(tOH)} + ${f(pr.tDO)} + ${f(tbr)}  [varianta podle vzorce v metodice]` : `tVR = tZP + tOH + tDO(Pr) + tBR(Pr) = ${f(tZP)} + ${f(tOH)} + ${f(pr.tDO)} + ${f(tbr)}  [ve vzorci zdroje horní index „Po“ – použito „Pr“ dle vysvětlivky a schématu; varianta „Po“ je spočtena v kontrole na konci]`, `${f(tVR)} min`);
      t1 = Math.min(10, tVR); t2 = Math.max(0, tVR - 10);
      krok('Doby', 'Doba rozhořívání a volného rozvoje', `t1 = min(10; tVR), t2 = tVR − t1`, `t1 = ${f(t1)} min, t2 = ${f(t2)} min`);
    }
    if (po.tBR !== null && pr.tBR !== null) v._tBR = [pr.tBR, po.tBR];
  }

  // ---- 2. Prostor a parametry požáru (tab. 1, kap. 4.2, 4.3) ----
  const pro = najdiProstor(d.prostor);
  const io = cislo(d.ioVlastni) ?? pro?.io ?? null, ip = cislo(d.ipVlastni) ?? pro?.ip ?? null, v1 = cislo(d.v1Vlastni) ?? pro?.v1 ?? null;
  if (!pro && cislo(d.ipVlastni) === null) chybi.push('druh prostoru podle tabulky č. 1 (nebo vlastní intenzita)');
  if (pro) krok('Požár', 'Prostor (tabulka č. 1)', `${pro.trida}: ${pro.nazev}`, `Io = ${f(io)} l/m/min, Ip = ${f(ip)} l/m²/min, v1 = ${v1 === null ? 'neuvedeno' : `${f(v1)} m/min`}${(cislo(d.ioVlastni) ?? cislo(d.ipVlastni) ?? cislo(d.v1Vlastni)) !== null ? ' (část hodnot zadána ručně)' : ''}`);
  if (v1 !== null) {
    tUh = v1 <= 2 ? 5 : v1 <= 3 ? 10 : 15;
    krok('Požár', 'Doba uhasínání (lokalizace) po nasazení posledních SaP', `v1 = ${f(v1)} m/min → ${v1 <= 2 ? 'do 2' : v1 <= 3 ? 'nad 2 do 3' : 'nad 3'} m/min (kap. 3.3)`, `${tUh} min`);
  }
  if (v._tBR && tUh !== null && v.tR !== undefined) {
    t3 = v.tR + v._tBR[1] - v._tBR[0] + tUh;
    krok('Požár', 'Doba šíření od nasazení prvních proudů do lokalizace', `t3 = tR + tBR(Po) − tBR(Pr) + tuh = ${f(v.tR)} + ${f(v._tBR[1])} − ${f(v._tBR[0])} + ${tUh}`, `${f(t3)} min`);
  }
  let R = null;
  if (v1 === null && pro) chybi.push('lineární rychlost šíření v1 (v tab. 1 neuvedena – zadejte ručně, nebo počítejte celou plochu)');
  if (v1 !== null && tVR !== null) {
    const R1 = tVR <= 10 ? 0.5 * v1 * tVR : 5 * v1 + v1 * t2;
    krok('Požár', 'Rádius v době nasazení prvních proudů', tVR <= 10 ? `R = 0,5·v1·t1 = 0,5·${f(v1)}·${f(tVR)}` : `R = 5·v1 + v1·t2 = 5·${f(v1)} + ${f(v1)}·${f(t2)}`, `${f(R1, 2)} m`);
    R = R1;
    if (d.rPro === 'lokalizace' && t3 !== null) {
      R = R1 + 0.5 * v1 * t3;
      krok('Požár', 'Rádius v době lokalizace', `R = R(prvních proudů) + 0,5·v1·t3 = ${f(R1, 2)} + 0,5·${f(v1)}·${f(t3)}`, `${f(R, 2)} m`);
    }
  }
  const h = kladne(d.h) ?? 5;
  let Sp = null, Sh = null;
  if (R !== null) {
    if (d.forma === 'kruh') { Sp = Math.PI * R ** 2; Sh = R <= h ? Sp : Math.PI * (R ** 2 - (R - h) ** 2); krok('Požár', 'Plocha požáru a hašení – kruhová forma', `Sp = π·R², Sh = π·[R² − (R − h)²], h = ${f(h)} m`, `Sp = ${f(Sp)} m², Sh = ${f(Sh)} m²`); }
    if (d.forma === 'uhel') { const fk = UHLY[d.uhel] ?? 0.5; Sp = fk * Math.PI * R ** 2; Sh = R <= h ? Sp : fk * Math.PI * (R ** 2 - (R - h) ** 2); krok('Požár', `Plocha požáru a hašení – úhlová forma (β = ${d.uhel}°, f = ${fk})`, `Sp = f·π·R², Sh = f·π·[R² − (R − h)²], h = ${f(h)} m`, `Sp = ${f(Sp)} m², Sh = ${f(Sh)} m²`); }
    if (d.forma === 'pravouhla') {
      const a = kladne(d.a), n = kladne(d.n) ?? 1;
      if (a === null) chybi.push('šířka prostoru a (pravoúhlá forma)');
      else { Sp = n * R * a; Sh = R <= h ? Sp : n * h * a; krok('Požár', `Plocha požáru a hašení – pravoúhlá forma (n = ${n}, a = ${f(a)} m)`, `Sp = n·R·a, Sh = n·h·a, h = ${f(h)} m`, `Sp = ${f(Sp)} m², Sh = ${f(Sh)} m²`); }
    }
    const Su = kladne(d.plochaUseku);
    if (Sp !== null && Su !== null && Sp > 0.85 * Su) {
      krok('Požár', 'Omezení plochou požárního úseku', `Sp ${f(Sp)} m² > 85 % plochy úseku (${f(Su)} m²) → počítá se celý úsek (kap. 4.2)`, `Sp = ${f(Su)} m²${Sh > Su ? `, Sh = ${f(Su)} m²` : ''}`);
      Sp = Su; Sh = Math.min(Sh, Su);
    }
  }
  v.Sp = Sp; v.Sh = Sh; v.R = R;

  // ---- 3. Dodávka hasiva (kap. 5.2) ----
  let Qh = null;
  if (d.zpusob === 'fronta') {
    const Oh = kladne(d.Oh);
    if (Oh === null) chybi.push('fronta hašení Oh'); else if (io === null) chybi.push('intenzita na obvod Io (v tab. 1 pro tento prostor neuvedena)');
    else { Qh = Oh * io; krok('Hasivo', 'Dodávka na hašení – podle fronty', `Qh = Oh·Io = ${f(Oh)}·${f(io)}`, `${f(Qh, 0)} l/min`); }
  } else if (Sh !== null && ip !== null) { Qh = Sh * ip; krok('Hasivo', 'Dodávka na hašení – podle plochy', `Qh = Sh·Ip = ${f(Sh)}·${f(ip)}`, `${f(Qh, 0)} l/min`); }
  let Qo = 0;
  const D = kladne(d.nadrzD), Ds = kladne(d.sousedniD), m = kladne(d.sousedniM), Qochr = kladne(d.ochranaQ);
  if (D !== null) { const x = Math.PI * D * (kladne(d.nadrzIo) ?? 30); Qo += x; krok('Hasivo', 'Ochlazování hořící nádrže', `Qo = π·D·Io = π·${f(D)}·${f(kladne(d.nadrzIo) ?? 30)}`, `${f(x, 0)} l/min`); }
  if (Ds !== null && m !== null) { const x = 0.5 * Math.PI * Ds * (kladne(d.sousedniIo) ?? 12) * m; Qo += x; krok('Hasivo', 'Ochlazování sousedních nádrží', `Qo = 0,5·π·D·Io·m = 0,5·π·${f(Ds)}·${f(kladne(d.sousedniIo) ?? 12)}·${f(m, 0)}`, `${f(x, 0)} l/min`); }
  if (Qochr !== null) { Qo += Qochr; krok('Hasivo', 'Ochrana ostatních objektů (zadáno)', 'dle počtu míst ochrany / tab. 2', `${f(Qochr, 0)} l/min`); }
  const Qp = Qh !== null ? Qh + Qo : null;
  if (Qp !== null) krok('Hasivo', 'Celková potřebná dodávka vody', `Qp = Qh + Qo = ${f(Qh, 0)} + ${f(Qo, 0)}`, `${f(Qp, 0)} l/min`);
  v.Qh = Qh; v.Qo = Qo; v.Qp = Qp;

  // ---- 4. Proudy, technika, hasiči (kap. 5.3, 5.4) ----
  const qh = kladne(d.qprH), qo = kladne(d.qprO) ?? qh;
  if (Qh !== null && qh !== null) {
    const Nh = nahoru(Qh / qh), No = Qo > 0 ? nahoru(Qo / qo) : 0, Npr = Nh + No;
    krok('SaP', 'Počet proudů', `Nh = Qh/qpr = ${f(Qh, 0)}/${f(qh, 0)}; No = Qo/qpr = ${f(Qo, 0)}/${f(qo, 0)}; Npr = Nh + No`, `Nh = ${Nh}, No = ${No}, Npr = ${Npr}`);
    const dr = DRUZSTVA[d.druzstvo] || DRUZSTVA['1+5'], Qc = kladne(d.Qc);
    const NA1 = nahoru(Qp / dr[0]), NA2 = nahoru(Npr / dr[1]);
    krok('SaP', `Počet automobilů (družstev ${d.druzstvo})`, `NA = Qp/qA = ${f(Qp, 0)}/${dr[0]}; NA = Npr/npr = ${Npr}/${dr[1]}`, `${NA1} podle dodávky, ${NA2} podle proudnic → ${Math.max(NA1, NA2)}`);
    let NAN = null;
    if (Qc === null) chybi.push('výkon čerpadla Qc (vyberte CAS 20 / CAS 30 podle vyhl. 35/2007 Sb. nebo zadejte výkon konkrétního vozu)');
    if (Qc !== null) { NAN = nahoru((Nh * qh + No * qo) / (0.75 * Qc)); krok('SaP', 'Technika nutná k dodávce hasiva', `NA(N) = Σ(Npr·qpr)/(0,75·Qc) = ${f(Nh * qh + No * qo, 0)}/(0,75·${f(Qc, 0)})`, `${NAN}`); }
    const kH = kladne(d.kH) ?? 2, kO = kladne(d.kO) ?? 2, NHa = nahoru(1.25 * (kH * Nh + kO * No));
    krok('SaP', 'Přibližný počet hasičů', `NHa = 1,25·Σ(ki·Npri) = 1,25·(${f(kH)}·${Nh} + ${f(kO)}·${No})`, `${NHa}`);
    Object.assign(v, { Nh, No, Npr, NA: Math.max(NA1, NA2), NAN, NHa });
    const zKarty = kladne(d.vydatnost) === null ? KONTEXT.get(d)?.vydatnost : null, vyd = kladne(d.vydatnost) ?? zKarty?.lmin ?? null;
    if (vyd !== null) { const sp = Nh * qh + No * qo; krok('SaP', 'Porovnání se zdrojem vody', `skutečná spotřeba ${f(sp, 0)} l/min × vydatnost ${f(vyd, 0)} l/min${zKarty ? ` (vydatnost nezadána – z karty: ${zKarty.popis})` : ''}`, sp <= vyd ? 'vyhovuje' : `chybí ${f(sp - vyd, 0)} l/min → dálková doprava vody`); v.voda = sp <= vyd; }
  }

  // ---- 5. Dýchací technika (kap. 5.5) ----
  const pL = kladne(d.dych.pL), VL = kladne(d.dych.VL), MV = PRACE_MV[d.dych.prace];
  if (pL !== null && VL !== null && MV) {
    const To = (10 * pL * VL) / MV; v.To = To;
    krok('Dýchací technika', 'Ochranná doba přístroje', `To = 10·pL·VL/MV = 10·${f(pL)}·${f(VL)}/${MV}`, `${f(To)} min${t3 !== null ? ` → ${t3 < To ? 'lokalizace do ochranné doby: záloha 25 %' : 'lokalizace delší než ochranná doba: záloha 100 % hasičů'}` : ''}`);
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
  const Np = kladne(d.pena.N), qpp = kladne(d.pena.qpr), pp = kladne(d.pena.pp);
  if (Np !== null && qpp !== null && pp !== null) {
    const qp = 0.01 * qpp * pp, Vp = Np * qp * 10 * 3;
    krok('Pěna', 'Zásoba pěnidla', `qp = 0,01·qpr·pp = 0,01·${f(qpp, 0)}·${f(pp)}; Vp = Npr·qp·tn·z = ${f(Np, 0)}·${f(qp, 2)}·10·3`, `${f(Vp, 0)} l`); v.Vp = Vp;
  }
  // Kontrola nejednoznačnosti metodiky: stejný výpočet s tBR poslední jednotky (vzorec ve zdroji)
  if (!opt.tbrPo && v._tBR && v._tBR[0] !== v._tBR[1] && v.Npr !== undefined) {
    const a = vypocetSaP(d, { tbrPo: true }).vysledky;
    if (a.Npr !== undefined) {
      const vic = a.Npr !== v.Npr || a.NA !== v.NA;
      v.varianta = { tVR: a.tVR, Qp: a.Qp, Npr: a.Npr, NA: a.NA, NHa: a.NHa, vic };
      krok('Kontrola', 'Varianta podle vzorce v metodice (tBR poslední jednotky)', `tVR = ${f(a.tVR)} min místo ${f(v.tVR)} min`, `Qp = ${f(a.Qp, 0)} l/min, ${a.Npr} proudů, ${a.NA} automobilů${vic ? ' – VÍCE sil než hlavní výpočet, rozhodněte s HZS' : ' – stejný počet proudů i automobilů, nejednoznačnost výsledek nemění'}`);
    }
  }
  return { kroky, chybi, vysledky: v };
}

// Krátké shrnutí výsledku (do základního textu OP).
export function shrnutiSaP(d) {
  const { vysledky: v, chybi } = vypocetSaP(d);
  if (v.Npr === undefined) return `Výpočet SaP není úplný – chybí: ${chybi.join('; ')}.`;
  return [`Výpočet SaP (Hanuška 1996, část druhá): Qp = ${f(v.Qp, 0)} l/min, ${v.Npr} proudů (${v.Nh} hašení, ${v.No} ochlazování/ochrana), ${v.NA} požárních automobilů (družstvo ${d.druzstvo})${v.NAN !== null ? `, z toho ${v.NAN} k dodávce hasiva` : ''}, přibližně ${v.NHa} hasičů.`,
    v.Sp !== null && v.Sp !== undefined ? `Plocha požáru ${f(v.Sp)} m², plocha hašení ${f(v.Sh)} m².` : '',
    v.voda === false ? 'Vydatnost zdroje vody nestačí – nutná dálková doprava vody.' : v.voda === true ? 'Vydatnost zdroje vody vyhovuje.' : '',
    v.To !== undefined ? `Ochranná doba dýchacího přístroje ${f(v.To)} min.` : '',
    v.Vp !== undefined ? `Zásoba pěnidla ${f(v.Vp, 0)} l.` : '',
    v.varianta?.vic ? `Podle vzorce v metodice (doba bojového rozvinutí poslední jednotky) by vyšlo ${v.varianta.Npr} proudů a ${v.varianta.NA} automobilů – nejednoznačnost metodiky, ověřte s HZS.` : ''].filter(Boolean).join(' ');
}

export function sapJakoText(d) {
  const { kroky, chybi } = vypocetSaP(d), o = ['VÝPOČET SIL A PROSTŘEDKŮ (Hanuška 1996, část druhá)', ''];
  let odd = '';
  for (const k of kroky) { if (k.oddil !== odd) { odd = k.oddil; o.push(odd.toUpperCase()); } o.push(`${k.nazev}: ${k.vzorec} = ${k.vysledek}`); }
  if (chybi.length) o.push('', `CHYBÍ VSTUPY: ${chybi.join('; ')}`);
  o.push('', 'SHRNUTÍ', shrnutiSaP(d));
  if (d.poznamka?.trim()) o.push('', 'POZNÁMKA', d.poznamka.trim());
  o.push('', 'Výpočet je pomůcka podle metodiky; správnost vstupů a výsledku ověřuje zpracovatel.');
  return o.join('\n');
}
