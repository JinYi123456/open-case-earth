# Open Case: Earth

**Every place leaves a record.**

Open Case: Earth is a planetary-forensics tool. Pick any place on Earth, pull four decades
of open Earth-system data, and read the trend as a case file: a verdict, the rate of change,
the spatial pattern, the seasonal lens, and the evidence that decides whether the finding
survives scrutiny.

The analysis runs entirely in your browser against public data services. No account, no API
key, no server-side verdict.

## What a case contains

- **Verdict** — a plain-language finding with Sen's slope, a 95% interval, the modelled change
  over the record, and a confidence level.
- **The record** — 35 annual values (1991–2025) rebuilt from monthly observations, with a
  raw/anomaly toggle and CSV export.
- **Where it changed** — a 5×5 grid of local trends around the point, adjusted together with
  Benjamini–Hochberg false-discovery control so coincidence cannot pose as pattern.
- **Seasonal lens** — DJF / MAM / JJA / SON trends, because the annual average hides the calendar.
- **Evidence board** — six checks that try to break the claim: significance, spatial agreement,
  seasonal agreement, completeness, a withheld-period robustness check, and estimator agreement.
- **Eight signals** — temperature, rainfall, soil wetness, solar irradiance, cloud cover,
  humidity, wind, and snow depth at the same point.
- **Landscape context** — a MODIS Terra true-color comparison, 2002 vs 2024.
- **Export** — a shareable case card (PNG) with a QR code back to the live analysis, plus a
  permalink for every case.

## Method

| Step | Approach |
| --- | --- |
| Rate | Sen's slope — median of all pairwise slopes, resistant to a single extreme year |
| Test | Mann–Kendall with tie correction and continuity correction |
| Interval | Rank-based Sen 95% confidence interval |
| Cross-check | Ordinary least-squares slope |
| Spatial | Benjamini–Hochberg FDR at 5% across 25 cells |
| Baseline | 1991–2020 mean for anomalies |
| Seasons | DJF pairs the previous December with January and February |

A trend is reported as significant at `p < 0.05` with at least 15 complete years. Absence of a
signal is treated as a result, not a failure. The method drawer documents every formula and the
limits of the verdict (it is not attribution; reanalysis is not a station measurement).

## Data sources

- **NASA POWER** — monthly point API, MERRA-2 reanalysis (atmospheric and land variables).
- **NASA GIBS** — Blue Marble basemap (globe and spatial grid) and MODIS Terra
  corrected-reflectance true color.
- **Photon / OpenStreetMap** — place search and reverse geocoding.

All sources are public and keyless. NASA is cited as a data source; this is an independent
project and is not affiliated with NASA.

## Run locally

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check + production build
npm run preview    # serve the production build
npm test           # statistics + analysis unit tests
npm run typecheck  # strict TypeScript check
npm run lint       # oxlint
```

## Stack

Vite · React 19 · TypeScript (strict) · Tailwind CSS v4 · MapLibre GL (globe projection) ·
Vitest. Typefaces: Instrument Serif, Space Grotesk, JetBrains Mono.

## Project layout

```
src/
  components/   UI — landing, intake, globe, case view, charts, maps, drawer, export
  data/         variable definitions, scopes, curated cases
  lib/          statistics, analysis, data fetching, geocoding, URL state, formatting
  types.ts      shared domain types
```

## License

MIT. Data remains subject to the terms of its respective providers.