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
          <circle cx="120" cy="62" r="34" />
          <path d="M120 98 L120 286" />
          <path d="M52 158 L120 120 L188 158" />
          {presentation.framingRequirement === 'FULL_BODY' ? (
            <>
              <path d="M120 286 L66 442" />
              <path d="M120 286 L174 442" />
            </>
          ) : null}
        </svg>
        <span>
          {presentation.framingRequirement === 'UPPER_BODY'
            ? '頭部、肩膀與雙手保持在框內'
            : '全身保持在框內'}
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
