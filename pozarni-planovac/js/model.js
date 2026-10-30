// Datový model Požárního plánovače (DZP). Čistý ES modul bez závislostí – běží v prohlížeči i v Node.
// Pole karty kopírují vzor operativní karty HZS Středočeského kraje (podklady/VZOR_operativni_karta_list_A4.docx).
// Pravidlo návodu: předpřipravená okénka se nemažou; co nelze doplnit, má hodnotu "NE". Prázdné pole = zatím nevyplněno.

import { prazdnaEvak } from './evakuace.js';
import { prazdnyEvakPlan } from './kresleni/evakplan.js';
import { prazdnyOpZaklad, prazdnyOpText } from './operativniplan.js';
import { prazdnySap } from './sap.js';
import { prazdnyDotaznik } from './dotaznik.js';
import { ocistiProjekt } from './ocista.js';

export const SCHEMA_VERSION = 1;
export const NE = 'NE';

export const TYPY_LISTU = ['karta', 'situace', 'pudorys', 'schema', 'text', 'evak_text', 'evak_plan', 'op_zaklad', 'op_text', 'op_sap'];
export const TYPY_LISTU_NAZVY = { karta: 'Operativní karta', situace: 'Situace', pudorys: 'Půdorys', schema: 'Schéma', text: 'Text', evak_text: 'Evakuační plán – text', evak_plan: 'Evakuační plán – podlaží', op_zaklad: 'OP – základní text', op_text: 'OP – textová část přílohy', op_sap: 'OP – výpočet SaP' };
export const TYPY_DOKUMENTU = ['operativni_karta', 'operativni_plan', 'evakuacni_plan'];
export const TYPY_DOKUMENTU_NAZVY = { operativni_karta: 'Operativní karta (DZP)', operativni_plan: 'Operativní plán (DZP)', evakuacni_plan: 'Požární evakuační plán' };
// Evakuační plán se NEMÍCHÁ s DZP: každý druh dokumentace smí mít jen své typy listů (společný je jen list Text).
export const LISTY_PRO_DOKUMENT = {
  operativni_karta: ['karta', 'situace', 'pudorys', 'schema', 'text'],
  operativni_plan: ['op_zaklad', 'op_sap', 'op_text', 'situace', 'pudorys', 'schema', 'karta', 'text'],
  evakuacni_plan: ['evak_text', 'evak_plan', 'text'],
};
export const jeEvakuace = (p) => p?.typ === 'evakuacni_plan';
export const STAV_OVERENI = ['neoveren', 'overeno'];

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const now = () => new Date().toISOString();

export const prazdnaKarta = () => ({
  stupenPoplachu: '',
  uzemniOdbor: '',               // „Stanice HZS“ ve vzoru (místně příslušná stanice)
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
    vytahEvakuacni: null, vytahPozarni: null,   // ano/ne – značka E/P v okénku VÝTAHY (vzor: „[E] 1 X“)
  },
  // {id, popis, hasivo, znackaId}; vzor má dva předtištěné řádky (hořlaviny, výbušniny) – bez nebezpečí se do nich vepíše "NE"
  nebezpeci: [{ id: uid('p'), popis: '', hasivo: '', znackaId: 'DZP-003' }, { id: uid('p'), popis: '', hasivo: '', znackaId: 'DZP-053' }],
  fve: { pritomna: null, popis: '', vykonKWp: null, pocetPanelu: null, baterie: null, vypinacSilovaCast: '', hasivo: '' },
  media: {                       // uzávěry médií v pořadí vzoru – umístění nebo "NE"
    hlavniUzaverPlynu: '', hlavniUzaverVody: '', hlavniUzaverTopeni: '', hlavniVypinacEl: '', totalStop: '', centralStop: '',
  },
  // KTPO, OPPO: umístění nebo "NE"; ostatní PBZ: '' neuvedeno, "NE" v objektu není, jinak je (upřesnění nebo "ANO")
  pbz: { ktpo: '', oppo: '', eps: '', zdhpp: '', apz: '', zdp: '', shz: '', pshz: '', zokt: '', pk: '' },
  vodniZdroje: [],               // {id, typ: hydrant|nadrz|jiny, popis, prutokLs, objemM3, gps, znackaId, overenPrutok}
  doporuceni: '',                // pouze podstatné; musí obsahovat, co se stane při vypnutí energií
  znalostObjektu: { jmeno: '', mobil: '', funkce: '' },
  zpracoval: { jmeno: '', cisloOsvedceni: '', datum: '' },
  schvalil: { jmeno: '', funkce: '', datum: '' },
  mimoVzor: [],                  // {nazev, hodnota} – údaje ze starší verze karty, které vzor nemá (netisknou se, viz migrujKartu)
});

