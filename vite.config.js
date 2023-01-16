import { resolve } from 'path'
import { defineConfig } from "vite"

const root = resolve(__dirname, './')
const outDir = resolve(__dirname, 'dist')

export default defineConfig({
    assetsInclude: ['**/*.gltf'],
    build: {
    chunkSizeWarningLimit: 600,
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        pinit: resolve(root, 'pinit.html'),
        privacy: resolve(root, 'privacy.html'),
        support: resolve(root, 'support.html'),
        wristgpt_privacy: resolve(root, 'wristgpt-privacy.html'),
        wristgpt_support: resolve(root, 'wristgpt-support.html'),
      }
    }
  }
})
