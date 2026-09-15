# Batch F1 — Vocal Hop / 聲控跳跳樂

## Engineering status

`ENGINEERING PASS` · `PHYSICAL QA PENDING`

Vocal Hop is a bounded single-player, side-scrolling arcade game. It is fully
playable in Developer Test Mode and has a production microphone route, but
microphone recognition, timing, fatigue, compact-space, iPhone Safari, and
projector behavior still require the portfolio physical QA sweep. Engineering
pass is not a Physical PASS.

## Game contract

The Core consumes only a small game-local input derived by `VocalHopSession`:

- `triggerSequence`: a newer F0 `VOICE_TRIGGER` occurrence starts one hop when
  the avatar is grounded;
- `liftLevel`: a bounded 0..1 value derived from F0 `VOICE_LEVEL`;
- `sustainedDurationSeconds`: bounded 0..4 seconds for optional visual/star
  feedback. It is never required for ordinary obstacle clearing.

No raw MotionInputProvider state, microphone object, PCM, MediaStream, audio
context, or browser API reaches Core. `VOICE_PITCH` is deliberately not
requested or read.

## Comfortable voice mapping

F1 does not reward maximum loudness linearly. The exact game-local mapping is:

```text
usableLevel = clamp01((VOICE_LEVEL - 0.10) / (0.55 - 0.10))
liftLevel = sqrt(usableLevel)
```

Thus levels at or below 0.10 produce zero extra lift, 0.55 and above are
saturated at one, and moderate comfortable sound reaches useful lift quickly.
Player copy says a clear, comfortable sound is enough; it never asks the player
to shout.

## Hop physics

The pure deterministic Core uses fictional normalized units: positive vertical
position is down and ground is zero.

- gravity: `+2.35 units/s²`;
- launch velocity: `-1.05 units/s`;
- voice boost window: first `500 ms`;
- maximum boost acceleration: `-1.45 units/s² * liftLevel`;
- maximum airborne duration: `1500 ms`;
- stumble recovery: `500 ms`.

Voice level cannot create indefinite flight. A retained trigger is consumed once;
triggers while airborne or recovering are ignored rather than stacked.

## Course and fairness

The seeded course starts with `LOW_BLOCK`, `LOW_BLOCK`, `GAP`, `HIGH_BLOCK` so
the warm-up teaches the basic hop. It then uses deterministic bounded variety
with optional `STAR_GATE` bonuses. Encounter spacing is 2600 ms (WARM_UP),
2200 ms (HOP_RUN), 1900 ms (SKY_PATH), and 1700 ms (FINAL_HOP); 1700 ms is the
hard minimum. There are no overlapping simultaneous requirements. Required
obstacles resolve as a clear or safe stumble; a missed star has no penalty.

The round is a 3-second countdown followed by exactly 60 seconds of play, with
phases WARM_UP, HOP_RUN, SKY_PATH, and FINAL_HOP at 0/15/35/50 seconds.

## Scoring and results

LOW_BLOCK is 100 points, HIGH_BLOCK 150, GAP 175, and STAR_GATE 100. Required
clears advance the streak; a stumble resets it. Each completed five-clear tier
adds +10, capped at +50. There is no negative score. Results show score,
successful clears, stumbles, stars, best streak, and a friendly game voice-time
stat (not a health or respiratory metric). Replay recreates the same seed and
course.

## Production microphone UX

The production screen has no camera preview and makes no permission request on
render or navigation. A single explicit `啟用麥克風開始` action starts F0's
`MicrophoneVoiceInputProvider` with exactly:

```text
pose: false, hands: false, audio: true
VOICE_LEVEL, VOICE_TRIGGER, VOICE_SUSTAINED_DURATION
```

It explains that only transient loudness is analyzed, with no recording,
storage, or speech-content recognition. Leaving the game disposes the provider.
F0 hidden/pagehide/device-loss cleanup can surface a restart-required panel;
visibility does not automatically reacquire the microphone. Replay reuses an
active provider and does not request it again.

## Developer Test Mode

Developer mode reuses `KeyboardMouseTestInputProvider`, with no microphone
permission. `V` (and the existing provider trigger) starts a hop; a slider and
large `發聲`/`停止` controls set `VOICE_LEVEL`, and a `觸發跳躍` button emits a
new `VOICE_TRIGGER`. All four controls use the same Session/Core path as
production.

## Presentation

Phaser renders an opaque 1280×720 FIT stage: a colorful side-scroll world,
large procedural avatar, oversized obstacles, star gates, voice-energy aura,
meter, countdown, phase banner, safe-reset feedback, and readable score/timer.
The `FINAL_HOP` phase intensifies background motion and color without changing
F0 thresholds or voice gain. Core remains authoritative; Phaser only projects
state.

## Deferred work

Pitch estimation, speech recognition, recording, audio persistence, remote
media, microphone calibration, and physical recognition tuning are deferred.
The next consumer is Batch F2 — Sound Cannon.
