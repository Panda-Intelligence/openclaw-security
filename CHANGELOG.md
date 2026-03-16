# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
