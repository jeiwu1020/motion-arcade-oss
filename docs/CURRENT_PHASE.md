# Motion Arcade — Current Phase

Updated: 2026-09-14

This file is the short live checkpoint. Long-term product and architecture are
canonicalized in [Master Implementation Plan](./MASTER_IMPLEMENTATION_PLAN.md),
and the current game/batch order is canonicalized in
[Full Game Portfolio Plan v1](./FULL_GAME_PORTFOLIO_PLAN.md).

## Current implementation baseline

Current implementation baseline at the Batch Build Mode transition:

`d4455aca3d5eb06e641a13ca2a1cd66e47bdd9e8` — frozen Balloon Rally and Reaction Arena engineering baseline

Batch A Runner implementation started from:

`ca626bd00d084cfabf8029656216c4fe37baceb0`

Use current `main` as the working baseline unless a task explicitly pins another SHA.

## Validated milestones

- Phase 1A — normalized motion contracts / adaptive profiles / test input: PASS
- Phase 1B — camera + MediaPipe Pose sensor pipeline: engineering + physical iPhone PASS
- Phase 1C — Pose Motion Analyzer: MOVE / LEAN / REACH / SQUAT / JUMP: engineering + real-person PASS
- Phase 1D.1 — guided calibration flow: engineering + real-person PASS
- Phase 1D.2 — calibration-driven adaptation: engineering + real-person PASS
- Phase 1D.3a — LOW_MOTION / SLOW_RESPONSE composition: engineering PASS; physical checks deferred
- Phase 1D.3b — SEATED / UPPER_BODY Pose: engineering PASS; physical checks deferred
- Phase 2A.1 — deterministic Balloon Pop through normalized test input: PASS
- Phase 2A.2a — production real-Pose route/runtime: engineering PASS
- Phase 2A.2b — reusable Camera Presentation Layer: engineering PASS; Windows + iPhone functional physical checks PASS; camera brightness retest and projector check pending

## Product constraints reaffirmed

- Primary target is **smartphone landscape**.
- **Front camera** is the primary real-body sensor and should also support clear player framing / Camera AR presentation where appropriate.
- Camera AR should keep the player visibly present; do not darken the live image so heavily that the AR effect is lost.
- **Phone microphone** is the future voice-input sensor.
- Gameplay is expected to be shown on a **projector / large display**, so distance readability is a core requirement.
- Body-framing requirements are **game-specific**. Do not require full-body framing when a game only needs upper-body/arm interaction.
- The target is a mature exercise + entertainment product, not a collection of sensor demos.
- Legacy projects are gameplay references; new implementations must use the current normalized runtime architecture.

## Current phase

### PORTFOLIO BATCH BUILD

Runner / 跑酷衝刺 has completed its `ENGINEERING PASS` and is now
`PHYSICAL QA PENDING`. Its deterministic three-lane Core, normalized Session,
Developer Test Mode, procedural Phaser presentation, and explicit-permission
`FULL_BODY` `STRICT` production Pose route are recorded in
[Batch A — Runner / Avatar Action](./PHASE_BATCH_A_RUNNER.md).

Current next implementation: **Batch B — Rhythm Motion**.

The portfolio will be built to Engineering Prototype PASS before the separate
physical QA/tuning sweep. Runner, Balloon Rally, and Reaction Arena are
`PHYSICAL QA PENDING`; none has a claimed `PHYSICAL PASS`.

Batch Build Mode rules:

- do not block later games on an earlier game's pending physical detector
  tuning;
- do not reopen the two frozen games unless shared work creates a regression;
- do not tune shared Pose/audio thresholds for one unvalidated game;
- schedule shared sensor changes as explicit foundation batches;
- keep games behind normalized input contracts and preserve explicit sensor
  permission/lifecycle boundaries.

Canonical order: A Runner → B Rhythm → C0 Sports Toolkit → C1 Tennis → C2
Badminton → C3 Bowling → D0 Locomotion Toolkit → D1 Running Race → D2
Swimming → D3 High Jump → D4 Long Jump Challenge → E Baseball → F0 Voice
Foundation → F1 Vocal Hop → F2 Sound Cannon → G0 Multiplayer Foundation → G1
Two-Player Dodge Duel → portfolio physical QA sweep → production polish.

## Frozen game baselines and historical phase record

### Batch A — Runner / Avatar Action

