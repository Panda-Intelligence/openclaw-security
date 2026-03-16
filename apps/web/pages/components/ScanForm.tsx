import type React from 'react';
import { useEffect, useState } from 'react';
import { createScan, getProjects, isLoggedIn } from '../lib/api';
import type { ProjectRecord } from '../lib/api';
import { PairFlow } from './PairFlow';

interface Props {
  onStart: (scanId: string) => void;
}

export function ScanForm({ onStart }: Props) {
  const [url, setUrl] = useState('');
  const [deepScan, setDeepScan] = useState(false);
  const [jwt, setJwt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPair, setShowPair] = useState(false);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const loggedIn = isLoggedIn();

  useEffect(() => {
    if (loggedIn) {
      getProjects()
        .then((res) => setProjects(res.data))
        .catch(() => {});
    }
  }, [loggedIn]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');

    try {
      const mode = deepScan ? 'active' : 'passive';
      const result = await createScan(url.trim(), mode, deepScan ? jwt : undefined, selectedProjectId || undefined);
      onStart(result.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scan');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <form onSubmit={handleSubmit}>
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '1.5rem',
          }}
        >
          <label htmlFor="target-url" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Target URL</label>
          <input
            id="target-url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://your-deployment.royal-lake.com"
            style={{
              width: '100%',
              padding: '0.75rem 1rem',
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius)',
              color: 'var(--text)',
              fontSize: '0.95rem',
              fontFamily: 'var(--mono)',
              outline: 'none',
            }}
          />

          {loggedIn && projects.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <label htmlFor="project-select" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.9rem' }}>Project</label>
              <select
                id="project-select"
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.6rem 0.75rem',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                }}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              id="deep-scan"
              checked={deepScan}
              onChange={(e) => {
                setDeepScan(e.target.checked);
                if (e.target.checked) setShowPair(true);
              }}
              style={{ accentColor: 'var(--accent)' }}
            />
            <label htmlFor="deep-scan" style={{ fontSize: '0.9rem' }}>
              Enable Deep Scan (requires JWT authorization)
            </label>
          </div>

          {deepScan && showPair && <PairFlow jwt={jwt} onJwtChange={setJwt} onClose={() => setShowPair(false)} />}

          {error && <p style={{ color: 'var(--critical)', marginTop: '1rem', fontSize: '0.85rem' }}>{error}</p>}

          <button
            type="submit"
            disabled={loading || !url.trim()}
            style={{
              width: '100%',
              marginTop: '1.5rem',
              padding: '0.75rem',
              background: loading ? 'var(--border)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Starting scan...' : 'Start Security Scan'}
          </button>
        </div>
      </form>
    </div>
  );
}
