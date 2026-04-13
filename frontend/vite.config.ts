import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const foundryApiTarget = process.env.VITE_FOUNDRY_API_PROXY_TARGET ?? 'http://localhost:4000'
const foundryGraphqlTarget = process.env.VITE_FOUNDRY_GRAPHQL_PROXY_TARGET ?? foundryApiTarget

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') || id.includes('node_modules/react-router')) {
            return 'react-vendor'
          }
          if (id.includes('node_modules/@tanstack/react-query')) {
            return 'query-vendor'
          }
          if (id.includes('node_modules/recharts')) {
            return 'chart-vendor'
          }
          if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
            return 'map-vendor'
          }
          if (id.includes('node_modules/framer-motion')) {
            return 'motion-vendor'
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false,
  },
  server: {
    proxy: {
      '/graphql': {
        target: foundryGraphqlTarget,
        changeOrigin: true,
      },
      '/api': {
        target: foundryApiTarget,
        changeOrigin: true,
      },
      '/agents': {
        target: 'http://localhost:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/agents/, ''),
      },
    },
  },
})
