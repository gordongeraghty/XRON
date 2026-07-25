import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      'tiktoken': resolve(__dirname, 'src/stubs/tiktoken.ts')
    }
  },
  build: {
    outDir: 'dist'
  }
})
