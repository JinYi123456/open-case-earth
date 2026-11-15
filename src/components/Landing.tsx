import { useRef, useState } from 'react'
import { ArrowRight, ArrowUpRight, Database, FunctionSquare, MapPin, ScanLine } from 'lucide-react'
import { CURATED_CASES, FEATURED_CASES, type CuratedCase } from '../data/curated'
import { reversePlace } from '../lib/geocode'
import type { CaseConfig, Place, SeriesPoint } from '../types'
import { GlobeHero } from './GlobeHero'
import { CrosshairMark, LogoMark } from './Icons'
import { Intake } from './Intake'
import { Sparkline } from './ui'

const DEMO_POINTS: SeriesPoint[] = [
  26.81, 26.74, 27.02, 26.95, 27.18, 27.04, 27.31, 27.12, 27.24, 27.46, 27.3, 27.52,
  27.38, 27.6, 27.44, 27.71, 27.55, 27.79, 27.62, 27.88, 27.7, 27.96, 27.82, 28.04,
  27.91, 28.12, 27.98, 28.19, 28.05, 28.24, 28.11, 28.31, 28.18, 28.36, 28.22, 28.41,
].map((value, index) => ({ year: 1990 + index, value, months: 12 }))

interface LandingProps {
  onStart: (config: CaseConfig) => void
  onOpenMethod: () => void
  onOpenData: () => void
}

