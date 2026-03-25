import type { Severity } from '@panda-ai/ocs-core';

const API_BASE = '/api';
const TOKEN_KEY = 'ocs_token';

// ── Token management ──

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!));
    return payload.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function getProfile(): { email: string; name?: string; picture?: string } | null {
  const token = getToken();
  if (!token) return null;
  try {
    return JSON.parse(atob(token.split('.')[1]!));
  } catch {
    return null;
  }
}

// ── API types ──

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string | { code: string; message: string };
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
  project_id: string | null;
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

export interface ProjectRecord {
  id: string;
  name: string;
  target_url: string;
  created_at: string;
}

export interface CommunityReportRecord {
  id: string;
  target_host: string;
  score: number;
  severity_counts: Record<Severity | string, number>;
  finding_count: number;
  platform_version: string | null;
  uploaded_at: string;
}

export interface IntelligenceSource {
  label: string;
  url: string;
  note: string;
  capturedAt: string;
}

export interface IntelligenceBoardItem {
  name: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  summary: string;
  signal: string;
}

export interface ReleaseWatchItem {
  version: string;
  date: string;
  posture: string;
  summary: string;
}

export interface IntelligenceOverview {
  capturedAt: string;
  sources: IntelligenceSource[];
  marketplaceSkills: IntelligenceBoardItem[];
  releases: ReleaseWatchItem[];
  communitySignals: IntelligenceBoardItem[];
  versionAdvisories: IntelligenceBoardItem[];
  installHardening: IntelligenceBoardItem[];
  llmSecurity: IntelligenceBoardItem[];
  gatewayHardening: IntelligenceBoardItem[];
}

// ── API fetch ──

async function apiFetch<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const resp = await fetch(`${API_BASE}${path}`, { ...options, headers: { ...headers, ...options?.headers } });

  if (resp.status === 401) {
    clearToken();
    window.location.href = '/auth/login';
    throw new Error('Unauthorized');
  }

  const data = (await resp.json()) as ApiResponse<T>;
  if (!resp.ok) {
    const msg = typeof data.error === 'string' ? data.error : (data.error as { message: string })?.message ?? `Request failed: ${resp.status}`;
    throw new Error(msg);
  }
  return data;
}

// ── Auth ──

export function loginWithGoogle(returnTo = '/app/dashboard'): void {
  window.location.href = `/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
}

export function loginWithGitHub(returnTo = '/app/dashboard'): void {
  window.location.href = `/api/auth/github?returnTo=${encodeURIComponent(returnTo)}`;
}

export function logout(): void {
  clearToken();
  window.location.href = '/';
}

// ── API calls ──

export const createScan = (targetUrl: string, mode = 'passive', jwt?: string, projectId?: string) =>
  apiFetch<{ id: string; status: string }>('/scans', {
    method: 'POST',
    body: JSON.stringify({ targetUrl, mode, jwt, projectId }),
  });

export const getScan = (id: string) => apiFetch<ScanRecord>(`/scans/${id}`);

export const getReport = (scanId: string) => apiFetch<ReportData>(`/reports/${scanId}`);

export const getScans = (projectId?: string) =>
  apiFetch<ScanRecord[]>(projectId ? `/scans?projectId=${projectId}` : '/scans');

export const getProjects = () => apiFetch<ProjectRecord[]>('/projects');

export const createProject = (name: string, targetUrl: string) =>
  apiFetch<ProjectRecord>('/projects', { method: 'POST', body: JSON.stringify({ name, targetUrl }) });

export const deleteProject = (id: string) => apiFetch<void>(`/projects/${id}`, { method: 'DELETE' });

export const getSubscription = () =>
  apiFetch<{ plan: string; status: string; limits: { maxScansPerDayPerProject: number; maxProjects: number } }>('/billing/subscription');

export const getMe = () =>
  apiFetch<{ user: { id: string; email: string; name: string; picture: string } | null; subscription: { plan: string; status: string } | null }>('/auth/me');

export const createCheckout = (plan: string) =>
  apiFetch<{ url: string }>('/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) });

export const getBillingPortal = () =>
  apiFetch<{ url: string }>('/billing/portal', { method: 'POST' });

export const getIntelligenceOverview = () =>
  apiFetch<IntelligenceOverview>('/community/intelligence');

export const getCommunityReports = (limit = 6) =>
  apiFetch<CommunityReportRecord[]>(`/community?limit=${limit}`);

// ── Pairings ──

export interface PairingRecord {
  id: string;
  project_id: string;
  label: string;
  status: 'active' | 'expired' | 'revoked' | 'error';
  target_email: string | null;
  target_tenant_id: string | null;
  verified_at: string | null;
  last_used_at: string | null;
  expires_at: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export const getPairings = (projectId?: string) =>
  apiFetch<PairingRecord[]>(projectId ? `/pairings?projectId=${projectId}` : '/pairings');

export const createPairing = (projectId: string, token: string) =>
  apiFetch<PairingRecord>('/pairings', { method: 'POST', body: JSON.stringify({ projectId, token }) });

export const verifyPairing = (id: string) =>
  apiFetch<{ id: string; status: string; verifiedAt: string | null; expiresAt: string | null }>(`/pairings/${id}/verify`, { method: 'POST' });

export const refreshPairing = (id: string, token: string) =>
  apiFetch<PairingRecord>(`/pairings/${id}/refresh`, { method: 'POST', body: JSON.stringify({ token }) });

export const revokePairing = (id: string) =>
  apiFetch<void>(`/pairings/${id}`, { method: 'DELETE' });
