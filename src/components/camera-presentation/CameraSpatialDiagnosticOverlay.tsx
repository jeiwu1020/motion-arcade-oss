import type { SpatialHandSnapshot } from '../../motion/contracts/spatial'
import {
  mapSpatialHandToMirroredStage,
  type CameraPresentationDimensions,
} from './spatialDisplayMapping'

export interface CameraSpatialDiagnosticOverlayProps {
  readonly snapshot: SpatialHandSnapshot
  readonly sourceDimensions: CameraPresentationDimensions | null
  readonly stageDimensions: CameraPresentationDimensions
}

/**
 * Engineering-only DOM presentation of canonical Pose wrist positions. It
 * maps the current immutable spatial snapshot without participating in input,
 * camera ownership, or game rules.
 */
export function CameraSpatialDiagnosticOverlay({
  snapshot,
  sourceDimensions,
  stageDimensions,
}: CameraSpatialDiagnosticOverlayProps) {
  const leftHand = sourceDimensions
    ? mapSpatialHandToMirroredStage(
        snapshot.leftHand,
        sourceDimensions,
        stageDimensions,
      )
    : null
  const rightHand = sourceDimensions
    ? mapSpatialHandToMirroredStage(
        snapshot.rightHand,
        sourceDimensions,
        stageDimensions,
      )
    : null

  return (
    <div
      className="camera-presentation-spatial-diagnostic"
      data-spatial-diagnostic="engineering"
      aria-hidden="true"
    >
      <span className="camera-presentation-spatial-diagnostic-title">
        空間校驗
      </span>
      {leftHand ? (
        <span
          className="camera-presentation-spatial-marker camera-presentation-spatial-marker-left"
          data-spatial-hand="LEFT"
          style={{ left: `${leftHand.x}px`, top: `${leftHand.y}px` }}
        >
          左手
        </span>
      ) : null}
      {rightHand ? (
        <span
          className="camera-presentation-spatial-marker camera-presentation-spatial-marker-right"
          data-spatial-hand="RIGHT"
          style={{ left: `${rightHand.x}px`, top: `${rightHand.y}px` }}
        >
          右手
        </span>
      ) : null}
    </div>
  )
}
