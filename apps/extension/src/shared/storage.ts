import type { DetectionResult } from '../background/detection';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  result: DetectionResult;
  expiresAt: number;
}

export async function getCachedResult(origin: string): Promise<DetectionResult | null> {
  const key = `scan_${origin}`;
  const data = await chrome.storage.local.get(key);
  const entry = data[key] as CacheEntry | undefined;

  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    await chrome.storage.local.remove(key);
    return null;
  }

  return entry.result;
}

export async function setCachedResult(origin: string, result: DetectionResult): Promise<void> {
  const key = `scan_${origin}`;
  const entry: CacheEntry = {
    result,
    expiresAt: Date.now() + CACHE_TTL,
  };
  await chrome.storage.local.set({ [key]: entry });
}
