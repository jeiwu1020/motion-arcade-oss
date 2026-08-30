# Phase 1D.2 — Calibration-Driven Motion Adaptation

Status: implemented; physical-device validation remains required

Date: 2026-08-30

## Architecture

Phase 1D.2 adds a pure policy between session-provided calibration and Pose detection:

```text
PlayerCalibration v1 + ResolvedAbilityProfile + immutable STANDARD config
                              ↓
                  resolvePoseMotionConfig
                              ↓
              session-specific PoseMotionConfig
                              ↓
                    PoseMotionAnalyzer
                              ↓
                  MotionInputSnapshot 0..1
```

`src/motion/calibration/calibrationAdaptation.ts` validates and maps calibration. `PoseMotionAnalyzer` consumes only a resolved detector config; it does not import or interpret `PlayerCalibration`. `PoseMotionInputProvider` reads the first requested player's `MotionPlayerRequest.calibration`, resolves the config once in `start()`, and constructs one analyzer for that provider session. Configuration is not recalculated per frame and the global `POSE_MOTION_CONFIG` is deeply immutable.

The Pose provider remains intentionally single-person. Games receive normalized actions only and never receive body units, calibration fields, landmarks, or sensor objects.

## Canonical v1 validation and fallback

Adaptation requires the canonical contract with `version === 1`, a valid COMPLETE/PARTIAL status, valid step and quality structures, and a completed required NEUTRAL step. The deprecated Phase 1A compatibility object never activates adaptation.

Every measurement must be finite, positive, and within its action's plausible input interval. `undefined`, malformed objects, `NaN`, infinities, negative/zero values, and implausibly tiny or large values fall back safely. Availability is action- and side-specific: a missing LEAN value does not prevent valid MOVE or SQUAT adaptation.

No valid v1 calibration means the exact Phase 1C STANDARD behavior: MOVE `0.22 / 0.12 / 0.75`, LEAN `0.18 / 0.10 / 0.55`, SQUAT `0.30 / 0.16 / 0.65` with the `155°` knee gate, and unchanged REACH/JUMP behavior.

## Policy order and safety bounds

Resolution order is:

```text
STANDARD defaults → valid calibration mapping → requiredMotionRangeScale → final clamp
```

Ability-profile scaling is applied only to a valid calibrated measurement. An unavailable action remains exactly STANDARD rather than receiving an invented range. Phase 1D.2 validates `STANDARD + calibration`; this is not a claim of complete SEATED, UPPER_BODY, LEFT_SIDE, RIGHT_SIDE, LOW_MOTION, or SLOW_RESPONSE support.

The bounded policies are:

| Action | Accepted measurement | Enter clamp | Exit clamp | Full target clamp |
| --- | ---: | ---: | ---: | ---: |
| MOVE, each direction | `0.16..1.50` body units | `0.14..0.30` | `0.08..0.18` | `0.30..0.90` |
| LEAN, each direction | `0.15..1.20` body units | `0.12..0.24` | `0.07..0.14` | `0.24..0.70` |
| REACH, each arm | capability `0.80..1.00` | extension floor `0.75` | existing score exit `0.50` | extension target `0.82..1.00` |
| SQUAT | `0.18..1.20` body units | `0.18..0.32` | `0.10..0.18` | `0.22..0.75` |

Range policies enforce `0 <= exit < enter <= full target`. Safety floors prevent natural sway or tiny knee bends from becoming actions. Existing debounce, EMA, freshness, tracking, confidence, and full-body validity rules remain in force.

## Action behavior

- **MOVE:** left and right retain separate calibrated ranges. Entry uses 35% of comfortable range before clamping, full intensity uses 90%, and exit is 55% of the resolved entry. Canonical direction and preview-mirror behavior are unchanged.
- **LEAN:** left and right are independent. The same bounded mapping produces useful intensity at comfortable torso lean while the detector continues using shoulder-to-hip offset, not whole-body translation.
- **REACH:** anatomical left and right capability independently set the extension normalization target. The `150°` elbow, wrist-height, torso-envelope, confidence, score, and debounce intent gates are unchanged.
- **SQUAT:** entry uses 65% of comfortable depth, exit 55% of resolved entry, and full intensity 95% of comfortable depth, all clamped. The `155°` knee-angle intent gate, full-body requirement, hysteresis, and debounce remain unchanged.
- **JUMP:** calibration is not consulted. All Phase 1C thresholds and the GROUNDED/TAKEOFF/AIRBORNE/LANDING/refractory state machine are unchanged.

## Lab diagnostics and lifetime

After REVIEW or COMPLETE, the developer Pose Lab offers `使用校正值測試` and `使用 STANDARD 測試`. Switching restarts only the Pose input provider/analyzer, so its temporary neutral baseline is reacquired; the existing camera, MediaPipe backend, mirrored preview, and skeleton overlay continue unchanged. Effective left/right MOVE and LEAN thresholds, REACH targets, SQUAT thresholds, source, and explicit unchanged JUMP status are shown in the technical sidebar.

Calibration is supplied through the request and retained in memory only for that provider session. Provider stop discards the request and returns diagnostics to STANDARD. There is no localStorage, IndexedDB, account association, backend, upload, analytics, recording, screenshot, raw landmark storage, or new network behavior.

## Manual validation checklist

1. On Windows, verify STANDARD still requires the previously validated deep squat and retains prior MOVE/LEAN/REACH behavior.
2. Complete a calibration, select calibrated testing, and stand still while the analyzer reacquires its neutral baseline.
3. Verify calibrated own-left and own-right MOVE independently reach strong intensity.
4. Verify calibrated torso LEAN is distinct from whole-body translation.
5. Verify anatomical left/right REACH stays correct in the mirrored preview.
6. Verify the captured comfortable SQUAT triggers reliably while normal standing, weight shifting, and tiny knee bends remain neutral.
7. Perform squat-to-stand without leaving the ground and confirm no JUMP pulse.
8. Switch back to STANDARD and confirm effective diagnostics and physical behavior return to defaults.
9. Repeat the calibrated flow on physical iPhone Safari, including 30–60 seconds idle stability and the relevant 2–4 m readability check.

These real-person Windows, distance, anatomy, false-positive, and physical iPhone checks are manual gates; automated tests do not establish a physical-device pass.

## Deferred

Deferred: JUMP calibration, full special-profile behavior, persistence, multi-person Pose, production onboarding, formal games, RUN, STEP, STRIKE, THROW, Hands, Voice, and diagnosis-specific behavior.
