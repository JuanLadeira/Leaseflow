/// <reference types="vitest/config" />
import babel from '@rolldown/plugin-babel'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // React Compiler: automatic memoization at build time, so components don't
    // need hand-written useMemo/useCallback/React.memo for referential stability.
    babel({ presets: [reactCompilerPreset()] }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      // Dev: the browser talks to Vite, Vite forwards /api to Django (no CORS needed).
      '/api': process.env.VITE_PROXY_TARGET ?? 'http://localhost:8000',
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Keep vendor code in a stable, long-cacheable chunk.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (/react-router|react-dom|[\\/]react[\\/]|scheduler/.test(id)) return 'react'
            if (/@reduxjs|react-redux|immer|reselect/.test(id)) return 'redux'
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    env: { VITE_API_URL: 'http://localhost/api' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/test/**', 'src/main.tsx', 'src/**/*.d.ts'],
    },
  },
})
