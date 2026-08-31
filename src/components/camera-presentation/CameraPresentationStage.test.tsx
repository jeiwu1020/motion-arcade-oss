import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { CameraPresentationStage } from './CameraPresentationStage'
import { resolveCameraPresentation } from './cameraPresentationModel'

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
})
