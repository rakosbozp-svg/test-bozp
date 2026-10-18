// Import podkladů: rozpozná formát, provede uživatele volbami (jednotky, měřítko, režim) a vrátí buď rastrový podklad,
// nebo upravitelné prvky. Nic se nehádá potichu: když soubor neobsahuje spolehlivé rozměry, měřítko zůstane NEOVĚŘENÉ do kalibrace.
import { formular, potvrd } from '../../dialogy.js';
import { nactiDxf, prevedEntity, primitivaNaPrvky, jednotkyZHlavicky, odhadJednotek } from './dxf.js';
import { nactiSvg } from './svg.js';
import { otevriPdf, nactiPdfJs, pdfVektor, pdfRastr } from './pdf.js';
import { nactiObrazek } from '../podklad.js';
import * as P from '../prvky.js';
import { normalizujVelikost } from '../../model.js';
import { naCislo } from '../../formular.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString('cs-CZ');
const MAX_BEZ_VAROVANI = 12000;

export const koncovka = (n) => (/\.([a-z0-9]+)$/i.exec(n || '') || [])[1]?.toLowerCase() || '';

// Vloží vektorový výsledek do výkresu (čistá funkce nad modelem – testovatelná bez prohlížeče).
export function vlozVektor(v, { prvky, vrstvy, meritko }) {
  const prazdny = !v.prvky.length && !v.pozadi;
  if (prazdny) { const n = P.navrhniMeritko({ ...v, prvky }); if (n) v.meritko.pomer = n; }
  const pomer = v.meritko.pomer;
  for (const p of prvky) if (p.druh === 'text') { p.vyska = normalizujVelikost(Math.max(1, ((p.vyskaM ?? 0.003) * 1000) / pomer)); delete p.vyskaM; }
  for (const l of vrstvy) if (!v.vrstvy.some((x) => x.id === l.id)) v.vrstvy.push(l);
  v.prvky.push(...prvky);
  P.obnovDvere(v.prvky);
  for (const d of prvky) if (d.druh === 'dvere' && !d.stenaId) P.pripojDvere(d, v.prvky, [d.x, d.y], 0.6);
  if (prazdny) P.vycentrujOkno(v);
  if (!v.meritkoZdroj || v.meritkoZdroj.overeno) v.meritkoZdroj = meritko;
  P.synchronizujLegendu(v);
  return { pridano: prvky.length, pomer };
}

// Přeškáluje celý obsah výkresu podle známé vzdálenosti dvou bodů (kalibrace neověřeného vektorového importu).
export function kalibrujVektor(v, bodA, bodB, delkaM) {
  if (!(delkaM > 0)) throw new Error('Známá délka musí být kladné číslo');
  const d = Math.hypot(bodB[0] - bodA[0], bodB[1] - bodA[1]);
  if (d < 1e-9) throw new Error('Body kalibrace splývají');
  const f = delkaM / d;
  for (const p of v.prvky) P.meritkujPrvek(p, bodA, f, f);
  P.obnovDvere(v.prvky);
  v.meritkoZdroj = { ...(v.meritkoZdroj || {}), overeno: true, zdroj: 'kalibrace', popis: `ověřeno kalibrací (${fmt(delkaM)} m)` };
  const n = P.navrhniMeritko(v); if (n) { v.meritko.pomer = n; P.vycentrujOkno(v); }
  return f;
}

function souhrn(stat, nep, extra = []) {
  const radky = [];
  const j = Object.entries(stat).filter(([, n]) => n).map(([k, n]) => `${n}× ${({ cara: 'čára', stena: 'stěna', text: 'text', dvere: 'dveře', elipsa: 'kružnice/elipsa', plocha: 'plocha' })[k] || k}`);
  if (j.length) radky.push(`Převedeno: ${j.join(', ')}.`);
  radky.push(...extra);
  const n = Object.entries(nep).map(([k, c]) => `${c}× ${k}`);
  if (n.length) radky.push(`Nepřevedeno: ${n.join(', ')}.`);
  return radky;
}

