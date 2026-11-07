import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url';
import { parseStatement } from './parseStatement.js';

// The compatibility build includes polyfills for older browsers.
// Vite bundles the worker locally; no statement data is sent to a remote service.
GlobalWorkerOptions.workerSrc = workerUrl;

export async function readStatement(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose a PDF smaller than 20 MB.');
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > 100) throw new Error('Please use a statement with 100 pages or fewer.');
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const text = await page.getTextContent();
      pages.push(text.items.filter((item) => typeof item.str === 'string').map((item) => ({
        text: item.str, x: item.transform[4], y: item.transform[5], width: item.width,
      })));
      page.cleanup();
    }
    const result = parseStatement(pages);
    if (!result.transactions.length) {
      throw new Error('No outgoing transactions could be read. Use a text-based PDF with separate Paid out / Paid in or Debit / Credit columns. Scanned images and other layouts are not supported yet.');
    }
    return result;
  } catch (error) {
    if (error.name === 'PasswordException') throw new Error('This PDF is password-protected. Please upload an unlocked copy.');
    if (error.name === 'InvalidPDFException') throw new Error('This file could not be read as a PDF. Please choose a valid bank statement.');
    throw error;
  } finally {
    await task.destroy();
  }
}
