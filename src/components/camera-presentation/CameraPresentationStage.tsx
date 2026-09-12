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
          viewBox={
            presentation.framingRequirement === 'UPPER_BODY'
              ? '0 0 500 500'
              : '0 0 240 500'
          }
          data-silhouette={
            presentation.framingRequirement === 'UPPER_BODY'
              ? 'UPPER_BODY_RAISED_W'
              : 'FULL_BODY'
          }
          data-silhouette-fill={
            presentation.framingGuide === 'CONFIRMED' ? 'CONFIRMED' : 'GUIDANCE'
          }
          focusable="false"
        >
          {presentation.framingRequirement === 'UPPER_BODY' ? (
            <>
              <circle
                className="camera-presentation-silhouette-head"
                data-silhouette-part="head"
                cx="250"
                cy="110"
                r="52"
              />
              <path
                className="camera-presentation-silhouette-neck"
                data-silhouette-part="upper-neck"
                d="M228 145 C234 151 240 155 250 155 C260 155 266 151 272 145 L278 178 L222 178 Z"
              />
              <path
                className="camera-presentation-silhouette-body camera-presentation-silhouette-upper"
                data-silhouette-part="upper-torso"
                d="M184 178 C201 169 222 164 250 164 C278 164 299 169 316 178 C333 185 347 194 359 205 C346 220 329 230 309 237 L317 397 C299 409 277 416 250 416 C223 416 201 409 183 397 L191 237 C171 230 154 220 141 205 C153 194 167 185 184 178 Z"
              />
              <path
                className="camera-presentation-silhouette-arm camera-presentation-silhouette-left-arm"
                data-silhouette-part="upper-left-arm"
                d="M190 177 C174 178 158 185 143 198 L127 213 L101 225 C94 229 92 237 97 244 C102 251 112 253 119 248 L132 238 C143 229 153 220 160 214 C169 208 179 207 187 208 L190 177 Z"
              />
              <path
                className="camera-presentation-silhouette-arm camera-presentation-silhouette-left-forearm"
                data-silhouette-part="lower-left-arm"
                d="M127 227 C131 233 130 240 124 246 C118 252 108 253 101 247 L97 243 L57 158 C53 149 57 140 65 137 C73 134 82 138 86 146 L127 227 Z"
              />
              <path
                className="camera-presentation-silhouette-arm camera-presentation-silhouette-right-arm"
                data-silhouette-part="upper-right-arm"
                d="M310 177 C326 178 342 185 357 198 L373 213 L399 225 C406 229 408 237 403 244 C398 251 388 253 381 248 L368 238 C357 229 347 220 340 214 C331 208 321 207 313 208 L310 177 Z"
              />
              <path
                className="camera-presentation-silhouette-arm camera-presentation-silhouette-right-forearm"
                data-silhouette-part="lower-right-arm"
                d="M373 227 C369 233 370 240 376 246 C382 252 392 253 399 247 L403 243 L443 158 C447 149 443 140 435 137 C427 134 418 138 414 146 L373 227 Z"
              />
              <ellipse
                className="camera-presentation-silhouette-hand camera-presentation-silhouette-left-hand"
                data-silhouette-part="left-hand"
                cx="65"
                cy="150"
                rx="24"
                ry="29"
              />
              <ellipse
                className="camera-presentation-silhouette-hand camera-presentation-silhouette-right-hand"
                data-silhouette-part="right-hand"
                cx="435"
                cy="150"
                rx="24"
                ry="29"
              />
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
            ? '請將上半身移到人形範圍內'
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
