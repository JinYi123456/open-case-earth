import type {
  AnnualSeries,
  GridCell,
  PointAnalysis,
  SeasonalTrend,
  SeasonId,
  SeriesPoint,
  SignalSummary,
  SpatialSummary,
  TrendStats,
  VariableDef,
  VariableId,
  Verdict,
} from '../types'
import { VARIABLE_MAP } from '../data/variables'
import { confidenceFromP, fmt, pValue, signed } from './format'
import { STRENGTH_LABEL, evidenceScore, evidenceStrength, type EvidenceRow } from './evidence'
import { mean, benjaminiHochberg, olsSlope, trendFromPoints } from './stats'
import { FETCH_START_YEAR, RECORD_END_YEAR, type MonthlyRecord } from './power'

export const BASELINE_START = 1991
export const BASELINE_END = 2020

const SEASONS: Array<{
  id: SeasonId
  label: string
  monthsLabel: string
  months: Array<{ offset: number; month: number }>
}> = [
  {
    id: 'DJF',
    label: 'Dec–Feb',
    monthsLabel: 'Winter',
    months: [
      { offset: -1, month: 12 },
      { offset: 0, month: 1 },
      { offset: 0, month: 2 },
    ],
  },
  {
    id: 'MAM',
    label: 'Mar–May',
    monthsLabel: 'Spring',
    months: [
      { offset: 0, month: 3 },
      { offset: 0, month: 4 },
      { offset: 0, month: 5 },
    ],
  },
  {
    id: 'JJA',
    label: 'Jun–Aug',
    monthsLabel: 'Summer',
    months: [
      { offset: 0, month: 6 },
      { offset: 0, month: 7 },
      { offset: 0, month: 8 },
    ],
  },
  {
    id: 'SON',
    label: 'Sep–Nov',
    monthsLabel: 'Autumn',
    months: [
      { offset: 0, month: 9 },
      { offset: 0, month: 10 },
      { offset: 0, month: 11 },
    ],
  },
]

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

