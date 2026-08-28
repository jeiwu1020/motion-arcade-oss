# Motion Arcade

Phase 1A input foundation for a therapist-operated, browser-based motion game platform.

This repository intentionally contains no formal game and no real sensor implementation. The Developer Input Lab proves that one to four logical players can control a lazy-loaded `1280 × 720` Phaser view entirely through normalized keyboard, pointer, voice, and adaptive-profile simulation.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

## Architecture documents

- [Master architecture](./docs/MASTER_ARCHITECTURE.md)
- [Motion input contract](./docs/MOTION_INPUT_CONTRACT.md)
- [Developer test mode](./docs/DEVELOPER_TEST_MODE.md)
- [MediaPipe privacy and telemetry audit](./docs/MEDIAPIPE_PRIVACY_TELEMETRY.md)
- [Skills and API research](./docs/SKILLS_AND_RESEARCH.md)

## Non-negotiable boundaries

- Games consume normalized actions, never raw landmarks, camera frames, microphone samples, or device events.
- Camera and microphone data stays local. There is no recording, transcription, patient identity, backend, or upload path.
- Team count (one to four) is independent of simultaneous body tracking count.
- Real, simulated, and future replay input share one provider contract. Test input is developer-gated and must not request real sensor permissions.
- The first target is iPhone Safari in landscape. The logical playfield uses `FIT`; critical UI remains inside safe-area insets.
- Raw MediaPipe task input and MediaPipe SDK telemetry are separate privacy concerns; production sensor work must follow the documented audit.

Development exposes the Input Lab automatically. A production build hides it unless built explicitly with `VITE_ENABLE_TEST_INPUT=true`. `VITE_*` variables are client-visible and must never hold secrets.

Phase 1A stops at the normalized simulation boundary. Do not begin formal games or real MediaPipe/Web Audio providers without an explicitly reviewed next phase.
