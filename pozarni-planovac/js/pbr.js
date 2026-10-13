// Čtení údajů z požárně bezpečnostního řešení (PBŘ) ve formátu PDF s textovou vrstvou.
// PBŘ má obsah daný vyhláškou (kap. a)–n)), ale formulace se u zpracovatelů liší – proto jen pravidla na typické formulace,
// každý nález nese citaci (strana + text) a do projektu se zapisuje až po potvrzení. Co se nenajde, zůstává na dotazníku.
// Naskenované PBŘ se nejdřív rozpozná OCR (js/ocr.js); čte se i průvodní a souhrnná zpráva ve Wordu (js/docx.js).

// ---------- text z PDF (pdf.js) → řádky ----------
export async function radkyZPdf(doc) {
  const stranky = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const tc = await (await doc.getPage(n)).getTextContent();
    const radky = [];
    for (const it of tc.items) {
      if (!it.str) continue;
      const x = it.transform[4], y = it.transform[5];
      let r = radky.find((q) => Math.abs(q.y - y) < 2.5);
      if (!r) { r = { y, kusy: [] }; radky.push(r); }
      r.kusy.push({ x, w: it.width, s: it.str });
    }
    radky.sort((a, b) => b.y - a.y);
    stranky.push(radky.map((r) => {
      r.kusy.sort((a, b) => a.x - b.x);
      let out = '', konec = null;
      for (const k of r.kusy) {
        if (konec !== null) { const mezera = k.x - konec; if (mezera > 12) out += '   '; else if (mezera > 1.2 && !out.endsWith(' ') && !k.s.startsWith(' ')) out += ' '; }
        out += k.s; konec = k.x + k.w;
      }
      return out.replace(/\s+$/, '');
    }));
  }
  return stranky;
}

// ---------- rozbor ----------
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const HRANICE = '\u2029';   // hranice odstavce v souvislém textu (nadpis, odrážka, kapitola) – věta přes ni nepokračuje
const cislo = (s) => Number(String(s).replace(/\s/g, '').replace(',', '.'));
const CISLOVKY = { jeden: 1, jedna: 1, jedno: 1, dva: 2, dvě: 2, tři: 3, čtyři: 4 };

// Konec / začátek věty v souvislém textu: tečka uzavírá větu, jen když za ní je mezera a velké písmeno
// a nejde o zkratku (tl., č., ul., min., max., cca, čl., odst., …), iniciálu (O. Pešky) ani číslo (1.01).
const ZKRATKY = new Set(['tl', 'č', 'ul', 'min', 'max', 'cca', 'čl', 'odst', 'písm', 'p', 'obr', 'tab', 'apod', 'např', 'resp', 'm', 'kg', 'ing', 'sb', 'poz', 'tj', 'tzv', 'vč', 'obj', 'popř', 'mj', 'č.p', 'k.ú', 'p.č', 'mm', 'cm', 'kw', 'np', 'pp', 'hod', 'tel']);
const JEDNOTKY = new Set(['mm', 'cm', 'm', 'kg', 'kw', 'kwp', 'hod']);
const jeKonec = (t, i) => {
  if (t[i] !== '.' || t[i + 1] !== ' ' || !/\p{Lu}/u.test(t[i + 2] || '')) return false;
  const slovo = (t.slice(Math.max(0, i - 12), i).match(/[\p{L}.]+$/u) || [''])[0].toLowerCase();
  if (JEDNOTKY.has(slovo) && /\d\s?$/.test(t.slice(Math.max(0, i - slovo.length - 3), i - slovo.length))) return true;   // „450 mm. Nově…“
  if (ZKRATKY.has(slovo) || ZKRATKY.has(slovo.replace(/^.*\./, ''))) return false;
  if (/^\p{L}$/u.test(slovo)) return false;   // iniciála
  return true;
};
function vetaKolem(t, i, j = i) {
  let z = i; while (z > 0 && t[z - 1] !== HRANICE && !(jeKonec(t, z - 2) && t[z - 1] === ' ') && !/(SKUTEČNOST\s*[–:-]?\s*)$/.test(t.slice(Math.max(0, z - 14), z)) && i - z < 400) z--;
  let k = j; while (k < t.length && t[k] !== HRANICE && !jeKonec(t, k) && k - j < 400) k++;
  return norm(t.slice(z, Math.min(t[k] === HRANICE ? k : k + 1, t.length)));
}

