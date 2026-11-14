import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

function gibsUrl(lat: number, lon: number, extent: number, date: string): string {
  const latSpan = extent * 2
  const lonSpan = Math.min(
    (extent * 2 * 1.5) / Math.max(0.32, Math.cos((lat * Math.PI) / 180)),
    150,
  )
  const halfLat = latSpan / 2
  const halfLon = lonSpan / 2
  const south = Math.max(-84, lat - halfLat)
  const north = Math.min(84, lat + halfLat)
  const bbox = [lon - halfLon, south, lon + halfLon, north]
    .map((value) => value.toFixed(4))
    .join(',')
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.1.1',
    LAYERS: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    FORMAT: 'image/jpeg',
    TRANSPARENT: 'false',
    HEIGHT: '600',
    WIDTH: '900',
    SRS: 'EPSG:4326',
    BBOX: bbox,
    TIME: date,
  })
  return `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?${params.toString()}`
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const next = new Date(Date.UTC(y, m - 1, d + days))
  return next.toISOString().slice(0, 10)
}

function formatTag(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

// MODIS has daily swath gaps; a requested day can return an all-black frame.
// Sample the decoded pixels and treat a near-empty frame as "no coverage".
function hasContent(img: HTMLImageElement): boolean {
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 64
    canvas.height = 43
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return true
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let lit = 0
    for (let i = 0; i < data.length; i += 4) {
      if (Math.max(data[i], data[i + 1], data[i + 2]) > 14) lit += 1
    }
    return lit / (data.length / 4) > 0.02
  } catch {
    return true
  }
}

const DAY_OFFSETS = [0, 1, 2, 3, 4, 6, 9]

interface ClearDay {
  date: string | null
  url: string | null
  failed: boolean
}

function useClearDay(lat: number, lon: number, extent: number, base: string): ClearDay {
  const [state, setState] = useState<ClearDay>({ date: null, url: null, failed: false })

  useEffect(() => {
    let cancelled = false
    setState({ date: null, url: null, failed: false })
    let index = 0

    function tryNext() {
      if (cancelled) return
      if (index >= DAY_OFFSETS.length) {
        setState({ date: null, url: null, failed: true })
        return
      }
      const date = addDays(base, DAY_OFFSETS[index])
      index += 1
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (cancelled) return
        if (hasContent(img)) setState({ date, url: img.src, failed: false })
        else tryNext()
      }
      img.onerror = () => {
        if (!cancelled) tryNext()
      }
      img.src = gibsUrl(lat, lon, extent, date)
    }

    tryNext()
    return () => {
      cancelled = true
    }
  }, [lat, lon, extent, base])

  return state
}

export function LandscapeCompare({
  lat,
  lon,
  extent,
  placeName,
}: {
  lat: number
  lon: number
  extent: number
  placeName: string
}) {
  const [position, setPosition] = useState(52)

  const before = useClearDay(lat, lon, extent, '2002-07-15')
  const after = useClearDay(lat, lon, extent, '2024-07-15')

  const ready = !!before.url && !!after.url
  const failed = before.failed || after.failed
  const clipStyle = { clipPath: `inset(0 ${100 - position}% 0 0)` } as CSSProperties

  const beforeTag = before.date ? formatTag(before.date) : 'Jul 2002'
  const afterTag = after.date ? formatTag(after.date) : 'Jul 2024'

  return (
    <div className="landscape-wrap">
      <div className="compare-shell">
        {after.url && (
          <img
            src={after.url}
            alt={`MODIS Terra satellite view of ${placeName}, ${afterTag}`}
            className="compare-img"
            crossOrigin="anonymous"
          />
        )}
        {before.url && (
          <img
            src={before.url}
            alt={`MODIS Terra satellite view of ${placeName}, ${beforeTag}`}
            className="compare-img compare-img-before"
            style={clipStyle}
            crossOrigin="anonymous"
          />
        )}

        <div className="compare-line" style={{ left: `${position}%` }} aria-hidden="true">
          <span className="compare-handle">
            <i />
            <i />
          </span>
        </div>

        <span className="compare-tag compare-tag-left">
          <span className="mono">{beforeTag}</span>
        </span>
        <span className="compare-tag compare-tag-right">
          <span className="mono">{afterTag}</span>
        </span>

        {!ready && !failed && (
          <div className="compare-loading mono">
            <span className="loader-ring" />
            Loading MODIS imagery
          </div>
        )}
        {failed && (
          <div className="compare-loading mono">
            Imagery is unavailable for this window. The statistical record is unaffected.
          </div>
        )}

        <input
          className="compare-range"
          type="range"
          min="0"
          max="100"
          value={position}
          aria-label="Reveal the earlier or later satellite image"
          onChange={(event) => setPosition(Number(event.target.value))}
        />
      </div>

      <div className="landscape-caption">
        <p>
          MODIS Terra true color, mid-July, 250-metre resolution. A single day, so clouds and
          satellite swath edges are part of the scene.
        </p>
        <span className="mono">Imagery context only · not read by the trend test</span>
      </div>
    </div>
  )
}