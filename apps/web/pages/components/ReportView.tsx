import type { Severity } from '@panda-ai/ocs-core';
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
  const visibleSeverities = (Object.entries(severityCounts) as [Severity, number][])
    .filter(([, count]) => count > 0);

  return (
    <div className="page-medium">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          marginBottom: '2rem',
          flexWrap: 'wrap',
        }}
      >
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 style={{ fontSize: '2.4rem' }}>Security Report</h1>
          <p>Severity, evidence, and recommendations for {report.target_url}</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="button-secondary"
        >
          New Scan
        </button>
      </div>

      <div className="report-grid" style={{ marginBottom: '2rem' }}>
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
            {visibleSeverities.map(([severity, count]) => (
              <span
                key={severity}
                className="severity-pill"
                style={{
                  background: `var(--${severity})`,
                  fontSize: '0.8rem',
                  padding: '0.38rem 0.74rem',
                }}
              >
                {count} {severity}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-summary fade-up" style={{ marginBottom: '1.5rem' }}>
        <div className="dashboard-summary-card">
          <strong>{findings.length}</strong>
          <span>Total findings</span>
        </div>
        <div className="dashboard-summary-card">
          <strong>{report.mode}</strong>
          <span>Scan mode</span>
        </div>
        <div className="dashboard-summary-card">
          <strong>{visibleSeverities[0]?.[0] ?? 'clean'}</strong>
          <span>Highest visible severity</span>
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
        <div className="findings-list">
          {findings.map((f: FindingRecord) => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}
