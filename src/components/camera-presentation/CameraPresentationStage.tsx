import type { ReactNode, RefObject } from 'react'

import type { CameraPresentation } from './cameraPresentationModel'
import './CameraPresentationStage.css'

export interface CameraPresentationStageProps {
  readonly presentation: CameraPresentation
  readonly videoRef: RefObject<HTMLVideoElement | null>
  readonly onStartCamera: () => void
  readonly children: ReactNode
  readonly foreground?: ReactNode
  readonly className?: string
}

export function CameraPresentationStage({
  presentation,
  videoRef,
  onStartCamera,
  children,
  foreground,
  className,
}: CameraPresentationStageProps) {
  const classes = ['camera-presentation-stage', className]
    .filter(Boolean)
    .join(' ')

  return (
    <section
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

      <div
        className="camera-presentation-framing"
        data-framing-guide={presentation.framingGuide}
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
          <path d="M120 286 L66 442" />
          <path d="M120 286 L174 442" />
        </svg>
        <span>全身保持在框內</span>
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
