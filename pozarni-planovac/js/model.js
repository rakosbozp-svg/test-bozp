// Datový model Požárního plánovače (DZP). Čistý ES modul bez závislostí – běží v prohlížeči i v Node.
// Pole karty kopírují vzor operativní karty HZS Středočeského kraje (podklady/VZOR_OPERATIVNI_KARTA.docx).
// Pravidlo vzoru: pole se nemažou; co nelze doplnit, má hodnotu "NE". Prázdné pole = zatím nevyplněno.

export const SCHEMA_VERSION = 1;
export const NE = 'NE';

export const TYPY_LISTU = ['karta', 'situace', 'pudorys', 'schema', 'text'];
export const TYPY_DOKUMENTU = ['operativni_karta', 'operativni_plan'];
export const STAV_OVERENI = ['neoveren', 'overeno'];

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

export const prazdnaKarta = () => ({
  stupenPoplachu: '',
  uzemniOdbor: '',               // místně příslušný ÚO HZS
  objekt: {
    nazev: '', provozovatel: '', ic: '', adresa: '',
    gps: { sirka: null, delka: null },
    provoz: { pracovniDoba: '', kontaktTelefon: '', kontaktJmeno: '' },
    obsazeniOsobami: '', prijezdZ: '', omezeni: '',
  },
  charakter: {
    ucelStavby: '', podlazi: '', pudorysM: '', konstrukce: '', unikoveCesty: '', celkovaVyskaM: '',
    steny: '', priccky: '', vytahy: '', zastavenaPlochaM2: '', stropy: '', strecha: '',
    typUnikoveCesty: '', pozarniUseky: '',
  },
  nebezpeci: [],                 // {id, popis, hasivo, znackaId}; bez nebezpečí = jediná položka s popisem "NE"
  fve: { pritomna: null, popis: '', vykonKWp: null, pocetPanelu: null, baterie: null, vypinacSilovaCast: '', hasivo: '' },
  media: {                       // uzávěry a vypínače – text nebo "NE"
    hlavniUzaverVody: '', vedlejsiUzaverVody: '', hlavniUzaverPlynu: '', vedlejsiUzaverPlynu: '',
    hlavniUzaverTopeni: '', vedlejsiUzaverTopeni: '', hlavniVypinacEl: '', vedlejsiVypinacEl: '',
  },
  pbz: { eps: '', zdhpp: '', apz: '', zdp: '', shz: '', pshz: '', zokt: '', pk: '', vytahEvakuacni: '', vytahPozarni: '' },
  vodniZdroje: [],               // {id, typ: hydrant|nadrz|jiny, popis, prutokLs, objemM3, gps, znackaId, overenPrutok}
  doporuceni: '',                // pouze podstatné; musí obsahovat, co se stane při vypnutí energií
  znalostObjektu: { jmeno: '', mobil: '' },
  zpracoval: { jmeno: '', cisloOsvedceni: '', datum: '' },
  schvalil: { jmeno: '', funkce: '', datum: '' },
});

export const novyList = (typ, nazev) => {
  if (!TYPY_LISTU.includes(typ)) throw new Error(`Neznámý typ listu: ${typ}`);
  const list = { id: uid('list'), typ, nazev: nazev || typ, poradi: 0 };
  if (typ === 'karta') list.karta = prazdnaKarta();
  if (typ === 'text') list.text = '';
  if (typ === 'situace' || typ === 'pudorys' || typ === 'schema') {
    list.vykres = {
      format: 'A4', orientace: 'na_sirku',
      pozadi: null,                 // importovaný podklad {prilohaId, nazev, x, y, sirkaPx, vyskaPx, mNaPx, kryti, kalibrace, zamceno}
      meritko: { pomer: typ === 'situace' ? 1000 : 100 },   // měřítko tisku 1 : pomer
      okno: { x: 0, y: 0 },         // světová souřadnice (m) levého horního rohu rámu výkresu
      severka: { uhel: null },      // úhel severky ve stupních po směru hodin od svislice; null = neurčeno
      sit10m: true,                 // síť 10 × 10 m (metodika Hanuška 1996, kap. 2.3.1)
      vrstvy: [
        { id: 'zaklad', nazev: 'Stavby', viditelna: true, zamcena: false },
        { id: 'komunikace', nazev: 'Komunikace a plochy', viditelna: true, zamcena: false },
        { id: 'znacky', nazev: 'Značky', viditelna: true, zamcena: false },
        { id: 'trasy', nazev: 'Trasy', viditelna: true, zamcena: false },
        { id: 'popisky', nazev: 'Popisky', viditelna: true, zamcena: false },
      ],
      prvky: [],                    // viz js/kresleni/prvky.js
      legenda: [],                  // id použitých značek (synchronizuje editor)
      legendaZobrazit: true,
      razitko: { nazev: '', zpracoval: '', datum: '', schvalil: '' },
    };
  }
  return list;
};

