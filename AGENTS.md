# Repository Guidelines

## Project Structure & Module Organization

This repository is a Bun workspace monorepo. Core scanning logic lives in `packages/scanner-core/src`; its tests live in `packages/scanner-core/tests`. The CLI entrypoint is `packages/cli/src/index.ts` with tests in `packages/cli/tests`. App code is split between `apps/web` (Cloudflare Worker API + React UI) and `apps/extension` (browser extension). Shared project configuration sits at the root in `biome.json`, `tsconfig.base.json`, and `.editorconfig`.

## Build, Test, and Development Commands

- `bun install` — install workspace dependencies.
- `bun run dev` — start the web UI (`apps/web`, Vite on `:5173`).
- `bun run dev:worker` — start the Cloudflare Worker API locally (`wrangler` on `:8787`).
- `bun run scan https://example.com` — run the CLI scanner against a target.
- `bun run build` — build all workspaces.
- `bun test` — run the full test suite.
- `bun run typecheck` — run TypeScript checks across all packages/apps.
- `bun run lint` / `bun run format` — lint or format with Biome.
- `bun run db:migrate:local` — apply local D1 migrations for `apps/web`.

## Coding Style & Naming Conventions

Use TypeScript with 2-space indentation, LF line endings, single quotes, semicolons, and a 120-character line width. Follow Biome formatting and lint rules before opening a PR. Prefer `type` imports when possible, avoid unused imports, and do not add `.js` extensions to TypeScript imports. Keep filenames descriptive and aligned with existing patterns such as `check-runner.ts`, `jwt-analyzer.ts`, and `routes.test.ts`.

## Testing Guidelines

Tests use `bun:test`. Place tests in the nearest `tests/` directory and use the `*.test.ts` suffix. Cover new scanner checks with focused unit tests plus integration coverage when behavior crosses package boundaries. For scanner additions, register the check in `packages/scanner-core/src/checks/index.ts` and verify with `bun test` and `bun run typecheck`.

## Commit & Pull Request Guidelines

Use Conventional Commits, matching recent history: `feat:`, `fix:`, `chore:`, `docs:`, `test:`. Keep each commit scoped to one change. PRs should follow `.github/PULL_REQUEST_TEMPLATE.md`: include a short summary, key changes, change type, and confirm `bun run typecheck`, `bun run lint`, and `bun test` all pass. Include screenshots for UI changes and link related issues when applicable.

## Configuration & Security Notes

Use `apps/web/.dev.vars.example` as the template for local secrets; never commit populated `.dev.vars` files or tokens. Store database schema changes in `apps/web/migrations/`.
