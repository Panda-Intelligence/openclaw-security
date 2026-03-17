import type React from 'react';
import { loginWithGitHub, loginWithGoogle } from '../lib/api';

export default function LoginPage() {
  return (
    <div className="page-narrow">
      <div className="surface-panel" style={{ maxWidth: 480, margin: '3rem auto', textAlign: 'center' }}>
        <div className="page-header">
          <h1 style={{ fontSize: '2.8rem' }}>OpenClaw Security</h1>
          <p>Sign in to manage projects, launch scans, and review reports.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <button type="button" onClick={() => loginWithGoogle()} style={btnStyle}>
            <GoogleLogo />
            Continue with Google
          </button>
          <button type="button" onClick={() => loginWithGitHub()} style={{ ...btnStyle, background: '#24292e' }}>
            <GitHubLogo />
            Continue with GitHub
          </button>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '1.5rem' }}>
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '0.9rem',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius-pill)',
  fontSize: '0.95rem',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.65rem',
};

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 3.4 14.5 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12S6.8 21.5 12 21.5c6.1 0 9.1-4.3 9.1-6.5 0-.4 0-.7-.1-1H12Z"
      />
      <path
        fill="#34A853"
        d="M2.5 7.1l3.2 2.3c.9-1.8 2.8-3 5-3 1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 3.4 14.5 2.5 12 2.5c-3.7 0-6.9 2.1-8.5 5.1Z"
      />
      <path
        fill="#FBBC05"
        d="M12 21.5c2.4 0 4.5-.8 6-2.3l-2.8-2.3c-.8.5-1.8.9-3.2.9-3.8 0-5.2-2.5-5.4-3.8l-3.2 2.5c1.6 3.1 4.8 5 8.6 5Z"
      />
      <path
        fill="#4285F4"
        d="M21.1 14.9c.1-.4.1-.7.1-1.1 0-.4 0-.8-.1-1.1H12v4h5.4c-.3 1-.9 1.9-2 2.6l2.8 2.3c1.7-1.6 2.9-4 2.9-6.7Z"
      />
    </svg>
  );
}

function GitHubLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12a12 12 0 0 0 8.2 11.39c.6.11.82-.26.82-.58v-2.03c-3.34.72-4.04-1.42-4.04-1.42-.54-1.39-1.33-1.76-1.33-1.76-1.09-.75.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.48 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.53.12-3.18 0 0 1.01-.32 3.3 1.23A11.4 11.4 0 0 1 12 6.8c1.02.01 2.05.14 3 .41 2.3-1.55 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.8 5.62-5.48 5.92.43.38.82 1.1.82 2.22v3.29c0 .32.22.7.82.58A12 12 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
    </svg>
  );
}
