// Požární evakuační plán – textová část a kontrola úplnosti podle vyhlášky č. 246/2001 Sb., § 33 a § 40 odst. 2 (znění k 1. 1. 2026;
// podklady/evakuace/NALEZITOSTI.md). Záměrně ODDĚLENO od DZP (operativní karta/plán): jiný účel, jiný adresát, jiné značky.
// Grafické listy podlaží se kontrolují v js/uplnost.js podle výtahu požadavků ČSN ISO 23601 (nezávazná norma) jako upozornění.
import { esc, dostan, nastav } from './formular.js';
import { datumCz } from './kartaData.js';

const prazdne = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
const uid = () => `e_${Math.random().toString(36).slice(2, 10)}`;

export const prazdnaEvak = () => ({
  objekt: { nazev: '', adresa: '', provozovatel: '', rozsah: '' },       // rozsah: podlaží / části objektu, kterých se plán týká
  organizator: { jmeno: '', funkce: '', telefon: '' },                  // § 33/2/a
  mistoRizeni: '',                                                      // § 33/2/a
  osoby: [],                                                            // § 33/2/b {id, jmeno, funkce, ukol}
  prostredky: '',                                                       // § 33/2/b
  cesty: '',                                                            // § 33/2/c – cesty a způsob evakuace
  shromazdiste: [],                                                     // § 33/2/c {id, popis}
  kontrolaPoctu: { jmeno: '', funkce: '' },                             // § 33/2/c – zaměstnanec kontrolující počet evakuovaných
  zvirata: '',                                                          // § 33/2/c – místo soustředění zvířat („popřípadě“ – jsou-li)
  prvniPomoc: '',                                                       // § 33/2/d
  material: '', materialStrezeni: '',                                   // § 33/2/e (nelze-li doplnit, „NE“)
  overeni: { datum: '', poznamka: '' },                                 // § 33/4 – cvičný požární poplach
  ulozeni: '',                                                          // § 33/5 – kde je plán uložen
  zpracoval: { jmeno: '', cisloOsvedceni: '', datum: '' },
  schvalil: { jmeno: '', funkce: '', datum: '' },
});

export const novaPolozkaEvak = (kolekce) => (kolekce === 'osoby' ? { id: uid(), jmeno: '', funkce: '', ukol: '' } : { id: uid(), popis: '' });

