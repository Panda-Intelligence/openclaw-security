import React, { useEffect, useState, useRef } from 'react';
import { getScan, getReport } from '../lib/api.js';

interface Props {
  scanId: string;
  onComplete: (report: any) => void;
}

export function ScanProgress({ scanId, onComplete }: Props) {
  const [status, setStatus] = useState('pending');
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(Math.round((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      while (!cancelled) {
        try {
          const result = await getScan(scanId);
          const st = result.data.status;
          setStatus(st);

          if (st === 'completed') {
            const report = await getReport(scanId);
            if (!cancelled) onComplete(report.data);
            return;
          }
          if (st === 'failed') return;
        } catch { /* retry */ }

        await new Promise((r) => setTimeout(r, 2000));
      }
    };

    poll();
    return () => { cancelled = true; };
  }, [scanId]);

  const dots = '.'.repeat((elapsed % 3) + 1);

  return (
    <div style={{
      maxWidth: 500,
      margin: '0 auto',
      textAlign: 'center',
      padding: '3rem 0',
    }}>
      <div style={{
        width: 80,
        height: 80,
        margin: '0 auto 2rem',
        border: '3px solid var(--border)',
        borderTopColor: 'var(--accent)',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
      }} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        {status === 'pending' ? 'Queued' : 'Scanning'}{dots}
      </h2>

      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        {elapsed}s elapsed
      </p>

      {status === 'failed' && (
        <p style={{ color: 'var(--critical)', marginTop: '1rem' }}>
          Scan failed. Please try again.
        </p>
      )}
    </div>
  );
}
