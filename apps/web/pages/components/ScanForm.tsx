import type React from 'react';
import { useState } from 'react';
import { createScan } from '../lib/api';
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');

    try {
      const mode = deepScan ? 'active' : 'passive';
      const result = await createScan(url.trim(), mode, deepScan ? jwt : undefined);
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
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Target URL</label>
          <input
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
