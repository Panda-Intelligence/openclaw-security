
import { useState } from 'react';
import type { FindingRecord } from '../lib/api';

interface Props {
  finding: FindingRecord;
}

export function FindingCard({ finding }: Props) {
  const [expanded, setExpanded] = useState(false);

  const severityColor = `var(--${finding.severity})`;

  return (
    <div className="finding-card fade-up" style={{ borderLeftColor: severityColor }} onClick={() => setExpanded(!expanded)}>
      <div className="finding-header">
        <span
          className="severity-pill"
          style={{ background: severityColor }}
        >
          {finding.severity}
        </span>
        <span className="finding-title">{finding.title}</span>
        <span className="finding-toggle">{expanded ? '−' : '+'}</span>
      </div>

      {expanded && (
        <div className="finding-body">
          <p style={{ marginBottom: '0.5rem' }}>{finding.description}</p>

          {finding.evidence && <div className="finding-evidence">{finding.evidence}</div>}

          <p style={{ color: 'var(--accent)', marginBottom: '0.25rem' }}>{finding.recommendation}</p>

          <div className="finding-footer">
            <span className="finding-tag">{finding.check_id}</span>
            {finding.cwe_id && <span className="finding-tag">{finding.cwe_id}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
