# Motion Arcade Handoff

- Phase: shared Pose camera startup repair — **ENGINEERING VERIFIED**; G0 is
  **NOT STARTED**.
- Status: the shared production Pose path used by all twelve camera games now
  bounds camera permission (20 s), preview playback (8 s), Worker init (12 s),
  and MainThread fallback init (12 s). It distinguishes opening camera from
  preparing Pose, routes failures into shared readable ERROR/retry UI, and
  cleans stale streams, Workers, backends, and start promises across retry,
  stop, hidden/pagehide, and unmount. The shared foreground wrapper is
  pointer-transparent, so game-local setup guides cannot intercept the
  start/retry CTA. See
  [Shared Pose Camera Startup Fix](docs/SHARED_CAMERA_STARTUP_FIX.md).
- MediaPipe: WASM remains generated at predev/prebuild; build now asserts the
  required model, loader modules, and WASM binaries exist in `dist/`. No
  generated WASM files were added to source control.
- Regression boundary: all twelve Pose games still instantiate
  `PoseGameplayInputRuntime`; no gameplay, detector, baseline, accessibility,
  or microphone threshold changed. G0 is not started.
- 12-game production startup matrix: **ENGINEERING SMOKE PASS** at 1280×720 and
  852×393. Every route renders the initial CTA and passed the shared startup
  state/error-retry contract. See
  [Pose Startup Smoke Matrix](docs/POSE_STARTUP_SMOKE_MATRIX.md).
- Real-device camera validation: **PENDING**. No physical-camera PASS is
  claimed in this batch.
- Physical checks still needed: Windows/iPhone permission and cold-start,
  denial/busy/retry, hidden/pagehide release, real front-camera preview,
  thermal behavior, and projector readability.
- Next safest task: Batch G0 — Multiplayer Foundation, after the shared-camera
  smoke/physical checks. Do not reopen individual game camera paths without
  shared-route evidence.

## Prior handoff — Batch F2 Sound Cannon

- Phase: Portfolio Batch Build — Batch F2 Sound Cannon.
- Status: F2 has an `ENGINEERING PASS` and is `PHYSICAL QA PENDING`. It adds
  a deterministic, camera-free target-blasting game consuming only the
  existing F0 `VOICE_LEVEL`, `VOICE_TRIGGER`, and
  `VOICE_SUSTAINED_DURATION` actions. A comfort-shaped short charge cycle,
  quiet-release/900 ms auto-fire, seeded target course, score/streak/result
  lifecycle, and explicit microphone-start production UX are implemented.
- F0 foundation remains unchanged: it provides
  explicit, one-player microphone ownership through the existing
  `VOICE_LEVEL`, `VOICE_TRIGGER`, and `VOICE_SUSTAINED_DURATION` Motion Action
  contract. The source routes microphone input only to an analyser; the
  provider emits immutable existing MotionInput snapshots for future Sessions.
- Safety and privacy: no `VOICE_VOLUME` contract, speech recognition,
  recording, storage, upload, transcription, audio playback, game route, or
  home card. `VOICE_PITCH` remains reserved in the existing contract and
  Developer provider but production deliberately rejects it pending physical
  evidence. Stop/dispose, hidden/pagehide, permission failure, and device loss
  all stop tracks, close context, and clear actions without automatic restart.
- Regression boundary: C0, D0, Pose/JUMP thresholds, camera lifecycle,
  registry schema, the existing Developer provider, and all existing games are
  unchanged. Nonvoice games do not start microphone capture.
- Known risk: Windows Chrome/iPhone Safari permission behavior, RMS levels,
  trigger/sustain feel, room noise, compact-space use, fatigue, recovery, and
  projector feedback remain physically unvalidated. No Physical PASS is
  claimed.
- Next safest task: Batch G0 — Multiplayer Foundation. Do not reopen F0, Vocal
  Hop, or existing games unless shared regression evidence requires it.
