# Motion Arcade — Phase 1B Pose Sensor Spike

Status: Phase 1B diagnostic spike; no Motion Analyzer or formal game

Date: 2026-08-28

## Purpose and boundary

Phase 1B proves the first local sensor vertical only:

```text
explicit camera gesture
  → CameraController
  → local video frame
  → InferenceScheduler
  → PoseInferenceBackend
  → MediaPipe-independent PoseSensorFrame
  → developer overlay and local telemetry
```

The spike stops at `PoseSensorFrame`. It does not detect jumps, squats,
leans, strikes, throws, reaches, cadence, or any other motion action. It does
not implement calibration, Motion Analyzer, normalized actions, multi-person
tracking, Hands, Voice, recording, upload, persistence, or a formal game.

## Gate and ownership

`VITE_ENABLE_REAL_SENSOR_LAB` is enabled automatically in development and is
disabled in production unless the build contains the exact value `true`.
`#pose-sensor-lab` and query strings cannot bypass this gate. The lab is a
separate lazy React route; the existing Developer Input Lab gate and lazy
Phaser route remain independent.

`CameraController` owns only camera acquisition and cleanup. `PoseSensorSession`
coordinates camera, backend, scheduler, visibility, and pagehide lifecycle.
Leaving the lab, stopping, hiding, or pagehide stops every track, detaches the
video source, closes the backend, and does not reacquire automatically when the
page becomes visible. The user must explicitly restart.

Camera permission is requested only by `啟動相機` / `重新啟動`, never on HOME,
module import, or lab mount. Requests are video-only with an ideal `user`
facing preference; actual track width, height, frame rate, and facing mode are
shown when the browser provides them. The video uses `muted`, `playsInline`,
`srcObject`, and explicit `play()` handling.

## MediaPipe model and assets

- Package: `@mediapipe/tasks-vision@1.0.1` (pinned; Apache-2.0 code)
- Task: Pose Landmarker Lite, float16
- Configuration: VIDEO, `numPoses: 1`, detection/presence/tracking thresholds
  `0.5`, `outputSegmentationMasks: false`
- Source: [official MediaPipe Pose Landmarker Lite task](https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task)
- Retrieved: 2026-08-28
- Local file: `public/vendor/mediapipe/models/pose_landmarker_lite.task`
- Size: 5,777,746 bytes
- SHA-256: `59929E1D1EE95287735DDD833B19CF4AC46D29BC7AFDDBBF6753C459690D574A`
- Model card: [BlazePose GHUM 3D model card](https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf), Apache License 2.0

`scripts/copy-mediapipe-wasm.mjs` copies the exact six WASM/runtime files from
the installed 1.0.1 package into generated `public/vendor/mediapipe/wasm/`
before dev, preview, and build. They are never fetched from a CDN or `latest`
at runtime. A small Vite development middleware serves the package's module
loader directly because Vite otherwise refuses dynamic imports of public JS;
the production build serves the generated files as normal static assets.

The module worker uses `FilesetResolver.forVisionTasks(wasmBaseUrl, true)` so
the module loader can publish `ModuleFactory` in the worker global. The
main-thread fallback uses the classic loader in the document context.

## Worker, fallback, and ownership

The preferred backend is `PoseWorkerClient`, created with Vite's module-worker
pattern. The scheduler creates an `ImageBitmap` only for an inference that is
due and transfers ownership to the worker. The worker runs synchronous
`detectForVideo(bitmap, timestampMs)`, copies the compact result DTO, closes
the bitmap and task result, and sends the DTO back. There is never more than
one in-flight inference and stale opportunities are dropped rather than
queued.

If `Worker` is unavailable, `AdaptivePoseBackend` selects the same-interface
`MainThreadPoseBackend` and reports `MAIN_THREAD_FALLBACK` plus its reason. The
fallback remains throttled (12 Hz by default). A worker model/task failure is
reported as an error rather than silently being hidden as a coding fallback.

## Scheduling and telemetry

The render loop is independent of inference and targets the display refresh
rate. Pose inference starts at 20 Hz for the worker and 12 Hz for the fallback;
the scheduler uses `performance.now()` and ignores duplicate
`video.currentTime` values. Local lab telemetry includes:

- camera state, source dimensions, frame rate, and facing preference;
- backend and worker mode/status, target and measured inference Hz;
- UI/render FPS, mean and p95 inference duration;
- completed/dropped inference opportunities;
- pose-present boolean, last result age, and model state.

No raw frame, video blob, screenshot, canvas export, landmark array, patient
name, participant ID, or stable identifier is logged or persisted.

## Result and mirroring contracts

`PoseSensorFrame` contains timestamp, source dimensions, one-or-zero poses,
normalized `PoseLandmark` values, and optional copied world landmarks. It never
exposes MediaPipe result classes and contains no segmentation masks.

The front-camera preview and skeleton are mirrored together with a presentation
transform. Raw `PoseSensorFrame.x` values remain source coordinates and are not
mutated; any future game-space conversion belongs after this spike, in the
future coordinate/analyzer boundary.

## Browser and device QA

Automated unit tests mock media APIs and cover gate behavior, camera start/
stop/restart/error cleanup, scheduler cadence/overlap/drop behavior, worker
protocol validation, session visibility/pagehide cleanup, and the mirroring
invariant. Browser layout checks cover HOME/Lab mount, no permission before the
explicit action, route cleanup, no HOME media elements, desktop and 852×393
landscape overflow, and Developer Input Lab regression.

The available browser connector in this environment did not expose a usable
physical camera and later reached its usage limit during the isolated blank
canvas Pose task smoke check. Therefore the following remains explicitly
unverified:

`MANUAL DEVICE TEST REQUIRED`

On a real HTTPS iPhone Safari landscape session, verify permission timing,
mirrored preview and skeleton, full-body framing at roughly 2–4 m, 30–60 s
operation, background suspension without auto-restart, explicit restart, stop
indicator, and actual inference telemetry. Desktop responsive emulation is not
a substitute for that device test.

## Privacy and network boundary

No Motion Arcade backend endpoint, upload, MediaRecorder, screenshot API,
IndexedDB/localStorage raw-pose persistence, or cloud inference exists in this
spike. The exact Pose task is configured to load its model and WASM from the
Motion Arcade origin. MediaPipe SDK metrics behavior remains governed by the
separate [privacy and telemetry audit](./MEDIAPIPE_PRIVACY_TELEMETRY.md); this
document does not claim zero third-party communication.
