

interface Props {
  jwt: string;
  onJwtChange: (jwt: string) => void;
  onClose: () => void;
}

export function PairFlow({ jwt, onJwtChange, onClose }: Props) {
  return (
    <div className="pair-panel">
      <div className="pair-header">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Deep Scan Authorization</h3>
        <button type="button" onClick={onClose} className="pair-close">
          x
        </button>
      </div>

      <ol className="pair-list">
        <li>Open your OpenClaw Console in another tab</li>
        <li>Open browser DevTools (F12) → Console</li>
        <li>
          Run: <code style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>localStorage.getItem('jwt')</code>
        </li>
        <li>Paste the token below</li>
      </ol>

      <textarea
        value={jwt}
        onChange={(e) => onJwtChange(e.target.value)}
        placeholder="eyJhbGciOiJIUzI1NiIs..."
        rows={3}
        className="field-textarea"
        style={{ resize: 'vertical' }}
      />

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
        The token is used only for this scan (read-only GET requests) and is never stored.
      </p>
    </div>
  );
}