export function novyProjekt({ nazev = 'Nová DZP', typ = 'operativni_karta' } = {}) {
  if (!TYPY_DOKUMENTU.includes(typ)) throw new Error(`Neznámý typ dokumentu: ${typ}`);
  const t = now();
  const p = {
    schemaVersion: SCHEMA_VERSION, id: uid('proj'), nazev, typ,
    vytvoreno: t, zmeneno: t,
    zdrojMetodiky: 'Vzor OK HZS Středočeského kraje; ověřit podle aktuální legislativy a s příslušným HZS',
    listy: [], revize: [], kontakty: [],
    prilohy: {},                 // importované podklady {id: {nazev, mime, data(dataURL)}} – součást zálohy projektu
    nastaveni: { velikostZnacky: 8, velikostTextu: 3 },   // výchozí velikosti nových prvků (mm na papíře, 1–500)
    poznamkyKOvereni: [],
  };
  if (typ === 'operativni_karta') {
    p.listy.push(novyList('karta', 'Operativní karta'), novyList('situace', 'Situace'));
    p.listy.forEach((l, i) => { l.poradi = i; });
  }
  return p;
}

export const pridejList = (p, typ, nazev) => {
  const l = novyList(typ, nazev);
  l.poradi = p.listy.length;
  p.listy.push(l);
  p.zmeneno = now();
  return l;
};

export const prejmenujList = (p, id, nazev) => {
  const l = najdiList(p, id); l.nazev = nazev; p.zmeneno = now(); return l;
};

export const smazList = (p, id) => {
  najdiList(p, id);
  p.listy = p.listy.filter((l) => l.id !== id);
  p.listy.forEach((l, i) => { l.poradi = i; });
  p.zmeneno = now();
};

export const kopirujList = (p, id) => {
  const orig = najdiList(p, id);
  const kopie = JSON.parse(JSON.stringify(orig));
  kopie.id = uid('list');
  kopie.nazev = `${orig.nazev} (kopie)`;
  const prefix = (it) => { if (it && it.id) it.id = uid('p'); };
  if (kopie.vykres) kopie.vykres.prvky.forEach(prefix);
  if (kopie.karta) { kopie.karta.nebezpeci.forEach(prefix); kopie.karta.vodniZdroje.forEach(prefix); }
  p.listy.splice(orig.poradi + 1, 0, kopie);
  p.listy.forEach((l, i) => { l.poradi = i; });
  p.zmeneno = now();
  return kopie;
};

export const presunList = (p, id, novePoradi) => {
  const i = p.listy.findIndex((l) => l.id === id);
  if (i < 0) throw new Error(`List neexistuje: ${id}`);
  const [l] = p.listy.splice(i, 1);
  p.listy.splice(Math.max(0, Math.min(novePoradi, p.listy.length)), 0, l);
  p.listy.forEach((x, k) => { x.poradi = k; });
  p.zmeneno = now();
};

export function najdiList(p, id) {
  const l = p.listy.find((x) => x.id === id);
  if (!l) throw new Error(`List neexistuje: ${id}`);
  return l;
}

export const pridejRevizi = (p, { popis, autor = '', datum = now().slice(0, 10) }) => {
  const cislo = p.revize.length + 1;
  p.revize.push({ cislo, datum, autor, popis });
  p.zmeneno = now();
  return cislo;
};

// Velikost značek/prvků: 1–500, krok 0,1, desetinné hodnoty (zadání).
export const VELIKOST_MIN = 1, VELIKOST_MAX = 500, VELIKOST_KROK = 0.1;
export function normalizujVelikost(v) {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  if (!Number.isFinite(n)) throw new Error(`Neplatná velikost: ${v}`);
  return Math.round(Math.min(VELIKOST_MAX, Math.max(VELIKOST_MIN, n)) * 10) / 10;
}

// Načtení uloženého projektu: kontrola verze, doplnění chybějících polí (zpětná kompatibilita), nic nemaže.
export function migruj(data) {
  if (!data || typeof data !== 'object') throw new Error('Projekt není objekt');
  if (typeof data.schemaVersion !== 'number') throw new Error('Chybí schemaVersion – není to projekt Požárního plánovače');
  if (data.schemaVersion > SCHEMA_VERSION) throw new Error(`Projekt je z novější verze (${data.schemaVersion}), tato verze umí ${SCHEMA_VERSION}`);
  const p = data;
  p.revize ||= []; p.kontakty ||= []; p.poznamkyKOvereni ||= []; p.prilohy ||= {}; p.nastaveni = { velikostZnacky: 8, velikostTextu: 3, ...(p.nastaveni || {}) };
  p.listy ||= [];
  for (const l of p.listy) {
    if (l.typ === 'karta') l.karta = sloz(prazdnaKarta(), l.karta || {});
    if (['situace', 'pudorys', 'schema'].includes(l.typ)) l.vykres = sloz(novyList(l.typ).vykres, l.vykres || {});
  }
  return p;
}

// Doplní chybějící klíče výchozími hodnotami; existující hodnoty (i pole) zachová.
function sloz(vychozi, data) {
  if (Array.isArray(vychozi) || vychozi === null || typeof vychozi !== 'object') return data === undefined ? vychozi : data;
  const out = { ...data };
  for (const k of Object.keys(vychozi)) out[k] = k in data ? sloz(vychozi[k], data[k]) : vychozi[k];
  return out;
}

// Odstraní importované podklady, na které už žádný list neodkazuje (po smazání listu nebo podkladu).
export function uklidPrilohy(p) {
  const pouzite = new Set(p.listy.map((l) => l.vykres?.pozadi?.prilohaId).filter(Boolean));
  for (const id of Object.keys(p.prilohy || {})) if (!pouzite.has(id)) delete p.prilohy[id];
}

export const serializuj = (p) => JSON.stringify(p, null, 1);
export const nactiProjekt = (text) => migruj(JSON.parse(text));
