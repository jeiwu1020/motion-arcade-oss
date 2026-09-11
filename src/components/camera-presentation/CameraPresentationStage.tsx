import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'

import type { SpatialHandSnapshot } from '../../motion/contracts/spatial'
import { CameraSpatialDiagnosticOverlay } from './CameraSpatialDiagnosticOverlay'
import type { CameraPresentation } from './cameraPresentationModel'
import type {
  CameraPresentationDimensions,
  CameraPresentationSpatialLayout,
} from './spatialDisplayMapping'
import './CameraPresentationStage.css'

export interface CameraPresentationStageProps {
  readonly presentation: CameraPresentation
  readonly videoRef: RefObject<HTMLVideoElement | null>
  readonly onStartCamera: () => void
  readonly children: ReactNode
  readonly foreground?: ReactNode
  readonly className?: string
  readonly spatialSnapshot?: SpatialHandSnapshot
  readonly showSpatialDiagnostic?: boolean
  readonly onSpatialLayoutChange?: (
    layout: CameraPresentationSpatialLayout,
  ) => void
}

const EMPTY_DIMENSIONS: CameraPresentationDimensions = Object.freeze({
  width: 0,
  height: 0,
})

function dimensionsMatch(
  first: CameraPresentationDimensions,
  second: CameraPresentationDimensions,
): boolean {
  return first.width === second.width && first.height === second.height
}

function useCameraPresentationDimensions(
  stageRef: RefObject<HTMLElement | null>,
  videoRef: RefObject<HTMLVideoElement | null>,
): {
  readonly stageDimensions: CameraPresentationDimensions
  readonly sourceDimensions: CameraPresentationDimensions
} {
  const [stageDimensions, setStageDimensions] =
    useState<CameraPresentationDimensions>(EMPTY_DIMENSIONS)
  const [sourceDimensions, setSourceDimensions] =
    useState<CameraPresentationDimensions>(EMPTY_DIMENSIONS)

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined

    const updateStageDimensions = () => {
      const nextDimensions = {
        // Absolutely positioned stage layers resolve against this content box,
        // not the outer border box of a game-specific stage shell.
        width: stage.clientWidth,
        height: stage.clientHeight,
      }
      setStageDimensions((currentDimensions) =>
        dimensionsMatch(currentDimensions, nextDimensions)
          ? currentDimensions
          : nextDimensions,
      )
    }

    updateStageDimensions()
    if (typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver(updateStageDimensions)
    observer.observe(stage)
    return () => observer.disconnect()
  }, [stageRef])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined

    const updateSourceDimensions = () => {
      const nextDimensions = {
        width: video.videoWidth,
        height: video.videoHeight,
      }
      setSourceDimensions((currentDimensions) =>
        dimensionsMatch(currentDimensions, nextDimensions)
          ? currentDimensions
          : nextDimensions,
      )
    }

    updateSourceDimensions()
    video.addEventListener('loadedmetadata', updateSourceDimensions)
    video.addEventListener('resize', updateSourceDimensions)
    return () => {
      video.removeEventListener('loadedmetadata', updateSourceDimensions)
      video.removeEventListener('resize', updateSourceDimensions)
    }
  }, [videoRef])

  return { stageDimensions, sourceDimensions }
}

