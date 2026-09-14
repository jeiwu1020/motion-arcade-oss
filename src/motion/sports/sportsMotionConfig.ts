/**
 * Provisional engineering thresholds for broad, body-relative arcade swings.
 * They are independent from POSE_MOTION_CONFIG and require physical QA later.
 */
export const SPORTS_MOTION_CONFIG = Object.freeze({
  enterSpeedBodyUnitsPerSecond: 1.0,
  rearmSpeedBodyUnitsPerSecond: 0.45,
  fullIntensitySpeedBodyUnitsPerSecond: 2.4,
  minimumCumulativeDisplacementBodyUnits: 0.14,
  minimumActiveSamples: 2,
  refractoryMs: 300,
  maximumSampleGapMs: 250,
  minimumBodyScale: 0.04,
  minimumDirectionAlignment: 0.35,
})
