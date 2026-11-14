import * as maplibregl from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'

// MapLibre v6 derives the worker URL as a sibling of its own module, which Vite's
// optimizer and production bundler do not emit. Point it at the bundled worker.
maplibregl.setWorkerUrl(workerUrl)

export { maplibregl }