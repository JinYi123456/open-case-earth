import { describe, expect, it } from 'vitest'
import type { GridCell, SpatialSummary } from '../types'
import { VARIABLE_MAP } from '../data/variables'
import {
  STRENGTH_LABEL,
  buildEvidence,
  evidenceScore,
  evidenceStrength,
  type EvidenceRow,
} from './evidence'
import { adjustGrid, analysisFromMonthly, summarizeSpatial } from './analysis'
import type { MonthlyRecord } from './power'

function buildMonthly(generator: (year: number, month: number) => number): MonthlyRecord {
  const record: MonthlyRecord = {}
  for (let year = 1990; year <= 2025; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      record[`${year}-${String(month).padStart(2, '0')}`] = generator(year, month)
    }
  }
  return record
}

function row(status: EvidenceRow['status']): EvidenceRow {
  return { id: status, label: status, value: '', detail: '', status }
}

function cell(cellKey: string, pAdjusted: number, direction: GridCell['direction']): GridCell {
  return {
    lat: 1.5,
    lon: 103.7,
    slopePerDecade: direction === 'down' ? -0.2 : 0.2,
    p: pAdjusted,
    pAdjusted,
    q: pAdjusted,
    significant: pAdjusted < 0.05,
    direction,
    years: 35,
    cellKey,
  }
}

const EMPTY_SPATIAL: SpatialSummary = {
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

describe('evidence score', () => {
  it('weights a partial check as half', () => {
    expect(evidenceScore([row('pass'), row('partial'), row('fail'), row('pending')])).toBe(1.5)
  })

  it('grades a significant trend by the weight of the cross-checks', () => {
    const six = (passes: number) => [
      ...Array.from({ length: passes }, () => row('pass')),
      ...Array.from({ length: 6 - passes }, () => row('fail')),
    ]
    expect(evidenceStrength(six(6), true)).toBe('established')
    expect(evidenceStrength(six(4), true)).toBe('probable')
    expect(evidenceStrength(six(2), true)).toBe('tentative')
    expect(evidenceStrength(six(6), false)).toBe('unresolved')
    expect(STRENGTH_LABEL[evidenceStrength(six(4), true)]).toBe('Probable')
  })

  it('ignores checks that are still collecting', () => {
    const rows = [row('pass'), row('pass'), row('pending')]
    expect(evidenceStrength(rows, true)).toBe('established')
    expect(evidenceStrength([row('pending')], true)).toBe('tentative')
  })
})

describe('grid adjustment', () => {
  it('runs the false-discovery correction once per independent cell', () => {
    const cells = [
      cell('a', 0.001, 'up'),
      cell('a', 0.001, 'up'),
      cell('a', 0.001, 'up'),
      cell('b', 0.03, 'up'),
      cell('b', 0.03, 'up'),
    ]
    const adjusted = adjustGrid(cells)
    // Two independent tests, not five: q = 0.001 * 2 / 1.
    expect(adjusted[0].q).toBeCloseTo(0.002, 12)
    expect(adjusted[2].q).toBeCloseTo(0.002, 12)
    expect(adjusted[3].q).toBeCloseTo(0.03, 12)
    expect(adjusted.every((entry) => entry.significant)).toBe(true)
  })

  it('shares one verdict across samples of the same cell', () => {
    const adjusted = adjustGrid([cell('a', 0.4, 'up'), cell('a', 0.4, 'up')])
    expect(adjusted[0].significant).toBe(false)
    expect(adjusted[1].q).toBe(adjusted[0].q)
  })

  it('counts independent cells, not samples', () => {
    const cells = [
      cell('a', 0.001, 'up'),
      cell('a', 0.001, 'up'),
      cell('b', 0.001, 'up'),
      cell('c', 0.6, 'down'),
    ]
    const summary = summarizeSpatial(adjustGrid(cells))
    expect(summary.samples).toBe(4)
    expect(summary.total).toBe(3)
    expect(summary.up).toBe(2)
    expect(summary.down).toBe(1)
    expect(summary.significant).toBe(2)
    expect(summary.agreement).toBeCloseTo(2 / 3, 12)
  })

  it('returns an empty summary for an empty grid', () => {
    expect(summarizeSpatial([]).total).toBe(0)
    expect(adjustGrid([])).toEqual([])
  })
})

describe('buildEvidence', () => {
  const analysis = analysisFromMonthly(
    buildMonthly((year) => 20 + (year - 1991) * 0.2),
    VARIABLE_MAP.T2M,
  )

  it('reports the serial-correlation correction alongside the signal', () => {
    const rows = buildEvidence(analysis, VARIABLE_MAP.T2M, EMPTY_SPATIAL, true)
    const signal = rows.find((entry) => entry.id === 'significance')
    expect(signal?.detail).toContain('Hamed–Rao')
    expect(signal?.detail).toContain('Lag-1 r =')
    expect(rows).toHaveLength(6)
  })

  it('names the independent cell count in the spatial row', () => {
    const spatial = summarizeSpatial(
      adjustGrid([cell('a', 0.001, 'up'), cell('a', 0.001, 'up'), cell('b', 0.001, 'up')]),
    )
    const rows = buildEvidence(analysis, VARIABLE_MAP.T2M, spatial, true)
    const spatialRow = rows.find((entry) => entry.id === 'spatial')
    expect(spatialRow?.value).toBe('2 of 2 aligned')
    expect(spatialRow?.detail).toContain('3 samples resolve to 2 independent model cells')
  })

  it('marks the spatial row pending while the grid is still loading', () => {
    const rows = buildEvidence(analysis, VARIABLE_MAP.T2M, EMPTY_SPATIAL, false)
    expect(rows.find((entry) => entry.id === 'spatial')?.status).toBe('pending')
  })
})