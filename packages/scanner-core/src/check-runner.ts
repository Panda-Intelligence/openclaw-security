import { topoSort } from './check-registry';
import type { CheckContext, CheckDefinition, CheckResult } from './types';

export async function runChecks(
  checks: CheckDefinition[],
  ctx: CheckContext,
  concurrency: number = 5,
): Promise<CheckResult[]> {
  const sorted = topoSort(checks);
  const results: CheckResult[] = [];
  const completed = new Set<string>();
  const pending = new Set(sorted.map((c) => c.id));

  while (pending.size > 0) {
    // Find checks whose dependencies are all satisfied
    const ready: CheckDefinition[] = [];
    for (const check of sorted) {
      if (!pending.has(check.id)) continue;
      const deps = check.dependsOn ?? [];
      if (deps.every((d) => completed.has(d) || !pending.has(d))) {
        ready.push(check);
        if (ready.length >= concurrency) break;
      }
    }

    if (ready.length === 0) {
      // Remaining checks have circular or unsatisfied deps — skip them
      for (const check of sorted) {
        if (pending.has(check.id)) {
          results.push({
            checkId: check.id,
            status: 'skipped',
            findings: [],
            durationMs: 0,
          });
          pending.delete(check.id);
        }
      }
      break;
    }

    const batchResults = await Promise.all(ready.map((check) => executeCheck(check, ctx)));

    for (const result of batchResults) {
      results.push(result);
      completed.add(result.checkId);
      pending.delete(result.checkId);
    }
  }

  return results;
}

async function executeCheck(check: CheckDefinition, ctx: CheckContext): Promise<CheckResult> {
  const start = performance.now();
  const timeout = ctx.config.timeout ?? 15000;
  let timer: ReturnType<typeof setTimeout>;

  try {
    const result = await Promise.race([
      check.run(ctx),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Check timeout')), timeout);
      }),
    ]);
    clearTimeout(timer!);
    return { ...result, durationMs: Math.round(performance.now() - start) };
  } catch {
    clearTimeout(timer!);
    return {
      checkId: check.id,
      status: 'error',
      findings: [],
      durationMs: Math.round(performance.now() - start),
    };
  }
}
