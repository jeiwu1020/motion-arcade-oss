# Pose Startup Smoke Matrix

Updated: 2026-09-16

This is the production-build QA matrix for the twelve current homepage games
that use the shared Pose camera path. The static route audit and reusable
`src/app/poseStartupMatrix.test.tsx` cover route resolution, explicit-start
rendering, one preview element, Pose-only sensor configuration, and delegation
to `PoseGameplayInputRuntime`. Shared runtime/presentation tests cover the
startup sequence `CAMERA_NOT_STARTED → PERMISSION_STARTING →
POSE_INITIALIZING → BASELINING → READY` and the failure sequence `ERROR →
retry`.

`Browser 1280×720` and `Browser 852×393` are production `vite preview` smoke
results. Browser automation has no granted physical camera, so those checks
prove navigation, rendering, CTA visibility, immediate startup feedback, and
the intentional permission-denied ERROR/retry surface only. They do not claim
real-camera success.

The first pointer pass found one shared presentation defect: the
`.camera-presentation-foreground` wrapper could intercept the start/retry
button when a game supplied a setup guide. The wrapper now has
`pointer-events: none`; game result controls that must remain interactive keep
their explicit child override. The production matrix below was rerun after
that fix.

| Game | Category | Input family | Framing | Production route | Shared Pose runtime | Initial CTA | Startup-state smoke | Error/retry smoke | Browser 1280×720 | Browser 852×393 | Real-camera status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Balloon Rally / 氣球拍拍樂 | Pose · Spatial Hand | Spatial hand collision | UPPER_BODY | `#game/balloon-pop` | PASS | PASS — 啟動相機 | PASS — shared sequence | PASS — shared ERROR/retry | PASS | PASS | NOT PHYSICALLY TESTED | One shared Pose runtime; no Hands or microphone. |
| Reaction Arena / 光速反應王 | Pose · General Motion | Motion Actions | FULL_BODY KNEES | `#game/reaction-arena` | PASS | PASS — 啟動相機 | PASS — shared sequence | PASS — shared ERROR/retry | PASS | PASS | NOT PHYSICALLY TESTED | KNEES readiness is provider configuration; no ankle requirement. |
| Runner / 跑酷衝刺 | Pose · General Motion | Motion Actions | FULL_BODY STRICT | `#game/runner` | PASS | PASS — 啟動相機 | PASS — shared sequence | PASS — shared ERROR/retry | PASS | PASS | NOT PHYSICALLY TESTED | Explicit user start; JUMP/SQUAT contract unchanged. |
| Rhythm Motion / 節奏動一動 | Pose · General Motion | Motion Actions | UPPER_BODY | `#game/rhythm-motion` | PASS | PASS — 啟動相機 | PASS — shared sequence | PASS — shared ERROR/retry | PASS | PASS | NOT PHYSICALLY TESTED | Upper-body rhythm actions only; no microphone. |
| Tennis / 網球對決 | Pose · Sports Motion | Sports swing events | UPPER_BODY | `#game/tennis` | PASS | PASS — 啟動相機 | PASS — shared sequence | PASS — shared ERROR/retry | PASS | PASS | NOT PHYSICALLY TESTED | Reuses the C0 Sports Motion provider path. |
| Badminton / 羽球快打 | Pose · Sports Motion | Sports swing events | UPPER_BODY | `#game/badminton` | PASS | PASS — 啟動相機 | PASS — shared sequence | PASS — shared ERROR/retry | PASS | PASS | NOT PHYSICALLY TESTED | Reuses the C0 Sports Motion provider path. |
| Bowling / 保齡球大賽 | Pose · Sports Motion | Sports swing events | UPPER_BODY | `#game/bowling` | PASS | PASS — 啟動相機 | PASS — shared sequence | PASS — shared ERROR/retry | PASS | PASS | NOT PHYSICALLY TESTED | Reuses the C0 Sports Motion provider path. |
| Running Race / 原地衝刺王 | Pose · Locomotion | Locomotion cadence | FULL_BODY KNEES | `#game/running-race` | PASS | PASS — 啟動相機 | PASS — shared sequence | PASS — shared ERROR/retry | PASS | PASS | NOT PHYSICALLY TESTED | KNEES readiness; no ankle requirement. |
| Swimming / 泳池衝刺 | Pose · Sports Motion | Sports swing events | UPPER_BODY | `#game/swimming` | PASS | PASS — 啟動相機 | PASS — shared sequence | PASS — shared ERROR/retry | PASS | PASS | NOT PHYSICALLY TESTED | Alternating C0 swing events; no microphone. |
| High Jump / 跳高挑戰 | Pose · General Motion | JUMP Motion Action | FULL_BODY STRICT | `#game/high-jump` | PASS | PASS — 啟動相機 | PASS — shared sequence | PASS — shared ERROR/retry | PASS | PASS | NOT PHYSICALLY TESTED | Existing JUMP detector and thresholds unchanged. |
| Long Jump Challenge / 飛躍挑戰 | Pose · Locomotion | Locomotion + JUMP | FULL_BODY STRICT | `#game/long-jump` | PASS | PASS — 啟動相機 | PASS — shared sequence | PASS — shared ERROR/retry | PASS | PASS | NOT PHYSICALLY TESTED | Existing locomotion/JUMP contracts unchanged. |
| Baseball / 全壘打王 | Pose · Sports Motion | Sports swing events | UPPER_BODY | `#game/baseball` | PASS | PASS — 啟動相機 | PASS — shared sequence | PASS — shared ERROR/retry | PASS | PASS | NOT PHYSICALLY TESTED | Reuses the C0 Sports Motion provider path. |

## Static route audit

- All twelve hashes resolve through `screenFromHash` and the production game
  registry to their Pose game screen.
- Every screen constructs exactly one `PoseGameplayInputRuntime` and passes its
  game-specific request to the runtime start helper. No screen constructs a
  `CameraController` or `PoseSensorSession` directly.
- Camera acquisition remains an explicit button action; render/navigation does
  not request media. Every request is `pose: true`, `hands: false`,
  `audio: false`.
- Each production screen renders one camera preview and the shared
  `CameraPresentationStage` with the initial `啟動相機` action.
- The shared foreground wrapper is pointer-transparent, so game-local setup
  guides cannot block the start/retry action.

## Failure/retry coverage

The shared automated suite covers permission denial, camera/startup failure,
Worker error/timeout, MainThread fallback, fallback failure, stop/hidden
lifecycle races, and a clean retry. The browser smoke intentionally exercised
permission denial on every route: each CTA immediately changed to startup
feedback, then the bounded failure rendered readable `無法使用姿勢辨識`
text and `重新啟動相機`.

## Real-device boundary

No physical camera or phone was used for this batch. Real front-camera
permission, preview playback, Worker/WASM cold start, baseline quality,
busy-device recovery, hidden/pagehide release, thermal behavior, and
projector-distance readability remain pending physical validation.
