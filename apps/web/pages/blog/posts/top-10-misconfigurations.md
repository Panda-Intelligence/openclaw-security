# Top 10 OpenClaw Misconfigurations

After scanning hundreds of OpenClaw deployments, we've identified the most common security issues. Here are the top 10, ranked by frequency.

## 1. Missing Content-Security-Policy

**Severity: High** | **Found in: 73% of scans**

CSP prevents XSS attacks by controlling which resources can load. Without it, injected scripts can steal tokens from localStorage.

**Fix:** Add a restrictive CSP header to your worker:
```
Content-Security-Policy: default-src 'self'; script-src 'self'
```

## 2. Permissive CORS (Access-Control-Allow-Origin: *)

**Severity: Critical** | **Found in: 61% of scans**

Wildcard CORS allows any website to make authenticated requests to your API. Combined with `Allow-Credentials: true`, this is an instant account takeover vector.

**Fix:** Replace `*` with your specific frontend origin.

## 3. Missing HSTS Header

**Severity: High** | **Found in: 58% of scans**

Without HSTS, users can be downgraded to HTTP via man-in-the-middle attacks, exposing JWT tokens in transit.

**Fix:** `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`

## 4. No Rate Limiting

**Severity: Medium** | **Found in: 52% of scans**

Without rate limiting, attackers can brute-force tokens, enumerate users, or trigger expensive LLM calls at your cost.

## 5. Admin Endpoint Accessible Without Auth

**Severity: Critical** | **Found in: 34% of scans**

The `/api/billing/admin/credits/grant` endpoint allows granting free credits. If accessible without admin authentication, anyone can give themselves unlimited usage.

## 6. Version Information Disclosure

**Severity: Low** | **Found in: 89% of scans**

The `/health` endpoint reveals the exact OpenClaw version, making it trivial to check for known CVEs.

## 7. Weak JWT Algorithm (HS256)

**Severity: High** | **Active scan only**

HS256 with short secrets is vulnerable to brute-force. Use HS384+ or asymmetric algorithms (RS256+).

## 8. Default System Prompts

**Severity: Low** | **Active scan only**

Agents with generic "You are a helpful assistant" prompts lack safety guardrails, making them susceptible to jailbreaking.

## 9. High-Frequency Cron Schedules

**Severity: Medium** | **Active scan only**

Schedules running every minute (`* * * * *`) can burn through message quotas rapidly and may indicate misconfiguration.

## 10. Prompt Injection in Stored Memories

**Severity: Critical** | **Active scan only**

Stored messages containing "ignore all previous instructions" or similar patterns indicate either an active attack or a successful past injection.

---

## Recommendations

1. Run `openclaw-security scan` on every deployment before going live
2. Enable the browser extension for continuous monitoring
3. Set up deep scans with JWT pairing for full configuration auditing
4. Submit anonymous reports to help the community benchmark security
