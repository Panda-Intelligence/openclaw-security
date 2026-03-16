import type { ScanResult } from '@openclaw-security/scanner-core';
import { formatReport } from '@openclaw-security/scanner-core';

export function printMarkdown(result: ScanResult): void {
  console.log(formatReport(result, 'markdown'));
}
