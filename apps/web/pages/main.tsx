import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import LoginPage from './auth/login';
import DashboardPage from './app/dashboard';
import PricingPage from './app/pricing';
import CommunityPage from './community/page';
import BlogPage from './blog/page';
import { ScanForm } from './components/ScanForm';
import { ScanProgress } from './components/ScanProgress';
import { ReportView } from './components/ReportView';
import { isLoggedIn, setToken } from './lib/api';
import type { ReportData } from './lib/api';

type Route = 'home' | 'scanning' | 'report' | 'login' | 'dashboard' | 'pricing' | 'community' | 'blog';

function getInitialRoute(): Route {
  const path = window.location.pathname;
  if (path.startsWith('/auth/login')) return 'login';
  if (path.startsWith('/app/dashboard')) return 'dashboard';
  if (path.startsWith('/pricing')) return 'pricing';
  if (path.startsWith('/community')) return 'community';
  if (path.startsWith('/blog')) return 'blog';
  return 'home';
}

function App() {
  const [route, setRoute] = useState<Route>(getInitialRoute);
  const [scanId, setScanId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      window.history.replaceState({}, '', window.location.pathname);
      setRoute('dashboard');
    }
  }, []);

  const navigate = (r: Route) => {
    const paths: Record<Route, string> = {
      home: '/', scanning: '/', report: '/',
      login: '/auth/login', dashboard: '/app/dashboard',
      pricing: '/pricing', community: '/community', blog: '/blog',
    };
    window.history.pushState({}, '', paths[r]);
    setRoute(r);
  };

  const handleScanStart = (id: string) => { setScanId(id); setRoute('scanning'); };
  const handleScanComplete = (r: ReportData) => { setReport(r); setRoute('report'); };
  const handleReset = () => { setScanId(null); setReport(null); setRoute('home'); };

  return (
    <div>
      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 2rem', borderBottom: '1px solid var(--border)' }}>
        <a href="/" onClick={(e) => { e.preventDefault(); navigate('home'); }} style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '1.1rem', textDecoration: 'none' }}>
          OpenClaw Security
        </a>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <a href="/pricing" onClick={(e) => { e.preventDefault(); navigate('pricing'); }} style={navLink}>Pricing</a>
          <a href="/community" onClick={(e) => { e.preventDefault(); navigate('community'); }} style={navLink}>Community</a>
          <a href="/blog" onClick={(e) => { e.preventDefault(); navigate('blog'); }} style={navLink}>Blog</a>
          {isLoggedIn() ? (
            <a href="/app/dashboard" onClick={(e) => { e.preventDefault(); navigate('dashboard'); }} style={{ ...navLink, color: 'var(--accent)' }}>Dashboard</a>
          ) : (
            <a href="/auth/login" onClick={(e) => { e.preventDefault(); navigate('login'); }} style={{ ...navLink, color: 'var(--accent)' }}>Sign in</a>
          )}
        </div>
      </nav>

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem' }}>
        {route === 'home' && <ScanForm onStart={handleScanStart} />}
        {route === 'scanning' && scanId && <ScanProgress scanId={scanId} onComplete={handleScanComplete} />}
        {route === 'report' && report && <ReportView report={report} onReset={handleReset} />}
        {route === 'login' && <LoginPage />}
        {route === 'dashboard' && <DashboardPage />}
        {route === 'pricing' && <PricingPage />}
        {route === 'community' && <CommunityPage />}
        {route === 'blog' && <BlogPage />}
      </div>
    </div>
  );
}

const navLink: React.CSSProperties = { color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' };

const root = document.getElementById('root')!;
createRoot(root).render(<App />);
