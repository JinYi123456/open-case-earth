import type { CaseConfig, Place, ScopeId, VariableId } from '../types'
import { isScopeId, isVariableId } from '../data/variables'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function encodeCase(config: CaseConfig): string {
  const params = new URLSearchParams({
    lat: config.place.lat.toFixed(5),
    lon: config.place.lon.toFixed(5),
    name: config.place.name.slice(0, 120),
    detail: config.place.detail.slice(0, 160),
    v: config.variable,
    scope: config.scope,
  })
  return `#/case?${params.toString()}`
}

export function parseCaseHash(hash: string): CaseConfig | null {
  const raw = hash.replace(/^#/, '')
  if (!raw.startsWith('/case')) return null
  const queryIndex = raw.indexOf('?')
  if (queryIndex === -1) return null
  const params = new URLSearchParams(raw.slice(queryIndex + 1))
  const lat = Number(params.get('lat'))
  const lon = Number(params.get('lon'))
  const name = params.get('name')?.trim()
  const variable = params.get('v') ?? ''
  const scope = params.get('scope') ?? ''

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  if (!name || !isVariableId(variable) || !isScopeId(scope)) return null

  const place: Place = {
    name,
    detail: params.get('detail')?.trim() || 'Pinned coordinates',
    lat: clamp(lat, -89.5, 89.5),
    lon,
  }
  return {
    place,
    variable: variable as VariableId,
    scope: scope as ScopeId,
  }
}

export function readCaseFromLocation(): CaseConfig | null {
  if (typeof window === 'undefined') return null
  return parseCaseHash(window.location.hash)
}

export function shareUrl(config: CaseConfig): string {
  if (typeof window === 'undefined') return encodeCase(config)
  return `${window.location.origin}${window.location.pathname}${encodeCase(config)}`
}

export function defaultCase(): CaseConfig {
  return {
    place: {
      name: 'Johor Bahru',
      detail: 'Johor, Malaysia',
      lat: 1.4582,
      lon: 103.7649,
      country: 'Malaysia',
    },
    variable: 'T2M',
    scope: 'local',
  }
}
