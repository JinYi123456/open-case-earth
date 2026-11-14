import { useEffect, useRef } from 'react'
import { ArrowUpRight, Database, FunctionSquare, X } from 'lucide-react'
import { VARIABLES } from '../data/variables'
import { LogoMark } from './Icons'

export type DrawerMode = 'method' | 'data'

interface MethodDrawerProps {
  mode: DrawerMode | null
  onClose: () => void
  onModeChange: (mode: DrawerMode) => void
}

export function MethodDrawer({ mode, onClose, onModeChange }: MethodDrawerProps) {
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!mode) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [mode, onClose])

  if (!mode) return null

  return (
    <div className="drawer-root">
      <button type="button" className="drawer-backdrop" aria-label="Close panel" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
        <header className="drawer-head">
          <div className="drawer-brand">
            <LogoMark size={24} />
            <span id="drawer-title" className="mono">
              {mode === 'method' ? 'Method / how a case is read' : 'Data / what the record contains'}
            </span>
          </div>
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="drawer-tabs" role="tablist" aria-label="Reference sections">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'method'}
            className={mode === 'method' ? 'is-active' : ''}
            onClick={() => onModeChange('method')}
          >
            <FunctionSquare size={14} />
            Method
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'data'}
            className={mode === 'data' ? 'is-active' : ''}
            onClick={() => onModeChange('data')}
          >
            <Database size={14} />
            Data
          </button>
        </div>

        <div className="drawer-body">
          {mode === 'method' ? <MethodContent /> : <DataContent />}
        </div>

        <footer className="drawer-foot mono">
          <span>Method v1.0</span>
          <span>All calculations run in this browser</span>
        </footer>
      </aside>
    </div>
  )
}

function MethodContent() {
  return (
    <div className="prose">
      <p className="drawer-lede">
        A trend is a claim. This is the sequence of tests that claim has to survive, and the places
        where the method stops short.
      </p>

      <section>
        <span className="drawer-step mono">01 · the record</span>
        <h3>Thirty-five annual values, rebuilt from monthly observations.</h3>
        <p>
          Each point is a reanalysis cell from NASA POWER (MERRA-2), sampled at the case coordinate.
          Monthly values are validated, then reduced to one value per year.
        </p>
        <ul>
          <li>Mean variables: annual mean of the valid monthly values.</li>
          <li>Rainfall: sum of monthly rates × days in each month, in millimetres per year.</li>
          <li>Completeness rule: 10 valid months for means, 12 for sums.</li>
          <li>Baseline for anomalies: the 1991–2020 mean.</li>
        </ul>
        <code>record = monthly(1990–2025) → annual(1991–2025)</code>
      </section>

      <section>
        <span className="drawer-step mono">02 · the rate</span>
        <h3>Sen&apos;s slope, not a line of best fit.</h3>
        <p>
          The slope is the median of the slopes between every pair of years. A single record year
          cannot drag the answer the way it can with least squares. The 95% interval uses the
          rank-based Sen construction.
        </p>
        <code>β = median[ (yⱼ − yᵢ) / (xⱼ − xᵢ) ] for all i &lt; j</code>
        <p>
          The case also reports an ordinary least-squares slope. If the two disagree in sign, the
          estimator check on the evidence board is marked partial or against.
        </p>
      </section>

      <section>
        <span className="drawer-step mono">03 · the test</span>
        <h3>Mann–Kendall, with ties handled.</h3>
        <p>
          The test asks whether the ordering of annual values drifts monotonically. It is
          rank-based, so it does not assume a normal distribution. Repeated values are corrected
          with a tie term in the variance. Significance is set at p &lt; 0.05 with at least 15
          complete years.
        </p>
        <code>S = Σ sgn(yⱼ − yᵢ)</code>
        <code>p = 2 · (1 − Φ(|z|))</code>
      </section>

      <section>
        <span className="drawer-step mono">04 · the grid</span>
        <h3>One point is not a pattern.</h3>
        <p>
          A five-by-five equal-angle grid spans the selected area. Each cell is analysed with the
          same record and the same test. Because twenty-five tests raise the chance of a
          coincidence, p-values are adjusted together with the Benjamini–Hochberg procedure at a
          5% false-discovery rate.
        </p>
        <code>q = p · m / rank, enforced monotone</code>
        <p>
          Cells that do not survive the correction are drawn muted. The grid is a spatial check,
          not a claim about every point inside a cell.
        </p>
      </section>

      <section>
        <span className="drawer-step mono">05 · the checks</span>
        <h3>Try to break the finding.</h3>
        <ul>
          <li>Drop the first and last three years; does the direction survive?</li>
          <li>Do all four seasons move with the annual signal?</li>
          <li>Do Sen and least-squares agree?</li>
          <li>Is the record complete enough to be read at all?</li>
        </ul>
        <p>These checks become the evidence board. A verdict without them is only a slope.</p>
      </section>

      <section className="drawer-caution">
        <span className="drawer-step mono">06 · limits</span>
        <h3>What this verdict does not say.</h3>
        <ul>
          <li>
            It is not attribution. A significant trend is not proof of a specific cause, including
            greenhouse gases or land-use change.
          </li>
          <li>
            MERRA-2 is a reanalysis on a roughly 0.5° × 0.625° grid, not a station measurement.
            Local exposure can differ.
          </li>
          <li>
            Annual aggregation hides extremes. A flat annual mean can still contain more violent
            months.
          </li>
          <li>
            The Mann–Kendall confidence interval is approximate under autocorrelation. The test is
            robust to non-normality, not to every dependence structure.
          </li>
          <li>
            Neighbouring grid cells are correlated, so false-discovery control is conservative
            rather than exact.
          </li>
          <li>
            The record ends in 2025. One extreme year can move a slope; the endpoint check makes
            that sensitivity visible.
          </li>
        </ul>
      </section>

      <section>
        <span className="drawer-step mono">07 · reproduce</span>
        <h3>No key. No server-side verdict.</h3>
        <p>
          Place search uses Photon. Monthly records are requested directly from NASA POWER. The
          annual aggregation, Sen slope, Mann–Kendall test, interval, grid adjustment, and verdict
          all run in this browser. Records are cached locally for 14 days to avoid re-downloading
          the same point.
        </p>
        <p>
          The evidence is public: open the developer console, inspect the network requests, and
          download the annual series from the case page.
        </p>
      </section>
    </div>
  )
}