// Starší verze karty měla vedlejší uzávěry (vzor A4 je nemá) a výtahy mezi PBZ. Vyplněné údaje se neztratí:
// výtahy se přesunou do charakteru objektu, ostatní do mimoVzor (formulář je ukáže, kontrola na ně upozorní).
function migrujKartu(k) {
  const nic = (v) => v === null || v === undefined || String(v).trim() === '';
  const jeNe = (v) => String(v).trim().toUpperCase() === 'NE';
  const odloz = (nazev, v) => { if (!nic(v) && !jeNe(v) && !k.mimoVzor.some((x) => x.nazev === nazev && x.hodnota === String(v))) k.mimoVzor.push({ nazev, hodnota: String(v) }); };
  if (!Array.isArray(k.mimoVzor)) k.mimoVzor = [];
  for (const [klic, nazev] of [['vedlejsiUzaverVody', 'Vedlejší uzávěr vody'], ['vedlejsiUzaverPlynu', 'Vedlejší uzávěr plynu'], ['vedlejsiUzaverTopeni', 'Vedlejší uzávěr topení'], ['vedlejsiVypinacEl', 'Vedlejší vypínač el. proudu']]) {
    if (klic in k.media) { odloz(nazev, k.media[klic]); delete k.media[klic]; }
  }
  for (const [klic, nazev] of [['vytahEvakuacni', 'Výtah evakuační'], ['vytahPozarni', 'Výtah požární']]) {
    if (!(klic in k.pbz)) continue;
    const v = k.pbz[klic]; delete k.pbz[klic];
    if (nic(v)) continue;
    if (k.charakter[klic] === null) k.charakter[klic] = !jeNe(v);
    if (!jeNe(v) && String(v).trim().toUpperCase() !== 'ANO') { if (nic(k.charakter.vytahy)) k.charakter.vytahy = String(v).trim(); else if (String(v).trim() !== String(k.charakter.vytahy).trim()) odloz(`${nazev} (dříve mezi PBZ)`, v); }
  }
  return k;
}

