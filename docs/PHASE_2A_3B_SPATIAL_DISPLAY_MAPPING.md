# Phase 2A.3b — Camera / Spatial Display Mapping Diagnostic

Status: engineering implementation; Windows and iPhone physical alignment
validation remains required

## Scope

Phase 2A.3b proves that the existing canonical Pose-wrist samples can be
placed over the **mirrored DOM camera preview** without making them game or
Phaser coordinates.

```text
SpatialHandSnapshot (canonical source point)
  → contain-fit source-video rectangle
  → display-only horizontal mirror
  → CameraPresentationStage-local CSS-pixel point
```

The new pure boundary is
`src/components/camera-presentation/spatialDisplayMapping.ts`. It has no Pose,
MediaPipe, camera, React, Phaser, or game-rule dependency.

## Mapping semantics

Input points remain the Phase 2A.3a canonical values:

```text
x = 0 source-image left       x = 1 source-image right
y = 0 source-image top        y = 1 source-image bottom
```

Anatomical `leftHand` and `rightHand` still mean the participant's own hands.
Neither the snapshot nor its anatomical labels are mutated for presentation.

For source dimensions `(sw, sh)` and stage dimensions `(tw, th)`, the helper
calculates the `object-fit: contain` video rectangle using the smaller fitting
scale, then centers it:

```text
videoRect = { x: (tw - renderedWidth) / 2,
              y: (th - renderedHeight) / 2,
              width: renderedWidth,
              height: renderedHeight }

displayX = videoRect.x + (1 - sourceX) × videoRect.width
displayY = videoRect.y + sourceY × videoRect.height
```

`displayX` is the only mirror transform. `displayY` is not mirrored. This
matches the existing CSS `scaleX(-1)` video presentation while preserving
unmirrored canonical sensor data.

## Diagnostic integration

The production real-Pose Balloon Pop screen obtains `SpatialHandSnapshot` from
its existing `PoseGameplayInputRuntime` during the existing animation/update
path and passes it into `CameraPresentationStage`. It does not create another
camera, `PoseSensorSession`, MediaPipe task, or inference loop.

`CameraPresentationStage` observes its own rendered bounds with
`ResizeObserver` and listens for video metadata/dimension changes. The
diagnostic overlay therefore recalculates against real `videoWidth` /
`videoHeight` and current stage bounds across desktop resize and mobile
viewport/orientation changes. It has no pointer events and does not influence
Phaser, game state, camera lifecycle, or Motion Actions.

Only an `AVAILABLE` hand produces a labeled engineering marker (`左手` or
`右手`). Missing, low-confidence, stale, or lifecycle-reset hands are already
coordinate-free `UNAVAILABLE` values and render no marker.

## Deferred

- Phaser or game-world coordinate mapping;
- playfield offsets and collision coordinates;
- hand cursors as final game UI, swept segments, collision, scoring, or
  Balloon Rally physics;
- `FULL_BODY` / `UPPER_BODY` game framing selection changes;
- Hands Landmarker, recording, persistence, analytics, networking, and
  multiplayer.

The current Balloon Pop FULL_BODY readiness rule is unchanged.

## Manual validation before Phase 2A.4

### Windows desktop

1. Start the existing real-Pose Balloon Pop path and wait for a valid wrist.
2. Confirm `左手` follows the participant's anatomical left wrist and `右手`
   follows the anatomical right wrist in the mirrored preview.
3. Move each wrist to the visible source-video edges and center; confirm the
   marker follows the displayed video, not the letterbox/pillarbox background.
4. Resize the browser through wider, taller, and standard landscape aspect
   ratios; confirm markers continue to align.
5. Occlude a wrist or let tracking become stale; confirm its marker disappears
   and later recovers.

### iPhone Safari landscape

1. Repeat anatomical-side and edge/center checks using the front camera.
2. Rotate/reopen in landscape and exercise browser chrome/visual viewport
   changes; confirm the marker remains aligned after each layout change.
3. Confirm the marker remains readable at the expected viewing distance and
   that it never intercepts touch or changes normal game behavior.

No physical alignment result is claimed by this engineering phase.
