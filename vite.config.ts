import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' lets the built app be hosted from any sub-folder
// (the template is fetched relative to import.meta.env.BASE_URL).
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Emit the pdf.js worker as .js — some static hosts serve .mjs with a
        // wrong MIME type, which would break module workers.
        assetFileNames: (info) =>
          info.names?.[0]?.endsWith('.mjs') || info.name?.endsWith('.mjs')
            ? 'assets/[name]-[hash].js'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
});
