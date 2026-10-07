// Export dokumentace do PDF: karty, texty a výkresy (vektorově) do jednoho souboru. Vloží písmo Roboto, takže diakritika je správně.
import { vykresliKartu, vykresliTextovyList } from './karta.js';
import { vykresliSvgDoPdf } from './svg2pdf.js';
import { renderListu } from '../kresleni/render.js';
import { rozlozeniListu, pouziteZnacky } from '../kresleni/prvky.js';

const MM = 72 / 25.4;
const jeNode = () => typeof process !== 'undefined' && !!process.versions?.node && typeof window === 'undefined';

let lib = null;
export async function nactiPdfLib() {
  if (lib) return lib;
  if (typeof self === 'undefined') globalThis.self = globalThis;           // UMD fontkit v Node
  const m = await import('../../vendor/pdflib/pdf-lib.esm.min.js');
  const fk = await import('../../vendor/pdflib/fontkit.umd.min.js');
  lib = { ...m, fontkit: globalThis.fontkit || fk.default || fk };
  return lib;
}

async function bajtyZ(rel) {
  if (jeNode()) { const fs = await import('node:fs/promises'); return new Uint8Array(await fs.readFile(new URL(rel, import.meta.url))); }
  const r = await fetch(new URL(rel, import.meta.url).href); if (!r.ok) throw new Error(`Nepodařilo se načíst ${rel}`); return new Uint8Array(await r.arrayBuffer());
}
const zBase64 = (b64) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
async function nactiFonty() {
  const v = globalThis.__FONTY__;                                          // jednosouborová sestava je má vložené
  if (v) return { regular: zBase64(v.regular), bold: zBase64(v.bold) };
  return { regular: await bajtyZ('../../vendor/fonts/Roboto-Regular.woff'), bold: await bajtyZ('../../vendor/fonts/Roboto-Bold.woff') };
}

const dataUri = (bajty) => { let s = ''; for (let i = 0; i < bajty.length; i += 0x8000) s += String.fromCharCode(...bajty.subarray(i, i + 0x8000)); return `data:image/png;base64,${btoa(s)}`; };
async function bajtyZnacky(z) {
  if (z.png.startsWith('data:')) return zBase64(z.png.split(',')[1]);
  if (jeNode()) { const fs = await import('node:fs/promises'); return new Uint8Array(await fs.readFile(new URL(`../../${z.png}`, import.meta.url))); }
  return new Uint8Array(await (await fetch(z.png)).arrayBuffer());
}

// projekt: celý projekt; volby: { listy: pole id (výchozí všechny), katalog: Map(id → značka) }. Vrací Uint8Array s PDF.
export async function exportujPdf(projekt, volby = {}) {
  const L = await nactiPdfLib(), katalog = volby.katalog || new Map();
  const vybrane = projekt.listy.filter((l) => !volby.listy || volby.listy.includes(l.id));
  if (!vybrane.length) throw new Error('Není vybraný žádný list k exportu.');
  const pdfDoc = await L.PDFDocument.create();
  pdfDoc.registerFontkit(L.fontkit);
  const f = await nactiFonty();
  const fonty = { regular: await pdfDoc.embedFont(f.regular, { subset: true }), bold: await pdfDoc.embedFont(f.bold, { subset: true }) };

  // značky použité v exportovaných listech (karta: nebezpečí a vodní zdroje; výkresy: značky)
  const ids = new Set();
  for (const l of vybrane) {
    if (l.karta) { l.karta.nebezpeci.forEach((n) => n.znackaId && ids.add(n.znackaId)); l.karta.vodniZdroje.forEach((v) => v.znackaId && ids.add(v.znackaId)); }
    if (l.vykres) pouziteZnacky(l.vykres.prvky).forEach((i) => ids.add(i));
  }
  const bajty = new Map(), uri = new Map(), emb = new Map();
  for (const id of ids) { const z = katalog.get(id); if (!z) continue; const b = await bajtyZnacky(z); bajty.set(id, b); uri.set(id, dataUri(b)); }
  const ctxZaklad = {
    lib: L, pdfDoc, fonty, obrazky: new Map(),
    znacka: (id) => { if (!id || !bajty.has(id)) return null; if (!emb.has(id)) emb.set(id, null); return emb.get(id); },
  };
  for (const id of bajty.keys()) emb.set(id, await pdfDoc.embedPng(bajty.get(id)));

  const objekt = projekt.listy.find((l) => l.karta)?.karta.objekt.nazev || '';
  for (const l of vybrane) {
    if (l.typ === 'karta') await vykresliKartu(ctxZaklad, l, projekt);
    else if (l.typ === 'text') await vykresliTextovyList(ctxZaklad, l);
    else if (l.vykres) {
      const v = l.vykres, { W, H } = rozlozeniListu(v), page = pdfDoc.addPage([W * MM, H * MM]);
      const svg = renderListu(v, { objektNazev: objekt, nazevListu: l.nazev, znacky: katalog, symbolHref: (id) => uri.get(id) || '', prilohy: projekt.prilohy });
      await vykresliSvgDoPdf(svg, { ...ctxZaklad, page });
    }
  }
  const zprac = projekt.listy.find((l) => l.karta)?.karta.zpracoval.jmeno || '';
  pdfDoc.setTitle(`${projekt.nazev}${objekt && objekt !== projekt.nazev ? ` – ${objekt}` : ''}`);
  pdfDoc.setAuthor(zprac); pdfDoc.setSubject('Dokumentace zdolávání požárů'); pdfDoc.setCreator('Požární plánovač'); pdfDoc.setProducer('Požární plánovač (pdf-lib)');
  pdfDoc.setLanguage('cs-CZ'); pdfDoc.setKeywords(['DZP', 'operativní karta']);
  return pdfDoc.save();
}

export function stahniBajty(bajty, jmeno, mime = 'application/pdf') {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bajty], { type: mime })); a.download = jmeno;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export const jmenoPdf = (nazev) => `${String(nazev || 'dokumentace').replace(/[^\p{L}\p{N}_-]+/gu, '_').replace(/^_+|_+$/g, '') || 'dokumentace'}.pdf`;