// pole: [cesta, popisek, typ (text|area|datum), šířka, „NE“ přípustné] – „NE“ jen tam, kde údaj opravdu nemusí existovat
// (prostředky, materiál, zvířata); náležitosti § 33 odst. 2 písm. a)–d) se určit musí.
export const EVAK_SEKCE = [
  { id: 'objekt', nazev: 'Objekt a rozsah plánu', zdroj: 'Místo a rozsah účinnosti dokumentace – § 40 odst. 2', pole: [
    ['objekt.nazev', 'Objekt', 'text'], ['objekt.provozovatel', 'Provozovatel', 'text'], ['objekt.adresa', 'Adresa', 'text'],
    ['objekt.rozsah', 'Rozsah plánu (podlaží, části objektu, např. „1. PP – 3. NP“)', 'text'] ] },
  { id: 'rizeni', nazev: 'a) Řízení evakuace', zdroj: '§ 33 odst. 2 písm. a)', pole: [
    ['organizator.jmeno', 'Osoba, která organizuje evakuaci – jméno', 'text'], ['organizator.funkce', 'Funkce', 'text', 'S'], ['organizator.telefon', 'Telefon', 'text', 'S'],
    ['mistoRizeni', 'Místo, ze kterého je evakuace řízena', 'text'] ] },
  { id: 'prostredky', nazev: 'b) Prostředky evakuace', zdroj: '§ 33 odst. 2 písm. b) – osoby se zadávají níže', pole: [
    ['prostredky', 'Prostředky, s jejichž pomocí je evakuace prováděna (nebo „NE“)', 'area', '', true] ] },
  { id: 'cesty', nazev: 'c) Cesty a způsob evakuace', zdroj: '§ 33 odst. 2 písm. c) – místa soustředění se zadávají níže', pole: [
    ['cesty', 'Cesty a způsob evakuace', 'area'],
    ['kontrolaPoctu.jmeno', 'Zaměstnanec, který kontroluje počet evakuovaných – jméno', 'text'], ['kontrolaPoctu.funkce', 'Funkce', 'text', 'S'],
    ['zvirata', 'Místo, kde se budou soustřeďovat evakuovaná zvířata (jsou-li v objektu; jinak „NE“ nebo prázdné)', 'area', '', true] ] },
  { id: 'pomoc', nazev: 'd) První pomoc', zdroj: '§ 33 odst. 2 písm. d)', pole: [
    ['prvniPomoc', 'Způsob zajištění první pomoci postiženým osobám', 'area'] ] },
  { id: 'material', nazev: 'e) Evakuovaný materiál', zdroj: '§ 33 odst. 2 písm. e)', pole: [
    ['material', 'Místo, na kterém se soustřeďuje evakuovaný materiál (nebo „NE“)', 'text', '', true], ['materialStrezeni', 'Způsob střežení materiálu (nebo „NE“)', 'text', '', true] ] },
  { id: 'overeni', nazev: 'Ověření a uložení plánu', zdroj: '§ 33 odst. 4 (cvičný požární poplach za podmínek § 32 odst. 4 a 5) a § 33 odst. 5', pole: [
    ['overeni.datum', 'Datum ověřovacího cvičného požárního poplachu', 'datum', 'S'], ['overeni.poznamka', 'Poznámka k ověření', 'text'],
    ['ulozeni', 'Místo uložení plánu (u jednotky HZS podniku, jinak na trvale dosažitelném místě)', 'text'] ] },
  { id: 'podpisy', nazev: 'Zpracoval a schválil', zdroj: 'Datum zpracování, jméno a odborná způsobilost zpracovatele – § 40 odst. 2; schválení – § 40 odst. 3', pole: [
    ['zpracoval.jmeno', 'Zpracoval – jméno a příjmení', 'text'], ['zpracoval.cisloOsvedceni', 'Číslo osvědčení / oprávnění', 'text', 'S'], ['zpracoval.datum', 'Datum zpracování', 'datum', 'S'],
    ['schvalil.jmeno', 'Schválil – jméno a příjmení', 'text'], ['schvalil.funkce', 'Funkce', 'text'], ['schvalil.datum', 'Datum schválení', 'datum', 'S'] ] },
];

// ---------- kontrola úplnosti ----------
const jeNe = (v) => String(v ?? '').trim().toUpperCase() === 'NE';
// Podlaží z textu: „1. PP – 3. NP“ → 1PP, 1NP, 2NP, 3NP; „2. NP, 4. NP“ → 2NP, 4NP. Nepozná-li nic, vrátí prázdnou množinu.
export function podlaziZTextu(text) {
  const t = String(text ?? ''), m = [...t.matchAll(/(\d+)\s*\.?\s*(NP|PP)\b/giu)].map((x) => ({ n: Number(x[1]), d: x[2].toUpperCase(), i: x.index, k: x.index + x[0].length }));
  const o = new Set(m.map((x) => `${x.n}${x.d}`));
  for (let i = 0; i + 1 < m.length; i++) {                                    // rozsah „A – B“ (pomlčka mezi dvěma podlažími)
    if (!/^\s*[–—-]\s*$|^\s*až\s*$/u.test(t.slice(m[i].k, m[i + 1].i))) continue;
    const a = m[i], b = m[i + 1], cislo = (x) => (x.d === 'PP' ? -x.n : x.n - 1);   // 1. PP = -1, 1. NP = 0
    const [od, po] = [cislo(a), cislo(b)].sort((x, y) => x - y);
    for (let c = od; c <= po; c++) o.add(c < 0 ? `${-c}PP` : `${c + 1}NP`);
  }
  return o;
}

