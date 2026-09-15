# Motion Arcade Handoff

- Phase: Portfolio Batch Build — Batch F1 Vocal Hop.
- Status: F1 has an `ENGINEERING PASS` and is `PHYSICAL QA PENDING`. It adds
  a deterministic, camera-free voice-controlled hop game consuming only the
  existing F0 `VOICE_LEVEL`, `VOICE_TRIGGER`, and
  `VOICE_SUSTAINED_DURATION` actions. A comfortable saturating lift curve,
  bounded 500 ms boost, seeded obstacle course, score/streak/result lifecycle,
  and explicit microphone-start production UX are implemented.
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
- Next safest task: Batch F2 — Sound Cannon, consuming only production-backed
  `VOICE_LEVEL` (and only other existing voice actions if its bounded design
  genuinely needs them) with the same explicit microphone lifecycle.
