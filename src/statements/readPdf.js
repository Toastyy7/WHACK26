import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { parseStatement } from './parseStatement.js';

GlobalWorkerOptions.workerSrc = workerUrl;
const abortIfNeeded = (signal) => {
  if (signal?.aborted) throw new DOMException('Reading cancelled.', 'AbortError');
};

// Prefer a PDF's real text. OCR is used for images and pages without a readable table.
export async function readStatement(file, { signal, onProgress = () => {} } = {}) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a file smaller than 20 MB.');
  const isPdf = /\.pdf$/i.test(file.name);
  if (!isPdf && !/\.(png|jpe?g)$/i.test(file.name)) throw new Error('Choose a PDF, JPG or PNG statement.');
  let task, ocr;
  let ocrPages = 0;
  const pages = [];
  async function readImage(image) {
    abortIfNeeded(signal);
    if (!ocr) {
      const { createOcrReader } = await import('./ocr.js');
      ocr = await createOcrReader({ signal, onProgress });
    }
    ocrPages += 1;
    return ocr.read(image);
  }
  const abortTask = () => { task?.destroy(); };
  signal?.addEventListener('abort', abortTask, { once: true });
  try {
    abortIfNeeded(signal);
    if (!isPdf) {
      const bitmap = await createImageBitmap(file);
      try { pages.push(await readImage(bitmap)); } finally { bitmap.close(); }
    } else {
      task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
      const pdf = await task.promise;
      if (pdf.numPages > 100) throw new Error('Use a statement with 100 pages or fewer.');
      for (let number = 1; number <= pdf.numPages; number += 1) {
        abortIfNeeded(signal);
        onProgress(`Reading page ${number} of ${pdf.numPages}…`);
        const page = await pdf.getPage(number);
        const text = await page.getTextContent();
        let items = text.items.filter((item) => typeof item.str === 'string').map((item) => ({
          text: item.str, x: item.transform[4], y: item.transform[5], width: item.width,
        }));
        const hasTable = parseStatement([items]).supportedPages > 0;
        if (!hasTable && items.map((item) => item.text).join(' ').trim().length < 80) {
          // Limit slow OCR to 15 pages per upload; text-only PDFs still support 100.
          if (ocrPages >= 15) throw new Error('This scanned PDF is too long. Split it into files with at most 15 scanned pages.');
          const viewport = page.getViewport({ scale: 1 });
          const rendered = page.getViewport({ scale: Math.min(2000 / viewport.width, 8000 / viewport.height) });
          const canvas = document.createElement('canvas');
          canvas.width = Math.ceil(rendered.width); canvas.height = Math.ceil(rendered.height);
          try {
            await page.render({ canvasContext: canvas.getContext('2d'), viewport: rendered }).promise;
            const scanned = await readImage(canvas);
            // Non-transaction terms pages must not replace usable text/date metadata.
            if (parseStatement([scanned]).supportedPages || !items.length) items = scanned;
          } finally { canvas.width = 0; canvas.height = 0; }
        }
        pages.push(items);
        page.cleanup();
      }
    }
    abortIfNeeded(signal);
    const result = parseStatement(pages);
    if (!result.transactions.length && !(result.supportedPages && result.unresolved)) throw new Error('No readable outgoing rows were found. Try a sharper image or a text PDF with visible Date, In and Out columns. No transactions have been imported.');
    return { ...result, ocrPages };
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Reading cancelled.', 'AbortError');
    if (error.name === 'PasswordException') throw new Error('This PDF is password-protected. Upload an unlocked copy.');
    if (error.name === 'InvalidPDFException') throw new Error('This file could not be read as a PDF.');
    throw error;
  } finally {
    signal?.removeEventListener('abort', abortTask);
    await ocr?.close();
    await task?.destroy();
  }
}
