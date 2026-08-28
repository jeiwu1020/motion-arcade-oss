# Motion Arcade

Phase 0 architecture scaffold for a therapist-operated, browser-based motion game platform.

This repository intentionally contains no formal game. Its small Phaser scene proves that React, TypeScript, Vite, and Phaser 4 can build and that a `1280 × 720` logical canvas can mount with `FIT` scaling.

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

## Phase 0 documents

- [Master architecture](./docs/MASTER_ARCHITECTURE.md)
- [Motion input contract draft](./docs/MOTION_INPUT_CONTRACT_DRAFT.md)
- [Skills and API research](./docs/SKILLS_AND_RESEARCH.md)

## Non-negotiable boundaries

- Games consume normalized actions, never raw landmarks, camera frames, microphone samples, or device events.
- Camera and microphone data stays local. There is no recording, transcription, patient identity, backend, or upload path.
- Team count (one to four) is independent of simultaneous body tracking count.
- Real, simulated, and future replay input share one provider contract. Test input is developer-gated and must not request real sensor permissions.
- The first target is iPhone Safari in landscape. The logical playfield uses `FIT`; critical UI remains inside safe-area insets.

Phase 1 must not begin until the documented architecture decisions and open questions have been reviewed.
