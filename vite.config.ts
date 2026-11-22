import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    allowedHosts: true,
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Always ignore docs/, public/docs/, and runtime stored_*.json files so report/cache/log saves NEVER trigger a browser full-reload.
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true'
      ? null
      : {
          ignored: [
            /[/\\]docs([/\\]|$)/,
            /[/\\]public[/\\]docs([/\\]|$)/,
            /stored_(prompt_logs|persons|ad_narratives|pd_evaluations)\.json$/
          ]
        },
  },
});
