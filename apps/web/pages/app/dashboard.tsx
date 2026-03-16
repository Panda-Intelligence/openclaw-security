import type React from 'react';
import { useEffect, useState } from 'react';
import { getMe, getProjects, getScans, createProject, deleteProject, logout } from '../lib/api';
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
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Dashboard</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {user?.email} — <span style={{ color: 'var(--accent)', textTransform: 'capitalize' }}>{plan}</span> plan
          </p>
        </div>
        <button type="button" onClick={logout} style={{ ...linkBtn, color: 'var(--text-muted)' }}>
          Sign out
        </button>
      </div>

      {/* Projects */}
      <section style={cardStyle}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Projects ({projects.length})</h2>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            style={inputStyle}
          />
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://..."
            style={{ ...inputStyle, flex: 2 }}
          />
          <button type="button" onClick={handleCreateProject} style={btnStyle}>
            Add
          </button>
        </div>

        {error && <p style={{ color: 'var(--critical)', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</p>}

        {projects.map((p) => (
          <div
            key={p.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.5rem 0',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div>
              <strong>{p.name}</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.75rem' }}>
                {p.target_url}
              </span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <a href={`/?projectId=${p.id}&url=${encodeURIComponent(p.target_url)}`} style={linkBtn}>
                Scan
              </a>
              <button type="button" onClick={() => handleDelete(p.id)} style={{ ...linkBtn, color: 'var(--critical)' }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </section>

      {/* Recent scans */}
      <section style={{ ...cardStyle, marginTop: '1.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>Recent Scans</h2>
        {recentScans.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>No scans yet</p>
        ) : (
          recentScans.map((s) => (
            <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: '0.85rem' }}>{s.target_host}</span>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{s.status}</span>
                {s.score !== null && (
                  <span style={{ fontWeight: 600, color: s.score >= 80 ? 'var(--success)' : s.score >= 50 ? 'var(--medium)' : 'var(--critical)' }}>
                    {s.score}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '1.5rem',
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  padding: '0.5rem 0.75rem',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  fontSize: '0.85rem',
};

const btnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius)',
  fontSize: '0.85rem',
  cursor: 'pointer',
};

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--accent)',
  cursor: 'pointer',
  fontSize: '0.8rem',
  textDecoration: 'none',
};
