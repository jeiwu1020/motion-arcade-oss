import { describe, expect, it } from 'vitest'

import {
  VoiceSignalAnalyzer,
  VOICE_SIGNAL_CONFIG,
} from './VoiceSignalAnalyzer'

function samplesForRms(rms: number): Float32Array {
  return new Float32Array([rms, -rms, rms, -rms])
}

describe('VoiceSignalAnalyzer', () => {
  it('maps silence to a bounded zero voice level', () => {
    const analyzer = new VoiceSignalAnalyzer({ smoothingAlpha: 1 })

    const output = analyzer.update(new Float32Array([0, 0, 0, 0]), 16)

    expect(output.level).toBe(0)
    expect(output.level).toBeGreaterThanOrEqual(0)
    expect(output.level).toBeLessThanOrEqual(1)
  })

  it('maps the configured noise-floor and full-level RMS boundaries deterministically', () => {
    const analyzer = new VoiceSignalAnalyzer({ smoothingAlpha: 1 })
    const atNoiseFloor = Math.pow(10, VOICE_SIGNAL_CONFIG.noiseFloorDb / 20)
    const atFullLevel = Math.pow(10, VOICE_SIGNAL_CONFIG.fullLevelDb / 20)

    expect(analyzer.update(samplesForRms(atNoiseFloor), 16).level).toBeCloseTo(0, 6)
    expect(analyzer.update(samplesForRms(atFullLevel), 16).level).toBeCloseTo(1, 6)
  })

  it('maps stronger RMS to a higher normalized level and clamps invalid samples', () => {
    const analyzer = new VoiceSignalAnalyzer({ smoothingAlpha: 1 })
    const quiet = analyzer.update(samplesForRms(0.002), 16).level
    const loud = analyzer.update(samplesForRms(0.1), 16).level
    const invalid = analyzer.update(new Float32Array([Number.NaN, Number.POSITIVE_INFINITY]), 16)

    expect(loud).toBeGreaterThan(quiet)
    expect(invalid.level).toBeGreaterThanOrEqual(0)
    expect(invalid.level).toBeLessThanOrEqual(1)
  })

  it('applies the configured EMA exactly', () => {
    const analyzer = new VoiceSignalAnalyzer({ smoothingAlpha: 0.35 })

    const first = analyzer.update(samplesForRms(0.1), 16)
    const second = analyzer.update(samplesForRms(0.1), 16)

    expect(first.level).toBeCloseTo(0.35 * ((20 * Math.log10(0.1) + 60) / 48), 6)
    expect(second.level).toBeCloseTo(
      first.level + (first.rawLevel - first.level) * 0.35,
      6,
    )
  })

  it('emits one trigger after two qualified samples and requires exit before rearming', () => {
    const analyzer = new VoiceSignalAnalyzer({ smoothingAlpha: 1 })
    const loud = samplesForRms(0.1)
    const quiet = samplesForRms(0.001)

    expect(analyzer.update(loud, 16).triggered).toBe(false)
    expect(analyzer.update(loud, 16).triggered).toBe(true)
    expect(analyzer.update(loud, 16).triggered).toBe(false)
    expect(analyzer.update(samplesForRms(0.02), 16).triggered).toBe(false)
    expect(analyzer.update(quiet, 16).triggered).toBe(false)
    expect(analyzer.update(loud, 16).triggered).toBe(false)
    expect(analyzer.update(loud, 16).triggered).toBe(true)
  })

  it('tracks sustained activity with hysteresis, exact elapsed time, and a four-second cap', () => {
    const analyzer = new VoiceSignalAnalyzer({ smoothingAlpha: 1 })
    const sustained = samplesForRms(0.05)

    expect(analyzer.update(sustained, 250).sustainedDurationSeconds).toBeCloseTo(0.25)
    expect(analyzer.update(sustained, 750).sustainedDurationSeconds).toBeCloseTo(1)
    expect(analyzer.update(samplesForRms(0.02), 100).sustainedDurationSeconds).toBeCloseTo(1.1)
    expect(analyzer.update(sustained, 10_000).sustainedDurationSeconds).toBe(4)
    expect(analyzer.update(samplesForRms(0.001), 16).sustainedDurationSeconds).toBe(0)
  })

  it('reset clears level, trigger state, and sustained duration', () => {
    const analyzer = new VoiceSignalAnalyzer({ smoothingAlpha: 1 })
    analyzer.update(samplesForRms(0.1), 16)
    analyzer.update(samplesForRms(0.1), 16)

    analyzer.reset()

    const output = analyzer.update(new Float32Array([0, 0]), 16)
    expect(output).toMatchObject({ level: 0, triggered: false, sustainedDurationSeconds: 0 })
  })
})
