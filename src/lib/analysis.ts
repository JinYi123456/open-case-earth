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
import { mean, olsSlope, trendFromPoints } from './stats'
import {
  RECORD_END_YEAR,
  RECORD_START_YEAR,
  RECORD_YEARS,
  type MonthlyRecord,
} from './power'

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
  for (let year = RECORD_START_YEAR; year <= RECORD_END_YEAR; year += 1) {
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
    yearsExpected: RECORD_YEARS,
    yearsAvailable: points.length,
  }
}

export function aggregateSeason(
  monthly: MonthlyRecord,
  def: VariableDef,
  season: (typeof SEASONS)[number],
): SeriesPoint[] {
  const points: SeriesPoint[] = []
  for (let year = RECORD_START_YEAR; year <= RECORD_END_YEAR; year += 1) {
    let total = 0
    let months = 0
    for (const entry of season.months) {
      const targetYear = year + entry.offset
      if (targetYear < 1990) continue
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

  const baselinePoints = annual.points.filter(
    (p) => p.year >= BASELINE_START && p.year <= BASELINE_END,
  )
  const baseline = mean(
    (baselinePoints.length >= 20 ? baselinePoints : annual.points).map((p) => p.value),
  )

  const trimmedPoints = annual.points.filter(
    (p) => p.year >= RECORD_START_YEAR + 3 && p.year <= RECORD_END_YEAR - 3,
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
  return {
    variable,
    points: annual.points,
    trend: trendFromPoints(annual.points),
  }
}

export function buildVerdict(
  placeName: string,
  def: VariableDef,
  analysis: PointAnalysis,
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

  const summary = trend.significant
    ? `${def.short} at ${placeName} ${verb} by ${magnitude} between ${analysis.first.year} and ${analysis.latest.year} — a modelled change of ${change} across the record. The ordering is unlikely to be chance (Mann–Kendall p = ${pValue(trend.p)}).`
    : `${def.short} at ${placeName} moved by ${rate} between ${analysis.first.year} and ${analysis.latest.year}, but the record cannot separate that from natural variability (Mann–Kendall p = ${pValue(trend.p)}).`

  return {
    title,
    tone,
    summary,
    confidenceLine: `${confidenceFromP(trend.p)} confidence · p = ${pValue(trend.p)}`,
  }
}

export function summarizeSpatial(cells: GridCell[]): SpatialSummary {
  const total = cells.length
  if (total === 0) {
    return {
      total: 0,
      significant: 0,
      up: 0,
      down: 0,
      flat: 0,
      agreement: 0,
      strongest: null,
      weakest: null,
    }
  }
  let up = 0
  let down = 0
  let flat = 0
  let significant = 0
  for (const cell of cells) {
    if (cell.direction === 'up') up += 1
    else if (cell.direction === 'down') down += 1
    else flat += 1
    if (cell.significant) significant += 1
  }
  const strongest = cells.reduce((a, b) =>
    Math.abs(b.slopePerDecade) > Math.abs(a.slopePerDecade) ? b : a,
  )
  const weakest = cells.reduce((a, b) =>
    Math.abs(b.slopePerDecade) < Math.abs(a.slopePerDecade) ? b : a,
  )
  return {
    total,
    significant,
    up,
    down,
    flat,
    agreement: Math.max(up, down) / total,
    strongest,
    weakest,
  }
}

export function seasonalAgreement(analysis: PointAnalysis): number {
  const headline = analysis.trend.direction
  if (headline === 'flat') return 0
  const matching = analysis.seasonal.filter(
    (season) => season.direction === headline && season.significant,
  ).length
  return matching / analysis.seasonal.length
}

export function trendFor(monthly: MonthlyRecord, def: VariableDef): TrendStats {
  return trendFromPoints(aggregateAnnual(monthly, def).points)
}
