import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@xron': resolve(__dirname, '../src'),
      'tiktoken': resolve(__dirname, 'src/stubs/tiktoken.ts')
    }
  },
  build: {
    outDir: '../docs',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'tokenizer': ['gpt-tokenizer'],
          'yaml': ['js-yaml'],
        }
      }
    }
  }
})
