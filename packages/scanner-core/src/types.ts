// ── Severity & mode ──

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';
export type ScanMode = 'passive' | 'active';
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed';

// ── Config ──

export interface ScanConfig {
  targetUrl: string;
  mode: ScanMode;
  jwt?: string;
  checks?: string[];
  skipChecks?: string[];
  timeout?: number; // per-check ms, default 15000
  concurrency?: number; // max parallel, default 5
}

// ── Findings ──

export interface Finding {
  checkId: string;
  title: string;
  description: string;
  severity: Severity;
  evidence: string;
  recommendation: string;
  cweId?: string;
}

export interface CheckResult {
  checkId: string;
  status: 'pass' | 'fail' | 'error' | 'skipped';
  findings: Finding[];
  durationMs: number;
}

// ── Platform info ──

export interface PlatformInfo {
  version: string | null;
  service: string | null;
  isOpenClaw: boolean;
  detectedProviders: string[];
  planTier: string | null;
}

// ── Active scan data ──

export interface ActiveScanData {
  tenantId: string;
  email: string;
  agents: AgentRecord[];
  memories: MemoryRecord[];
  skills: SkillRecord[];
  schedules: ScheduleRecord[];
  channels: ChannelRecord[];
}

export interface AgentRecord {
  id: string;
  name: string;
  slug: string;
  status: string;
  model?: string;
  systemPrompt?: string;
  config?: Record<string, unknown>;
}

export interface MemoryRecord {
  id: string;
  agentId: string;
  content: string;
  role: string;
  createdAt: string;
}

export interface SkillRecord {
  id: string;
  name: string;
  source: string;
  status: string;
  isBundled: boolean;
}

export interface ScheduleRecord {
  id: string;
  agentId: string;
  cron: string;
  prompt: string;
  enabled: boolean;
}

export interface ChannelRecord {
  id: string;
  agentId: string;
  type: string;
  status: string;
  config: Record<string, unknown>;
}

// ── Scan result ──

export interface ScanResult {
  id: string;
  targetUrl: string;
  mode: ScanMode;
  status: ScanStatus;
  startedAt: string;
  completedAt: string | null;
  score: number;
  severityCounts: Record<Severity, number>;
  findings: Finding[];
  checkResults: CheckResult[];
  platformInfo: PlatformInfo;
}

// ── Check definition ──

export interface CheckContext {
  config: ScanConfig;
  httpClient: HttpClient;
  platformInfo: PlatformInfo;
  activeData?: ActiveScanData;
}

export interface CheckDefinition {
  id: string;
  name: string;
  description: string;
  mode: ScanMode;
  category: CheckCategory;
  dependsOn?: string[];
  run: (ctx: CheckContext) => Promise<CheckResult>;
}

export type CheckCategory = 'auth' | 'headers' | 'exposure' | 'config' | 'data' | 'infrastructure';

// ── HTTP client ──

export interface HttpResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
  url: string;
  redirects: string[];
  durationMs: number;
}

export interface HttpClient {
  get(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
  post(url: string, body: unknown, options?: HttpRequestOptions): Promise<HttpResponse>;
  options(url: string, options?: HttpRequestOptions): Promise<HttpResponse>;
}

export interface HttpRequestOptions {
  headers?: Record<string, string>;
  timeout?: number;
  followRedirects?: boolean;
}

// ── Report format ──

export type ReportFormat = 'json' | 'markdown' | 'html';
