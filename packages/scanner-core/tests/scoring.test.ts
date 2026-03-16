import { describe, expect, test } from 'bun:test';
import { computeScore, countSeverities, setCheckCategory } from '../src/scoring';
import type { Finding, Severity } from '../src/types';

function makeFinding(checkId: string, severity: Severity): Finding {
  return {
    checkId,
    title: `Test finding: ${severity}`,
    description: 'test',
    severity,
    evidence: 'test',
    recommendation: 'test',
  };
}

describe('computeScore', () => {
  test('returns 100 for no findings', () => {
    expect(computeScore([])).toBe(100);
  });

  test('deducts 20 per critical', () => {
    setCheckCategory('test-check', 'auth');
    const findings = [makeFinding('test-check', 'critical')];
    expect(computeScore(findings)).toBe(80);
  });

  test('deducts 10 per high', () => {
    setCheckCategory('test-high', 'headers');
    const findings = [makeFinding('test-high', 'high')];
    expect(computeScore(findings)).toBe(90);
  });

  test('deducts 5 per medium', () => {
    setCheckCategory('test-medium', 'exposure');
    const findings = [makeFinding('test-medium', 'medium')];
    expect(computeScore(findings)).toBe(95);
  });

  test('deducts 2 per low', () => {
    setCheckCategory('test-low', 'config');
    const findings = [makeFinding('test-low', 'low')];
    expect(computeScore(findings)).toBe(98);
  });

  test('info findings do not deduct', () => {
    setCheckCategory('test-info', 'infrastructure');
    const findings = [makeFinding('test-info', 'info')];
    expect(computeScore(findings)).toBe(100);
  });

  test('caps per category', () => {
    setCheckCategory('cap-crit', 'auth');
    // 3 critical * 20 = 60, but cap is 40
    const findings = [
      makeFinding('cap-crit', 'critical'),
      makeFinding('cap-crit', 'critical'),
      makeFinding('cap-crit', 'critical'),
    ];
    expect(computeScore(findings)).toBe(60); // 100 - 40 (capped)
  });

  test('multiple severities across categories', () => {
    setCheckCategory('multi-a', 'auth');
    setCheckCategory('multi-b', 'headers');
    const findings = [
      makeFinding('multi-a', 'critical'), // -20 in auth
      makeFinding('multi-b', 'high'), // -10 in headers
    ];
    expect(computeScore(findings)).toBe(70);
  });

  test('never goes below 0', () => {
    setCheckCategory('floor-a', 'auth');
    setCheckCategory('floor-b', 'headers');
    setCheckCategory('floor-c', 'exposure');
    setCheckCategory('floor-d', 'config');
    setCheckCategory('floor-e', 'data');
    // Stack up maximum deductions across multiple categories
    const findings = [
      ...Array(3)
        .fill(null)
        .map(() => makeFinding('floor-a', 'critical')),
      ...Array(4)
        .fill(null)
        .map(() => makeFinding('floor-b', 'high')),
      ...Array(5)
        .fill(null)
        .map(() => makeFinding('floor-c', 'medium')),
      ...Array(6)
        .fill(null)
        .map(() => makeFinding('floor-d', 'medium')),
      ...Array(10)
        .fill(null)
        .map(() => makeFinding('floor-e', 'high')),
    ];
    const score = computeScore(findings);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('countSeverities', () => {
  test('returns zero counts for empty', () => {
    const counts = countSeverities([]);
    expect(counts).toEqual({ critical: 0, high: 0, medium: 0, low: 0, info: 0 });
  });

  test('counts each severity', () => {
    const findings = [
      makeFinding('a', 'critical'),
      makeFinding('a', 'critical'),
      makeFinding('b', 'high'),
      makeFinding('c', 'medium'),
      makeFinding('d', 'low'),
      makeFinding('e', 'info'),
      makeFinding('e', 'info'),
      makeFinding('e', 'info'),
    ];
    const counts = countSeverities(findings);
    expect(counts.critical).toBe(2);
    expect(counts.high).toBe(1);
    expect(counts.medium).toBe(1);
    expect(counts.low).toBe(1);
    expect(counts.info).toBe(3);
  });
});