Engineering status: PASS. The 60-second three-lane Runner is registered and
launchable through production and Developer Test routes. Its pure Core owns the
seeded obstacle course, action clocks, collision rules, scoring, pacing, and
stable results. Session consumes only new normalized action sequences and
pauses Core time outside `READY`. Production uses the existing Pose/runtime and
Camera Presentation layers with explicit permission, `FULL_BODY` framing,
default `STRICT` readiness, and no microphone. Shared Pose thresholds and the
two earlier games are unchanged. Windows/iPhone compact-space and projector
physical validation remain open.

### Phase 2B — Reaction Arena v1 / 光速反應王

Engineering status: normalized-action production vertical slice implemented;
Windows/iPhone physical validation remains required. Reaction Arena uses
FULL_BODY setup, the existing Motion Action contract, and a deterministic
60-second cue/grade/Combo core. It does not change Balloon Rally or shared Pose
runtime behavior. The known Windows Chrome 「正在啟動相機」 observation remains
record-only and is deferred to a shared lifecycle investigation.

FULL_BODY readiness now has bounded temporal stability: a valid baseline keeps
its real-sample progress through up to 350 ms of transient lower-body validity
loss, and the running runtime keeps READY through up to 1000 ms of diagnostic
fluctuation. These windows do not lower landmark confidence, alter action
thresholds, or preserve stale actions; sustained loss still follows the normal
TRACKING_LOST path. Physical validation of the stability improvement remains
open.

Reaction Arena's compact-space Pose pass is engineering implemented. It retains
`FULL_BODY` but opts into typed `KNEES` readiness: shoulders, hips, and both
knees remain required at the global `0.55` threshold while ankles may be
absent. Default `STRICT` FULL_BODY games and Balloon Rally's UPPER_BODY path
are unchanged. Reaction Arena uses existing LOW_MOTION, accepts MOVE or LEAN
for directional cues, uses bounded compact reach and hip-led squat behavior,
and provides a selected-12-joint in-memory Pose skeleton for setup/Practice.
Windows/iPhone compact-space validation remains open.

Balloon Rally remains the validated Phase 2A production reference:

Engineering status: v3 gameplay/presentation implementation complete; final
MP3-audio and Camera Presentation guide pass is engineering complete.
Windows/iPhone physical gameplay, audio, and framing validation remains
required.

Production 氣球拍拍樂 now uses deterministic 3-second/60-second Balloon Rally
v3 rules: 2→3→4 standard 2-HP balloons at 0/15/35 seconds, seeded Golden,
two separated Giant reward moments at 22/42 seconds, one six-second mini-event,
then a distinct 5→6→7 target 1-HP PARTY RUSH at 50/55/58 seconds. Separated spatial
hand contacts, bounded arcade
impulses, immediate replacement, Combo, and result metrics remain authoritative
in `BalloonRallyCore`; Phaser renders immutable state only. A bounded production
Hand Glow Trail uses the same logical interaction points and remains cosmetic.
Local MP3 SFX are gesture-unlocked and fail-silent; a single local BGM instance
is limited to the active round, and finish layers the Victory Fanfare with a
delayed crowd cheer. The shared setup/recovery guide uses a large lower raised-
arm UPPER_BODY or FULL_BODY human alignment silhouette and remains presentation-
only.

Balloon Rally explicitly opts into UPPER_BODY readiness: a stable torso/core
baseline and READY quality remain required, while knees/ankles are not. After
the round begins, `BalloonRallySession` uses the v2 relaxed tracking policy:
 0–3,000 ms degradation continues play, 3,000–6,000 ms uses a small continuing
 soft recovery, and >=6,000 ms or sensor failure uses hard recovery. This policy
is scoped to Balloon Rally; FULL_BODY games remain unchanged.
Phase 2A.3b is Engineering PASS + Windows Chrome physical PASS + iPhone Safari
physical PASS. Phase 2A.3c remains Engineering PASS only. Details:
[Balloon Rally v2 design](./BALLOON_RALLY_V2_GAME_DESIGN.md), [Balloon Rally v3
design](./BALLOON_RALLY_V3_GAME_DESIGN.md), and [Phase 2A.4 Balloon Rally](./PHASE_2A_4_BALLOON_RALLY.md) contain details.

### Prior Phase 2A.2b — Camera Presentation Layer physical-feedback tuning

Engineering status: PASS. Windows and iPhone functional testing found no blocking behavior. Physical feedback identified one presentation issue: gameplay camera treatment was too dark for the intended AR feeling.

