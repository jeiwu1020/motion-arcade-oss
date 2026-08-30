# Phase 1D.1 — Pose Calibration

Status: Phase 1D.1 collection implemented; Phase 1D.2 consumption documented separately

Date: 2026-08-30

## Architecture and boundary

Phase 1D.1 adds a framework-independent calibration branch beside the Phase 1C analyzer:

```text
Camera → MediaPipe Pose → PoseSensorFrame → PoseFeatureExtractor
                                               ├→ PoseMotionAnalyzer → MotionInputSnapshot
                                               └→ PoseCalibrationSession → PlayerCalibration v1
```

`PoseCalibrationSession` consumes only `PoseFeatureFrame`. It has no React, DOM, MediaPipe, camera, stream, or game dependency. The existing Pose Sensor Lab owns the one camera/session/backend pipeline and feeds the same inference frame through the existing `PoseFeatureExtractor`; calibration does not initialize a second camera or MediaPipe instance.

Game Core sees neither calibration UI state nor raw sensor data. Phase 1D.2 may provide a `PlayerCalibration` through the existing per-player motion request boundary; calibration remains provider input and is not exposed through `MotionInputSnapshot`.

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

MOVE is pelvis displacement from the calibration neutral divided by neutral body scale. LEAN is the shoulder-to-hip horizontal offset divided by neutral torso length. SQUAT is pelvis vertical drop divided by neutral body scale.

REACH capability uses the extractor's dimensionless shoulder/elbow/wrist extension ratio, but collection now also requires a real outward wrist movement relative to the participant's neutral arm position. On entering the REACH step, both arms must first return to a relaxed/non-reach state for consecutive preparation frames before either side can be accepted. This prevents a straight resting arm or a posture inherited from the previous LEAN step from immediately completing REACH.

Source-horizontal deltas use the same `canonicalizeHorizontalDelta` transform as Phase 1C. The current front-facing source is canonicalized from `MIRRORED` source coordinates. Preview CSS mirroring is display-only and never changes calibration data. MOVE left/right means the participant's canonical game/world direction; REACH left/right remains anatomical identity from the extractor.

## Guided STANDARD flow

The developer-gated Pose Sensor Lab uses two visibly separate stages:

```text
Stage 1 — 動作校正
  1. NEUTRAL
  2. MOVE
  3. LEAN
  4. REACH
  5. SQUAT
  6. REVIEW

Stage 2 — 動作測試
  使用校正值測試 ↔ STANDARD 比較
```

Calibration steps:

1. **NEUTRAL** — requires full-body tracking and at least eight stable samples over 750 ms. A single frame cannot establish the baseline.
2. **MOVE** — captures both canonical directions while torso lean remains small.
3. **LEAN** — captures both shoulder-to-hip lean directions independently of body translation.
4. **REACH** — first asks the participant to lower/relax both arms, then captures deliberate outward anatomical left and right arm extension. Relaxed arms cannot complete the step.
5. **SQUAT** — captures one comfortable flexed-knee pelvis drop. JUMP is not calibrated.
6. **REVIEW** — reports complete or skipped steps without requiring technical decimals. The primary action is explicitly `開始校正值動作測試`; it switches the analyzer to the new calibration and advances directly into Stage 2.

The Stage 2 screen clearly labels the current analyzer mode as either `使用校正值` or `STANDARD`. Switching modes restarts only the provider/analyzer baseline, not the camera or MediaPipe session.

The panel uses a large title and instruction, persistent five-step progress, high-contrast states, per-side completion cards, and large controls. Normal use does not depend on numeric diagnostics; normalized values remain available in a developer-only details section during the test stage.

## Retry, skip, and tracking loss

`重新測試` clears the current step's accumulator and measurement only. Earlier completed steps remain intact. `跳過` is available for MOVE, LEAN, REACH, and SQUAT; it records `SKIPPED` and leaves the corresponding values `null`. The required NEUTRAL step cannot be skipped.

A missing pose or missing required landmarks puts the current collection into `WAITING_FOR_TRACKING`, clears transient confirmation streaks, and does not modify completed measurements. Neutral collection restarts after invalid full-body tracking. Later steps require several valid recovery frames before accepting new samples.

The result is `COMPLETE` only when all optional capability steps were measured; otherwise it is `PARTIAL`.

## Phase 1D.1 boundary and Phase 1D.2 continuation

Phase 1D.1 defines and collects calibration. Phase 1D.2 optionally passes a canonical v1 result through `MotionPlayerRequest.calibration` to a bounded policy before constructing `PoseMotionAnalyzer`. The collection values never directly become thresholds.

Without a valid v1 calibration, every Phase 1C STANDARD detector value and behavior remains unchanged. JUMP remains entirely outside calibration adaptation.

The flow validates STANDARD standing Pose only. SEATED, UPPER_BODY, LEFT_SIDE, RIGHT_SIDE, LOW_MOTION, and SLOW_RESPONSE remain compatible future profile work and are not claimed as calibrated here.

## Privacy and lifetime

Calibration state and result live only in the in-memory `PoseCalibrationSession`. Camera stop/restart, sensor suspension/error, page unload, or explicit reset discards it. There is no localStorage, IndexedDB, backend upload, analytics, recording, screenshot, name, account association, or new network request.

## Automated coverage

Synthetic Pose fixtures verify stable/unstable/invalid neutral collection, canonical MOVE direction, preview-mirror independence, LEAN versus translation, anatomical REACH sides, REACH preparation/outward-motion gating, normalized SQUAT depth, normal flow, retry, skip/null values, complete versus partial results, tracking-loss preservation, reset, and absence of raw sensor data. Unit tests require no camera or MediaPipe runtime.

## Manual Windows validation

Run the existing local Pose Lab launcher and complete this checklist:

1. Start the camera and establish tracking READY.
2. Start calibration; stand naturally until NEUTRAL completes.
3. Move to your own left and right while upright.
4. Stay in place and lean left and right.
5. At REACH, keep both arms down first. Confirm neither side completes before you intentionally reach.
6. Wait for the panel to say that reaching can begin; reach with anatomical left, then right arm.
7. Perform one comfortable squat.
8. At REVIEW, press `開始校正值動作測試`. Confirm the screen changes to Stage 2 and clearly says `目前模式：使用校正值`.
9. Wait for Motion Analyzer READY, then test MOVE/LEAN/REACH/SQUAT/JUMP.
10. Switch to STANDARD and confirm the screen clearly labels the current mode.
11. Restart calibration and confirm all calibration progress resets.
12. From 2–4 m away, confirm the current stage, instruction, state, progress, side completion, and controls remain readable.

Physical Windows camera behavior, 2–4 m readability, anatomical side confirmation, and physical iPhone Safari behavior remain manual gates and must not be marked passed from automated tests.

## Deferred work

Deferred: jump calibration, full special-profile adaptation, persistence, multi-person calibration, production onboarding, formal games, Hands, Voice, STRIKE, THROW, RUN, STEP, and cadence.
