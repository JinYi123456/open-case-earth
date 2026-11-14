import type { ReactNode } from 'react'
import type { EvidenceStatus } from '../lib/evidence'
import type { SeriesPoint, VariableDef } from '../types'
import { VariableGlyph } from './Icons'

export function Sparkline({
  points,
  color,
  width = 150,
  height = 42,
  filled = true,
  strokeWidth = 1.4,
}: {
  points: SeriesPoint[]
  color: string
  width?: number
  height?: number
  filled?: boolean
  strokeWidth?: number
}) {
  if (points.length < 2) {
    return <div className="sparkline-empty" style={{ width, height }} />
  }
  const pad = 3
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const x = (index: number) => pad + (index / (points.length - 1)) * (width - pad * 2)
  const y = (value: number) => height - pad - ((value - min) / span) * (height - pad * 2)
  const line = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(2)},${y(point.value).toFixed(2)}`)
    .join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(2)},${height - pad} L${x(0).toFixed(2)},${height - pad} Z`
  const lastX = x(points.length - 1)
  const lastY = y(points[points.length - 1].value)

  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Annual series sparkline"
    >
      {filled && <path d={area} fill={color} opacity="0.12" />}
      <path d={line} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="2.1" fill={color} />
    </svg>
  )
}

export function SignalChip({
  significant,
  direction,
  compact = false,
}: {
  significant: boolean
  direction: 'up' | 'down' | 'flat'
  compact?: boolean
}) {
  if (!significant) {
    return <span className={`signal-chip signal-chip-quiet ${compact ? 'is-compact' : ''}`}>Noise range</span>
  }
  return (
    <span className={`signal-chip ${direction === 'down' ? 'is-down' : 'is-up'} ${compact ? 'is-compact' : ''}`}>
      <span className="signal-dot" />
      Signal
    </span>
  )
}

const STATUS_LABEL: Record<EvidenceStatus, string> = {
  pass: 'Confirmed',
  partial: 'Partial',
  fail: 'Against',
  pending: 'Pending',
}

export function StatusChip({ status }: { status: EvidenceStatus }) {
  return (
    <span className={`evidence-status status-${status}`}>
      <span className="evidence-status-dot" />
      {STATUS_LABEL[status]}
    </span>
  )
}

export function VariableBadge({ variable, compact = false }: { variable: VariableDef; compact?: boolean }) {
  return (
    <span className={`variable-badge ${compact ? 'is-compact' : ''}`} style={{ color: variable.color }}>
      <VariableGlyph variable={variable} size={compact ? 12 : 14} />
      {variable.short}
    </span>
  )
}

export function SectionHead({
  index,
  eyebrow,
  title,
  aside,
}: {
  index: string
  eyebrow: string
  title: ReactNode
  aside?: ReactNode
}) {
  return (
    <header className="section-head">
      <div className="section-head-main">
        <span className="section-index mono">{index}</span>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="display-md">{title}</h2>
        </div>
      </div>
      {aside && <div className="section-head-aside">{aside}</div>}
    </header>
  )
}

export function Loader({ label }: { label: string }) {
  return (
    <span className="loader-inline">
      <span className="loader-ring" />
      <span className="mono">{label}</span>
    </span>
  )
}
