import type { VariableId } from '../types'

export const FETCH_START_YEAR = 1990
export const RECORD_START_YEAR = 1991
export const RECORD_END_YEAR = 2025
export const RECORD_YEARS = RECORD_END_YEAR - RECORD_START_YEAR + 1

const API_BASE = 'https://power.larc.nasa.gov/api/temporal/monthly/point'
const CACHE_VERSION = 'v3'
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14

export type MonthlyRecord = Record<string, number>

interface PowerPayload {
  properties?: {
    parameter?: Record<string, Record<string, number>>
  }
  messages?: unknown[]
}

const memoryCache = new Map<string, MonthlyRecord>()
const inFlight = new Map<string, Promise<MonthlyRecord>>()

function cacheKey(lat: number, lon: number, variable: VariableId): string {
  return `${CACHE_VERSION}:${lat.toFixed(3)}:${lon.toFixed(3)}:${variable}`
}

function readStored(key: string): MonthlyRecord | null {
  try {
    const raw = window.localStorage.getItem(`oce.monthly.${key}`)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { t: number; data: MonthlyRecord }
    if (!parsed?.data || Date.now() - parsed.t > CACHE_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeStored(key: string, data: MonthlyRecord): void {
  try {
    window.localStorage.setItem(
      `oce.monthly.${key}`,
      JSON.stringify({ t: Date.now(), data }),
    )
  } catch {
    // Storage can be full or disabled; the in-memory cache still works.
  }
}

function normalize(values: Record<string, number>): MonthlyRecord {
  const output: MonthlyRecord = {}
  for (const [key, value] of Object.entries(values)) {
    if (!/^\d{6}$/.test(key)) continue
    const month = Number(key.slice(4, 6))
    if (month < 1 || month > 12) continue
    if (!Number.isFinite(value) || value <= -900) continue
    output[`${key.slice(0, 4)}-${key.slice(4, 6)}`] = value
  }
  return output
}

export async function fetchMonthly(
  lat: number,
  lon: number,
  variable: VariableId,
  signal?: AbortSignal,
): Promise<MonthlyRecord> {
  const key = cacheKey(lat, lon, variable)
  const memory = memoryCache.get(key)
  if (memory) return memory
  const stored = readStored(key)
  if (stored) {
    memoryCache.set(key, stored)
    return stored
  }

  // The shared request is deliberately not bound to any caller's AbortSignal:
  // an aborted caller (StrictMode remount, variable switch) must not poison the
  // cached promise for the next caller. Callers race their own signal instead.
  let shared = inFlight.get(key)
  if (!shared) {
    const params = new URLSearchParams({
      parameters: variable,
      community: 'AG',
      longitude: lon.toFixed(4),
      latitude: lat.toFixed(4),
      start: String(FETCH_START_YEAR),
      end: String(RECORD_END_YEAR),
      format: 'JSON',
    })
    shared = (async () => {
      const response = await fetch(`${API_BASE}?${params.toString()}`, {
        headers: { Accept: 'application/json' },
      })
      if (!response.ok) {
        throw new Error(`The NASA POWER record returned ${response.status}.`)
      }
      const payload = (await response.json()) as PowerPayload
      const raw = payload.properties?.parameter?.[variable]
      if (!raw) {
        throw new Error('The NASA POWER record did not include this variable.')
      }
      const data = normalize(raw)
      if (Object.keys(data).length < 24) {
        throw new Error('The record for this point is too sparse to analyse.')
      }
      memoryCache.set(key, data)
      writeStored(key, data)
      return data
    })()
    inFlight.set(key, shared)
    const settle = () => {
      if (inFlight.get(key) === shared) inFlight.delete(key)
    }
    shared.then(settle, settle)
  }

  if (!signal) return shared
  if (signal.aborted) throw new DOMException('Aborted', 'AbortError')
  return new Promise<MonthlyRecord>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'))
    signal.addEventListener('abort', onAbort, { once: true })
    shared.then(
      (value) => {
        signal.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort)
        reject(error)
      },
    )
  })
}

export interface GridPoint {
  lat: number
  lon: number
  row: number
  col: number
}

export function makeGrid(lat: number, lon: number, extent: number, size: number): GridPoint[] {
  const step = (extent * 2) / (size - 1)
  const points: GridPoint[] = []
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cellLat = lat + extent - row * step
      const cellLon = lon - extent + col * step
      points.push({
        lat: Math.max(-89.5, Math.min(89.5, cellLat)),
        lon: normalizeLon(cellLon),
        row,
        col,
      })
    }
  }
  return points
}

export function normalizeLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180
}

export function cellSize(extent: number, size: number): number {
  return ((extent * 2) / (size - 1)) * 0.94
}

export function angleDistance(a: number, b: number): number {
  const diff = Math.abs(normalizeLon(a) - normalizeLon(b))
  return Math.min(diff, 360 - diff)
}

interface PoolResult<R> {
  results: (R | null)[]
  failures: number
}

export async function mapLimitSafe<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onResult?: (result: R, index: number) => void,
  signal?: AbortSignal,
): Promise<PoolResult<R>> {
  const results = new Array<R | null>(items.length).fill(null)
  let cursor = 0
  let failures = 0

  async function run(): Promise<void> {
    while (cursor < items.length) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      const index = cursor
      cursor += 1
      try {
        const value = await worker(items[index], index)
        results[index] = value
        onResult?.(value, index)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        failures += 1
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  )
  return { results, failures }
}