export function Landing({ onStart, onOpenMethod, onOpenData }: LandingProps) {
  const [pickedPlace, setPickedPlace] = useState<Place | null>(null)
  const intakeRef = useRef<HTMLDivElement>(null)

  async function handleGlobePick(place: Place) {
    const resolved =
      place.name === 'Pinned coordinates' ? await reversePlace(place.lat, place.lon) : place
    setPickedPlace(resolved)
    intakeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function startCurated(item: CuratedCase) {
    onStart({
      place: {
        name: item.name,
        detail: item.detail,
        lat: item.lat,
        lon: item.lon,
      },
      variable: item.variable,
      scope: item.scope,
    })
  }

  return (
    <>
      <section className="hero" id="open-case">
        <div className="hero-globe">
          <GlobeHero onPick={handleGlobePick} onOpenCase={startCurated} />
        </div>
        <div className="hero-shade" aria-hidden="true" />

        <div className="hero-content container">
          <div className="hero-copy">
            <p className="eyebrow reveal" style={{ animationDelay: '80ms' }}>
              Planetary forensics · open record
            </p>
            <h1 className="display-xl hero-title reveal" style={{ animationDelay: '160ms' }}>
              Every place
              <br />
              <span>leaves a record.</span>
            </h1>
            <p className="lede hero-lede reveal" style={{ animationDelay: '260ms' }}>
              Open four decades of NASA Earth data for any place on Earth. Find the trend, see
              where it changed, and test whether the evidence is significant.
            </p>

            <div ref={intakeRef} className="hero-intake reveal" style={{ animationDelay: '360ms' }}>
              <Intake pickedPlace={pickedPlace} onPlacePick={setPickedPlace} onStart={onStart} />
            </div>

            <div className="hero-facts reveal" style={{ animationDelay: '480ms' }}>
              <span>
                <strong>35</strong> annual records
              </span>
              <span>
                <strong>8</strong> Earth signals
              </span>
              <span>
                <strong>25</strong> grid cells tested
              </span>
              <span>
                <strong>95%</strong> confidence standard
              </span>
            </div>
          </div>
        </div>

        <div className="hero-cases container reveal" style={{ animationDelay: '620ms' }}>
          <div className="hero-cases-head">
            <span className="mono">Start with a known case</span>
            <span className="mono hero-cases-hint">opened live, not a screenshot</span>
          </div>
          <div className="hero-cases-grid">
            {FEATURED_CASES.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`case-strip tone-${item.tone}`}
                onClick={() => startCurated(item)}
              >
                <span className="case-strip-top">
                  <span className="mono">{item.kicker}</span>
                  <ArrowUpRight size={15} strokeWidth={1.7} />
                </span>
                <span className="case-strip-name serif">{item.name}</span>
                <span className="case-strip-detail mono">{item.detail}</span>
                <span className="case-strip-bottom">
                  <span className="case-strip-stat">
                    <strong className="num">{item.stat}</strong>
                    <span>{item.statNote}</span>
                  </span>
                  <span className="case-strip-blurb">{item.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="scroll-hint mono" aria-hidden="true">
          <span className="scroll-line" />
          Read the file
        </div>
      </section>

      <section className="landing-section how" id="how">
        <div className="container">
          <div className="section-intro">
            <div>
              <p className="eyebrow">The shape of a case</p>
              <h2 className="display-lg">
                A verdict you
                <br />
                can trace.
              </h2>
            </div>
            <p className="lede">
              No black box. Three steps turn a place into a finding: pin the point, read the
              record, then try to break the trend. The evidence decides the verdict, not the other
              way around.
            </p>
          </div>

          <div className="how-grid">
            <article className="how-card">
              <span className="how-index mono">01</span>
              <div className="how-visual">
                <CrosshairMark size={92} />
                <span className="how-coords mono">1.458° N · 103.765° E</span>
                <span className="how-ring" />
              </div>
              <h3 className="display-md">Pin a place</h3>
              <p>
                Search a city or click the globe. Every record starts from a coordinate and the
                reanalysis cell that contains it.
              </p>
              <span className="how-tag mono">
                <MapPin size={12} /> any land or sea point
              </span>
            </article>

            <article className="how-card">
              <span className="how-index mono">02</span>
              <div className="how-visual how-visual-chart">
                <span className="how-chart-label mono">air temperature · °C</span>
                <Sparkline points={DEMO_POINTS} color="var(--amber)" width={260} height={72} />
                <span className="how-chart-end mono">+0.24 / decade</span>
              </div>
              <h3 className="display-md">Read the record</h3>
              <p>
                Thirty-five annual values, rebuilt from monthly observations. Seasonal lenses and
                a surrounding grid show where the average hides the story.
              </p>
              <span className="how-tag mono">
                <ScanLine size={12} /> 1991—2025
              </span>
            </article>

            <article className="how-card">
              <span className="how-index mono">03</span>
              <div className="how-visual how-visual-stamp">
                <span className="stamp stamp-warm stamp-animate">Significant warming</span>
                <span className="how-stamp-p mono">Mann–Kendall p &lt; 0.001</span>
              </div>
              <h3 className="display-md">Test the claim</h3>
              <p>
                Sen&apos;s slope, a Mann–Kendall test, a withheld-period check, and false-discovery
                control across the grid. A result has to survive all of them.
              </p>
              <span className="how-tag mono">
                <FunctionSquare size={12} /> six checks
              </span>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-section archive" id="archive">
        <div className="container">
          <div className="archive-head">
            <div>
              <p className="eyebrow">The open case archive</p>
              <h2 className="display-lg">
                Six places.
                <br />
                Six different stories.
              </h2>
            </div>
            <p className="archive-note">
              These are not screenshots. Every row opens a live analysis, re-read from the public
              record each time. Some trends are strong, one is deliberately unresolved.
            </p>
          </div>

          <div className="archive-table" role="list">
            <div className="archive-row archive-row-head mono" aria-hidden="true">
              <span>Case</span>
              <span>Signal</span>
              <span>Area</span>
              <span>Finding / decade</span>
              <span />
            </div>
            {CURATED_CASES.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="archive-row"
                role="listitem"
                onClick={() => startCurated(item)}
              >
                <span className="archive-case">
                  <span className="archive-index mono">{String(index + 1).padStart(2, '0')}</span>
                  <span>
                    <strong className="serif">{item.name}</strong>
                    <span className="archive-detail">{item.detail}</span>
                  </span>
                </span>
                <span className="archive-signal">
                  <span
                    className="archive-signal-dot"
                    style={{
                      color:
                        item.variable === 'PRECTOTCORR'
                          ? 'var(--blue)'
                          : item.variable === 'SNODP'
                            ? 'var(--ice)'
                            : 'var(--amber)',
                    }}
                  />
                  {item.kicker.split('·')[0].trim()}
                </span>
                <span className="archive-scope mono">{item.scope}</span>
                <span className={`archive-stat tone-${item.tone}`}>
                  <strong className="num">{item.stat}</strong>
                  <span>{item.statNote}</span>
                </span>
                <span className="archive-arrow">
                  <ArrowUpRight size={18} strokeWidth={1.5} />
                </span>
              </button>
            ))}
          </div>
          <p className="archive-foot mono">
            Strong findings and quiet ones share the same method. Absence of a signal is a result.
          </p>
        </div>
      </section>

      <section className="landing-section method-band">
        <div className="container method-grid">
          <div className="method-copy">
            <p className="eyebrow">Open method · open data</p>
            <h2 className="display-lg">
              No black box.
              <br />
              Every number
              <br />
              has a formula.
            </h2>
            <p className="lede">
              The analysis runs in your browser against public NASA services. The slope, the
              significance test, the spatial correction, and the limitations are all visible before
              you trust the verdict.
            </p>
            <div className="method-actions">
              <button type="button" className="btn btn-primary" onClick={onOpenMethod}>
                Read the method
                <ArrowRight size={15} />
              </button>
              <button type="button" className="btn btn-ghost" onClick={onOpenData}>
                Browse the data
                <Database size={15} />
              </button>
            </div>
          </div>

          <div className="method-side">
            <div className="formula-card">
              <span className="mono">01 · the rate</span>
              <strong>Sen&apos;s slope</strong>
              <p>Median of all pairwise slopes. Resistant to a single extreme year.</p>
              <code>β = median[(yⱼ − yᵢ) / (xⱼ − xᵢ)]</code>
            </div>
            <div className="formula-card">
              <span className="mono">02 · the test</span>
              <strong>Mann–Kendall</strong>
              <p>A rank test for monotone change, with a tie correction for repeated values.</p>
              <code>S = Σ sgn(yⱼ − yᵢ)</code>
            </div>
            <div className="formula-card">
              <span className="mono">03 · the grid</span>
              <strong>False-discovery control</strong>
              <p>Twenty-five local tests, adjusted together so coincidence cannot pose as pattern.</p>
              <code>q = p · m / rank</code>
            </div>
            <div className="method-sources">
              <a href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">
                <span>
                  <strong>NASA POWER</strong>
                  <span className="mono">Monthly point records · MERRA-2 + CERES</span>
                </span>
                <ArrowUpRight size={15} />
              </a>
              <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noreferrer">
                <span>
                  <strong>NASA GIBS</strong>
                  <span className="mono">MODIS Terra imagery</span>
                </span>
                <ArrowUpRight size={15} />
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="pre-footer">
        <div className="container pre-footer-inner">
          <LogoMark size={42} />
          <p className="serif">
            A place is not a data point.
            <br />
            It is a record with a direction.
          </p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              document.getElementById('open-case')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            Open a case
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
    </>
  )
}
