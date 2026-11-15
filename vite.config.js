import { resolve } from 'path'
import { defineConfig } from "vite"

const root = resolve(__dirname, './')
const outDir = resolve(__dirname, 'dist')

export default defineConfig({
    assetsInclude: ['**/*.gltf'],
    plugins: [
      {
        // The original site (public/original, see scripts/build-original.sh):
        // let the dev server open it at /original like the live site does.
        name: 'original-site-index',
        configureServer(server) {
          server.middlewares.use((req, _res, next) => {
            if (req.url === '/original' || req.url === '/original/') req.url = '/original/index.html'
            next()
          })
        },
      },
    ],
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
        watchai_privacy: resolve(root, 'watchai-privacy.html'),
        watchai_support: resolve(root, 'watchai-support.html'),
        watchai_eula: resolve(root, 'watchai-eula.html'),
        liminal_browser_privacy: resolve(root, 'liminal-browser-privacy.html'),
        liminal_browser_support: resolve(root, 'liminal-browser-support.html'),
        liminal_browser_eula: resolve(root, 'liminal-browser-eula.html'),
      }
    }
  }
})
