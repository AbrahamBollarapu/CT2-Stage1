import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite dev proxy: forwards /api/* from :5173 -> :8081 (Traefik)
// This avoids CORS during local development.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8081',
        changeOrigin: true,
      },
    },
  },
});