export function kontrolaEvak(list, projekt, chyba, upoz) {
  const e = list.evak, p = `listy[${list.id}].evak`;
  // [hodnota, kód, cesta, název, „NE“ zde nelze]
  const povinne = [
    [e.objekt.nazev, 'ID_OBJEKT', 'objekt.nazev', 'Název objektu', true],
    [e.objekt.adresa, 'ADRESA', 'objekt.adresa', '§ 40/2: místo účinnosti plánu (adresa)', true],
    [e.objekt.rozsah, 'EVAK_ROZSAH', 'objekt.rozsah', '§ 40/2: rozsah účinnosti plánu (podlaží, části objektu)', true],
    [e.organizator.jmeno, 'EVAK_A_OSOBA', 'organizator.jmeno', '§ 33/2/a: osoba, která organizuje evakuaci', true],
    [e.mistoRizeni, 'EVAK_A_MISTO', 'mistoRizeni', '§ 33/2/a: místo, ze kterého je evakuace řízena', true],
    [e.prostredky, 'EVAK_B_PROSTREDKY', 'prostredky', '§ 33/2/b: prostředky evakuace (nebo „NE“)', false],
    [e.cesty, 'EVAK_C_CESTY', 'cesty', '§ 33/2/c: cesty a způsob evakuace', true],
    [e.kontrolaPoctu.jmeno, 'EVAK_C_KONTROLA', 'kontrolaPoctu.jmeno', '§ 33/2/c: zaměstnanec, který provede kontrolu počtu evakuovaných', true],
    [e.prvniPomoc, 'EVAK_D_POMOC', 'prvniPomoc', '§ 33/2/d: způsob zajištění první pomoci', true],
    [e.material, 'EVAK_E_MATERIAL', 'material', '§ 33/2/e: místo soustředění evakuovaného materiálu (nebo „NE“)', false],
    [e.zpracoval.jmeno, 'ZPRACOVAL', 'zpracoval.jmeno', '§ 40/2: jméno zpracovatele', true],
    [e.zpracoval.cisloOsvedceni, 'OSVEDCENI', 'zpracoval.cisloOsvedceni', '§ 40/2: odborná způsobilost zpracovatele (číslo osvědčení)', true],
    [e.zpracoval.datum, 'EVAK_DATUM', 'zpracoval.datum', '§ 40/2: datum zpracování', true],
  ];
  for (const [v, kod, cesta, nazev, bezNe] of povinne) {
    if (prazdne(v)) chyba(kod, `${p}.${cesta}`, `${nazev}: nevyplněno.`);
    else if (bezNe && jeNe(v)) chyba(kod, `${p}.${cesta}`, `${nazev}: „NE“ zde nestačí – vyhláška údaj vyžaduje.`);
  }
  if (!prazdne(e.material) && !jeNe(e.material) && prazdne(e.materialStrezeni)) chyba('EVAK_E_STREZENI', `${p}.materialStrezeni`, '§ 33/2/e: chybí způsob střežení evakuovaného materiálu (nebo „NE“).');

  if (!e.osoby.length) chyba('EVAK_B_OSOBY', `${p}.osoby`, '§ 33/2/b: chybí osoby, s jejichž pomocí se evakuace provádí.');
  for (const o of e.osoby) if (prazdne(o.jmeno) || prazdne(o.ukol) || jeNe(o.jmeno) || jeNe(o.ukol)) chyba('EVAK_B_OSOBA_UDAJE', `${p}.osoby[${o.id}]`, '§ 33/2/b: osoba bez jména nebo úkolu při evakuaci.');
  if (!e.shromazdiste.length) chyba('EVAK_C_SHROMAZDISTE', `${p}.shromazdiste`, '§ 33/2/c: chybí místo soustředění evakuovaných osob.');
  for (const x of e.shromazdiste) if (prazdne(x.popis) || jeNe(x.popis)) chyba('EVAK_C_SHROMAZDISTE_POPIS', `${p}.shromazdiste[${x.id}]`, '§ 33/2/c: místo soustředění bez popisu.');

  // § 33/2/f – grafické znázornění směru únikových cest v jednotlivých podlažích
  const grafika = projekt.listy.filter((l) => l.typ === 'evak_plan');
  if (!grafika.length) chyba('EVAK_F_GRAFIKA', 'listy', '§ 33/2/f: chybí grafické znázornění směru únikových cest (přidejte list Evakuační plán – podlaží).');
  for (const l of grafika) if (!l.vykres.prvky.some((x) => x.druh === 'trasa')) chyba('EVAK_F_TRASA', `listy[${l.id}].vykres.prvky`, `§ 33/2/f: list „${l.nazev}“ neobsahuje žádnou únikovou cestu.`);
  const rozsah = podlaziZTextu(e.objekt.rozsah), maList = new Set(grafika.flatMap((l) => [...podlaziZTextu(l.vykres.evakPlan?.podlazi)]));
  const bezListu = [...rozsah].filter((x) => !maList.has(x));
  if (grafika.length && bezListu.length) upoz('EVAK_F_PODLAZI', `${p}.objekt.rozsah`, `§ 33/2/f: podle rozsahu plánu („${e.objekt.rozsah.trim()}“) chybí list s únikovými cestami pro podlaží ${bezListu.map((x) => x.replace(/(\d+)(NP|PP)/, '$1. $2')).join(', ')} (grafika se zpracovává pro jednotlivá podlaží; podlaží listu se čte z jeho označení).`);

  if (prazdne(e.overeni.datum)) upoz('EVAK_OVERENI', `${p}.overeni.datum`, '§ 33/4: není uvedeno ověření úplnosti a správnosti plánu cvičným požárním poplachem (za podmínek § 32 odst. 4 a 5: vyhlášení se předem oznámí operačnímu středisku HZS kraje; vyhlašuje se pro osoby v pracovním nebo obdobném vztahu k provozovateli).');
  if (prazdne(e.ulozeni)) upoz('EVAK_ULOZENI', `${p}.ulozeni`, '§ 33/5: není uvedeno místo uložení plánu (u jednotky HZS podniku; není-li zřízena, na trvale dosažitelném místě).');
  if (prazdne(e.schvalil.jmeno)) upoz('EVAK_SCHVALIL', `${p}.schvalil.jmeno`, '§ 40/3: chybí, kdo plán schválil (statutární orgán nebo jím pověřený vedoucí zaměstnanec, podnikající fyzická osoba nebo její odpovědný zástupce – před zahájením činnosti).');
  upoz('EVAK_ROZSAH_POVINNOSTI', 'projekt', 'Ověřte, zda je plán pro objekt povinný – § 33 odst. 3: objekty a prostory se složitými podmínkami pro zásah (§ 18), místa, kde se provozují činnosti s vysokým požárním nebezpečím, a další činnosti se zvýšeným požárním nebezpečím, stanoví-li to dokumentace PO zpracovaná na základě stanovení podmínek požární bezpečnosti (např. § 30).');
  upoz('EVAK_VYVESENI', 'projekt', '§ 33/5: grafické znázornění směru únikových cest se umísťuje na dobře viditelném a trvale přístupném místě v jednotlivých podlažích; ve stavbách ubytovacích zařízení také uvnitř ubytovacích jednotek, zpravidla u vstupu do únikových cest.');
}

