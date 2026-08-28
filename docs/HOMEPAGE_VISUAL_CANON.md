# Motion Arcade Homepage Visual Canon

Status: production HOME boundary (v2.1 polish)

## Responsibility boundary

- HOME is a React and CSS interface, not a Phaser scene.
- HOME must not initialize or import Phaser, MediaPipe, camera, or microphone capabilities.
- The Developer Input Lab remains behind the existing `TEST_INPUT_ENABLED` gate. It is React-lazy-loaded, and its Phaser playfield remains a separate lazy bundle.

## Canonical visual assets

HOME uses only the v2 standalone assets, at their supplied native dimensions:

- `/assets/home/home_lobby_bg_v2.webp`
- `/assets/home/category_sports_v2.webp`
- `/assets/home/category_party_v2.webp`
- `/assets/home/category_voice_v2.webp`
- `/assets/home/category_hand_v2.webp`

The SVG Motion Arcade mark is also used in the header. No v1 category references or pre-cropped production derivatives are allowed.

## DOM and runtime presentation

- Hero copy, brand text, category labels, selection state, and controls are DOM content; no UI text may be baked into artwork.
- The existing `GameCategory` taxonomy is authoritative: `SPORTS`, `PARTY`, `VOICE`, and `HAND`.
- HOME does not invent game counts, achievements, Settings, start buttons, routes, or fake category pages.
- Runtime CSS framing, including `object-fit: cover` and per-category `object-position`, is allowed to adapt standalone art to responsive cards. This must not modify source files or create cropped image derivatives.
- Keep selection discoverable by layout, scale, elevation, border, focus, and accessible state—not color alone.
