# Introducing OpenClaw Security

OpenClaw Security is an open-source security audit platform purpose-built for [OpenClaw Cloud](https://github.com/openclaw) deployments. Think of it as Lighthouse meets Wappalyzer — but for AI agent infrastructure.

## Why AI Agent Security Matters

As AI agents move from prototypes to production, their attack surface grows dramatically. An agent deployment isn't just a web app — it's a system prompt, a set of skills, stored memories, scheduled tasks, and multi-channel integrations, all running in containers with access to LLM APIs.

A misconfigured deployment can lead to:

- **Prompt injection** via stored memories
- **Credential leakage** through unprotected API endpoints
- **Cost explosion** from unmonitored high-frequency schedules
- **Data exfiltration** via permissive CORS policies

## What We Scan

OpenClaw Security runs **20 automated checks** across two modes:

### Passive Scans (no auth required)
14 checks that probe public-facing endpoints: security headers, CORS policy, TLS configuration, rate limiting, public endpoint exposure, error disclosure, and more.

### Active Scans (JWT-paired)
6 additional checks that audit your agent configuration: JWT security, system prompt review, memory injection detection, skill source validation, schedule frequency analysis, and channel credential status.

## Scoring

Every scan produces a **0-100 security score** using a penalty-based algorithm. Critical findings deduct 20 points each (capped at 40 per category), while informational findings have zero impact.

## Get Started

```bash
bun install
bun run scan https://your-deployment.example.com
```

Or visit the web dashboard and paste your URL. It takes about 5 seconds.
