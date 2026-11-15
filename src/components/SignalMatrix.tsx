import type { CSSProperties } from 'react'
import { VARIABLES } from '../data/variables'
import { RECORD_START_YEAR } from '../lib/power'
import { pValue, signed } from '../lib/format'
import type { SignalSummary, VariableId } from '../types'
import { Sparkline, SignalChip } from './ui'
import { VariableGlyph } from './Icons'

export function SignalMatrix({
  signals,
  current,
  complete,
  failures,
  onSelect,
}: {
  signals: Partial<Record<VariableId, SignalSummary>>
  current: VariableId
  complete: boolean
  failures: number
  onSelect: (variable: VariableId) => void
}) {
  return (
    <div className="signal-matrix-wrap">
      <div className="signal-matrix">
        {VARIABLES.map((variable) => {
          const signal = signals[variable.id]
          if (!signal) {
            return (
              <div className="signal-card is-loading" key={variable.id}>
                <span className="signal-loading-head mono">{variable.short}</span>
                <span className="signal-loading-line" />
                <span className="signal-loading-line short" />
                <span className="signal-loading-note mono">
                  {complete ? (failures > 0 ? 'Record unavailable' : 'No record') : 'Reading record'}
                </span>
              </div>
            )
          }
          return (
            <button
              key={variable.id}
              type="button"
              className={`signal-card ${current === variable.id ? 'is-current' : ''}`}
              style={{ '--signal-color': variable.color } as CSSProperties}
              aria-pressed={current === variable.id}
              onClick={() => onSelect(variable.id)}
            >
              <span className="signal-card-top">
                <span className="signal-name">
                  <VariableGlyph variable={variable} size={14} />
                  {variable.short}
                </span>
                <SignalChip significant={signal.survivesFdr} direction={signal.trend.direction} compact />
              </span>
              <span className="signal-card-value">
                <strong className="num">
                  {signed(signal.trend.slopePerDecade, variable.slopeDecimals)}
                </strong>
                <span className="mono">
                  {variable.slopeUnit} / decade
                </span>
              </span>
              <Sparkline points={signal.points} color={variable.color} width={220} height={48} />
              <span className="signal-card-foot">
                <span className="mono">p {pValue(signal.trend.pAdjusted)}</span>
                <span className="mono">q {pValue(signal.q)}</span>
                <span className="mono">
                  {signal.trend.n} yrs
                  {variable.recordStart > RECORD_START_YEAR ? ` · ${variable.recordStart}+` : ''}
                </span>
              </span>
              {current === variable.id && <span className="signal-current-flag mono">Open</span>}
            </button>
          )
        })}
      </div>
      <p className="panel-note mono">
        {complete
          ? 'Eight signals at one point are eight tests, so the p values are adjusted together at a 5% false-discovery rate (q). Solar and cloud are tested from 2001, where the CERES product begins. Select a signal to reopen the case.'
          : 'Eight signals at the same point. Select one to reopen the case with that variable. The false-discovery adjustment completes once every record is read.'}
      </p>
    </div>
  )
}
