import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Build dans /dist pour Capacitor
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Optimisation mobile
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          three: ['three'],
        },
      },
    },
  },
  // Dev server
  server: {
    port: 3000,
    host: true,
  },
  // Base URL pour Capacitor (important)
  base: './',
});