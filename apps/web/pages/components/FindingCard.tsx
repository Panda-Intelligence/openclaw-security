import React, { useState } from 'react';

interface Props {
  finding: {
    title: string;
    severity: string;
    description: string;
    evidence: string;
    recommendation: string;
    cwe_id?: string;
    check_id: string;
  };
}

export function FindingCard({ finding }: Props) {
  const [expanded, setExpanded] = useState(false);

  const severityColor = `var(--${finding.severity})`;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid var(--border)`,
        borderLeft: `3px solid ${severityColor}`,
        borderRadius: 'var(--radius)',
        padding: '1rem 1.25rem',
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <span style={{
          padding: '0.15rem 0.5rem',
          borderRadius: '4px',
          fontSize: '0.7rem',
          fontWeight: 600,
          textTransform: 'uppercase',
          background: severityColor,
          color: '#fff',
        }}>
          {finding.severity}
        </span>
        <span style={{ fontWeight: 500, fontSize: '0.95rem', flex: 1 }}>
          {finding.title}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          {expanded ? '−' : '+'}
        </span>
      </div>

      {expanded && (
        <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <p style={{ marginBottom: '0.5rem' }}>{finding.description}</p>

          {finding.evidence && (
            <div style={{
              marginBottom: '0.5rem',
              padding: '0.5rem',
              background: 'var(--bg)',
              borderRadius: '4px',
              fontFamily: 'var(--mono)',
              fontSize: '0.8rem',
              overflow: 'auto',
              maxHeight: '100px',
            }}>
              {finding.evidence}
            </div>
          )}

          <p style={{ color: 'var(--accent)', marginBottom: '0.25rem' }}>
            {finding.recommendation}
          </p>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', fontSize: '0.75rem' }}>
            <span>{finding.check_id}</span>
            {finding.cwe_id && <span>{finding.cwe_id}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
