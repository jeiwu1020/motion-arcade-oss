import { describe, expect, it } from 'vitest'

import { resolveMediaPipeWasmLoaderFilename } from './vite.config'

describe('MediaPipe WASM development loader routing', () => {
  it('allows only the generated MediaPipe loader modules Vite must serve directly', () => {
    expect(
      resolveMediaPipeWasmLoaderFilename(
        '/vendor/mediapipe/wasm/vision_wasm_internal.js?import',
      ),
    ).toBe('vision_wasm_internal.js')
    expect(
      resolveMediaPipeWasmLoaderFilename(
        '/vendor/mediapipe/wasm/vision_wasm_module_internal.js?import',
      ),
    ).toBe('vision_wasm_module_internal.js')
    expect(resolveMediaPipeWasmLoaderFilename('/src/main.tsx')).toBeNull()
    expect(
      resolveMediaPipeWasmLoaderFilename(
        '/vendor/mediapipe/wasm/../../package.json?import',
      ),
    ).toBeNull()
  })
})
