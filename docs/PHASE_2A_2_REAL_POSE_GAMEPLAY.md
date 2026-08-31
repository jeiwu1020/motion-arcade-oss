# Phase 2A.2 — Real Pose gameplay

Status: Phase 2A.2a engineering complete; Windows/iPhone physical validation pending

## Scope

Balloon Pop is playable in a normal production build through the existing real
pipeline:

```text
CameraController
  → PoseSensorSession / InferenceScheduler / PoseInferenceBackend
  → PoseMotionInputProvider
  → normalized REACH_LEFT / REACH_RIGHT
  → BalloonPopSession
  → BalloonPopCore
```

The production route and home entry do not depend on
`VITE_ENABLE_TEST_INPUT` or `REAL_SENSOR_LAB_ENABLED`. Development continues to
lazy-load the existing keyboard/test-provider screen. Production never renders
the Z/C controls.

## Shared acquisition boundary

`PoseGameplayInputRuntime` is deliberately narrower than a generic
`SensorManager`. It owns one STANDARD, single-person Pose acquisition session:

- starts `PoseMotionInputProvider` with the game's explicit normalized action
  request;
- constructs and controls `CameraController`, `PoseSensorSession`, the adaptive
  Pose backend, and `InferenceScheduler`;
- ingests `PoseSensorFrame` only into the existing provider;
- exposes the normalized provider plus coarse gameplay readiness;
- closes provider, scheduler, backend, camera tracks, and lifecycle listeners on
  error or disposal.

It does not inspect game state, detect reaches, render UI, or expose landmarks.
BalloonPopCore and the Phaser scene remain unchanged sensor-free consumers.

## Lifecycle

Runtime readiness states are:

- `CAMERA_NOT_STARTED` — initial/released state; no permission request.
- `PERMISSION_STARTING` — explicit 啟動相機 action is acquiring camera/model.
- `BASELINING` — inference is running but STANDARD full-body readiness is not yet
  established.
- `READY` — analyzer quality, baseline, and full-body readiness are all usable.
- `TRACKING_LOST` — a previously ready participant is no longer usable; gameplay
  is paused until readiness is fully restored.
- `ERROR` — startup or inference failed closed; readable retry UI is shown.

The React screen derives READY/countdown, PLAYING, and RESULT from runtime
readiness plus immutable core phase. The BalloonPop session updates provider
freshness on every frame but advances core time only when readiness is READY.
This freezes countdown, the 60-second clock, inter-target delay, and balloon
expiry during loss without adding pause concepts to the pure Game Core.

Replay resets only core state and therefore reuses an active healthy camera and
Pose session. Return Home/unmount disposes the runtime. `visibilitychange` and
`pagehide` are still owned by `PoseSensorSession`; they stop acquisition and
require a new explicit camera start rather than silently reacquiring permission.

## Input and UI boundaries

The production request is STANDARD, Pose-required, single-player, and contains
only `REACH_LEFT` and `REACH_RIGHT`. There is no calibration or adaptive profile
selection. The mirrored camera preview is CSS/display-only and never changes
source coordinates or anatomical action labels.

The production UI explicitly represents camera-not-started, permission-starting,
baselining, ready/countdown, playing, tracking-lost, error, and result states.

## Physical validation still required

- Windows Chrome real camera: allow/deny/busy errors, baseline, anatomical reaches,
  tracking loss/recovery, Replay/Home, page hide, and track release.
- iPhone Safari landscape: permission, front-camera semantics, full-body framing,
  safe areas, FIT projection, page lifecycle, heat, and projector readability.
- Extended-arm hold must produce one hit only; a new intentional reach must be
  required for the next hit.

No physical camera behavior is claimed PASS by this engineering phase.
