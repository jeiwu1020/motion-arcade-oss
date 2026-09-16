# Contributing to Motion Arcade

Motion Arcade is in active alpha development. Contributions are welcome after the repository becomes public.

## Development setup

```bash
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

## Project boundaries

Please preserve these architectural rules:

- Games consume normalized motion/voice actions rather than raw camera frames, landmarks, microphone samples, or DOM device events.
- Camera and microphone permissions must require an explicit user action.
- Raw camera frames, audio samples, landmarks, patient names, stable identifiers, and clinical records must never be committed, persisted, logged, or uploaded.
- Accessibility adaptations should be capability-based, not diagnosis-based.
- Shared sensor thresholds should not be changed to fix one game without evidence that the shared change is appropriate.
- New games should keep deterministic game logic separate from Phaser presentation where practical.

## Pull requests

Before opening a pull request:

1. Keep the change focused.
2. Add or update tests for behavior changes.
3. Run typecheck, lint, tests, and build locally.
4. Update the relevant architecture or phase document when a contract or project boundary changes.
5. Do not add third-party images, audio, models, fonts, or other assets without documenting their provenance and redistribution terms in `ASSET_LICENSES.md` or `THIRD_PARTY_NOTICES.md`.

## Privacy-sensitive changes

Changes involving camera, microphone, MediaPipe, analytics, persistence, networking, identity, or clinical deployment require an explicit privacy review. See `docs/MEDIAPIPE_PRIVACY_TELEMETRY.md`.
