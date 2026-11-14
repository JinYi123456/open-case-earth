import { useEffect, useRef } from 'react'
import { maplibregl } from '../lib/maplibre'
import { FEATURED_CASES, type CuratedCase } from '../data/curated'
import type { Place } from '../types'

const GIBS_TILES =
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'

interface GlobeHeroProps {
  onPick: (place: Place) => void
  onOpenCase: (item: CuratedCase) => void
}

export function GlobeHero({ onPick, onOpenCase }: GlobeHeroProps) {
  const container = useRef<HTMLDivElement>(null)
  const onPickRef = useRef(onPick)
  const onOpenCaseRef = useRef(onOpenCase)
  onPickRef.current = onPick
  onOpenCaseRef.current = onOpenCase

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
      center: [96, 8],
      zoom: window.innerWidth < 760 ? 0.55 : 1.15,
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

    const resume = { at: 0 }
    let longitude = 96
    let frame = 0
    let previous = performance.now()

    const pause = () => {
      resume.at = Date.now() + 6000
    }

    const spin = (now: number) => {
      const delta = Math.min(64, now - previous)
      previous = now
      const active = Date.now() > resume.at
      if (active && !reduced && !document.hidden && map.loaded()) {
        longitude = (longitude + delta * 0.0016) % 360
        map.jumpTo({ center: [longitude, 8] })
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
      longitude = map.getCenter().lng
      resume.at = Date.now() + 6000
    })

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container.current)

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      map.remove()
    }
  }, [])

  return (
    <div className="globe-stage">
      <div className="globe-glow" aria-hidden="true" />
      <div ref={container} className="globe-canvas" />
      <div className="globe-caption mono" aria-hidden="true">
        NASA Blue Marble · drag to turn · click to pin
      </div>
    </div>
  )
}
