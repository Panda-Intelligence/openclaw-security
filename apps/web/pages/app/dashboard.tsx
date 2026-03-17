import { useEffect, useMemo, useState } from 'react';
import { createProject, deleteProject, getMe, getProjects, getScans, logout } from '../lib/api';
import type { ProjectRecord, ScanRecord } from '../lib/api';

export default function DashboardPage() {
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [plan, setPlan] = useState<string>('free');
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [recentScans, setRecentScans] = useState<ScanRecord[]>([]);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    getMe().then((r) => {
      setUser(r.data.user);
      setPlan(r.data.subscription?.plan ?? 'free');
    });
    getProjects().then((r) => setProjects(r.data));
    getScans().then((r) => setRecentScans(r.data.slice(0, 10)));
  }, []);

  const averageScore = useMemo(() => {
    const scores = recentScans.flatMap((scan) => (scan.score === null ? [] : [scan.score]));
    if (scores.length === 0) return '—';
    return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length).toString();
  }, [recentScans]);

  const activeCount = useMemo(
    () => recentScans.filter((scan) => scan.status === 'running' || scan.status === 'pending').length,
    [recentScans],
  );

  const handleCreateProject = async () => {
    if (!newName || !newUrl) return;
    setError('');
    try {
      await createProject(newName, newUrl);
      setNewName('');
      setNewUrl('');
      const r = await getProjects();
      setProjects(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handleDelete = async (id: string) => {
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <div className="page-medium dashboard-layout">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 style={{ fontSize: '2.8rem' }}>Dashboard</h1>
          <p>
            {user?.email} — <span style={{ color: 'var(--accent)', textTransform: 'capitalize' }}>{plan}</span> plan
          </p>
        </div>
        <button type="button" onClick={logout} className="button-secondary">
          Sign out
        </button>
      </div>

      <section className="dashboard-summary fade-up">
        <div className="dashboard-summary-card">
          <strong>{projects.length}</strong>
          <span>Tracked projects</span>
        </div>
        <div className="dashboard-summary-card">
          <strong>{recentScans.length}</strong>
          <span>Recent scans</span>
        </div>
        <div className="dashboard-summary-card">
          <strong>{averageScore}</strong>
          <span>Average score</span>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="dashboard-card fade-up">
          <div className="dashboard-card-header">
            <div>
              <h2 className="dashboard-card-title">Projects</h2>
              <p className="dashboard-card-copy">Create scan targets and keep URLs organized by deployment.</p>
            </div>
            <span className="status-pill">{projects.length} total</span>
          </div>

          <div className="dashboard-form-row">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Project name"
              className="field-input"
            />
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              placeholder="https://..."
              className="field-input"
            />
            <button type="button" onClick={handleCreateProject} className="button-primary">
              Add
            </button>
          </div>

          {error && <p className="error-text" style={{ marginBottom: '0.75rem' }}>{error}</p>}

          <div className="dashboard-list">
            {projects.length === 0 ? (
              <p className="dashboard-card-copy">No projects yet. Add your first deployment target to get started.</p>
            ) : (
              projects.map((p) => (
                <div key={p.id} className="dashboard-item">
                  <div className="dashboard-item-meta">
                    <strong>{p.name}</strong>
                    <span>{p.target_url}</span>
                  </div>
                  <div className="dashboard-item-actions">
                    <a href={`/?projectId=${p.id}&url=${encodeURIComponent(p.target_url)}`} className="button-ghost">
                      Scan
                    </a>
                    <button type="button" onClick={() => handleDelete(p.id)} className="button-ghost" style={{ color: 'var(--critical)' }}>
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="dashboard-card fade-up">
          <div className="dashboard-card-header">
            <div>
              <h2 className="dashboard-card-title">Recent scans</h2>
              <p className="dashboard-card-copy">Monitor queue activity and spot low-scoring deployments quickly.</p>
            </div>
            <span className="status-pill">{activeCount} active</span>
          </div>

          <div className="dashboard-list">
            {recentScans.length === 0 ? (
              <p className="dashboard-card-copy">No scans yet.</p>
            ) : (
              recentScans.map((scan) => (
                <div key={scan.id} className="dashboard-item">
                  <div className="dashboard-item-meta">
                    <strong style={{ fontFamily: 'var(--mono)' }}>{scan.target_host}</strong>
                    <span>{scan.id}</span>
                  </div>
                  <div className="dashboard-item-actions">
                    <span className="status-pill">{scan.status}</span>
                    {scan.score !== null && (
                      <span
                        className="score-pill"
                        style={{
                          color: scan.score >= 80 ? 'var(--success)' : scan.score >= 50 ? 'var(--medium)' : 'var(--critical)',
                        }}
                      >
                        {scan.score}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