// ---------- formulář ----------
const pole = (list, [cesta, label, typ, sirka, neLze]) => {
  const dc = `listy[${list.id}].evak.${cesta}`, v = dostan(list.evak, cesta);
  const ne = typ === 'datum' || !neLze ? '' : `<button type="button" class="ne" data-ne="${cesta}" title="Údaj v objektu není – vepsat NE" aria-label="Vyplnit NE: ${esc(label)}">NE</button>`;
  const vstup = typ === 'area'
    ? `<textarea rows="4" data-cesta="${dc}" data-pole="${cesta}">${esc(v)}</textarea>`
    : `<input type="${typ === 'datum' ? 'date' : 'text'}" data-cesta="${dc}" data-pole="${cesta}" value="${esc(v)}">`;
  return `<label class="f ${sirka === 'S' ? 'f-s' : ''}"><span>${esc(label)}</span><span class="f-r">${vstup}${ne}</span></label>`;
};

function seznam(list, kolekce, nadpis, zdroj, radek, tlacitko, prazdno) {
  const p = `listy[${list.id}].evak`;
  const radky = list.evak[kolekce].map((x) => `<div class="polozka" data-cesta="${p}.${kolekce}[${x.id}]" data-id="${x.id}">${radek(x)}<button type="button" class="btn mal" data-akce="smaz" data-kolekce="${kolekce}">Odebrat</button></div>`).join('') || `<p class="prazdno">${prazdno}</p>`;
  return `<section class="sek sek-seda" id="sek-${kolekce}" data-cesta="${p}.${kolekce}"><h3>${esc(nadpis)}</h3><p class="napoveda">${esc(zdroj)}</p><div class="seznam">${radky}</div><button type="button" class="btn" data-akce="pridej" data-kolekce="${kolekce}">${esc(tlacitko)}</button></section>`;
}

