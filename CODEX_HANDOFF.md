# Motion Arcade Handoff

- Phase: Portfolio Batch Build — Batch E Baseball.
- Status: Baseball has an `ENGINEERING PASS` and is `PHYSICAL QA PENDING`.
  It is a deterministic, batting-only 60-second game consuming strictly newer
  retained C0 left/right swing events through a game-local Session. The Core
  owns pitch timing, contact, fictional hit results, score, stats, and replay;
  Phaser renders an opaque procedural stadium and HOME RUN RUSH.
- Validation: typecheck, lint, all 657 tests across 110 files, production build,
  and `git diff --check` pass. DEV completed a full 60-second 852×393 landscape
  round with bilateral controls, hit/miss, HOME RUN, result, and replay. The
  production build shows an explicit camera button and complete `UPPER_BODY`
  setup at 852×393 with no page overflow, microphone, or console errors.
- Safety boundary: no new swing, bat, two-hand, release, or pitching detector;
  C0 Sports Motion, D0 Locomotion, Pose/JUMP thresholds, camera lifecycle,
  registry schema, and existing game behavior remain unchanged. Production is
  explicit-start `UPPER_BODY` Pose with no Hands or microphone. No physical bat
  is required and no real bat-speed or power claim is made.
- Known risk: physical empty-hand swing recognition, timing tolerance,
  compact-space comfort, fatigue, recovery, iPhone Safari, and projector
  readability remain unvalidated. No Physical PASS is claimed.
- Next safest task: Batch F0 — Voice Input Foundation. Keep microphone
  permission explicit and lifecycle ownership isolated to requesting games.