Current tuning:

- setup/baselining camera treatment is close to the original live-image brightness;
- active Camera AR remains slightly treated for HUD/game-object contrast, but the player stays clearly visible;
- scrim strength is reduced rather than hiding the live image;
- mirror behavior remains CSS/display-only and sensor semantics are unchanged.

Implemented outcomes retained:

- shared `CameraPresentationStage` and pure state resolver live outside Balloon Pop;
- setup/baselining uses the mirrored camera as the dominant stage with a large full-body guide and obvious READY feedback;
- production Phaser uses a transparent `1280 × 720` FIT projection above the camera;
- tracking loss makes camera/framing dominant while existing readiness freezes time;
- result keeps a healthy camera dimmed; replay reuses it; exit/unmount still disposes it;
- camera uses `object-fit: contain` to prevent confusing crop during positioning;
- the active landscape shell remains `100dvh`, safe-area padded, and overflow hidden.

Focused details: [Phase 2A.2b Camera Presentation Layer](./PHASE_2A_2B_CAMERA_PRESENTATION.md).

Automated validation for the underlying 2A.2b implementation:

- Typecheck: PASS
- Lint: PASS
- Tests: 213 / 213 PASS across 33 files
- Build: PASS
- Production browser QA at desktop and `852 × 393`: PASS
- `git diff --check`: PASS

## Framing direction

Balloon Rally is the first production UPPER_BODY game. Existing FULL_BODY games
remain on the default readiness path.

Planned framing requirements:

- `FULL_BODY` — games whose rules need lower-body movement or whole-body position, such as JUMP, SQUAT, running, lane movement, or leg interaction;
- `UPPER_BODY` — games centered on arms/hands/reach/voice where knees and ankles add no gameplay value;
- add a broader flexible mode only if real games demonstrate a need; do not speculate early.

The framing guide, Pose readiness requirement, and player setup copy derive
from the selected game's framing requirement.

## Superseded pre-batch next-phase note

The following Phase 2A.5 note is preserved as historical planning context. Its
physical work now belongs to the portfolio-wide physical QA sweep rather than
blocking Batch A.

### Phase 2A.5 — game feel + device validation

- art / animation / particles / audio polish after interaction works;
- Windows + iPhone Safari landscape + projector physical validation;
- then batch adaptive-profile gameplay validation.

## Portfolio batch sequence

1. A — Runner / Avatar Action (`ENGINEERING PASS`; `PHYSICAL QA PENDING`).
2. B — Rhythm Motion (next implementation).
3. C0–C3 — Sports Motion Toolkit, Tennis, Badminton, Bowling.
4. D0–D4 — Locomotion Toolkit, Running Race, Swimming, High Jump, Long Jump Challenge.
5. E — Baseball batting.
6. F0–F2 — Voice Input Foundation, Vocal Hop, Sound Cannon.
7. G0–G1 — Multiplayer Foundation, then Two-Player Dodge Duel.
8. Portfolio-wide physical QA sweep, then production polish.

Detailed game briefs, model allocation, shared-foundation dependencies, and the
Engineering Prototype PASS contract live in
[Full Game Portfolio Plan v1](./FULL_GAME_PORTFOLIO_PLAN.md).

## Manual / physical testing still open

- Brief Windows/iPhone retest after the brighter Camera AR treatment to confirm player visibility and game-object/HUD contrast.
- Projector: framing-guide visibility, live-player visibility, camera/game contrast, HUD readability, and result/recovery comprehension from the intended viewing distance.
- Balloon Rally v3 Windows/iPhone: Golden/Giant/mini-event readability, hand
  glow/trail performance, virtual-hand contact tolerance, fast/held/
  re-entry semantics, one-hand continuity, 3/6-second tracking recovery,
  progression/PARTY RUSH, resize/orientation, 60-second stability, replay, and
  upper-body framing checks; projector validation remains required.
- Previously deferred Phase 1D.3a/1D.3b physical profile checks remain open; later batch them in real games.

## Scope still deferred

- further art/audio polish beyond the supplied MP3 and silhouette pass
- gameplay calibration/profile selection
- multiplayer and multi-person Pose
- full Hand Tracking unless Pose wrist evidence requires it
- Voice input until the dedicated voice phase
- STRIKE / THROW / RUN / STEP / RUN_CADENCE unless a planned game requires them
- persistence, accounts, analytics
