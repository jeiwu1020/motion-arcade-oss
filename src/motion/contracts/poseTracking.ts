/**
 * Presentation-safe, source-image-normalized landmarks from the latest Pose
 * sample. This contract intentionally contains only the joints useful for
 * framing feedback; it is not a raw Pose frame or gameplay input contract.
 */
export interface PoseTrackingPoint {
  readonly x: number | null
  readonly y: number | null
  readonly confidence: number
  readonly valid: boolean
}

export interface PoseTrackingJoints {
  readonly leftShoulder: PoseTrackingPoint
  readonly rightShoulder: PoseTrackingPoint
  readonly leftElbow: PoseTrackingPoint
  readonly rightElbow: PoseTrackingPoint
  readonly leftWrist: PoseTrackingPoint
  readonly rightWrist: PoseTrackingPoint
  readonly leftHip: PoseTrackingPoint
  readonly rightHip: PoseTrackingPoint
  readonly leftKnee: PoseTrackingPoint
  readonly rightKnee: PoseTrackingPoint
  readonly leftAnkle: PoseTrackingPoint
  readonly rightAnkle: PoseTrackingPoint
}

export interface PoseTrackingSnapshot {
  readonly timestampMs: number
  readonly sequence: number
  readonly posePresent: boolean
  readonly joints: PoseTrackingJoints
}
