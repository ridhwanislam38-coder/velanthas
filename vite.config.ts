import { defineConfig } from 'vite';

export default defineConfig({
  base: '/',
  build: {
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser'],
          howler: ['howler'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
