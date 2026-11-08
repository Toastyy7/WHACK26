import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Bundle workers, WASM and English data with the app. OCR never needs a CDN.
const root = new URL('../', import.meta.url);
const destination = new URL('public/ocr/', root);
await mkdir(destination, { recursive: true });
for (const [source, name] of [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['tesseract.js/dist/worker.min.js.LICENSE.txt', 'worker.LICENSE.txt'],
  ['tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-relaxedsimd-lstm.wasm.js'],
  ['tesseract.js-core/LICENSE', 'core.LICENSE.txt'],
  ['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', 'eng.traineddata.gz'],
]) await copyFile(fileURLToPath(new URL(`node_modules/${source}`, root)), new URL(name, destination));
console.log('Local OCR assets prepared.');
