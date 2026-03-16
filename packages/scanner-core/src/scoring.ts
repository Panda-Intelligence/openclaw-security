import type { Finding, Severity, CheckCategory } from './types.js';

const PENALTY: Record<Severity, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
  info: 0,
};

const CATEGORY_CAP: Record<Severity, number> = {
  critical: 40,
  high: 30,
  medium: 20,
  low: 10,
  info: 0,
};

/** Map checkId → category. Populated by checks at registration time via `scoring.setCheckCategory`. */
const checkCategoryMap = new Map<string, CheckCategory>();

export function setCheckCategory(checkId: string, category: CheckCategory): void {
  checkCategoryMap.set(checkId, category);
}

export function computeScore(findings: Finding[]): number {
  // Group penalties by category
  const categoryPenalties = new Map<string, Map<Severity, number>>();

  for (const f of findings) {
    const cat = checkCategoryMap.get(f.checkId) ?? 'exposure';
    if (!categoryPenalties.has(cat)) categoryPenalties.set(cat, new Map());
    const sevMap = categoryPenalties.get(cat)!;
    sevMap.set(f.severity, (sevMap.get(f.severity) ?? 0) + PENALTY[f.severity]);
  }

  let totalDeduction = 0;

  for (const sevMap of categoryPenalties.values()) {
    for (const [severity, rawPenalty] of sevMap) {
      const capped = Math.min(rawPenalty, CATEGORY_CAP[severity as Severity]);
      totalDeduction += capped;
    }
  }

  return Math.max(0, 100 - totalDeduction);
}

export function countSeverities(findings: Finding[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity]++;
  return counts;
}
