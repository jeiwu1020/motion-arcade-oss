# Motion Arcade Handoff

- Phase: Portfolio Batch Build — Batch D2 Swimming.
- Status: D2 has an `ENGINEERING PASS` and is `PHYSICAL QA PENDING`. Swimming is
  a deterministic 60-second four-swimmer standing arcade race. Its game-local
  cycle consumes retained C0 LEFT/RIGHT Sports Motion events, accepts only
  alternating strokes, and derives bounded rhythm/intensity propulsion with
  explicit decay. Existing C0 was sufficient; no shared arm-cycle detector was
  added. Production reuses the one Pose pipeline with explicit `UPPER_BODY`
  setup; Hands and microphone are not required. Developer Test Mode remains
  camera-free through `SportsMotionTestProvider`.
- Validation: final typecheck, lint, test, production build, diff check, and
  landscape browser smoke are recorded in the completion report.
- Safety boundary: C0 Sports Motion thresholds/semantics, D0 Locomotion, Pose
  thresholds, JUMP/SQUAT, camera lifecycle, registry schema, and existing games
  remain unchanged. No shared detector, second inference path, raw Pose game
  dependency, or microphone path was added.
- Known risk: physical standing arm-cycle recognition, iPhone Safari,
  compact-space variation, fatigue, recovery, and projector use remain
  unvalidated. No Physical PASS is claimed.
- Next safest task: Batch D3 — High Jump. Preserve the existing normalized JUMP
  contract and do not reopen shared thresholds without physical evidence.
