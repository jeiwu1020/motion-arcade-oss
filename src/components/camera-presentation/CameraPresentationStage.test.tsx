import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { SpatialHandSnapshot } from '../../motion/contracts/spatial'
import { CameraPresentationStage } from './CameraPresentationStage'
import { resolveCameraPresentation } from './cameraPresentationModel'

const SPATIAL_SNAPSHOT: SpatialHandSnapshot = Object.freeze({
  timestampMs: 100,
  sequence: 1,
  leftHand: Object.freeze({
    availability: 'UNAVAILABLE' as const,
    timestampMs: 100,
    sequence: 1,
  }),
  rightHand: Object.freeze({
    availability: 'UNAVAILABLE' as const,
    timestampMs: 100,
    sequence: 1,
  }),
})

describe('CameraPresentationStage', () => {
  it('renders one display-only mirrored video beneath treatment and playfield layers', () => {
    const markup = renderToStaticMarkup(
      <CameraPresentationStage
        presentation={resolveCameraPresentation(
          { status: 'READY', error: null },
          'PLAYING',
        )}
        videoRef={createRef<HTMLVideoElement>()}
        onStartCamera={() => undefined}
      >
        <div>GAME PLAYFIELD</div>
      </CameraPresentationStage>,
    )

    expect(markup.match(/<video/g)).toHaveLength(1)
    expect(markup).toContain('data-mirror-mode="display-only"')
    expect(markup).toContain('data-camera-treatment="SUBDUED"')
    expect(markup).toContain('autoPlay=""')
    expect(markup).toContain('playsInline=""')
    expect(markup).not.toContain('src=')
    expect(markup.indexOf('<video')).toBeLessThan(
      markup.indexOf('camera-presentation-treatment'),
    )
    expect(markup.indexOf('camera-presentation-treatment')).toBeLessThan(
      markup.indexOf('GAME PLAYFIELD'),
    )
  })

  it('makes the full-body framing guide and recovery message dominant when tracking is lost', () => {
    const markup = renderToStaticMarkup(
      <CameraPresentationStage
        presentation={resolveCameraPresentation(
          { status: 'TRACKING_LOST', error: null },
          'PLAYING',
        )}
        videoRef={createRef<HTMLVideoElement>()}
        onStartCamera={() => undefined}
      >
        <div>GAME PLAYFIELD</div>
      </CameraPresentationStage>,
    )

    expect(markup).toContain('data-presentation-mode="TRACKING_LOST"')
    expect(markup).toContain('data-framing-guide="PROMINENT"')
    expect(markup).toContain('請回到畫面中')
    expect(markup).toContain('頭頂到腳尖')
  })

  it('keeps explicit start and retry as large presentation actions', () => {
    const initialMarkup = renderToStaticMarkup(
      <CameraPresentationStage
        presentation={resolveCameraPresentation(
          { status: 'CAMERA_NOT_STARTED', error: null },
          'COUNTDOWN',
        )}
        videoRef={createRef<HTMLVideoElement>()}
        onStartCamera={() => undefined}
      >
        <div />
      </CameraPresentationStage>,
    )
    const errorMarkup = renderToStaticMarkup(
      <CameraPresentationStage
        presentation={resolveCameraPresentation(
          {
            status: 'ERROR',
            error: { code: 'NO_CAMERA', message: '找不到可使用的相機。' },
          },
          'COUNTDOWN',
        )}
        videoRef={createRef<HTMLVideoElement>()}
        onStartCamera={() => undefined}
      >
        <div />
      </CameraPresentationStage>,
    )

    expect(initialMarkup).toContain('>啟動相機</button>')
    expect(errorMarkup).toContain('>重新啟動相機</button>')
    expect(errorMarkup).toContain('role="alert"')
  })

  it('adds an engineering spatial diagnostic layer only when the live spatial snapshot is supplied', () => {
    const markup = renderToStaticMarkup(
      <CameraPresentationStage
        presentation={resolveCameraPresentation(
          { status: 'READY', error: null },
          'PLAYING',
        )}
        videoRef={createRef<HTMLVideoElement>()}
        onStartCamera={() => undefined}
        spatialSnapshot={SPATIAL_SNAPSHOT}
        showSpatialDiagnostic
      >
        <div>GAME PLAYFIELD</div>
      </CameraPresentationStage>,
    )

    expect(markup).toContain('data-spatial-diagnostic="engineering"')
    expect(markup.match(/<video/g)).toHaveLength(1)
    expect(markup.indexOf('camera-presentation-playfield')).toBeLessThan(
      markup.indexOf('camera-presentation-spatial-diagnostic'),
    )
  })

  it('keeps the engineering spatial diagnostic out of normal presentation unless explicitly enabled', () => {
    const markup = renderToStaticMarkup(
      <CameraPresentationStage
        presentation={resolveCameraPresentation(
          { status: 'READY', error: null },
          'PLAYING',
        )}
        videoRef={createRef<HTMLVideoElement>()}
        onStartCamera={() => undefined}
        spatialSnapshot={SPATIAL_SNAPSHOT}
      >
        <div>GAME PLAYFIELD</div>
      </CameraPresentationStage>,
    )

    expect(markup).not.toContain('data-spatial-diagnostic="engineering"')
  })

  it('renders a broad upper-body alignment silhouette with presentation-only guidance copy', () => {
    const markup = renderToStaticMarkup(
      <CameraPresentationStage
        presentation={resolveCameraPresentation(
          { status: 'BASELINING', error: null },
          'COUNTDOWN',
          'UPPER_BODY',
        )}
        videoRef={createRef<HTMLVideoElement>()}
        onStartCamera={() => undefined}
      >
        <div />
      </CameraPresentationStage>,
    )

    expect(markup).toContain('data-framing-requirement="UPPER_BODY"')
    expect(markup).toContain('camera-presentation-silhouette-head')
    expect(markup).toContain('camera-presentation-silhouette-body')
    expect(markup).toContain('camera-presentation-silhouette-hand')
    expect(markup).toContain('請對準人形範圍')
    expect(markup).not.toContain('M120 98 L120 286')
  })

  it('renders the full-body silhouette variant and hides the guide during normal play', () => {
    const fullMarkup = renderToStaticMarkup(
      <CameraPresentationStage
        presentation={resolveCameraPresentation(
          { status: 'BASELINING', error: null },
          'COUNTDOWN',
          'FULL_BODY',
        )}
        videoRef={createRef<HTMLVideoElement>()}
        onStartCamera={() => undefined}
      >
        <div />
      </CameraPresentationStage>,
    )
    const playingMarkup = renderToStaticMarkup(
      <CameraPresentationStage
        presentation={resolveCameraPresentation(
          { status: 'READY', error: null },
          'PLAYING',
          'FULL_BODY',
        )}
        videoRef={createRef<HTMLVideoElement>()}
        onStartCamera={() => undefined}
      >
        <div />
      </CameraPresentationStage>,
    )

    expect(fullMarkup).toContain('data-framing-requirement="FULL_BODY"')
    expect(fullMarkup).toContain('camera-presentation-silhouette-legs')
    expect(fullMarkup).toContain('請將全身移到人形範圍內')
    expect(playingMarkup).toContain('data-framing-guide="SUBTLE"')
  })
})
