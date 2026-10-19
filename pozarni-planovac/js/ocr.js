// OCR naskenovaného PDF (bez textové vrstvy) – Tesseract.js v prohlížeči, český model, offline (vendor/tesseract).
// Stránky se vykreslí pdf.js do plátna (≈ 200 dpi) a rozpoznají. Výstup = řádky po stránkách jako radkyZPdf.

let tess = null;
const cesta = (p) => new URL(`../vendor/tesseract/${p}`, import.meta.url).href;
async function zdroje() {
  const v = globalThis.__OCR__;   // jednosouborová sestava: blob URL a data vložená
  // Jednosouborová sestava: soběstačný worker s jádrem i modelem (viz tools/sestav_jeden_soubor.mjs).
  // (Předání dat přímo – langs [{code, data}] – v tesseract.js 7.0.0 nefunguje: initialize použije data místo kódu jazyka.)
  if (v) return { workerPath: v.worker, corePath: v.core, langPath: v.langPath };
  return { workerPath: cesta('worker.min.js'), corePath: cesta('tesseract-core-simd-lstm.wasm.js'), langPath: cesta('').replace(/\/$/, '') };
}

// Časový limit: tesseract.js při chybě načtení (např. chybějící model) promise nikdy nevyřeší – bez limitu by čtení viselo.
const sLimitem = (prom, ms, co, pad) => Promise.race([prom, pad, new Promise((_, rej) => setTimeout(() => rej(new Error(`${co} nedoběhlo do ${Math.round(ms / 1000)} s – rozpoznávání textu přerušeno.`)), ms))]);

export async function ocrPdf(doc, { dpi = 200, prubeh = () => {}, limitStrany = 120000 } = {}) {
  tess ||= await import('../vendor/tesseract/tesseract.esm.min.js');
  const T = tess.default || tess, z = await zdroje();
  prubeh('Připravuji rozpoznávání textu…');
  let zapadni; const pad = new Promise((_, rej) => { zapadni = rej; }); pad.catch(() => {});
  const chyba = (e) => zapadni(new Error(`Rozpoznávání textu selhalo: ${e?.message || e}`));
  // Web Worker, který tesseract.js vytvoří (synchronně při createWorker), si podržíme – když spuštění selže, jinak by běžel dál.
  const Puvodni = globalThis.Worker; let surovy = null;
  if (Puvodni) globalThis.Worker = class extends Puvodni { constructor(...a) { super(...a); surovy ||= this; } };
  let start;
  try { start = T.createWorker('ces', 1, { workerPath: z.workerPath, corePath: z.corePath, langPath: z.langPath, gzip: true, workerBlobURL: false, cacheMethod: 'none', errorHandler: chyba }); }
  finally { if (Puvodni) globalThis.Worker = Puvodni; }
  let w = null;
  const stranky = [], jistoty = [];
  try {
    w = await sLimitem(start, 60000, 'Spuštění OCR', pad);
    for (let n = 1; n <= doc.numPages; n++) {
      prubeh(`Rozpoznávám text (OCR): strana ${n} z ${doc.numPages}…`);
      const s = await doc.getPage(n), vp = s.getViewport({ scale: dpi / 72 });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await s.render({ canvasContext: g, viewport: vp }).promise;
      const { data } = await sLimitem(w.recognize(c), limitStrany, `OCR strany ${n}`, pad);
      stranky.push(data.text.split('\n').map((r) => r.trim()).filter(Boolean)); jistoty.push(data.confidence);
      c.width = c.height = 0;
    }
  } finally {
    // worker se ukončí vždy – i když spuštění vypršelo (pak až doběhne)
    const konec = (x) => x?.terminate().catch(() => {});
    if (w) await konec(w); else { surovy?.terminate(); start.then(konec, () => {}); }
  }
  return { stranky, jistoty: jistoty.map(Math.round) };   // jistota rozpoznání po stranách (0–100)
}
