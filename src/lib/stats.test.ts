import { describe, expect, it } from 'vitest'
import {
  autocorrelation,
  benjaminiHochberg,
  mannKendall,
  olsSlope,
  senConfidenceInterval,
  senSlope,
  serialCorrectionFactor,
  trendFromPoints,
} from './stats'

describe('mannKendall', () => {
  it('detects a perfect increasing series', () => {
    const values = Array.from({ length: 20 }, (_, index) => index + 1)
    const result = mannKendall(values)
    expect(result.s).toBe(190)
    expect(result.tau).toBe(1)
    expect(result.direction).toBe('up')
    expect(result.p).toBeLessThan(1e-6)

    const longest = mannKendall(Array.from({ length: 35 }, (_, index) => index + 1))
    expect(longest.p).toBeGreaterThan(0)
    expect(Number.isFinite(longest.p)).toBe(true)
  })

  it('detects a perfect decreasing series', () => {
    const values = Array.from({ length: 20 }, (_, index) => 20 - index)
    const result = mannKendall(values)
    expect(result.s).toBe(-190)
    expect(result.direction).toBe('down')
    expect(result.p).toBeLessThan(1e-6)
  })

  it('returns no trend for tied values', () => {
    const result = mannKendall([4, 4, 4, 4, 4, 4, 4])
    expect(result.s).toBe(0)
    expect(result.p).toBe(1)
    expect(result.direction).toBe('flat')
  })

  it('applies a tie correction', () => {
    const tied = mannKendall([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
    const untied = mannKendall([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(tied.p).toBeGreaterThan(untied.p)
  })
})

describe('sen slope', () => {
  it('recovers a linear slope exactly', () => {
    const points = Array.from({ length: 30 }, (_, index) => ({
      x: 1991 + index,
      y: 5 + 0.4 * index,
    }))
    expect(senSlope(points)).toBeCloseTo(0.4, 10)
  })

  it('returns a degenerate interval for a perfect line', () => {
    const points = Array.from({ length: 35 }, (_, index) => ({
      x: 1991 + index,
      y: 2 * index,
    }))
    const [low, high] = senConfidenceInterval(points)
    expect(low).toBeCloseTo(2, 10)
    expect(high).toBeCloseTo(2, 10)
  })

  it('brackets the slope when observations are noisy', () => {
    const offsets = [0.4, -0.2, 0.7, -0.5, 0.1, -0.3, 0.2, -0.6, 0.5, -0.1]
    const points = Array.from({ length: 35 }, (_, index) => ({
      x: 1991 + index,
      y: 10 + 0.25 * index + offsets[index % offsets.length],
    }))
    const slope = senSlope(points)
    const [low, high] = senConfidenceInterval(points)
    expect(low).toBeLessThan(slope)
    expect(high).toBeGreaterThan(slope)
    expect(slope).toBeCloseTo(0.25, 2)
  })

  // Reference values from scipy.stats.theilslopes(..., alpha=0.95), which
  // implements the same equation 2.6 of Sen (1968).
  it('matches the reference implementation on a noisy series', () => {
    const offsets = [0.4, -0.2, 0.7, -0.5, 0.1, -0.3, 0.2, -0.6, 0.5, -0.1]
    const points = Array.from({ length: 35 }, (_, index) => ({
      x: 1991 + index,
      y: 10 + 0.25 * index + offsets[index % offsets.length],
    }))
    const [low, high] = senConfidenceInterval(points)
    expect(low).toBeCloseTo(0.23275862069, 10)
    expect(high).toBeCloseTo(0.266666666667, 10)
  })

  it('matches the reference implementation when values are tied', () => {
    const values = [3, 3, 4, 5, 5, 6, 7, 7, 8, 9, 9, 10, 11, 12, 12, 13]
    const points = values.map((y, index) => ({ x: 1991 + index, y }))
    const [low, high] = senConfidenceInterval(points)
    expect(low).toBeCloseTo(0.666666666667, 10)
    expect(high).toBeCloseTo(0.727272727273, 10)
  })
})

describe('trendFromPoints', () => {
  it('reports a per-decade slope and significance', () => {
    const points = Array.from({ length: 35 }, (_, index) => ({
      year: 1991 + index,
      value: 20 + 0.12 * index,
      months: 12,
    }))
    const trend = trendFromPoints(points)
    expect(trend.slopePerDecade).toBeCloseTo(1.2, 6)
    expect(trend.significant).toBe(true)
    expect(trend.n).toBe(35)
  })
})

// Synthetic AR(1) series (rho = 0.75 plus a 0.08/step drift, numpy seed 20261115).
// Reference values from pymannkendall 1.4.3: original_test p = 3.1257819888e-08,
// hamed_rao_modification_test p = 2.6273073857e-05, var_s = 12768.779471544716.
const AR1 = [
  0.0173257474, -0.1215141996, -1.4324217901, -1.4656181256, -1.7636671698,
  -1.3185065579, -1.4318745087, -0.5303421787, -1.3564051188, -1.2069299921,
  -2.2809893648, -1.8264256696, -1.7674361212, -1.1899635352, -2.1569047554,
  -0.2057801345, 0.4313116432, -0.1427849131, 0.027225971, -1.1950708016,
  -1.2530187007, 1.1025453536, -0.1767022641, 0.926916059, 0.1787053934,
  0.6733709085, 1.0663291232, 2.3714016475, -0.355917038, -0.5000337265,
  0.3509426506, 1.0597363494, 1.7852344109, 1.7502167016, 1.3027896653,
  1.7765539439, 3.4259665999, 3.8212939477, 4.4131292259, 4.1114210146,
]

describe('serial correlation correction', () => {
  it('measures lag-1 persistence with the standard acf divisor', () => {
    expect(autocorrelation([1, 2, 3, 4, 5], 0)).toBe(1)
    expect(autocorrelation([4, 4, 4, 4], 1)).toBe(0)
    expect(autocorrelation([1, 2, 3, 4, 5], 1)).toBeCloseTo(0.4, 10)
    expect(autocorrelation(AR1, 1)).toBeGreaterThan(0.6)
  })

  it('inflates the variance of a persistent series', () => {
    const points = AR1.map((y, index) => ({ x: index + 1, y }))
    const { factor, lags } = serialCorrectionFactor(points, senSlope(points))
    expect(lags).toBeGreaterThan(0)
    expect(factor * 7366.666666666667).toBeCloseTo(12768.779471544716, 6)
  })

  it('matches the reference corrected p value', () => {
    const trend = trendFromPoints(
      AR1.map((value, index) => ({ year: 1991 + index, value, months: 12 })),
    )
    expect(trend.s).toBe(476)
    expect(trend.p).toBeCloseTo(3.1257819888e-8, 14)
    expect(trend.zAdjusted).toBeCloseTo(4.203576122333443, 8)
    expect(trend.pAdjusted).toBeCloseTo(2.6273073857e-5, 12)
    expect(trend.pAdjusted).toBeGreaterThan(trend.p)
  })

  it('leaves an independent series untouched', () => {
    const points = Array.from({ length: 35 }, (_, index) => ({
      x: 1991 + index,
      y: 20 + 0.12 * index,
    }))
    const { factor, lags } = serialCorrectionFactor(points, senSlope(points))
    expect(lags).toBe(0)
    expect(factor).toBe(1)
  })

  it('skips the correction when the record is too short to estimate lags', () => {
    const points = Array.from({ length: 8 }, (_, index) => ({ x: index, y: index * 2 }))
    expect(serialCorrectionFactor(points, 2).factor).toBe(1)
  })
})

describe('benjaminiHochberg', () => {
  it('computes monotone q values', () => {
    const { q, reject } = benjaminiHochberg([0.01, 0.02, 0.03, 0.04, 0.05])
    expect(q.every((value) => Math.abs(value - 0.05) < 1e-12)).toBe(true)
    expect(reject.every(Boolean)).toBe(true)
  })

  it('keeps large p values above the threshold', () => {
    const { q, reject } = benjaminiHochberg([0.001, 0.03, 0.2, 0.9])
    expect(q[0]).toBeCloseTo(0.004, 10)
    expect(reject[0]).toBe(true)
    expect(reject[3]).toBe(false)
  })
})

describe('olsSlope', () => {
  it('matches the least-squares slope', () => {
    const points = [
      { x: 1, y: 2 },
      { x: 2, y: 4 },
      { x: 3, y: 6 },
    ]
    expect(olsSlope(points).slope).toBeCloseTo(2, 10)
  })
})
