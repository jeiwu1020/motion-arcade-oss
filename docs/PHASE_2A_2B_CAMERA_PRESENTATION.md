# Phase 2A.2b — Camera Presentation Layer

Status: Engineering complete; Windows/iPhone functional physical checks PASS; brighter-AR retest and projector validation pending

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
- a projector-readable framing guide;
- status/guidance/action overlays;
- explicit playfield and foreground slots above the camera.

The component does not start or stop sensors, inspect Pose data, transform
coordinates, advance game time, or understand Balloon Pop scoring.

## State presentation

| Runtime/game state | Camera | Framing | Presentation |
|---|---|---|---|
| Camera not started | Hidden | Hidden | Large explicit 啟動相機 action |
| Permission starting | Dominant | Prominent | Camera-start guidance |
| Baselining | Dominant | Prominent | Current full-body positioning instruction |
| Ready/countdown | Dominant | Confirmed | Large READY treatment while Phaser counts down |
| Playing | Clear/lightly subdued | Subtle | Transparent Phaser playfield above visibly live camera |
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
  → framing guide and lifecycle UI
  → result foreground
```

Only `.camera-presentation-video` receives `transform: scaleX(-1)`. No source
frame, landmark, analyzer, action, or Phaser coordinate is changed. Anatomical
`REACH_LEFT` / `REACH_RIGHT` semantics remain canonical.

## Physical feedback refinement

Windows and iPhone functional testing found no other blocking issue, but the
initial gameplay treatment made the camera too dark for the desired Camera AR
feeling. The live player should remain clearly recognizable during play rather
than reading as a dim diagnostic background.

The presentation therefore keeps the same lifecycle modes but tunes them as
follows:

- DOMINANT is close to the natural live-camera brightness;
- gameplay SUBDUED remains slightly treated for balloon/HUD contrast, but is
  substantially brighter and more saturated than the first implementation;
- the gameplay scrim is reduced;
- RESULT remains intentionally dim because the result card is the primary focus.

This is presentation-only. Camera acquisition, Pose inference, mirroring
semantics, Game Core, and collision behavior are unchanged.

## Game-specific framing direction

The current route still uses a full-body guide because the existing STANDARD
Pose gameplay readiness requires full-body tracking. That is not intended as a
universal rule for future games.

Planned reusable framing requirements:

- `FULL_BODY`: lower-body / whole-body games such as JUMP, SQUAT, running, lane
  movement, or leg interaction;
- `UPPER_BODY`: hand/reach/arm/voice-centered games where knees and ankles do
  not contribute to the rules.

Later Camera Presentation should derive its guide and setup copy from the game's
framing requirement. Pose readiness should match that requirement rather than
forcing every game to show the same full-body silhouette. Balloon Rally is a
candidate for `UPPER_BODY` after spatial-hand interaction is validated.

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

- Brief Windows/iPhone retest of the brighter Camera AR treatment for player
  visibility and balloon/HUD contrast.
- Projector: framing-guide visibility, live-player visibility, camera/balloon
  contrast, HUD readability, and result/recovery comprehension from the intended
  viewing distance.
- Game-specific FULL_BODY versus UPPER_BODY framing behavior belongs to the
  upcoming spatial/framing work, not this presentation-only phase.
