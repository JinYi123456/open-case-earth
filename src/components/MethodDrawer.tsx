import { useEffect, useRef } from 'react'
import { ArrowUpRight, Database, FunctionSquare, X } from 'lucide-react'
import { VARIABLES } from '../data/variables'
import { LogoMark } from './Icons'

export type DrawerMode = 'method' | 'data'

const ACCESSED = new Date().toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

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
          Each point is a NASA POWER monthly grid cell sampled at the case coordinate — MERRA-2
          reanalysis for the atmospheric and land signals, satellite radiation for solar and cloud.
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
          with a tie term in the variance.
        </p>
        <code>S = Σ sgn(yⱼ − yᵢ)</code>
        <code>p = 2 · (1 − Φ(|z|))</code>
        <p>
          Climate years are not independent: a warm year tends to follow a warm year, which leaves
          the uncorrected variance too small and the evidence too strong. The variance is therefore
          corrected with Hamed–Rao. The series is first detrended with the Sen slope so a real trend
          is not mistaken for persistence, the residual ranks are autocorrelated at every lag, and
          only lags outside the 95% white-noise band ±1.96/√n contribute.
        </p>
        <code>n/n* = 1 + [2 / n(n−1)(n−2)] · Σ (n−k)(n−k−1)(n−k−2) ρ(k)</code>
        <code>Var*(S) = Var(S) · n/n*</code>
        <p>
          Significance is judged on that corrected p at p &lt; 0.05 with at least 15 complete years.
          The evidence board shows the lag-1 correlation and the variance factor, so a correction
          that changed nothing is as visible as one that did. Pre-whitening is deliberately not
          used: removing lag-1 persistence from a trending series also removes part of the trend.
        </p>
      </section>

      <section>
        <span className="drawer-step mono">04 · the grid</span>
        <h3>One point is not a pattern.</h3>
        <p>
          A five-by-five equal-angle grid spans the selected area. Each sample is analysed with the
          same record and the same test. Because repeated tests raise the chance of a coincidence,
          p-values are adjusted together with the Benjamini–Hochberg procedure at a 5%
          false-discovery rate.
        </p>
        <code>q = p · m / rank, enforced monotone</code>
        <p>
          At the local spacing the samples are finer than the model grid, so several of them return
          the same cell. Samples that resolve to an identical annual series are collapsed before the
          adjustment, and m counts independent cells rather than samples — otherwise one cell would
          be counted as separate evidence several times and the correction would be too generous.
          The panel reports both numbers.
        </p>
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
        <p>
          These checks become the evidence board, and the board sets the grade printed on the
          verdict. A confirmed check scores one point, a partial check a half. With a significant
          test, 85% or more of the settled checks reads as <strong>Established</strong>, 60% or more
          as <strong>Probable</strong>, and anything lower as <strong>Tentative</strong>. Without a
          significant test the grade is <strong>Unresolved</strong>, whatever the slope looks like.
          Checks still collecting are left out of the denominator rather than counted as failures.
        </p>
        <p>A verdict without these checks is only a slope.</p>
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
            Every value is a grid-cell average, not a station measurement: MERRA-2 on roughly
            0.5° × 0.625°, the radiation products on a 1° grid. Local exposure can differ.
          </li>
          <li>
            Solar and cloud switch upstream product in 2001, from GEWEX SRB to CERES SYN1deg. A
            small step at that boundary is possible, so read radiation trends with extra care.
          </li>
          <li>
            Annual aggregation hides extremes. A flat annual mean can still contain more violent
            months.
          </li>
          <li>
            The Hamed–Rao correction addresses serial correlation in the mean, not long-memory
            persistence, a step change inside the record, or cross-correlation between neighbouring
            cells. The rank-based interval remains an approximation.
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
        Eight Earth-system variables from one monthly API, one imagery service, one geocoder. Nothing
        is hidden behind an account.
      </p>

      <section>
        <span className="drawer-step mono">Variables</span>
        <div className="data-table">
          <div className="data-row data-row-head mono">
            <span>Variable</span>
            <span>Unit</span>
            <span>Annual</span>
            <span>Upstream source</span>
          </div>
          {VARIABLES.map((variable) => (
            <div className="data-row" key={variable.id}>
              <span>
                <strong>{variable.short}</strong>
                <span className="mono">{variable.id}</span>
              </span>
              <span className="mono">{variable.annualUnit}</span>
              <span className="mono">{variable.aggregate === 'sum' ? 'Sum' : 'Mean'}</span>
              <span className="mono" title={variable.sourceDetail}>
                {variable.source}
              </span>
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
          Prediction Of Worldwide Energy Resources serves several upstream NASA products through one
          API. Its response header names them on every request, and the case chip shows the source
          that belongs to the selected signal:
        </p>
        <ul>
          <li>MERRA-2 reanalysis — temperature, rainfall, root-zone wetness, snow depth.</li>
          <li>MERRA-2, derived by POWER — relative humidity and wind speed.</li>
          <li>
            Satellite radiation — solar irradiance and cloud amount, from GEWEX SRB through 2000 and
            CERES SYN1deg from 2001.
          </li>
        </ul>
        <p>
          The request asks for monthly values from 1990 through 2025 at the exact case coordinate.
          Values flagged as missing (−999) are discarded.
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
          The landscape comparison uses two single-day MODIS Terra corrected-reflectance images
          requested from the GIBS WMS at 900 × 600 pixels. Both years and the month are yours to
          choose, from 2000 to 2025; the case opens on 15 July 2002 against 15 July 2024. January and
          February 2000 are disabled because they predate Terra's first granules. If a requested day
          has no coverage, the next days are tried in order — +1, +2, +3, +4, +6, +9 — and the tag
          shows the date actually returned. Clouds and swath edges are retained because the images
          are context, not evidence for the trend. The satellite record therefore covers less of the
          span than the 1991–2025 statistical record.
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
          NASA POWER Project. Monthly point data: MERRA-2; CERES SYN1deg; GEWEX SRB. NASA Langley
          Research Center. Accessed {ACCESSED}.
        </code>
        <code>
          NASA GIBS. MODIS Terra Corrected Reflectance True Color, selected days 2000–2025
          (default 15 July 2002 and 15 July 2024).
        </code>
      </section>
    </div>
  )
}
