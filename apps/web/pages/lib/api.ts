import type { Severity } from '@openclaw-security/scanner-core';

const API_BASE = '/api';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export interface ScanRecord {
  id: string;
  target_url: string;
  target_host: string;
  mode: 'passive' | 'active';
  status: 'pending' | 'running' | 'completed' | 'failed';
  score: number | null;
  severity_counts: Record<Severity, number>;
  platform_info: {
    version: string | null;
    service: string | null;
    isOpenClaw: boolean;
    detectedProviders: string[];
    planTier: string | null;
  };
  finding_count: number;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
}

export interface FindingRecord {
  id: string;
  scan_id: string;
  check_id: string;
  title: string;
  severity: Severity;
  description: string;
  evidence: string;
  recommendation: string;
  cwe_id: string | null;
}

export interface ReportData extends ScanRecord {
  findings: FindingRecord[];
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const data = (await resp.json()) as ApiResponse<T>;
  if (!resp.ok) throw new Error(data.error ?? `Request failed: ${resp.status}`);
  return data;
}

export async function createScan(targetUrl: string, mode: string = 'passive', jwt?: string) {
  return apiFetch<{ id: string; status: string; targetUrl: string; mode: string }>('/scans', {
    method: 'POST',
    body: JSON.stringify({ targetUrl, mode, jwt }),
  });
}

export async function getScan(id: string) {
  return apiFetch<ScanRecord>(`/scans/${id}`);
}

export async function getReport(scanId: string) {
  return apiFetch<ReportData>(`/reports/${scanId}`);
}
