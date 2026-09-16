# Security Policy

## Supported status

Motion Arcade is currently an alpha project. Security and privacy reports are still welcome, but the project should not be treated as a production medical system.

## Reporting a vulnerability

Please avoid filing a public issue for a vulnerability that could expose credentials, private data, camera/microphone data, or a reproducible exploit. After the repository becomes public, use GitHub's private vulnerability reporting / Security Advisory workflow when available.

When reporting, include:

- affected commit or version;
- reproduction steps;
- expected and observed behavior;
- impact;
- suggested mitigation, if known.

Do not include real patient data, recordings, screenshots, clinical records, API keys, tokens, or other secrets in a report.

## Privacy boundaries

Motion Arcade is designed so application code does not upload or persist raw camera frames, microphone samples, pose landmarks, or patient identity. Third-party SDK behavior is documented separately and must be reviewed before production use. See `docs/MEDIAPIPE_PRIVACY_TELEMETRY.md`.
