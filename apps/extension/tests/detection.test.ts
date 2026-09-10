import { describe, expect, test } from 'bun:test';
import type { ScanResult } from '@panda-ai/ocs-core';
import { detectOpenClaw, mapScanResultToDetectionResult } from '../src/background/detection';

function makeScanResult(overrides?: Partial<ScanResult>): ScanResult {
  return {
    id: 'scan-1',
    targetUrl: 'https://example.com',
    mode: 'passive',
    status: 'completed',
    startedAt: '2026-03-25T00:00:00.000Z',
    completedAt: '2026-03-25T00:00:01.000Z',
    score: 78,
    severityCounts: {
      critical: 1,
      high: 1,
      medium: 1,
      low: 1,
      info: 1,
    },
    findings: [
      {
        checkId: 'security-headers',
        title: 'Missing CSP header',
        description: 'CSP 缺失。',
        severity: 'high',
        evidence: 'content-security-policy: missing',
        recommendation: '补充 CSP。',
      },
      {
        checkId: 'cors-audit',
        title: 'CORS reflects arbitrary origins',
        description: '存在任意源反射。',
        severity: 'critical',
        evidence: 'evil.example.com',
        recommendation: '改为 allowlist。',
      },
      {
        checkId: 'admin-endpoint-probe',
        title: 'Admin endpoint accessible without auth',
        description: '管理接口未授权。',
        severity: 'critical',
        evidence: 'GET /api/admin',
        recommendation: '要求管理员鉴权。',
      },
      {
        checkId: 'hsts-preload',
        title: 'HSTS missing includeSubDomains',
        description: '未包含 includeSubDomains。',
        severity: 'low',
        evidence: 'strict-transport-security',
        recommendation: '补充 includeSubDomains。',
      },
      {
        checkId: 'version-cve',
        title: 'Outdated version',
        description: '版本过旧。',
        severity: 'low',
        evidence: 'latest mismatch',
        recommendation: '升级。',
      },
      {
        checkId: 'security-headers',
        title: 'Information disclosure: server',
        description: '暴露 server 头。',
        severity: 'low',
        evidence: 'server: cloudflare',
        recommendation: '移除 server 头。',
      },
    ],
    checkResults: [],
    platformInfo: {
      isOpenClaw: true,
      version: '2026.3.23',
      service: 'openclaw',
      detectedProviders: ['cloudflare'],
      planTier: null,
    },
    ...overrides,
  };
}

describe('extension detection', () => {
  test('maps scanner-core passive scan results to extension detection payload', () => {
    const detection = mapScanResultToDetectionResult(makeScanResult(), 1234567890);

    expect(detection.isOpenClaw).toBe(true);
    expect(detection.version).toBe('2026.3.23');
    expect(detection.score).toBe(78);
    expect(detection.detectedAt).toBe(1234567890);
    expect(detection.findings).toHaveLength(5);
    expect(detection.findings[0]).toEqual({ title: 'Missing CSP header', severity: 'high' });
  });

  test('returns a not-detected payload for non-OpenClaw scan results', () => {
    const detection = mapScanResultToDetectionResult(
      makeScanResult({
        score: 100,
        findings: [],
        platformInfo: {
          isOpenClaw: false,
          version: null,
          service: null,
          detectedProviders: [],
          planTier: null,
        },
      }),
      99,
    );

    expect(detection).toEqual({
      isOpenClaw: false,
      version: null,
      score: null,
      findings: [],
      detectedAt: 99,
    });
  });

  test('detectOpenClaw delegates to scanner-core with quick passive checks', async () => {
    let receivedChecks: string[] | undefined;

    const result = await detectOpenClaw('https://example.com', async (config) => {
      receivedChecks = config.checks;
      return makeScanResult();
    });

    expect(receivedChecks).toEqual([
      'version-cve',
      'security-headers',
      'cors-audit',
      'admin-endpoint-probe',
      'hsts-preload',
    ]);
    expect(result?.isOpenClaw).toBe(true);
  });

  test('detectOpenClaw returns null when scanner-core throws', async () => {
    const result = await detectOpenClaw('https://example.com', async () => {
      throw new Error('network down');
    });

    expect(result).toBeNull();
  });
});
