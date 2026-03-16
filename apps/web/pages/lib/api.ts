const API_BASE = '/api';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  const data = await resp.json() as T & { error?: string };
  if (!resp.ok) throw new Error(data.error ?? `Request failed: ${resp.status}`);
  return data as T;
}

export async function createScan(targetUrl: string, mode: string = 'passive', jwt?: string) {
  return apiFetch<{ success: boolean; data: { id: string } }>('/scans', {
    method: 'POST',
    body: JSON.stringify({ targetUrl, mode, jwt }),
  });
}

export async function getScan(id: string) {
  return apiFetch<{ success: boolean; data: any }>(`/scans/${id}`);
}

export async function getReport(scanId: string) {
  return apiFetch<{ success: boolean; data: any }>(`/reports/${scanId}`);
}
