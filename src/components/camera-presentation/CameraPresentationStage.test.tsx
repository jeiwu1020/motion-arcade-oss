import { createRef } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { SpatialHandSnapshot } from '../../motion/contracts/spatial'
import type { PoseTrackingSnapshot } from '../../motion/contracts/poseTracking'
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

const POSE_TRACKING_SNAPSHOT: PoseTrackingSnapshot = Object.freeze({
  timestampMs: 100,
  sequence: 1,
  posePresent: true,
  joints: Object.freeze({
    leftShoulder: { x: 0.6, y: 0.3, confidence: 0.9, valid: true },
    rightShoulder: { x: 0.4, y: 0.3, confidence: 0.9, valid: true },
    leftElbow: { x: 0.65, y: 0.4, confidence: 0.9, valid: true },
    rightElbow: { x: 0.35, y: 0.4, confidence: 0.9, valid: true },
    leftWrist: { x: 0.8, y: 0.5, confidence: 0.9, valid: true },
    rightWrist: { x: 0.2, y: 0.5, confidence: 0.9, valid: true },
    leftHip: { x: 0.55, y: 0.55, confidence: 0.9, valid: true },
    rightHip: { x: 0.45, y: 0.55, confidence: 0.9, valid: true },
    leftKnee: { x: 0.55, y: 0.7, confidence: 0.9, valid: true },
    rightKnee: { x: 0.45, y: 0.7, confidence: 0.9, valid: true },
    leftAnkle: { x: 0.55, y: 0.9, confidence: 0.9, valid: true },
    rightAnkle: { x: 0.45, y: 0.9, confidence: 0.9, valid: true },
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

  it('adds sanitized Pose tracking feedback only when the caller enables it', () => {
    const markup = renderToStaticMarkup(
      <CameraPresentationStage
        presentation={resolveCameraPresentation(
          { status: 'BASELINING', error: null },
          'COUNTDOWN',
        )}
        videoRef={createRef<HTMLVideoElement>()}
        onStartCamera={() => undefined}
        poseTrackingSnapshot={POSE_TRACKING_SNAPSHOT}
        showPoseTrackingOverlay
      >
        <div>GAME PLAYFIELD</div>
      </CameraPresentationStage>,
    )

    expect(markup).toContain('data-pose-tracking-overlay="visible"')
    expect(markup).not.toContain('data-spatial-diagnostic="engineering"')
  })

  it('allows a FULL_BODY game to supply compact-space setup copy without changing framing semantics', () => {
    const markup = renderToStaticMarkup(
      <CameraPresentationStage
        presentation={resolveCameraPresentation(
          { status: 'BASELINING', error: null },
          'COUNTDOWN',
          'FULL_BODY',
        )}
        videoRef={createRef<HTMLVideoElement>()}
        onStartCamera={() => undefined}
        framingInstruction="請讓頭、肩、髖部與雙膝清楚入鏡，腳踝可暫時離開畫面"
      >
        <div />
      </CameraPresentationStage>,
    )

    expect(markup).toContain('data-framing-requirement="FULL_BODY"')
    expect(markup).toContain('腳踝可暫時離開畫面')
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
    expect(markup).toContain('viewBox="0 0 500 500"')
    expect(markup).toContain('data-silhouette="UPPER_BODY_RAISED_W"')
    expect(markup).toContain('data-silhouette-fill="GUIDANCE"')
    expect(markup).toContain('camera-presentation-silhouette-head')
    expect(markup).toContain('camera-presentation-silhouette-body')
    expect(markup).toContain('camera-presentation-silhouette-hand')
    expect(markup).toContain('請將上半身移到人形範圍內')
    expect(markup).toContain('data-silhouette-part="upper-left-arm"')
    expect(markup).toContain('data-silhouette-part="upper-right-arm"')
    expect(markup).toContain('data-silhouette-part="left-hand"')
    expect(markup).toContain('data-silhouette-part="right-hand"')
    expect(markup).toContain('data-silhouette-part="upper-torso"')

    const confirmedMarkup = renderToStaticMarkup(
      <CameraPresentationStage
        presentation={resolveCameraPresentation(
          { status: 'READY', error: null },
          'COUNTDOWN',
          'UPPER_BODY',
        )}
        videoRef={createRef<HTMLVideoElement>()}
        onStartCamera={() => undefined}
      >
        <div />
      </CameraPresentationStage>,
    )
    expect(confirmedMarkup).toContain('data-silhouette-fill="CONFIRMED"')
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
    expect(fullMarkup).toContain('viewBox="0 0 240 500"')
    expect(fullMarkup).toContain('camera-presentation-silhouette-legs')
    expect(fullMarkup).toContain('請將全身移到人形範圍內')
    expect(playingMarkup).toContain('data-framing-guide="SUBTLE"')
  })
})
