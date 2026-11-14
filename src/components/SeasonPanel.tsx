import type { PointAnalysis, VariableDef } from '../types'
import { pValue, signed } from '../lib/format'
import { Sparkline, SignalChip } from './ui'

export function SeasonPanel({
  analysis,
  variable,
}: {
  analysis: PointAnalysis
  variable: VariableDef
}) {
  const strongest = analysis.seasonal.reduce((a, b) =>
    Math.abs(b.slopePerDecade) > Math.abs(a.slopePerDecade) ? b : a,
  )

  return (
    <div className="season-panel">
      <div className="season-grid">
        {analysis.seasonal.map((season) => (
          <article
            key={season.season}
            className={`season-card ${season.season === strongest.season ? 'is-strongest' : ''}`}
          >
            <div className="season-top">
              <span className="season-id serif">{season.season}</span>
              <span className="mono">{season.label}</span>
            </div>
            <div className="season-value num">
              {signed(season.slopePerDecade, variable.slopeDecimals)}
              <span>{variable.slopeUnit}</span>
            </div>
            <span className="season-unit mono">per decade</span>
            <Sparkline points={season.points} color={variable.color} width={220} height={52} />
            <div className="season-foot">
              <SignalChip significant={season.significant} direction={season.direction} compact />
              <span className="mono">p {pValue(season.p)}</span>
            </div>
          </article>
        ))}
      </div>
      <p className="panel-note mono">
        Dec–Feb pairs December of the previous year with January and February. Strongest seasonal
        rate is outlined.
      </p>
    </div>
  )
}
