// Požární evakuační plán – textová část a kontrola úplnosti podle vyhlášky č. 246/2001 Sb., § 33 (znění k 1. 1. 2026;
// podklady/evakuace/NALEZITOSTI.md). Záměrně ODDĚLENO od DZP (operativní karta/plán): jiný účel, jiný adresát, jiné značky.
// Grafický vzhled plánu (ČSN ISO 23601, nezávazná) tato verze NEKONTROLUJE – text normy zatím není k dispozici.
import { esc, dostan, nastav } from './formular.js';

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
  zvirata: '',                                                          // § 33/1, 2/c – volitelně (zvířata)
  prvniPomoc: '',                                                       // § 33/2/d
  material: '', materialStrezeni: '',                                   // § 33/2/e (nelze-li doplnit, „NE“)
  overeni: { datum: '', poznamka: '' },                                 // § 33/4 – cvičný požární poplach
  ulozeni: '',                                                          // § 33/5 – kde je plán uložen
  zpracoval: { jmeno: '', cisloOsvedceni: '', datum: '' },
  schvalil: { jmeno: '', funkce: '', datum: '' },
});

export const novaPolozkaEvak = (kolekce) => (kolekce === 'osoby' ? { id: uid(), jmeno: '', funkce: '', ukol: '' } : { id: uid(), popis: '' });

// pole: [cesta, popisek, typ (text|area|datum), šířka]
export const EVAK_SEKCE = [
  { id: 'objekt', nazev: 'Objekt a rozsah plánu', pole: [
    ['objekt.nazev', 'Objekt', 'text'], ['objekt.provozovatel', 'Provozovatel', 'text'], ['objekt.adresa', 'Adresa', 'text'],
    ['objekt.rozsah', 'Rozsah plánu (podlaží, části objektu)', 'text'] ] },
  { id: 'rizeni', nazev: 'a) Řízení evakuace', zdroj: '§ 33 odst. 2 písm. a)', pole: [
    ['organizator.jmeno', 'Osoba, která organizuje evakuaci – jméno', 'text'], ['organizator.funkce', 'Funkce', 'text', 'S'], ['organizator.telefon', 'Telefon', 'text', 'S'],
    ['mistoRizeni', 'Místo, ze kterého je evakuace řízena', 'text'] ] },
  { id: 'prostredky', nazev: 'b) Prostředky evakuace', zdroj: '§ 33 odst. 2 písm. b) – osoby se zadávají níže', pole: [
    ['prostredky', 'Prostředky, s jejichž pomocí je evakuace prováděna (nebo „NE“)', 'area'] ] },
  { id: 'cesty', nazev: 'c) Cesty a způsob evakuace', zdroj: '§ 33 odst. 2 písm. c) – místa soustředění se zadávají níže', pole: [
    ['cesty', 'Cesty a způsob evakuace', 'area'],
    ['kontrolaPoctu.jmeno', 'Zaměstnanec, který kontroluje počet evakuovaných – jméno', 'text'], ['kontrolaPoctu.funkce', 'Funkce', 'text', 'S'],
    ['zvirata', 'Zvířata – postup evakuace (nepovinné; nepoužije-li se, nechte prázdné)', 'area'] ] },
  { id: 'pomoc', nazev: 'd) První pomoc', zdroj: '§ 33 odst. 2 písm. d)', pole: [
    ['prvniPomoc', 'Způsob zajištění první pomoci postiženým osobám', 'area'] ] },
  { id: 'material', nazev: 'e) Evakuovaný materiál', zdroj: '§ 33 odst. 2 písm. e)', pole: [
    ['material', 'Místo, na kterém se soustřeďuje evakuovaný materiál (nebo „NE“)', 'text'], ['materialStrezeni', 'Způsob střežení materiálu (nebo „NE“)', 'text'] ] },
  { id: 'overeni', nazev: 'Ověření a uložení plánu', zdroj: '§ 33 odst. 4 a 5', pole: [
    ['overeni.datum', 'Datum ověřovacího cvičného požárního poplachu', 'datum', 'S'], ['overeni.poznamka', 'Poznámka k ověření', 'text'],
    ['ulozeni', 'Místo uložení plánu (u jednotky HZS podniku, jinak na trvale dosažitelném místě)', 'text'] ] },
  { id: 'podpisy', nazev: 'Zpracoval a schválil', pole: [
    ['zpracoval.jmeno', 'Zpracoval – jméno a příjmení', 'text'], ['zpracoval.cisloOsvedceni', 'Číslo osvědčení / oprávnění', 'text', 'S'], ['zpracoval.datum', 'Datum zpracování', 'datum', 'S'],
    ['schvalil.jmeno', 'Schválil – jméno a příjmení', 'text'], ['schvalil.funkce', 'Funkce', 'text'], ['schvalil.datum', 'Datum schválení', 'datum', 'S'] ] },
];

