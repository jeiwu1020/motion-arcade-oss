import { readFile } from 'node:fs/promises'

import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const MEDIAPIPE_WASM_LOADER_FILES = new Set([
  'vision_wasm_internal.js',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_module_internal.js',
])

export function resolveMediaPipeWasmLoaderFilename(
  requestUrl: string | undefined,
): string | null {
  if (!requestUrl) return null
  const match = requestUrl.match(
    /^\/vendor\/mediapipe\/wasm\/([^/?]+\.js)(?:\?.*)?$/,
  )
  const fileName = match?.[1]
  return fileName && MEDIAPIPE_WASM_LOADER_FILES.has(fileName)
    ? fileName
    : null
}

function serveMediaPipeWasmLoadersInDevelopment(): Plugin {
  return {
    name: 'serve-mediapipe-wasm-loaders-in-development',
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const fileName = resolveMediaPipeWasmLoaderFilename(request.url)
        if (!fileName) {
          next()
          return
        }

        try {
          const loader = await readFile(
            new URL(
              `./public/vendor/mediapipe/wasm/${fileName}`,
              import.meta.url,
            ),
          )
          response.statusCode = 200
          response.setHeader('Content-Type', 'application/javascript')
          response.end(loader)
        } catch (error) {
          next(error)
        }
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [serveMediaPipeWasmLoadersInDevelopment(), react()],
})
