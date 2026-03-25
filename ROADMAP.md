# Roadmap

## Current State (v0.2.0 — 2026-03-17)

**Core platform**: Scanner (21 checks), CLI, Web dashboard, Browser extension, Intelligence board.
**SaaS layer**: Auth (Google/GitHub OAuth), Stripe billing (free/starter), projects, reusable deep-scan pairings, quotas.
**Infrastructure**: Cloudflare Workers + D1 + Queues, multi-env deploy (staging/production).
**Quality**: 246 tests, TypeScript strict, Biome lint, Zod validation, rate limiting.

---

## v0.3.0 — Scanner Expansion

### New checks
- [x] CSP (Content-Security-Policy) deep audit — directive analysis, unsafe-inline detection
- [ ] Dependency vulnerability scan — match `package.json` deps against known CVE databases
- [ ] API key exposure — scan public endpoints for leaked keys/tokens in responses
- [ ] Container escape surface — probe for container metadata endpoints
- [ ] Agent permission overreach — audit tool permissions vs actual usage

### Scanner improvements
- [ ] Incremental scanning — only re-run checks that could have changed since last scan
- [ ] Custom check plugins — allow users to define and upload custom check definitions
- [ ] Scan diff — compare two scan results to show security posture changes over time

---

## v0.4.0 — Intelligence Platform

### Live intelligence
- [x] Auto-update intelligence data from OpenClaw release feeds (RSS/API)
- [x] CVE feed integration — auto-correlate new CVEs with scanned deployment versions
- [x] Community threat signals — aggregate anonymous scan findings into threat intelligence

### Alerting
- [ ] Email/webhook alerts when a monitored project's score drops below threshold
- [ ] New CVE alerts for dependencies detected in scans
- [ ] Intelligence board update notifications

---

## v0.5.0 — Enterprise Features

### Team & org
- [ ] Team workspaces — multiple users per organization
- [ ] Role-based access control (owner/admin/viewer)
- [ ] Audit log — track who scanned what and when

### Compliance
- [ ] Compliance report export (PDF) — mapped to OWASP, CIS benchmarks
- [ ] Scheduled recurring scans (daily/weekly) per project
- [ ] SLA dashboard — uptime and security posture over time

### Billing
- [ ] Pro tier — higher quotas, team features, priority scanning
- [ ] Enterprise tier — SSO, custom checks, dedicated support

---

## v0.6.0 — Extension & Integrations

### Browser extension
- [ ] Use `@panda-ai/ocs-core` instead of reimplemented detection logic
- [ ] Real-time badge score on visited OpenClaw deployments
- [ ] One-click deep scan from extension popup
- [ ] Sync scan history with web dashboard

### Integrations
- [ ] GitHub Actions integration — scan on PR/deploy
- [ ] Slack/Discord notifications
- [ ] Terraform provider — security policy as code

---

## Backlog (unscheduled)

- [ ] GraphQL API alongside REST
- [ ] Public API with API keys for third-party integrations
- [ ] Mobile-responsive dashboard redesign
- [ ] Localization (i18n) — Chinese, Japanese, Korean
- [ ] Self-hosted deployment option (Docker image)
- [ ] AI-powered remediation suggestions (Claude integration)
