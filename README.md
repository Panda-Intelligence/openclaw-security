# OpenClaw Security

[![CI](https://github.com/openclaw/openclaw-security/actions/workflows/ci.yml/badge.svg)](https://github.com/openclaw/openclaw-security/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](tsconfig.base.json)

Security audit platform for [OpenClaw Cloud](https://github.com/openclaw) deployments. Think Lighthouse + Wappalyzer, but for AI agent infrastructure.

Paste a URL, get a structured security report — no auth required for passive scans, JWT-paired deep scans for full config auditing.

## Features

- **20 security checks** — 14 passive (headers, CORS, TLS, endpoints, error disclosure) + 6 active (JWT, agent config, memory injection, skills, schedules, channels)
- **Penalty-based scoring** — 0-100 score with per-category caps
- **Multiple interfaces** — Web dashboard, CLI tool, browser extension
- **Community reports** — Anonymous aggregated security data

## Quick start

```bash
# Install
bun install

# Run all tests
bun test

# CLI scan
bun run packages/cli/src/index.ts scan https://your-deployment.example.com

# Web dashboard (dev)
cd apps/web && bun run dev:ui
```

## Packages

| Package | Description |
|---------|-------------|
| [`packages/scanner-core`](packages/scanner-core) | Shared scanning engine — types, checks, scoring, HTTP client, report formatter |
| [`packages/cli`](packages/cli) | CLI tool — `openclaw-security scan <url>` |
| [`apps/web`](apps/web) | Cloudflare Worker + React SPA dashboard |
| [`apps/extension`](apps/extension) | Browser extension (Manifest V3) |

## Scan modes

### Passive (no auth required)

Probes public-facing endpoints and HTTP headers:

| Check | What it tests |
|-------|--------------|
| `health-fingerprint` | OpenClaw detection via `/health` |
| `version-cve` | Version matched against known CVEs |
| `security-headers` | CSP, HSTS, X-Content-Type-Options, etc. |
| `cors-audit` | Wildcard origins, credential reflection |
| `rate-limit-probe` | Rate limiting headers presence |
| `oauth-enumeration` | OAuth provider detection |
| `public-endpoint-scan` | Protected endpoints accessible without auth |
| `tls-analysis` | HTTPS, certificate, HTTP→HTTPS redirect |
| `cookie-audit` | Secure, HttpOnly, SameSite attributes |
| `websocket-exposure` | Unauthenticated WebSocket access |
| `admin-endpoint-probe` | Admin endpoints without authentication |
| `error-disclosure` | Stack traces in error responses |
| `hsts-preload` | HSTS preload readiness |
| `container-version` | Web/runtime worker version consistency |

### Active (JWT required)

Reads agent configuration via authenticated API calls (GET only, read-only):

| Check | What it tests |
|-------|--------------|
| `jwt-security` | Algorithm strength, claims, expiration |
| `agent-config-review` | Failed agents, model exposure, prompt secrets |
| `memory-injection-scan` | Prompt injection patterns in stored memories |
| `skill-audit` | Non-bundled skills, insecure sources |
| `schedule-review` | High-frequency crons, sensitive prompts |
| `channel-credential-status` | Missing/invalid channel credentials |

## CLI usage

```bash
# Passive scan (default)
openclaw-security scan https://example.com

# Active scan with JWT
openclaw-security scan https://example.com --deep
openclaw-security scan https://example.com --token <jwt>

# Output formats
openclaw-security scan https://example.com --format json
openclaw-security scan https://example.com --format markdown

# Save report
openclaw-security scan https://example.com --output report.json

# View saved report
openclaw-security report report.json

# Upload anonymized results
openclaw-security upload report.json
```

## Scoring

Penalty-based from 100. Deductions per finding:

| Severity | Per-finding | Category cap |
|----------|------------|-------------|
| Critical | -20 | -40 |
| High | -10 | -30 |
| Medium | -5 | -20 |
| Low | -2 | -10 |
| Info | 0 | 0 |

Categories: `auth`, `headers`, `exposure`, `config`, `data`, `infrastructure`

## Development

```bash
bun install                          # Install dependencies
bun test                             # Run all 121 tests
bunx tsc --noEmit -p <pkg>/tsconfig.json  # Type check a package
cd apps/web && bun run dev:ui        # Web dev server
cd apps/web && bun run build         # Build frontend
```

## Tech stack

- **Runtime**: Bun, Cloudflare Workers, D1, Queues
- **Framework**: Hono (API), React (UI)
- **Language**: TypeScript (strict mode + noUncheckedIndexedAccess)
- **Testing**: bun:test
- **Monorepo**: bun workspaces

## License

MIT
