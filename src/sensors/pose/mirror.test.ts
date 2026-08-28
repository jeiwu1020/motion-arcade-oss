import { describe, expect, it } from 'vitest'

import { MIRRORED_PREVIEW_TRANSFORM, toRawOverlayPoint } from './mirror'
import type { PoseLandmark } from './poseTypes'

describe('pose preview mirroring invariant', () => {
  it('mirrors at presentation level without changing raw landmark x', () => {
    const landmark: PoseLandmark = {
      x: 0.2,
      y: 0.4,
      z: -0.1,
      visibility: 0.9,
    }
    const before = structuredClone(landmark)

    expect(MIRRORED_PREVIEW_TRANSFORM).toBe('scaleX(-1)')
    expect(toRawOverlayPoint(landmark, 1_000, 500)).toEqual({ x: 200, y: 200 })
    expect(landmark).toEqual(before)
  })
})
