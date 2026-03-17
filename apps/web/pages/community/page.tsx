import { useEffect, useState } from 'react';
import { TrendChart } from '../components/TrendChart';

interface Stats {
  totalReports: number;
  averageScore: number;
  scoreDistribution: { range: string; count: number }[];
  severityBreakdown: Record<string, number>;
  topIssues: { checkId: string; count: number }[];
  trend: { date: string; avgScore: number; count: number }[];
}

export default function CommunityPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/community/stats')
      .then((r) => r.json() as Promise<{ data: Stats }>)
      .then((d) => setStats(d.data));
  }, []);

  if (!stats) return <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Loading...</p>;

  const maxDist = Math.max(...stats.scoreDistribution.map((d) => d.count), 1);

  return (
    <div className="page-medium">
      <div className="page-header">
        <h1 style={{ fontSize: '2.8rem' }}>Community Security Stats</h1>
        <p>Anonymized data from {stats.totalReports} community-submitted scans</p>
      </div>

      <div className="community-stats-grid fade-up">
        <StatCard label="Total Reports" value={String(stats.totalReports)} />
        <StatCard label="Average Score" value={`${stats.averageScore}/100`} />
        <StatCard label="Top Issue" value={stats.topIssues[0]?.checkId ?? 'N/A'} />
      </div>

      <div className="community-sections">
        <div className="community-column">
          <section className="dashboard-card fade-up">
            <h2 className="dashboard-card-title">Score Trend (30 days)</h2>
            <p className="dashboard-card-copy">A rolling view of the community score baseline.</p>
            <TrendChart data={stats.trend} />
          </section>

          <section className="dashboard-card fade-up">
            <h2 className="dashboard-card-title">Score Distribution</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1rem' }}>
              {stats.scoreDistribution.map((d) => (
                <div key={d.range} className="distribution-row">
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{d.range}</span>
                  <div className="distribution-bar">
                    <div className="distribution-bar-fill" style={{ width: `${(d.count / maxDist) * 100}%` }} />
                  </div>
                  <span style={{ textAlign: 'right', fontSize: '0.85rem' }}>{d.count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="community-column">
          <section className="dashboard-card fade-up">
            <h2 className="dashboard-card-title">Most Common Issues</h2>
            <div className="dashboard-list" style={{ marginTop: '1rem' }}>
              {stats.topIssues.map((issue, index) => (
                <div key={issue.checkId} className="dashboard-item">
                  <div className="dashboard-item-meta">
                    <strong>#{index + 1} {issue.checkId}</strong>
                    <span>Observed across community submissions</span>
                  </div>
                  <div className="dashboard-item-actions">
                    <span className="status-pill">{issue.count} reports</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="dashboard-card fade-up">
            <h2 className="dashboard-card-title">Severity Breakdown</h2>
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginTop: '1rem' }}>
              {Object.entries(stats.severityBreakdown)
                .filter(([, n]) => n > 0)
                .map(([sev, count]) => (
                  <span
                    key={sev}
                    className="severity-pill"
                    style={{ background: `var(--${sev})`, fontSize: '0.78rem', padding: '0.38rem 0.74rem' }}
                  >
                    {count} {sev}
                  </span>
                ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="dashboard-summary-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}
