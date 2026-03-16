import { describe, test, expect } from 'bun:test';
import { formatReport } from '../src/report-formatter.js';
import type { ScanResult } from '../src/types.js';

function makeScanResult(overrides?: Partial<ScanResult>): ScanResult {
  return {
    id: 'test-id',
    targetUrl: 'https://example.com',
    mode: 'passive',
    status: 'completed',
    startedAt: '2026-03-16T00:00:00Z',
    completedAt: '2026-03-16T00:00:05Z',
    score: 85,
    severityCounts: { critical: 0, high: 1, medium: 2, low: 0, info: 1 },
    findings: [
      {
        checkId: 'security-headers',
        title: 'Missing CSP',
        description: 'No Content-Security-Policy header',
        severity: 'high',
        evidence: 'No CSP header',
        recommendation: 'Add CSP',
        cweId: 'CWE-693',
      },
      {
        checkId: 'cors-audit',
        title: 'Wildcard CORS',
        description: 'CORS allows all origins',
        severity: 'medium',
        evidence: 'ACAO: *',
        recommendation: 'Restrict origins',
      },
    ],
    checkResults: [],
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

describe('formatReport', () => {
  describe('JSON', () => {
    test('produces valid JSON', () => {
      const output = formatReport(makeScanResult(), 'json');
      const parsed = JSON.parse(output);
      expect(parsed.id).toBe('test-id');
      expect(parsed.score).toBe(85);
      expect(parsed.findings).toHaveLength(2);
    });

    test('handles empty findings', () => {
      const output = formatReport(makeScanResult({ findings: [], severityCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } }), 'json');
      const parsed = JSON.parse(output);
      expect(parsed.findings).toHaveLength(0);
    });
  });

  describe('Markdown', () => {
    test('includes title and score', () => {
      const output = formatReport(makeScanResult(), 'markdown');
      expect(output).toContain('OpenClaw Security Report');
      expect(output).toContain('85/100');
      expect(output).toContain('example.com');
    });

    test('includes findings', () => {
      const output = formatReport(makeScanResult(), 'markdown');
      expect(output).toContain('Missing CSP');
      expect(output).toContain('Wildcard CORS');
    });

    test('shows no findings message when clean', () => {
      const output = formatReport(makeScanResult({ findings: [] }), 'markdown');
      expect(output).toContain('No issues found');
    });

    test('includes platform version', () => {
      const output = formatReport(makeScanResult(), 'markdown');
      expect(output).toContain('0.3.0');
    });
  });

  describe('HTML', () => {
    test('produces valid HTML structure', () => {
      const output = formatReport(makeScanResult(), 'html');
      expect(output).toContain('<!DOCTYPE html>');
      expect(output).toContain('</html>');
      expect(output).toContain('OpenClaw Security Report');
    });

    test('includes score', () => {
      const output = formatReport(makeScanResult(), 'html');
      expect(output).toContain('85/100');
    });

    test('includes findings', () => {
      const output = formatReport(makeScanResult(), 'html');
      expect(output).toContain('Missing CSP');
      expect(output).toContain('finding-high');
    });

    test('escapes HTML in findings', () => {
      const result = makeScanResult({
        findings: [{
          checkId: 'xss-test',
          title: '<script>alert(1)</script>',
          description: 'test',
          severity: 'high',
          evidence: '<img onerror=alert(1)>',
          recommendation: 'fix',
        }],
      });
      const output = formatReport(result, 'html');
      expect(output).not.toContain('<script>alert(1)</script>');
      expect(output).toContain('&lt;script&gt;');
    });
  });
});
