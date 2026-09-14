/** Provisional engineering constants for compact-space alternating knee lifts. */
export const LOCOMOTION_CONFIG = Object.freeze({
  smoothingAlpha: 0.55,
  enterKneeDifferenceBodyUnits: 0.16,
  exitKneeDifferenceBodyUnits: 0.07,
  fullLiftDifferenceBodyUnits: 0.4,
  minimumCandidateSamples: 2,
  minimumStepIntervalMs: 220,
  maximumCadenceIntervalMs: 1400,
  cadenceWindowStepCount: 6,
  cadenceHoldMs: 450,
  cadenceZeroAfterMs: 1200,
  maximumContinuityGapMs: 250,
  minimumBodyScale: 0.04,
  neutralAdaptationAlpha: 0.08,
  maximumCadenceSpm: 240,
  fullIntensityCadenceSpm: 180,
})
