# Batch F0 — Voice Input Foundation

## Status

`ENGINEERING PASS`; `PHYSICAL QA PENDING`.

F0 is a shared input foundation, not a game. It provides an explicit,
single-player production microphone route for future Vocal Hop and Sound Cannon
Sessions. It has no home card, route, recording surface, or diagnostic game.
Physical microphone recognition, device/browser compatibility, compact-space
noise, fatigue, and projector feedback remain unvalidated.

## Existing normalized contract

F0 reuses the existing `MotionActionId` contract and `MotionInputProvider`
snapshot shape. The production-supported actions are:

- `VOICE_LEVEL`: continuous normalized gameplay loudness in `0..1`.
- `VOICE_TRIGGER`: one new onset occurrence.
- `VOICE_SUSTAINED_DURATION`: active voice-control duration in seconds,
  bounded to `0..4`.

`VOICE_LEVEL` is the canonical loudness name. F0 does not introduce
`VOICE_VOLUME`, `MIC_VOLUME`, `AUDIO_LEVEL`, or another Voice snapshot. Games
receive only the existing normalized actions, never a stream, track, device ID,
AudioContext, analyser, or PCM buffer.

`VOICE_PITCH` remains in the existing contract and the Developer provider, but
is deliberately deferred in production. F0 rejects a production pitch request
clearly rather than emitting arbitrary pitch values. F1 and F2 do not require
pitch; it may be revisited after Windows Chrome and iPhone Safari evidence.

## Production route

```text
explicit future-game button
  → MicrophoneAudioSource
  → VoiceSignalAnalyzer
  → MicrophoneVoiceInputProvider
  → existing MotionInputSnapshot VOICE_* actions
  → future Session → Game Core
```

`MicrophoneVoiceInputProvider` accepts one player only. Its request must set
`sensors.audio: true`, must not mix Pose or Hands, and may request only the
three production-supported voice actions. Construction, `getSnapshot()`, and
`update()` never ask for permission. Only `start(request)` calls
`getUserMedia`, with `video: false` and non-exact audio preferences for one
channel, echo cancellation, no noise suppression, and no automatic gain
control.

The source graph is microphone source → analyser only. It never connects to
`AudioContext.destination`; there is no sidetone or microphone playback.

## Level analysis

Each game-loop update reads a reusable time-domain Float32 buffer and derives:

```text
rms = sqrt(mean(sample²))
dbFS = 20 * log10(max(rms, 1e-8))
rawLevel = clamp01((dbFS - -60) / (-12 - -60))
level = previousLevel + (rawLevel - previousLevel) * 0.35
```

Exact centralized engineering configuration:

| Setting | Value |
|---|---:|
| noiseFloorDb | -60 dBFS |
| fullLevelDb | -12 dBFS |
| smoothingAlpha | 0.35 |
| trigger enter / exit | 0.22 / 0.12 |
| minimum trigger samples | 2 |
| sustain enter / exit | 0.18 / 0.12 |
| sustained-duration cap | 4 seconds |

This is a bounded gameplay normalization, not room dB SPL, microphone
calibration, hearing, voice-health, or physical-power measurement. The
continuous action phases follow the existing convention: zero is idle, a
non-zero onset is started, continuing non-zero is active, and return to zero is
ended.

## Trigger and sustain semantics

`VOICE_TRIGGER` uses an `IDLE → CANDIDATE → LATCHED` state machine. Two
consecutive level samples at or above `0.22` emit one occurrence. A sustained
voice remains latched and cannot repeat; it rearms only at or below `0.12`.
Only a real new onset receives a new trigger sequence.

`VOICE_SUSTAINED_DURATION` uses independent `0.18` enter and `0.12` exit
hysteresis over normalized level. It adds the update delta while active,
caps at four seconds, and returns to zero on exit or lifecycle reset.

## Lifecycle, error, and privacy boundary

`stop()` is idempotent. It disconnects source and analyser nodes, stops every
microphone track, closes the AudioContext, clears all normalized actions, and
prevents retained trigger reuse. A later explicit `start()` obtains a fresh
stream.

On `visibilitychange` to hidden, `pagehide`, track ended/device loss, failed
permission, or AudioContext setup failure, capture and normalized state are
cleared. Returning to visible never reacquires a microphone automatically;
future game UI must ask the player to explicitly restart.

F0 never uses MediaRecorder, SpeechRecognition, webkitSpeechRecognition,
transcription, Blob/file creation, persistence, recording, network upload, or
audio playback. Analysis samples are transient in-memory buffers only.

## Developer input and consumers

The existing `KeyboardMouseTestInputProvider` is unchanged. It continues to
simulate `VOICE_LEVEL`, reserved `VOICE_PITCH`, `VOICE_TRIGGER`, and bounded
`VOICE_SUSTAINED_DURATION` without camera or microphone access.

Intended consumers are F1 Vocal Hop and F2 Sound Cannon. They should request
`inputTypes: ['VOICE']`, `bodyAreas: ['VOICE']`, and
`sensorRequirements.audio: true` through the existing registry schema.
