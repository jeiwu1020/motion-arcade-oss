# Motion Arcade Handoff

- Phase: Portfolio Batch Build — Batch F0 Voice Input Foundation.
- Status: F0 has an `ENGINEERING PASS` and is `PHYSICAL QA PENDING`. It adds
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
- Next safest task: Batch F1 — Vocal Hop, consuming only production-backed
  `VOICE_LEVEL` and optional discrete voice actions with an explicit microphone
  start UI.
