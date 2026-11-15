/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Deixa o vitest ler supabase/functions (fora de app/).
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    // Helpers puros das Edge Functions (Deno) também rodam aqui.
    include: ['src/**/*.test.{ts,tsx}', '../supabase/functions/**/*.test.ts'],
    globals: true,
    // Valores falsos só pra montar o client nos testes; nenhum teste fala com a rede.
    env: { VITE_SUPABASE_URL: 'http://localhost:54321', VITE_SUPABASE_ANON_KEY: 'test-anon-key' },
  },
})
