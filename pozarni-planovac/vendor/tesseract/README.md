# OCR – Tesseract.js (offline)

Rozpoznání textu v naskenovaných PBŘ (`js/ocr.js`). Vše běží v prohlížeči, nic se neodesílá.

| soubor | zdroj | licence |
|---|---|---|
| `tesseract.esm.min.js`, `worker.min.js` | npm `tesseract.js@7.0.0` (dist) | Apache-2.0 |
| `tesseract-core-simd-lstm.wasm.js` | npm `tesseract.js-core@6.1.2` (jen varianta SIMD + LSTM; WebAssembly SIMD mají prohlížeče od Chrome 91, Firefox 89, Safari 16.4) | Apache-2.0 (`LICENSE-Apache-2.0.txt`) |
| `ces.traineddata.gz` | npm `@tesseract.js-data/ces@1.0.0`, složka `4.0.0_best_int` (model z tesseract-ocr/tessdata, Apache-2.0) | balíček MIT, data Apache-2.0 |
