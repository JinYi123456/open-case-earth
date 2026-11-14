import type {
  PointAnalysis,
  SpatialSummary,
  TrendDirection,
  VariableDef,
} from '../types'
import { pValue, signed } from './format'
import { seasonalAgreement } from './analysis'

export type EvidenceStatus = 'pass' | 'partial' | 'fail' | 'pending'

export interface EvidenceRow {
  id: string
  label: string
  value: string
  detail: string
  status: EvidenceStatus
}

function directionWord(direction: TrendDirection): string {
  if (direction === 'up') return 'increasing'
  if (direction === 'down') return 'decreasing'
  return 'flat'
}

export function buildEvidence(
  analysis: PointAnalysis,
  def: VariableDef,
  spatial: SpatialSummary,
  gridComplete: boolean,
): EvidenceRow[] {
  const { trend } = analysis
  const rows: EvidenceRow[] = []

  rows.push({
    id: 'significance',
    label: 'Statistical signal',
    value: trend.significant ? 'Established' : 'Not established',
    detail: trend.significant
      ? `Mann–Kendall p = ${pValue(trend.p)} against a 0.05 threshold.`
      : `p = ${pValue(trend.p)}. Natural variability is still a plausible explanation.`,
    status: trend.significant ? 'pass' : 'fail',
  })

  if (!gridComplete) {
    rows.push({
      id: 'spatial',
      label: 'Spatial agreement',
      value: 'Collecting',
      detail: 'Sampling the surrounding grid and controlling the false discovery rate.',
      status: 'pending',
    })
  } else {
    const agreement = spatial.agreement
    rows.push({
      id: 'spatial',
      label: 'Spatial agreement',
      value: `${spatial.up + spatial.down} of ${spatial.total} aligned`,
      detail: `${spatial.significant} cells survive false-discovery control. The dominant direction is ${directionWord(
        spatial.up >= spatial.down ? 'up' : 'down',
      )}.`,
      status: agreement >= 0.8 ? 'pass' : agreement >= 0.6 ? 'partial' : 'fail',
    })
  }

  const seasonShare = seasonalAgreement(analysis)
  const alignedSeasons = analysis.seasonal.filter(
    (season) => season.direction === trend.direction && season.significant,
  ).length
  rows.push({
    id: 'seasonal',
    label: 'Seasonal agreement',
    value: `${alignedSeasons} of ${analysis.seasonal.length} seasons`,
    detail: 'Seasons are tested separately so one wet or hot quarter cannot carry the verdict.',
    status:
      seasonShare === 1 ? 'pass' : seasonShare >= 0.5 ? 'partial' : 'fail',
  })

  const completeness = analysis.annual.yearsAvailable / analysis.annual.yearsExpected
  rows.push({
    id: 'completeness',
    label: 'Record completeness',
    value: `${analysis.annual.yearsAvailable} of ${analysis.annual.yearsExpected} years`,
    detail: `Years need at least ${
      def.aggregate === 'sum' ? 12 : 10
    } valid months. The baseline is ${analysis.baselineYears} years.`,
    status: completeness >= 0.95 ? 'pass' : completeness >= 0.8 ? 'partial' : 'fail',
  })

  const trimmedSame = analysis.trimmed.direction === trend.direction
  rows.push({
    id: 'robustness',
    label: 'Endpoint robustness',
    value: trimmedSame ? 'Stable' : 'Sensitive',
    detail: trimmedSame
      ? `Dropping the first and last three years keeps the direction: ${signed(
          analysis.trimmed.slopePerDecade,
          def.slopeDecimals,
          def.slopeUnit,
        )} per decade.`
      : 'Removing the first and last three years changes the direction.',
    status: trimmedSame && analysis.trimmed.significant ? 'pass' : trimmedSame ? 'partial' : 'fail',
  })

  const sen = trend.slopePerDecade
  const ols = analysis.olsSlopePerDecade
  const sameSign = Math.sign(sen) === Math.sign(ols)
  const ratio = Math.abs(ols) > 0 ? Math.abs(sen / ols) : 1
  rows.push({
    id: 'estimator',
    label: 'Estimator agreement',
    value: sameSign ? 'Aligned' : 'Divergent',
    detail: `Sen slope ${signed(sen, def.slopeDecimals, def.slopeUnit)} vs least-squares ${signed(
      ols,
      def.slopeDecimals,
      def.slopeUnit,
    )} per decade.`,
    status: sameSign && ratio > 0.5 && ratio < 2 ? 'pass' : sameSign ? 'partial' : 'fail',
  })

  return rows
}
