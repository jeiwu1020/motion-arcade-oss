# Motion Arcade Handoff

- Phase: Portfolio Batch Build — Batch C3 Bowling.
- Status: Bowling has an `ENGINEERING PASS` and is `PHYSICAL QA PENDING`.
  The pure deterministic Core owns the five-frame state machine, 2,500 ms aim
  sweep, ball/settling/transition timers, standing-pin state, deterministic
  pin resolver, arcade score, hand statistics, and stable result.
  The Session consumes only game-local swing attempts derived from the
  immutable C0 Sports Motion snapshot.
- Validation: typecheck, lint, 521 tests across 81 files, production build, and
  `git diff --check` pass. Browser smoke covers the Home card, Bowling launch,
  countdown, aim marker, bilateral camera-free controls, opaque lane,
  production explicit camera setup, and result/replay checks available at the
  local landscape viewport.
- Safety boundary: C0 swing thresholds, refractory behavior, snapshot
  semantics, Pose thresholds, Tennis, Badminton, existing games, and the
  single Pose inference path remain unchanged. Bowling uses no shared RELEASE
  event, raw landmarks, camera objects, microphone, or sport-specific
  detector. C0 swing is sufficient for the engineering release contract only;
  physical recognition is not validated.
- Known risk: physical bowling release recognition, iPhone Safari,
  compact-space behavior, fatigue, projector readability, and physical game
  feel remain intentionally unvalidated.
- Next safest task: Batch D0 — Locomotion Toolkit. Keep Bowling game-local and
  preserve C0's RELEASE deferral unless physical QA produces evidence for a
  separately scoped shared-foundation change.
