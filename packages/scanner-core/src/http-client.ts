import type { HttpClient, HttpRequestOptions, HttpResponse } from './types';

export function createHttpClient(defaults?: { timeout?: number; jwt?: string }): HttpClient {
  const defaultTimeout = defaults?.timeout ?? 15000;
  const jwt = defaults?.jwt;

  async function request(
    method: string,
    url: string,
    body?: unknown,
    options?: HttpRequestOptions,
  ): Promise<HttpResponse> {
    const timeout = options?.timeout ?? defaultTimeout;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = { ...options?.headers };
    if (jwt) headers['Authorization'] = `Bearer ${jwt}`;
    if (body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

    const redirects: string[] = [];
    const start = performance.now();

    try {
      const resp = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
        redirect: options?.followRedirects === false ? 'manual' : 'follow',
      });

      // Track redirect if final URL differs from requested URL
      if (resp.redirected && resp.url !== url) {
        redirects.push(resp.url);
      }

      const durationMs = Math.round(performance.now() - start);
      const respHeaders: Record<string, string> = {};
      resp.headers.forEach((v, k) => {
        respHeaders[k.toLowerCase()] = v;
      });

      const text = await resp.text();

      return {
        status: resp.status,
        headers: respHeaders,
        body: text,
        url: resp.url,
        redirects,
        durationMs,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    get: (url, opts) => request('GET', url, undefined, opts),
    post: (url, body, opts) => request('POST', url, body, opts),
    options: (url, opts) => request('OPTIONS', url, undefined, opts),
  };
}
