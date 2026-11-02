// Očista dat projektu po načtení (soubor .pplan.json, záloha všech projektů, úložiště prohlížeče). Hodnoty z cizího souboru
// se vkládají do HTML a SVG, proto musí mít očekávaný typ: barvy jen #rgb / #rrggbb, čísla konečná, obrázky jen
// data:image/(png|jpeg|webp|svg+xml);base64, texty jako řetězce. Neplatná hodnota se nahradí výchozí, chybějící id a datum
// změny se doplní. Platná data se nemění a nic se nepřidává. Volá se z migruj() v js/model.js. Čistý modul bez DOM.

const uid = (p) => `${p}_${Math.random().toString(36).slice(2, 10)}`;
const BARVA = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
export const OBRAZEK = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]*$/;
export const jeObrazek = (s) => typeof s === 'string' && OBRAZEK.test(s);
const POLOHY_LEGENDY = ['vpravo-dole', 'vlevo-dole', 'vpravo-nahore', 'vlevo-nahore'];
const VYKRESY = ['situace', 'pudorys', 'schema', 'evak_plan'];
const jeObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const jeCas = (t) => typeof t === 'string' && !Number.isNaN(Date.parse(t));
const jeId = (x) => typeof x === 'string' && x !== '';

// Úprava jednoho klíče – jen když klíč existuje (chybějící klíče doplňuje migrace z výchozích hodnot).
const cislo = (o, k, d, min = -Infinity, max = Infinity) => {
  if (!(k in o)) return; const x = o[k];
  if (typeof x !== 'number' || !Number.isFinite(x)) o[k] = d; else if (x < min || x > max) o[k] = Math.min(max, Math.max(min, x));
};
const kladne = (o, k, d) => { if (k in o && !(typeof o[k] === 'number' && Number.isFinite(o[k]) && o[k] > 0)) o[k] = d; };
const cisloNeboNull = (o, k) => { if (k in o && o[k] !== null && !(typeof o[k] === 'number' && Number.isFinite(o[k]))) o[k] = null; };
const text = (o, k) => { if (k in o && typeof o[k] !== 'string') o[k] = o[k] == null ? '' : String(o[k]); };
const textNeboNull = (o, k) => { if (k in o && o[k] !== null && typeof o[k] !== 'string') o[k] = String(o[k]); };
const ano = (o, k, d) => { if (k in o && typeof o[k] !== 'boolean') o[k] = d; };
const barva = (o, k, d) => { if (k in o && !(typeof o[k] === 'string' && BARVA.test(o[k]))) o[k] = d; };
const body = (b) => (Array.isArray(b) ? b.filter((q) => Array.isArray(q) && Number.isFinite(q[0]) && Number.isFinite(q[1])).map((q) => (q.length === 2 ? q : [q[0], q[1]])) : []);

const CISLA_PRVKU = { tloustka: 0.5, tloustkaM: 0.3, uhel: 0, x: 0, y: 0, cx: 0, cy: 0, w: 1, h: 1, rx: 1, ry: 1, sirkaM: 0.9, seg: 0, t: 0.5, smer: 1, zavesy: 1 };
function prvek(p) {
  if (!jeObj(p)) return null;
  if (!jeId(p.id)) p.id = uid('e');
  text(p, 'druh'); text(p, 'vrstva'); text(p, 'text'); text(p, 'styl'); text(p, 'typ'); textNeboNull(p, 'znackaId'); textNeboNull(p, 'stenaId');
  barva(p, 'barva', '#000000');
  if ('vypln' in p && p.vypln !== null && !(typeof p.vypln === 'string' && BARVA.test(p.vypln))) p.vypln = null;
  for (const [k, d] of Object.entries(CISLA_PRVKU)) cislo(p, k, d);
  cislo(p, 'kryti', 1, 0, 1); cislo(p, 'vyska', 3, 1, 500); cislo(p, 'velikost', 8, 1, 500);   // velikosti v mm na papíře 1–500
  if ('body' in p) p.body = body(p.body);
  return p;
}

function vrstva(l) {
  if (!jeObj(l)) return null;
  if (!jeId(l.id)) l.id = uid('v');
  text(l, 'nazev');
  if (typeof l.viditelna !== 'boolean') l.viditelna = true;   // editor i vykreslení musí brát vrstvu stejně
  if (typeof l.zamcena !== 'boolean') l.zamcena = false;
  return l;
}

function pozadi(pz) {
  if (!jeObj(pz)) return null;
  text(pz, 'prilohaId'); text(pz, 'nazev');
  cislo(pz, 'x', 0); cislo(pz, 'y', 0); kladne(pz, 'sirkaPx', 1); kladne(pz, 'vyskaPx', 1); kladne(pz, 'mNaPx', 0.01); cislo(pz, 'kryti', 0.8, 0, 1);
  if ('kalibrace' in pz && pz.kalibrace !== null && !(jeObj(pz.kalibrace) && typeof pz.kalibrace.delkaM === 'number' && pz.kalibrace.delkaM > 0)) pz.kalibrace = null;
  return pz;
}

