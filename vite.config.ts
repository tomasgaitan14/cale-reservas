import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { validateBuildEnvironment } from './scripts/build-environment.ts'

// La app vive en app/; las variables VITE_* se leen del .env.local de la raíz del repo
export default defineConfig(({ command, mode }) => {
  if (command === 'build') validateBuildEnvironment(loadEnv(mode, process.cwd(), 'VITE_'))
  return {
    root: 'app',
    envDir: '..',
    plugins: [react(), tailwindcss()],
    build: { outDir: '../dist', emptyOutDir: true },
    server: { host: '127.0.0.1', port: 5174, strictPort: true },
    preview: { host: '127.0.0.1', port: 5174, strictPort: true },
  }
})
