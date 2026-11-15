import { evidenceScore, type EvidenceRow } from '../lib/evidence'
import { StatusChip } from './ui'

export function EvidenceBoard({ rows }: { rows: EvidenceRow[] }) {
  const points = evidenceScore(rows)
  const partials = rows.filter((row) => row.status === 'partial').length
  const cleared = rows.filter((row) => row.status === 'pass').length

  return (
    <div className="evidence-board">
      <div className="evidence-score">
        <div>
          <span className="evidence-score-value num">
            {points % 1 === 0 ? points : points.toFixed(1)}
            <span>/{rows.length}</span>
          </span>
          <p>checks support the finding</p>
        </div>
        <div className="evidence-meter" aria-hidden="true">
          <span style={{ width: `${(points / rows.length) * 100}%` }} />
        </div>
        <span className="mono evidence-score-note">
          {cleared} confirmed{partials > 0 ? ` · ${partials} partial` : ''}
        </span>
      </div>

      <div className="evidence-rows">
        {rows.map((row) => (
          <div className={`evidence-row status-${row.status}`} key={row.id}>
            <div className="evidence-row-head">
              <span className="evidence-label">{row.label}</span>
              <StatusChip status={row.status} />
            </div>
            <span className="evidence-value">{row.value}</span>
            <p>{row.detail}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
