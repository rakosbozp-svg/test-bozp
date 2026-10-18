// Operativní plán zdolávání požárů – textové listy podle Metodického návodu k vypracování DZP (Hanuška 1996), část prvá kap. 2
// a vzoru v příloze č. 3. Grafickou část tvoří listy Situace a Půdorys (kap. 2.3), případně Operativní karta.
// Hrubý odhad SaP podle „Pomůcky velitele jednotky PO – Odhad sil a prostředků“ (ČAHD, 11/2011, podklady/Odhad_SaP_pomucka.pdf).
// Nenahrazuje výpočet podle části druhé metodiky – to je v aplikaci výslovně uvedeno.

const nic = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && !v.length);

// Hanuška 1996, kap. 2.1.1 – kdy nastávají složité podmínky pro zásah
export const SLOZITE_PODMINKY = [
  ['dispozice', 'dispozičně složitý a nepřehledný objekt (hrozí ztráta orientace při zakouření)'],
  ['odvetrani', 'prostory, které nelze odvětrat, nebo jen se znalostí ovládání technických zařízení; nepředvídatelné šíření zplodin'],
  ['rezim', 'prostory se zvláštním režimem ohrožujícím hasiče (laboratoře, el. rozvodny, kabelové hospodářství…)'],
  ['konstrukce', 'těžko poznatelné konstrukce či technologie umožňující šíření požáru mimo požární úsek nebo objekt'],
  ['latky', 'výskyt nebezpečných látek'],
  ['postup', 'nutnost přesně dodržet postup v množství a druhu nasazené techniky a prostředků'],
];

// Pomůcka ČAHD 11/2011 – doporučená intenzita dodávky vody; intenzita na frontu je odvozena z „účinné fronty hašení proudnice = qpr / x“.
export const PROSTORY = {
  prumysl: { nazev: 'Budovy průmyslu, zemědělství, sklady, obchody, sušárny', ip: 10, ifr: 50 },
  byty: { nazev: 'Byty, kina, ubytovny', ip: 8, ifr: 40 },
  les: { nazev: 'Lesy, meze, volné prostory', ip: 4, ifr: 20 },
};
const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('cs-CZ');

// Hrubý odhad pro jeden bojový úsek: Qhp = Sh·Ip (nebo Oh·Ip,fronta), Nhpr = Qhp / qpr, NHA ≈ 1,25 · k · Npr (vzor Hanuška, k = 2).
export function odhadSaP(u) {
  const p = PROSTORY[u.prostor]; const h = Number(u.hodnota), q = Number(u.qpr), k = Number(u.k) > 0 ? Number(u.k) : 2;
  if (!p || !(h > 0) || !(q > 0)) return null;
  const qhp = u.zpusob === 'fronta' ? h * p.ifr : h * p.ip, npr = Math.ceil(qhp / q - 1e-9), nha = Math.ceil(1.25 * k * npr - 1e-9);
  return { qhp, npr, nha, q, ip: u.zpusob === 'fronta' ? p.ifr : p.ip };
}
export const textOdhadu = (u) => { const r = odhadSaP(u); return r ? `Qhp = ${fmt(r.qhp)} l/min → ${r.npr} proudů po ${fmt(r.q)} l/min, cca ${r.nha} hasičů (hrubý odhad)` : 'Doplňte prostor, plochu nebo frontu a průtok proudnice.'; };
export function souhrnOdhadu(useky) {
  const r = useky.map(odhadSaP).filter(Boolean);
  if (!r.length) return 'Celkem: …';
  return `Celkem (hrubý odhad dle Pomůcky ČAHD 11/2011): ${fmt(r.reduce((s, x) => s + x.qhp, 0))} l/min, ${r.reduce((s, x) => s + x.npr, 0)} proudů, cca ${r.reduce((s, x) => s + x.nha, 0)} hasičů. Nenahrazuje výpočet podle části druhé metodiky.`;
}

