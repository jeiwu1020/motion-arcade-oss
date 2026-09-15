# Batch F2 — Sound Cannon / 音波砲

Sound Cannon is a bounded single-player target-blasting game consuming only
the F0 normalized `VOICE_LEVEL`, `VOICE_TRIGGER`, and
`VOICE_SUSTAINED_DURATION` actions.

## Loop and comfort contract

A short comfortable vocal sound starts one charge while the cannon is ARMED.
Quiet release fires before 900 ms; otherwise the cycle auto-fires at 900 ms.
The cannon then waits for quiet (`VOICE_LEVEL <= 0.12` and no sustained
activity) before re-arming. Continuous sound cannot fire repeatedly. This is
not a shouting, endurance, respiratory, decibel, or vocal-power test.

```text
usableLevel = clamp01((VOICE_LEVEL - 0.10) / 0.40)
comfortLevel = sqrt(usableLevel)
durationFactor = clamp01(VOICE_SUSTAINED_DURATION / 0.75)
powerFactor = 0.75 + comfortLevel * 0.25
charge = clamp01(durationFactor * powerFactor)
```

Normalized voice above 0.50 has no additional benefit.

## Core and targets

`SoundCannonCore` is framework-independent and seeded. It owns the three-second
countdown, 60-second WARM_UP/TARGET_WAVE/POWER_WAVE/FINAL_BARRAGE phases,
target schedule, immutable resolutions, timing grades, scoring, results, and
presentation events. ORB, SHIELD, and COMET targets use HIGH/CENTER/LOW visual
regions. Spacing is 2800/2400/2100/1800 ms with an 1800 ms minimum and no
simultaneous targets. The first four are ORB, ORB, SHIELD, COMET.

Fire timing is PERFECT ±130 ms, GREAT through ±270 ms, and GOOD through ±430
ms. Early shots outside the window are WASTED; unresolved targets become
MISS. Charge never gates contact. Blast power is clamped 0..1, blast radius is
`0.60 + blastPower * 0.40`, and FULL BLAST starts at 0.85.

Grade scores are 150/120/90, target bonuses are ORB +50, SHIELD +80, COMET
+100, charge bonus is `round(blastPower * 80)`, and FULL BLAST adds +50. A
successful hit increments streak; every five hits adds +10 (cap +50). Misses
and wasted shots reset streak. There is no negative score or endurance bonus.

## Boundaries and presentation

`SoundCannonSession` and `SoundCannonVoiceCycle` bridge retained trigger
sequences safely, pause Core time outside readiness, clear half-charge on F0
stop, and never replay stale triggers. Production uses the existing
`MicrophoneVoiceInputProvider` with explicit start, `pose:false`, `hands:false`,
`audio:true`; no camera or pitch is requested. The opaque Phaser stage shows a
futuristic cannon, incoming target trails, charge and voice meters, impact
grades, and amplified FINAL BARRAGE effects. Developer mode is camera-free and
uses the existing Keyboard provider with a level slider and start/stop voice
controls.

No game file owns microphone APIs, raw PCM, recording, storage, upload,
transcription, or speech recognition. `VOICE_PITCH` is deliberately unused.

## Status

Sound Cannon: **ENGINEERING PASS**, **PHYSICAL QA PENDING**. No microphone,
timing, compact-space, fatigue, iPhone Safari, or projector Physical PASS is
claimed. F0 thresholds and Vocal Hop remain unchanged.
