# CORS Security for AI Agent APIs

Cross-Origin Resource Sharing (CORS) misconfigurations are the #2 most common issue we find in OpenClaw deployments. For AI agent APIs, the consequences are especially severe.

## Why CORS Matters More for Agent APIs

Traditional web apps expose CRUD endpoints. Agent APIs expose something far more dangerous: **the ability to instruct an AI to take actions on your behalf**. A CORS vulnerability on an agent API means an attacker's website can:

1. Read your agent configurations (model, system prompt)
2. Send messages as you to your agents
3. Access stored memories (potentially containing sensitive data)
4. Trigger skills that interact with external services

## The Three CORS Mistakes

### Mistake 1: Wildcard Origin

```
Access-Control-Allow-Origin: *
```

This allows any website to make requests to your API. If your API uses cookies or the attacker can obtain a token, they have full access.

### Mistake 2: Origin Reflection

```javascript
// DON'T DO THIS
const origin = request.headers.get('Origin');
response.headers.set('Access-Control-Allow-Origin', origin);
```

This reflects whatever origin the attacker sends, effectively allowing all origins while bypassing browser restrictions on `*` with credentials.

### Mistake 3: Credentials with Permissive Origins

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true
```

Browsers actually block this combination, but origin reflection + credentials is just as dangerous and works.

## The Correct Configuration

For OpenClaw deployments on Cloudflare Workers with Hono:

```typescript
import { cors } from 'hono/cors';

app.use('/api/*', cors({
  origin: ['https://your-console.example.com'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
```

Key principles:
- **Explicit origin allowlist** — never `*` or reflection
- **Minimal methods** — don't allow DELETE if you don't need it
- **Explicit headers** — only allow headers your frontend actually sends

## How We Test It

Our `cors-audit` check performs four tests:

1. **Wildcard detection** — sends request with `Origin: https://evil.example.com`, checks if ACAO is `*`
2. **Origin reflection** — checks if ACAO matches the arbitrary origin we sent
3. **Credential reflection** — checks if credentials are allowed with permissive origins
4. **Preflight abuse** — sends OPTIONS with destructive method + arbitrary origin

Each finding maps to [CWE-942: Permissive Cross-domain Policy](https://cwe.mitre.org/data/definitions/942.html).

## Testing Your Deployment

```bash
openclaw-security scan https://your-deployment.com --format json | jq '.findings[] | select(.checkId == "cors-audit")'
```

A passing score means your CORS policy is properly locked down.
