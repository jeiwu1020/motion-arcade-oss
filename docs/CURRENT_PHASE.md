# Motion Arcade — Current Phase

Updated: 2026-09-11

This file is the short live checkpoint. Long-term product and implementation order are canonicalized in [Master Implementation Plan](./MASTER_IMPLEMENTATION_PLAN.md).

## Current implementation baseline

Current implementation baseline before Phase 2A.3a normalized spatial-hand work:

`daf872ed010eea7c5cece94a1d6652dcc7e6a802` — reusable Camera Presentation Layer

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

### Phase 2A.3a — Normalized Spatial Interaction Foundation

Engineering status: PASS; Windows/iPhone spatial-source validation remains
required before Phase 2A.3b.

This narrow phase exposes immutable anatomical left/right Pose-wrist positions
from the existing `PoseGameplayInputRuntime` without altering Motion Actions,
Balloon Pop, camera ownership, MediaPipe acquisition, or current FULL_BODY
readiness. Spatial points are camera-source-normalized, confidence/freshness
gated, and become coordinate-free unavailable on loss or lifecycle reset.

Object-fit/letterbox mapping, Phaser coordinates, cursors, swept collision, and
Balloon Rally gameplay remain deferred. Details:
[Phase 2A.3a Spatial Foundation](./PHASE_2A_3A_SPATIAL_FOUNDATION.md).

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

## Framing direction for upcoming games

The current Balloon Pop route still uses STANDARD/full-body readiness because that is the existing production Pose path. This must not become a universal game requirement.

Planned framing requirements:

- `FULL_BODY` — games whose rules need lower-body movement or whole-body position, such as JUMP, SQUAT, running, lane movement, or leg interaction;
- `UPPER_BODY` — games centered on arms/hands/reach/voice where knees and ankles add no gameplay value;
- add a broader flexible mode only if real games demonstrate a need; do not speculate early.

The framing guide, Pose readiness requirement, and player setup copy should eventually derive from the selected game's framing requirement. Balloon Rally is a strong candidate for `UPPER_BODY` once the spatial-hand path is implemented and physically validated.

## Immediately following phases

### Phase 2A.3b — Spatial display/playfield mapping

- map the Phase 2A.3a canonical source points into the mirrored `object-fit:
  contain` presentation rectangle;
- account for letterbox/pillarbox offsets before Phaser/game-space collision;
- introduce only the framing/readiness selection required by the first
  UPPER_BODY spatial game;
- add previous/current segments only when swept collision is ready to consume
  them; keep Pose wrists until evidence requires full Hand Tracking.

### Phase 2A.4 — Balloon Rally gameplay rewrite

- Camera AR gameplay;
- multiple persistent floating balloons;
- spatial hand contact rather than LEFT/RIGHT-only target events;
- every valid separated hit scores and gives the balloon an arcade impulse;
- ordinary balloon takes multiple hits (initial target ~3) before popping;
- pop gives bonus;
- controlled difficulty escalation and final Party Rush;
- stable arcade physics over physically exact simulation.

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
- Real-person held-arm/repeat-hit behavior remains relevant until Balloon Pop is replaced by spatial contact.
- Previously deferred Phase 1D.3a/1D.3b physical profile checks remain open; later batch them in real games.

## Scope still deferred

- spatial display/playfield mapping and collision until Phase 2A.3b
- mature Balloon Rally physics until Phase 2A.4
- formal art/audio polish until Phase 2A.5
- gameplay calibration/profile selection
- multiplayer and multi-person Pose
- full Hand Tracking unless Pose wrist evidence requires it
- Voice input until the dedicated voice phase
- STRIKE / THROW / RUN / STEP / RUN_CADENCE unless a planned game requires them
- persistence, accounts, analytics