function key(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

function minMonths(def: VariableDef): number {
  return def.aggregate === 'sum' ? 12 : 10
}

export function aggregateAnnual(monthly: MonthlyRecord, def: VariableDef): AnnualSeries {
  const points: SeriesPoint[] = []
  for (let year = def.recordStart; year <= RECORD_END_YEAR; year += 1) {
    let total = 0
    let months = 0
    for (let month = 1; month <= 12; month += 1) {
      const value = monthly[key(year, month)]
      if (value === undefined) continue
      months += 1
      total +=
        def.aggregate === 'sum'
          ? value * def.scale * daysInMonth(year, month)
          : value * def.scale
    }
    if (months >= minMonths(def)) {
      points.push({
        year,
        value: def.aggregate === 'sum' ? total : total / months,
        months,
      })
    }
  }
  return {
    points,
    yearsExpected: RECORD_END_YEAR - def.recordStart + 1,
    yearsAvailable: points.length,
  }
}

export function aggregateSeason(
  monthly: MonthlyRecord,
  def: VariableDef,
  season: (typeof SEASONS)[number],
): SeriesPoint[] {
  const points: SeriesPoint[] = []
  for (let year = def.recordStart; year <= RECORD_END_YEAR; year += 1) {
    let total = 0
    let months = 0
    for (const entry of season.months) {
      const targetYear = year + entry.offset
      if (targetYear < FETCH_START_YEAR) continue
      const value = monthly[key(targetYear, entry.month)]
      if (value === undefined) continue
      months += 1
      total +=
        def.aggregate === 'sum'
          ? value * def.scale * daysInMonth(targetYear, entry.month)
          : value * def.scale
    }
    const required = def.aggregate === 'sum' ? 3 : 2
    if (months >= required) {
      points.push({
        year,
        value: def.aggregate === 'sum' ? total : total / months,
        months,
      })
    }
  }
  return points
}

export function analysisFromMonthly(monthly: MonthlyRecord, def: VariableDef): PointAnalysis {
  const annual = aggregateAnnual(monthly, def)
  if (annual.points.length < 10) {
    throw new Error('There are not enough complete years at this point to test a trend.')
  }
  const trend = trendFromPoints(annual.points)
  const ols = olsSlope(annual.points.map((p) => ({ x: p.year, y: p.value })))

  const baselineStart = Math.max(BASELINE_START, def.recordStart)
  const baselinePoints = annual.points.filter(
    (p) => p.year >= baselineStart && p.year <= BASELINE_END,
  )
  const baseline = mean(
    (baselinePoints.length >= 20 ? baselinePoints : annual.points).map((p) => p.value),
  )

  const trimmedPoints = annual.points.filter(
    (p) => p.year >= def.recordStart + 3 && p.year <= RECORD_END_YEAR - 3,
  )
  const trimmed = trendFromPoints(trimmedPoints)

  const seasonal: SeasonalTrend[] = SEASONS.map((season) => {
    const points = aggregateSeason(monthly, def, season)
    const seasonTrend = trendFromPoints(points)
    return {
      season: season.id,
      label: season.label,
      monthsLabel: season.monthsLabel,
      points,
      slopePerDecade: seasonTrend.slopePerDecade,
      p: seasonTrend.p,
      significant: seasonTrend.significant,
      direction: seasonTrend.direction,
    }
  })

  const first = annual.points[0]
  const latest = annual.points[annual.points.length - 1]
  const earlyPoints = annual.points.filter((p) => p.year <= 2005)
  const latePoints = annual.points.filter((p) => p.year >= 2011)
  const peak = annual.points.reduce((a, b) => (b.value > a.value ? b : a))
  const trough = annual.points.reduce((a, b) => (b.value < a.value ? b : a))

  return {
    annual,
    trend,
    trimmed,
    olsSlopePerDecade: ols.slope * 10,
    anomaly: annual.points.map((point) => ({
      ...point,
      value: point.value - baseline,
    })),
    baseline,
    baselineStart,
    baselineEnd: BASELINE_END,
    baselineYears: (baselinePoints.length >= 20 ? baselinePoints : annual.points).length,
    seasonal,
    first,
    latest,
    observedChange: latest.value - first.value,
    modelledChange: trend.slopePerYear * (latest.year - first.year),
    earlyMean: mean(earlyPoints.map((p) => p.value)),
    lateMean: mean(latePoints.map((p) => p.value)),
    peak,
    trough,
  }
}

export function signalFor(monthly: MonthlyRecord, variable: VariableId): SignalSummary {
  const def = VARIABLE_MAP[variable]
  const annual = aggregateAnnual(monthly, def)
  const trend = trendFromPoints(annual.points)
  return {
    variable,
    points: annual.points,
    trend,
    q: trend.pAdjusted,
    survivesFdr: trend.significant,
  }
}

/** The eight signals are eight tests at one point, so they are adjusted together. */
export function adjustSignals(
  signals: Partial<Record<VariableId, SignalSummary>>,
): Partial<Record<VariableId, SignalSummary>> {
  const entries = Object.values(signals).filter(
    (signal): signal is SignalSummary => signal !== undefined,
  )
  if (entries.length === 0) return signals
  const { q } = benjaminiHochberg(entries.map((signal) => signal.trend.pAdjusted))
  const output: Partial<Record<VariableId, SignalSummary>> = { ...signals }
  entries.forEach((signal, index) => {
    output[signal.variable] = {
      ...signal,
      q: q[index],
      survivesFdr: q[index] <= 0.05 && signal.trend.n >= 15,
    }
  })
  return output
}

export function buildVerdict(
  placeName: string,
  def: VariableDef,
  analysis: PointAnalysis,
  evidence: EvidenceRow[],
): Verdict {
  const { trend } = analysis
  const tone = trend.significant ? (trend.direction === 'down' ? 'down' : 'up') : 'flat'
  const title = trend.significant
    ? trend.direction === 'down'
      ? def.downLabel
      : def.upLabel
    : analysis.annual.points.length < 15
      ? 'Record too short'
      : 'No clear trend'

  const magnitude = `${fmt(Math.abs(trend.slopePerDecade), def.slopeDecimals)}${def.slopeUnit ? ` ${def.slopeUnit}` : ''} per decade`
  const rate = `${signed(trend.slopePerDecade, def.slopeDecimals, def.slopeUnit)} per decade`
  const change = `${signed(analysis.modelledChange, def.decimals, def.annualUnit)}`
  const verb = trend.direction === 'down' ? def.downVerb : def.upVerb

  const strength = evidenceStrength(evidence, trend.significant)
  const settled = evidence.filter((row) => row.status !== 'pending')
  const score = evidenceScore(settled)
  const scoreText = score % 1 === 0 ? String(score) : score.toFixed(1)
  const supportLine =
    settled.length === 0
      ? 'Cross-checks still running'
      : `${scoreText} of ${settled.length} evidence checks support this reading`

  const base = trend.significant
    ? `${def.short} at ${placeName} ${verb} by ${magnitude} between ${analysis.first.year} and ${analysis.latest.year} — a modelled change of ${change} across the record. The ordering is unlikely to be chance (Mann–Kendall p = ${pValue(trend.pAdjusted)}, corrected for serial correlation).`
    : `${def.short} at ${placeName} moved by ${rate} between ${analysis.first.year} and ${analysis.latest.year}, but the record cannot separate that from natural variability (Mann–Kendall p = ${pValue(trend.pAdjusted)}, corrected for serial correlation).`

  const qualifier =
    strength === 'established'
      ? ' The cross-checks agree, so the reading is graded established.'
      : strength === 'probable'
        ? ' Some cross-checks only partly agree, so the reading is graded probable rather than established.'
        : strength === 'tentative'
          ? ' The cross-checks disagree often enough that the reading stays tentative.'
          : ''

  return {
    title,
    tone,
    strength,
    strengthLabel: STRENGTH_LABEL[strength],
    supportLine,
    summary: `${base}${qualifier}`,
    confidenceLine: `${confidenceFromP(trend.pAdjusted)} confidence · p = ${pValue(trend.pAdjusted)}`,
  }
}

/**
 * A 5x5 sample can be finer than the native model grid, so several samples may
 * resolve to one cell. Counting them as independent evidence would understate
 * the false-discovery correction, so the adjustment runs on unique cells only.
 */
export function adjustGrid(cells: GridCell[]): GridCell[] {
  if (cells.length === 0) return []
  const representatives: GridCell[] = []
  const indexByKey = new Map<string, number>()
  for (const cell of cells) {
    if (indexByKey.has(cell.cellKey)) continue
    indexByKey.set(cell.cellKey, representatives.length)
    representatives.push(cell)
  }
  const { q } = benjaminiHochberg(representatives.map((cell) => cell.pAdjusted))
  return cells.map((cell) => {
    const value = q[indexByKey.get(cell.cellKey) ?? 0]
    return { ...cell, q: value, significant: value <= 0.05 }
  })
}

export function summarizeSpatial(cells: GridCell[]): SpatialSummary {
  const samples = cells.length
  if (samples === 0) {
    return {
      total: 0,
      samples: 0,
      significant: 0,
      up: 0,
      down: 0,
      flat: 0,
      agreement: 0,
      strongest: null,
      weakest: null,
    }
  }
  const seen = new Set<string>()
  const unique = cells.filter((cell) => {
    if (seen.has(cell.cellKey)) return false
    seen.add(cell.cellKey)
    return true
  })
  const total = unique.length
  let up = 0
  let down = 0
  let flat = 0
  let significant = 0
  for (const cell of unique) {
    if (cell.direction === 'up') up += 1
    else if (cell.direction === 'down') down += 1
    else flat += 1
    if (cell.significant) significant += 1
  }
  const strongest = unique.reduce((a, b) =>
    Math.abs(b.slopePerDecade) > Math.abs(a.slopePerDecade) ? b : a,
  )
  const weakest = unique.reduce((a, b) =>
    Math.abs(b.slopePerDecade) < Math.abs(a.slopePerDecade) ? b : a,
  )
  return {
    total,
    samples,
    significant,
    up,
    down,
    flat,
    agreement: Math.max(up, down) / total,
    strongest,
    weakest,
  }
}

export function trendFor(monthly: MonthlyRecord, def: VariableDef): TrendStats {
  return trendFromPoints(aggregateAnnual(monthly, def).points)
}