export function CameraPresentationStage({
  presentation,
  videoRef,
  onStartCamera,
  children,
  foreground,
  className,
  spatialSnapshot,
  showSpatialDiagnostic = false,
  onSpatialLayoutChange,
}: CameraPresentationStageProps) {
  const stageRef = useRef<HTMLElement>(null)
  const { stageDimensions, sourceDimensions } = useCameraPresentationDimensions(
    stageRef,
    videoRef,
  )
  const classes = ['camera-presentation-stage', className]
    .filter(Boolean)
    .join(' ')

  useEffect(() => {
    if (!onSpatialLayoutChange) return
    onSpatialLayoutChange({ sourceDimensions, stageDimensions })
  }, [onSpatialLayoutChange, sourceDimensions, stageDimensions])

  return (
    <section
      ref={stageRef}
      className={classes}
      data-presentation-mode={presentation.mode}
      data-camera-treatment={presentation.cameraTreatment}
      data-framing-requirement={presentation.framingRequirement}
    >
      <video
        ref={videoRef}
        className="camera-presentation-video"
        data-mirror-mode="display-only"
        aria-label="鏡像前鏡頭畫面"
        autoPlay
        muted
        playsInline
      />
      <div className="camera-presentation-treatment" aria-hidden="true" />

      <div className="camera-presentation-playfield">{children}</div>

      {spatialSnapshot && showSpatialDiagnostic ? (
        <CameraSpatialDiagnosticOverlay
          snapshot={spatialSnapshot}
          sourceDimensions={sourceDimensions}
          stageDimensions={stageDimensions}
        />
      ) : null}

      <div
        className="camera-presentation-framing"
        data-framing-guide={presentation.framingGuide}
        data-framing-requirement={presentation.framingRequirement}
        aria-hidden="true"
      >
        <div className="camera-presentation-frame-boundary" />
        <svg
          className="camera-presentation-body-guide"
          viewBox="0 0 240 500"
          focusable="false"
        >
          {presentation.framingRequirement === 'UPPER_BODY' ? (
            <>
              <circle className="camera-presentation-silhouette-head" cx="120" cy="96" r="34" />
              <path
                className="camera-presentation-silhouette-body camera-presentation-silhouette-upper"
                d="M94 142 C84 146 73 155 62 169 L47 143 L38 119 C34 108 40 99 50 96 C60 93 68 99 72 109 L84 137 C94 132 104 129 120 129 C136 129 146 132 156 137 L168 109 C172 99 180 93 190 96 C200 99 206 108 202 119 L193 143 L178 169 C167 155 156 146 146 142 L158 212 L164 459 C152 480 136 490 120 490 C104 490 88 480 76 459 L82 212 Z"
              />
              <circle className="camera-presentation-silhouette-hand" cx="44" cy="104" r="10" />
              <circle className="camera-presentation-silhouette-hand" cx="196" cy="104" r="10" />
            </>
          ) : (
            <>
              <circle className="camera-presentation-silhouette-head" cx="120" cy="58" r="34" />
              <path
                className="camera-presentation-silhouette-body"
                d="M93 108 C78 113 60 122 36 144 C48 165 62 180 82 190 L84 302 C84 320 99 332 120 332 C141 332 156 320 156 302 L158 190 C178 180 192 165 204 144 C180 122 162 113 147 108 C140 119 132 126 120 126 C108 126 100 119 93 108 Z"
              />
              <path
                className="camera-presentation-silhouette-legs"
                d="M87 292 C84 330 79 374 71 454 L106 454 L120 332 L134 454 L169 454 C161 374 156 330 153 292 Z"
              />
            </>
          )}
        </svg>
        <span>
          {presentation.framingRequirement === 'UPPER_BODY'
            ? '請對準人形範圍'
            : '請將全身移到人形範圍內'}
        </span>
      </div>

      {presentation.overlay !== 'NONE' ? (
        <div
          className="camera-presentation-status"
          data-overlay={presentation.overlay}
          role={presentation.alert ? 'alert' : 'status'}
        >
          <div className="camera-presentation-status-card">
            {presentation.eyebrow ? <p>{presentation.eyebrow}</p> : null}
            {presentation.headline ? <h2>{presentation.headline}</h2> : null}
            {presentation.detail ? <span>{presentation.detail}</span> : null}
            {presentation.actionLabel ? (
              <button type="button" onClick={onStartCamera}>
                {presentation.actionLabel}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {foreground ? (
        <div className="camera-presentation-foreground">{foreground}</div>
      ) : null}
    </section>
  )
}
