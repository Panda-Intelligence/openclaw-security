import React from 'react';

interface Props {
  jwt: string;
  onJwtChange: (jwt: string) => void;
  onClose: () => void;
}

export function PairFlow({ jwt, onJwtChange, onClose }: Props) {
  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '1rem',
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Deep Scan Authorization</h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontSize: '1.1rem',
          }}
        >
          x
        </button>
      </div>

      <ol style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '1.25rem', marginBottom: '1rem' }}>
        <li style={{ marginBottom: '0.25rem' }}>Open your OpenClaw Console in another tab</li>
        <li style={{ marginBottom: '0.25rem' }}>Open browser DevTools (F12) → Console</li>
        <li style={{ marginBottom: '0.25rem' }}>
          Run: <code style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>localStorage.getItem('jwt')</code>
        </li>
        <li>Paste the token below</li>
      </ol>

      <textarea
        value={jwt}
        onChange={(e) => onJwtChange(e.target.value)}
        placeholder="eyJhbGciOiJIUzI1NiIs..."
        rows={3}
        style={{
          width: '100%',
          padding: '0.5rem',
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '4px',
          color: 'var(--text)',
          fontFamily: 'var(--mono)',
          fontSize: '0.8rem',
          resize: 'vertical',
        }}
      />

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
        The token is used only for this scan (read-only GET requests) and is never stored.
      </p>
    </div>
  );
}
