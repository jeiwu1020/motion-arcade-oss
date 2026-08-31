# Phase 1D.3a — Functional Ability Profiles

Status: implemented; physical-device validation remains required

Date: 2026-08-30

## Scope and terminology

Phase 1D.3a gives runtime behavior to `STANDARD`, `LOW_MOTION`, and
`SLOW_RESPONSE`. These are functional control preferences, not diagnoses:

- `STANDARD` (`標準動作`) preserves the Phase 1D.2 behavior.
- `LOW_MOTION` (`較小動作範圍`) represents deliberate motion performed over a
  smaller comfortable range.
- `SLOW_RESPONSE` (`較慢反應速度`) allows a deliberate activation candidate
  more time to survive a brief interruption without lowering its physical gate.

`SEATED`, `UPPER_BODY`, `LEFT_SIDE`, and `RIGHT_SIDE` remain contract-compatible
but are not claimed as fully supported Pose modes in this phase.

SEATED and UPPER_BODY are implemented by the successor Phase 1D.3b work; see
[Phase 1D.3b — SEATED + UPPER_BODY Pose](./PHASE_1D_3B_UPPER_BODY_POSE.md).

## Resolution architecture

```text
immutable STANDARD PoseMotionConfig
              ↓
valid PlayerCalibration v1 mapping (when supplied)
              ↓
ResolvedAbilityProfile functional scaling
              ↓
final Phase 1D.2 safety clamps
              ↓
session-specific PoseMotionConfig
              ↓
PoseMotionAnalyzer → normalized actions
```

`resolveAbilityProfile` resolves `LOW_MOTION` to
`requiredMotionRangeScale = 0.6` and `SLOW_RESPONSE` to
`reactionWindowScale = 1.75`. The combined selection resolves both dimensions
once; selection order cannot double-apply either scale.

`resolvePoseMotionConfig` remains the sole bounded policy. It resolves once when
`PoseMotionInputProvider.start()` receives the first player's request. The
analyzer receives only the effective config and remains unaware of calibration,
ability-profile names, React, MediaPipe, or games. Switching the Lab profile
restarts the provider/analyzer baseline only; the camera and MediaPipe session
remain running.

## LOW_MOTION behavior

LOW_MOTION scales MOVE, LEAN, REACH normalization, and SQUAT after any valid
directional calibration mapping. Without calibration it conservatively scales
the STANDARD configuration through the same clamps. A PARTIAL calibration uses
its available measurements and the bounded, scaled STANDARD fallback for each
missing action or side.

The Phase 1D.2 safety floors are unchanged:

| Action | Entry / intentionality floor | Exit floor | Full-target floor |
| --- | ---: | ---: | ---: |
| MOVE | `0.14` body units | `0.08` | `0.30` |
| LEAN | `0.12` body units | `0.07` | `0.24` |
| REACH | extension ratio `0.75`, elbow `150°`, outside-body score `0.55` | score `0.50` | extension ratio `0.82` |
| SQUAT | depth `0.18` body units and knee angle at most `155°` | depth `0.10` | depth `0.22` |

Hysteresis, two-qualified-sample activation, tracking validity, freshness, EMA,
anatomical left/right, and canonical MOVE direction remain intact. Relaxed arms,
normal sway, tiny knee bends, and weight shifts are not reclassified as
intentional actions.

## SLOW_RESPONSE behavior

STANDARD has `detectorCandidateGraceMs = 0`, which preserves the existing
frame-for-frame candidate reset behavior. SLOW_RESPONSE derives a timestamp-based
grace period:

```text
clamp((reactionWindowScale - 1) × 320 ms, 0, 480 ms)
```

For the current `1.75` scale this is `240 ms`. MOVE, LEAN, REACH, and SQUAT may
retain an in-progress activation candidate during a brief below-threshold or
temporarily invalid sample, but still need the same two threshold-qualified
samples and all original intent gates to activate. Isolated noise cannot activate
an action. The grace is measured in milliseconds rather than arbitrary frames,
so its meaning is consistent at the worker target of 20 Hz and fallback target
of 12 Hz.

SLOW_RESPONSE does not change action entry, exit, full-intensity targets, EMA,
deactivation, freshness, or normalized output values.

## STANDARD and JUMP invariants

With `STANDARD`, no calibration behaves exactly as Phase 1C/1D.2: the canonical
config object is returned with zero candidate grace. `STANDARD` plus valid
calibration retains the Phase 1D.2 calibrated values exactly.

JUMP is excluded from both functional dimensions. Its range thresholds,
velocity/foot gates, state machine, landing behavior, and refractory period are
unchanged. A shallower LOW_MOTION squat or a SLOW_RESPONSE squat-to-stand does
not relax or feed the JUMP detector.

## Pose Lab

The Pose Lab displays three readable controls: `標準動作`, `較小動作範圍`, and
`較慢反應速度`. LOW_MOTION and SLOW_RESPONSE can be selected together. The
current label distinguishes fixed STANDARD testing, calibrated testing, and the
active functional dimensions without exposing enum names as the primary UI.
The developer sidebar shows resolved profile IDs, the `0.6`/`1.75` scales,
candidate grace, and the effective action thresholds.

An existing in-memory calibration stays available while toggling profiles. No
recalibration, camera restart, MediaPipe initialization, or persistence is added.

## Privacy

Ability profiles and calibration remain session/runtime data. This phase adds no
persistence, identity, diagnosis field, backend, network call, analytics,
recording, screenshot, image storage, or landmark storage. Games receive only
the existing normalized actions and never receive body-unit thresholds.

## Manual validation checklist

These checks must be performed by a person and are not automated PASS claims:

1. Windows STANDARD: recheck MOVE, LEAN, anatomical REACH, SQUAT, and JUMP.
2. LOW_MOTION: intentionally smaller MOVE/LEAN/REACH and shallower deliberate
   SQUAT work; idle stance, normal sway, relaxed arms, tiny knee bends, and weight
   shifts remain neutral.
3. SLOW_RESPONSE: slowly perform MOVE, LEAN, REACH, and SQUAT; confirm the
   required physical range is not reduced.
4. Combined: repeat with LOW_MOTION + SLOW_RESPONSE and verify both dimensions
   apply once.
5. Confirm squat-to-stand without leaving the ground produces no JUMP.
6. Confirm profile switching retains the current calibration and does not restart
   the camera.
7. Repeat the flow on physical iPhone Safari and include the existing 2–4 m
   readability and 30–60 second false-positive checks.