// ---------- DXF ----------
async function importDxf(soubor) {
  const buf = await soubor.arrayBuffer();
  const r = nactiDxf(buf);
  if (!r.primitiva.length) throw new Error('V DXF nebyly nalezeny žádné převoditelné objekty (čáry, texty, kružnice…).');
  const bb = r.bbox, rozmerJ = [bb.x1 - bb.x0, bb.y1 - bb.y0];
  let jednotkyHtml, zprava = '';
  if (r.jednotky) {
    jednotkyHtml = `<p class="dlg__text">Jednotky v souboru: <b>${esc(r.jednotky.nazev)}</b> (hlavička <code>$INSUNITS</code>). Výkres bude velký ${fmt(rozmerJ[0] * r.jednotky.mNa)} × ${fmt(rozmerJ[1] * r.jednotky.mNa)} m.</p><input type="hidden" name="jednotky" value="hlavicka">`;
  } else {
    zprava = '<div class="zprava pozor">Soubor neuvádí jednotky, takže skutečné rozměry nejsou spolehlivé. Vyberte, v čem je výkres nakreslený. Po importu zůstane měřítko neověřené, dokud ho nezkalibrujete podle známé délky.</div>';
    jednotkyHtml = `<div class="moznosti">${r.odhad.kandidati.map((k) => `<label class="moznost"><input type="radio" name="jednotky" value="${k.id}" ${k.id === r.odhad.doporuceno ? 'checked' : ''}><div><b>${esc(k.nazev)}</b><span>výkres by měl ${fmt(k.rozmerM[0])} × ${fmt(k.rozmerM[1])} m${k.id === r.odhad.doporuceno ? ` – odhad (${esc(r.odhad.duvod)})` : ''}</span></div></label>`).join('')}</div>`;
  }
  const dlg = await formular({
    titul: 'Import DXF',
    html: `<div class="zprava">${esc(soubor.name)} · DXF ${esc(r.verze || '')} · kódování ${esc(r.kodovani)} · ${r.vysl.entity.length} objektů, ${r.pocetVrstev} vrstev${r.koty.length ? `, ${r.koty.length} kót` : ''}</div>${zprava}${jednotkyHtml}
      <label class="chk"><input type="checkbox" name="rozpoznat" checked> Rozpoznat stěny a dveře podle názvů vrstev a bloků (nejisté převody se označí ke kontrole)</label>
      ${Object.keys(r.nepodporovane).length ? `<div class="zprava">Nebude převedeno: ${esc(Object.entries(r.nepodporovane).map(([k, c]) => `${c}× ${k}`).join(', '))}.</div>` : ''}`,
    ano: 'Importovat',
  });
  if (!dlg.ok) return null;
  const rozpoznat = !!dlg.pole.rozpoznat;
  const hl = dlg.pole.jednotky === 'hlavicka', kand = r.odhad?.kandidati.find((k) => k.id === dlg.pole.jednotky);
  const jed = hl ? r.jednotky : kand;
  const prim = rozpoznat ? r.primitiva : prevedEntity(r.vysl, { rozpoznat: false }).primitiva;
  const pv = primitivaNaPrvky(r.vysl, prim, hl ? r.jednotky.mNa : kand.mNa, { rozpoznat });
  const meritko = hl ? { overeno: true, zdroj: 'dxf-hlavicka', popis: `jednotky z hlavičky DXF: ${jed.nazev}` } : { overeno: false, zdroj: 'dxf-odhad', popis: `jednotky vybrané uživatelem (${jed.nazev}), soubor je neuvádí` };
  const extra = [];
  if (pv.statistika.dvere) extra.push(`Dveře (${pv.statistika.dvere}) jsou rozpoznané podle názvu bloku – zkontrolujte jejich polohu a šířku.`);
  if (pv.statistika.stena) extra.push('Čáry na vrstvách se jménem stěn jsou importované jako tenké stěny; tloušťku změníte ve vlastnostech.');
  return { typ: 'vektor', vysledek: { prvky: pv.prvky, vrstvy: pv.vrstvy, meritko }, souhrn: souhrn(pv.statistika, r.nepodporovane, extra) };
}

// ---------- společný dialog pro SVG a PDF (neznají skutečné rozměry) ----------
const poleMeritkaTisku = (vychozi = 100, popis = '') => `<label class="rk-field"><span class="rk-field__label">Měřítko tisku výkresu 1 : N</span><input class="rk-field__control" name="n" type="text" inputmode="decimal" value="${vychozi}" required><span class="rk-field__msg">${esc(popis || 'Výkres neobsahuje skutečné rozměry. Zadejte měřítko, v jakém byl vytištěn; po importu ho ověřte kalibrací podle známé délky.')}</span></label>`;

async function importSvg(soubor) {
  const text = await soubor.text(), r = nactiSvg(text);
  if (!r.primitiva.length) throw new Error('V SVG nebyly nalezeny žádné převoditelné objekty.');
  const dlg = await formular({ titul: 'Import SVG', html: `<div class="zprava">${esc(soubor.name)} · ${r.primitiva.length} objektů${r.jisteMm ? ' · rozměr listu je v souboru uveden v mm' : ' · rozměr listu v souboru není uveden jistě (předpokládá se 96 dpi)'}</div>${poleMeritkaTisku(100)}`, ano: 'Importovat' });
  if (!dlg.ok) return null;
  const N = naCislo(dlg.pole.n); if (!(N > 0)) throw new Error('Měřítko tisku musí být kladné číslo.');
  const mNaJ = (r.mmNaJednotku * N) / 1000;
  const pv = primitivaNaPrvky({ vrstvy: new Map() }, r.primitiva.map((p) => ({ ...p, vrstva: 'SVG' })), mNaJ, { osaYNahoru: false, rozpoznat: false });
  return { typ: 'vektor', vysledek: { prvky: pv.prvky, vrstvy: pv.vrstvy, meritko: { overeno: false, zdroj: 'svg-tisk', popis: `měřítko tisku 1 : ${N} zadané uživatelem` } }, souhrn: souhrn(pv.statistika, r.nepodporovane) };
}

