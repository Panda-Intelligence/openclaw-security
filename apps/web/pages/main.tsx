import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReportView } from './components/ReportView';
import { ScanForm } from './components/ScanForm';
import { ScanProgress } from './components/ScanProgress';
import type { ReportData } from './lib/api';

type View = 'home' | 'scanning' | 'report';

interface ScanState {
  scanId: string | null;
  report: ReportData | null;
}

function App() {
  const [view, setView] = useState<View>('home');
  const [state, setState] = useState<ScanState>({ scanId: null, report: null });

  const handleScanStart = (scanId: string) => {
    setState({ scanId, report: null });
    setView('scanning');
  };

  const handleScanComplete = (report: ReportData) => {
    setState((prev) => ({ ...prev, report }));
    setView('report');
  };

  const handleReset = () => {
    setState({ scanId: null, report: null });
    setView('home');
  };

  return (
    <div>
      <header
        style={{
          textAlign: 'center',
          marginBottom: '3rem',
          paddingTop: '1rem',
        }}
      >
        <h1
          style={{
            fontSize: '2rem',
            fontWeight: 700,
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            marginBottom: '0.5rem',
          }}
        >
          OpenClaw Security
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>Security audit for OpenClaw deployments</p>
      </header>

      {view === 'home' && <ScanForm onStart={handleScanStart} />}
      {view === 'scanning' && state.scanId && <ScanProgress scanId={state.scanId} onComplete={handleScanComplete} />}
      {view === 'report' && state.report && <ReportView report={state.report} onReset={handleReset} />}
    </div>
  );
}

const root = document.getElementById('root')!;
createRoot(root).render(<App />);