export const novyList = (typ, nazev) => {
  if (!TYPY_LISTU.includes(typ)) throw new Error(`Neznámý typ listu: ${typ}`);
  const list = { id: uid('list'), typ, nazev: nazev || typ, poradi: 0 };
  if (typ === 'karta') list.karta = prazdnaKarta();
  if (typ === 'text') list.text = '';
  if (typ === 'evak_text') list.evak = prazdnaEvak();
  if (typ === 'op_zaklad') list.opZaklad = prazdnyOpZaklad();
  if (typ === 'op_text') list.opText = prazdnyOpText();
  if (typ === 'op_sap') list.opSap = prazdnySap();
  if (typ === 'situace' || typ === 'pudorys' || typ === 'schema' || typ === 'evak_plan') {
    list.vykres = {
      format: 'A4', orientace: 'na_sirku',
      pozadi: null,                 // importovaný podklad {prilohaId, nazev, x, y, sirkaPx, vyskaPx, mNaPx, kryti, kalibrace, zamceno}
      meritko: { pomer: typ === 'situace' ? 1000 : 100 },   // měřítko tisku 1 : pomer   // měřítko tisku 1 : pomer
      meritkoZdroj: null,           // po vektorovém importu {zdroj, popis, overeno}; neověřené měřítko se kalibruje podle známé délky
      okno: { x: 0, y: 0 },         // světová souřadnice (m) levého horního rohu rámu výkresu
      severka: { uhel: null },      // úhel severky ve stupních po směru hodin od svislice; null = neurčeno
      sit10m: true,                 // síť 10 × 10 m (metodika Hanuška 1996, kap. 2.3.1)
      vrstvy: [
        { id: 'zaklad', nazev: 'Stavby', viditelna: true, zamcena: false },
        { id: 'komunikace', nazev: 'Komunikace a plochy', viditelna: true, zamcena: false },
        { id: 'znacky', nazev: 'Značky', viditelna: true, zamcena: false },
        { id: 'trasy', nazev: 'Únikové cesty', viditelna: true, zamcena: false },
        { id: 'popisky', nazev: 'Popisky', viditelna: true, zamcena: false },
      ],
      prvky: [],                    // viz js/kresleni/prvky.js
      legenda: [],                  // id použitých značek (synchronizuje editor)
      legendaZobrazit: true,
      legendaPoloha: 'vpravo-dole',  // roh rámu výkresu s legendou (DZP)
      razitko: { nazev: '', zpracoval: '', datum: '', schvalil: '' },
    };
    if (typ === 'evak_plan') { list.vykres.format = 'A3'; list.vykres.sit10m = false; list.vykres.evakPlan = prazdnyEvakPlan(); }   // A3 je minimum podle ČSN ISO 23601
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
    dotaznik: prazdnyDotaznik(), // sběrný dotazník pro klienta (DZP) – odpovědi, viz js/dotaznik.js
    evakZnacky: {},              // evakuační plán: nahrané značky {slotId: {png, soubor}} (viz js/evakznacky.js)
    prilohy: {},                 // importované podklady {id: {nazev, mime, data(dataURL)}} – součást zálohy projektu
    nastaveni: { velikostZnacky: 8, velikostTextu: 3 },   // výchozí velikosti nových prvků (mm na papíře, 1–500)
    poznamkyKOvereni: [],
  };
  if (typ === 'operativni_karta') {
    p.listy.push(novyList('karta', 'Operativní karta'), novyList('situace', 'Situace'));
    p.listy.forEach((l, i) => { l.poradi = i; });
  }
  if (typ === 'operativni_plan') {   // Hanuška 1996, kap. 2: základní text + vyjímatelná příloha (text, situace, půdorys)
    p.listy.push(novyList('op_zaklad', 'Základní text OP'), novyList('op_sap', 'Výpočet SaP'), novyList('op_text', 'Vyjímatelná příloha – text'), novyList('situace', 'Situace podniku'), novyList('pudorys', 'Půdorys'));
    p.listy.forEach((l, i) => { l.poradi = i; });
  }
  if (typ === 'evakuacni_plan') {
    p.zdrojMetodiky = 'Vyhláška č. 246/2001 Sb., § 33 a § 40 (požární evakuační plán); grafické listy podle výtahu požadavků ČSN ISO 23601 (nezávazná)';
    p.listy.push(novyList('evak_text', 'Evakuační plán – text'), novyList('evak_plan', 'Únikový plán – 1. podlaží'));
    p.listy.forEach((l, i) => { l.poradi = i; });
  }
  return p;
}

