import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import QRCode from 'qrcode'
import {
  AlertTriangle,
  ArrowRight,
  Download,
  FileDown,
  RefreshCw,
  Share2,
} from 'lucide-react'
import { SCOPES, VARIABLE_MAP, VARIABLES } from '../data/variables'
import { buildVerdict, summarizeSpatial } from '../lib/analysis'
import { buildEvidence } from '../lib/evidence'
import {
  caseNumber,
  confidenceFromP,
  fmt,
  formatCoords,
  pValue,
  signed,
} from '../lib/format'
import { shareUrl } from '../lib/urlState'
import { useCaseData } from '../lib/useCaseData'
import type { CaseConfig, VariableId } from '../types'
import { CaseExport } from './CaseExport'
import { EvidenceBoard } from './EvidenceBoard'
import { CrosshairMark, VariableGlyph } from './Icons'
import { LandscapeCompare } from './LandscapeCompare'
import { MosaicMap } from './MosaicMap'
import { SeasonPanel } from './SeasonPanel'
import { SignalMatrix } from './SignalMatrix'
import { TrendChart, type ChartMode } from './TrendChart'
import { SectionHead, VariableBadge } from './ui'

interface CaseViewProps {
  config: CaseConfig
  onBack: () => void
  onOpenMethod: () => void
  onOpenData: () => void
  onVariable: (variable: VariableId) => void
}