export const SCHEMA_ZAKLAD = { sekce: [
  { id: 'ots', nazev: '1. Operativně taktická studie', zdroj: 'Hanuška 1996, kap. 2.1.1; vzor příloha č. 3', pole: [
    ['ots.rozsahPriloh', 'Rozsah vyjímatelných příloh (textová část, situace, půdorysy, operativní karty…)', 'area'],
    ['ots.slozitePodminky', 'Důvody složitých podmínek pro zásah', 'volby', '', SLOZITE_PODMINKY],
    ['ots.osoby', 'Počet osob a směnnost', 'text'],
    ['ots.dobaZpozorovani', 'Doba zpozorování požáru v nejnepříznivější situaci', 'text', 'S'],
    ['ots.signalizace', 'EPS, ohlašovna požárů, spojení s HZS', 'text'],
    ['ots.dojezd', 'Dojezd první jednotky PO (nejnepříznivější situace)', 'text', 'S'],
    ['ots.jednotkaPodniku', 'Jednotka PO podniku (početní stav, vybavení) – nebo „NE“', 'text'],
    ['ots.zasobovaniVodou', 'Zásobování vodou (vydatnost sítě, další zdroje)', 'text'],
    ['ots.stupenPoplachu', 'Stupeň požárního poplachového plánu', 'text', 'S'],
    ['ots.zaver', 'Závěr studie (ostatní zjištění)', 'area'],
  ] },
  { id: 'varianta', nazev: '2. Nejsložitější varianta požáru', zdroj: 'Hanuška 1996, kap. 2.1.2 – určuje se v posouzení požárního nebezpečí; zde se uvede místo a souvislost s OP', pole: [
    ['varianta.misto', 'Místo vzniku nejsložitější varianty požáru', 'text'],
    ['varianta.duvod', 'Proč je nejsložitější (ohrožení osob, škody, význam pro výrobu)', 'area'],
    ['varianta.sireni', 'Možné cesty šíření požáru', 'area'],
    ['varianta.prubeh', 'Časový průběh rozvoje a likvidace požáru', 'area'],
  ] },
  { id: 'sap', nazev: '3. Výpočet sil a prostředků (SaP)', zdroj: 'Hanuška 1996, kap. 2.1.3 a část druhá', napoveda: 'Výpočet se provádí, pokud DZP nahrazuje část posouzení požárního nebezpečí, nebo u objektů, kde musí být přesně dodržen postup nasazení techniky. U jednoduchých objektů HZS STČ výpočet SaP nevyžaduje (Zásady HZS SCK, kap. 3).', pole: [
    ['sap.provadi', 'Provádí se výpočet SaP?', 'ano_ne', 'S'],
    ['sap.duvod', 'Důvod (nahrazuje posouzení požárního nebezpečí / přesný postup nasazení / jiný)', 'text'],
    ['sap.ppp', 'Výpis z požárního poplachového plánu (stupeň – jednotka – technika)', 'area'],
    ['sap.vysledek', 'Výsledek výpočtu SaP (potřeba techniky a hasičů, porovnání s PPP)', 'area'],
  ] },
  { id: 'odhad', nazev: 'Hrubý odhad SaP – pomůcka (nepovinné)', zdroj: 'Pomůcka velitele jednotky PO „Odhad sil a prostředků“, ČAHD 11/2011. Jen orientační kontrola – nenahrazuje výpočet podle části druhé metodiky (parametry požáru, doba volného rozvoje, plocha hašení).', kolekce: {
    klic: 'useky', nazev: 'Bojové úseky', pridat: '+ Přidat bojový úsek', prazdno: 'Zatím žádný bojový úsek.',
    pole: [['nazev', 'Bojový úsek', 'text'], ['prostor', 'Druh prostoru', 'vyber', '', Object.entries(PROSTORY).map(([k, x]) => [k, `${x.nazev} (${x.ip} l/min/m²)`])],
      ['zpusob', 'Výpočet podle', 'vyber', 'S', [['plocha', 'plochy hašení Sh (m²)'], ['fronta', 'fronty hašení Oh (m)']]], ['hodnota', 'Sh (m²) nebo Oh (m)', 'cislo', 'S'], ['qpr', 'Průtok proudnice qpr (l/min)', 'cislo', 'S'], ['k', 'Hasičů na proudnici k', 'cislo', 'S']],
    vychozi: { qpr: 200, k: 2 },   // proudnice C 200 l/min (příklad pomůcky ČAHD), k = 2 (vzor Hanuška, příloha č. 3) – uživatel může změnit
    vystup: textOdhadu, souhrn: souhrnOdhadu,
  } },
  { id: 'zaver', nazev: '4. Závěr', pole: [['zaver', 'Závěr základního textu (např. zda SaP stupně poplachu vyhovují)', 'area']] },
] };

