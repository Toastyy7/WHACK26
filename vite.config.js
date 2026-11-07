import { defineConfig } from 'vite';

export default defineConfig({
  optimizeDeps: {
    // Prepare the lazy-loaded PDF reader at startup. Discovering it on the first
    // upload can otherwise make Vite reload the page and discard the selected file.
    include: ['pdfjs-dist/legacy/build/pdf.mjs'],
  },
});
