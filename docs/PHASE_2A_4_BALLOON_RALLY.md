# Phase 2A.4 — Balloon Rally v3

Status: v3 engineering implementation complete; Windows/iPhone physical gameplay
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

## Preserved v2 foundation

- 3-second countdown and 60-second active round.
- WARM UP/RALLY/FEVER population: 2/3/4 standard balloons at 0/15/35 seconds.
- Standard balloons have 2 HP. Each separated hit is `+1`; a second hit pops
  for another `+2`, so a completed standard balloon is worth four base points.
- At 50 seconds, PARTY RUSH converts all current balloons to Party balloons and
  maintains 5 targets from 50–55 seconds, 6 from 55–58 seconds, and 7 from
  58–60 seconds. Each Party hit pops immediately for two base points total
  (`+1` hit plus `+1` Party pop bonus).
- Ordinary balloons never expire and the result has no miss metric.
- Combo window is 1,500 ms outside Party Rush and 2,000 ms during Party Rush.
  Combo five or higher adds one score per accepted hit; `bestCombo` is shown in
  results.

## v3 gameplay additions

The standard 2-HP, 2/3/4 population, Combo, spatial contact, and Party Rush
foundation remains unchanged. v3 adds the following game-local rules:

- deterministic Golden Balloons: one normal concurrent, 1 HP, 3,500 ms lifetime,
  `+1` hit plus `+4` pop bonus;
- two deterministic Giant moments: #1 at 22 seconds (radius 96, 3 HP, five-
  second maximum lifetime, `+3` pop bonus) and #2 at 42 seconds (radius 112,
  4 HP, `+4` pop bonus); at most one Giant is active and unfinished Giants are
removed harmlessly before/at Party Rush;
- one seeded 6-second event between 27 and 33 seconds: GOLD_RUSH, BALLOON_RAIN,
  or SCORE_FEVER;
- standard movement personalities FLOAT, DRIFT, and BOUNCE with bounded initial
  motion;
- Combo milestone cues at 5 and each later multiple of 5;
- a Phaser-only cyan/amber Hand Glow Trail with 200 ms samples, 180 ms recovery
  fade, an 8 px emission threshold, and a 12-point cap per hand.

Party Rush removes all pre-Party special targets before maintaining its 5/6/7
1-HP targets. Event and special feedback is presentation-only except for the
explicit deterministic Core scoring rules. The existing `42` virtual-hand
radius and `10` logical-pixel tolerance remain unchanged.

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
adds Golden/Giant/Bonus styles, hit squash/rings, Combo milestone and event
cues, Party outline/pop treatment, the bounded Hand Glow Trail, and a short
PARTY RUSH cue with an edge pulse. The live HUD is score/time plus contextual
Combo only; results show score, hits, pops, and best Combo.

## Final game-feel pass

The final pass adds a gesture-unlocked, fail-silent local MP3 audio helper for
normal hit/pop, Golden sparkle, Giant feedback, Combo milestones, mini-event
start, Party Rush, countdown ticks, and round finish. Short SFX use decoded
`public/audio/balloon-rally/` buffers with bounded voices. One looping
`bgm.mp3` instance starts only when active PLAYING begins at gain `0.22`, rises
smoothly to `0.28` for Party Rush, and fades/stops at finish or exit. Production
HP dots are replaced with projector-readable vector damage: Standard HP 1 has
a thick crack; Giant HP 3/2/1 uses progressively heavier cracks; one-hit
targets stay clean. Party Rush remains capped at 420 logical px/s but escalates
to 5/6/7 targets at 50/55/58 seconds, uses a 2,000 ms Combo window, and shows
a non-blocking final 3/2/1 countdown while gameplay continues.

The shared Camera Presentation layer now shows a large, lower translucent
raised-arm human alignment silhouette rather than a stick figure. UPPER_BODY
shows a broad relaxed-W posture and FULL_BODY remains the whole-body variant.
Baseline guidance uses the compact copy `請對準人形範圍` plus `讓頭部、肩膀與雙手清楚可見，雙手保持在畫面內。`; the graphic remains
presentation-only and does not alter readiness or Pose logic. `SCORE_FEVER` is
the canonical mini-event spelling.

## Privacy and physical validation

No second camera/MediaPipe pipeline, persistence, raw landmark storage,
recording, network upload, analytics, microphone, or account data was added.

Required physical tests remain Windows Chrome and iPhone Safari landscape:
Golden/Giant/event readability, Hand Glow Trail smoothness, contact tolerance,
fast/held/re-entry behavior, one-hand continuity, brief/soft/hard tracking
recovery, progression and Party Rush, resize/orientation, 60-second stability,
replay, and projector readability. Phase 2A.3b remains Windows/iPhone physical
PASS for marker alignment; Phase 2A.3c remains engineering PASS only. No
physical PASS is claimed for v3.