// stranky: pole stran, každá pole řádků. Vrací { nalezy: [{klic, popis, hodnota, strana, citace, cile}], nenalezeno: [text] }.
// volby.odstavce: každý řádek je samostatný odstavec (DOCX) – věta přes konec řádku nepokračuje.
export function rozborPbr(stranky, volby = {}) {
  // souvislý text s mapou pozice → strana (rozdělená slova na konci řádku se spojí)
  let t = ''; const mapa = [];
  // Hranice: krátký řádek bez interpunkce na konci (nadpis „Vytápění“, „Požární výška:“), řádek s odrážkou nebo číslem stránky
  // a před řádkem začínajícím odrážkou / písmenem kapitoly „l) …“ / číslem „2. …“.
  const ODRAZKA = /^(?:[-–•]+\s|[a-n]\)\s|\d{1,2}[.)]\s+\p{Lu}|\d{1,3}$)/u;
  // Záhlaví a zápatí (stejný řádek na více stranách, čísla stran se ignorují) se vynechají – jinak by se lepily do vět.
  const klicR = (r) => norm(r).replace(/\d+/g, '#');
  const vyskyt = new Map();
  stranky.forEach((st) => new Set(st.map(klicR)).forEach((k) => vyskyt.set(k, (vyskyt.get(k) || 0) + 1)));
  const opakovany = (r) => stranky.length >= 3 && klicR(r).length > 8 && vyskyt.get(klicR(r)) >= Math.max(2, Math.ceil(stranky.length / 2));
  let pred = '';
  stranky.forEach((st, si) => st.forEach((r) => {
    const n = norm(r); if (!n || opakovany(r)) return;
    mapa.push([t.length, si + 1]);
    if (t.endsWith('-') && /^\p{Ll}/u.test(n)) t = t.slice(0, -1) + n;
    else {
      // odrážka zalomená na další řádek (dlouhý řádek bez interpunkce) pokračuje
      const hranice = t && (volby.odstavce || ODRAZKA.test(n) || (((ODRAZKA.test(pred) && (pred.length < 70 || /[.;:]$/.test(pred))) || (pred.length <= 40 && !/[.,;–-]$/.test(pred)) || /:$/.test(pred)) && /^[\p{Lu}•–-]/u.test(n)));
      t = `${t}${t ? (hranice ? HRANICE : ' ') : ''}${n}`;
    }
    pred = n;
  }));
  const stranaNa = (i) => { let s = null; for (const [o, st] of mapa) { if (o > i) break; s = st; } return s; };
  const nalezy = [], nenalezeno = [];
  const pridej = (klic, popis, hodnota, citace, index, cile, extra = {}) => nalezy.push({ klic, popis, hodnota, citace: norm(citace).slice(0, 240), strana: volby.odstavce ? null : stranaNa(index), cile, ...extra });
  const najdi = (re) => { const m = re.exec(t); return m ? { m, veta: vetaKolem(t, m.index, m.index + m[0].length - 1).replace(/^(?:[-–•.„“"'o]\s*)+/u, ''), i: m.index } : null; };

  // A. základní údaje (tabulka kategorie stavby podle vyhl. 460/2021 Sb. bývá v kap. b)
  const misto = najdi(/Místo stavby\s*:\s*(.+?)(?=\s(?:KATEGORIE|Kategorie|TŘÍDA|Základní)|\u2029|$)/u);
  const mistoA = !misto && najdi(/místo stavby[^\u2029]*\u2029((?:(?!(?:[a-n]\)|Pozemek|KN|Obec|k\.\s?ú|p\.\s?č)\s?)[^\u2029]+\u2029?){1,2})/iu);
  let cp = null;
  if (!misto && !mistoA) for (const r of stranky.flat()) { const n = norm(r); if (/^\p{Lu}[^:]{2,40}\s(?:č\.\s?p\.|čp\.)\s?\d+/u.test(n)) { cp = { m: [n], i: Math.max(0, t.indexOf(n)) }; break; } }
  if (misto) pridej('adresa', 'Adresa objektu', norm(misto.m[1]), misto.m[0], misto.i, [{ cil: 'karta', cesta: 'objekt.adresa' }]);
  else if (mistoA) pridej('adresa', 'Adresa objektu (místo stavby)', norm(mistoA.m[1].replace(/\u2029/g, ', ')).replace(/,\s*$/, ''), mistoA.m[0], mistoA.i, [{ cil: 'karta', cesta: 'objekt.adresa' }]);
  else if (cp) pridej('adresa', 'Adresa objektu – ověřte (čtena z řádku s číslem popisným)', norm(cp.m[0]), cp.m[0], cp.i, [{ cil: 'karta', cesta: 'objekt.adresa' }], { neoznacit: true });
  else nenalezeno.push('adresa objektu');
  const nazev = najdi(/název stavby\s*:?\s*\u2029?\s*([^\u2029]{4,120})/iu);
  if (nazev) pridej('nazev', 'Název – v dokumentaci je název STAVBY (záměru), objekt se může jmenovat jinak', norm(nazev.m[1]), nazev.m[0], nazev.i, [{ cil: 'karta', cesta: 'objekt.nazev' }], { neoznacit: true });
  const inv = najdi(/Investor\s*:\s*(.+?),?\s*IČO?\s*:?\s*([\d ]{8,11})/u);
  const stav = !inv && najdi(/(?:Údaje o (?:žadateli \/ )?stavebníkovi|Stavebník|Investor)\s*:?\s*\u2029?\s*([^\u2029]{4,140})/u);
  if (stav) pridej('provozovatel', 'Provozovatel – v dokumentaci je STAVEBNÍK / INVESTOR, ověřte, že je i provozovatelem', norm(stav.m[1]), stav.m[0], stav.i, [{ cil: 'karta', cesta: 'objekt.provozovatel' }], { neoznacit: true });
  if (inv) {
    pridej('provozovatel', 'Provozovatel – v PBŘ je uveden INVESTOR, ověřte, že je i provozovatelem', norm(inv.m[1]).replace(/,$/, ''), inv.m[0], inv.i, [{ cil: 'karta', cesta: 'objekt.provozovatel' }], { neoznacit: true });
    pridej('ic', 'IČ – investora (ověřte)', inv.m[2].replace(/\s/g, ''), inv.m[0], inv.i, [{ cil: 'karta', cesta: 'objekt.ic' }], { neoznacit: true });
  }
  const zp = najdi(/Zastavěná plocha(?: stavby)?\s*:\s*(\d[\d ]*(?:[,.]\d+)?)\s*m(?:2|²)?(?![\p{L}])/u);
  if (zp) pridej('plocha', 'Zastavěná plocha (m²)', String(cislo(zp.m[1])).replace('.', ','), zp.m[0], zp.i, [{ cil: 'karta', cesta: 'charakter.zastavenaPlochaM2' }]);
  const np = najdi(/Počet nadzemních podlaží[^:]*:\s*(\d+)/u), pp = najdi(/Počet podzemních podlaží[^:]*:\s*(\d+)/u);
  const pc = !np && najdi(/Počet podlaží\s*:?\s*(\d+)\s*(NP)?/u);
  if (np) pridej('podlazi', 'Podlaží', `${np.m[1]} NP${pp && pp.m[1] !== '0' ? `, ${pp.m[1]} PP` : ''}`, `${np.m[0]}${pp ? `; ${pp.m[0]}` : ''}`, np.i, [{ cil: 'karta', cesta: 'charakter.podlazi' }]);
  else if (pc) pridej('podlazi', 'Podlaží', pc.m[2] ? `${pc.m[1]} NP` : `${pc.m[1]} (počet podlaží celkem – NP/PP neuvedeno)`, pc.m[0], pc.i, [{ cil: 'karta', cesta: 'charakter.podlazi' }]);
  else nenalezeno.push('počet podlaží');
  const hp = najdi(/požární výška[^=\u2029]{0,60}?h\s*=\s*([\d,]+)\s*m/iu) || najdi(/požární výška(?: objektu)?\s*(?:je\s*)?[:+]?\s*\+?\s*(\d+(?:,\d+)?)\s*m(?![\p{L}])/iu);
  if (hp) pridej('vyska', 'Výška – v PBŘ je POŽÁRNÍ výška h (celková výška objektu bývá vyšší, ověřte)', hp.m[1], hp.veta, hp.i, [{ cil: 'karta', cesta: 'charakter.celkovaVyskaM' }], { neoznacit: true });
  const os = najdi(/(?:Navrhovaný|Projektovaný|Celkový) počet osob\s*:?\s*(do\s*)?(\d+)\*?\s*osob/iu);
  if (os) {
    const asist = najdi(/Počet osob vyžadujících asistenci\s*:\s*(\d+)/u), ub = najdi(/Počet ubytovaných osob\s*:\s*(do\s*)?(\d+)/u);
    const h = [`${os.m[1] ? 'do ' : ''}${os.m[2]} osob (dle PBŘ)`, ub ? `ubytovaných ${ub.m[1] ? 'do ' : ''}${ub.m[2]}` : '', asist ? `${asist.m[1]} osob vyžadujících asistenci při evakuaci` : ''].filter(Boolean).join(', ');
    pridej('osoby', 'Obsazení osobami', h, os.m[0], os.i, [{ cil: 'karta', cesta: 'objekt.obsazeniOsobami' }, { cil: 'opText', cesta: 'udaje.osoby' }]);
  } else nenalezeno.push('počet osob');

  // B. konstrukce (kap. c)
  const ks = najdi(/(?:konstrukční systém|konstrukce objektu)[^.\u2029]{0,80}?(nehořlavý|smíšený|hořlavý)(?![\p{L}])/iu);
  if (ks) pridej('konstrukce', 'Konstrukce objektu', `${ks.m[1].toLowerCase()} konstrukční systém (dle PBŘ)`, ks.veta, ks.i, [{ cil: 'karta', cesta: 'charakter.konstrukce' }]);
  else nenalezeno.push('konstrukční systém');
  for (const [k, cesta, n, re] of [['steny', 'charakter.steny', 'Stěny', /(?:Nosné svislé|Svislé nosné) konstrukce(?: (?:jsou|tvoří|je)|\s*[–—-]|\s+\p{Ll})/u], ['stropy', 'charakter.stropy', 'Stropy', /(?:Stropní|Vodorovné nosné) konstrukce(?: (?:jsou|tvoří|je)|\s*[–—-]|\s+\p{Ll})/u], ['strecha', 'charakter.strecha', 'Střecha', /(?:Krov|Střecha|Střešní konstrukce|Nosná konstrukce střechy)(?: (?:je|jsou|tvoří)|\s*[–—-])/u], ['priccky', 'charakter.priccky', 'Příčky', /nenosné příčky|příčky (?:jsou|budou)|nov\p{L}+ (?:\p{L}+ )?příč(?:ky|ek)/iu]]) {
    const m = najdi(re); if (m) pridej(k, n, m.veta.replace(/\.$/, ''), m.veta, m.i, [{ cil: 'karta', cesta }]);
  }

  // C. požární úseky (kap. f) – kódy typu N 1.01/N2, P01.02, A 2.01; řádek tabulky s plochou a stupněm PB
  const useky = new Map(); let iUseku = null;
  stranky.forEach((st) => st.forEach((r) => {
    const m = norm(r).match(/^([A-Z]{1,2} ?\d{1,2}\.\d{2}(?:\/[A-Z]?\d+)?)\s+(.+?)\s+(\d+[,.]\d+)\s.*?(I{1,3}|IV|V|VI{0,2})\.\*?$/u);
    if (m && !useky.has(m[1])) { useky.set(m[1], `${m[1]} ${m[2]} (${m[4]}. SPB)`); if (iUseku === null) iUseku = t.indexOf(m[1]); }
  }));
  if (useky.size) pridej('useky', 'Požární úseky', [...useky.values()].join('; '), [...useky.values()].join('; '), iUseku ?? 0, [{ cil: 'karta', cesta: 'charakter.pozarniUseky' }]);
  else nenalezeno.push('požární úseky (tabulka)');

  // D. únikové cesty (kap. h)
  const uc = najdi(/k dispozici\s+(?:\S+\s+)?(nechráněná|částečně chráněná|chráněná)\s+úniková cesta( typu [ABC])?/iu) || najdi(/(?<![\p{L}])(nechráněn\p{L}*|částečně chráněn\p{L}*|chráněn\p{L}*)\s+únikov\p{L}*\s+cest\p{L}*( typu [ABC])?/iu);
  if (uc) { const d = uc.m[1].toLowerCase(); pridej('typUc', 'Typ únikové cesty', d.startsWith('ne') ? 'NÚC – nechráněná úniková cesta' : `${d.startsWith('částečně') ? 'ČCHÚC' : 'CHÚC'}${uc.m[2] ? uc.m[2].replace(' typu', '') : ''}`, uc.veta, uc.i, [{ cil: 'karta', cesta: 'charakter.typUnikoveCesty' }]); }
  const smer = najdi(/(?<![\p{L}])(jeden|jedna|dva|dvě|tři|\d+)\s+směr\p{L}*\s+(?:úniku|(?:\p{L}+\s+)?únikov)/iu);
  if (smer) pridej('pocetUc', 'Únikové cesty (počet směrů)', String(CISLOVKY[smer.m[1].toLowerCase()] ?? smer.m[1]), smer.veta, smer.i, [{ cil: 'karta', cesta: 'charakter.unikoveCesty' }]);

  // E. příjezd a nástupní plochy (kap. h1)
  const pr = najdi(/Příjezd k objektu je (?:zajištěn )?(?:po |z )/u) || najdi(/Příjezdov\p{L}+ komunikace k objektu je /u);
  if (pr) {
    const vzd = najdi(/Objekt je vzdálen od (?:veřejné )?komunikace[^.\u2029]{0,40}?\d+\s*m/u);
    pridej('prijezd', 'Příjezd', `${pr.veta.replace(/^(?:Příjezd k objektu je (?:zajištěn )?|Příjezdov\p{L}+ komunikace k objektu je )/u, '').replace(/\.$/, '')}${vzd ? `; ${vzd.m[0].charAt(0).toLowerCase()}${vzd.m[0].slice(1)}` : ''}`, `${pr.veta}${vzd ? ` … ${vzd.m[0]}` : ''}`, pr.i, [{ cil: 'karta', cesta: 'objekt.prijezdZ' }, { cil: 'opText', cesta: 'komunikace.stav' }]);
  }
  const nast = najdi(/nemusí být zřízena nástupní plocha|nástupní ploch\p{L}* (?:je|jsou) (?:navržen|zřízen)/iu);
  if (nast) pridej('nastup', 'Nástupní plocha', nast.veta, nast.veta, nast.i, [{ cil: 'opText', cesta: 'komunikace.pokyny' }, { poznamka: true }]);

  // F. voda (kap. h3) – vnější hydrant
  const hy = najdi(/(?:nadzemní|podzemní) hydrant/iu) || najdi(/Vnější odběrn\p{L}+ míst\p{L}*\s*[–—:-]?\s*[^.\u2029]{0,60}hydrant/iu);
  if (hy) {
    const gps = /(\d{2}[.,]\d{3,})\s*°?\s*N,?\s*(\d{1,3}[.,]\d{3,})\s*°?\s*E/u.exec(hy.veta);
    const popis = hy.veta.replace(/\s*(?:na GPS souřadnicích|GPS)\s*:?\s*\d{2}[.,]\d+\s*°?\s*N,?\s*\d{1,3}[.,]\d+\s*°?\s*E/u, '').replace(/\.$/, '');
    pridej('hydrant', 'Vnější hydrant (vodní zdroj) – PBŘ neuvádí měřený průtok, jen požadavek normy; ověřte zkouškou', { typ: 'hydrant', popis: `${popis} (dle PBŘ)`, prutokLs: null, overenPrutok: false, objemM3: null, gps: { sirka: gps ? cislo(gps[1]) : null, delka: gps ? cislo(gps[2]) : null }, znackaId: null }, hy.veta, hy.i, [{ cil: 'karta', pridat: 'vodniZdroje' }, { cil: 'opText', cesta: 'voda.zdroje', text: true }]);
  } else nenalezeno.push('vnější hydrant / vodní zdroj');
  const vnitrni = najdi(/NENÍ[^.\u2029]{0,40}POŽADAVEK na instalaci vnitřního odběrného místa|vnitřní (?:odběrn\p{L}+ míst\p{L}*|hydranty)[^.\u2029]{0,120}?(?:navrhují|navržen|osazen|instalac|bude provedena)/iu);
  if (vnitrni) pridej('vnitrni', 'Vnitřní odběrná místa', /^NENÍ/u.test(vnitrni.m[0]) ? norm(vnitrni.m[0]) : vnitrni.veta, vnitrni.veta, vnitrni.i, [{ poznamka: true }]);
  const hp6 = najdi(/(?:přenosn\p{L}+ )?hasicí přístroj\p{L}*[^.\u2029]{0,80}?(?:PG|PHP|CO2|PV|PP|PH)\s?\d*/u);
  if (hp6) pridej('php', 'Přenosné hasicí přístroje', hp6.veta, hp6.veta, hp6.i, [{ poznamka: true }]);

  // G. vypínání el. energie (kap. h6 / l)
  const vyp = najdi(/(TOTAL STOP|CENTRAL STOP|hlavní vypínač)[^.:\u2029]{0,80}?umístěn\p{L}*\s+/iu);
  if (vyp) {
    const misto = t.slice(vyp.i + vyp.m[0].length, vyp.i + vyp.m[0].length + 200).split(/\s[–-]\s|(?<=\p{L}{3})\.\s|\u2029/u)[0];
    pridej('vypinac', 'Hlavní vypínač el. proudu', `${/TOTAL STOP/i.test(vyp.veta) ? 'TOTAL STOP' : /CENTRAL STOP/i.test(vyp.veta) ? 'CENTRAL STOP' : 'Hlavní vypínač'} – ${norm(misto)} (dle PBŘ)`, vyp.veta, vyp.i, [{ cil: 'karta', cesta: 'media.hlavniVypinacEl' }]);
  } else nenalezeno.push('umístění hlavního vypínače / TOTAL STOP');

  // H. PBZ (kap. j) – „nenavrhuje“ u EPS, SHZ, ZOKT; úsek končí nadpisem dalšího zařízení
  const ZAR = [['eps', /EPS\s*[–-]\s*elektrická požární signalizace/iu, 'pbz.eps', 'EPS'], ['shz', /SHZ\s*[–-]\s*samočinné stabilní hasicí zařízení/iu, 'pbz.shz', 'SHZ'], ['zokt', /ZOKT\s*[–-]\s*samočinné zařízení pro odvod kouře/iu, 'pbz.zokt', 'ZOKT']];
  for (const [k, re, cesta, n] of ZAR) {
    const i = t.search(re); if (i < 0) continue;
    const dalsi = ZAR.filter((z) => z[0] !== k).map((z) => { const j = t.slice(i + 10).search(z[1]); return j < 0 ? Infinity : j + i + 10; }).concat([(() => { const j = t.slice(i + 10).search(/(?<![\p{L}])k\)\s/u); return j < 0 ? Infinity : j + i + 10; })()]);
    const u = t.slice(i, Math.min(...dalsi, i + 2500));
    const ne = /(se nenavrhuje|nenavrhuj|není požadován|není nutn)/iu.exec(u), ano = /(bude instalován|je navržen|se navrhuje|je instalován)/iu.exec(u);
    if (ne && (!ano || ne.index < ano.index)) pridej(k, n, 'NE (dle PBŘ se nenavrhuje)', vetaKolem(u, ne.index), i + ne.index, [{ cil: 'karta', cesta }]);
    else if (ano) pridej(k, n, 'ano – dle PBŘ navrženo (umístění doplňte)', vetaKolem(u, ano.index), i + ano.index, [{ cil: 'karta', cesta }], { neoznacit: true });
  }
  const aut = najdi(/autonomní detekc\p{L}* a signalizac\p{L}* požár/iu);
  if (aut) pridej('autonomni', 'Autonomní detekce a signalizace požáru', aut.veta, aut.veta, aut.i, [{ poznamka: true }]);

  // I. plyn, vytápění, nebezpečné látky, FVE
  const plyn = najdi(/napojen na (?:zemní )?plyn|vytápěn\p{L}* plyn/iu);
  if (plyn) pridej('plyn', 'Plyn – v PBŘ zmíněn, umístění hlavního uzávěru zjistěte (dotazník)', plyn.veta, plyn.veta, plyn.i, [{ poznamka: true }]);
  const kotel = najdi(/plynový kotel|kotelna je|zdrojem tepla|plynovou kotelnou/iu);
  if (kotel && kotel.veta !== plyn?.veta) pridej('kotel', 'Zdroj tepla', kotel.veta, kotel.veta, kotel.i, [{ poznamka: true }]);
  const bezLatek = najdi(/(?:nenachází|nebudou|nevyskytují)[^.\u2029]{0,80}(?:hořlavých kapalin|nebezpečn\p{L}+ lát|výbušnin)/iu);
  if (bezLatek) pridej('latky', 'Nebezpečné látky – dle PBŘ se nevyskytují; skutečný stav ověřte', 'NE', bezLatek.veta, bezLatek.i, [{ cil: 'karta', pridat: 'nebezpeci', hodnotaPolozky: { popis: 'NE', hasivo: '', znackaId: null } }, { cil: 'opText', cesta: 'udaje.latky', text: true }], { neoznacit: true });
  else nenalezeno.push('nebezpečné látky');
  const fve = najdi(/(?:fotovolta\p{L}*|FVE)[^.\u2029]{0,120}?(\d+(?:[,.]\d+)?)\s*kWp/iu);
  if (fve) pridej('fve', 'FVE – výkon (kWp)', cislo(fve.m[1]), fve.veta, fve.i, [{ cil: 'karta', cesta: 'fve.vykonKWp' }]);
  else nenalezeno.push('FVE (PBŘ ji neuvádí – může být instalována dodatečně, ověřte)');

  const prip = najdi(/Připojn\p{L}* bod\p{L}*[^.\u2029]{3,100}/u);
  if (prip) pridej('pripojky', 'Přípojky (voda, kanalizace, el.) – kde se napojují; uzávěry zjistěte na místě', prip.veta, prip.veta, prip.i, [{ poznamka: true }]);
  const zm = najdi(/[Zz]měn\p{L}* staveb\p{L}* skupiny (III|II|I)(?![\p{L}])/u);
  if (zm) pridej('zmenaSkupiny', 'PBŘ řeší ZMĚNU stavby (ČSN 73 0834) – údaje o objektu jsou často jen „stávající“', `změna stavby skupiny ${zm.m[1]}`, zm.veta, zm.i, [{ poznamka: true }]);

  // J. kategorie stavby – do poznámek (kontext)
  const kat = najdi(/KATEGORIE STAVBY\s*:\s*(Stavba kategorie [IV]+)/iu);
  if (kat) pridej('kategorie', 'Kategorie stavby (vyhl. 460/2021 Sb.)', kat.m[1], kat.m[0], kat.i, [{ poznamka: true }]);
  // Jiný dokument než PBŘ (průvodní / souhrnná zpráva): popisky bez „PBŘ“
  const jePbr = volby.jePbr ?? (/PO[ŽZ]ÁRNĚ BEZPEČNOSTNÍ ŘEŠENÍ/u.test(t) || (t.match(/po[žz]árně bezpečnostní řešení/giu) || []).length >= 2);
  if (!jePbr) for (const n of nalezy) for (const k of ['popis', 'hodnota']) if (typeof n[k] === 'string') n[k] = n[k].replace(/dle PBŘ/g, 'dle dokumentace').replace(/v PBŘ/g, 'v dokumentaci').replace(/PBŘ neuvádí/g, 'dokumentace neuvádí');
  for (const x of ['uzávěr vody', 'kontakty na provoz a osobu se znalostí objektu', 'ověřený průtok hydrantu', 'organizace PO mimo pracovní dobu']) nenalezeno.push(x);
  return { nalezy, nenalezeno, jePbr };
}

// Více dokumentů (PBŘ, průvodní a souhrnná zpráva…): vysledky = [{ soubor, ocr?, nalezy, nenalezeno }].
// Shodný údaj se převezme jednou; liší-li se dokumenty, nabídnou se všechny hodnoty neoznačené s upozorněním. „Nenalezeno“ = v žádném dokumentu.
const VICE_HODNOT = new Set(['hydrant', 'vnitrni', 'php', 'plyn', 'kotel', 'pripojky', 'autonomni', 'nastup', 'zmenaSkupiny', 'kategorie']);
const klicHodnoty = (h) => String(typeof h === 'object' && h ? h.popis : h).toLowerCase().replace(/\(dle [^)]*\)/g, '').replace(/[^\p{L}\d]+/gu, '');
export function slucRozbory(vysledky) {
  const vse = vysledky.flatMap((v) => v.nalezy.map((n) => ({ ...n, soubor: v.soubor, ocr: n.ocr ?? v.ocr ?? null })));
  const nalezy = [];
  for (const n of vse) {
    const stejne = nalezy.filter((x) => x.klic === n.klic);
    if (stejne.some((x) => klicHodnoty(x.hodnota) === klicHodnoty(n.hodnota))) continue;
    if (stejne.length && !VICE_HODNOT.has(n.klic)) {
      for (const x of [...stejne, n]) if (!x.konflikt) { x.konflikt = true; x.neoznacit = true; x.popis = `${x.popis} – POZOR: dokumenty uvádějí různé hodnoty, převezměte jednu`; }
    }
    nalezy.push(n);
  }
  const nenalezeno = vysledky.length ? vysledky.map((v) => v.nenalezeno).reduce((a, b) => a.filter((x) => b.includes(x))) : [];
  return { nalezy, nenalezeno };
}

// Nálezy → návrh převzetí (formát js/prebirani.js → pouzijNavrh). cile = { karta, opText, projekt }.
export function navrhZPbr(nalezy, cile, souborNazev = 'PBŘ') {
  const o = [], st = (data, cesta) => cesta.split('.').reduce((a, k) => (a == null ? a : a[k]), data);
  const nic = (v) => v === null || v === undefined || String(v).trim() === '';
  for (const n of nalezy) {
    const zdroj = `${n.soubor || souborNazev}${n.ocr != null ? ` (OCR, jistota ${n.ocr} %)` : ''}${n.strana ? `, str. ${n.strana}` : ''}: „${n.citace}“`;
    for (const c of n.cile) {
      if (c.poznamka) { if (!cile.projekt || cile.projekt.poznamkyKOvereni.some((p) => p.text === `${n.popis}: ${typeof n.hodnota === 'string' ? n.hodnota : ''}`.trim())) continue; o.push({ cil: 'projekt', pridat: 'poznamkyKOvereni', popis: `Poznámka k ověření: ${n.popis}`, hodnota: { tema: 'PBŘ', text: `${n.popis}: ${typeof n.hodnota === 'string' ? n.hodnota : ''}`.trim(), stav: 'k ověření' }, stavajici: null, zdroj, neoznacit: false }); continue; }
      const data = cile[c.cil]; if (!data) continue;
      if (c.pridat) {
        const pol = c.hodnotaPolozky || n.hodnota, seznam = data[c.pridat] || [];
        if (c.pridat === 'nebezpeci' && seznam.length) continue;
        if (seznam.some((x) => String(x.popis || '').trim().toLowerCase() === String(pol.popis || '').trim().toLowerCase())) continue;
        o.push({ cil: c.cil, pridat: c.pridat, popis: n.popis, hodnota: pol, stavajici: null, zdroj, neoznacit: !!n.neoznacit });
        continue;
      }
      const hodnota = c.text && typeof n.hodnota === 'object' ? n.hodnota.popis : n.hodnota, s = st(data, c.cesta);
      if (!nic(s) && String(s) === String(hodnota)) continue;
      o.push({ cil: c.cil, cesta: c.cesta, popis: `${n.popis}${c.cil === 'opText' ? ' → OP – příloha' : ''}`, hodnota, stavajici: nic(s) ? null : String(s), zdroj, neoznacit: !!n.neoznacit });
    }
  }
  return o;
}