export function vykresliEvak(list, host) {
  const sekce = (s) => `<section class="sek sek-seda" id="sek-${s.id}"><h3>${esc(s.nazev)}</h3>${s.zdroj ? `<p class="napoveda">${esc(s.zdroj)}</p>` : ''}<div class="mriz">${s.pole.map((x) => pole(list, x)).join('')}</div></section>`;
  const inp = (kol, x, klic, label, s = '') => `<label class="f ${s}"><span>${label}</span><input type="text" data-pol="${kol}" data-id="${x.id}" data-klic="${klic}" value="${esc(x[klic])}"></label>`;
  const [ob, ri, pr, ce, po, ma, ov, pod] = EVAK_SEKCE;
  host.innerHTML = `<p class="napoveda">Evakuační plán slouží osobám v objektu. <b>Není to DZP</b> (ta slouží zasahujícím hasičům) – oba dokumenty se nemíchají. Obsah podle vyhlášky č. 246/2001 Sb., § 33.</p>${[
    sekce(ob), sekce(ri), sekce(pr),
    seznam(list, 'osoby', 'b) Osoby, které evakuaci provádějí', '§ 33 odst. 2 písm. b)', (o) => `${inp('osoby', o, 'jmeno', 'Jméno')}${inp('osoby', o, 'funkce', 'Funkce', 'f-s')}${inp('osoby', o, 'ukol', 'Úkol při evakuaci')}`, '+ Přidat osobu', 'Zatím žádná osoba.'),
    sekce(ce),
    seznam(list, 'shromazdiste', 'c) Místa soustředění evakuovaných', '§ 33 odst. 2 písm. c)', (s) => inp('shromazdiste', s, 'popis', 'Místo soustředění (popis a umístění)'), '+ Přidat místo', 'Zatím žádné místo.'),
    sekce(po), sekce(ma),
    `<section class="sek sek-seda" id="sek-grafika"><h3>f) Grafické znázornění směru únikových cest</h3><p class="napoveda">§ 33 odst. 2 písm. f) – kreslí se na listech „Evakuační plán – podlaží“ (jeden list na podlaží; nástroj Úniková cesta). Přidejte je v levém panelu.</p></section>`,
    sekce(ov), sekce(pod)].join('')}`;
}

export function pripojEvak(list, host, onZmena) {
  const e = list.evak;
  host.oninput = host.onchange = (ev) => {
    const el = ev.target;
    if (ev.type === 'change' && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && el.type !== 'checkbox' && el.type !== 'date'))) return;
    if (el.dataset.pole) { nastav(e, el.dataset.pole, el.value); onZmena(false); }
    else if (el.dataset.pol) { const it = e[el.dataset.pol].find((x) => x.id === el.dataset.id); if (it) { it[el.dataset.klic] = el.value; onZmena(false); } }
  };
  host.onclick = (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.ne) { nastav(e, b.dataset.ne, 'NE'); b.parentElement.querySelector('[data-pole]').value = 'NE'; onZmena(false); }
    else if (b.dataset.akce === 'pridej') { e[b.dataset.kolekce].push(novaPolozkaEvak(b.dataset.kolekce)); onZmena(true); }
    else if (b.dataset.akce === 'smaz') { const id = b.closest('.polozka').dataset.id; e[b.dataset.kolekce] = e[b.dataset.kolekce].filter((x) => x.id !== id); onZmena(true); }
  };
}

// ---------- náhled a text pro PDF ----------
const h = (v) => (prazdne(v) ? '…' : String(v));

