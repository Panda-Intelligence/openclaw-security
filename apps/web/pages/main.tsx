import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import LoginPage from './auth/login';
import DashboardPage from './app/dashboard';
import PricingPage from './app/pricing';
import CommunityPage from './community/page';
import BlogPage from './blog/page';
import IntelligencePage from './intelligence/page';
import { ScanForm } from './components/ScanForm';
import { ScanProgress } from './components/ScanProgress';
import { ReportView } from './components/ReportView';
import { consumeAuthTokenFromUrl, getRouteFromPath } from './lib/auth-bootstrap';
import { isLoggedIn, setToken } from './lib/api';
import type { ReportData } from './lib/api';

type Route = 'home' | 'scanning' | 'report' | 'login' | 'dashboard' | 'pricing' | 'community' | 'blog' | 'intel';
const logoUrl = new URL('../../../logo.jpg', import.meta.url).href;

function upsertMeta(selector: string, attr: 'content' | 'href', value: string): void {
  const node = document.head.querySelector(selector);
  if (node) node.setAttribute(attr, value);
}

function upsertStructuredData(data: Record<string, unknown>): void {
  const scriptId = 'route-structured-data';
  let script = document.getElementById(scriptId) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = scriptId;
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

function applySeo(route: Route, report?: ReportData | null): void {
  const map: Record<Route, { title: string; description: string; keywords: string }> = {
    home: {
      title: 'OpenClaw Security Audit Platform',
      description: 'OpenClaw security audit tooling for skills, configs, LLM runtime risk, headers, dependencies, and deployment posture.',
      keywords: 'openclaw security, openclaw audit, openclaw security audit, agent security audit, marketplace skills security',
    },
    scanning: {
      title: 'Running OpenClaw Security Audit',
      description: 'Track a live OpenClaw security audit as the worker scans deployment posture and runtime risks.',
      keywords: 'openclaw security audit, scan progress, deployment security audit',
    },
    report: {
      title: report ? `Security Report for ${report.target_url}` : 'OpenClaw Security Audit Report',
      description: 'Review findings, severity, evidence, and recommendations from an OpenClaw security audit report.',
      keywords: 'openclaw security report, openclaw audit report, skills security findings, llm security findings',
    },
    login: {
      title: 'Sign in · OpenClaw Security Audit',
      description: 'Sign in to manage OpenClaw security audit projects, reports, and scans.',
      keywords: 'openclaw security login, audit dashboard',
    },
    dashboard: {
      title: 'Dashboard · OpenClaw Security Audit',
      description: 'Manage projects, monitor scans, and review OpenClaw security audit activity from the dashboard.',
      keywords: 'openclaw dashboard, openclaw security audit dashboard',
    },
    pricing: {
      title: 'Pricing · OpenClaw Security Audit',
      description: 'Pricing for OpenClaw security audit plans covering passive scans, deep scans, and reporting workflows.',
      keywords: 'openclaw security pricing, openclaw audit pricing',
    },
    community: {
      title: 'Community Security Data · OpenClaw Audit',
      description: 'Public community security data for OpenClaw deployments, including score trends and issue distributions.',
      keywords: 'openclaw community security, openclaw audit data, public security report',
    },
    blog: {
      title: 'Blog · OpenClaw Security Audit',
      description: 'Research, guides, and operator notes focused on OpenClaw security, audit workflows, and AI runtime risks.',
      keywords: 'openclaw security blog, openclaw audit research, llm runtime security',
    },
    intel: {
      title: 'OpenClaw Security Audit Intelligence',
      description: 'Public intelligence board for marketplace skills, release and dependency security, install hardening, and LLM safety in OpenClaw.',
      keywords: 'openclaw security audit intelligence, openclaw marketplace skills security, openclaw dependency security, llm security audit',
    },
  };

  const meta = map[route];
  document.title = meta.title;
  upsertMeta('meta[name="description"]', 'content', meta.description);
  upsertMeta('meta[name="keywords"]', 'content', meta.keywords);
  upsertMeta('meta[property="og:title"]', 'content', meta.title);
  upsertMeta('meta[property="og:description"]', 'content', meta.description);
  upsertMeta('meta[name="twitter:title"]', 'content', meta.title);
  upsertMeta('meta[name="twitter:description"]', 'content', meta.description);
  upsertMeta('link[rel="canonical"]', 'href', window.location.href);

  const structuredDataMap: Record<Route, Record<string, unknown>> = {
    home: {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      name: 'OpenClaw Security',
      applicationCategory: 'SecurityApplication',
      description: meta.description,
      keywords: meta.keywords,
      url: window.location.href,
    },
    scanning: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: meta.title,
      description: meta.description,
      url: window.location.href,
    },
    report: {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: meta.title,
      description: meta.description,
      keywords: meta.keywords,
      url: window.location.href,
    },
    login: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: meta.title,
      description: meta.description,
      url: window.location.href,
    },
    dashboard: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: meta.title,
      description: meta.description,
      url: window.location.href,
    },
    pricing: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: meta.title,
      description: meta.description,
      url: window.location.href,
    },
    community: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: meta.title,
      description: meta.description,
      url: window.location.href,
    },
    blog: {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: meta.title,
      description: meta.description,
      url: window.location.href,
    },
    intel: {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: meta.title,
      description: meta.description,
      url: window.location.href,
      about: ['OpenClaw Security', 'Marketplace skills security', 'LLM security audit'],
    },
  };

  upsertStructuredData(structuredDataMap[route]);
}

