import type { RefObject } from 'react'
import type { CaseConfig, PointAnalysis, SeriesPoint, VariableDef, Verdict } from '../types'
import { caseNumber, fmt, formatCoords, signed } from '../lib/format'
import { RECORD_END_YEAR } from '../lib/power'
import { LogoMark } from './Icons'

function ExportChart({
  points,
  color,
  start,
  end,
}: {
  points: SeriesPoint[]
  color: string
  start: number
  end: number
}) {
  const width = 880
  const height = 250
  const pad = 14
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (year: number) => pad + ((year - start) / Math.max(1, end - start)) * (width - pad * 2)
  const y = (value: number) => height - pad - ((value - min) / span) * (height - pad * 2)
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.year).toFixed(1)},${y(point.value).toFixed(1)}`)
    .join(' ')
  const area = `${line} L${x(end).toFixed(1)},${height - pad} L${x(start).toFixed(1)},${height - pad} Z`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="export-chart-svg" aria-hidden="true">
      {[0.25, 0.5, 0.75].map((fraction) => (
        <line
          key={fraction}
          x1={pad}
          x2={width - pad}
          y1={pad + fraction * (height - pad * 2)}
          y2={pad + fraction * (height - pad * 2)}
          stroke="rgba(241,232,215,0.12)"
        />
      ))}
      <path d={area} fill={color} opacity="0.12" />
      <path d={line} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" />
      <circle cx={x(points[points.length - 1].year)} cy={y(points[points.length - 1].value)} r="5" fill={color} />
    </svg>
  )
}

export function CaseExport({
  cardRef,
  config,
  analysis,
  verdict,
  variable,
  qr,
  url,
}: {
  cardRef: RefObject<HTMLDivElement | null>
  config: CaseConfig
  analysis: PointAnalysis
  verdict: Verdict
  variable: VariableDef
  qr: string
  url: string
}) {
  const number = caseNumber(`${config.place.name}:${config.variable}`)
  const shortUrl = url.replace(/^https?:\/\//, '').slice(0, 58)

  return (
    <div className="export-stage" aria-hidden="true">
      <div className="export-card" ref={cardRef}>
        <div className="export-top">
          <span className="export-brand">
            <LogoMark size={32} />
            <span>OPEN CASE: EARTH</span>
          </span>
          <span className="export-case mono">CASE {number}</span>
        </div>

        <div className="export-title-block">
          <span className="export-kicker mono">CASE FILE · {variable.label}</span>
          <h1 className="export-place">{config.place.name}</h1>
          <p className="export-detail">
            {config.place.detail} · {formatCoords(config.place.lat, config.place.lon)}
          </p>
        </div>

        <div className="export-middle">
          <div className="export-verdict-wrap">
            <span className="export-stamp">{verdict.title}</span>
            <span className={`grade-chip grade-${verdict.strength}`}>
              {verdict.strengthLabel}
            </span>
            <span className="export-confidence mono">{verdict.confidenceLine}</span>
          </div>
          <div className="export-rate">
            <span className="mono">SEN&apos;S SLOPE</span>
            <strong>
              {signed(analysis.trend.slopePerDecade, variable.slopeDecimals)}
              <small>
                {variable.slopeUnit} / decade
              </small>
            </strong>
          </div>
        </div>

        <div className="export-chart">
          <span className="mono">ANNUAL RECORD · {analysis.first.year}—{analysis.latest.year}</span>
          <ExportChart
            points={analysis.annual.points}
            color={variable.color}
            start={analysis.first.year}
            end={analysis.latest.year}
          />
        </div>

        <div className="export-stats">
          <div>
            <span className="mono">95% INTERVAL</span>
            <strong>
              {signed(analysis.trend.ciLow, variable.slopeDecimals)} to{' '}
              {signed(analysis.trend.ciHigh, variable.slopeDecimals)}
            </strong>
            <span className="mono">{variable.slopeUnit} / decade</span>
          </div>
          <div>
            <span className="mono">CHANGE OVER RECORD</span>
            <strong>{signed(analysis.modelledChange, variable.decimals, variable.annualUnit)}</strong>
            <span className="mono">modelled from Sen&apos;s slope</span>
          </div>
          <div>
            <span className="mono">BASELINE</span>
            <strong>
              {fmt(analysis.baseline, variable.decimals, )} {variable.annualUnit}
            </strong>
            <span className="mono">{analysis.baselineStart}–{analysis.baselineEnd} mean</span>
          </div>
        </div>

        <p className="export-summary">{verdict.summary}</p>

        <div className="export-bottom">
          <div className="export-source">
            <span className="mono">RECORD</span>
            <strong>{variable.recordStart}—{RECORD_END_YEAR}</strong>
            <span className="mono">NASA POWER / {variable.source} · analysis in browser</span>
          </div>
          <div className="export-qr-wrap">
            {qr && <img src={qr} alt="" className="export-qr" />}
            <span className="mono">SCAN TO OPEN</span>
            <span className="export-url mono">{shortUrl}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
