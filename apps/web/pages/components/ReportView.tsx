import type { Severity } from '@openclaw-security/scanner-core';
import type { FindingRecord, ReportData } from '../lib/api';
import { FindingCard } from './FindingCard';
import { ScoreGauge } from './ScoreGauge';

interface Props {
  report: ReportData;
  onReset: () => void;
}

export function ReportView({ report, onReset }: Props) {
  const findings = report.findings ?? [];
  const severityCounts = report.severity_counts ?? {};
  const score = report.score ?? 100;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Security Report</h2>
        <button
          type="button"
          onClick={onReset}
          style={{
            padding: '0.5rem 1rem',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            color: 'var(--text)',
            cursor: 'pointer',
            fontSize: '0.85rem',
          }}
        >
          New Scan
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '200px 1fr',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}
      >
        <ScoreGauge score={score} />

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.25rem',
          }}
        >
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>Target:</strong>{' '}
            <span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>{report.target_url}</span>
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>Mode:</strong> {report.mode}
          </p>
          {report.platform_info?.version && (
            <p style={{ marginBottom: '0.75rem' }}>
              <strong>Version:</strong> {report.platform_info.version}
            </p>
          )}

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {(Object.entries(severityCounts) as [Severity, number][])
              .filter(([, count]) => count > 0)
              .map(([severity, count]) => (
                <span
                  key={severity}
                  style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    background: `var(--${severity})`,
                    color: '#fff',
                    opacity: 0.9,
                  }}
                >
                  {count} {severity}
                </span>
              ))}
          </div>
        </div>
      </div>

      <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Findings ({findings.length})</h3>

      {findings.length === 0 ? (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--success)',
            borderRadius: 'var(--radius)',
            padding: '2rem',
            textAlign: 'center',
            color: 'var(--success)',
          }}
        >
          All checks passed — no issues found.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {findings.map((f: FindingRecord) => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}
