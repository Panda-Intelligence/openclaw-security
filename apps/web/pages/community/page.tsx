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
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>Community Security Stats</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
        Anonymized data from {stats.totalReports} community-submitted scans
      </p>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Total Reports" value={String(stats.totalReports)} />
        <StatCard label="Average Score" value={`${stats.averageScore}/100`} />
        <StatCard label="Top Issue" value={stats.topIssues[0]?.checkId ?? 'N/A'} />
      </div>

      {/* Score trend */}
      <section style={cardStyle}>
        <h2 style={sectionTitle}>Score Trend (30 days)</h2>
        <TrendChart data={stats.trend} />
      </section>

      {/* Score distribution */}
      <section style={{ ...cardStyle, marginTop: '1.5rem' }}>
        <h2 style={sectionTitle}>Score Distribution</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {stats.scoreDistribution.map((d) => (
            <div key={d.range} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ width: 60, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{d.range}</span>
              <div style={{ flex: 1, height: 20, background: 'var(--bg)', borderRadius: 4, overflow: 'hidden' }}>
                <div
                  style={{
                    width: `${(d.count / maxDist) * 100}%`,
                    height: '100%',
                    background: 'var(--accent)',
                    borderRadius: 4,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <span style={{ width: 40, textAlign: 'right', fontSize: '0.85rem' }}>{d.count}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Top issues */}
      <section style={{ ...cardStyle, marginTop: '1.5rem' }}>
        <h2 style={sectionTitle}>Most Common Issues</h2>
        {stats.topIssues.map((issue, i) => (
          <div key={issue.checkId} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
            <span>
              <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>#{i + 1}</span>
              {issue.checkId}
            </span>
            <span style={{ color: 'var(--text-muted)' }}>{issue.count}</span>
          </div>
        ))}
      </section>

      {/* Severity breakdown */}
      <section style={{ ...cardStyle, marginTop: '1.5rem' }}>
        <h2 style={sectionTitle}>Severity Breakdown</h2>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          {Object.entries(stats.severityBreakdown)
            .filter(([, n]) => n > 0)
            .map(([sev, count]) => (
              <span key={sev} style={{ padding: '0.25rem 0.75rem', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600, background: `var(--${sev})`, color: '#fff' }}>
                {count} {sev}
              </span>
            ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={cardStyle}>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>{label}</p>
      <p style={{ fontSize: '1.5rem', fontWeight: 700 }}>{value}</p>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '1.25rem',
};

const sectionTitle: React.CSSProperties = { fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' };
