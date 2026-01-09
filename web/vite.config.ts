import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../src/shared'),
    },
  },
  build: {
    outDir: '../dist/agent/web',
    emptyOutDir: true,
  },
  server: {
    allowedHosts: true,
    proxy: {
      '/rpc': {
        target: 'http://localhost:3111',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
