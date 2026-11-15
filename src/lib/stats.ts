import type { SeriesPoint, TrendDirection, TrendStats } from '../types'

export interface XY {
  x: number
  y: number
}

export function mean(values: number[]): number {
  if (values.length === 0) return Number.NaN
  let total = 0
  for (const value of values) total += value
  return total / values.length
}

export function median(values: number[]): number {
  if (values.length === 0) return Number.NaN
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

/**
 * Chebyshev complementary error function (Numerical Recipes, 3rd ed.).
 * Relative accuracy ~1e-7 across the whole range, so the far tail of a strong
 * trend stays representable instead of cancelling to exactly zero.
 */
function erfc(x: number): number {
  const z = Math.abs(x)
  const t = 2 / (2 + z)
  const ty = 4 * t - 2
  const cof = [
    -1.3026537197817094, 0.6419697923564902, 0.019476473204185836,
    -0.00956151478680863, -0.000946595344482036, 0.000366839497852761,
    0.000042523324806907, -0.000020278578112534, -0.000001624290004647,
    0.00000130365583558, 1.5626441722e-8, -8.5238095915e-8,
    6.529054439e-9, 5.059343495e-9, -9.91364156e-10,
    -2.27365122e-10, 9.6467911e-11, 2.394038e-12,
    -6.886027e-12, 8.94487e-13, 3.13092e-13,
    -1.12708e-13, 3.81e-16, 7.106e-15,
  ]
  let d = 0
  let dd = 0
  for (let j = cof.length - 1; j > 0; j -= 1) {
    const tmp = d
    d = ty * d - dd + cof[j]
    dd = tmp
  }
  const ans = t * Math.exp(-z * z + 0.5 * (cof[0] + ty * d) - dd)
  return x >= 0 ? ans : 2 - ans
}

export function twoSidedP(z: number): number {
  if (z === 0) return 1
  return Math.min(1, Math.max(0, erfc(Math.abs(z) / Math.SQRT2)))
}

function sign(value: number): number {
  return value > 0 ? 1 : value < 0 ? -1 : 0
}

export function varianceS(values: number[]): number {
  const n = values.length
  if (n < 2) return 0
  const counts = new Map<number, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  let tieTerm = 0
  for (const count of counts.values()) {
    if (count > 1) tieTerm += count * (count - 1) * (2 * count + 5)
  }
  return (n * (n - 1) * (2 * n + 5) - tieTerm) / 18
}

export interface MannKendallResult {
  s: number
  z: number
  p: number
  tau: number
  direction: TrendDirection
}

export function mannKendall(values: number[]): MannKendallResult {
  const n = values.length
  if (n < 3) {
    return { s: 0, z: 0, p: 1, tau: 0, direction: 'flat' }
  }
  let s = 0
  for (let i = 0; i < n - 1; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      s += sign(values[j] - values[i])
    }
  }
  const variance = varianceS(values)
  const z =
    variance > 0
      ? s > 0
        ? (s - 1) / Math.sqrt(variance)
        : s < 0
          ? (s + 1) / Math.sqrt(variance)
          : 0
      : 0
  const direction: TrendDirection = s > 0 ? 'up' : s < 0 ? 'down' : 'flat'
  return {
    s,
    z,
    p: twoSidedP(z),
    tau: s / ((n * (n - 1)) / 2),
    direction,
  }
}

export function pairwiseSlopes(points: XY[]): number[] {
  const slopes: number[] = []
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const dx = points[j].x - points[i].x
      if (dx !== 0) slopes.push((points[j].y - points[i].y) / dx)
    }
  }
  return slopes.sort((a, b) => a - b)
}

export function senSlope(points: XY[]): number {
  return median(pairwiseSlopes(points))
}

/** Rank-based Sen confidence interval (Sen, 1968). */
export function senConfidenceInterval(
  points: XY[],
  alpha = 0.05,
): [number, number] {
  const slopes = pairwiseSlopes(points)
  if (slopes.length === 0) return [Number.NaN, Number.NaN]
  const variance = varianceS(points.map((p) => p.y))
  const zCrit = alpha === 0.05 ? 1.959964 : 1.644854
  const width = zCrit * Math.sqrt(variance)
  const n = slopes.length
  const lowIndex = Math.max(1, Math.round((n - width) / 2))
  const highIndex = Math.min(n, Math.round((n + width) / 2))
  return [slopes[lowIndex - 1], slopes[highIndex - 1]]
}

export function olsSlope(points: XY[]): { slope: number; intercept: number } {
  if (points.length < 2) return { slope: 0, intercept: Number.NaN }
  const mx = mean(points.map((p) => p.x))
  const my = mean(points.map((p) => p.y))
  let sxx = 0
  let sxy = 0
  for (const point of points) {
    sxx += (point.x - mx) ** 2
    sxy += (point.x - mx) * (point.y - my)
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  return { slope, intercept: my - slope * mx }
}

export function trendFromPoints(points: SeriesPoint[]): TrendStats {
  const xs: XY[] = points.map((point) => ({ x: point.year, y: point.value }))
  const mk = mannKendall(points.map((point) => point.value))
  const slope = senSlope(xs)
  const [ciLow, ciHigh] = senConfidenceInterval(xs)
  const ols = olsSlope(xs)
  const slopePerDecade = slope * 10
  return {
    slopePerYear: slope,
    slopePerDecade,
    ciLow: ciLow * 10,
    ciHigh: ciHigh * 10,
    intercept: ols.intercept,
    p: mk.p,
    z: mk.z,
    s: mk.s,
    tau: mk.tau,
    n: points.length,
    significant: mk.p < 0.05 && points.length >= 15,
    direction: mk.direction,
  }
}

export interface BHResult {
  q: number[]
  reject: boolean[]
}

/** Benjamini–Hochberg false discovery rate control. */
export function benjaminiHochberg(pValues: number[], alpha = 0.05): BHResult {
  const m = pValues.length
  if (m === 0) return { q: [], reject: [] }
  const order = pValues
    .map((p, index) => ({ p, index }))
    .sort((a, b) => a.p - b.p)
  const q = new Array<number>(m).fill(1)
  let running = 1
  for (let rank = m; rank >= 1; rank -= 1) {
    const entry = order[rank - 1]
    running = Math.min(running, (entry.p * m) / rank)
    q[entry.index] = Math.min(1, running)
  }
  return { q, reject: q.map((value) => value <= alpha) }
}

export function pearson(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length)
  if (n < 3) return Number.NaN
  const mx = mean(x.slice(0, n))
  const my = mean(y.slice(0, n))
  let sxx = 0
  let syy = 0
  let sxy = 0
  for (let i = 0; i < n; i += 1) {
    const dx = x[i] - mx
    const dy = y[i] - my
    sxx += dx * dx
    syy += dy * dy
    sxy += dx * dy
  }
  const denominator = Math.sqrt(sxx * syy)
  return denominator === 0 ? Number.NaN : sxy / denominator
}
