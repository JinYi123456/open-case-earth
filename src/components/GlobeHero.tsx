import { useEffect, useRef } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { maplibregl } from '../lib/maplibre'
import { FEATURED_CASES, type CuratedCase } from '../data/curated'
import type { Place } from '../types'

const GIBS_TILES =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'

const HOME_LNG = 96
const HOME_LAT = 8

interface GlobeHeroProps {
  onPick: (place: Place) => void
  onOpenCase: (item: CuratedCase) => void
}

interface GlobeView {
  zoom: number
  pad: { left: number; top: number; right: number; bottom: number }
  lng: number
}

// The canvas stays full-bleed; padding shifts the sphere's centre to the right
// so it reads as a large planet beside the copy instead of behind the intake.
function layoutFor(width: number, height: number): GlobeView {
  if (width < 760) {
    return {
      zoom: 1.5,
      pad: { left: 0, top: 0, right: 0, bottom: Math.round(height * 0.34) },
      lng: HOME_LNG,
    }
  }
  if (width < 1100) {
    return {
      zoom: 2.2,
      pad: { left: Math.round(width * 0.34), top: 0, right: 0, bottom: 0 },
      lng: HOME_LNG,
    }
  }
  return {
    zoom: 2.7,
    pad: { left: Math.round(width * 0.56), top: 0, right: 0, bottom: 0 },
    lng: HOME_LNG,
  }
}

