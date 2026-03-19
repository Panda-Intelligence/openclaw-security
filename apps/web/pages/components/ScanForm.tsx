import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { createScan, getCommunityReports, getIntelligenceOverview, getPairings, getProjects, isLoggedIn } from '../lib/api';
import type { CommunityReportRecord, IntelligenceOverview, PairingRecord } from '../lib/api';
import type { ProjectRecord } from '../lib/api';
import { PairFlow } from './PairFlow';
import { PairSetup } from './PairSetup';

interface Props {
  onStart: (scanId: string) => void;
}

const featureCards = [
  {
    title: 'Fast passive audit',
    copy: 'Check headers, TLS, exposed routes, OAuth surfaces, and deployment fingerprints in one pass.',
    icon: '◌',
  },
  {
    title: 'JWT paired deep scan',
    copy: 'Layer in authenticated read-only checks for skills, schedules, agent config, and channel health.',
    icon: '◎',
  },
  {
    title: 'Actionable reporting',
    copy: 'Get severity counts, scoring, evidence, and recommendations that are ready to share with the team.',
    icon: '↗',
  },
];

const auditPillars = [
  {
    title: 'Marketplace skills',
    copy: 'Track public skill trust, local override drift, and execution boundaries across the OpenClaw ecosystem.',
  },
  {
    title: 'Version & dependency posture',
    copy: 'Watch release changes, dependency review checkpoints, and package provenance signals on every version bump.',
  },
  {
    title: 'Installation & gateway hardening',
    copy: 'Audit dangerous flags, reverse-proxy trust settings, build approvals, and exposed deployment surfaces.',
  },
  {
    title: 'LLM runtime safety',
    copy: 'Keep prompt leakage, memory injection, provider drift, and tool overreach in the same review loop.',
  },
];

const useCases = [
  {
    title: 'Pre-launch deployment review',
    copy: 'Run a passive scan before every rollout, then deepen with JWT-backed checks for config, channels, and agent state.',
  },
  {
    title: 'Marketplace skill due diligence',
    copy: 'Use the public intelligence board to track skill sourcing, overrides, and ecosystem trust signals before enabling new packages.',
  },
  {
    title: 'Version upgrade audit',
    copy: 'Check OpenClaw release posture, dependency review notes, and install hardening signals on each version bump.',
  },
];

const faqItems = [
  {
    question: 'What does OpenClaw Security audit?',
    answer: 'It covers public deployment posture plus authenticated checks for agent config, schedules, skills, channels, install safety, and LLM runtime risk.',
  },
  {
    question: 'Why is marketplace skill security a core theme?',
    answer: 'Public skills change the trust boundary. Operators need to review source, override precedence, execution scope, and plugin-shipped behavior.',
  },
  {
    question: 'Can this support release-by-release dependency review?',
    answer: 'Yes. The public intelligence board and blog are structured to highlight version posture, provenance, and dependency review checkpoints.',
  },
];

