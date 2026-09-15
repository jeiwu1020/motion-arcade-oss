# Shared Pose Camera Startup Fix

Status: engineering repair before G0 — Multiplayer Foundation.

## Scope

This repair hardens the one production Pose acquisition route used by Balloon
Rally, Reaction Arena, Runner, Rhythm Motion, Tennis, Badminton, Bowling,
Running Race, Swimming, High Jump, Long Jump Challenge, and Baseball. Voice
routes are not involved.

The shared route is:

```text
CameraPresentationStage
  -> game start handler
  -> PoseGameplayInputRuntime
  -> PoseSensorSession
  -> CameraController
  -> AdaptivePoseBackend
  -> Worker Pose backend or MainThread fallback
  -> InferenceScheduler
```

No game-specific camera path was added.

## Root causes and bounded operations

Previously, `PERMISSION_STARTING` covered camera permission, preview playback,
and Pose initialization. A successful camera permission therefore continued to
look like a camera hang while Worker `INIT -> READY` had no timeout.

The audit also found these asynchronous operations could remain pending:

- `getUserMedia` permission/opening;
- `HTMLVideoElement.play()`;
- Worker creation/posting and Worker `INIT -> READY`;
- Worker-side MediaPipe `FilesetResolver` and model creation;
- Main-thread MediaPipe `FilesetResolver` and model creation.

The centralized policy in `src/sensors/startup/StartupTimeouts.ts` uses:

| Operation | Bound |
| --- | ---: |
| Camera permission/open | 20 seconds |
| Camera preview playback | 8 seconds |
| Worker Pose initialization | 12 seconds |
| Main-thread Pose fallback initialization | 12 seconds |

The 12-second model bounds allow for local WASM/model startup on phones while
making an unavailable asset/runtime deterministic. Timeouts invalidate the
active lifecycle generation, so a late camera stream or late model is released
instead of reviving a cancelled attempt.

## Startup state and feedback

`PoseGameplayInputRuntime` retains its public readiness model and adds
`POSE_INITIALIZING` between the existing `PERMISSION_STARTING` and
`BASELINING` states:

```text
CAMERA_NOT_STARTED
  -> PERMISSION_STARTING (正在開啟相機)
  -> POSE_INITIALIZING (正在準備姿勢辨識)
  -> BASELINING
  -> READY
```

Any bounded failure reaches `ERROR` with a readable message and the shared
Camera Presentation retry action. Baselining and READY behavior are unchanged.

## Worker and fallback behavior

`PoseWorkerClient` now treats Worker construction, `onerror`, INIT error, and
INIT timeout as typed failures. On initialization timeout it removes handlers,
terminates the Worker, rejects with `WORKER_INIT_TIMEOUT`, and clears its ready
promise for a fresh attempt.

`AdaptivePoseBackend` performs one Worker attempt. `WORKER_INIT_FAILED` and
`WORKER_INIT_TIMEOUT` each trigger one MainThread fallback attempt. A fallback
failure closes that fallback and surfaces a typed `PoseBackendError`; it does
not retry Workers in a loop. Main-thread initialization is independently
bounded and closes a landmarker that completes after cancellation.

## Camera, retry, and lifecycle behavior

`CameraController` keeps explicit user gesture, HTTPS, front-camera
preference, `audio: false`, a single active stream, and start reuse. It now
bounds permission/open and preview playback; timeout or playback failure stops
tracks and detaches only the matching stale stream. Stop, hidden/pagehide, and
unmount invalidate generation state. A late cancelled preview cannot detach a
subsequent retry's preview.

`PoseSensorSession` reports camera then Pose startup stages, releases camera
and backend on failures, and keeps its existing stop/suspend generation guard.
`PoseGameplayInputRuntime` clears a failed start promise and exposes `ERROR`,
so button handlers may safely ignore a rejected call while shared state remains
the authority for visible retry.

## MediaPipe assets

The committed model URL remains:

`/vendor/mediapipe/models/pose_landmarker_lite.task`

WASM remains generated during predev/prebuild from
`scripts/copy-mediapipe-wasm.mjs` at:

`/vendor/mediapipe/wasm`

Generated WASM files are not committed. `npm run build` now verifies all three
MediaPipe loader modules, all three WASM binaries, and the model are present
and non-empty in `dist/`.

## Validation and remaining physical checks

Focused unit coverage exercises permission/preview success and failure,
cancelled starts, rapid starts, timeout/retry, Worker READY/ERROR/onerror/
timeout/retry, Worker-to-main fallback, fallback failure cleanup, session
stop during startup, runtime retry, and presentation copy for each startup
state.

Physical camera checks remain required on Windows Chrome and iPhone Safari:
permission prompt timing, denial/busy/no-camera errors, front-camera preview,
longer cold-cache MediaPipe startup, hidden/pagehide cleanup, retry after a
real failure, thermal behavior, and projector readability at the intended
distance. Browser automation cannot validate a physical camera.

G0 — Multiplayer Foundation remains the next portfolio implementation after
this repair and smoke validation; it is not started by this change.