// Prostý text textové části (sdílí ho náhled i export PDF). Prázdné údaje jsou vidět jako „…“, nic se nedomýšlí.
export function evakJakoText(e, projekt) {
  const o = [];
  o.push(`Objekt: ${h(e.objekt.nazev)}`, `Provozovatel: ${h(e.objekt.provozovatel)}`, `Adresa: ${h(e.objekt.adresa)}`, `Rozsah plánu: ${h(e.objekt.rozsah)}`, '');
  o.push('a) ŘÍZENÍ EVAKUACE', `Evakuaci organizuje: ${h(e.organizator.jmeno)}${e.organizator.funkce ? `, ${e.organizator.funkce}` : ''}${e.organizator.telefon ? `, tel.: ${e.organizator.telefon}` : ''}`, `Evakuace je řízena z místa: ${h(e.mistoRizeni)}`, '');
  o.push('b) OSOBY A PROSTŘEDKY EVAKUACE', ...(e.osoby.length ? e.osoby.map((x, i) => `${i + 1}. ${h(x.jmeno)}${x.funkce ? ` (${x.funkce})` : ''} – ${h(x.ukol)}`) : ['…']), `Prostředky: ${h(e.prostredky)}`, '');
  o.push('c) CESTY A ZPŮSOB EVAKUACE', h(e.cesty), 'Místa soustředění evakuovaných:', ...(e.shromazdiste.length ? e.shromazdiste.map((x, i) => `${i + 1}. ${h(x.popis)}`) : ['…']),
    `Počet evakuovaných osob kontroluje: ${h(e.kontrolaPoctu.jmeno)}${e.kontrolaPoctu.funkce ? `, ${e.kontrolaPoctu.funkce}` : ''}`);
  if (!prazdne(e.zvirata)) o.push(`Místo soustředění zvířat: ${e.zvirata}`);
  o.push('', 'd) PRVNÍ POMOC', h(e.prvniPomoc), '');
  o.push('e) EVAKUOVANÝ MATERIÁL', `Místo soustředění: ${h(e.material)}`, `Střežení: ${h(e.materialStrezeni)}`, '');
  const grafika = (projekt?.listy || []).filter((l) => l.typ === 'evak_plan');
  o.push('f) GRAFICKÉ ZNÁZORNĚNÍ SMĚRU ÚNIKOVÝCH CEST', grafika.length ? `Viz grafické listy: ${grafika.map((l) => `${l.nazev}${l.vykres?.evakPlan?.podlazi ? ` (${l.vykres.evakPlan.podlazi})` : ''}`).join('; ')}.` : '…', '');
  o.push('OVĚŘENÍ A ULOŽENÍ', `Ověřeno cvičným požárním poplachem dne: ${h(datumCz(e.overeni.datum))}${e.overeni.poznamka ? ` (${e.overeni.poznamka})` : ''}`, `Plán je uložen: ${h(e.ulozeni)}`, '');
  o.push(`Zpracoval: ${h(e.zpracoval.jmeno)}, č. osvědčení: ${h(e.zpracoval.cisloOsvedceni)}, datum: ${h(datumCz(e.zpracoval.datum))}`, `Schválil: ${h(e.schvalil.jmeno)}${e.schvalil.funkce ? `, ${e.schvalil.funkce}` : ''}, datum: ${h(datumCz(e.schvalil.datum))}`);
  return o.join('\n');
}

export function nahledEvak(list, projekt) {
  const t = evakJakoText(list.evak, projekt).split('\n').map((r) => (/^[a-f]\) |^OVĚŘENÍ/.test(r) ? `<h4>${esc(r)}</h4>` : r === '' ? '' : `<p>${esc(r).replace(/…/g, '<span class="chybi">…</span>')}</p>`)).join('');
  return `<article class="a4 evak-nahled"><h2>POŽÁRNÍ EVAKUAČNÍ PLÁN – textová část</h2><p class="napoveda">Podle vyhlášky č. 246/2001 Sb., § 33. Nejde o dokumentaci zdolávání požárů.</p>${t}</article>`;
}

