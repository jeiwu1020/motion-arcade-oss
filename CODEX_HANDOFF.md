# Motion Arcade Handoff

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
