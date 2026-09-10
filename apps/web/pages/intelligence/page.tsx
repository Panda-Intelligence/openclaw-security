import { useEffect, useState } from 'react';
import { getIntelligenceOverview } from '../lib/api';
import type { IntelligenceBoardItem, IntelligenceOverview } from '../lib/api';

const sectionAnchors = [
  { id: 'skills-watch', label: 'Skills' },
  { id: 'release-watch', label: 'Releases' },
  { id: 'community-threat-signals', label: 'Community' },
  { id: 'version-advisories', label: 'Advisories' },
  { id: 'install-hardening', label: 'Install' },
  { id: 'llm-security', label: 'LLM' },
  { id: 'gateway-hardening', label: 'Gateway' },
  { id: 'official-sources', label: 'Sources' },
] as const;

const INTELLIGENCE_BOARD_COUNT = sectionAnchors.length - 1;

const researchPillars = [
  {
    title: 'Marketplace skill trust',
    copy: 'Track how public skill distribution, local overrides, and plugin-shipped behaviors affect OpenClaw audit scope.',
  },
  {
    title: 'Release & dependency posture',
    copy: 'Keep release cadence, dependency-sensitive changes, and security-heavy rollout notes visible for operators and buyers.',
  },
  {
    title: 'Community threat pressure',
    copy: 'Aggregate anonymous deployment findings into repeatable threat signals that show where operators are still struggling.',
  },
  {
    title: 'Installation hardening',
    copy: 'Surface the setup decisions that most strongly change baseline OpenClaw security before runtime even begins.',
  },
  {
    title: 'LLM runtime boundaries',
    copy: 'Map where prompt leakage, tool overreach, and gateway exposure create the biggest OpenClaw audit signals.',
  },
] as const;

const methodologySteps = [
  'Use official OpenClaw docs and release notes as the primary source of truth.',
  'Correlate anonymous community scan outcomes to highlight repeated operator failures and emerging pressure points.',
  'Translate platform changes into operator-facing audit signals rather than generic security headlines.',
  'Prioritize skills, install posture, dependency behavior, and LLM runtime boundaries.',
  'Keep every board item short, source-linked, and usable in a live OpenClaw security audit workflow.',
] as const;

function riskColor(risk: 'low' | 'medium' | 'high' | 'critical'): string {
  return `var(--${risk})`;
}

