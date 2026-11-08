import { defineConfig } from 'vite';

export default defineConfig({
  // The prebuilt demo also works when served under /dist/ or another subpath.
  base: './',
  optimizeDeps: {
    // Prepare the lazy-loaded PDF reader at startup. Discovering it on the first
    // upload can otherwise make Vite reload the page and discard the selected file.
    include: ['pdfjs-dist/legacy/build/pdf.mjs', 'tesseract.js'],
  },
});
