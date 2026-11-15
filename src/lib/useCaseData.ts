import { useCallback, useEffect, useRef, useState } from 'react'
import { GRID_SIZE, SCOPES, VARIABLE_MAP, VARIABLES } from '../data/variables'
import type {
  CaseConfig,
  GridCell,
  PointAnalysis,
  SignalSummary,
  VariableId,
} from '../types'
import { adjustGrid, analysisFromMonthly, signalFor } from './analysis'
import {
  fetchMonthly,
  makeGrid,
  mapLimitSafe,
  type MonthlyRecord,
} from './power'

export type CaseStatus = 'loading' | 'ready' | 'error'

export interface CaseData {
  status: CaseStatus
  error: string | null
  monthly: MonthlyRecord | null
  analysis: PointAnalysis | null
  grid: GridCell[]
  gridComplete: boolean
  gridFailures: number
  gridTotal: number
  signals: Partial<Record<VariableId, SignalSummary>>
  signalsComplete: boolean
  signalsFailures: number
  retry: () => void
}

const gridCache = new Map<string, GridCell[]>()
const signalCache = new Map<string, Partial<Record<VariableId, SignalSummary>>>()

function placeKey(lat: number, lon: number): string {
  return `${lat.toFixed(3)}:${lon.toFixed(3)}`
}

export function useCaseData(config: CaseConfig): CaseData {
  const { place, variable, scope } = config
  const [status, setStatus] = useState<CaseStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [monthly, setMonthly] = useState<MonthlyRecord | null>(null)
  const [analysis, setAnalysis] = useState<PointAnalysis | null>(null)
  const [grid, setGrid] = useState<GridCell[]>([])
  const [gridComplete, setGridComplete] = useState(false)
  const [gridFailures, setGridFailures] = useState(0)
  const [signals, setSignals] = useState<Partial<Record<VariableId, SignalSummary>>>({})
  const [signalsComplete, setSignalsComplete] = useState(false)
  const [signalsFailures, setSignalsFailures] = useState(0)
  const [nonce, setNonce] = useState(0)
  const tokenRef = useRef(0)

  const retry = useCallback(() => setNonce((value) => value + 1), [])

  useEffect(() => {
    const token = tokenRef.current + 1
    tokenRef.current = token
    const controller = new AbortController()
    const def = VARIABLE_MAP[variable]
    const key = placeKey(place.lat, place.lon)

    setStatus('loading')
    setError(null)
    setMonthly(null)
    setAnalysis(null)
    setGrid([])
    setGridComplete(false)
    setGridFailures(0)
    setSignals({})
    setSignalsComplete(false)
    setSignalsFailures(0)

    const current = () => token === tokenRef.current

    async function loadSignals(baseMonthly: MonthlyRecord) {
      const cached = signalCache.get(key)
      if (cached) {
        if (!current()) return
        setSignals(cached)
        setSignalsComplete(true)
        return
      }
      const collected: Partial<Record<VariableId, SignalSummary>> = {}
      const { failures } = await mapLimitSafe(
        VARIABLES.map((item) => item.id),
        3,
        async (id) => {
          if (id === variable) return signalFor(baseMonthly, id)
          const record = await fetchMonthly(place.lat, place.lon, id, controller.signal)
          return signalFor(record, id)
        },
        (signal) => {
          if (!current()) return
          collected[signal.variable] = signal
          setSignals({ ...collected })
        },
        controller.signal,
      )
      if (!current()) return
      signalCache.set(key, collected)
      setSignalsFailures(failures)
      setSignalsComplete(true)
    }

    async function loadGrid(baseMonthly: MonthlyRecord) {
      const cacheKey = `${key}:${scope}:${variable}`
      const cached = gridCache.get(cacheKey)
      if (cached) {
        if (!current()) return
        setGrid(cached)
        setGridComplete(true)
        return
      }
      const extent = SCOPES[scope].extent
      const points = makeGrid(place.lat, place.lon, extent, GRID_SIZE)
      const { results, failures } = await mapLimitSafe(
        points,
        5,
        async (point) => {
          const record =
            point.row === 2 && point.col === 2
              ? baseMonthly
              : await fetchMonthly(point.lat, point.lon, variable, controller.signal)
          if (!record) throw new Error('No center record')
          const cellAnalysis = analysisFromMonthly(record, def)
          return {
            lat: point.lat,
            lon: point.lon,
            slopePerDecade: cellAnalysis.trend.slopePerDecade,
            p: cellAnalysis.trend.p,
            pAdjusted: cellAnalysis.trend.pAdjusted,
            q: cellAnalysis.trend.pAdjusted,
            significant: cellAnalysis.trend.significant,
            direction: cellAnalysis.trend.direction,
            years: cellAnalysis.trend.n,
            cellKey: cellAnalysis.annual.points
              .map((seriesPoint) => seriesPoint.value.toFixed(9))
              .join('|'),
          } satisfies GridCell
        },
        (cell) => {
          if (!current()) return
          setGrid((previous) => [...previous, cell])
        },
        controller.signal,
      )
      if (!current()) return
      const usable = results.filter((cell): cell is GridCell => cell !== null)
      const finalized = adjustGrid(usable)
      gridCache.set(cacheKey, finalized)
      setGrid(finalized)
      setGridFailures(failures)
      setGridComplete(true)
    }

    async function run() {
      try {
        const record = await fetchMonthly(place.lat, place.lon, variable, controller.signal)
        if (!current()) return
        const result = analysisFromMonthly(record, def)
        if (!current()) return
        setMonthly(record)
        setAnalysis(result)
        setStatus('ready')
        void loadGrid(record).catch((gridError: unknown) => {
          if (gridError instanceof DOMException && gridError.name === 'AbortError') return
          if (!current()) return
          setGridComplete(true)
          setGridFailures(GRID_SIZE * GRID_SIZE)
        })
        void loadSignals(record).catch((signalError: unknown) => {
          if (signalError instanceof DOMException && signalError.name === 'AbortError') return
          if (!current()) return
          setSignalsComplete(true)
        })
      } catch (runError) {
        if (runError instanceof DOMException && runError.name === 'AbortError') return
        if (!current()) return
        setStatus('error')
        setError(
          runError instanceof Error
            ? runError.message
            : 'The public data record could not be reached.',
        )
      }
    }

    void run()

    return () => controller.abort()
  }, [place.lat, place.lon, variable, scope, nonce])

  return {
    status,
    error,
    monthly,
    analysis,
    grid,
    gridComplete,
    gridFailures,
    gridTotal: GRID_SIZE * GRID_SIZE,
    signals,
    signalsComplete,
    signalsFailures,
    retry,
  }
}
