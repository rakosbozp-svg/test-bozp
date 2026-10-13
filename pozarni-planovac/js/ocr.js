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

export async function ocrPdf(doc, { dpi = 200, prubeh = () => {} } = {}) {
  tess ||= await import('../vendor/tesseract/tesseract.esm.min.js');
  const T = tess.default || tess, z = await zdroje();
  prubeh('Připravuji rozpoznávání textu…');
  const w = await T.createWorker('ces', 1, { workerPath: z.workerPath, corePath: z.corePath, langPath: z.langPath, gzip: true, workerBlobURL: false, cacheMethod: 'none', errorHandler: () => {} });
  const stranky = [], jistoty = [];
  try {
    for (let n = 1; n <= doc.numPages; n++) {
      prubeh(`Rozpoznávám text (OCR): strana ${n} z ${doc.numPages}…`);
      const s = await doc.getPage(n), vp = s.getViewport({ scale: dpi / 72 });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await s.render({ canvasContext: g, viewport: vp }).promise;
      const { data } = await w.recognize(c);
      stranky.push(data.text.split('\n').map((r) => r.trim()).filter(Boolean)); jistoty.push(data.confidence);
      c.width = c.height = 0;
    }
  } finally { await w.terminate(); }
  return { stranky, jistoty: jistoty.map(Math.round) };   // jistota rozpoznání po stranách (0–100)
}
