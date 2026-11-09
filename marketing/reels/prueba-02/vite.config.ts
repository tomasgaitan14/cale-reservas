import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../../', import.meta.url))
export default defineConfig({
  root,
  publicDir: `${root}app/public`,
  plugins: [react(), tailwindcss()],
  resolve: { alias: [
    { find: /^.*\/lib\/booking-api\.ts$/, replacement: `${root}marketing/reels/prueba-02/booking-fixture.ts` },
    { find: /^.*\/lib\/branding-api\.ts$/, replacement: `${root}marketing/reels/prueba-02/logo-fixture.ts` },
  ] },
  server: { host: '127.0.0.1', port: 5186, strictPort: true },
})
