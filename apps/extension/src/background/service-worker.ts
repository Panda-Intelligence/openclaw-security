import { detectOpenClaw, type DetectionResult } from './detection.js';
import { getCachedResult, setCachedResult } from '../shared/storage.js';

// Listen for tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return;

  try {
    const url = new URL(tab.url);
    const origin = url.origin;

    // Check cache first
    const cached = await getCachedResult(origin);
    if (cached) {
      updateBadge(tabId, cached);
      return;
    }

    // Run detection
    const result = await detectOpenClaw(origin);
    if (result) {
      await setCachedResult(origin, result);
      updateBadge(tabId, result);
    }
  } catch { /* ignore errors */ }
});

function updateBadge(tabId: number, result: DetectionResult): void {
  if (!result.isOpenClaw) return;

  const score = result.score ?? 0;
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';

  chrome.action.setBadgeText({ text: String(score), tabId });
  chrome.action.setBadgeBackgroundColor({ color, tabId });
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_RESULT') {
    getCachedResult(msg.origin).then(sendResponse);
    return true; // async response
  }

  if (msg.type === 'RUN_SCAN') {
    detectOpenClaw(msg.origin).then(async (result) => {
      if (result) await setCachedResult(msg.origin, result);
      sendResponse(result);
    });
    return true;
  }
});
