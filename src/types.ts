export type VariableId =
  | 'T2M'
  | 'PRECTOTCORR'
  | 'GWETROOT'
  | 'ALLSKY_SFC_SW_DWN'
  | 'CLOUD_AMT'
  | 'RH2M'
  | 'WS2M'
  | 'SNODP'

export type VariableGroup = 'Heat' | 'Water' | 'Energy' | 'Air' | 'Cryosphere'

export type ScopeId = 'local' | 'regional' | 'continental'

export type Aggregate = 'mean' | 'sum'

export type VariableIcon =
  | 'thermometer'
  | 'rain'
  | 'droplet'
  | 'sun'
  | 'cloud'
  | 'humidity'
  | 'wind'
  | 'snow'

export interface VariableDef {
  id: VariableId
  label: string
  short: string
  group: VariableGroup
  unit: string
  annualUnit: string
  slopeUnit: string
  aggregate: Aggregate
  /** First year analysed: the satellite pair switches upstream product in 2001. */
  recordStart: number
  recordNote?: string
  scale: number
  decimals: number
  slopeDecimals: number
  source: string
  sourceDetail: string
  blurb: string
  color: string
  upColor: string
  downColor: string
  upLabel: string
  downLabel: string
  upVerb: string
  downVerb: string
  upNoun: string
  downNoun: string
  icon: VariableIcon
}

export interface Place {
  name: string
  detail: string
  lat: number
  lon: number
  country?: string
}

export interface CaseConfig {
  place: Place
  variable: VariableId
  scope: ScopeId
}

export interface SeriesPoint {
  year: number
  value: number
  months: number
}

export interface AnnualSeries {
  points: SeriesPoint[]
  yearsExpected: number
  yearsAvailable: number
}

export type TrendDirection = 'up' | 'down' | 'flat'

export interface TrendStats {
  slopePerYear: number
  slopePerDecade: number
  ciLow: number
  ciHigh: number
  intercept: number
  p: number
  z: number
  s: number
  tau: number
  n: number
  pAdjusted: number
  zAdjusted: number
  varianceFactor: number
  serialLags: number
  lag1: number
  significant: boolean
  direction: TrendDirection
}

export type SeasonId = 'DJF' | 'MAM' | 'JJA' | 'SON'

export interface SeasonalTrend {
  season: SeasonId
  label: string
  monthsLabel: string
  points: SeriesPoint[]
  slopePerDecade: number
  p: number
  significant: boolean
  direction: TrendDirection
}

export interface PointAnalysis {
  annual: AnnualSeries
  trend: TrendStats
  trimmed: TrendStats
  olsSlopePerDecade: number
  anomaly: SeriesPoint[]
  baseline: number
  baselineStart: number
  baselineEnd: number
  baselineYears: number
  seasonal: SeasonalTrend[]
  first: SeriesPoint
  latest: SeriesPoint
  observedChange: number
  modelledChange: number
  earlyMean: number
  lateMean: number
  peak: SeriesPoint
  trough: SeriesPoint
}

export interface GridCell {
  lat: number
  lon: number
  slopePerDecade: number
  p: number
  pAdjusted: number
  q: number
  significant: boolean
  direction: TrendDirection
  years: number
  /** Identical for samples that resolve to the same native model cell. */
  cellKey: string
}

export interface SpatialSummary {
  total: number
  samples: number
  significant: number
  up: number
  down: number
  flat: number
  agreement: number
  strongest: GridCell | null
  weakest: GridCell | null
}

export type EvidenceStrength = 'established' | 'probable' | 'tentative' | 'unresolved'

export interface Verdict {
  title: string
  tone: 'up' | 'down' | 'flat'
  strength: EvidenceStrength
  strengthLabel: string
  supportLine: string
  summary: string
  confidenceLine: string
}

export interface SignalSummary {
  variable: VariableId
  points: SeriesPoint[]
  trend: TrendStats
  q: number
  survivesFdr: boolean
}

export type LoadPhase = 'idle' | 'locating' | 'observations' | 'analysis' | 'ready' | 'error'
