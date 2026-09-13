import type {
  PoseTrackingJoints,
  PoseTrackingPoint,
  PoseTrackingSnapshot,
} from '../../motion/contracts/poseTracking'
import {
  mapCanonicalSourcePointToMirroredStage,
  type CameraPresentationDimensions,
  type CameraStageDisplayPoint,
} from './spatialDisplayMapping'

export interface CameraPoseTrackingOverlayProps {
  readonly snapshot: PoseTrackingSnapshot
  readonly sourceDimensions: CameraPresentationDimensions | null
  readonly stageDimensions: CameraPresentationDimensions
}

const CONNECTIONS = [
  ['leftShoulder', 'rightShoulder'],
  ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftWrist'],
  ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightWrist'],
  ['leftShoulder', 'leftHip'], ['rightShoulder', 'rightHip'],
  ['leftHip', 'rightHip'],
  ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle'],
] as const satisfies readonly (readonly [keyof PoseTrackingJoints, keyof PoseTrackingJoints])[]

interface DisplayJoint {
  readonly point: CameraStageDisplayPoint
  readonly valid: boolean
}

function mapPoint(
  point: PoseTrackingPoint,
  sourceDimensions: CameraPresentationDimensions | null,
  stageDimensions: CameraPresentationDimensions,
): DisplayJoint | null {
  if (point.x === null || point.y === null || !sourceDimensions) return null
  const displayPoint = mapCanonicalSourcePointToMirroredStage(
    { x: point.x, y: point.y },
    sourceDimensions,
    stageDimensions,
  )
  return displayPoint ? { point: displayPoint, valid: point.valid } : null
}

/**
 * Presentation-only body tracking feedback. It consumes the sanitized
 * selected-joint snapshot and uses the same contain-fit + mirror mapping as
 * spatial wrist diagnostics; no Pose frame reaches the DOM layer.
 */
export function CameraPoseTrackingOverlay({
  snapshot,
  sourceDimensions,
  stageDimensions,
}: CameraPoseTrackingOverlayProps) {
  if (!snapshot.posePresent || !sourceDimensions) {
    return <div className="camera-presentation-pose-tracking" data-pose-tracking-overlay="visible" aria-hidden="true" />
  }
  const mapped = Object.fromEntries(
    Object.entries(snapshot.joints).map(([name, point]) => [
      name,
      mapPoint(point, sourceDimensions, stageDimensions),
    ]),
  ) as { readonly [Key in keyof PoseTrackingJoints]: DisplayJoint | null }

  return (
    <div
      className="camera-presentation-pose-tracking"
      data-pose-tracking-overlay="visible"
      aria-hidden="true"
    >
      <svg
        className="camera-presentation-pose-tracking-svg"
        width={stageDimensions.width}
        height={stageDimensions.height}
        viewBox={`0 0 ${stageDimensions.width} ${stageDimensions.height}`}
        focusable="false"
      >
        {CONNECTIONS.map(([from, to]) => {
          const start = mapped[from]
          const end = mapped[to]
          if (!start || !end) return null
          return (
            <line
              key={`${from}-${to}`}
              className="camera-presentation-pose-bone"
              data-pose-confidence={start.valid && end.valid ? 'HIGH' : 'LOW'}
              x1={start.point.x}
              y1={start.point.y}
              x2={end.point.x}
              y2={end.point.y}
            />
          )
        })}
        {(Object.keys(mapped) as Array<keyof PoseTrackingJoints>).map((name) => {
          const joint = mapped[name]
          if (!joint) return null
          return (
            <circle
              key={name}
              className="camera-presentation-pose-joint"
              data-pose-joint={name}
              data-pose-confidence={joint.valid ? 'HIGH' : 'LOW'}
              cx={joint.point.x}
              cy={joint.point.y}
              r={joint.valid ? 6 : 4.5}
            />
          )
        })}
      </svg>
    </div>
  )
}
