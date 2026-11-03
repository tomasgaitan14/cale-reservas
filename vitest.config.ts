import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    // Los tests de base de datos pasan por el stack local de Supabase (Docker): el primer pedido puede tardar
    testTimeout: 20_000,
  },
})
