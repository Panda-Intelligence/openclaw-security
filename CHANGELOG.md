# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-03-17

### Added

- **Intelligence Board**: Curated security intelligence with 5 boards (marketplace skills, release/dependency watch, install hardening, LLM runtime, gateway exposure) — 15 items sourced from official OpenClaw docs
  - 6 public API endpoints (`/api/community/intelligence/*`)
  - Full-page frontend with risk-level filtering, search, and source attribution
  - SEO: robots.txt, sitemap.xml, schema.org structured data
- **Blog**: 3 new research posts — marketplace skill security, release/dependency watch, LLM runtime checklist
- **Community Stats**: Aggregate stats, score distribution, severity breakdown, 30-day trend, leaderboard
- **Multi-environment deploy**: wrangler.toml with `[env.production]` and `[env.staging]`, secrets in `.dev.vars`
- **Extension build pipeline**: `bun run build` script producing loadable `dist/`, placeholder PNG icons
- 77 new tests (198 total): billing/webhook signature verification, rate limiting, Zod validation, auth utils, route handlers (projects, community, reports), worker (robots/sitemap/ASSETS guard)

### Security

- **Stripe webhook**: HMAC-SHA256 signature verification with timing-safe comparison + 5-min timestamp tolerance
- **Reports API**: user_id ownership check (403 on unauthorized access)
- **Scans API**: user_id ownership check on `GET /api/scans/:id`
- **Auth/me bypass**: `/api/auth/me` now correctly requires authentication
- **OAuth CSRF**: State parameter signed with HMAC-SHA256, verified on callback with 10-min expiry
- **Blog XSS**: HTML escaping before markdown-to-HTML conversion
- **CORS**: Origin restricted to `*.pandacat.ai` + localhost (was `*`)
- **Rate limiting**: IP-based fixed-window middleware on auth (15/min), webhook (100/min), scans (20/min), community (30/min)
- **Input validation**: Zod schemas on all POST routes (scans, projects, billing, community)

### Changed

- Package renamed to `@panda-ai/ocs-*`
- Domain updated to `pandacat.ai`
- `schema.sql` synced with all 7 tables + indexes
- RS256 removed from weak algorithm list in JWT analyzer (acceptable, not weak)
- CLI `critical` severity now uses `bgRed+white` (was identical to `high`)
- `HttpResponse.redirects` now populated when fetch follows a redirect

### Removed

- Dead code: unused `router.ts`, CLI `json.ts`/`markdown.ts` output files, `SUBSCRIPTION_TRANSITIONS` constant
- Duplicate `Env` interface in auth utils

## [0.1.0] - 2026-03-16

### Added

- **scanner-core**: 20 security checks (14 passive + 6 active)
  - Passive: health-fingerprint, version-cve, security-headers, cors-audit, rate-limit-probe, oauth-enumeration, public-endpoint-scan, tls-analysis, cookie-audit, websocket-exposure, admin-endpoint-probe, error-disclosure, hsts-preload, container-version
  - Active: jwt-security, agent-config-review, memory-injection-scan, skill-audit, schedule-review, channel-credential-status
- **scanner-core**: Penalty-based scoring engine (0-100) with per-category caps
- **scanner-core**: HTTP client with timeout, JWT attachment, redirect tracking
- **scanner-core**: JWT analyzer (decode, algorithm audit, claims audit)
- **scanner-core**: Known version + CVE database
- **scanner-core**: Report formatter (JSON, Markdown, HTML)
- **cli**: `scan`, `report`, `upload` commands with colored terminal output
- **web**: Cloudflare Worker + React SPA dashboard
- **web**: D1 database schema with scans, findings, community_reports tables
- **web**: Queue-based async scan execution
- **extension**: Manifest V3 browser extension with auto-detection
- 121 unit + integration tests
- Biome linting and formatting
- GitHub Actions CI pipeline
