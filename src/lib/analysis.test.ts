import { describe, expect, it } from 'vitest'
import { VARIABLE_MAP } from '../data/variables'
import type { MonthlyRecord } from './power'
import {
  aggregateAnnual,
  analysisFromMonthly,
  buildVerdict,
} from './analysis'

function buildMonthly(
  generator: (year: number, month: number) => number | null,
): MonthlyRecord {
  const record: MonthlyRecord = {}
  for (let year = 1990; year <= 2025; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const value = generator(year, month)
      if (value !== null) {
        record[`${year}-${String(month).padStart(2, '0')}`] = value
      }
    }
  }
  return record
}

describe('aggregateAnnual', () => {
  it('averages mean variables across the record', () => {
    const monthly = buildMonthly((year) => 20 + (year - 1991) * 0.12)
    const series = aggregateAnnual(monthly, VARIABLE_MAP.T2M)
    expect(series.points).toHaveLength(35)
    expect(series.points[0].value).toBeCloseTo(20, 10)
    expect(series.points[34].value).toBeCloseTo(24.08, 10)
  })

  it('sums precipitation with month lengths', () => {
    const monthly = buildMonthly(() => 1)
    const series = aggregateAnnual(monthly, VARIABLE_MAP.PRECTOTCORR)
    expect(series.points[0].value).toBe(365)
    expect(series.points[1].value).toBe(366)
    expect(series.points[2].value).toBe(365)
  })

  it('drops years that are not complete enough', () => {
    const monthly = buildMonthly((year, month) =>
      year === 2001 && month > 2 ? null : 20,
    )
    const series = aggregateAnnual(monthly, VARIABLE_MAP.T2M)
    expect(series.points.find((point) => point.year === 2001)).toBeUndefined()
    expect(series.yearsAvailable).toBe(34)
  })
})

describe('analysisFromMonthly', () => {
  it('recovers a known warming rate and a seasonal cycle', () => {
    const monthly = buildMonthly(
      (year, month) => 20 + (year - 1991) * 0.12 + Math.sin((month / 12) * Math.PI * 2),
    )
    const analysis = analysisFromMonthly(monthly, VARIABLE_MAP.T2M)
    expect(analysis.trend.slopePerDecade).toBeCloseTo(1.2, 6)
    expect(analysis.trend.significant).toBe(true)
    expect(analysis.seasonal).toHaveLength(4)
    expect(analysis.anomaly[0].value).toBeCloseTo(20 - analysis.baseline, 10)
  })

  it('builds DJF from the previous December', () => {
    const monthly = buildMonthly((_year, month) => {
      if (month === 12) return 12
      if (month === 1) return 2
      if (month === 2) return 4
      return 8
    })
    const analysis = analysisFromMonthly(monthly, VARIABLE_MAP.T2M)
    const djf = analysis.seasonal.find((season) => season.season === 'DJF')
    expect(djf?.points[0].year).toBe(1991)
    expect(djf?.points[0].value).toBeCloseTo(6, 10)
  })

  it('produces a percentile-based verdict in both directions', () => {
    const monthly = buildMonthly((year) => 20 + (year - 1991) * 0.2)
    const analysis = analysisFromMonthly(monthly, VARIABLE_MAP.T2M)
    const verdict = buildVerdict('Test Point', VARIABLE_MAP.T2M, analysis)
    expect(verdict.title).toBe('Significant warming')
    expect(verdict.tone).toBe('up')
    expect(verdict.summary).toContain('Test Point')
    expect(verdict.summary).toContain('rose by 2.000 °C per decade')
    expect(verdict.confidenceLine).toContain('confidence')

    const solar = VARIABLE_MAP.ALLSKY_SFC_SW_DWN
    const dimming = analysisFromMonthly(buildMonthly((year) => 20 - (year - 1991) * 0.05), solar)
    const down = buildVerdict('Dimming Point', solar, dimming)
    expect(down.title).toBe('Significant dimming')
    expect(down.tone).toBe('down')
    expect(down.summary).toContain('dimmed by 0.500 MJ/m² per decade')
    expect(down.summary).not.toContain('by +')
  })

  it('does not call noise a trend', () => {
    const monthly = buildMonthly((year, month) =>
      20 + Math.sin((year - 1990) * 2.4 + month * 1.7),
    )
    const analysis = analysisFromMonthly(monthly, VARIABLE_MAP.T2M)
    const verdict = buildVerdict('Noise Point', VARIABLE_MAP.T2M, analysis)
    if (!analysis.trend.significant) {
      expect(verdict.title).toBe('No clear trend')
      expect(verdict.tone).toBe('flat')
    }
  })
})
