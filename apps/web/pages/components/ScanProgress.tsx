import { useEffect, useRef, useState } from 'react';
import type { ReportData } from '../lib/api';
import { getReport, getScan } from '../lib/api';

interface Props {
  scanId: string;
  onComplete: (report: ReportData) => void;
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
        } catch {
          /* retry */
        }

        await new Promise((r) => setTimeout(r, 2000));
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [scanId, onComplete]);

  const dots = '.'.repeat((elapsed % 3) + 1);

  return (
    <div className="progress-shell">
      <div className="surface-panel">
        <div className="progress-ring" />

        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 style={{ fontSize: '2.4rem' }}>
            {status === 'pending' ? 'Queued' : 'Scanning'}
            {dots}
          </h1>
          <p>{elapsed}s elapsed · We are polling the worker for the latest status.</p>
        </div>

        {status === 'failed' && (
          <p style={{ color: 'var(--critical)', marginTop: '1rem' }}>Scan failed. Please try again.</p>
        )}
      </div>
    </div>
  );
}
