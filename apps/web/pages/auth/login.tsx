import type React from 'react';
import { loginWithGitHub, loginWithGoogle } from '../lib/api';

export default function LoginPage() {
  return (
    <div style={{ maxWidth: 400, margin: '4rem auto', textAlign: 'center' }}>
      <h1
        style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          background: 'linear-gradient(135deg, #6366f1, #a855f7)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: '0.5rem',
        }}
      >
        OpenClaw Security
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Sign in to manage your security scans</p>

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <button type="button" onClick={() => loginWithGoogle()} style={btnStyle}>
          Continue with Google
        </button>
        <button type="button" onClick={() => loginWithGitHub()} style={{ ...btnStyle, background: '#24292e' }}>
          Continue with GitHub
        </button>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '1.5rem' }}>
        By signing in, you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '0.75rem',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius)',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
};
