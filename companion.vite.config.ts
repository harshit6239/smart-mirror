import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  root: resolve('src/companion'),
  build: {
    outDir: resolve('out/companion'),
    emptyOutDir: true
  },
  plugins: [react(), tailwindcss()]
})
