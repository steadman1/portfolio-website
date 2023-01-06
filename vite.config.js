import { resolve } from 'path'
import { defineConfig } from "vite"

const root = resolve(__dirname, './')
const outDir = resolve(__dirname, 'dist')

export default defineConfig({
    assetsInclude: ['**/*.gltf'],
    build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        about: resolve(root, 'about', 'index.html'),
      }
    }
    chunkSizeWarningLimit: 600
  }
})
