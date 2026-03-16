import { describe, expect, test } from 'bun:test';
import { runChecks } from '../src/check-runner';
import type { CheckContext, CheckDefinition, CheckResult } from '../src/types';

function makeCtx(): CheckContext {
  return {
    config: { targetUrl: 'https://example.com', mode: 'passive' },
    httpClient: {
      get: async () => ({ status: 200, headers: {}, body: '', url: '', redirects: [], durationMs: 0 }),
      post: async () => ({ status: 200, headers: {}, body: '', url: '', redirects: [], durationMs: 0 }),
      options: async () => ({ status: 200, headers: {}, body: '', url: '', redirects: [], durationMs: 0 }),
    },
    platformInfo: { version: null, service: null, isOpenClaw: true, detectedProviders: [], planTier: null },
  };
}

function makeCheck(id: string, opts?: { dependsOn?: string[]; delay?: number; shouldFail?: boolean }): CheckDefinition {
  return {
    id,
    name: id,
    description: 'test',
    mode: 'passive',
    category: 'headers',
    dependsOn: opts?.dependsOn,
    run: async (): Promise<CheckResult> => {
      if (opts?.delay) await new Promise((r) => setTimeout(r, opts.delay));
      if (opts?.shouldFail) throw new Error('Check failed');
      return { checkId: id, status: 'pass', findings: [], durationMs: 0 };
    },
  };
}

describe('runChecks', () => {
  test('runs all checks and returns results', async () => {
    const checks = [makeCheck('run-a'), makeCheck('run-b'), makeCheck('run-c')];
    const results = await runChecks(checks, makeCtx());
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.status === 'pass')).toBe(true);
  });

  test('respects dependency order', async () => {
    const order: string[] = [];
    const checks: CheckDefinition[] = [
      {
        ...makeCheck('dep-b', { dependsOn: ['dep-a'] }),
        run: async () => {
          order.push('dep-b');
          return { checkId: 'dep-b', status: 'pass', findings: [], durationMs: 0 };
        },
      },
      {
        ...makeCheck('dep-a'),
        run: async () => {
          order.push('dep-a');
          return { checkId: 'dep-a', status: 'pass', findings: [], durationMs: 0 };
        },
      },
    ];
    await runChecks(checks, makeCtx());
    expect(order.indexOf('dep-a')).toBeLessThan(order.indexOf('dep-b'));
  });

  test('handles check errors gracefully', async () => {
    const checks = [makeCheck('err-check', { shouldFail: true })];
    const results = await runChecks(checks, makeCtx());
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe('error');
  });

  test('records durationMs', async () => {
    const checks = [makeCheck('timing-check', { delay: 50 })];
    const results = await runChecks(checks, makeCtx());
    expect(results[0].durationMs).toBeGreaterThanOrEqual(40);
  });

  test('concurrency limits parallel execution', async () => {
    let maxParallel = 0;
    let current = 0;

    const checks = Array.from({ length: 6 }, (_, i) => ({
      ...makeCheck(`conc-${i}`),
      run: async (): Promise<CheckResult> => {
        current++;
        maxParallel = Math.max(maxParallel, current);
        await new Promise((r) => setTimeout(r, 20));
        current--;
        return { checkId: `conc-${i}`, status: 'pass' as const, findings: [], durationMs: 0 };
      },
    }));

    await runChecks(checks, makeCtx(), 3);
    expect(maxParallel).toBeLessThanOrEqual(3);
  });
});
