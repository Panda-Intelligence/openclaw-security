import type { ScanResult } from '@openclaw-security/scanner-core';
import { formatReport } from '@openclaw-security/scanner-core';

export function printJson(result: ScanResult): void {
  console.log(formatReport(result, 'json'));
}