export const SCHEMA_TEXT = { sekce: [
  { id: 'udaje', nazev: '1a) Údaje o podniku, budovách a technologiích', zdroj: 'Hanuška 1996, kap. 2.2.1 a) – stručně, heslovitě; co jde zakreslit, patří do grafické části', pole: [
    ['udaje.osoby', 'Množství osob v různých denních režimech, zvířata, zvláštní hodnoty', 'area'],
    ['udaje.cinnosti', 'Činnosti se zvýšeným požárním nebezpečím', 'area'],
    ['udaje.latky', 'Nebezpečí skladovaných / zpracovávaných látek a rizika (nebo „NE“)', 'area'],
    ['udaje.pbz', 'Umístění a ovládání SHZ, EPS', 'area'],
    ['udaje.rozvody', 'Zvláštnosti rozvodů el. energie, topení, ventilace, klimatizace (šíření požáru)', 'area'],
    ['udaje.slozite', 'Upozornění na složité podmínky při zdolávání požáru', 'area'],
  ], kolekce: {
    klic: 'objekty', nazev: 'Budovy a zařízení', pridat: '+ Přidat budovu', prazdno: 'Zatím žádná budova.',
    pole: [['nazev', 'Název (jednotný v celém OP)', 'text'], ['podlazi', 'Podlaží (NP/PP)', 'text', 'S'], ['vyska', 'Celková výška (m)', 'text', 'S'], ['pudorys', 'Půdorys (m)', 'text', 'S'],
      ['konstrukce', 'Konstrukce, hořlavost, požární odolnost, střecha', 'text'], ['useky', 'Požární úseky', 'text', 'S'], ['vyuziti', 'Využití, technologie, zvláštnosti', 'text']],
  } },
  { id: 'voda', nazev: '1b) Vodní zdroje a hasicí látky', zdroj: 'Hanuška 1996, kap. 2.2.1 b)', pole: [
    ['voda.zdroje', 'Vodní zdroje v podniku a okolí, vydatnost, zvláštnosti dodávky', 'area'],
    ['voda.hasiva', 'Speciální skladované hasicí látky (nebo „NE“)', 'area'],
  ] },
  { id: 'komunikace', nazev: '1c) Komunikace', zdroj: 'Hanuška 1996, kap. 2.2.1 c)', pole: [
    ['komunikace.stav', 'Stav komunikací vzhledem k rozměrům požární techniky', 'area'],
    ['komunikace.pokyny', 'Zvláštní pokyny pro jízdu nebo parkování techniky (nebo „NE“)', 'area'],
  ] },
  { id: 'doporuceni', nazev: '2. Doporučení pro velitele zásahu', zdroj: 'Hanuška 1996, kap. 2.2.2', napoveda: 'Uveďte zejména: záchranu osob a evakuaci zvířat a materiálu; šíření požáru (ventilace, rozvody); bezpečnost hasičů a ochranné prostředky; toxické zplodiny a výbušné koncentrace; dekontaminaci; speciální techniku; <b>uzavření plynu a vypnutí el. energie včetně prostor pod napětím i po vypnutí hlavního vypínače (UPS, FVE)</b>; dálkovou dopravu vody; speciální hasiva; výsledky výpočtů pro přesný postup nasazení.', pole: [
    ['doporuceni', 'Doporučení pro velitele zásahu', 'area'],
  ] },
  { id: 'telefony', nazev: 'Důležitá telefonní čísla', zdroj: 'Vzor Hanuška 1996, příloha č. 3', kolekce: {
    klic: 'telefony', nazev: 'Kontakty', pridat: '+ Přidat kontakt', prazdno: 'Zatím žádný kontakt.',
    pole: [['funkce', 'Funkce', 'text'], ['jmeno', 'Jméno', 'text'], ['telefon', 'Telefon', 'text', 'S']],
  } },
] };

