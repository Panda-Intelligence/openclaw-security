# CLAUDE.md

## Commands

```bash
bun install              # Install all workspace dependencies
bun test                 # Run all tests (198 tests)
bun run typecheck        # Type check all 4 packages
bun run lint             # Biome lint
bun run ci               # Full CI: typecheck + lint + test

# ── Local dev ──
bun run dev              # Web dashboard (Vite dev server, port 5173)
bun run dev:worker       # Wrangler dev (API + D1, port 8787)
bun run scan <url>       # CLI scan shortcut

# ── Database ──
bun run db:create            # Create D1 database (first time, production)
bun run db:migrate:local     # Apply migrations locally
bun run db:migrate:remote    # Apply migrations to production

# ── CLI ──
bun run packages/cli/src/index.ts scan <url>
bun run packages/cli/src/index.ts scan <url> --deep --format json

# ── Build ──
bun run build            # Build all packages
cd apps/web && bun run build    # Build web frontend only

# ── Deploy ──
cd apps/web && bun run deploy   # Build + deploy to Cloudflare
```

## Local development

### Quick start (CLI only — no infra needed)

```bash
bun install
bun run scan https://example.com
```

### Full stack (Web dashboard + API)

```bash
bun install
bun run db:migrate:local         # Create D1 tables
bun run dev:worker &             # Start API on :8787
bun run dev                      # Start UI on :5173 (proxies /api → :8787)
```

Open http://localhost:5173 — paste a URL → scan.

## Architecture

**OpenClaw Security** — Security audit platform for OpenClaw Cloud deployments.

### Monorepo structure (bun workspaces)

- `packages/scanner-core` — Shared scanning engine (types, checks, scoring, report formatting)
- `packages/cli` — CLI tool (`openclaw-security scan <url>`)
- `apps/web` — Cloudflare Worker + React SPA dashboard (D1, Queues, Stripe billing)
- `apps/extension` — Browser extension (Manifest V3, auto-detection)

### Web app layers

1. **Frontend** (`pages/`) — React SPA with client-side routing. Key pages: scan form, reports, dashboard, intelligence board, community, blog, pricing.
2. **API** (`src/api/`) — Hono routes: scans, reports, projects, billing, auth (Google/GitHub OAuth), community + intelligence.
3. **Intelligence** (`src/intelligence.ts`) — Curated security intelligence data (5 boards, 15 items) sourced from official OpenClaw docs.
4. **Data** (`src/state/schema.sql`) — D1 schema: scans, findings, community_reports, users, subscriptions, projects, billing_events.
5. **Middleware** (`src/middleware/`) — Rate limiting, Zod input validation.

### Environments

```bash
wrangler dev                           # Local (reads .dev.vars for secrets)
wrangler deploy --env staging          # Staging (staging.security.pandacat.ai)
wrangler deploy --env production       # Production (security.pandacat.ai)
```

### Scan pipeline

```
ScanConfig → validate → health-fingerprint → parallel passive checks → (optional) active checks → score → ScanResult
```

### Two scan modes

1. **Passive** (14 checks) — No auth required. Probes public endpoints, headers, TLS, CORS, etc.
2. **Active** (6 checks) — Requires JWT. Audits agent config, memory, skills, schedules, channels.

## Conventions

- **Package manager**: bun (not npm/yarn)
- **TypeScript strict mode** + noUncheckedIndexedAccess
- **No .js import extensions** — bun bundler resolution
- **No `any` in source code** — only in test mocks
- **Tests**: bun:test
- **Lint/Format**: Biome
- **API responses**: Hono + `ApiResponse<T>` wrapper
- **Scoring**: Penalty-based 0-100 (deductions per severity)
- **Check files**: Each exports a `CheckDefinition` object
