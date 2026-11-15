import { useMemo, useState } from 'react'
import type { CSSProperties, PointerEvent } from 'react'
import type { PointAnalysis, SeriesPoint, VariableDef } from '../types'
import { fmt, signed } from '../lib/format'
import { useElementWidth } from '../lib/useElementWidth'

export type ChartMode = 'raw' | 'anomaly'

interface TrendChartProps {
  analysis: PointAnalysis
  variable: VariableDef
  mode: ChartMode
}

function niceStep(span: number, count: number): number {
  const rough = span / Math.max(1, count)
  const exponent = Math.floor(Math.log10(rough || 1))
  const fraction = rough / Math.pow(10, exponent)
  const nice =
    fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10
  return nice * Math.pow(10, exponent)
}

function ticksFor(min: number, max: number, count: number): number[] {
  const step = niceStep(max - min, count)
  const first = Math.ceil(min / step) * step
  const ticks: number[] = []
  for (let value = first; value <= max + step * 0.001; value += step) {
    ticks.push(Number(value.toFixed(10)))
  }
  return ticks
}

interface HoverState {
  index: number
  x: number
  y: number
}

export function TrendChart({ analysis, variable, mode }: TrendChartProps) {
  const [wrapper, width] = useElementWidth<HTMLDivElement>()
  const [hover, setHover] = useState<HoverState | null>(null)
  const height = width > 0 && width < 560 ? 286 : 366
  const chartWidth = width || 820

  const data: SeriesPoint[] = mode === 'anomaly' ? analysis.anomaly : analysis.annual.points
  const margin = {
    top: 26,
    right: width < 560 ? 46 : 74,
    bottom: 34,
    left: width < 560 ? 42 : 58,
  }
  const innerWidth = chartWidth - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  const startYear = data[0]?.year ?? 1991
  const endYear = data[data.length - 1]?.year ?? 2025
  const spanX = Math.max(1, endYear - startYear)

  const { min, max, ticks } = useMemo(() => {
    const values = data.map((point) => point.value)
    let low = Math.min(...values)
    let high = Math.max(...values)
    if (mode === 'anomaly') {
      const extent = Math.max(Math.abs(low), Math.abs(high), 0.001) * 1.18
      low = -extent
      high = extent
      return { min: low, max: high, ticks: ticksFor(low, high, 4) }
    }
    const pad = (high - low || Math.abs(high) * 0.1 || 1) * 0.14
    low -= pad
    high += pad
    return { min: low, max: high, ticks: ticksFor(low, high, 4) }
  }, [data, mode])

  const x = (year: number) => margin.left + ((year - startYear) / spanX) * innerWidth
  const y = (value: number) => margin.top + ((max - value) / (max - min || 1)) * innerHeight

  const linePath = data
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.year).toFixed(2)},${y(point.value).toFixed(2)}`)
    .join(' ')

  const areaPath = `${linePath} L${x(endYear).toFixed(2)},${margin.top + innerHeight} L${x(startYear).toFixed(2)},${margin.top + innerHeight} Z`

  const baselineShift = mode === 'anomaly' ? analysis.baseline : 0
  const halfWidthPerYear = (analysis.trend.ciHigh - analysis.trend.ciLow) / 20
  const lowSlope = analysis.trend.slopePerYear - halfWidthPerYear
  const highSlope = analysis.trend.slopePerYear + halfWidthPerYear
  const trendStartValue =
    analysis.trend.intercept + analysis.trend.slopePerYear * startYear - baselineShift
  const trendEndValue =
    analysis.trend.intercept + analysis.trend.slopePerYear * endYear - baselineShift
  const ciLowStart = analysis.trend.intercept + lowSlope * startYear - baselineShift
  const ciLowEnd = analysis.trend.intercept + lowSlope * endYear - baselineShift
  const ciHighStart = analysis.trend.intercept + highSlope * startYear - baselineShift
  const ciHighEnd = analysis.trend.intercept + highSlope * endYear - baselineShift

  const bandPoints = `${x(startYear).toFixed(2)},${y(ciLowStart).toFixed(2)} ${x(endYear).toFixed(2)},${y(ciLowEnd).toFixed(2)} ${x(endYear).toFixed(2)},${y(
    ciHighEnd,
  ).toFixed(2)} ${x(startYear).toFixed(2)},${y(ciHighStart).toFixed(2)}`

  const xTicks = useMemo(() => {
    const candidates = [startYear, 2000, 2010, 2020, endYear]
    return Array.from(new Set(candidates.filter((year) => year >= startYear && year <= endYear)))
  }, [startYear, endYear])

  const last = data[data.length - 1]
  const lastX = last ? x(last.year) : 0
  const lastY = last ? y(last.value) : 0

  function handleMove(event: PointerEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    if (!rect.width) return
    const px = ((event.clientX - rect.left) / rect.width) * chartWidth
    let nearest = 0
    let distance = Number.POSITIVE_INFINITY
    for (let index = 0; index < data.length; index += 1) {
      const dx = Math.abs(x(data[index].year) - px)
      if (dx < distance) {
        distance = dx
        nearest = index
      }
    }
    const point = data[nearest]
    setHover({ index: nearest, x: x(point.year), y: y(point.value) })
  }

  const hovered = hover ? data[hover.index] : null
  const hoverAnomaly = hovered ? hovered.value - (mode === 'anomaly' ? 0 : analysis.baseline) : 0
  const tooltipLeft = hover ? Math.min(86, Math.max(14, (hover.x / chartWidth) * 100)) : 50
  const tooltipTop = hover ? (hover.y / height) * 100 : 0

  return (
    <div className="chart-wrap" ref={wrapper}>
      {width > 0 && (
        <svg
          className="trend-chart"
          viewBox={`0 0 ${chartWidth} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={`Annual ${variable.label} record for ${startYear} to ${endYear} with Sen's slope`}
          onPointerMove={handleMove}
          onPointerLeave={() => setHover(null)}
          onPointerCancel={() => setHover(null)}
        >
          <title>{`${variable.label}: annual record ${startYear}–${endYear}`}</title>

          {ticks.map((tick) => (
            <g key={`y-${tick}`}>
              <line
                x1={margin.left}
                x2={margin.left + innerWidth}
                y1={y(tick)}
                y2={y(tick)}
                stroke="rgba(241,232,215,0.09)"
                strokeWidth="1"
              />
              <text
                x={margin.left - 10}
                y={y(tick) + 4}
                textAnchor="end"
                className="chart-axis-label"
              >
                {mode === 'anomaly' ? signed(tick, variable.decimals) : fmt(tick, variable.decimals)}
              </text>
            </g>
          ))}

          {xTicks.map((year) => (
            <g key={`x-${year}`}>
              <line
                x1={x(year)}
                x2={x(year)}
                y1={margin.top}
                y2={margin.top + innerHeight}
                stroke="rgba(241,232,215,0.055)"
              />
              <text
                x={x(year)}
                y={height - 12}
                textAnchor="middle"
                className="chart-axis-label"
              >
                {year}
              </text>
            </g>
          ))}

          {mode === 'anomaly' && (
            <line
              x1={margin.left}
              x2={margin.left + innerWidth}
              y1={y(0)}
              y2={y(0)}
              stroke="rgba(241,232,215,0.34)"
              strokeDasharray="3 5"
            />
          )}

          <polygon points={bandPoints} fill={variable.color} opacity="0.1" />

          <path d={areaPath} fill={variable.color} opacity="0.07" className="chart-area" />

          <line
            x1={x(startYear)}
            x2={x(endYear)}
            y1={y(trendStartValue)}
            y2={y(trendEndValue)}
            stroke={variable.color}
            strokeWidth="1.2"
            strokeDasharray="6 5"
            opacity="0.8"
          />

          <path
            d={linePath}
            fill="none"
            stroke={variable.color}
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            className="chart-observed"
            style={{ '--dash': 2600, strokeDasharray: 2600 } as CSSProperties}
          />

          {data.map((point) => (
            <circle
              key={point.year}
              cx={x(point.year)}
              cy={y(point.value)}
              r={width < 560 ? 1.8 : 2.3}
              fill={variable.color}
              opacity="0.9"
            />
          ))}

          <circle cx={lastX} cy={lastY} r="6" fill={variable.color} opacity="0.18" />
          <circle cx={lastX} cy={lastY} r="3.2" fill={variable.color} />

          {last && (
            <text
              x={lastX + 8}
              y={lastY - 9}
              className="chart-last-label"
              fill={variable.color}
              textAnchor={lastX > chartWidth - 100 ? 'end' : 'start'}
              dx={lastX > chartWidth - 100 ? -8 : 0}
            >
              {mode === 'anomaly' ? signed(last.value, variable.decimals) : fmt(last.value, variable.decimals)}
            </text>
          )}

          {mode === 'anomaly' && (
            <text
              x={margin.left + 8}
              y={y(0) - 7}
              className="chart-zero-label"
            >
              {analysis.baselineStart}–{analysis.baselineEnd} average
            </text>
          )}

          <text x={margin.left} y={16} className="chart-unit-label">
            {mode === 'anomaly' ? `${variable.unit} departure` : variable.annualUnit}
          </text>

          {hover && hovered && (
            <g>
              <line
                x1={hover.x}
                x2={hover.x}
                y1={margin.top}
                y2={margin.top + innerHeight}
                stroke="rgba(241,232,215,0.4)"
                strokeDasharray="2 4"
              />
              <circle cx={hover.x} cy={hover.y} r="4.6" fill="var(--ink)" stroke={variable.color} strokeWidth="2" />
            </g>
          )}
        </svg>
      )}

      {hover && hovered && (
        <div
          className="chart-tooltip"
          style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}
          aria-hidden="true"
        >
          <span className="chart-tooltip-year mono">{hovered.year}</span>
          <strong>
            {mode === 'anomaly' ? signed(hovered.value, variable.decimals) : fmt(hovered.value, variable.decimals)}{' '}
            <span>{variable.annualUnit}</span>
          </strong>
          <span className="mono">
            {mode === 'raw'
              ? `${signed(hoverAnomaly, variable.decimals)} ${variable.unit} vs baseline`
              : `${hovered.months} months used`}
          </span>
        </div>
      )}
    </div>
  )
}
