import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    hmr: { overlay: true },
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: true } }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        }
      }
    }
  },
  esbuild: { logOverride: { 'this-is-undefined-in-esm': 'silent' } },
  optimizeDeps: { include: ['react', 'react-dom', 'react-router-dom', 'axios', 'lucide-react', 'recharts'] }
})
