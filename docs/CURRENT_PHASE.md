# Motion Arcade — Current Phase

Updated: 2026-09-11

This file is the short live checkpoint. Long-term product and implementation order are canonicalized in [Master Implementation Plan](./MASTER_IMPLEMENTATION_PLAN.md).

## Current implementation baseline

Current implementation baseline for the final Balloon Rally UX / variety pass:

`b70e72b32ed1e162328fe31981bf481eeb2aa9d7` — Balloon Rally v3 game-feel baseline

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

### Phase 2A.4 — Balloon Rally v3 / final game-feel pass

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

## Immediately following phases

### Phase 2A.5 — game feel + device validation

- art / animation / particles / audio polish after interaction works;
- Windows + iPhone Safari landscape + projector physical validation;
- then batch adaptive-profile gameplay validation.

## Planned game sequence after Balloon Rally

1. Reaction Challenge / 光速反應王 successor — prove Motion Actions across another Game Core.
2. Runner / 磚塊衝刺 successor — action-driven avatar and lane/jump/squat gameplay.
3. Rhythm exploration — after latency characteristics are known.
4. Voice foundation + Vocal Hop / Voice Cannon successors — phone microphone, normalized volume/pitch.
5. Expanded adaptive modes / multiplayer only after several stable single-player games exist.

Detailed migration rationale and Definition of Done live in `MASTER_IMPLEMENTATION_PLAN.md`.

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