export function GlobeHero({ onPick, onOpenCase }: GlobeHeroProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const viewRef = useRef<GlobeView>({
    zoom: 2.12,
    pad: { left: 0, top: 0, right: 0, bottom: 0 },
    lng: HOME_LNG,
  })
  const onPickRef = useRef(onPick)
  const onOpenCaseRef = useRef(onOpenCase)
  useEffect(() => {
    onPickRef.current = onPick
    onOpenCaseRef.current = onOpenCase
  })

  useEffect(() => {
    if (!container.current) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          'blue-marble': {
            type: 'raster',
            tiles: [GIBS_TILES],
            tileSize: 256,
            minzoom: 0,
            maxzoom: 8,
            attribution: 'NASA Blue Marble · GIBS',
          },
        },
        layers: [
          {
            id: 'space',
            type: 'background',
            paint: { 'background-color': '#07100e' },
          },
          {
            id: 'earth',
            type: 'raster',
            source: 'blue-marble',
            paint: {
              'raster-opacity': 0.96,
              'raster-saturation': -0.32,
              'raster-contrast': 0.06,
              'raster-brightness-max': 0.88,
              'raster-fade-duration': 400,
            },
          },
        ],
      },
      center: [HOME_LNG, HOME_LAT],
      zoom: viewRef.current.zoom,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      scrollZoom: false,
      touchZoomRotate: false,
      renderWorldCopies: true,
      maxZoom: 4.5,
      minZoom: 0.2,
      fadeDuration: 300,
    })
    mapRef.current = map

    const resume = { at: 0 }
    let frame = 0
    let previous = performance.now()
    let lastMode = ''

    const applyLayout = (force: boolean) => {
      const width = container.current?.clientWidth ?? window.innerWidth
      const height = container.current?.clientHeight ?? window.innerHeight
      const mode = width < 760 ? 'm' : width < 1100 ? 't' : 'd'
      if (!force && mode === lastMode) return
      lastMode = mode
      const next = layoutFor(width, height)
      next.lng = viewRef.current.lng
      viewRef.current = next
      map.setPadding(next.pad)
      map.jumpTo({ center: [next.lng, HOME_LAT], zoom: next.zoom })
    }

    const pause = () => {
      resume.at = Date.now() + 6000
    }

    const spin = (now: number) => {
      const delta = Math.min(64, now - previous)
      previous = now
      const active = Date.now() > resume.at
      if (active && !reduced && !document.hidden && map.loaded()) {
        viewRef.current.lng = (viewRef.current.lng + delta * 0.0016) % 360
        map.jumpTo({ center: [viewRef.current.lng, HOME_LAT] })
      }
      frame = requestAnimationFrame(spin)
    }

    map.on('load', () => {
      try {
        map.setProjection({ type: 'globe' })
        map.setSky({
          'sky-color': '#0a1620',
          'horizon-color': '#173c3a',
          'fog-color': '#07100e',
          'fog-ground-blend': 0.35,
          'horizon-fog-blend': 0.55,
          'sky-horizon-blend': 0.35,
          'atmosphere-blend': 0.9,
        })
      } catch {
        // A mercator fallback still renders the imagery if globe is unavailable.
      }

      applyLayout(true)

      for (const item of FEATURED_CASES) {
        const pin = document.createElement('button')
        pin.type = 'button'
        pin.className = 'globe-pin'
        pin.setAttribute('aria-label', `Open case: ${item.name}`)
        pin.innerHTML = `<span class="globe-pin-halo"></span><span class="globe-pin-dot"></span><span class="globe-pin-label">${item.name}</span>`
        pin.addEventListener('click', (event) => {
          event.preventDefault()
          event.stopPropagation()
          onOpenCaseRef.current(item)
        })
        new maplibregl.Marker({ element: pin, anchor: 'left', offset: [10, 0] })
          .setLngLat([item.lon, item.lat])
          .addTo(map)
      }

      if (!reduced) {
        previous = performance.now()
        frame = requestAnimationFrame(spin)
      }
    })

    const handleClick = (event: maplibregl.MapMouseEvent) => {
      onPickRef.current({
        name: 'Pinned coordinates',
        detail: 'Reading the nearest record',
        lat: event.lngLat.lat,
        lon: event.lngLat.lng,
      })
    }

    map.on('click', handleClick)
    map.on('mousedown', pause)
    map.on('touchstart', pause)
    map.on('wheel', pause)
    map.on('dragstart', () => {
      pause()
      resume.at = Date.now() + 60000
    })
    map.on('dragend', () => {
      viewRef.current.lng = map.getCenter().lng
      resume.at = Date.now() + 6000
    })

    const observer = new ResizeObserver(() => {
      map.resize()
      applyLayout(false)
    })
    observer.observe(container.current)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [])

  function zoomBy(delta: number) {
    const map = mapRef.current
    if (!map) return
    const next = Math.max(0.2, Math.min(4.5, map.getZoom() + delta))
    map.easeTo({ zoom: next, duration: 520, easing: (t) => 1 - (1 - t) ** 3 })
  }

  function resetView() {
    const map = mapRef.current
    if (!map) return
    viewRef.current.lng = HOME_LNG
    map.easeTo({
      center: [HOME_LNG, HOME_LAT],
      zoom: viewRef.current.zoom,
      padding: viewRef.current.pad,
      duration: 820,
      easing: (t) => 1 - (1 - t) ** 3,
    })
  }

  return (
    <div className="globe-stage">
      <div className="globe-glow" aria-hidden="true" />
      <div ref={container} className="globe-canvas" />
      <div className="globe-controls" role="group" aria-label="Globe view controls">
        <button type="button" className="icon-button" aria-label="Zoom in" title="Zoom in" onClick={() => zoomBy(0.6)}>
          <Plus size={17} strokeWidth={1.8} />
        </button>
        <button type="button" className="icon-button" aria-label="Zoom out" title="Zoom out" onClick={() => zoomBy(-0.6)}>
          <Minus size={17} strokeWidth={1.8} />
        </button>
        <button type="button" className="icon-button" aria-label="Reset globe view" title="Reset view" onClick={resetView}>
          <RotateCcw size={15} strokeWidth={1.8} />
        </button>
      </div>
      <div className="globe-caption mono" aria-hidden="true">
        NASA Blue Marble · drag to turn · click to pin
      </div>
    </div>
  )
}