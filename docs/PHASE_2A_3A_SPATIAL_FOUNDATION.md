# Phase 2A.3a — Normalized Spatial Interaction Foundation

Status: engineering implementation; physical validation remains required

## Scope

This narrow first slice exposes canonical anatomical left and right Pose-wrist
positions from the existing production `PoseGameplayInputRuntime`. It adds no
gameplay, cursor, collision, object-fit mapping, Phaser mapping, camera stream,
MediaPipe task, or new `PoseSensorSession`.

```text
Camera → existing PoseSensorSession → PoseMotionInputProvider → Motion actions
                                    └→ PoseSpatialHandTracker → spatial hands
```

Both branches receive the same `PoseInferenceResult.frame`. The runtime owns
the tracker and exposes its immutable result through `getSpatialSnapshot()`.
`MotionInputSnapshot` remains action-only; calibration and raw Pose data remain
outside every game-facing snapshot.

## Public spatial contract

`src/motion/contracts/spatial.ts` defines `SpatialHandSnapshot`:

- `leftHand` and `rightHand` always name the participant's anatomical hands;
- an `AVAILABLE` hand contains `x`, `y`, confidence, source timestamp, and
  monotonically increasing sample sequence;
- an `UNAVAILABLE` hand deliberately contains no coordinate;
- every published object is immutable.

The contract intentionally does not carry a raw landmark array, Pose frame,
source image dimensions, MediaPipe type, camera object, or body-unit feature.

## Coordinate and mirror semantics

Spatial points are normalized **camera-source image** coordinates:

```text
x = 0 source-image left edge       x = 1 source-image right edge
y = 0 source-image top edge        y = 1 source-image bottom edge
```

The tracker uses the existing `PoseFeatureExtractor` only for canonical wrist
identity and confidence validation. It reads the wrist's original normalized
`x`/`y`, never its body-relative/aspect-corrected movement metrics. Coordinates
outside `0..1`, non-finite values, missing wrists, and wrists below the existing
Pose minimum landmark confidence become `UNAVAILABLE` rather than being clamped
to a misleading edge position.

CSS `scaleX(-1)` remains display-only. It does not swap anatomical sides or
mutate these source coordinates. Existing action coordinate behavior remains
unchanged and is not reused as spatial screen mapping.

## Freshness and lifecycle

Spatial hands share the existing Pose `250 ms` freshness interval. Once a new
sample is older than that interval, both hand positions become `UNAVAILABLE`.
A subsequent valid Pose sample recovers availability with a new sequence.
Runtime stop, suspend, dispose, and sensor error reset the tracker, so a
previous wrist is never held across a sensor lifecycle boundary.

Wrist availability has no dependency on knees, ankles, `fullBodyReady`, or the
current Balloon Pop STANDARD readiness gate. This prepares future UPPER_BODY
games without changing any current FULL_BODY game readiness behavior.

## Deferred to Phase 2A.3b and later

- `object-fit: contain` source-video rectangle mapping;
- letterbox/pillarbox offsets;
- source-to-Phaser/playfield mapping;
- display-mirror alignment policy for AR collision;
- visual hand cursors, previous/current swept segments, and collision;
- Balloon Rally physics, scoring, and gameplay;
- Hands Landmarker, multi-person tracking, microphone, persistence, and new
  profile UI.

## Manual validation before Phase 2A.3b

1. On Windows and iPhone Safari, start the existing real Pose path and verify
   each visible anatomical wrist produces a stable source-position sample.
2. Verify a mirrored preview does not swap anatomical left/right in diagnostics.
3. Briefly occlude each wrist and confirm it becomes unavailable, then recovers
   after it returns.
4. Verify stale/lost tracking removes both spatial hands and stop/restart cannot
   reuse a prior wrist.
5. Capture the displayed contain rectangle and projector alignment evidence for
   the next phase; this phase intentionally does not claim visual/collision
   alignment.
