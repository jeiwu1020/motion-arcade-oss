# Motion Arcade — Current Phase

Updated: 2026-08-31

This file is the short live checkpoint. Long-term product and implementation order are canonicalized in [Master Implementation Plan](./MASTER_IMPLEMENTATION_PLAN.md).

## Current implementation baseline

Current implementation baseline before Phase 2A.2b:

`28cd9660aacfd1c7bfc96c165b5578677dca132b` — Phase 2A.2a production real-Pose Balloon Pop input

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
- Phase 2A.2b — reusable Camera Presentation Layer: engineering PASS; physical validation pending

## Product constraints reaffirmed

- Primary target is **smartphone landscape**.
- **Front camera** is the primary real-body sensor and should also support clear player framing / Camera AR presentation where appropriate.
- **Phone microphone** is the future voice-input sensor.
- Gameplay is expected to be shown on a **projector / large display**, so distance readability is a core requirement.
- The target is a mature exercise + entertainment product, not a collection of sensor demos.
- Legacy projects are gameplay references; new implementations must use the current normalized runtime architecture.

## Current phase

### Phase 2A.2b — Camera Presentation Layer

Engineering status: PASS. Physical Windows/iPhone/projector validation remains pending.

Implemented outcomes:

- shared `CameraPresentationStage` and pure state resolver live outside Balloon Pop;
- setup/baselining uses the mirrored camera as the dominant stage with a large
  full-body guide and obvious READY feedback;
- mirrored preview remains display-only; anatomical/canonical coordinates remain unchanged;
- production Phaser uses a transparent `1280 × 720` FIT projection above a
  subdued live camera, while the development/test renderer stays opaque;
- tracking loss makes camera/framing dominant while existing readiness freezes time;
- result keeps a healthy camera dimmed; replay reuses it; exit/unmount still disposes it;
- camera uses `object-fit: contain` to prevent confusing crop during positioning;
- the active landscape shell remains `100dvh`, safe-area padded, and overflow hidden.

Focused details: [Phase 2A.2b Camera Presentation Layer](./PHASE_2A_2B_CAMERA_PRESENTATION.md).

Automated validation:

- Typecheck: PASS
- Lint: PASS
- Tests: 213 / 213 PASS across 33 files
- Build: PASS
- Production browser QA at desktop and `852 × 393`: PASS
- `git diff --check`: PASS

Spatial wrist collision remains Phase 2A.3 and was not added.

## Immediately following phases

### Phase 2A.3 — Normalized Spatial Hand Interaction

- expose canonical normalized left/right hand positions without raw landmarks;
- include confidence/freshness and safe unavailable behavior;
- support previous/current motion segment or equivalent for swept fast-motion collision;
- preserve mirror semantics;
- use Pose wrists first; do not add full Hand Tracking unless evidence shows it is needed.

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

- Phase 2A.2b Camera Presentation Layer on Windows Chrome, including real
  framing, READY/lost states, retry, replay, and cleanup.
- iPhone Safari landscape: front-camera framing, safe areas/FIT, lifecycle, thermal behavior, projector readability.
- Real-person held-arm/repeat-hit behavior remains relevant until Balloon Pop is replaced by spatial contact.
- Previously deferred Phase 1D.3a/1D.3b physical profile checks remain open; later batch them in real games.

## Scope still deferred

- normalized spatial hand interaction until Phase 2A.3
- mature Balloon Rally physics until Phase 2A.4
- formal art/audio polish until Phase 2A.5
- gameplay calibration/profile selection
- multiplayer and multi-person Pose
- full Hand Tracking unless Pose wrist evidence requires it
- Voice input until the dedicated voice phase
- STRIKE / THROW / RUN / STEP / RUN_CADENCE unless a planned game requires them
- persistence, accounts, analytics
