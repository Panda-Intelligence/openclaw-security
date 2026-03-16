import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { DetectionResult } from '../background/detection';
import { FindingSummary } from './components/FindingSummary';
import { ScoreBadge } from './components/ScoreBadge';

function Popup() {
  const [result, setResult] = useState<DetectionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.url) {
        setLoading(false);
        return;
      }

      const origin = new URL(tab.url).origin;
      chrome.runtime.sendMessage({ type: 'GET_RESULT', origin }, (res) => {
        setResult(res);
        setLoading(false);
      });
    });
  }, []);

  if (loading) {
    return <p style={{ color: '#6b7280', textAlign: 'center', padding: '24px 0' }}>Loading...</p>;
  }

  if (!result || !result.isOpenClaw) {
    return (
      <div>
        <h1 style={{ color: '#6366f1' }}>OpenClaw Security</h1>
        <p className="not-detected">Not an OpenClaw deployment</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ color: '#6366f1' }}>OpenClaw Security</h1>
        <ScoreBadge score={result.score ?? 0} />
      </div>

      {result.version && <p style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>Version: {result.version}</p>}

      {result.findings.length > 0 ? (
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            {result.findings.length} issue{result.findings.length !== 1 ? 's' : ''} found:
          </p>
          {result.findings.map((f, i) => (
            <FindingSummary key={i} title={f.title} severity={f.severity} />
          ))}
        </div>
      ) : (
        <p style={{ color: '#22c55e', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>No issues detected</p>
      )}

      <a
        href="https://security.pandacat.ai"
        target="_blank"
        rel="noopener"
        style={{
          display: 'block',
          textAlign: 'center',
          marginTop: 12,
          padding: '8px',
          background: '#6366f1',
          color: '#fff',
          borderRadius: 6,
          fontSize: 12,
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        Run Full Scan
      </a>
    </div>
  );
}

const root = document.getElementById('root')!;
createRoot(root).render(<Popup />);
