import { scan, type Finding, type ScanConfig, type ScanResult } from '@panda-ai/ocs-core';

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

const QUICK_PASSIVE_CHECKS = [
  'version-cve',
  'security-headers',
  'cors-audit',
  'admin-endpoint-probe',
  'hsts-preload',
] as const satisfies readonly string[];

type ScanExecutor = (config: ScanConfig) => Promise<ScanResult>;

function mapFindingToQuickFinding(finding: Finding): QuickFinding {
  return {
    title: finding.title,
    severity: finding.severity,
  };
}

export function mapScanResultToDetectionResult(scanResult: ScanResult, detectedAt = Date.now()): DetectionResult {
  if (!scanResult.platformInfo.isOpenClaw) {
    return {
      isOpenClaw: false,
      version: scanResult.platformInfo.version,
      score: null,
      findings: [],
      detectedAt,
    };
  }

  return {
    isOpenClaw: true,
    version: scanResult.platformInfo.version,
    score: scanResult.score,
    findings: scanResult.findings.slice(0, 5).map(mapFindingToQuickFinding),
    detectedAt,
  };
}

export async function detectOpenClaw(origin: string, runScan: ScanExecutor = scan): Promise<DetectionResult | null> {
  try {
    const scanResult = await runScan({
      targetUrl: origin,
      mode: 'passive',
      checks: [...QUICK_PASSIVE_CHECKS],
      timeout: 5000,
      concurrency: 3,
    });

    return mapScanResultToDetectionResult(scanResult);
  } catch {
    return null;
  }
}
