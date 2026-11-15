import { describe, expect, it } from 'vitest'
import {
  benjaminiHochberg,
  mannKendall,
  olsSlope,
  senConfidenceInterval,
  senSlope,
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
