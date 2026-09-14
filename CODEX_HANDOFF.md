# Motion Arcade Handoff

- Phase: Portfolio Batch Build — Batch C2 Badminton.
- Status: Badminton has an `ENGINEERING PASS` and is `PHYSICAL QA PENDING`.
  The pure deterministic Core owns the seeded 60-second CLEAR/DRIVE/DROP
  shuttle course, four visual target regions, phase spacing, contact windows,
  bounded return trajectory, Smash bonus, score/rally state, and result events.
  The Session consumes only game-local swing attempts derived from the
  immutable C0 Sports Motion snapshot.
- Validation: typecheck and lint pass; all 501 tests across 76 files pass;
  production build and `git diff --check` pass. Browser smoke verified the Home
  card, Badminton launch, countdown, opaque court, bilateral controls, a
  developer return, full result/replay lifecycle, and explicit production
  camera setup at the available local landscape viewport. Production coverage
  asserts explicit camera start, `UPPER_BODY`, no microphone, and no media
  request during render.
- Safety boundary: C0 swing thresholds, refractory behavior, snapshot
  semantics, Pose thresholds, Tennis, existing games, and the single Pose
  inference path remain unchanged. Badminton uses no RELEASE event, raw
  landmarks, camera objects, microphone, or sport-specific detector.
- Known risk: physical swing recognition, iPhone Safari, compact-space behavior,
  fatigue, projector readability, and sport-specific game-feel remain
  intentionally unvalidated.
- Next safest task: Batch C3 — Bowling. Reuse C0 through a new game-local
  Session/Core boundary; preserve C0's RELEASE deferral and do not refactor
  Tennis or Badminton into a generic racket framework.
