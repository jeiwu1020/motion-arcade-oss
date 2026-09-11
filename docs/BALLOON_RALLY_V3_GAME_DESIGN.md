# Motion Arcade — Balloon Rally v3

Status: engineering implementation; Windows/iPhone physical gameplay validation remains required.

## Boundary

Balloon Rally v3 keeps the validated v2 path unchanged:

```text
Camera / Pose → SpatialHandSnapshot → SpatialCollisionInputAdapter
              → BalloonRallySession → pure BalloonRallyCore → Phaser
```

The shared Pose, spatial, camera, and tracking architecture was not changed.
The game still starts with strict `UPPER_BODY` setup, then uses the existing
one-hand-friendly `1,500 ms` degraded / `3,000 ms` hard recovery policy. The
existing virtual-hand collision radius (`42`) and tolerance (`10`) remain the
only gameplay hitbox changes; the glow is cosmetic.

## Standard rally

The round remains a 3-second countdown followed by a 60-second active round.
The standard population is 2 balloons from 0–15 seconds, 3 from 15–35, and 4
from 35–50. Standard balloons have 2 HP: each separated contact is `+1` and
the second contact pops the balloon for a `+2` pop bonus. Ordinary balloons do
not expire and there is no miss or penalty mechanic.

All gameplay randomness uses the Core's seeded RNG. Standard balloons receive
one of three deterministic movement personalities:

- `FLOAT`: 70–95 px/s calm drift;
- `DRIFT`: 80–112 px/s with a stronger horizontal bias;
- `BOUNCE`: 70–120 px/s livelier all-direction drift.

All remain bounded by the existing 360 px/s ordinary cap, wall reflection, and
the small outer-band anti-corner steering.

## Golden Balloon

Golden targets are an additional target, not part of the standard population.
The first deterministic schedule is between 8 and 12 seconds; later schedules
are 8–12 seconds apart while the round is not in Party Rush. At most one
normal Golden Balloon is present. It has radius 68, 1 HP, a 3,500 ms lifetime,
and no expiry penalty. A valid contact gives one hit and one Combo advance,
then immediately pops for a `+4` bonus (`5` base points total).

Golden Rush may temporarily allow two Golden targets and uses its separate
event spawn cap described below. Normal Golden spawning stops at Party Rush.

## Giant Balloon

Exactly one Giant Balloon is scheduled at 40 seconds, during FEVER and before
Party Rush. It is an additional target with radius 112, 4 HP, and a slower
55–90 px/s initial drift. Each separated contact gives `+1` and advances
Combo; the fourth contact pops it for a `+4` bonus (`8` base points total).
An unfinished Giant is removed without penalty at Party Rush.

## Combo and milestones

The authoritative v2 Combo rules remain: a valid hit opens or refreshes a
1,500 ms window, the next hit inside the window increments Combo, and the
timer freezes whenever the round itself is frozen. Combo 5 and above keeps the
existing `+1` per-hit score bonus. Presentation emits one short milestone cue
when crossing 5, 10, 15, 20, 25, and later multiples of 5. The cues are
`5 COMBO!`, `SUPER COMBO!` at 10, and numbered cues thereafter; milestones do
not change scoring.

## One seeded mini-event

One event is selected at round creation and starts deterministically between
27 and 33 seconds for 6,000 ms. It always finishes before the Giant/Party
sequence becomes crowded.

- `GOLD_RUSH`: up to two concurrent Golden targets and at most four Golden
  spawns during the event. Popped targets can be replaced while the cap is
  available. Remaining event Golden targets are removed at event end.
- `BALLOON_RAIN`: up to two concurrent 1-HP `BONUS` targets and at most six
  event spawns. Each hit pops for `+1` plus a `+1` bonus (`2` base points).
  Remaining Bonus targets are removed at event end.
- `SCORE_FEVER`: no extra targets. Every accepted hit receives `+1` event
  score while the event is active, including Golden and Giant hits. Combo is
  independent.

The event title and edge atmosphere pulse are short Phaser-only presentation;
they do not block the camera or enter Core scoring beyond the explicit rules.

## Party Rush

Party Rush still begins at 50 seconds, replaces all pre-Party specials, and
maintains 5 1-HP Party targets from 50–55 seconds, 6 from 55–58 seconds, and 7
from 58–60 seconds with immediate replacement. A Party contact
scores `+1`; the pop adds the existing `+1` Party bonus. Party movement uses
the existing 420 px/s cap and stronger climax cue. The Hand Glow Trail remains
active.

## Hand Glow Trail

The Phaser scene uses the same logical hand positions already consumed by
collision. Left is cyan and right is amber. Each available hand has a bright
approximately 30 px core and 48 px soft halo; movement samples are added only
after 8 logical pixels of travel. Trails live for 200 ms and are capped at 12
points per hand. When a hand becomes unavailable, emission stops immediately
and existing points fade over 180 ms; no coordinate is synthesized. Soft or
hard recovery naturally fades both effects. The bounded Graphics-based effect
does not enter Core state, hitboxes, score, Combo, or the shared spatial
contract.

## Production and validation

Engineering diagnostics (wrist labels, collision probes, confidence numbers)
remain debug-only and are not part of production Balloon Rally. Camera start
still requires the explicit user action. No persistence, analytics, network
upload, audio architecture, Hands model, palm estimation, or gameplay hazards
were added.

Required physical validation remains Windows Chrome and iPhone Safari in
landscape: Golden/Giant/event readability, glow/trail smoothness, contact and
re-entry behavior, one-hand continuity, 1,500/3,000 ms recovery, Party Rush,
resize/orientation, replay determinism, 60-second stability, and projector
readability. No physical PASS is claimed here.
