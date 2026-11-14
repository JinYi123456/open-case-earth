import { useEffect, useRef } from 'react'
import { maplibregl } from '../lib/maplibre'
import { GRID_SIZE } from '../data/variables'
import { cellSize } from '../lib/power'
import { formatCoords, pValue, signed } from '../lib/format'
import type { GridCell, VariableDef } from '../types'

interface MosaicMapProps {
  lat: number
  lon: number
  extent: number
  cells: GridCell[]
  variable: VariableDef
  placeName: string
  complete: boolean
  total: number
  failures: number
}

const BASEMAP_TILES = [
  'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg',
]

function cellColor(cell: GridCell, variable: VariableDef): string {
  if (!cell.significant) return '#63716a'
  if (cell.direction === 'up') return variable.upColor
  if (cell.direction === 'down') return variable.downColor
  return '#8a978f'
}

function buildCollection(cells: GridCell[], extent: number, variable: VariableDef) {
  const half = cellSize(extent, GRID_SIZE) / 2
  return {
    type: 'FeatureCollection' as const,
    features: cells.map((cell) => {
      const south = Math.max(-84, cell.lat - half)
      const north = Math.min(84, cell.lat + half)
      const west = cell.lon - half
      const east = cell.lon + half
      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Polygon' as const,
          coordinates: [
            [
              [west, south],
              [east, south],
              [east, north],
              [west, north],
              [west, south],
            ],
          ],
        },
        properties: {
          color: cellColor(cell, variable),
          opacity: cell.significant ? 0.68 : 0.18,
          slope: cell.slopePerDecade,
          p: cell.p,
          q: cell.q,
          significant: cell.significant,
          direction: cell.direction,
          lat: cell.lat,
          lon: cell.lon,
        },
      }
    }),
  }
}

function popupHtml(
  cell: { slope: number; p: number; q: number; significant: boolean; direction: string; lat: number; lon: number },
  variable: VariableDef,
) {
  const status = cell.significant
    ? 'Survives false-discovery control'
    : 'Not significant after correction'
  return `<div class="map-popup">
    <span class="map-popup-kicker">GRID CELL · ${formatCoords(cell.lat, cell.lon)}</span>
    <strong>${signed(cell.slope, variable.slopeDecimals, variable.slopeUnit)} / decade</strong>
    <span class="map-popup-row">p = ${pValue(cell.p)} · q = ${pValue(cell.q)}</span>
    <span class="map-popup-status ${cell.significant ? 'is-on' : ''}">${status}</span>
  </div>`
}

export function MosaicMap({
  lat,
  lon,
  extent,
  cells,
  variable,
  placeName,
  complete,
  total,
  failures,
}: MosaicMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const loadedRef = useRef(false)
  const cellsRef = useRef(cells)
  cellsRef.current = cells

  useEffect(() => {
    if (!container.current) return
    loadedRef.current = false
    const map = new maplibregl.Map({
      container: container.current,
      style: {
        version: 8,
        sources: {
          basemap: {
            type: 'raster',
            tiles: BASEMAP_TILES,
            tileSize: 256,
            maxzoom: 8,
            attribution: 'NASA Blue Marble · GIBS',
          },
          cells: {
            type: 'geojson',
            data: buildCollection(cellsRef.current, extent, variable),
          },
        },
        layers: [
          { id: 'bg', type: 'background', paint: { 'background-color': '#06100d' } },
          {
            id: 'basemap',
            type: 'raster',
            source: 'basemap',
            paint: {
              'raster-opacity': 0.55,
              'raster-saturation': -0.72,
              'raster-contrast': 0.1,
              'raster-brightness-max': 0.45,
            },
          },
          {
            id: 'cells-fill',
            type: 'fill',
            source: 'cells',
            paint: {
              'fill-color': ['get', 'color'],
              'fill-opacity': ['get', 'opacity'],
            },
          },
          {
            id: 'cells-line',
            type: 'line',
            source: 'cells',
            paint: {
              'line-color': 'rgba(241,232,215,0.38)',
              'line-width': 0.65,
            },
          },
        ],
      },
      center: [lon, lat],
      zoom: 5.4,
      maxZoom: 9,
      minZoom: 1,
      scrollZoom: false,
      dragRotate: false,
      pitchWithRotate: false,
      attributionControl: { compact: true },
    })

    mapRef.current = map

    map.on('load', () => {
      loadedRef.current = true
      const source = map.getSource('cells') as maplibregl.GeoJSONSource | undefined
      source?.setData(buildCollection(cellsRef.current, extent, variable))

      const pin = document.createElement('div')
      pin.className = 'mosaic-center'
      pin.title = `Case point: ${placeName}`
      new maplibregl.Marker({ element: pin, anchor: 'center' })
        .setLngLat([lon, lat])
        .addTo(map)

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 88, unit: 'metric' }), 'bottom-left')

      const latitudePad = extent * 1.08
      const longitudePad = extent * 1.08
      map.fitBounds(
        [
          [lon - longitudePad, lat - latitudePad],
          [lon + longitudePad, lat + latitudePad],
        ],
        { padding: { top: 24, bottom: 24, left: 24, right: 24 }, duration: 0, maxZoom: 7.2 },
      )

      map.on('click', 'cells-fill', (event) => {
        const feature = event.features?.[0]
        if (!feature) return
        const properties = feature.properties as
          | Record<string, string | number | boolean>
          | undefined
        if (!properties) return
        const popup = new maplibregl.Popup({ closeButton: false, offset: 8, maxWidth: '240px' })
          .setLngLat(event.lngLat)
          .setHTML(
            popupHtml(
              {
                slope: Number(properties.slope),
                p: Number(properties.p),
                q: Number(properties.q),
                significant: Boolean(properties.significant),
                direction: String(properties.direction),
                lat: Number(properties.lat),
                lon: Number(properties.lon),
              },
              variable,
            ),
          )
          .addTo(map)
        popup.getElement()?.setAttribute('role', 'status')
      })

      map.on('mouseenter', 'cells-fill', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'cells-fill', () => {
        map.getCanvas().style.cursor = ''
      })
    })

    const observer = new ResizeObserver(() => map.resize())
    observer.observe(container.current)

    return () => {
      observer.disconnect()
      loadedRef.current = false
      map.remove()
      mapRef.current = null
    }
  }, [lat, lon, extent, variable, placeName])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !loadedRef.current) return
    const source = map.getSource('cells') as maplibregl.GeoJSONSource | undefined
    source?.setData(buildCollection(cells, extent, variable))
  }, [cells, extent, variable])

  return (
    <div className="mosaic-map-shell">
      <div ref={container} className="mosaic-map" aria-label={`Spatial trend grid around ${placeName}`} />
      <div className="mosaic-map-status mono">
        {complete ? (
          <>
            <span className="status-dot is-ready" />
            {total - failures} of {total} cells read
          </>
        ) : (
          <>
            <span className="status-dot is-working" />
            Sampling {cells.length} of {total}
          </>
        )}
      </div>
      <p className="sr-only">
        A five by five grid of local trends around {placeName}. Filled cells survive
        false-discovery control; muted cells do not. Select a cell on the map for its slope and
        p-value.
      </p>
    </div>
  )
}
