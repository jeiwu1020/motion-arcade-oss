# Phase 2A.3c — Spatial Collision Prototype

Status: engineering implementation; real Windows and iPhone collision checks
remain required

## Scope

This narrow validation slice proves the complete path from the existing
canonical Pose-wrist sample to a single temporary Phaser collision target. It
does not rewrite Balloon Pop into Balloon Rally or change Balloon Pop scoring.

```text
SpatialHandSnapshot
  → existing source-to-mirrored-stage mapping
  → Phaser Scale.FIT logical-world mapping
  → session-local logical hand sample / optional motion segment
  → swept circle contact
  → temporary Camera AR collision probe
```

`SpatialHandSnapshot` remains unchanged: anatomical hand identity and
unmirrored camera-source coordinates stay at the sensor boundary.

## Stage to Phaser mapping

`src/spatial/spatialPlayfieldMapping.ts` provides pure helpers for the
centered `1280 × 720` Phaser `Scale.FIT` rectangle:

- `calculateLogicalPlayfieldFitRect` resolves its stage-local rectangle;
- `mapCameraStagePointToLogicalPlayfield` maps only points inside that visible
  rectangle and returns `null` for Phaser letterbox/pillarbox space;
- `mapSpatialHandToLogicalPlayfield` composes the existing Phase 2A.3b
  source-to-mirrored-stage map with the FIT map;
- `calculateCameraVisibleLogicalWorldRect` returns the logical-world region
  jointly occupied by the actual contained camera image and Phaser canvas.

No coordinate is clamped. A hand without a valid mapped logical point has no
collision coordinate. The camera-visible world rectangle lets future Balloon
Rally targets avoid empty camera letterbox/pillarbox areas.

## Logical hand continuity

`SpatialCollisionInputAdapter` owns short-lived session-local logical hand
history. An available hand exposes a current logical point and, only when
continuity is valid, a `{ from, to }` segment. It breaks continuity on:

- unavailable / stale tracking;
- mapping outside the Phaser FIT rectangle;
- geometry changes such as resize;
- timestamp or sequence rollback indicating a new generation;
- explicit reset / screen teardown.

A recovered hand begins with a point and no segment. The adapter has no DOM,
MediaPipe, camera, Phaser-object, or Game Core dependency; it only consumes the
immutable spatial contract and numeric presentation geometry.

## Swept contact and re-hit behavior

`src/spatial/spatialCollision.ts` contains framework-independent circle
collision helpers. `doesSegmentIntersectCircle` checks the closest point on a
segment, so a fast wrist path counts even when neither endpoint is inside.

`SpatialCircleContactTracker` tracks contact separately for `LEFT` and
`RIGHT`, and per target. It emits one hit on outside-to-contact transition,
suppresses held overlap, resets contact when a hand becomes unavailable, and
allows a new hit after the hand leaves and re-enters. Repeated render updates
of the same logical sample do not repeat a hit.

## Temporary Camera AR probe

Only the real-Pose Balloon Pop Camera AR presentation receives the adapter.
Its Phaser scene renders one engineering target at the center of the calculated
camera-visible logical region during active gameplay. The target uses an
explicit prototype radius of `112` logical units with a `16`-unit fitting
margin, shows an independent hit count, flashes/pulses, and reports whether
`左手` or `右手` caused the last hit.

This probe consumes actual mapped wrist positions and swept segments. It does
not consume `REACH_LEFT` / `REACH_RIGHT`, modify Balloon Pop state, alter its
score/results, or add a second sensor stream. The Phase 2A.3b `空間校驗`
markers remain available through an explicit `showSpatialDiagnostic` flag;
future normal presentation can omit that flag.

## Phase 2A.3b validation status

Phase 2A.3b is **Engineering PASS + Windows Chrome physical PASS + iPhone
Safari physical PASS**: its mirrored anatomical wrist markers tracked the
correct visible hands. Projector validation remains part of final game
production testing, not a blocker for this collision prototype.

## Deferred

- multiple persistent balloons, physics, HP, pop bonus, Party Rush, and final
  Balloon Rally rules/art;
- Phaser world spawning/target policy beyond this one probe;
- `UPPER_BODY` framing/readiness changes;
- MediaPipe Hands, microphone, avatar, multiplayer, persistence, analytics,
  or recording.

## Manual validation required

### Windows Chrome

1. Start the production real-Pose Balloon Pop path and wait until gameplay is
   READY / active.
2. Confirm the existing `左手` / `右手` DOM markers remain aligned to mirrored
   anatomical wrists while the Phaser probe is visible.
3. Move either wrist through the target with a fast pass; confirm one immediate
   hit even if the wrist is not held inside.
4. Hold a wrist inside the target; confirm the independent probe counter does
   not increase repeatedly.
5. Leave and re-enter with each anatomical hand; confirm each entry adds one
   hit and the side feedback is correct.
6. Occlude a wrist or lose tracking; confirm no stale sweep or hit occurs on
   recovery. Resize the browser and repeat one pass.
7. Confirm Balloon Pop score, target loop, countdown, result, and camera
   lifecycle remain unchanged by probe hits.

### iPhone Safari landscape

1. Repeat left/right, fast-pass, held-overlap, leave/re-enter, and recovery
   checks with the front camera.
2. Rotate/reopen in landscape and exercise browser chrome/visual viewport
   changes; confirm the target stays inside the camera image and collisions
   remain aligned.
3. Confirm the diagnostic/probe does not intercept touch or create a second
   camera permission request.

No physical collision result is claimed by this engineering implementation.