// ---------- kontrola úplnosti ----------
export function kontrolaEvak(list, projekt, chyba, upoz) {
  const e = list.evak, p = `listy[${list.id}].evak`;
  const povinne = [
    [e.objekt.nazev, 'ID_OBJEKT', 'objekt.nazev', 'Název objektu'],
    [e.objekt.adresa, 'ADRESA', 'objekt.adresa', 'Adresa'],
    [e.objekt.rozsah, 'EVAK_ROZSAH', 'objekt.rozsah', 'Rozsah plánu (podlaží/části objektu)'],
    [e.organizator.jmeno, 'EVAK_A_OSOBA', 'organizator.jmeno', '§ 33/2/a: osoba, která organizuje evakuaci'],
    [e.mistoRizeni, 'EVAK_A_MISTO', 'mistoRizeni', '§ 33/2/a: místo, ze kterého je evakuace řízena'],
    [e.prostredky, 'EVAK_B_PROSTREDKY', 'prostredky', '§ 33/2/b: prostředky evakuace'],
    [e.cesty, 'EVAK_C_CESTY', 'cesty', '§ 33/2/c: cesty a způsob evakuace'],
    [e.kontrolaPoctu.jmeno, 'EVAK_C_KONTROLA', 'kontrolaPoctu.jmeno', '§ 33/2/c: zaměstnanec kontrolující počet evakuovaných'],
    [e.prvniPomoc, 'EVAK_D_POMOC', 'prvniPomoc', '§ 33/2/d: způsob zajištění první pomoci'],
    [e.material, 'EVAK_E_MATERIAL', 'material', '§ 33/2/e: místo soustředění evakuovaného materiálu (nebo „NE“)'],
    [e.zpracoval.jmeno, 'ZPRACOVAL', 'zpracoval.jmeno', 'Zpracovatel'],
  ];
  for (const [v, kod, cesta, nazev] of povinne) if (prazdne(v)) chyba(kod, `${p}.${cesta}`, `${nazev}: nevyplněno.`);
  const jeNe = (v) => String(v || '').trim().toUpperCase() === 'NE';
  if (!prazdne(e.material) && !jeNe(e.material) && prazdne(e.materialStrezeni)) chyba('EVAK_E_STREZENI', `${p}.materialStrezeni`, '§ 33/2/e: chybí způsob střežení evakuovaného materiálu (nebo „NE“).');

  if (!e.osoby.length) chyba('EVAK_B_OSOBY', `${p}.osoby`, '§ 33/2/b: chybí osoby, s jejichž pomocí se evakuace provádí.');
  for (const o of e.osoby) if (prazdne(o.jmeno) || prazdne(o.ukol)) chyba('EVAK_B_OSOBA_UDAJE', `${p}.osoby[${o.id}]`, '§ 33/2/b: osoba bez jména nebo úkolu při evakuaci.');
  if (!e.shromazdiste.length) chyba('EVAK_C_SHROMAZDISTE', `${p}.shromazdiste`, '§ 33/2/c: chybí místo soustředění evakuovaných.');
  for (const s of e.shromazdiste) if (prazdne(s.popis)) chyba('EVAK_C_SHROMAZDISTE_POPIS', `${p}.shromazdiste[${s.id}]`, '§ 33/2/c: místo soustředění bez popisu.');

  // § 33/2/f – grafické znázornění směru únikových cest v jednotlivých podlažích
  const grafika = projekt.listy.filter((l) => l.typ === 'evak_plan' || l.typ === 'pudorys');
  if (!grafika.length) chyba('EVAK_F_GRAFIKA', 'listy', '§ 33/2/f: chybí grafické znázornění směru únikových cest (přidejte list Evakuační plán – podlaží).');
  for (const l of grafika) if (!l.vykres.prvky.some((x) => x.druh === 'trasa')) chyba('EVAK_F_TRASA', `listy[${l.id}].vykres.prvky`, `§ 33/2/f: list „${l.nazev}“ neobsahuje žádnou únikovou cestu.`);

  if (prazdne(e.overeni.datum)) upoz('EVAK_OVERENI', `${p}.overeni.datum`, '§ 33/4: není uvedeno ověření úplnosti a správnosti plánu cvičným požárním poplachem.');
  if (prazdne(e.ulozeni)) upoz('EVAK_ULOZENI', `${p}.ulozeni`, '§ 33/5: není uvedeno místo uložení plánu.');
  if (prazdne(e.zpracoval.cisloOsvedceni)) upoz('OSVEDCENI', `${p}.zpracoval.cisloOsvedceni`, 'Chybí číslo osvědčení/oprávnění zpracovatele.');
  if (prazdne(e.schvalil.jmeno)) upoz('EVAK_SCHVALIL', `${p}.schvalil.jmeno`, 'Chybí osoba, která plán schválila.');
  upoz('EVAK_ROZSAH_POVINNOSTI', 'projekt', 'Ověřte, zda je plán pro objekt povinný (§ 33 odst. 3: složité podmínky pro zásah, vysoké požární nebezpečí, nebo to stanoví dokumentace PO).');
  upoz('EVAK_NORMA', 'projekt', 'Grafické listy se kontrolují podle ČSN ISO 23601 (nezávazná) jen v rozsahu uvedeném v kontrole; norma není zde ověřena v plném znění. Plán vyvěšte na viditelném a trvale přístupném místě v každém podlaží (§ 33/5).');
}