function vykres(v, typ, vychoziVrstvy) {
  v.prvky = (Array.isArray(v.prvky) ? v.prvky : []).map(prvek).filter(Boolean);
  v.vrstvy = (Array.isArray(v.vrstvy) ? v.vrstvy : []).map(vrstva).filter(Boolean);
  if (!v.vrstvy.length && vychoziVrstvy) v.vrstvy = vychoziVrstvy(typ);
  if (!jeObj(v.meritko)) v.meritko = {};
  if (!(Number.isFinite(v.meritko.pomer) && v.meritko.pomer > 0)) v.meritko.pomer = typ === 'situace' ? 1000 : 100;
  if (!jeObj(v.okno)) v.okno = { x: 0, y: 0 };
  cislo(v.okno, 'x', 0); cislo(v.okno, 'y', 0);
  if (jeObj(v.severka)) cisloNeboNull(v.severka, 'uhel');
  if (jeObj(v.razitko)) for (const k of ['nazev', 'zpracoval', 'schvalil', 'datum']) text(v.razitko, k);
  if ('orientace' in v && v.orientace !== 'na_sirku' && v.orientace !== 'na_vysku') v.orientace = 'na_sirku';
  text(v, 'format'); ano(v, 'sit10m', true); ano(v, 'legendaZobrazit', true);
  if ('legendaPoloha' in v && !POLOHY_LEGENDY.includes(v.legendaPoloha)) delete v.legendaPoloha;
  if ('pozadi' in v) v.pozadi = pozadi(v.pozadi);
  if ('meritkoZdroj' in v && v.meritkoZdroj !== null) {
    if (!jeObj(v.meritkoZdroj)) v.meritkoZdroj = null;
    else { ano(v.meritkoZdroj, 'overeno', false); text(v.meritkoZdroj, 'zdroj'); text(v.meritkoZdroj, 'popis'); }
  }
  if (Array.isArray(v.legenda)) v.legenda = v.legenda.filter((x) => typeof x === 'string');
  if ('posunSouradnic' in v && !(Array.isArray(v.posunSouradnic) && v.posunSouradnic.length === 2 && v.posunSouradnic.every(Number.isFinite))) delete v.posunSouradnic;
  const e = v.evakPlan;
  if (jeObj(e)) {
    for (const k of ['kategorie', 'objekt', 'podlazi', 'pokynyPozar', 'pokynyEvakuace', 'zhotovitel', 'datum', 'cisloPlanu', 'cisloRevize', 'prehled']) text(e, k);
    if ('prehledPoloha' in e && !POLOHY_LEGENDY.includes(e.prehledPoloha)) e.prehledPoloha = 'vpravo-dole';
    ano(e, 'pokynyVedle', false);
    if (e.jsteZde !== null && e.jsteZde !== undefined) {
      if (!jeObj(e.jsteZde)) e.jsteZde = null;
      else { cislo(e.jsteZde, 'x', 0); cislo(e.jsteZde, 'y', 0); cislo(e.jsteZde, 'dx', 22); cislo(e.jsteZde, 'dy', -16); text(e.jsteZde, 'text'); }
    }
  }
}

// p: projekt po migraci. vychoziVrstvy(typ) → výchozí vrstvy listu (pro výkres bez jediné vrstvy).
export function ocistiProjekt(p, { vychoziVrstvy = null } = {}) {
  if (!jeObj(p)) return p;
  if (!jeId(p.id)) p.id = uid('proj');
  const ted = new Date().toISOString();
  if (!jeCas(p.vytvoreno)) p.vytvoreno = jeCas(p.zmeneno) ? p.zmeneno : ted;
  if (!jeCas(p.zmeneno)) p.zmeneno = p.vytvoreno;
  if (jeObj(p.prilohy)) for (const [id, a] of Object.entries(p.prilohy)) { if (!jeObj(a) || !jeObrazek(a.data)) delete p.prilohy[id]; else { text(a, 'nazev'); text(a, 'mime'); } }
  if (jeObj(p.evakZnacky)) for (const [k, z] of Object.entries(p.evakZnacky)) { if (!jeObj(z) || !jeObrazek(z.png)) delete p.evakZnacky[k]; else text(z, 'soubor'); }
  if (jeObj(p.nastaveni)) { cislo(p.nastaveni, 'velikostZnacky', 8, 1, 500); cislo(p.nastaveni, 'velikostTextu', 3, 1, 500); }
  for (const l of Array.isArray(p.listy) ? p.listy : []) {
    if (!jeObj(l)) continue;
    if (!jeId(l.id)) l.id = uid('list');
    text(l, 'nazev');
    if (VYKRESY.includes(l.typ) && jeObj(l.vykres)) vykres(l.vykres, l.typ, vychoziVrstvy);
    for (const kol of ['nebezpeci', 'vodniZdroje']) for (const it of Array.isArray(l.karta?.[kol]) ? l.karta[kol] : []) if (jeObj(it) && !jeId(it.id)) it.id = uid('p');
  }
  return p;
}
