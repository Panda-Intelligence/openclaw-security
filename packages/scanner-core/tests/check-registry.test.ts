import { describe, test, expect, beforeEach } from 'bun:test';
import { registerCheck, getCheck, getAllChecks, getChecksByMode, topoSort } from '../src/check-registry.js';
import type { CheckDefinition, CheckResult } from '../src/types.js';

// We need a fresh registry for some tests, but registry is module-level.
// Tests that need isolation use unique IDs.

function makeCheck(overrides: Partial<CheckDefinition> & { id: string }): CheckDefinition {
  return {
    name: overrides.id,
    description: 'test check',
    mode: 'passive',
    category: 'headers',
    run: async (): Promise<CheckResult> => ({
      checkId: overrides.id,
      status: 'pass',
      findings: [],
      durationMs: 0,
    }),
    ...overrides,
  };
}

describe('check-registry', () => {
  test('registerCheck and getCheck', () => {
    const check = makeCheck({ id: 'reg-test-1' });
    registerCheck(check);
    expect(getCheck('reg-test-1')).toBe(check);
  });

  test('duplicate ID throws', () => {
    const check = makeCheck({ id: 'dup-test-1' });
    registerCheck(check);
    expect(() => registerCheck(check)).toThrow('Duplicate');
  });

  test('getAllChecks includes registered', () => {
    registerCheck(makeCheck({ id: 'all-test-1' }));
    const all = getAllChecks();
    expect(all.some((c) => c.id === 'all-test-1')).toBe(true);
  });

  test('getChecksByMode filters correctly', () => {
    registerCheck(makeCheck({ id: 'mode-passive-1', mode: 'passive' }));
    registerCheck(makeCheck({ id: 'mode-active-1', mode: 'active' }));

    const passive = getChecksByMode('passive');
    const active = getChecksByMode('active');

    expect(passive.some((c) => c.id === 'mode-passive-1')).toBe(true);
    expect(passive.some((c) => c.id === 'mode-active-1')).toBe(false);
    expect(active.some((c) => c.id === 'mode-active-1')).toBe(true);
  });
});

describe('topoSort', () => {
  test('sorts independent checks in registration order', () => {
    const checks = [
      makeCheck({ id: 'topo-a' }),
      makeCheck({ id: 'topo-b' }),
      makeCheck({ id: 'topo-c' }),
    ];
    const sorted = topoSort(checks);
    expect(sorted.map((c) => c.id)).toEqual(['topo-a', 'topo-b', 'topo-c']);
  });

  test('respects dependencies', () => {
    const checks = [
      makeCheck({ id: 'topo-dep-b', dependsOn: ['topo-dep-a'] }),
      makeCheck({ id: 'topo-dep-a' }),
    ];
    const sorted = topoSort(checks);
    const ids = sorted.map((c) => c.id);
    expect(ids.indexOf('topo-dep-a')).toBeLessThan(ids.indexOf('topo-dep-b'));
  });

  test('handles chain dependencies', () => {
    const checks = [
      makeCheck({ id: 'topo-chain-c', dependsOn: ['topo-chain-b'] }),
      makeCheck({ id: 'topo-chain-b', dependsOn: ['topo-chain-a'] }),
      makeCheck({ id: 'topo-chain-a' }),
    ];
    const sorted = topoSort(checks);
    const ids = sorted.map((c) => c.id);
    expect(ids.indexOf('topo-chain-a')).toBeLessThan(ids.indexOf('topo-chain-b'));
    expect(ids.indexOf('topo-chain-b')).toBeLessThan(ids.indexOf('topo-chain-c'));
  });

  test('throws on cycle', () => {
    const checks = [
      makeCheck({ id: 'cycle-a', dependsOn: ['cycle-b'] }),
      makeCheck({ id: 'cycle-b', dependsOn: ['cycle-a'] }),
    ];
    expect(() => topoSort(checks)).toThrow('Cycle');
  });

  test('ignores unknown dependencies', () => {
    const checks = [
      makeCheck({ id: 'unknown-dep', dependsOn: ['nonexistent'] }),
    ];
    const sorted = topoSort(checks);
    expect(sorted).toHaveLength(1);
  });
});