function App() {
  const [route, setRoute] = useState<Route>(() => {
    const { route, consumedToken } = consumeAuthTokenFromUrl(window.location.pathname, window.location.search, setToken);
    if (consumedToken) {
      window.history.replaceState({}, '', window.location.pathname);
    }
    return route;
  });
  const [scanId, setScanId] = useState<string | null>(null);
  const [report, setReport] = useState<ReportData | null>(null);

  useEffect(() => {
    const handlePopState = () => setRoute(getRouteFromPath(window.location.pathname));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    applySeo(route, report);
  }, [route, report]);

  const navigate = (r: Route) => {
    const paths: Record<Route, string> = {
      home: '/', scanning: '/', report: '/',
      login: '/auth/login', dashboard: '/app/dashboard',
      pricing: '/pricing', community: '/community', blog: '/blog', intel: '/intel',
    };
    window.history.pushState({}, '', paths[r]);
    setRoute(r);
  };

  const handleScanStart = (id: string) => { setScanId(id); setRoute('scanning'); };
  const handleScanComplete = (r: ReportData) => { setReport(r); setRoute('report'); };
  const handleReset = () => { setScanId(null); setReport(null); setRoute('home'); };
  const isMarketingRoute = route === 'home' || route === 'pricing' || route === 'community' || route === 'intel' || route === 'blog';

  return (
    <div className="site-shell">
      <nav className="site-nav">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate('home'); }} className="nav-brand nav-brand--left">
          <img src={logoUrl} alt="OpenClaw Security logo" className="nav-brand-logo" />
          <span className="nav-brand-text">
            OpenClaw Security
            <small>Deployment audit</small>
          </span>
        </a>

        <div className="nav-group nav-group--center">
          <a href="/pricing" onClick={(e) => { e.preventDefault(); navigate('pricing'); }} className="nav-link">
            Pricing
          </a>
          <a href="/community" onClick={(e) => { e.preventDefault(); navigate('community'); }} className="nav-link">
            Community
          </a>
          <a href="/intel" onClick={(e) => { e.preventDefault(); navigate('intel'); }} className="nav-link">
            Intelligence
          </a>
          <a href="/blog" onClick={(e) => { e.preventDefault(); navigate('blog'); }} className="nav-link">
            Blog
          </a>
        </div>

        <div className="nav-group nav-group--right">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate('home'); }} className="nav-link">
            Scanner
          </a>
          {isLoggedIn() ? (
            <a href="/app/dashboard" onClick={(e) => { e.preventDefault(); navigate('dashboard'); }} className="nav-link nav-link--accent">
              Dashboard
            </a>
          ) : (
            <a href="/auth/login" onClick={(e) => { e.preventDefault(); navigate('login'); }} className="button-secondary">
              Sign in
            </a>
          )}
        </div>
      </nav>

      <main className="page-main">
        {route === 'home' && <ScanForm onStart={handleScanStart} />}
        {route === 'scanning' && scanId && <ScanProgress scanId={scanId} onComplete={handleScanComplete} />}
        {route === 'report' && report && <ReportView report={report} onReset={handleReset} />}
        {route === 'login' && <LoginPage />}
        {route === 'dashboard' && <DashboardPage />}
        {route === 'pricing' && <PricingPage />}
        {route === 'community' && <CommunityPage />}
        {route === 'intel' && <IntelligencePage />}
        {route === 'blog' && <BlogPage />}
      </main>

      {isMarketingRoute && (
        <footer className="site-footer">
          <div className="site-footer-grid">
            <div className="site-footer-brand">
              <div className="nav-brand" style={{ pointerEvents: 'none' }}>
                <img src={logoUrl} alt="OpenClaw Security logo" className="nav-brand-logo" />
                <span className="nav-brand-text">
                  OpenClaw Security
                  <small>Audit platform</small>
                </span>
              </div>
              <p>
                OpenClaw security audit workflows for marketplace skills, dependency posture, install hardening,
                gateway exposure, and LLM runtime risk.
              </p>
            </div>

            <div>
              <h3 className="site-footer-title">Product</h3>
              <div className="site-footer-links">
                <a href="/" onClick={(e) => { e.preventDefault(); navigate('home'); }}>Scanner</a>
                <a href="/pricing" onClick={(e) => { e.preventDefault(); navigate('pricing'); }}>Pricing</a>
                <a href="/community" onClick={(e) => { e.preventDefault(); navigate('community'); }}>Community data</a>
                <a href="/auth/login" onClick={(e) => { e.preventDefault(); navigate('login'); }}>Sign in</a>
              </div>
            </div>

            <div>
              <h3 className="site-footer-title">Research</h3>
              <div className="site-footer-links">
                <a href="/intel" onClick={(e) => { e.preventDefault(); navigate('intel'); }}>Security intelligence</a>
                <a href="/blog" onClick={(e) => { e.preventDefault(); navigate('blog'); }}>Audit blog</a>
                <a href="/sitemap.xml">Sitemap</a>
                <a href="/robots.txt">Robots</a>
              </div>
            </div>

            <div>
              <h3 className="site-footer-title">Trust & links</h3>
              <div className="site-footer-links">
                <a href="https://github.com/openclaw/openclaw-security" target="_blank" rel="noreferrer">GitHub</a>
                <a href="https://github.com/openclaw/openclaw-security/blob/main/SECURITY.md" target="_blank" rel="noreferrer">Security policy</a>
                <span>Marketplace skills security</span>
                <span>LLM runtime safety</span>
              </div>
            </div>
          </div>

          <div className="site-footer-meta">
            <span>© 2026 OpenClaw Security</span>
            <span>Keywords: openclaw security · openclaw audit · openclaw security audit</span>
          </div>
        </footer>
      )}
    </div>
  );
}

const root = document.getElementById('root')!;
createRoot(root).render(<App />);
