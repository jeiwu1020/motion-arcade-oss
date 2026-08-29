# Phase 1D.1 — Pose Calibration

Status: implemented developer validation flow; manual real-device gates remain

Date: 2026-08-29

## Architecture and boundary

Phase 1D.1 adds a framework-independent calibration branch beside the Phase 1C analyzer:

```text
Camera → MediaPipe Pose → PoseSensorFrame → PoseFeatureExtractor
                                               ├→ PoseMotionAnalyzer → MotionInputSnapshot
                                               └→ PoseCalibrationSession → PlayerCalibration v1
```

`PoseCalibrationSession` consumes only `PoseFeatureFrame`. It has no React, DOM, MediaPipe, camera, stream, or game dependency. The existing Pose Sensor Lab owns the one camera/session/backend pipeline and feeds the same inference frame through the existing `PoseFeatureExtractor`; calibration does not initialize a second camera or MediaPipe instance.

Game Core sees neither calibration UI state nor raw sensor data. A future Phase 1D.2 adapter may provide a `PlayerCalibration` through the existing per-player motion request boundary.

## Canonical data contract

The canonical `PlayerCalibration` v1 contract is defined in `src/motion/contracts/motion.ts`. It contains:

- `version: 1`;
- `status: COMPLETE | PARTIAL`;
- normalized own/canonical left and right MOVE ranges;
- normalized left and right torso LEAN ranges;
- anatomical left and right REACH capability;
- comfortable SQUAT depth in body units;
- per-step `COMPLETE | SKIPPED` availability;
- aggregate tracking quality, valid sample count, and completion timestamp.

The original Phase 1A reserved fields remain accepted only as a deprecated compatibility branch so existing providers are not broken. New calibration output always uses version 1.

The result never contains landmarks, frames, pixels, images, streams, or MediaPipe objects. An optional step that was not measured is `null`; no assumed human default is substituted.

## Normalization and coordinate semantics

MOVE is pelvis displacement from the calibration neutral divided by neutral body scale. LEAN is the shoulder-to-hip horizontal offset divided by neutral torso length. SQUAT is pelvis vertical drop divided by neutral body scale. REACH capability uses the extractor's dimensionless shoulder/elbow/wrist extension ratio with an extended-elbow and raised-wrist intent gate.

Source-horizontal deltas use the same `canonicalizeHorizontalDelta` transform as Phase 1C. The current front-facing source is canonicalized from `MIRRORED` source coordinates. Preview CSS mirroring is display-only and never changes calibration data. MOVE left/right means the participant's canonical game/world direction; REACH left/right remains anatomical identity from the extractor.

## Guided STANDARD flow

The developer-gated Pose Sensor Lab now includes a distance-readable calibration panel:

1. **NEUTRAL** — requires full-body tracking and at least eight stable samples over 750 ms. A single frame cannot establish the baseline.
2. **MOVE** — captures both canonical directions while torso lean remains small.
3. **LEAN** — captures both shoulder-to-hip lean directions independently of body translation.
4. **REACH** — captures intentional anatomical left and right arm extension.
5. **SQUAT** — captures one comfortable flexed-knee pelvis drop. JUMP is not calibrated.
6. **REVIEW** — reports complete or skipped steps without requiring technical decimals.

The panel uses a large title and instruction, persistent five-step progress, high-contrast green/yellow/orange states, per-side completion cards, and large controls. Normal use does not depend on numeric diagnostics; normalized values are available in a collapsed developer section.

## Retry, skip, and tracking loss

`重新測試` clears the current step's accumulator and measurement only. Earlier completed steps remain intact. `跳過` is available for MOVE, LEAN, REACH, and SQUAT; it records `SKIPPED` and leaves the corresponding values `null`. The required NEUTRAL step cannot be skipped.

A missing pose or missing required landmarks puts the current collection into `WAITING_FOR_TRACKING`, clears transient confirmation streaks, and does not modify completed measurements. Neutral collection restarts after invalid full-body tracking. Later steps require several valid recovery frames before accepting new samples.

The result is `COMPLETE` only when all optional capability steps were measured; otherwise it is `PARTIAL`.

## Phase boundary

Phase 1D.1 only collects calibration. It does **not** pass the result into `PoseMotionAnalyzer` or `PoseMotionInputProvider`. No Phase 1C MOVE, LEAN, REACH, SQUAT, or JUMP threshold, EMA value, debounce rule, freshness rule, or state machine is changed. Phase 1D.2 will define the safety policy for consuming these ranges.

The flow validates STANDARD standing Pose only. SEATED, UPPER_BODY, LEFT_SIDE, RIGHT_SIDE, LOW_MOTION, and SLOW_RESPONSE remain compatible future profile work and are not claimed as calibrated here.

## Privacy and lifetime

Calibration state and result live only in the in-memory `PoseCalibrationSession`. Camera stop/restart, sensor suspension/error, page unload, or explicit reset discards it. There is no localStorage, IndexedDB, backend upload, analytics, recording, screenshot, name, account association, or new network request.

## Automated coverage

Synthetic Pose fixtures verify stable/unstable/invalid neutral collection, canonical MOVE direction, preview-mirror independence, LEAN versus translation, anatomical REACH sides, normalized SQUAT depth, normal flow, retry, skip/null values, complete versus partial results, tracking-loss preservation, reset, and absence of raw sensor data. Unit tests require no camera or MediaPipe runtime.

## Manual Windows validation

Run the existing local Pose Lab launcher and complete this checklist:

1. Start the camera and establish tracking READY.
2. Start calibration; stand naturally until NEUTRAL completes.
3. Move to your own left and right while upright.
4. Stay in place and lean left and right.
5. Reach with anatomical left, then right arm.
6. Perform one comfortable squat.
7. Review the result and finish.
8. Restart calibration and confirm all progress resets.
9. Skip one optional step and confirm the review is PARTIAL with that step skipped.
10. Walk out of frame during a later step; return and confirm earlier completed steps remain complete.
11. From 2–4 m away, confirm the title, instruction, state color, progress, side completion, and controls remain readable.

Physical Windows camera behavior, 2–4 m readability, anatomical side confirmation, and physical iPhone Safari behavior remain manual gates and must not be marked passed from automated tests.

## Deferred work

Deferred: applying calibration to detector thresholds, jump calibration, full ability-profile adaptation, persistence, multi-person calibration, production onboarding, formal games, Hands, Voice, STRIKE, THROW, RUN, STEP, and cadence.
