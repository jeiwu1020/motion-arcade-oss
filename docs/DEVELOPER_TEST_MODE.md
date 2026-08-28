# Developer Test Mode

Status: Implemented in Phase 1A

Purpose: exercise the formal motion boundary without camera, microphone, MediaPipe, or physical movement.

## Access and production gate

Development builds expose **Open Developer Input Lab** automatically.

Normal production builds hide the Lab. A non-development build must opt in at build time:

```text
VITE_ENABLE_TEST_INPUT=true
```

The gate deliberately ignores query parameters. `VITE_*` values are compiled into client code and must never contain secrets. `.env.example` documents the non-secret flag; `.env` and `.env.*` are ignored except for that example.

## What the Lab proves

- React can initialize without Phaser or MediaPipe.
- Entering the Lab lazy-loads its React module and then the Phaser bundle.
- Leaving the Lab destroys the Phaser instance and canvas once, including React StrictMode cleanup.
- Phaser receives only normalized player snapshots.
- One to four simulated players retain independent state and ability profiles.
- Test input starts without camera/microphone permission requests.

The Lab is developer tooling, not a formal game or patient-facing activity.

## Keyboard bindings

Bindings belong only to `KeyboardMouseTestInputProvider`.

| Keys | Normalized action |
|---|---|
| `A` / `D` | `MOVE_LEFT` / `MOVE_RIGHT` |
| `ArrowUp` / `ArrowDown` | `MOVE_UP` / `MOVE_DOWN` |
| `W` | `JUMP` |
| `S` | `SQUAT` |
| `Q` / `E` | `LEAN_LEFT` / `LEAN_RIGHT` |
| `J` / `K` / `L` | `STRIKE_LEFT` / `STRIKE` / `STRIKE_RIGHT` |
| `R` | `REACH` |
| `Z` / `C` | `REACH_LEFT` / `REACH_RIGHT` |
| `F` / `G` / `H` | `ARM_SWING_LEFT` / `ARM_SWING` / `ARM_SWING_RIGHT` |
| `Space` | `THROW` |
| either `Shift` | `RUN` |
| `X` | `STEP` |
| `1` or `U` | `HAND_OPEN` |
| `O` | `HAND_CLOSE` |
| `2` or `I` | `PINCH` |
| `3` | `POINT` |
| `4` | `CLAP` |
| `V` | `VOICE_TRIGGER` |

Press, hold, and release become `started`, `active`, and `ended`. Browser key-repeat is ignored, so a held key does not create a new pulse every render frame.

## Mouse simulation

Choose one routing mode:

- **Left hand** → `HAND_POSITION_LEFT`
- **Right hand** → `HAND_POSITION_RIGHT`
- **Pointer** → `POINTER_POSITION`

Movement is normalized against the visible test-field bounds:

```text
left/top = 0,0
right/bottom = 1,1
```

Pointer down emits `POINTER_CLICK`, movement while held emits `POINTER_DRAG`, and consecutive points produce normalized `POINTER_VELOCITY`. Browser/client pixel coordinates never enter a game snapshot.

## Simulated voice and cadence

The control panel supplies continuous sliders for:

- `VOICE_LEVEL`: calibrated `0..1`
- `VOICE_PITCH`: calibrated `0..1`, not Hertz
- `RUN_CADENCE`: `0..4` steps per second in the simulator

The **Voice trigger** button emits `VOICE_TRIGGER`. While voice level remains above the test gate, `VOICE_SUSTAINED_DURATION` advances in seconds; returning the level to zero ends and resets it.

No microphone stream, recording, speech recognition, or Web Audio capture is used.

## Players and profiles

Select a simulated player count from one to four, then choose the active player tab. Keyboard, pointer, sliders, and trigger buttons affect only that player.

Each player has two composable controls:

- base profile: `STANDARD`, `LOW_MOTION`, `SEATED`, `UPPER_BODY`, or `SLOW_RESPONSE`;
- usable anatomical side: both, `LEFT_SIDE`, or `RIGHT_SIDE`.

For example, Player 1 can remain `STANDARD` while Player 2 is `SEATED + RIGHT_SIDE`. A right-side profile suppresses left-sided strike, reach, arm-swing, and hand-position actions without changing `MOVE_LEFT`/`MOVE_RIGHT` world direction.

Profile metadata does not disadvantage the simulated game output. `LOW_MOTION` exposes a smaller `requiredMotionRangeScale` for a future physical adapter, but the Phaser proof moves at the same normalized speed. `SLOW_RESPONSE` exposes a `reactionWindowScale` for future interaction timing, but does not slow the proof animation.

## Trigger buttons

The panel exposes common pulse actions including jump, squat, left/right strike, throw, hand open, pinch, and voice trigger. The keyboard table covers the additional Phase 0 action set.

## Normalized action inspector

The overlay displays the same snapshot consumed by Phaser:

- provider and active player;
- resolved ability profile;
- action ID, normalized value, and phase;
- left/right hand or pointer coordinates;
- voice level, normalized voice pitch, and cadence.

It displays no camera imagery, raw landmarks, audio samples, patient name, or raw microphone telemetry.

## Coordinate and side rules

- `MOVE_LEFT` / `MOVE_RIGHT` and point `x` are projected playfield directions.
- Sided limb actions always refer to the participant's anatomical side.
- A future mirrored preview is visual only. The provider pipeline must canonicalize detector coordinates before publishing actions.
- Games and Phaser scenes must not flip coordinates or swap anatomical labels.

See [Motion Input Contract](./MOTION_INPUT_CONTRACT.md) for the normative rules.

## Recommended QA sequence

1. Open the Lab and confirm exactly one canvas appears.
2. Hold/release `A` or `D` and inspect movement state.
3. Route the mouse to each hand and move/click/drag inside the field.
4. Change voice level, pitch, and cadence continuously.
5. Configure different profiles for Players 1 and 2 and switch between them.
6. Confirm a side-restricted action remains idle while an allowed action activates.
7. Return Home and confirm the Phaser canvas is removed.
8. Repeat at `852 × 393` landscape and confirm the page has no document-level overflow.

## Deferred

The Lab does not implement real sensor selection, replay files, binding remapping UI, patient calibration workflows, production authentication for debug tools, or formal game content.
