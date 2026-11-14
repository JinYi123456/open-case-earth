import type { Place } from '../types'
import { formatCoords, titleCasePlace } from './format'

interface PhotonFeature {
  properties?: {
    name?: string
    city?: string
    county?: string
    state?: string
    country?: string
    countrycode?: string
    osm_value?: string
    osm_key?: string
  }
  geometry?: {
    coordinates?: [number, number]
  }
}

interface PhotonResponse {
  features?: PhotonFeature[]
}

const COORDINATE_PATTERN =
  /^\s*(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/

export function parseCoordinates(query: string): { lat: number; lon: number } | null {
  const match = query.match(COORDINATE_PATTERN)
  if (!match) return null
  const lat = Number(match[1])
  const lon = Number(match[2])
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null
  return { lat, lon }
}

function toPlace(feature: PhotonFeature): Place | null {
  const coords = feature.geometry?.coordinates
  if (!coords) return null
  const [lon, lat] = coords
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const props = feature.properties ?? {}
  const rawName = props.name || props.city || props.county
  if (!rawName) return null
  const detailParts = [props.state, props.country].filter(
    (part): part is string => Boolean(part),
  )
  return {
    name: titleCasePlace(rawName),
    detail: detailParts.join(', '),
    lat,
    lon,
    country: props.country,
  }
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const trimmed = query.trim()
  if (trimmed.length < 2) return []

  const coordinates = parseCoordinates(trimmed)
  if (coordinates) {
    const place = await reversePlace(coordinates.lat, coordinates.lon, signal)
    return [place]
  }

  const url = new URL('https://photon.komoot.io/api/')
  url.searchParams.set('q', trimmed)
  url.searchParams.set('limit', '6')
  url.searchParams.set('lang', 'en')

  const response = await fetch(url.toString(), { signal })
  if (!response.ok) throw new Error('Place search is unavailable right now.')
  const payload = (await response.json()) as PhotonResponse
  const seen = new Set<string>()
  const places: Place[] = []
  for (const feature of payload.features ?? []) {
    const place = toPlace(feature)
    if (!place) continue
    const key = `${place.name}:${place.lat.toFixed(2)}:${place.lon.toFixed(2)}`
    if (seen.has(key)) continue
    seen.add(key)
    places.push(place)
  }
  return places
}

export async function reversePlace(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<Place> {
  const fallback: Place = {
    name: formatCoords(lat, lon),
    detail: 'Pinned coordinates',
    lat,
    lon,
  }
  try {
    const url = new URL('https://photon.komoot.io/reverse')
    url.searchParams.set('lat', lat.toFixed(4))
    url.searchParams.set('lon', lon.toFixed(4))
    url.searchParams.set('lang', 'en')
    const response = await fetch(url.toString(), { signal })
    if (!response.ok) return fallback
    const payload = (await response.json()) as PhotonResponse
    const feature = payload.features?.[0]
    if (!feature) return fallback
    const place = toPlace(feature)
    if (!place) return fallback
    return {
      ...place,
      lat,
      lon,
      detail: place.detail || 'Pinned coordinates',
    }
  } catch {
    return fallback
  }
}