// ---------- PDF ----------
async function importPdf(soubor) {
  const buf = await soubor.arrayBuffer(), doc = await otevriPdf(buf), l = await nactiPdfJs();
  const stran = doc.numPages;
  const dlg = await formular({
    titul: 'Import PDF',
    html: `<div class="zprava">${esc(soubor.name)} · ${stran} ${stran === 1 ? 'strana' : stran < 5 ? 'strany' : 'stran'}</div>
      ${stran > 1 ? `<label class="rk-field"><span class="rk-field__label">Strana</span><select class="rk-field__control" name="strana">${Array.from({ length: stran }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}</select></label>` : '<input type="hidden" name="strana" value="1">'}
      <div class="moznosti">
        <label class="moznost"><input type="radio" name="rezim" value="vektor" checked><div><b>Vektorově – upravitelné prvky</b><span>Čáry, plochy a texty se převedou na prvky výkresu. Vhodné pro výkresy z CADu.</span></div></label>
        <label class="moznost"><input type="radio" name="rezim" value="rastr"><div><b>Jako rastrový podklad</b><span>Přesný obrázek strany, na který kreslíte. Vhodné pro skeny a složité výkresy.</span></div></label>
      </div>${poleMeritkaTisku(100, 'Platí pro vektorový režim. PDF neobsahuje skutečné rozměry – po importu měřítko ověřte kalibrací podle známé délky.')}`,
    ano: 'Pokračovat',
  });
  if (!dlg.ok) return null;
  const page = await doc.getPage(Number(dlg.pole.strana) || 1);
  if (dlg.pole.rezim === 'rastr') {
    const ob = await pdfRastr(page, 3000);
    return { typ: 'raster', obrazek: { nazev: `${soubor.name} (strana ${page.pageNumber})`, ...ob } };
  }
  const N = naCislo(dlg.pole.n); if (!(N > 0)) throw new Error('Měřítko tisku musí být kladné číslo.');
  const r = await pdfVektor(page, l);
  if (!r.primitiva.length) throw new Error('Na této straně nejsou vektorové objekty. Zkuste import „Jako rastrový podklad“.');
  if (r.primitiva.length > MAX_BEZ_VAROVANI) {
    const ok = await potvrd(`Strana obsahuje ${r.primitiva.length.toLocaleString('cs-CZ')} prvků`, { ano: 'Importovat vektorově', popis: 'Editor může být při tak velkém počtu prvků pomalý. Rastrový podklad je rychlejší a stejně přesný. Pokračovat vektorově?' });
    if (!ok) return null;
  }
  const mNaJ = (0.3528 * N) / 1000;   // 1 pt = 0,3528 mm na papíře
  const pv = primitivaNaPrvky({ vrstvy: new Map() }, r.primitiva, mNaJ, { osaYNahoru: false, rozpoznat: false });
  return { typ: 'vektor', vysledek: { prvky: pv.prvky, vrstvy: pv.vrstvy, meritko: { overeno: false, zdroj: 'pdf-tisk', popis: `měřítko tisku 1 : ${N} zadané uživatelem` } }, souhrn: souhrn(pv.statistika, r.nepodporovane, r.pocetPredSlucovanim > r.primitiva.length ? [`Navazující úsečky byly sloučeny (${r.pocetPredSlucovanim.toLocaleString('cs-CZ')} → ${r.primitiva.length.toLocaleString('cs-CZ')} prvků).`] : []) };
}

// ---------- vstup ----------
export async function importujSoubor(soubor) {
  const k = koncovka(soubor.name), typ = soubor.type;
  if (k === 'dwg') throw new Error('Formát DWG nelze v prohlížeči bezpečně převést. Uložte výkres v CADu jako DXF (ASCII, verze 2000–2018) nebo jako PDF a importujte ten.');
  if (k === 'dxf') return importDxf(soubor);
  if (k === 'svg' || typ === 'image/svg+xml') return importSvg(soubor);
  if (k === 'pdf' || typ === 'application/pdf') return importPdf(soubor);
  if (/^(png|jpe?g)$/.test(k) || /^image\/(png|jpeg)$/.test(typ)) return { typ: 'raster', obrazek: await nactiObrazek(soubor) };
  throw new Error(`Formát souboru „${soubor.name}“ není podporován. Podporované: DXF, SVG, PDF, PNG, JPG (DWG uložte z CADu jako DXF).`);
}
export { odhadJednotek, jednotkyZHlavicky };