export function CaseView({ config, onBack, onOpenMethod, onOpenData, onVariable }: CaseViewProps) {
  const data = useCaseData(config)
  const variable = VARIABLE_MAP[config.variable]
  const [chartMode, setChartMode] = useState<ChartMode>('raw')
  const [toast, setToast] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [qr, setQr] = useState('')
  const cardRef = useRef<HTMLDivElement>(null)
  const url = shareUrl(config)
  const number = caseNumber(`${config.place.name}:${config.variable}`)

  const verdict = useMemo(
    () => (data.analysis ? buildVerdict(config.place.name, variable, data.analysis) : null),
    [data.analysis, config.place.name, variable],
  )
  const spatial = useMemo(() => summarizeSpatial(data.grid), [data.grid])
  const evidence = useMemo(
    () =>
      data.analysis
        ? buildEvidence(data.analysis, variable, spatial, data.gridComplete)
        : [],
    [data.analysis, variable, spatial, data.gridComplete],
  )

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(url, {
      margin: 1,
      width: 220,
      color: { dark: '#07100e', light: '#f1e8d7' },
    })
      .then((value) => {
        if (alive) setQr(value)
      })
      .catch(() => {
        if (alive) setQr('')
      })
    return () => {
      alive = false
    }
  }, [url])

  useEffect(() => {
    document.title = `${config.place.name} — ${variable.label} | Open Case: Earth`
    return () => {
      document.title = 'Open Case: Earth — Every place leaves a record'
    }
  }, [config.place.name, variable.label])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 3400)
    return () => window.clearTimeout(timer)
  }, [toast])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url)
      setToast('Case link copied to clipboard')
    } catch {
      setToast('Copy was blocked — the link is in the address bar')
    }
  }

  function downloadCsv() {
    if (!data.analysis) return
    const header = `year,${variable.id}_annual,anomaly_vs_1991_2020,months_used\n`
    const rows = data.analysis.annual.points
      .map((point, index) => {
        const anomaly = data.analysis?.anomaly[index]?.value ?? 0
        return `${point.year},${point.value.toFixed(4)},${anomaly.toFixed(4)},${point.months}`
      })
      .join('\n')
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8' })
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `open-case-earth-${config.place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${variable.id}.csv`
    link.click()
    URL.revokeObjectURL(objectUrl)
    setToast('Annual series downloaded as CSV')
  }

  async function exportCard() {
    if (!cardRef.current || !data.analysis || exporting) return
    setExporting(true)
    try {
      const { toPng } = await import('html-to-image')
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        backgroundColor: '#07100e',
        cacheBust: true,
      })
      const link = document.createElement('a')
      link.download = `open-case-earth-${config.place.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
      link.href = dataUrl
      link.click()
      setToast('Case card saved as PNG')
    } catch {
      setToast('The card could not be exported. Try a screenshot instead.')
    } finally {
      setExporting(false)
    }
  }

  if (data.status === 'loading') {
    return <CaseLoading place={config.place.name} variableLabel={variable.label} />
  }

  if (data.status === 'error' || !data.analysis || !verdict) {
    return (
      <div className="case-error container">
        <p className="eyebrow">Record unavailable</p>
        <h1 className="display-lg">The file would not open.</h1>
        <p className="lede">
          {data.error ?? 'The public data record could not be reached.'} The place is preserved in
          the URL, so a retry will reopen the same case.
        </p>
        <div className="case-error-actions">
          <button type="button" className="btn btn-primary" onClick={data.retry}>
            <RefreshCw size={15} />
            Retry the record
          </button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>
            Choose another place
          </button>
          <button type="button" className="btn btn-ghost" onClick={onOpenData}>
            Check the data sources
          </button>
        </div>
        <p className="mono case-error-note">
          <AlertTriangle size={13} /> NASA POWER can be briefly unavailable. No verdict is shown
          without a complete record.
        </p>
      </div>
    )
  }

  const analysis = data.analysis
  const stampColor =
    verdict.tone === 'up'
      ? variable.upColor
      : verdict.tone === 'down'
        ? variable.downColor
        : '#6f7f76'
  const headline =
    verdict.tone === 'flat'
      ? analysis.annual.points.length < 15
        ? 'The record is too short.'
        : 'The record stays quiet.'
      : 'The trend survives the tests.'

  return (
    <div className="case-page">
      <div className="case-masthead container">
        <div className="case-kicker mono">
          <span>CASE {number}</span>
          <span className="case-kicker-dot" />
          <span>Open public record</span>
        </div>
        <div className="case-title-row">
          <div className="case-title-block">
            <h1 className="case-place serif">{config.place.name}</h1>
            <p className="case-detail">
              {config.place.detail} · {formatCoords(config.place.lat, config.place.lon)}
            </p>
          </div>
          <div className="case-meta">
            <VariableBadge variable={variable} />
            <span className="chip">1991—2025</span>
            <span className="chip">
              {SCOPES[config.scope].label} · ±{SCOPES[config.scope].extent}°
            </span>
            <span className="chip">{variable.source}</span>
          </div>
        </div>

        <div className="case-toolbar">
          <div className="case-signal-switch">
            <span className="mono">Signal</span>
            <div className="signal-switch-rail" role="group" aria-label="Change Earth signal">
              {VARIABLES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`variable-chip is-small ${config.variable === item.id ? 'is-active' : ''}`}
                  style={{ '--chip-color': item.color } as CSSProperties}
                  aria-pressed={config.variable === item.id}
                  onClick={() => onVariable(item.id)}
                >
                  <VariableGlyph variable={item} size={12} />
                  {item.short}
                </button>
              ))}
            </div>
          </div>
          <div className="case-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyLink}>
              <Share2 size={14} />
              Copy link
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={exportCard}
              disabled={exporting}
            >
              <Download size={14} />
              {exporting ? 'Preparing' : 'Export card'}
            </button>
          </div>
        </div>
      </div>

      <section className="verdict-section container">
        <div className="verdict-sheet paper topo-ink">
          <div className="verdict-sheet-top mono">
            <span>Finding · {variable.label}</span>
            <span>Case {number}</span>
          </div>
          <div className="verdict-stamp-wrap">
            <span className="stamp stamp-animate" style={{ color: stampColor }}>
              {verdict.title}
            </span>
          </div>
          <h2 className="verdict-title display-lg">{headline}</h2>
          <p className="verdict-summary">{verdict.summary}</p>

          <div className="verdict-stats">
            <div className="verdict-stat">
              <span className="mono">Rate</span>
              <strong className="num">
                {signed(analysis.trend.slopePerDecade, variable.slopeDecimals)}
                <small>{variable.slopeUnit}</small>
              </strong>
              <span className="mono">per decade</span>
            </div>
            <div className="verdict-stat">
              <span className="mono">95% interval</span>
              <strong className="num">
                {signed(analysis.trend.ciLow, variable.slopeDecimals)} …{' '}
                {signed(analysis.trend.ciHigh, variable.slopeDecimals)}
              </strong>
              <span className="mono">{variable.slopeUnit} / decade</span>
            </div>
            <div className="verdict-stat">
              <span className="mono">Change over record</span>
              <strong className="num">
                {signed(analysis.modelledChange, variable.decimals)}
                <small>{variable.annualUnit}</small>
              </strong>
              <span className="mono">modelled from the slope</span>
            </div>
            <div className="verdict-stat">
              <span className="mono">Confidence</span>
              <strong className="num">{confidenceFromP(analysis.trend.p)}</strong>
              <span className="mono">p = {pValue(analysis.trend.p)}</span>
            </div>
          </div>

          <div className="verdict-foot mono">
            <span>
              Baseline 1991–2020 · {fmt(analysis.baseline, variable.decimals)} {variable.annualUnit}
            </span>
            <span>
              {analysis.annual.yearsAvailable} complete years · NASA POWER / {variable.source}
            </span>
          </div>
        </div>
      </section>

      <section className="case-section container">
        <SectionHead
          index="01"
          eyebrow="The record"
          title="Thirty-five years, one line."
          aside={
            <div className="chart-controls">
              <div className="seg" role="group" aria-label="Chart mode">
                <button
                  type="button"
                  className={chartMode === 'raw' ? 'is-active' : ''}
                  aria-pressed={chartMode === 'raw'}
                  onClick={() => setChartMode('raw')}
                >
                  Annual value
                </button>
                <button
                  type="button"
                  className={chartMode === 'anomaly' ? 'is-active' : ''}
                  aria-pressed={chartMode === 'anomaly'}
                  onClick={() => setChartMode('anomaly')}
                >
                  Anomaly
                </button>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={downloadCsv}>
                <FileDown size={14} />
                CSV
              </button>
            </div>
          }
        />

        <div className="chart-card ink-card">
          <div className="chart-top">
            <div className="chart-variable">
              <span className="mono">{variable.label}</span>
              <strong>{variable.annualUnit}</strong>
            </div>
            <div className="chart-endpoints">
              <span>
                <span className="mono">{analysis.first.year}</span>
                <strong>{fmt(analysis.first.value, variable.decimals)}</strong>
              </span>
              <span>
                <span className="mono">{analysis.latest.year}</span>
                <strong>{fmt(analysis.latest.value, variable.decimals)}</strong>
              </span>
              <span>
                <span className="mono">Baseline</span>
                <strong>{fmt(analysis.baseline, variable.decimals)}</strong>
              </span>
            </div>
          </div>

          <TrendChart analysis={analysis} variable={variable} mode={chartMode} />

          <div className="chart-legend">
            <span>
              <i className="legend-line" style={{ background: variable.color }} />
              Observed annual values
            </span>
            <span>
              <i className="legend-dash" style={{ borderColor: variable.color }} />
              Sen&apos;s slope
            </span>
            <span>
              <i className="legend-band" style={{ background: variable.color }} />
              95% interval
            </span>
            <span className="mono chart-hover-hint">Hover or touch for values</span>
          </div>
          <p className="chart-note">
            The dashed line is the median pairwise slope; the shaded wedge is its 95% interval.
            Anomalies are departures from the 1991–2020 mean.
          </p>
        </div>
      </section>

      <section className="case-section container">
        <SectionHead
          index="02"
          eyebrow="Where it changed"
          title="One point is not a pattern."
          aside={
            <span className="mono section-aside-note">
              {SCOPES[config.scope].label} · ±{SCOPES[config.scope].extent}° · 25 cells
            </span>
          }
        />
        <div className="mosaic-layout">
          <MosaicMap
            lat={config.place.lat}
            lon={config.place.lon}
            extent={SCOPES[config.scope].extent}
            cells={data.grid}
            variable={variable}
            placeName={config.place.name}
            complete={data.gridComplete}
            total={data.gridTotal}
            failures={data.gridFailures}
          />
          <aside className="mosaic-panel ink-card">
            <div className="mosaic-count">
              <span className="num">
                {spatial.significant}
                <small>/{data.gridComplete ? spatial.total : data.gridTotal}</small>
              </span>
              <p>cells survive false-discovery control</p>
            </div>

            <div className="mosaic-direction">
              <span>
                <i style={{ background: variable.upColor }} />
                {spatial.up} {variable.upNoun}
              </span>
              <span>
                <i style={{ background: variable.downColor }} />
                {spatial.down} {variable.downNoun}
              </span>
            </div>

            <div className="mosaic-legend">
              <div
                className="legend-gradient"
                style={{
                  background: `linear-gradient(90deg, ${variable.downColor}, #63716a, ${variable.upColor})`,
                }}
              />
              <div className="legend-labels mono">
                <span>{variable.downNoun}</span>
                <span>no signal</span>
                <span>{variable.upNoun}</span>
              </div>
            </div>

            <dl className="mosaic-facts">
              <div>
                <dt>Strongest cell</dt>
                <dd>
                  {spatial.strongest
                    ? `${signed(spatial.strongest.slopePerDecade, variable.slopeDecimals, variable.slopeUnit)} · ${formatCoords(spatial.strongest.lat, spatial.strongest.lon)}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Weakest cell</dt>
                <dd>
                  {spatial.weakest
                    ? `${signed(spatial.weakest.slopePerDecade, variable.slopeDecimals, variable.slopeUnit)} · ${formatCoords(spatial.weakest.lat, spatial.weakest.lon)}`
                    : '—'}
                </dd>
              </div>
              <div>
                <dt>Direction agreement</dt>
                <dd>{spatial.total > 0 ? `${Math.round(spatial.agreement * 100)}%` : '—'}</dd>
              </div>
            </dl>

            <p className="mosaic-note">
              {data.gridComplete
                ? data.gridFailures > 0
                  ? `${data.gridFailures} cells could not be read. The remaining cells are adjusted together at a 5% false-discovery rate.`
                  : 'All 25 cells were read and adjusted together at a 5% false-discovery rate. Muted cells did not survive the correction.'
                : `Reading the surrounding grid — ${data.grid.length} of ${data.gridTotal} cells so far. Colours are provisional until the false-discovery adjustment completes.`}
            </p>
          </aside>
        </div>
      </section>

      <section className="case-section container">
        <div className="duo-grid">
          <div className="duo-col">
            <SectionHead
              index="03"
              eyebrow="Seasonal lens"
              title="The average hides the calendar."
            />
            <SeasonPanel analysis={analysis} variable={variable} />
          </div>
          <div className="duo-col">
            <SectionHead
              index="04"
              eyebrow="Evidence board"
              title="Six ways to break the claim."
            />
            <EvidenceBoard rows={evidence} />
          </div>
        </div>
      </section>

      <section className="case-section container">
        <SectionHead
          index="05"
          eyebrow="Eight signals, one place"
          title="Change is not one number."
          aside={
            <span className="mono section-aside-note">
              {data.signalsComplete
                ? `${Object.keys(data.signals).length} records read`
                : `${Object.keys(data.signals).length}/8 reading`}
            </span>
          }
        />
        <SignalMatrix
          signals={data.signals}
          current={config.variable}
          complete={data.signalsComplete}
          failures={data.signalsFailures}
          onSelect={onVariable}
        />
      </section>

      <section className="case-section container">
        <SectionHead
          index="06"
          eyebrow="Landscape context"
          title="The ground beneath the trend."
          aside={<span className="mono section-aside-note">MODIS Terra · 250 m true color</span>}
        />
        <LandscapeCompare
          lat={config.place.lat}
          lon={config.place.lon}
          extent={SCOPES[config.scope].extent}
          placeName={config.place.name}
        />
      </section>

      <section className="case-end paper topo-ink">
        <div className="container">
          <p className="mono case-end-kicker">End of file · {number}</p>
          <h2 className="display-md">Think the record is wrong? Change the signal.</h2>
          <p className="case-end-copy">
            The same place can tell a different story through rainfall, cloud, wind, or snow. Open
            another signal, widen the area, or start a new case. The method stays the same.
          </p>
          <div className="case-end-actions">
            <button type="button" className="btn btn-ink" onClick={onBack}>
              New case
              <ArrowRight size={15} />
            </button>
            <button type="button" className="btn btn-ghost" onClick={onOpenMethod}>
              Read the method
            </button>
          </div>
          <p className="case-end-source mono">
            NASA POWER · NASA GIBS · Photon / OpenStreetMap
          </p>
        </div>
      </section>

      <CaseExport
        cardRef={cardRef}
        config={config}
        analysis={analysis}
        verdict={verdict}
        variable={variable}
        qr={qr}
        url={url}
      />

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  )
}

function CaseLoading({ place, variableLabel }: { place: string; variableLabel: string }) {
  return (
    <div className="case-loading container">
      <div className="case-loading-copy">
        <p className="eyebrow">Opening case file</p>
        <h1 className="display-lg">{place}</h1>
        <p className="lede">
          Reading {variableLabel.toLowerCase()} from the public monthly record. The verdict appears
          only after the annual series is complete.
        </p>
        <div className="loading-steps">
          <div className="loading-step is-done">
            <span />
            Locate the reanalysis cell
          </div>
          <div className="loading-step is-active">
            <span />
            Pull monthly observations
          </div>
          <div className="loading-step">
            <span />
            Aggregate 1991–2025
          </div>
          <div className="loading-step">
            <span />
            Fit the slope and run the test
          </div>
        </div>
      </div>
      <div className="case-loading-orb" aria-hidden="true">
        <CrosshairMark size={150} />
        <span className="loading-scan" />
      </div>
    </div>
  )
}
