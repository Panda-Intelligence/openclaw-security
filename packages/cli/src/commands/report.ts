import type { ReportFormat, ScanResult } from '@panda-ai/ocs-core';
import { formatReport } from '@panda-ai/ocs-core';
import { readFileSync } from 'fs';
import { printTable } from '../output/table';

export async function runReportCommand(args: string[]): Promise<void> {
  const file = args[0];
  if (!file) {
    console.error('Error: scan file path is required');
    process.exit(1);
  }

  const format = args.includes('--format')
    ? (args[args.indexOf('--format') + 1] as 'table' | 'json' | 'markdown')
    : 'table';

  let result: ScanResult;
  try {
    const content = readFileSync(file, 'utf-8');
    result = JSON.parse(content) as ScanResult;
  } catch (err) {
    console.error(`Error reading scan file: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  if (format === 'table') {
    printTable(result);
  } else {
    const fmt: ReportFormat = format === 'json' ? 'json' : 'markdown';
    console.log(formatReport(result, fmt));
  }
}
