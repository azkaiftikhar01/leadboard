import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // relative base so the same build loads from file:// inside Electron
  base: './',
  server: { port: 5180, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
})