export function ScanForm({ onStart }: Props) {
  const [url, setUrl] = useState('');
  const [deepScan, setDeepScan] = useState(false);
  const [jwt, setJwt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPair, setShowPair] = useState(false);
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [copied, setCopied] = useState(false);
  const [overview, setOverview] = useState<IntelligenceOverview | null>(null);
  const [reports, setReports] = useState<CommunityReportRecord[]>([]);
  const [pairing, setPairing] = useState<PairingRecord | null>(null);
  const loggedIn = isLoggedIn();

  useEffect(() => {
    if (loggedIn) {
      getProjects()
        .then((res) => setProjects(res.data))
        .catch(() => {});
    }

    getIntelligenceOverview()
      .then((res) => setOverview(res.data))
      .catch(() => {});

    getCommunityReports(5)
      .then((res) => setReports(res.data))
      .catch(() => {});
  }, [loggedIn]);

  // Fetch pairing status when project changes
  useEffect(() => {
    if (!selectedProjectId || !loggedIn) {
      setPairing(null);
      return;
    }
    getPairings(selectedProjectId)
      .then((res) => {
        const active = res.data.find((p) => p.status === 'active' || p.status === 'expired' || p.status === 'error');
        setPairing(active ?? null);
      })
      .catch(() => setPairing(null));
  }, [selectedProjectId, loggedIn]);

  const commandPreview = useMemo(() => {
    const target = url.trim() || 'https://your-deployment.example.com';
    return `bun run scan ${target}${deepScan ? ' --deep --token <jwt>' : ''}`;
  }, [deepScan, url]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;

    setLoading(true);
    setError('');

    try {
      const mode = deepScan ? 'active' : 'passive';
      // If paired, don't send JWT — the server resolves it from the stored pairing
      const hasPairing = pairing?.status === 'active';
      const jwtToSend = deepScan && !hasPairing ? jwt : undefined;
      const result = await createScan(url.trim(), mode, jwtToSend, selectedProjectId || undefined);
      onStart(result.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start scan');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(commandPreview);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="landing-stack">
      <section className="hero-section">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            OpenClaw deployment scanner
          </span>

          <h1 className="display">
            Audit every
            <br />
            OpenClaw surface
            <br />
            before it ships.
          </h1>

          <p className="lede">
            OpenClaw Security is an audit-first surface for deployment review: marketplace skills, dependency posture,
            install configuration safety, exposed routes, and LLM runtime risk in one operator workflow.
          </p>

          <div className="hero-actions">
            <a href="#scan-panel" className="button-primary">
              Start a scan
            </a>
            <a href="/intel" className="button-secondary">
              Public intelligence
            </a>
          </div>

          <div className="meta-row">
            <span className="meta-pill">OpenClaw security audit for skills, config, and runtime risk</span>
            <span className="meta-pill">CLI, dashboard, and browser extension</span>
            <span className="meta-pill">Cloudflare Worker runtime</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="terminal-card">
            <div className="terminal-header">
              <div className="terminal-dots">
                <span />
                <span />
                <span />
              </div>
              <span className="terminal-title">Quickstart</span>
            </div>

            <div className="terminal-body">
              <div className="terminal-line">
                <span className="terminal-prompt">$</span>
                <span>{commandPreview}</span>
                <button type="button" className="terminal-copy" onClick={handleCopy}>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <div className="terminal-notes">
                <div className="terminal-note">
                  <span className="terminal-note-label">Scan mode</span>
                  <div className="terminal-note-value">{deepScan ? 'Deep' : 'Passive'}</div>
                </div>
                <div className="terminal-note">
                  <span className="terminal-note-label">Best for</span>
                  <div className="terminal-note-value">{deepScan ? 'Config review' : 'External posture'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-value">14</div>
              <div className="metric-label">Passive checks</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">6</div>
              <div className="metric-label">JWT checks</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">0-100</div>
              <div className="metric-label">Penalty score</div>
            </div>
          </div>
        </div>
      </section>

      <section className="scan-layout">
        <div className="surface-panel">
          <div className="section-badge">Scan workflow</div>
          <h2 className="section-title">Paste a target, choose depth, launch.</h2>
          <p className="section-copy">
            The UX follows the reference’s “editorial landing page + terminal utility” approach: clear hierarchy,
            short instructions, and one obvious next action per section.
          </p>

          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-value">01</div>
              <div className="metric-label">Enter the deployment URL</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">02</div>
              <div className="metric-label">Enable deep scan if you have a JWT</div>
            </div>
            <div className="metric-card">
              <div className="metric-value">03</div>
              <div className="metric-label">Review the report and findings</div>
            </div>
          </div>
        </div>

        <div id="scan-panel" className="surface-panel">
          <div className="section-badge">Launch scan</div>
          <h2 style={{ margin: '0 0 6px', fontSize: '1.35rem' }}>Security audit request</h2>
          <p className="field-hint" style={{ marginBottom: 18 }}>
            Start with a passive scan, then pair a JWT when you need deeper authenticated insights.
          </p>

          <form className="scan-form" onSubmit={handleSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="target-url">
                Target URL
              </label>
              <input
                id="target-url"
                className="field-input"
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-deployment.royal-lake.com"
              />
            </div>

            {loggedIn && projects.length > 0 && (
              <div className="field-group">
                <label className="field-label" htmlFor="project-select">
                  Project
                </label>
                <select
                  id="project-select"
                  className="field-select"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <label className="inline-choice" htmlFor="deep-scan">
              <input
                type="checkbox"
                id="deep-scan"
                checked={deepScan}
                onChange={(e) => {
                  setDeepScan(e.target.checked);
                  if (e.target.checked && !pairing) setShowPair(true);
                }}
              />
              <span>
                <strong style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: 2 }}>
                  Enable deep scan
                  {pairing?.status === 'active' && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 400 }}>(paired)</span>
                  )}
                </strong>
                <span className="field-hint">
                  {pairing?.status === 'active'
                    ? 'Uses stored pairing credential. No manual JWT needed.'
                    : 'Requires a JWT and unlocks authenticated read-only checks.'}
                </span>
              </span>
            </label>

            {deepScan && selectedProjectId && (
              <PairSetup
                projectId={selectedProjectId}
                pairing={pairing}
                onUpdate={(updated) => setPairing(updated)}
              />
            )}

            {deepScan && !selectedProjectId && showPair && (
              <PairFlow jwt={jwt} onJwtChange={setJwt} onClose={() => setShowPair(false)} />
            )}

            {error && <p className="error-text">{error}</p>}

            <button type="submit" disabled={loading || !url.trim()} className="button-primary" style={{ width: '100%' }}>
              {loading ? 'Starting scan...' : 'Start security scan'}
            </button>
          </form>
        </div>
      </section>

      <section className="content-grid">
        <div className="radar-grid">
          <div className="surface-panel">
            <div className="section-badge">Public security radar</div>
            <h2 className="section-title">Track the OpenClaw audit conversation in public.</h2>
            <p className="section-copy">
              The public board now covers marketplace skills, dependency and release posture, install hardening,
              gateway exposure, and LLM runtime safety.
            </p>

            <div className="metric-grid">
              <div className="metric-card">
                <div className="metric-value">{overview?.marketplaceSkills.length ?? '—'}</div>
                <div className="metric-label">Marketplace skill signals</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{overview?.releases[0]?.version ?? '—'}</div>
                <div className="metric-label">Latest tracked release</div>
              </div>
              <div className="metric-card">
                <div className="metric-value">{overview?.sources.length ?? '—'}</div>
                <div className="metric-label">Official sources</div>
              </div>
            </div>
          </div>

          <div className="surface-panel">
            <div className="section-badge">Community reports</div>
            <h2 style={{ margin: '0 0 10px', fontSize: '1.35rem' }}>Recent public audit signals</h2>
            <div className="dashboard-list">
              {reports.length === 0 ? (
                <p className="dashboard-card-copy">No public reports yet.</p>
              ) : (
                reports.map((report) => (
                  <div key={report.id} className="dashboard-item">
                    <div className="dashboard-item-meta">
                      <strong>{report.target_host}</strong>
                      <span>{report.finding_count} findings · {report.platform_version ?? 'unknown version'}</span>
                    </div>
                    <div className="dashboard-item-actions">
                      <span
                        className="score-pill"
                        style={{
                          color: report.score >= 80 ? 'var(--success)' : report.score >= 50 ? 'var(--medium)' : 'var(--critical)',
                        }}
                      >
                        {report.score}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="surface-panel">
          <div className="section-badge">How it works</div>
          <h2 className="section-title">A calmer review loop for security teams.</h2>
          <div className="steps-grid">
            <div className="step-card">
              <span className="step-number">01</span>
              <h3 className="step-title">Probe the public surface</h3>
              <p className="step-copy">Headers, cookies, CORS, TLS, admin paths, and fingerprinting checks run first.</p>
            </div>
            <div className="step-card">
              <span className="step-number">02</span>
              <h3 className="step-title">Pair when you need context</h3>
              <p className="step-copy">JWT-backed scans inspect agent config, schedules, skills, and channel credentials.</p>
            </div>
            <div className="step-card">
              <span className="step-number">03</span>
              <h3 className="step-title">Act on prioritized findings</h3>
              <p className="step-copy">Use severity, evidence, and recommendations to move from scan to fix without guessing.</p>
            </div>
          </div>
        </div>

        <div className="surface-panel">
          <div className="section-badge">Why teams use it</div>
          <h2 className="section-title">Designed to feel like a product, not a raw diagnostic dump.</h2>
          <div className="feature-grid">
            {featureCards.map((feature) => (
              <div key={feature.title} className="feature-card">
                <div className="feature-icon" aria-hidden="true">
                  {feature.icon}
                </div>
                <h3 className="feature-title">{feature.title}</h3>
                <p className="feature-copy">{feature.copy}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-panel">
          <div className="section-badge">Audit pillars</div>
          <h2 className="section-title">A landing page centered on OpenClaw security audit work.</h2>
          <div className="pillar-grid">
            {auditPillars.map((pillar) => (
              <div key={pillar.title} className="pillar-card">
                <h3 className="feature-title">{pillar.title}</h3>
                <p className="feature-copy">{pillar.copy}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-panel">
          <div className="section-badge">Use cases</div>
          <h2 className="section-title">Built for real OpenClaw operators, not generic security dashboards.</h2>
          <div className="feature-grid">
            {useCases.map((item, index) => (
              <div key={item.title} className="feature-card">
                <span className="step-number">{`0${index + 1}`}</span>
                <h3 className="feature-title">{item.title}</h3>
                <p className="feature-copy">{item.copy}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="surface-panel">
          <div className="section-badge">Source-backed research</div>
          <h2 className="section-title">Public security reporting, not generic marketing copy.</h2>
          <div className="source-grid">
            {(overview?.sources ?? []).slice(0, 4).map((source) => (
              <a key={source.url} href={source.url} target="_blank" rel="noreferrer" className="source-card">
                <strong>{source.label}</strong>
                <p>{source.note}</p>
              </a>
            ))}
          </div>
        </div>

        <div className="surface-panel">
          <div className="section-badge">FAQ</div>
          <h2 className="section-title">Questions teams ask before they start an OpenClaw security audit.</h2>
          <div className="faq-list">
            {faqItems.map((item) => (
              <div key={item.question} className="faq-card">
                <h3 className="feature-title">{item.question}</h3>
                <p className="feature-copy">{item.answer}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="landing-cta">
          <div>
            <div className="section-badge">OpenClaw security audit</div>
            <h2 className="section-title" style={{ marginBottom: 8 }}>Start with the scanner, then move into public intelligence.</h2>
            <p className="section-copy">
              Use the landing page as the operator entry point: run a scan, review community data, and follow public
              research around marketplace skills, dependencies, install safety, and LLM security.
            </p>
          </div>
          <div className="landing-cta-actions">
            <a href="#scan-panel" className="button-primary">Run a scan</a>
            <a href="/intel" className="button-secondary">Browse intelligence</a>
          </div>
        </div>
      </section>
    </div>
  );
}
