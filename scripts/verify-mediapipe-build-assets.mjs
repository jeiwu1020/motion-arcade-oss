import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = new URL('..', import.meta.url)
const distDirectory = fileURLToPath(new URL('./dist/', repositoryRoot))
const requiredAssets = [
  'vendor/mediapipe/wasm/vision_wasm_internal.js',
  'vendor/mediapipe/wasm/vision_wasm_internal.wasm',
  'vendor/mediapipe/wasm/vision_wasm_nosimd_internal.js',
  'vendor/mediapipe/wasm/vision_wasm_nosimd_internal.wasm',
  'vendor/mediapipe/wasm/vision_wasm_module_internal.js',
  'vendor/mediapipe/wasm/vision_wasm_module_internal.wasm',
  'vendor/mediapipe/models/pose_landmarker_lite.task',
]

const missing = []
for (const relativePath of requiredAssets) {
  try {
    const asset = await stat(join(distDirectory, relativePath))
    if (!asset.isFile() || asset.size <= 0) missing.push(relativePath)
  } catch {
    missing.push(relativePath)
  }
}

if (missing.length > 0) {
  throw new Error(
    `Production build is missing required MediaPipe assets: ${missing.join(', ')}`,
  )
}

console.log(`Verified ${requiredAssets.length} MediaPipe assets in dist/.`)