function DataContent() {
  return (
    <div className="prose">
      <p className="drawer-lede">
        Eight Earth-system variables, one monthly source, one imagery source, one geocoder. Nothing
        is hidden behind an account.
      </p>

      <section>
        <span className="drawer-step mono">Variables</span>
        <div className="data-table">
          <div className="data-row data-row-head mono">
            <span>Variable</span>
            <span>Unit</span>
            <span>Annual</span>
          </div>
          {VARIABLES.map((variable) => (
            <div className="data-row" key={variable.id}>
              <span>
                <strong>{variable.short}</strong>
                <span className="mono">{variable.id}</span>
              </span>
              <span className="mono">{variable.annualUnit}</span>
              <span className="mono">{variable.aggregate === 'sum' ? 'Sum' : 'Mean'}</span>
            </div>
          ))}
        </div>
        <p>
          All eight are requested from the same point. A case analyses one signal in depth, then
          compares the surrounding seven as a signal matrix.
        </p>
      </section>

      <section>
        <span className="drawer-step mono">Primary source</span>
        <h3>NASA POWER · monthly point API</h3>
        <p>
          Prediction Of Worldwide Energy Resources, using MERRA-2 reanalysis for atmospheric and
          land variables. The request asks for monthly values from 1990 through 2025 at the exact
          case coordinate. Values flagged as missing (−999) are discarded.
        </p>
        <a
          className="drawer-link"
          href="https://power.larc.nasa.gov/docs/services/api/temporal/monthly/"
          target="_blank"
          rel="noreferrer"
        >
          power.larc.nasa.gov — monthly point API
          <ArrowUpRight size={14} />
        </a>
        <code>
          power.larc.nasa.gov/api/temporal/monthly/point?parameters=T2M…&amp;community=AG
        </code>
      </section>

      <section>
        <span className="drawer-step mono">Imagery</span>
        <h3>NASA GIBS · MODIS Terra true color</h3>
        <p>
          The landscape comparison uses two single-day MODIS Terra corrected-reflectance images,
          15 July 2002 and 15 July 2024, requested from the GIBS WMS at 900 × 600 pixels. Clouds and
          swath edges are retained because the images are context, not evidence for the trend.
        </p>
        <a
          className="drawer-link"
          href="https://earthdata.nasa.gov/gibs"
          target="_blank"
          rel="noreferrer"
        >
          earthdata.nasa.gov/gibs
          <ArrowUpRight size={14} />
        </a>
      </section>

      <section>
        <span className="drawer-step mono">Places</span>
        <h3>Photon · OpenStreetMap</h3>
        <p>
          Place search and reverse geocoding use the public Photon service. Results are displayed
          with their administrative detail and exact coordinate so the case point is never
          ambiguous. Click directly on the globe to pin a coordinate.
        </p>
        <a className="drawer-link" href="https://photon.komoot.io/" target="_blank" rel="noreferrer">
          photon.komoot.io
          <ArrowUpRight size={14} />
        </a>
      </section>

      <section>
        <span className="drawer-step mono">Basemap</span>
        <h3>NASA GIBS · Blue Marble</h3>
        <p>
          The spatial grid sits on a darkened NASA Blue Marble shaded-relief basemap, the same
          imagery as the opening globe. It is deliberately label-free so the colour of the
          evidence stays legible.
        </p>
        <a
          className="drawer-link"
          href="https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs"
          target="_blank"
          rel="noreferrer"
        >
          earthdata.nasa.gov/gibs
          <ArrowUpRight size={14} />
        </a>
      </section>

      <section>
        <span className="drawer-step mono">Handling</span>
        <h3>Counts and conventions.</h3>
        <ul>
          <li>35 annual values per signal, 1991–2025.</li>
          <li>25 grid cells per case, each with 35 annual values.</li>
          <li>Roughly 10,500 monthly values are read for a full case.</li>
          <li>Baseline: 1991–2020. Anomalies are departures from that mean.</li>
          <li>Cache: local, 14 days. No personal data is stored.</li>
          <li>Units: °C, mm/yr, %, MJ/m²/day, m/s, cm. Soil and sky fractions are scaled to %.</li>
        </ul>
      </section>

      <section>
        <span className="drawer-step mono">Suggested citation</span>
        <code>
          NASA POWER Project. Monthly point data, MERRA-2. NASA Langley Research Center. Accessed
          14 November 2026.
        </code>
        <code>
          NASA GIBS. MODIS Terra Corrected Reflectance True Color, 15 July 2002 and 15 July 2024.
        </code>
      </section>
    </div>
  )
}
