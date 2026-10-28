import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// /api/* is proxied to the local "api without reanime" server; /api/u/* to the deployed Worker.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: {
    port: 5173,
    proxy: {
      // Accounts/community API + watch-party WebSockets live in the deployed Worker.
      '/api/u': {
        target: process.env.SOCIAL_URL || 'https://animegng.drop-share-free.workers.dev',
        changeOrigin: true,
        ws: true,
      },
      '/api': {
        target: process.env.API_URL || 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
})
