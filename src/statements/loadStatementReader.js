const imports = [
  () => import('./readPdf.js'),
  // A different module URL bypasses the browser's cached failed import. Keep this
  // literal so Vite can build both entry points for the offline demo too.
  () => import('./readPdf.js?retry'),
];

function abortIfNeeded(signal) {
  if (signal?.aborted) throw new DOMException('Reading cancelled.', 'AbortError');
}

// Retry module loading only. Parsing and OCR errors must never restart a read.
// The optional import functions let tests simulate network failure without a server.
export async function loadStatementReader({ signal, onRetry = () => {} } = {}, loaders = imports) {
  abortIfNeeded(signal);
  let reader;
  try {
    reader = await loaders[0]();
  } catch {
    abortIfNeeded(signal);
    onRetry();
    try {
      reader = await loaders[1]();
    } catch (cause) {
      abortIfNeeded(signal);
      throw new Error('The statement reader could not load. Refresh the page and choose your file again. If you are running locally, stop the dev server, run npm run dev again, then refresh.', { cause });
    }
  }
  abortIfNeeded(signal);
  return reader;
}
