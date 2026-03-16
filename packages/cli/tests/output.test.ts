import { describe, expect, test } from 'bun:test';
import type { ScanResult } from '@openclaw-security/scanner-core';
import { printTable } from '../src/output/table';

function makeScanResult(overrides?: Partial<ScanResult>): ScanResult {
  return {
    id: 'cli-test',
    targetUrl: 'https://example.com',
    mode: 'passive',
    status: 'completed',
    startedAt: '2026-03-16T00:00:00Z',
    completedAt: '2026-03-16T00:00:05Z',
    score: 75,
    severityCounts: { critical: 1, high: 2, medium: 1, low: 0, info: 0 },
    findings: [
      {
        checkId: 'cors-audit',
        title: 'Wildcard CORS',
        description: 'CORS allows all',
        severity: 'critical',
        evidence: 'ACAO: *',
        recommendation: 'Fix CORS',
      },
      {
        checkId: 'security-headers',
        title: 'Missing CSP',
        description: 'No CSP',
        severity: 'high',
        evidence: 'No header',
        recommendation: 'Add CSP',
      },
    ],
    checkResults: [
      { checkId: 'cors-audit', status: 'fail', findings: [], durationMs: 120 },
      { checkId: 'security-headers', status: 'fail', findings: [], durationMs: 85 },
      { checkId: 'tls-analysis', status: 'pass', findings: [], durationMs: 200 },
    ],
    platformInfo: {
      version: '0.3.0',
      service: 'web',
      isOpenClaw: true,
      detectedProviders: ['cloudflare'],
      planTier: null,
    },
    ...overrides,
  };
}

describe('CLI output', () => {
  test('printTable does not throw', () => {
    // Capture console.log to verify output
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    printTable(makeScanResult());

    console.log = originalLog;

    const output = logs.join('\n');
    expect(output).toContain('OpenClaw Security Report');
    expect(output).toContain('75/100');
    expect(output).toContain('example.com');
    expect(output).toContain('Wildcard CORS');
    expect(output).toContain('cors-audit');
  });

  test('printTable handles no findings', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    printTable(
      makeScanResult({
        findings: [],
        severityCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        score: 100,
      }),
    );

    console.log = originalLog;

    const output = logs.join('\n');
    expect(output).toContain('all checks passed');
  });

  test('printTable shows check results', () => {
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));

    printTable(makeScanResult());

    console.log = originalLog;

    const output = logs.join('\n');
    expect(output).toContain('Check Results');
    expect(output).toContain('cors-audit');
    expect(output).toContain('tls-analysis');
  });
});