// ---------- formulář ----------
const pole = (list, [cesta, label, typ, sirka]) => {
  const dc = `listy[${list.id}].evak.${cesta}`, v = dostan(list.evak, cesta);
  const ne = typ === 'datum' ? '' : `<button type="button" class="ne" data-ne="${cesta}" title="Nelze doplnit – vepsat NE" aria-label="Vyplnit NE: ${esc(label)}">NE</button>`;
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
  if (!prazdne(e.zvirata)) o.push(`Zvířata: ${e.zvirata}`);
  o.push('', 'd) PRVNÍ POMOC', h(e.prvniPomoc), '');
  o.push('e) EVAKUOVANÝ MATERIÁL', `Místo soustředění: ${h(e.material)}`, `Střežení: ${h(e.materialStrezeni)}`, '');
  const grafika = (projekt?.listy || []).filter((l) => l.typ === 'evak_plan' || l.typ === 'pudorys');
  o.push('f) GRAFICKÉ ZNÁZORNĚNÍ SMĚRU ÚNIKOVÝCH CEST', grafika.length ? `Viz grafické listy: ${grafika.map((l) => l.nazev).join('; ')}.` : '…', '');
  o.push('OVĚŘENÍ A ULOŽENÍ', `Ověřeno cvičným požárním poplachem dne: ${h(e.overeni.datum)}${e.overeni.poznamka ? ` (${e.overeni.poznamka})` : ''}`, `Plán je uložen: ${h(e.ulozeni)}`, '');
  o.push(`Zpracoval: ${h(e.zpracoval.jmeno)}, č. osvědčení: ${h(e.zpracoval.cisloOsvedceni)}, datum: ${h(e.zpracoval.datum)}`, `Schválil: ${h(e.schvalil.jmeno)}${e.schvalil.funkce ? `, ${e.schvalil.funkce}` : ''}, datum: ${h(e.schvalil.datum)}`);
  return o.join('\n');
}

export function nahledEvak(list, projekt) {
  const t = evakJakoText(list.evak, projekt).split('\n').map((r) => (/^[a-f]\) |^OVĚŘENÍ/.test(r) ? `<h4>${esc(r)}</h4>` : r === '' ? '' : `<p>${esc(r).replace(/…/g, '<span class="chybi">…</span>')}</p>`)).join('');
  return `<article class="a4 evak-nahled"><h2>POŽÁRNÍ EVAKUAČNÍ PLÁN – textová část</h2><p class="napoveda">Podle vyhlášky č. 246/2001 Sb., § 33. Nejde o dokumentaci zdolávání požárů.</p>${t}</article>`;
}

export const METODIKA_EVAK = `
<h3>Metodika – evakuační plán</h3>
<p class="napoveda"><b>Evakuační plán není DZP.</b> DZP slouží zasahujícím hasičům jako podklad pro zásah; evakuační plán slouží osobám v objektu k úniku. Zdroje: vyhl. č. 246/2001 Sb. (§ 33), vyhl. č. 23/2008 Sb. (§ 10). Aplikace nepotvrzuje právní správnost.</p>
<details open><summary>Obsah plánu (§ 33 odst. 2)</summary><ul>
<li>a) osoba organizující evakuaci a místo řízení,</li><li>b) osoby a prostředky evakuace,</li>
<li>c) cesty a způsob evakuace, místa soustředění, zaměstnanec kontrolující počet evakuovaných,</li>
<li>d) způsob zajištění první pomoci,</li><li>e) místo soustředění evakuovaného materiálu a jeho střežení,</li>
<li>f) grafické znázornění směru únikových cest v jednotlivých podlažích.</li></ul></details>
<details><summary>Kdy, ověření a uložení</summary><ul>
<li>Zpracovává se pro objekty se složitými podmínkami pro zásah, s vysokým požárním nebezpečím nebo když to stanoví dokumentace PO (§ 33/3).</li>
<li>Úplnost a správnost se ověřuje cvičným požárním poplachem (§ 33/4).</li>
<li>Uložení u jednotky HZS podniku, jinak na trvale dosažitelném místě; grafika únikových cest na dobře viditelném a trvale přístupném místě v každém podlaží (§ 33/5).</li></ul></details>
<details><summary>Bezpečnostní značení únikových cest</summary><p>Úniková cesta se vybaví bezpečnostním značením zejména při změně směru, křížení komunikací a změně výškové úrovně (vyhl. 23/2008 Sb., § 10/4).</p></details>
<details><summary>Co zatím nevíme</summary><ul>
<li>Grafický vzhled plánu (ČSN ISO 23601, nezávazná) – text normy není k dispozici, aplikace jej nekontroluje.</li>
<li>Sada značek pro evakuaci (ISO 7010) – knihovna značek DZP se v evakuačním plánu nepoužívá.</li>
<li>Požární poplachové směrnice (§ 32) jsou samostatný dokument.</li></ul></details>`;
