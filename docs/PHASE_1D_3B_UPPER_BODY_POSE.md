# Phase 1D.3b — SEATED + UPPER_BODY Pose Support

Status: implemented; physical-device validation remains required

Date: 2026-08-31

## Runtime policy

`SEATED` and `UPPER_BODY` select the same conservative upper-body tracking
requirement. Their functional labels remain distinct so later product policy can
differentiate posture without changing the analyzer boundary.

The analyzer config now declares either `FULL_BODY` or `UPPER_BODY` tracking:

- `STANDARD` remains `FULL_BODY` and still requires shoulders, hips, both knees,
  and both ankles for its standing baseline.
- `SEATED` and `UPPER_BODY` require valid left/right shoulders and hips for a
  stable temporary baseline. Knees and ankles are not required.
- readiness reports `upperBodyReady` and `fullBodyReady` separately. A STANDARD
  full-body baseline is also upper-body ready; an upper-body-mode baseline is
  never reported as full-body ready.
- stale/lost tracking, long-loss re-baselining, EMA, debounce, action freshness,
  provider lifecycle, immutable snapshots, and source-coordinate transforms are
  unchanged.

## Supported actions

Both `SEATED` and `UPPER_BODY` support exactly:

- `MOVE_LEFT`, `MOVE_RIGHT` — canonical world-direction translation of the hip
  midpoint relative to the temporary torso baseline. This preserves the existing
  MOVE semantics and remains distinct from shoulder-to-hip LEAN.
- `LEAN_LEFT`, `LEAN_RIGHT` — participant-relative torso lean.
- `REACH`, `REACH_LEFT`, `REACH_RIGHT` — existing intentionality gates and
  anatomical left/right arm identity.

Both modes keep these actions neutral and unavailable:

- `SQUAT`
- `JUMP`

The analyzer explicitly disables both lower-body state machines in upper-body
mode even if knees and ankles happen to be visible. It does not synthesize a
seated squat, torso bob, or jump substitute.

## Profile composition

`LOW_MOTION` and `SLOW_RESPONSE` continue to resolve through the existing single
config policy and can compose with either new mode. Range scaling and candidate
grace apply to supported upper-body actions exactly as before. Lower-body actions
remain unavailable regardless of those modifiers. `STANDARD` config identity,
thresholds, standing baseline, and detector behavior remain unchanged.

`LEFT_SIDE` and `RIGHT_SIDE` Pose expansion is not part of this phase. Existing
anatomical-side gating remains intact but is not advertised as a new mode.

## Calibration limitation

The current guided calibration requires a full standing neutral step and includes
a standing SQUAT measurement. Those measurements are not valid assumptions for
`SEATED` or `UPPER_BODY`. The provider therefore ignores supplied standing
calibration in these modes and uses the bounded STANDARD torso thresholds, plus
explicit LOW_MOTION/SLOW_RESPONSE modifiers when selected.

Pose Lab pauses the guided standing calibration UI while either upper-body mode
is selected and explains the limitation. Returning to a full-body mode can reuse
the in-memory calibration selection; no new persistence or calibration semantics
were added.

## Pose Lab

Pose Lab exposes three base-mode controls:

- `標準動作`
- `坐姿模式`
- `上半身模式`

It shows the current mode, upper-body and full-body readiness separately, exact
available/unavailable action lists, and explicit `UNAVAILABLE` diagnostics for
SQUAT/JUMP. Mode changes restart only the provider/analyzer baseline. They do not
restart the camera or MediaPipe session.

## Automated coverage

Focused synthetic tests prove:

- STANDARD remains on the exact canonical config and rejects missing knees/ankles;
- the same torso-only frames establish SEATED and UPPER_BODY readiness;
- MOVE, LEAN, and anatomical REACH remain functional;
- SQUAT and JUMP stay neutral even when full lower-body landmarks are supplied;
- LOW_MOTION and SLOW_RESPONSE continue to compose with upper-body readiness;
- standing calibration is ignored safely for both new modes;
- Pose Lab mode selection, labels, and action availability are explicit.

## Manual physical validation required

Automated fixtures do not establish real-person or physical-device usability.
Before gameplay depends on these modes, test:

1. a seated participant on Windows with knees/ankles cropped or occluded;
2. an upper-body-only camera framing on Windows;
3. neutral stability and false positives for 30–60 seconds;
4. canonical projected MOVE direction and anatomical LEAN/REACH sides;
5. deliberate torso MOVE versus LEAN separation from 2–4 m;
6. confirmation that torso bobbing, chair adjustment, and visible leg motion never
   emit SQUAT/JUMP;
7. LOW_MOTION, SLOW_RESPONSE, and their combination in both modes;
8. mode switching, tracking loss/recovery, background/suspension, and camera
   cleanup;
9. the same checks on physical iPhone Safari in landscape with projection.

`MANUAL DEVICE TEST REQUIRED`