const zDefaults = (schema) => {
  const o = {};
  for (const s of schema.sekce) {
    for (const [c, , typ] of s.pole || []) {
      const k = c.split('.'), last = k.pop(); let t = o;
      for (const x of k) t = (t[x] ||= {});
      t[last] = typ === 'volby' ? [] : typ === 'ano_ne' || typ === 'cislo' ? null : '';
    }
    if (s.kolekce) o[s.kolekce.klic] = [];
  }
  return o;
};
export const prazdnyOpZaklad = () => zDefaults(SCHEMA_ZAKLAD);
export const prazdnyOpText = () => zDefaults(SCHEMA_TEXT);

// ---------- kontrola úplnosti ----------
export function kontrolaOp(projekt, chyba, upoz) {
  const typy = new Set(projekt.listy.map((l) => l.typ));
  if (!typy.has('op_zaklad')) chyba('OP_ZAKLAD_CHYBI', 'listy', 'Operativní plán: chybí základní text (Hanuška 1996, kap. 2 a).');
  if (!typy.has('op_text')) chyba('OP_TEXT_CHYBI', 'listy', 'Operativní plán: chybí textová část vyjímatelné přílohy (kap. 2 ba).');
  if (!typy.has('situace')) chyba('OP_SITUACE_CHYBI', 'listy', 'Operativní plán: chybí situace podniku (kap. 2.3.2).');
  if (!typy.has('pudorys')) upoz('OP_PUDORYS_CHYBI', 'listy', 'Operativní plán: není žádný půdorys (kap. 2.3.3) – ověřte, zda není potřeba.');
}

export function kontrolaOpZaklad(list, chyba, upoz, projekt = null) {
  const d = list.opZaklad, p = `listy[${list.id}].opZaklad`;
  if (nic(d.ots.rozsahPriloh)) chyba('OP_OTS_ROZSAH', `${p}.ots.rozsahPriloh`, 'Operativně taktická studie: chybí rozsah vyjímatelných příloh (kap. 2.1.1).');
  if (nic(d.ots.slozitePodminky)) upoz('OP_OTS_PODMINKY', `${p}.ots.slozitePodminky`, 'Operativně taktická studie: nejsou označeny důvody složitých podmínek pro zásah.');
  for (const [k, n] of [['osoby', 'počet osob a směnnost'], ['signalizace', 'EPS / ohlašovna'], ['zasobovaniVodou', 'zásobování vodou'], ['stupenPoplachu', 'stupeň požárního poplachu']]) if (nic(d.ots[k])) upoz('OP_OTS_UDAJ', `${p}.ots.${k}`, `Operativně taktická studie: nevyplněno – ${n}.`);
  if (nic(d.varianta.misto)) chyba('OP_VARIANTA_MISTO', `${p}.varianta.misto`, 'Nejsložitější varianta požáru: chybí místo vzniku (kap. 2.1.2).');
  if (nic(d.varianta.sireni)) upoz('OP_VARIANTA_SIRENI', `${p}.varianta.sireni`, 'Nejsložitější varianta požáru: chybí cesty šíření požáru.');
  if (nic(d.varianta.prubeh)) upoz('OP_VARIANTA_PRUBEH', `${p}.varianta.prubeh`, 'Nejsložitější varianta požáru: chybí časový průběh rozvoje a likvidace.');
  if (d.sap.provadi === null) chyba('OP_SAP_ROZHODNUTI', `${p}.sap.provadi`, 'Výpočet SaP: uveďte, zda se provádí (kap. 2.1.3).');
  if (d.sap.provadi === true) {
    if (nic(d.sap.vysledek)) chyba('OP_SAP_VYSLEDEK', `${p}.sap.vysledek`, 'Výpočet SaP: chybí výsledek výpočtu.');
    if (nic(d.sap.ppp)) upoz('OP_SAP_PPP', `${p}.sap.ppp`, 'Výpočet SaP: chybí výpis z požárního poplachového plánu pro porovnání.');
    if (projekt && !projekt.listy.some((l) => l.typ === 'op_sap')) upoz('OP_SAP_LIST', `${p}.sap`, 'Výpočet SaP: projekt nemá list „OP – výpočet SaP“ (výpočet podle části druhé metodiky). Výsledek zadaný ručně aplikace neověřuje.');
  }
}

