import { useState } from 'react';
import { createPairing, verifyPairing, refreshPairing, revokePairing } from '../lib/api';
import type { PairingRecord } from '../lib/api';

interface Props {
  projectId: string;
  pairing: PairingRecord | null;
  onUpdate: (pairing: PairingRecord | null) => void;
}

export function PairSetup({ projectId, pairing, onUpdate }: Props) {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handlePair = async () => {
    if (!token.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await createPairing(projectId, token.trim());
      onUpdate(result.data);
      setToken('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pairing failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!pairing) return;
    setLoading(true);
    setError('');
    try {
      const result = await verifyPairing(pairing.id);
      onUpdate({ ...pairing, status: result.data.status as PairingRecord['status'], verified_at: result.data.verifiedAt, expires_at: result.data.expiresAt });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!pairing || !token.trim()) return;
    setLoading(true);
    setError('');
    try {
      const result = await refreshPairing(pairing.id, token.trim());
      onUpdate(result.data);
      setToken('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!pairing) return;
    setLoading(true);
    setError('');
    try {
      await revokePairing(pairing.id);
      onUpdate(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed');
    } finally {
      setLoading(false);
    }
  };

  const isExpired = pairing?.status === 'expired';
  const isError = pairing?.status === 'error';
  const isActive = pairing?.status === 'active';
  const needsRefresh = isExpired || isError;

  // Active pairing — show status card
  if (pairing && isActive) {
    const expiresAt = pairing.expires_at ? new Date(pairing.expires_at) : null;
    const isExpiringSoon = expiresAt && expiresAt.getTime() - Date.now() < 48 * 60 * 60 * 1000;

    return (
      <div className="pair-panel">
        <div className="pair-header">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="pair-status-dot pair-status-active" />
            Paired
          </h3>
          <button type="button" onClick={handleRevoke} disabled={loading} className="pair-close" title="Revoke pairing">
            x
          </button>
        </div>

        <div className="pair-info-grid">
          {pairing.target_email && (
            <div className="pair-info-row">
              <span className="pair-info-label">Account</span>
              <span className="pair-info-value">{pairing.target_email}</span>
            </div>
          )}
          {pairing.target_tenant_id && (
            <div className="pair-info-row">
              <span className="pair-info-label">Tenant</span>
              <span className="pair-info-value" style={{ fontFamily: 'var(--mono)', fontSize: '0.8rem' }}>{pairing.target_tenant_id}</span>
            </div>
          )}
          {pairing.verified_at && (
            <div className="pair-info-row">
              <span className="pair-info-label">Verified</span>
              <span className="pair-info-value">{new Date(pairing.verified_at).toLocaleDateString()}</span>
            </div>
          )}
          {expiresAt && (
            <div className="pair-info-row">
              <span className="pair-info-label">Expires</span>
              <span className="pair-info-value" style={{ color: isExpiringSoon ? 'var(--medium)' : undefined }}>
                {expiresAt.toLocaleDateString()}
                {isExpiringSoon && ' (soon)'}
              </span>
            </div>
          )}
          {pairing.last_used_at && (
            <div className="pair-info-row">
              <span className="pair-info-label">Last used</span>
              <span className="pair-info-value">{new Date(pairing.last_used_at).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
          <button type="button" onClick={handleVerify} disabled={loading} className="button-ghost" style={{ fontSize: '0.8rem' }}>
            {loading ? 'Checking...' : 'Re-verify'}
          </button>
        </div>

        {error && <p className="error-text" style={{ marginTop: '0.5rem' }}>{error}</p>}

        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
          Deep scans will automatically use this pairing. No JWT input needed.
        </p>
      </div>
    );
  }

  // Expired or error — show warning + refresh input
  if (pairing && needsRefresh) {
    return (
      <div className="pair-panel">
        <div className="pair-header">
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`pair-status-dot ${isExpired ? 'pair-status-expired' : 'pair-status-error'}`} />
            {isExpired ? 'Pairing expired' : 'Pairing error'}
          </h3>
          <button type="button" onClick={handleRevoke} disabled={loading} className="pair-close" title="Revoke pairing">
            x
          </button>
        </div>

        {pairing.error_message && (
          <p style={{ fontSize: '0.8rem', color: 'var(--critical)', marginBottom: '0.75rem' }}>{pairing.error_message}</p>
        )}

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Provide a fresh token from your OpenClaw instance to restore the pairing.
        </p>

        <textarea
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIs..."
          rows={3}
          className="field-textarea"
          style={{ resize: 'vertical' }}
        />

        {error && <p className="error-text" style={{ marginTop: '0.5rem' }}>{error}</p>}

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || !token.trim()}
          className="button-primary"
          style={{ width: '100%', marginTop: '0.75rem' }}
        >
          {loading ? 'Refreshing...' : 'Refresh pairing'}
        </button>
      </div>
    );
  }

  // No pairing — show setup form
  return (
    <div className="pair-panel">
      <div className="pair-header">
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Pair your OpenClaw instance</h3>
      </div>

      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
        Provide a JWT from your OpenClaw instance. It will be encrypted and stored for ongoing deep scans.
      </p>

      <ol className="pair-list">
        <li>Open your OpenClaw Console in another tab</li>
        <li>Open browser DevTools (F12) &rarr; Console</li>
        <li>
          Run: <code style={{ fontFamily: 'var(--mono)', color: 'var(--accent)' }}>localStorage.getItem('jwt')</code>
        </li>
        <li>Paste the token below</li>
      </ol>

      <textarea
        value={token}
        onChange={(e) => setToken(e.target.value)}
        placeholder="eyJhbGciOiJIUzI1NiIs..."
        rows={3}
        className="field-textarea"
        style={{ resize: 'vertical' }}
      />

      {error && <p className="error-text" style={{ marginTop: '0.5rem' }}>{error}</p>}

      <button
        type="button"
        onClick={handlePair}
        disabled={loading || !token.trim()}
        className="button-primary"
        style={{ width: '100%', marginTop: '0.75rem' }}
      >
        {loading ? 'Verifying & pairing...' : 'Pair and save'}
      </button>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
        The token is verified against your instance, encrypted with AES-256-GCM, and stored securely. It is never exposed in API responses.
      </p>
    </div>
  );
}
