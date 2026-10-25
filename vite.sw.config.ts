import { defineConfig } from 'vite';

// The service worker as one classic script at /sw.js, built after the main build into the same output folder
// (npm run build). It is separate on purpose: a worker cannot share chunks with the page.
export default defineConfig({
  build: {
    outDir: 'dist/client',
    emptyOutDir: false,
    sourcemap: false,
    target: 'es2022',
    rollupOptions: {
      input: 'web/sw/sw.ts',
      output: { entryFileNames: 'sw.js', format: 'iife', inlineDynamicImports: true },
    },
  },
});