function BoardSection({
  id,
  title,
  copy,
  items,
}: {
  id: string;
  title: string;
  copy: string;
  items: IntelligenceBoardItem[];
}) {
  return (
    <section id={id} className="dashboard-card fade-up intel-panel intel-section">
      <h2 className="dashboard-card-title">{title}</h2>
      <p className="dashboard-card-copy">{copy}</p>
      <div className="intel-list" style={{ marginTop: '1rem' }}>
        {items.length === 0 ? (
          <div className="intel-empty">No items match the current filters.</div>
        ) : (
          items.map((item) => (
            <article key={item.name} className="intel-item">
              <div className="intel-item-main">
                <strong>{item.name}</strong>
                <p>{item.summary}</p>
              </div>
              <div className="intel-item-side">
                <span className="severity-pill" style={{ background: riskColor(item.risk) }}>
                  {item.risk}
                </span>
                <span>{item.signal}</span>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export default function IntelligencePage() {
  const [overview, setOverview] = useState<IntelligenceOverview | null>(null);
  const [riskFilter, setRiskFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    getIntelligenceOverview().then((res) => setOverview(res.data));
  }, []);

  if (!overview) return <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Loading...</p>;

  const applyFilters = (items: IntelligenceBoardItem[]) =>
    items.filter((item) => {
      const riskPass = riskFilter === 'all' || item.risk === riskFilter;
      const haystack = `${item.name} ${item.summary} ${item.signal}`.toLowerCase();
      const searchPass = search.trim() === '' || haystack.includes(search.trim().toLowerCase());
      return riskPass && searchPass;
    });

  const skillsItems = applyFilters(overview.marketplaceSkills);
  const communityItems = applyFilters(overview.communitySignals);
  const advisoryItems = applyFilters(overview.versionAdvisories);
  const installItems = applyFilters(overview.installHardening);
  const llmItems = applyFilters(overview.llmSecurity);
  const gatewayItems = applyFilters(overview.gatewayHardening);
  const allRiskItems = [...skillsItems, ...communityItems, ...advisoryItems, ...installItems, ...llmItems, ...gatewayItems];
  const severitySummary = allRiskItems.reduce(
    (acc, item) => {
      acc[item.risk] += 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<'critical' | 'high' | 'medium' | 'low', number>,
  );
  const totalVisibleSignals =
    skillsItems.length +
    communityItems.length +
    advisoryItems.length +
    installItems.length +
    llmItems.length +
    gatewayItems.length +
    overview.releases.length;

  return (
    <div className="page-medium">
      <div className="page-header">
        <h1 style={{ fontSize: '3rem' }}>OpenClaw Security Audit Intelligence</h1>
        <p>
          Public, source-linked operator research for OpenClaw marketplace skills, release posture, anonymous community
          threat pressure, install safety, and LLM runtime risk. Last updated {overview.capturedAt}.
        </p>
      </div>

      <section className="dashboard-summary fade-up">
        <div className="dashboard-summary-card">
          <strong>{INTELLIGENCE_BOARD_COUNT}</strong>
          <span>Intelligence boards</span>
        </div>
        <div className="dashboard-summary-card">
          <strong>{overview.releases[0]?.version ?? '—'}</strong>
          <span>Latest tracked release</span>
        </div>
        <div className="dashboard-summary-card">
          <strong>{overview.sources.length}</strong>
          <span>Official sources</span>
        </div>
        <div className="dashboard-summary-card">
          <strong>{totalVisibleSignals}</strong>
          <span>Visible audit signals</span>
        </div>
      </section>

      <section className="intel-overview-grid">
        <article className="dashboard-card fade-up intel-panel">
          <h2 className="dashboard-card-title">Why this OpenClaw security audit board matters</h2>
          <p className="dashboard-card-copy">
            This page is built as a public research surface for OpenClaw security, with special focus on audit-ready
            topics: marketplace skills, release and dependency posture, community threat pressure, installation
            hardening, and LLM runtime safety.
          </p>
          <div className="intel-severity-grid">
            {(['critical', 'high', 'medium', 'low'] as const).map((risk) => (
              <div key={risk} className="intel-severity-card">
                <span className="severity-pill" style={{ background: riskColor(risk) }}>
                  {risk}
                </span>
                <strong>{severitySummary[risk]}</strong>
                <small>active signals</small>
              </div>
            ))}
          </div>
        </article>

        <article className="dashboard-card fade-up intel-panel">
          <h2 className="dashboard-card-title">Research methodology</h2>
          <p className="dashboard-card-copy">
            The board is optimized for operators, buyers, and reviewers who need concise OpenClaw audit context without
            leaving the product workflow.
          </p>
          <ol className="intel-methodology-list">
            {methodologySteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </article>
      </section>

      <section className="intel-pillar-grid">
        {researchPillars.map((pillar) => (
          <article key={pillar.title} className="intel-pillar-card fade-up">
            <h3>{pillar.title}</h3>
            <p>{pillar.copy}</p>
          </article>
        ))}
      </section>

      <div className="intel-layout">
        <aside className="intel-sidebar">
          <section className="dashboard-card fade-up intel-sidebar-card">
            <div className="dashboard-card-header">
              <div>
                <h2 className="dashboard-card-title">Filter the board</h2>
                <p className="dashboard-card-copy">Search by issue, signal, or risk level to focus the audit narrative.</p>
              </div>
            </div>
            <div className="filter-bar">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="field-input"
                placeholder="Search skills, community signals, advisories, releases, LLM risks, gateway exposure..."
              />
              <div className="filter-chip-row">
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map((risk) => (
                  <button
                    key={risk}
                    type="button"
                    onClick={() => setRiskFilter(risk)}
                    className={`filter-chip${riskFilter === risk ? ' filter-chip--active' : ''}`}
                  >
                    {risk}
                  </button>
                ))}
              </div>
            </div>

            <div className="intel-sidebar-summary">
              <div className="intel-mini-stat">
                <strong>{totalVisibleSignals}</strong>
                <span>Visible signals</span>
              </div>
              <div className="intel-mini-stat">
                <strong>{riskFilter}</strong>
                <span>Active risk filter</span>
              </div>
            </div>
          </section>

          <section className="dashboard-card fade-up intel-sidebar-card">
            <h2 className="dashboard-card-title">Jump to section</h2>
            <nav className="intel-anchor-nav">
              {sectionAnchors.map((anchor) => (
                <a key={anchor.id} href={`#${anchor.id}`} className="intel-anchor-link">
                  {anchor.label}
                </a>
              ))}
            </nav>
          </section>

          <section className="dashboard-card fade-up intel-sidebar-card">
            <h2 className="dashboard-card-title">Source freshness</h2>
            <div className="intel-freshness-list">
              {overview.sources.slice(0, 3).map((source) => (
                <div key={source.url} className="intel-freshness-item">
                  <strong>{source.label}</strong>
                  <span>Captured {source.capturedAt}</span>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <div className="community-sections">
          <div className="community-column">
            <BoardSection
              id="skills-watch"
              title="Marketplace skills watch"
              copy="Review public registry exposure, override precedence, and plugin-shipped skill surfaces."
              items={skillsItems}
            />

            <section id="release-watch" className="dashboard-card fade-up intel-panel intel-section">
              <h2 className="dashboard-card-title">Release & dependency watch</h2>
              <p className="dashboard-card-copy">
                Public release monitoring focused on rollout relevance, provenance, and security-related change clusters.
              </p>
              <div className="intel-list" style={{ marginTop: '1rem' }}>
                {overview.releases.map((item) => (
                  <article key={item.version} className="intel-item">
                    <div className="intel-item-main">
                      <strong>{item.version}</strong>
                      <p>{item.summary}</p>
                    </div>
                    <div className="intel-item-side">
                      <span className="status-pill">{item.date}</span>
                      <span>{item.posture}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <BoardSection
              id="community-threat-signals"
              title="Community threat signals"
              copy="Aggregate anonymous deployment findings into a concise picture of repeated failures, severe finding concentration, and recent low-score pressure."
              items={communityItems}
            />

            <BoardSection
              id="version-advisories"
              title="Version advisory & CVE watch"
              copy="Surface which release lines still carry tracked advisories or end-of-life status in the shared scanner-core version database."
              items={advisoryItems}
            />
          </div>

          <div className="community-column">
            <BoardSection
              id="install-hardening"
              title="Install & configuration hardening"
              copy="Highlight the operator choices that most strongly affect initial security posture."
              items={installItems}
            />

            <BoardSection
              id="llm-security"
              title="LLM runtime security focus"
              copy="Keep prompt leakage, tool overreach, and scope confusion visible in the public audit story."
              items={llmItems}
            />

            <BoardSection
              id="gateway-hardening"
              title="Gateway & exposure hardening"
              copy="Map operational misconfiguration patterns that expand OpenClaw’s external attack surface."
              items={gatewayItems}
            />
          </div>
        </div>
      </div>

      <section id="official-sources" className="dashboard-card fade-up intel-panel intel-section" style={{ marginTop: '20px' }}>
        <h2 className="dashboard-card-title">Official sources</h2>
        <p className="dashboard-card-copy">
          The public board is intentionally linked to official OpenClaw docs and releases to keep the intelligence
          trail auditable.
        </p>
        <div className="intel-list" style={{ marginTop: '1rem' }}>
          {overview.sources.map((source) => (
            <article key={source.url} className="intel-item">
              <div className="intel-item-main">
                <strong>{source.label}</strong>
                <p>{source.note}</p>
              </div>
              <div className="intel-item-side">
                <span className="status-pill">Captured {source.capturedAt}</span>
                <a href={source.url} target="_blank" rel="noreferrer" className="button-secondary">
                  Open source
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
