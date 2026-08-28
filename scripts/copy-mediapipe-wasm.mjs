import { copyFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const packageWasmDirectory = join(
  repositoryRoot,
  'node_modules',
  '@mediapipe',
  'tasks-vision',
  'wasm',
)
const publicWasmDirectory = join(
  repositoryRoot,
  'public',
  'vendor',
  'mediapipe',
  'wasm',
)
const wasmFiles = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
  'vision_wasm_module_internal.js',
  'vision_wasm_module_internal.wasm',
]

await mkdir(publicWasmDirectory, { recursive: true })
await Promise.all(
  wasmFiles.map((fileName) =>
    copyFile(
      join(packageWasmDirectory, fileName),
      join(publicWasmDirectory, fileName),
    ),
  ),
)

console.log(
  `Copied ${wasmFiles.length} MediaPipe 1.0.1 WASM runtime files to public/vendor/mediapipe/wasm.`,
)
