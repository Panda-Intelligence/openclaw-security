import type { CheckDefinition, ScanMode } from './types.js';

const registry = new Map<string, CheckDefinition>();

export function registerCheck(check: CheckDefinition): void {
  if (registry.has(check.id)) {
    throw new Error(`Duplicate check ID: ${check.id}`);
  }
  registry.set(check.id, check);
}

export function getCheck(id: string): CheckDefinition | undefined {
  return registry.get(id);
}

export function getAllChecks(): CheckDefinition[] {
  return Array.from(registry.values());
}

export function getChecksByMode(mode: ScanMode): CheckDefinition[] {
  return getAllChecks().filter((c) => c.mode === mode);
}

/** Topological sort — returns checks in dependency order. Throws on cycles. */
export function topoSort(checks: CheckDefinition[]): CheckDefinition[] {
  const graph = new Map<string, string[]>();
  const checkMap = new Map<string, CheckDefinition>();

  for (const c of checks) {
    checkMap.set(c.id, c);
    graph.set(c.id, c.dependsOn ?? []);
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const sorted: CheckDefinition[] = [];

  function visit(id: string): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Cycle detected involving check: ${id}`);

    visiting.add(id);
    for (const dep of graph.get(id) ?? []) {
      if (checkMap.has(dep)) visit(dep);
    }
    visiting.delete(id);
    visited.add(id);

    const check = checkMap.get(id);
    if (check) sorted.push(check);
  }

  for (const id of checkMap.keys()) visit(id);
  return sorted;
}
