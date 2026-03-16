# CLAUDE.md

## Commands

```bash
bun install              # Install all workspace dependencies
bun test                 # Run all tests
bun run build            # Build all packages

# Scanner Core
cd packages/scanner-core && bun test

# CLI
cd packages/cli && bun run src/index.ts scan <url>
cd packages/cli && bun run src/index.ts scan <url> --deep

# Web App
cd apps/web && bun run dev
cd apps/web && bunx wrangler deploy

# Extension
cd apps/extension && bun run build
```

## Architecture

**OpenClaw Security** — Security audit platform for OpenClaw Cloud deployments.

### Monorepo structure (bun workspaces)

- `packages/scanner-core` — Shared scanning engine (types, checks, scoring, report formatting)
- `packages/cli` — CLI tool (`openclaw-security scan <url>`)
- `apps/web` — Cloudflare Worker + React SPA dashboard
- `apps/extension` — Browser extension (Manifest V3, Wappalyzer-style detection)

### Scan pipeline

```
ScanConfig → validate → health-fingerprint → parallel passive checks → (optional) active checks → score → ScanResult
```

### Two scan modes

1. **Passive** (14 checks) — No auth required. Probes public endpoints, headers, TLS, CORS, etc.
2. **Active** (6 checks) — Requires JWT. Audits agent config, memory, skills, schedules, channels.

## Conventions

- **Package manager**: bun
- **TypeScript strict mode**
- **Tests**: Vitest / bun test
- **API responses**: Hono + `ApiResponse<T>` wrapper
- **Scoring**: Penalty-based 0-100 (deductions per severity)
- **Check files**: Each exports a `CheckDefinition` object