export function kontrolaOpText(list, chyba, upoz) {
  const d = list.opText, p = `listy[${list.id}].opText`;
  if (!d.objekty.length) chyba('OP_OBJEKTY', `${p}.objekty`, 'Textová část: chybí údaje o budovách (kap. 2.2.1 a).');
  for (const o of d.objekty) if (nic(o.nazev)) chyba('OP_OBJEKT_NAZEV', `${p}.objekty[${o.id}]`, 'Textová část: budova bez názvu.');
  if (nic(d.udaje.latky)) upoz('OP_LATKY', `${p}.udaje.latky`, 'Textová část: nebezpečné látky – nevyplněno (nebo „NE“).');
  if (nic(d.voda.zdroje)) chyba('OP_VODA', `${p}.voda.zdroje`, 'Textová část: chybí vodní zdroje (kap. 2.2.1 b).');
  if (nic(d.komunikace.stav)) chyba('OP_KOMUNIKACE', `${p}.komunikace.stav`, 'Textová část: chybí stav komunikací (kap. 2.2.1 c).');
  if (nic(d.doporuceni)) chyba('OP_DOPORUCENI', `${p}.doporuceni`, 'Chybí doporučení pro velitele zásahu (kap. 2.2.2).');
  else if (!/vyp[ií]n|el\.|elektr|plyn|energi/i.test(d.doporuceni)) upoz('OP_DOPORUCENI_ENERGIE', `${p}.doporuceni`, 'Doporučení pro velitele zásahu: neobsahuje zmínku o uzavření plynu / vypnutí el. energie (kap. 2.2.2).');
  if (!d.telefony.length) upoz('OP_TELEFONY', `${p}.telefony`, 'Textová část: chybí důležitá telefonní čísla.');
}

export const METODIKA_OP = `
<details><summary>Operativní plán – obsah (Hanuška 1996, kap. 2)</summary><ul>
<li><b>Základní text</b> (koncept, jedno vyhotovení, ukládá se odděleně): operativně taktická studie, nejsložitější varianta požáru, výpočet SaP.</li>
<li><b>Vyjímatelná příloha – textová část</b>: operativně taktická charakteristika (údaje o objektech, vodní zdroje a hasiva, komunikace) a doporučení pro velitele zásahu.</li>
<li><b>Vyjímatelná příloha – grafická část</b>: situace podniku (kap. 2.3.2) a půdorysy (kap. 2.3.3); součástí může být i operativní karta.</li>
<li>Většina informací (70–90 %) má být v grafické části.</li></ul>
<p class="zdroj">Hanuška 1996, kap. 2–2.3; Zásady HZS SCK, kap. 3 (OP se vyžaduje u objektů se speciálními nároky nebo složitými podmínkami ve více objektech).</p></details>`;
