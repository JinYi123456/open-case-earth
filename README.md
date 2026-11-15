# Open Case: Earth

**Every place leaves a record.**

- **Live app** — <https://open-case-earth.vercel.app/>
- **Source** — <https://github.com/JinYi123456/open-case-earth>
- **Walkthrough** — <https://youtu.be/SP3VFS-zw9M> — a 2 min 58 s continuous screen recording of
  one full case, from place search through the record, the spatial grid, the seasonal lens and
  the evidence board.

Open Case: Earth is a planetary-forensics tool. Pick any place on Earth, pull thirty-five years
of open Earth-system data, and read the trend as a case file: a verdict, the rate of change,
the spatial pattern, the seasonal lens, and the evidence that decides whether the finding
survives scrutiny.

The analysis runs entirely in your browser against public data services. No account, no API
key, no server-side verdict.

## What a case contains

- **Verdict** — a plain-language finding with Sen's slope, a 95% interval, the modelled change
  over the record, and a grade (Established / Probable / Tentative / Unresolved) set by the
  evidence board rather than by the slope.
- **The record** — annual values rebuilt from monthly observations: 35 years (1991–2025) for the
  reanalysis signals, 25 years (2001–2025) for solar and cloud, with a raw/anomaly toggle and CSV
  export.
- **Where it changed** — a 5×5 grid of local samples around the point. Samples that resolve to the
  same model cell are collapsed first, then Benjamini–Hochberg false-discovery control runs once
  per independent cell so coincidence cannot pose as pattern.
- **Seasonal lens** — DJF / MAM / JJA / SON trends, because the annual average hides the calendar.
- **Evidence board** — six checks that try to break the claim: significance, spatial agreement,
  seasonal agreement, completeness, endpoint robustness (drop the first and last three years),
  and estimator agreement.
- **Eight signals** — temperature, rainfall, soil wetness, solar irradiance, cloud cover,
  humidity, wind, and snow depth at the same point, with false-discovery control across the eight
  tests as well.
- **Landscape context** — a MODIS Terra true-color swipe comparison with selectable years
  (2000–2025) and month, opening on July 2002 vs July 2024.
- **Export** — a shareable case card (PNG) with a QR code back to the live analysis, plus a
  permalink for every case.

## Method

| Step | Approach |
| --- | --- |
| Rate | Sen's slope — median of all pairwise slopes, resistant to a single extreme year |
| Test | Mann–Kendall with tie correction and continuity correction |
| Persistence | Hamed–Rao variance correction on Sen-detrended residual ranks, screened at ±1.96/√n |
| Interval | Rank-based Sen 95% confidence interval (Sen 1968, eq. 2.6) |
| Cross-check | Ordinary least-squares slope |
| Spatial | Samples collapsed to independent model cells, then Benjamini–Hochberg FDR at 5% |
| Matrix | Benjamini–Hochberg FDR at 5% across the eight signals |
| Baseline | 1991–2020 mean for anomalies, 2001–2020 for solar and cloud |
| Seasons | DJF pairs the previous December with January and February |

Significance is judged on the serial-corrected `p < 0.05` with at least 15 complete years.
Absence of a signal is treated as a result, not a failure. The method drawer documents every
formula and the limits of the verdict (it is not attribution; reanalysis is not a station
measurement; Hamed–Rao addresses serial correlation, not a step change inside the record).

## Data sources

- **NASA POWER** — monthly point API (`community=AG`, 1990–2025). Upstream products, as named by
  the API response header:
  - MERRA-2 reanalysis — `T2M`, `PRECTOTCORR`, `GWETROOT`, `SNODP`.
  - MERRA-2, derived by POWER — `RH2M`, `WS2M`.
  - Satellite radiation — `ALLSKY_SFC_SW_DWN`, `CLOUD_AMT`: GEWEX SRB through 2000, CERES SYN1deg
    from 2001. Only the CERES era (2001–2025) is tested, so the product switch cannot be read as a
    trend.
- **NASA GIBS** — Blue Marble basemap (globe and spatial grid) and MODIS Terra
  corrected-reflectance true color.
- **Photon / OpenStreetMap** — place search and reverse geocoding.

All sources are public and keyless. NASA is cited as a data source; this is an independent
project and is not affiliated with NASA.

## Run locally

Requires Node 22.12+ or 24.x (the Vitest 5 engine range).

```bash
npm install
npm run dev        # start the dev server
npm run build      # type-check + production build
npm run preview    # serve the production build
npm test           # statistics + analysis unit tests
npm run typecheck  # strict TypeScript check
npm run lint       # oxlint
```

The 40 unit tests pin Sen's slope and the Hamed–Rao corrected `p` against reference values
from SciPy and pymannkendall, so a refactor cannot silently move the statistics.

## Stack

Vite · React 19 · TypeScript (strict) · Tailwind CSS v4 · MapLibre GL (globe projection) ·
Framer Motion · Lucide icons · html-to-image and qrcode (case-card export) · Vitest · oxlint.

Typefaces — Instrument Serif, Space Grotesk, JetBrains Mono — are self-hosted through Fontsource,
so the app makes no font requests to a third-party CDN.

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