export interface DetectionResult {
  isOpenClaw: boolean;
  version: string | null;
  score: number | null;
  findings: QuickFinding[];
  detectedAt: number;
}

export interface QuickFinding {
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

export async function detectOpenClaw(origin: string): Promise<DetectionResult | null> {
  const result: DetectionResult = {
    isOpenClaw: false,
    version: null,
    score: null,
    findings: [],
    detectedAt: Date.now(),
  };

  // Step 1: Health check
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);

    const resp = await fetch(`${origin}/health`, { signal: controller.signal });
    clearTimeout(timer);

    if (resp.ok) {
      const data = await resp.json();
      if (data.status === 'ok') {
        result.isOpenClaw = true;
        result.version = data.version ?? null;
      }
    }
  } catch {
    return null; // Not reachable or not OpenClaw
  }

  if (!result.isOpenClaw) return result;

  // Step 2: Quick passive checks (top 5)
  let deductions = 0;

  // Check security headers
  try {
    const resp = await fetch(origin);
    const headers = Object.fromEntries([...resp.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));

    if (!headers['strict-transport-security']) {
      result.findings.push({ title: 'Missing HSTS header', severity: 'high' });
      deductions += 10;
    }
    if (!headers['content-security-policy']) {
      result.findings.push({ title: 'Missing CSP header', severity: 'high' });
      deductions += 10;
    }
    if (!headers['x-content-type-options']) {
      result.findings.push({ title: 'Missing X-Content-Type-Options', severity: 'high' });
      deductions += 10;
    }

    // CORS check
    const corsResp = await fetch(`${origin}/api/billing/plans`, {
      headers: { 'Origin': 'https://evil.example.com' },
    });
    const acao = corsResp.headers.get('access-control-allow-origin');
    if (acao === '*' || acao === 'https://evil.example.com') {
      result.findings.push({ title: 'Permissive CORS', severity: 'critical' });
      deductions += 20;
    }

    // Public endpoint check
    const adminResp = await fetch(`${origin}/api/billing/admin/credits/grant`);
    if (adminResp.ok) {
      result.findings.push({ title: 'Admin endpoint unprotected', severity: 'critical' });
      deductions += 20;
    }
  } catch { /* partial checks ok */ }

  result.score = Math.max(0, 100 - deductions);
  return result;
}
