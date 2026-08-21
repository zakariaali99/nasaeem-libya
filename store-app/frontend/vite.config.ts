import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: {
      port: 5183,
      strictPort: true,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://127.0.0.1:8010',
          changeOrigin: true,
        },
        '/media': {
          target: env.VITE_API_URL || 'http://127.0.0.1:8010',
          changeOrigin: true,
        },
      },
    },
    // `vite preview` serves the production build so the JS budget can be
    // measured against real, minified, chunked output rather than dev modules.
    // It is a build-time tool like `vite build` itself — nothing Node serves
    // traffic in production; nginx does (see deploy/nginx.conf).
    preview: {
      port: 5184,
      strictPort: true,
      proxy: {
        '/api': { target: env.VITE_API_URL || 'http://127.0.0.1:8010', changeOrigin: true },
        '/media': { target: env.VITE_API_URL || 'http://127.0.0.1:8010', changeOrigin: true },
      },
    },
    build: {
      // Code-splitting is mandatory, not an optimisation: the admin section is
      // 26 of 44 routes and a customer must never download it.
      rollupOptions: {
        output: {
          // Object-form manualChunks matches package entry points only, so
          // `react-dom/client` — the module main.tsx actually imports — fell
          // through into the entry chunk and inflated it to 228 kB. Matching on
          // the resolved path catches every deep import.
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined
            if (/node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id))
              return 'react'
            if (id.includes('@tanstack')) return 'query'
            if (id.includes('react-hook-form') || id.includes('@hookform') || id.includes('zod'))
              return 'forms'
            if (id.includes('@radix-ui')) return 'radix'
            if (id.includes('lucide-react')) return 'icons'
            return 'vendor'
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test-setup.ts'],
    },
  }
})