export const pridejList = (p, typ, nazev) => {
  if (!(LISTY_PRO_DOKUMENT[p.typ] || TYPY_LISTU).includes(typ)) throw new Error(`List „${TYPY_LISTU_NAZVY[typ] || typ}“ nepatří do dokumentace „${TYPY_DOKUMENTU_NAZVY[p.typ] || p.typ}“ (DZP a evakuační plán se nemíchají).`);
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
  if (kopie.vykres) {   // nová id prvků; dveře musí dál odkazovat na svou stěnu (v kopii)
    const nova = new Map(kopie.vykres.prvky.map((x) => { const stare = x.id; prefix(x); return [stare, x.id]; }));
    for (const x of kopie.vykres.prvky) if (x.stenaId) x.stenaId = nova.get(x.stenaId) ?? null;
  }
  for (const d of [kopie.opZaklad, kopie.opText, kopie.opSap]) if (d) for (const v of Object.values(d)) if (Array.isArray(v)) v.forEach(prefix);
  if (kopie.evak) { kopie.evak.osoby.forEach(prefix); kopie.evak.shromazdiste.forEach(prefix); }
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
  // Import cizího souboru: id musí být bezpečná (vkládají se do odkazů a atributů), druh dokumentace a listů známý.
  opravId(p);
  if (!TYPY_DOKUMENTU.includes(p.typ)) p.typ = 'operativni_karta';
  if (Array.isArray(p.listy)) p.listy = p.listy.filter((l) => l && TYPY_LISTU.includes(l.typ));
  // Druh dokumentace smí mít jen své listy (DZP a evakuační plán se nemíchají – i u souboru upraveného mimo aplikaci).
  // Cizí list se nezahodí: přesune se do p.vyrazeneListy (zůstane v souboru projektu) a kontrola úplnosti na to upozorní.
  if (Array.isArray(p.listy) && p.listy.some((l) => !LISTY_PRO_DOKUMENT[p.typ].includes(l.typ))) {
    p.vyrazeneListy = [...(Array.isArray(p.vyrazeneListy) ? p.vyrazeneListy : []), ...p.listy.filter((l) => !LISTY_PRO_DOKUMENT[p.typ].includes(l.typ))];
    p.listy = p.listy.filter((l) => LISTY_PRO_DOKUMENT[p.typ].includes(l.typ));
    p.listy.forEach((l, i) => { l.poradi = i; });
  }
  if (typeof p.nazev !== 'string') p.nazev = String(p.nazev ?? 'Projekt');
  p.revize ||= []; p.kontakty ||= []; p.poznamkyKOvereni ||= []; p.prilohy ||= {}; p.evakZnacky ||= {}; p.dotaznik = { ...prazdnyDotaznik(), ...(p.dotaznik || {}) }; p.nastaveni = { velikostZnacky: 8, velikostTextu: 3, ...(p.nastaveni || {}) };
  p.listy ||= [];
  for (const l of p.listy) {
    if (l.typ === 'karta') l.karta = migrujKartu(sloz(prazdnaKarta(), l.karta || {}));
    if (l.typ === 'evak_text') l.evak = sloz(prazdnaEvak(), l.evak || {});
    if (l.typ === 'op_zaklad') l.opZaklad = sloz(prazdnyOpZaklad(), l.opZaklad || {});
    if (l.typ === 'op_text') l.opText = sloz(prazdnyOpText(), l.opText || {});
    if (l.typ === 'op_sap') l.opSap = sloz(prazdnySap(), l.opSap || {});
    if (['situace', 'pudorys', 'schema', 'evak_plan'].includes(l.typ)) l.vykres = sloz(novyList(l.typ).vykres, l.vykres || {});
  }
  ocistiProjekt(p, { vychoziVrstvy: (typ) => novyList(typ).vykres.vrstvy });   // typy hodnot z cizího souboru (barvy, čísla, obrázky), chybějící id a datum
  return p;
}

// Každé „id“ v projektu (projekt, listy, položky, prvky výkresu) musí být jen písmena, číslice, _ a -; jinak se vygeneruje nové.
const OK_ID = /^[\w-]{1,80}$/;
function opravId(o) {
  if (Array.isArray(o)) { o.forEach(opravId); return; }
  if (!o || typeof o !== 'object') return;
  for (const [k, v] of Object.entries(o)) {
    if (k === 'id' && !((typeof v === 'string' && OK_ID.test(v)) || Number.isFinite(v) || v == null)) o.id = uid('id');
    else if (v && typeof v === 'object') opravId(v);
  }
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

// Soubor zálohy všech projektů (js/ulozeni.js → stahniZalohu). Vrací null, není-li text zálohou;
// jinak { projekty, chyby, vytvoreno } – vadný projekt se přeskočí a uvede v chybách, ostatní se obnoví.
export const FORMAT_ZALOHY = 'pozarni-planovac-zaloha';
export function nactiZalohu(text) {
  const d = JSON.parse(text);
  if (!d || d.format !== FORMAT_ZALOHY) return null;
  if (!Array.isArray(d.projekty)) throw new Error('Záloha neobsahuje seznam projektů');
  const projekty = [], chyby = [];
  d.projekty.forEach((x, i) => { try { projekty.push(migruj(x)); } catch (e) { chyby.push(`${typeof x?.nazev === 'string' ? x.nazev : `projekt č. ${i + 1}`}: ${e.message}`); } });
  return { projekty, chyby, vytvoreno: typeof d.vytvoreno === 'string' ? d.vytvoreno : null };
}
export const nactiProjekt = (text) => migruj(JSON.parse(text));
