# Security Policy

## Reporting vulnerabilities

If you discover a security vulnerability in OpenClaw Security, please report it responsibly.

**Do not open a public issue.** Instead, email security@pandacat.ai with:

1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if any)

We will acknowledge receipt within 48 hours and aim to provide a fix within 7 days for critical issues.

## Scope

This policy covers:

- The `scanner-core` library
- The `cli` tool
- The `web` application
- The browser `extension`

## Safe harbor

We consider security research conducted in good faith to be authorized. We will not pursue legal action against researchers who:

- Make a good faith effort to avoid privacy violations, data destruction, and service disruption
- Only interact with accounts they own or with explicit permission
- Report vulnerabilities promptly
- Do not publicly disclose vulnerabilities before a fix is available

## Known limitations

- The scanner performs read-only operations and does not attempt exploitation
- Active scans require user-provided JWT tokens which are never stored
- Community reports are anonymized (host + score only, no findings detail)
