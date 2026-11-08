import { createWorker } from 'tesseract.js';
import { improveContrast, headingBands } from './imagePreparation.js';
import { parseStatement } from './parseStatement.js';

function checkAbort(signal) {
  if (signal?.aborted) throw new DOMException('Reading cancelled.', 'AbortError');
}

export async function prepareImage(image) {
  const scale = Math.min(2000 / image.width, 8000 / image.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  canvas.ocrBands = headingBands(pixels);
  canvas.originalPixels = pixels;
  context.putImageData(improveContrast(new ImageData(new Uint8ClampedArray(pixels.data), pixels.width, pixels.height)), 0, 0);
  return canvas;
}

export async function createOcrReader({ signal, onProgress = () => {} } = {}) {
  checkAbort(signal);
  const assets = new URL(`${import.meta.env.BASE_URL}ocr/`, document.baseURI).href;
  const worker = await createWorker('eng', 1, {
    workerPath: `${assets}worker.min.js`, corePath: assets,
    langPath: assets, workerBlobURL: false, cacheMethod: 'none',
    logger: ({ status, progress }) => onProgress(status === 'recognizing text'
      ? `Reading image text: ${Math.round(progress * 100)}%` : 'Preparing local text reader…'),
  });
  if (signal?.aborted) { await worker.terminate(); checkAbort(signal); }
  const abort = () => { worker.terminate(); };
  signal?.addEventListener('abort', abort, { once: true });
  try { await worker.setParameters({ tessedit_pageseg_mode: '6' }); }
  catch (error) { await worker.terminate(); throw error; }
  function recognize(image, options, output) {
    checkAbort(signal);
    return new Promise((resolve, reject) => {
      const cancelled = () => reject(new DOMException('Reading cancelled.', 'AbortError'));
      signal?.addEventListener('abort', cancelled, { once: true });
      worker.recognize(image, options, output).then(resolve, reject)
        .finally(() => signal?.removeEventListener('abort', cancelled));
    });
  }
  return {
    async read(image) {
      checkAbort(signal);
      const canvas = await prepareImage(image);
      try {
        const wordsToItems = (data, left = 0, top = 0) => (data.blocks ?? []).flatMap((block) => block.paragraphs.flatMap((paragraph) =>
          paragraph.lines.flatMap((line) => line.words.map((word) => ({
            text: word.text, x: word.bbox.x0 + left, y: -((word.bbox.y0 + word.bbox.y1) / 2 + top),
            width: word.bbox.x1 - word.bbox.x0, height: word.bbox.y1 - word.bbox.y0,
            confidence: word.confidence,
          })))));
        await worker.setParameters({ tessedit_pageseg_mode: '6' });
        let { data } = await recognize(canvas, {}, { text: true, blocks: true });
        let items = wordsToItems(data);
        let headerPatch = null;
        if (!parseStatement([items]).supportedPages) {
          // Full-page OCR often skips coloured headers as decoration. Read those
          // bands separately; their original coordinates preserve column identity.
          for (const band of canvas.ocrBands) {
            checkAbort(signal);
            const crop = document.createElement('canvas');
            const left = band.left + 3, top = band.top + 2;
            crop.width = Math.max(1, band.right - band.left - 6);
            crop.height = Math.max(1, band.bottom - band.top - 4);
            const context = crop.getContext('2d');
            context.putImageData(canvas.originalPixels, -left, -top);
            const pixels = context.getImageData(0, 0, crop.width, crop.height);
            for (let index = 0; index < pixels.data.length; index += 4) {
              const gray = (pixels.data[index] + pixels.data[index + 1] + pixels.data[index + 2]) / 3;
              pixels.data[index] = pixels.data[index + 1] = pixels.data[index + 2] = gray > 160 ? 0 : 255;
            }
            context.putImageData(pixels, 0, 0);
            await worker.setParameters({ tessedit_pageseg_mode: '7' });
            const result = await recognize(crop, {}, { blocks: true });
            const candidate = items.filter((item) => -item.y < band.top || -item.y > band.bottom)
              .concat(wordsToItems(result.data, left, top));
            crop.width = 0; crop.height = 0;
            if (parseStatement([candidate]).supportedPages) { items = candidate; headerPatch = { band, words: wordsToItems(result.data, left, top) }; break; }
          }
        }
        const initial = parseStatement([items]);
        if (!initial.supportedPages || (initial.transactions.length && initial.transactions.every((row) => row.amount === 0))) {
          await worker.setParameters({ tessedit_pageseg_mode: '11' });
          ({ data } = await recognize(canvas, {}, { blocks: true }));
          let sparse = wordsToItems(data);
          if (headerPatch) sparse = sparse.filter((item) => -item.y < headerPatch.band.top || -item.y > headerPatch.band.bottom).concat(headerPatch.words);
          const parsed = parseStatement([sparse]);
          if (parsed.supportedPages && parsed.transactions.length >= initial.transactions.length) items = sparse;
        }
        checkAbort(signal);
        return items;
      } finally { canvas.width = 0; canvas.height = 0; canvas.originalPixels = null; }
    },
    async close() { signal?.removeEventListener('abort', abort); await worker.terminate(); },
  };
}