export const METODIKA_EVAK = `
<h3>Metodika – evakuační plán</h3>
<p class="napoveda"><b>Evakuační plán není DZP.</b> DZP slouží zasahujícím hasičům jako podklad pro zásah; evakuační plán slouží osobám v objektu k úniku. Zdroje: vyhl. č. 246/2001 Sb. (§ 33, § 40), vyhl. č. 23/2008 Sb. (§ 10). Aplikace nepotvrzuje právní správnost.</p>
<details open><summary>Obsah plánu (§ 33 odst. 2)</summary><ul>
<li>a) osoba, která organizuje evakuaci, a místo, ze kterého je řízena,</li><li>b) osoby a prostředky, s jejichž pomocí se evakuace provádí,</li>
<li>c) cesty a způsob evakuace, místo, kde se evakuované osoby, popřípadě zvířata soustřeďují, a zaměstnanec, který kontroluje počet evakuovaných osob,</li>
<li>d) způsob zajištění první pomoci postiženým osobám,</li><li>e) místo soustředění evakuovaného materiálu a způsob jeho střežení,</li>
<li>f) grafické znázornění směru únikových cest v jednotlivých podlažích.</li></ul>
<p class="zdroj">K tomu § 40 odst. 2: místo a rozsah účinnosti, datum zpracování, jméno a odborná způsobilost zpracovatele; schválení podle § 40 odst. 3.</p></details>
<details><summary>Kdy se zpracovává (§ 33 odst. 3)</summary><ul>
<li>pro objekty a prostory se složitými podmínkami pro zásah (§ 18 – např. dispozičně složité objekty s nebezpečím ztráty orientace v kouři, prostory se zvláštním nebezpečím pro hasiče, stavby pro osoby se sníženou schopností pohybu a orientace, vyšší ubytovací, administrativní, školské a zdravotnické objekty bez chráněných únikových cest, stavby pro shromažďování většího počtu osob a pro obchod),</li>
<li>kde se provozují činnosti s vysokým požárním nebezpečím,</li>
<li>a stanoví-li to dokumentace PO zpracovaná na základě stanovení podmínek požární bezpečnosti (např. § 30), i pro další činnosti se zvýšeným požárním nebezpečím.</li></ul></details>
<details><summary>Ověření, uložení a vyvěšení (§ 33 odst. 4 a 5)</summary><ul>
<li>Úplnost a správnost se ověřuje cvičným požárním poplachem za podmínek § 32 odst. 4 a 5: vyhlášení se předem oznámí operačnímu středisku HZS kraje; vyhlašuje se pro osoby v pracovním nebo obdobném vztahu k provozovateli.</li>
<li>Plán je uložen u jednotky HZS podniku, jinak na trvale dosažitelném místě.</li>
<li>Grafické znázornění směru únikových cest se umísťuje na dobře viditelném a trvale přístupném místě v jednotlivých podlažích; ve stavbách ubytovacích zařízení také uvnitř ubytovacích jednotek, zpravidla u vstupu do únikových cest.</li></ul></details>
<details><summary>Bezpečnostní značení únikových cest</summary><p>Úniková cesta se vybaví bezpečnostním značením zejména při změně směru, křížení komunikací a změně výškové úrovně (vyhl. 23/2008 Sb., § 10/4).</p></details>
<details><summary>Grafické listy a ČSN ISO 23601</summary><ul>
<li>Listy podlaží se kreslí a kontrolují podle výtahu požadavků ČSN ISO 23601 (záhlaví, „Jste zde“, legenda, pokyny, popisové pole, velikost značek a písma, barvy). Norma je nezávazná – kontrola je hlásí jako upozornění.</li>
<li>Výtah vychází z licencované kopie normy, ve které nebyly čitelné všechny strany (čl. 5 od bodu e, podrobnosti čl. 7.4); barvy jsou přibližné hodnoty – ověřte podle ISO 3864-4.</li>
<li>Značky mají být stejné jako v objektu podle ISO 7010 – nahrajte oficiální soubory. Kde je jen náhrada ze značek DZP (ČAHD), kontrola na to upozorní.</li>
<li>Požární poplachové směrnice (§ 32) jsou samostatný dokument.</li></ul></details>`;
