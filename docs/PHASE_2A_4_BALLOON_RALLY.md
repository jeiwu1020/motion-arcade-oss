# Phase 2A.4 — Balloon Rally v1

Status: engineering implementation complete; Windows/iPhone physical gameplay validation required

## Architecture

Production 氣球拍拍樂 now runs a deterministic 60-second Camera AR Balloon
Rally slice:

```text
same PoseSensorSession → SpatialHandSnapshot → SpatialCollisionInputAdapter
                     → BalloonRallySession → pure BalloonRallyCore → Phaser
```

`BalloonRallySession` alone consumes logical hand samples. It reuses the
existing swept-circle contact tracker per anatomical hand and balloon, turns
valid contact into bounded impulse events, and advances immutable Core state.
Phaser reconciles Core state only; it receives no Pose landmarks, camera, DOM,
or collision authority.

## Rules and tuning

- 3-second countdown, 60-second active round.
- Population is 2 balloons from 0–20 seconds, 3 from 20–40, and 4 from 40–60.
- Ordinary balloons persist until popped, have 3 HP, score `+1` and one hit per
  separated contact, then pop on the third hit for another `+2` score.
- Popped balloons are immediately replaced. There are no ordinary expiry misses.
- Final 10 seconds is PARTY RUSH: existing balloons receive one bounded 1.22x
  speed boost; HP and scoring remain unchanged.
- Core radius is 68 logical units; spawn drift is 70–120 px/s; ordinary max
  speed is 360 px/s; Party Rush max is 420 px/s. Visual radius and a 24-unit
  contact padding are independent.

The camera-visible logical rectangle is authoritative. Without a valid region,
Core time, physics, and contacts freeze. Resize clamps only balloons that are
outside the changed region and physics reflects them at the boundary. A segment
direction gives the primary impulse; a bounded center-relative fallback avoids
zero-motion contact ambiguity.

## Framing and diagnostics

Balloon Rally explicitly requests `UPPER_BODY`: READY still needs good Pose
quality and a stable torso/core baseline, but knees and ankles are not needed.
FULL_BODY remains the default for existing games. Setup/recovery copy and the
guide now ask for head, shoulders, and hands with room to wave.

Production does not enable Phase 2A.3b wrist markers or the Phase 2A.3c probe.
The previous keyboard target loop remains a DEV-only test path; Rally Core and
session tests are camera-free and deterministic. A richer spatial-pointer test
surface is intentionally deferred.

## Privacy and deferred work

No camera stream, MediaPipe task, network call, persistence, recording,
analytics, microphone, raw landmark storage, or account data was added.
Special balloons, combos, multiplayer, premium art/audio, and Hands Landmarker
remain deferred.

## Manual validation required

### Windows Chrome

1. Start the camera, confirm UPPER_BODY guide/READY at a closer stance.
2. Verify 2→3→4 balloons at 20/40 seconds, visible only over camera imagery.
3. Fast-pass, hold, leave/re-enter with each hand; confirm one score per entry,
   independent hands, visible HP, third-hit pop/replacement, and bounded impulse.
4. Verify PARTY RUSH cue in final 10 seconds and unchanged 3-HP rules.
5. Test tracking loss, wrist occlusion, browser resize, result, replay, and no
   diagnostic labels/probe or second permission request.

### iPhone Safari landscape

1. Repeat contact, anatomical-side, held/re-entry, pop, and recovery checks.
2. Rotate/reopen and exercise browser chrome changes; verify alignment,
   interaction-region recovery, safe-area HUD, and 60-second stability.
3. Check projection readability when the final projector setup is available.

No Phase 2A.4 physical PASS is claimed. Phase 2A.3b marker alignment remains
Windows/iPhone physical PASS; Phase 2A.3c collision remains engineering PASS.
