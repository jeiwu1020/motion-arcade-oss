# Motion Arcade — Current Phase

Updated: 2026-08-31

This file is the short live checkpoint. Long-term product and implementation order are canonicalized in [Master Implementation Plan](./MASTER_IMPLEMENTATION_PLAN.md).

## Current implementation baseline

Current `main` implementation baseline before this docs-only roadmap update:

`28cd9660aacfd1c7bfc96c165b5578677dca132b` — Phase 2A.2a production real-Pose Balloon Pop input

Use current `main` as the working baseline unless a task explicitly pins another SHA. Docs-only commits may follow the implementation baseline without changing runtime behavior.

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

## Product constraints reaffirmed

- Primary target is **smartphone landscape**.
- **Front camera** is the primary real-body sensor and should also support clear player framing / Camera AR presentation where appropriate.
- **Phone microphone** is the future voice-input sensor.
- Gameplay is expected to be shown on a **projector / large display**, so distance readability is a core requirement.
- The target is a mature exercise + entertainment product, not a collection of sensor demos.
- Legacy projects are gameplay references; new implementations must use the current normalized runtime architecture.

## Current physical finding

The first real-person test of Phase 2A.2a found an important usability problem:

- the production game can start the front camera/Pose path, but the player does not have a sufficiently usable visible front-camera presentation for positioning/framing;
- this makes full-body baseline setup inconvenient even though the sensing pipeline itself is present.

Therefore Phase 2A.2a remains **Engineering PASS / Physical UX incomplete**, and the next step is not more detector expansion.

## Current phase

### Phase 2A.2b — Camera Presentation Layer

Goal: make the front camera a reliable, reusable player-facing presentation layer for production gameplay.

Required outcomes:

- setup/baselining uses a large or full-screen mirrored camera preview;
- player can clearly adjust body position and understand whether the usable body area is in frame;
- add framing guidance and obvious READY feedback suitable for projected display;
- mirrored preview remains display-only; anatomical/canonical coordinates remain unchanged;
- active gameplay keeps the player visible through an intentional Camera AR composition rather than hiding the feed;
- tracking-lost state prioritizes recovery/framing guidance while game time remains frozen;
- result/replay/exit retain correct camera lifecycle and cleanup;
- implementation should be reusable by later Camera AR games, not a Balloon Pop-only visual patch;
- phone landscape/safe-area/projector readability are acceptance requirements.

Do not add spatial wrist collision in this same phase unless it is strictly required for camera presentation. Spatial interaction is Phase 2A.3.

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

- Phase 2A.2b Camera Presentation Layer on Windows Chrome.
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
