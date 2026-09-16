# Motion Arcade Roadmap

Motion Arcade is an active alpha project. This roadmap is intentionally directional rather than a promise of release dates.

## Current alpha baseline

Implemented foundations include normalized motion contracts, camera/Pose acquisition, motion analysis, calibration, adaptive capability profiles, camera presentation, deterministic game cores, local voice-signal input, and multiple playable game prototypes.

Current game work includes Balloon Rally, Reaction Arena, Runner, Rhythm Motion, Tennis, Badminton, Bowling, Running Race, Swimming, High Jump, Long Jump Challenge, Baseball, Vocal Hop, and Sound Cannon. Individual modules vary in physical-device validation status.

## Near-term priorities

- Complete OSS/publication hardening: licensing, asset provenance, security documentation, and reproducible setup.
- Build the multiplayer foundation and two-player body-interaction prototypes.
- Run systematic physical QA on iPhone Safari, compact spaces, projector readability, fatigue, and camera/microphone permission recovery.
- Expand regression coverage for motion recognition and sensor lifecycle behavior.
- Improve contributor-facing documentation for adding games and input providers.

## Later exploration

- Replayable motion-input regression fixtures.
- Additional adaptive profiles and calibration UX.
- More party / sports / voice game modules.
- Performance tiers for multi-person tracking where device capability permits.

See `docs/CURRENT_PHASE.md` and `docs/MASTER_IMPLEMENTATION_PLAN.md` for the detailed engineering plan.
