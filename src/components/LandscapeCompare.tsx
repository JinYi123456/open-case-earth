import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { ChevronDown, RotateCcw } from 'lucide-react'

const FIRST_YEAR = 2000
const LAST_YEAR = 2025
// Terra's first corrected-reflectance granules land in late February 2000.
const FIRST_MONTH_2000 = 3
const YEARS = Array.from({ length: LAST_YEAR - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i)
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const PRESETS = [
  { label: '2002 → 2024', earlier: 2002, later: 2024 },
  { label: 'Full record', earlier: FIRST_YEAR, later: LAST_YEAR },
  { label: 'Last decade', earlier: 2015, later: LAST_YEAR },
]

function gibsUrl(lat: number, lon: number, extent: number, date: string, probe = false): string {
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
    HEIGHT: probe ? '80' : '600',
    WIDTH: probe ? '120' : '900',
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
const BATCH = 3

interface Frame {
  date: string | null
  url: string | null
  failed: boolean
  checking: string | null
  attempt: number
}

const EMPTY: Frame = { date: null, url: null, failed: false, checking: null, attempt: 0 }

const frameCache = new Map<string, { date: string; url: string }>()
const CACHE_LIMIT = 16

// GIBS answers with no-store, so a plain <img src> re-downloads on every visit.
// Holding the decoded bytes as an object URL makes a revisited window instant.
function remember(key: string, value: { date: string; url: string }) {
  frameCache.set(key, value)
  while (frameCache.size > CACHE_LIMIT) {
    const oldest = frameCache.keys().next().value
    if (oldest === undefined) break
    const entry = frameCache.get(oldest)
    frameCache.delete(oldest)
    if (entry) URL.revokeObjectURL(entry.url)
  }
}

function forget(key: string) {
  const entry = frameCache.get(key)
  if (!entry) return
  frameCache.delete(key)
  URL.revokeObjectURL(entry.url)
}

function frameKey(lat: number, lon: number, extent: number, base: string): string {
  return `${lat.toFixed(3)},${lon.toFixed(3)},${extent},${base}`
}

function useClearDay(lat: number, lon: number, extent: number, base: string, token: number): Frame {
  const key = frameKey(lat, lon, extent, base)
  const [state, setState] = useState<Frame>(() => {
    const hit = frameCache.get(key)
    return hit ? { ...EMPTY, date: hit.date, url: hit.url } : EMPTY
  })

  useEffect(() => {
    const hit = frameCache.get(key)
    if (hit) {
      setState({ ...EMPTY, date: hit.date, url: hit.url })
      return
    }

    let cancelled = false
    let done = false
    let cursor = 0
    let fetching: number | null = null

    // GIBS occasionally answers 200 with a service exception instead of a JPEG,
    // so the full frame is validated and a bad one sends us to the next day.
    function takeFull(index: number) {
      const date = addDays(base, DAY_OFFSETS[index])
      setState({ ...EMPTY, date, checking: null })
      fetch(gibsUrl(lat, lon, extent, date), { signal: AbortSignal.timeout(30000) })
        .then((response) => {
          if (!response.ok) throw new Error(`GIBS ${response.status}`)
          return response.blob()
        })
        .then((blob) => {
          if (cancelled) return
          if (!blob.type.startsWith('image/') || blob.size < 1024) {
            throw new Error('GIBS returned a non-image body')
          }
          done = true
          const url = URL.createObjectURL(blob)
          remember(key, { date, url })
          setState({ ...EMPTY, date, url })
        })
        .catch(() => {
          if (cancelled || done) return
          fetching = null
          cursor = index + 1
          runBatch()
        })
    }

    function runBatch() {
      if (cancelled || done) return
      if (cursor >= DAY_OFFSETS.length) {
        setState({ ...EMPTY, failed: true, attempt: DAY_OFFSETS.length })
        return
      }

      const start = cursor
      const indices = DAY_OFFSETS.slice(start, start + BATCH).map((_, i) => start + i)
      cursor += indices.length
      setState({
        ...EMPTY,
        checking: addDays(base, DAY_OFFSETS[start]),
        attempt: start + 1,
      })

      const results = new Map<number, boolean>()

      for (const index of indices) {
        const img = new Image()
        img.crossOrigin = 'anonymous'

        const finish = (ok: boolean) => {
          if (cancelled || done) return
          results.set(index, ok)
          // Settle on the earliest day once every day before it is known empty.
          for (const candidate of indices) {
            const result = results.get(candidate)
            if (result === undefined) return
            if (result) {
              if (fetching === null) {
                fetching = candidate
                takeFull(candidate)
              }
              return
            }
          }
          runBatch()
        }

        img.onload = () => finish(hasContent(img))
        img.onerror = () => finish(false)
        img.src = gibsUrl(lat, lon, extent, addDays(base, DAY_OFFSETS[index]), true)
      }
    }

    runBatch()
    return () => {
      cancelled = true
    }
  }, [key, lat, lon, extent, base, token])

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
  const [earlier, setEarlier] = useState(2002)
  const [later, setLater] = useState(2024)
  const [month, setMonth] = useState(7)
  const [token, setToken] = useState(0)
  const [decoded, setDecoded] = useState<Record<string, 'ok' | 'err'>>({})

  const pad = (value: number) => String(value).padStart(2, '0')
  const monthFloor = earlier === FIRST_YEAR ? FIRST_MONTH_2000 : 1
  const safeMonth = Math.max(month, monthFloor)
  const beforeBase = `${earlier}-${pad(safeMonth)}-15`
  const afterBase = `${later}-${pad(safeMonth)}-15`

  const before = useClearDay(lat, lon, extent, beforeBase, token)
  const after = useClearDay(lat, lon, extent, afterBase, token)

  const mark = (url: string, value: 'ok' | 'err') =>
    setDecoded((prev) => (prev[url] === value ? prev : { ...prev, [url]: value }))

  const beforeReady = !!before.url && decoded[before.url] === 'ok'
  const afterReady = !!after.url && decoded[after.url] === 'ok'
  const ready = beforeReady && afterReady
  const failed =
    before.failed ||
    after.failed ||
    (!!before.url && decoded[before.url] === 'err') ||
    (!!after.url && decoded[after.url] === 'err')
  const partial = !ready && !failed && (beforeReady || afterReady)
  const clipStyle = { clipPath: `inset(0 ${100 - position}% 0 0)` } as CSSProperties

  const beforeTag = before.date
    ? formatTag(before.date)
    : `${MONTHS[safeMonth - 1].slice(0, 3)} ${earlier}`
  const afterTag = after.date
    ? formatTag(after.date)
    : `${MONTHS[safeMonth - 1].slice(0, 3)} ${later}`

  function pickEarlier(year: number) {
    setEarlier(year)
    if (later <= year) setLater(Math.min(LAST_YEAR, year + 1))
  }

  function pickLater(year: number) {
    setLater(year)
    if (earlier >= year) setEarlier(Math.max(FIRST_YEAR, year - 1))
  }

  function retry() {
    forget(frameKey(lat, lon, extent, beforeBase))
    forget(frameKey(lat, lon, extent, afterBase))
    setDecoded({})
    setToken((value) => value + 1)
  }

  const pendingSide = beforeReady ? after : before
  const pendingLabel = beforeReady ? 'Later' : 'Earlier'
  const statusOf = (frame: Frame, sideReady: boolean) => {
    if (sideReady) return 'ready'
    if (frame.failed) return 'no coverage'
    if (frame.date) return `fetching ${formatTag(frame.date)}`
    if (frame.checking) return `checking ${formatTag(frame.checking)} · ${frame.attempt}/7`
    return 'waiting'
  }

  return (
    <div className="landscape-wrap">
      <div className="landscape-controls">
        <div className="lc-years">
          <label className="lc-field">
            <span className="lc-label mono">Earlier</span>
            <span className="lc-select">
              <select
                value={earlier}
                onChange={(event) => pickEarlier(Number(event.target.value))}
                aria-label="Earlier imagery year"
              >
                {YEARS.slice(0, -1).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} aria-hidden="true" />
            </span>
          </label>

          <span className="lc-arrow mono" aria-hidden="true">
            →
          </span>

          <label className="lc-field">
            <span className="lc-label mono">Later</span>
            <span className="lc-select">
              <select
                value={later}
                onChange={(event) => pickLater(Number(event.target.value))}
                aria-label="Later imagery year"
              >
                {YEARS.slice(1).map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} aria-hidden="true" />
            </span>
          </label>

          <label className="lc-field">
            <span className="lc-label mono">Window</span>
            <span className="lc-select">
              <select
                value={safeMonth}
                onChange={(event) => setMonth(Number(event.target.value))}
                aria-label="Imagery month"
              >
                {MONTHS.map((name, index) => (
                  <option key={name} value={index + 1} disabled={index + 1 < monthFloor}>
                    {name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} aria-hidden="true" />
            </span>
          </label>
        </div>

        <div className="lc-presets">
          {PRESETS.map((preset) => {
            const active = preset.earlier === earlier && preset.later === later
            return (
              <button
                key={preset.label}
                type="button"
                className={active ? 'lc-preset is-active' : 'lc-preset'}
                aria-pressed={active}
                onClick={() => {
                  setEarlier(preset.earlier)
                  setLater(preset.later)
                }}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="compare-shell">
        {!ready && <div className="compare-skeleton" aria-hidden="true" />}

        {after.url && (
          <img
            src={after.url}
            alt={`MODIS Terra satellite view of ${placeName}, ${afterTag}`}
            className="compare-img"
            crossOrigin="anonymous"
            onLoad={() => mark(after.url!, 'ok')}
            onError={() => mark(after.url!, 'err')}
          />
        )}
        {before.url && (
          <img
            src={before.url}
            alt={`MODIS Terra satellite view of ${placeName}, ${beforeTag}`}
            className="compare-img compare-img-before"
            style={clipStyle}
            crossOrigin="anonymous"
            onLoad={() => mark(before.url!, 'ok')}
            onError={() => mark(before.url!, 'err')}
          />
        )}

        {(beforeReady || afterReady) && (
          <div className="compare-line" style={{ left: `${position}%` }} aria-hidden="true">
            <span className="compare-handle">
              <i />
              <i />
            </span>
          </div>
        )}

        <span className="compare-tag compare-tag-left">
          <span className="mono">{beforeTag}</span>
        </span>
        <span className="compare-tag compare-tag-right">
          <span className="mono">{afterTag}</span>
        </span>

        {!ready && !failed && !partial && (
          <div className="compare-loading mono">
            <span className="loader-ring" />
            <span className="compare-loading-text">
              Loading MODIS imagery
              <em>Earlier {statusOf(before, beforeReady)}</em>
              <em>Later {statusOf(after, afterReady)}</em>
            </span>
          </div>
        )}

        {partial && (
          <div className="compare-partial mono">
            <span className="loader-ring" />
            {pendingLabel} frame · {statusOf(pendingSide, false)}
          </div>
        )}

        {failed && (
          <div className="compare-loading mono">
            <span className="compare-loading-text">
              Imagery is unavailable for this window
              <em>The statistical record is unaffected. Try another month or year.</em>
            </span>
            <button type="button" className="compare-retry mono" onClick={retry}>
              <RotateCcw size={12} aria-hidden="true" />
              Retry
            </button>
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
          MODIS Terra true color, {MONTHS[safeMonth - 1]}, 250-metre resolution — {later - earlier}{' '}
          years apart. A single day, so clouds and satellite swath edges are part of the scene. The
          satellite record begins in late February 2000, so it covers less of the span than the
          1991–2025 statistical record.
        </p>
        <span className="mono">Imagery context only · not read by the trend test</span>
      </div>
    </div>
  )
}