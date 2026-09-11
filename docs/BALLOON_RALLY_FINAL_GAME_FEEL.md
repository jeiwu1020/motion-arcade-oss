# Balloon Rally — Final Game Feel Pass

This bounded pass keeps the v3 sensor, spatial, collision, and relaxed tracking
architecture unchanged. It improves feedback and the final ten seconds.

## Audio

`BalloonRallyAudio` lazily creates a small Web Audio graph only after the
explicit camera-start button. It is fail-silent and does not request a
microphone, fetch audio, or autoplay. Short bounded tones cover normal hit/pop,
Golden pop, Giant hit/pop, Combo milestones, mini-event start, Party Rush,
countdown ticks, and round finish. Audio is disposed when the screen exits.

## Damage visuals

Production HP dots are removed. Standard HP 2 is clean; HP 1 uses a darker body
and a thick visible crack. Giant HP 4 is clean, HP 3/2 progressively crack, and
HP 1 uses multiple heavy cracks. Golden, Bonus, and Party balloons remain
one-hit targets without fake damage stages.

## Party Rush

Party Rush remains five one-hit targets at 50–55 seconds, escalates to six at
55 seconds and seven at 58 seconds, and ends at exactly 60 seconds. Its Combo
window is 2,000 ms (the normal window remains 1,500 ms). Party speed remains
capped at 420 logical pixels/second. The final 3/2/1 seconds show a brief large
countdown and tick cue while gameplay continues.

## Scope and validation

`SCORE_FEVER` is the canonical mini-event identifier. No Pose/runtime/spatial
contract, collision tolerance, tracking policy, camera lifecycle, or hand-glow
architecture changed. Windows Chrome, iPhone Safari landscape, projector
readability, audio gesture unlock, seven-target Party Rush performance, and
final countdown still require physical validation; no physical PASS is claimed.
