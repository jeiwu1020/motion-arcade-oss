# Phase 2A.2b — Camera Presentation Layer

Status: Engineering complete; Windows/iPhone/projector physical validation pending

## Scope

Phase 2A.2b turns the existing production Pose video element into a reusable
Camera AR presentation without changing acquisition, inference, motion
analysis, normalized actions, or Balloon Pop rules.

The runtime path remains:

```text
one mirrored DOM video presentation
              ▲
CameraController → PoseSensorSession → PoseMotionInputProvider
                                      → normalized REACH actions → Game Core
```

There is still one camera stream, one MediaPipe pipeline, and one
`PoseGameplayInputRuntime`. Camera frames are not copied into Phaser, recorded,
persisted, or uploaded.

## Reusable presentation boundary

`CameraPresentationStage` and `resolveCameraPresentation` live outside the
Balloon Pop folder. They provide the smallest shared boundary needed by later
Camera AR games:

- a single full-stage `<video>` receiving the runtime-bound stream;
- display-only CSS mirroring;
- camera treatments for dominant, subdued, dimmed, and hidden states;
- a projector-readable full-body frame guide;
- status/guidance/action overlays;
- explicit playfield and foreground slots above the camera.

The component does not start or stop sensors, inspect Pose data, transform
coordinates, advance game time, or understand Balloon Pop scoring.

## State presentation

| Runtime/game state | Camera | Framing | Presentation |
|---|---|---|---|
| Camera not started | Hidden | Hidden | Large explicit 啟動相機 action |
| Permission starting | Dominant | Prominent | Camera-start guidance |
| Baselining | Dominant | Prominent | Full-body positioning instruction |
| Ready/countdown | Dominant | Confirmed | Large READY treatment while Phaser counts down |
| Playing | Subdued | Subtle | Transparent Phaser playfield above live camera |
| Tracking lost | Dominant | Prominent | Game remains paused; 請回到畫面中 guidance |
| Error | Hidden/released | Hidden | Readable retry action |
| Result | Dimmed when healthy | Hidden | Result card above the retained live camera |

Replay resets only the Game Core and reuses the healthy runtime. Return Home,
unmount, error, hidden, and pagehide cleanup remain owned by the existing
runtime/session boundary.

## Rendering and mirror boundary

Production Balloon Pop selects a `CAMERA_AR` Phaser presentation. It keeps the
logical `1280 × 720` FIT canvas but makes the renderer and scene background
transparent. The development/test presentation remains opaque and retains its
Z/C test labels.

Layer order is:

```text
mirrored DOM video (`object-fit: contain`)
  → restrained DOM treatment/scrim
  → transparent Phaser canvas
  → full-body guide and lifecycle UI
  → result foreground
```

Only `.camera-presentation-video` receives `transform: scaleX(-1)`. No source
frame, landmark, analyzer, action, or Phaser coordinate is changed. Anatomical
`REACH_LEFT` / `REACH_RIGHT` semantics remain canonical.

## Landscape decisions

- The active shell stays fixed to `100dvh` with overflow hidden.
- All outer padding continues to include the four safe-area insets.
- The camera uses `object-fit: contain`, so positioning is never confused by
  silent video cropping; letterboxing is acceptable.
- The guide, status copy, score, timer, and controls use viewport-bounded large
  sizing and a compact short-landscape treatment.
- The playfield remains 16:9 FIT and does not resize or reset sensor/game state
  when the visual viewport changes.
- Nonessential transitions are disabled under reduced-motion preference.

## Automated coverage

Focused tests cover every presentation state, result composition, readable
error/retry, one-video layer ordering, display-only mirror marking, production
real-Pose selection, development test-provider selection, tracking-loss pause,
runtime cleanup, and reuse of an already-running camera/session.

Game Core rules and tests are unchanged.

## Physical validation still required

- Windows Chrome: real camera framing, permission/error/retry, baseline/READY,
  tracking-loss recovery, replay reuse, Home/unmount release, and readability.
- iPhone Safari landscape: front-camera aspect ratio, Dynamic Island/safe areas,
  browser chrome changes, full-body framing distance, page lifecycle, and heat.
- Projector: full-body guide visibility, camera/balloon contrast, HUD readability,
  and result/recovery comprehension from the intended viewing distance.

No physical result is claimed PASS by this engineering phase.
