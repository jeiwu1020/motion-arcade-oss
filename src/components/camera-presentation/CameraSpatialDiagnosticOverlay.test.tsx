import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { SpatialHandSnapshot } from '../../motion/contracts/spatial'
import { CameraSpatialDiagnosticOverlay } from './CameraSpatialDiagnosticOverlay'

const SPATIAL_SNAPSHOT: SpatialHandSnapshot = Object.freeze({
  timestampMs: 100,
  sequence: 1,
  leftHand: Object.freeze({
    availability: 'AVAILABLE' as const,
    x: 0.25,
    y: 0.75,
    confidence: 0.9,
    timestampMs: 100,
    sequence: 1,
  }),
  rightHand: Object.freeze({
    availability: 'UNAVAILABLE' as const,
    timestampMs: 100,
    sequence: 1,
  }),
})

describe('CameraSpatialDiagnosticOverlay', () => {
  it('renders only available anatomical hands at their mirrored camera-stage positions', () => {
    const markup = renderToStaticMarkup(
      <CameraSpatialDiagnosticOverlay
        snapshot={SPATIAL_SNAPSHOT}
        sourceDimensions={{ width: 1920, height: 1080 }}
        stageDimensions={{ width: 960, height: 540 }}
      />,
    )

    expect(markup).toContain('data-spatial-hand="LEFT"')
    expect(markup).toContain('>左手</span>')
    expect(markup).toContain('left:720px')
    expect(markup).toContain('top:405px')
    expect(markup).not.toContain('data-spatial-hand="RIGHT"')
    expect(markup).not.toContain('>右手</span>')
    expect(SPATIAL_SNAPSHOT.leftHand).toMatchObject({ x: 0.25, y: 0.75 })
  })

  it('renders no diagnostic marker until source and stage dimensions are known', () => {
    const markup = renderToStaticMarkup(
      <CameraSpatialDiagnosticOverlay
        snapshot={SPATIAL_SNAPSHOT}
        sourceDimensions={null}
        stageDimensions={{ width: 960, height: 540 }}
      />,
    )

    expect(markup).not.toContain('data-spatial-hand=')
  })
})
