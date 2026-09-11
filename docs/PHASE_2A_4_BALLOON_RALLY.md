# Phase 2A.4 — Balloon Rally v2

Status: engineering implementation complete; Windows/iPhone physical gameplay
validation remains required.

## Architecture

```text
same PoseSensorSession → SpatialHandSnapshot → SpatialCollisionInputAdapter
                     → BalloonRallySession → pure BalloonRallyCore → Phaser
```

`BalloonRallyCore` is deterministic and owns round time, progression, balloon
state, HP, scoring, Combo, Party Rush, bounded physics, and RNG state.
`BalloonRallySession` owns only transient normalized logical-hand contact and
active-game tracking orchestration. Phaser reconciles immutable Core state and
has no score, collision, Pose, camera, DOM, or MediaPipe authority.

## v2 rules

- 3-second countdown and 60-second active round.
- WARM UP/RALLY/FEVER population: 2/3/4 standard balloons at 0/15/35 seconds.
- Standard balloons have 2 HP. Each separated hit is `+1`; a second hit pops
  for another `+2`, so a completed standard balloon is worth four base points.
- At 50 seconds, PARTY RUSH converts all current balloons to Party balloons
  and maintains five 1-HP targets. Each Party hit pops immediately for two base
  points total (`+1` hit plus `+1` Party pop bonus).
- Ordinary balloons never expire and the result has no miss metric.
- Combo window is 1,500 ms. Combo five or higher adds one score per accepted
  hit; `bestCombo` is shown in results.

## Tracking and interaction

Balloon Rally requests `UPPER_BODY`: setup still requires a stable torso/core
baseline and READY quality, but knees and ankles are not required. FULL_BODY
behavior for other games remains unchanged.

Once play begins, tracking follows START STRICT / PLAY RELAXED:

- 0–1,500 ms ordinary degradation: timer and physics continue without a
  blocking overlay.
- 1,500–3,000 ms: freeze Core time and physics; reset contact continuity and
  show only `雙手回到畫面即可繼續`.
- >=3,000 ms or a sensor/runtime failure: remain safely paused with the
  existing dominant recovery presentation.

One missing wrist never pauses the round; the available wrist can continue to
interact. The session uses swept circles with a visible radius of 68, virtual
hand radius of 42, and additional tolerance of 10 logical pixels. Wrist
unavailability still breaks continuity; v2 does not synthesize a dropout bridge.

## Physics and presentation

Balloons remain inside the camera-visible logical region. Standard speed caps
at 360 px/s and Party speed caps at 420 px/s. Bounded segment-directed impulses,
wall rebound, and a small outer-band-only anti-corner acceleration keep the
playfield active without centre magnetism.

Production no longer shows diagnostic markers or the collision probe. Phaser
adds hit squash/rings, Party outline/pop treatment, and a short PARTY RUSH cue
with an edge pulse. The live HUD is score/time plus contextual Combo only;
results show score, hits, pops, and best Combo.

## Privacy and physical validation

No second camera/MediaPipe pipeline, persistence, raw landmark storage,
recording, network upload, analytics, microphone, or account data was added.

Required physical tests remain Windows Chrome and iPhone Safari landscape:
contact tolerance, fast/held/re-entry behavior, one-hand continuity, brief/soft
/hard tracking recovery, progression and Party Rush, resize/orientation,
60-second stability, replay, and projector readability. Phase 2A.3b remains
Windows/iPhone physical PASS for marker alignment; Phase 2A.3c remains
engineering PASS only.
