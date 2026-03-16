import type { ReportFormat, ScanConfig, ScanMode } from '@openclaw-security/scanner-core';
import { formatReport, scan } from '@openclaw-security/scanner-core';
import { writeFileSync } from 'fs';
import { printTable } from '../output/table';

interface ScanOptions {
  url: string;
  deep: boolean;
  token?: string;
  format: 'table' | 'json' | 'markdown';
  output?: string;
  timeout: number;
  concurrency: number;
}

function parseArgs(args: string[]): ScanOptions {
  const opts: ScanOptions = {
    url: '',
    deep: false,
    format: 'table',
    timeout: 15000,
    concurrency: 5,
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i]!;
    switch (arg) {
      case '--deep':
        opts.deep = true;
        break;
      case '--token':
        opts.token = args[++i] ?? '';
        opts.deep = true;
        break;
      case '--format':
        opts.format = (args[++i] ?? 'table') as 'table' | 'json' | 'markdown';
        break;
      case '--output':
        opts.output = args[++i] ?? '';
        break;
      case '--timeout':
        opts.timeout = parseInt(args[++i] ?? '15000');
        break;
      case '--concurrency':
        opts.concurrency = parseInt(args[++i] ?? '5');
        break;
      default:
        if (!arg.startsWith('-') && !opts.url) {
          opts.url = arg;
        }
    }
    i++;
  }

  return opts;
}

export async function runScanCommand(args: string[]): Promise<void> {
  const opts = parseArgs(args);

  if (!opts.url) {
    console.error('Error: URL is required');
    process.exit(1);
  }

  // If deep scan without token, prompt for it
  if (opts.deep && !opts.token) {
    process.stdout.write('Enter JWT token for deep scan: ');
    const token = await new Promise<string>((resolve) => {
      process.stdin.once('data', (chunk) => {
        resolve(String(chunk).trim());
      });
    });
    opts.token = token;
    if (!opts.token) {
      console.error('Error: JWT token is required for deep scan');
      process.exit(1);
    }
  }

  const mode: ScanMode = opts.deep ? 'active' : 'passive';
  console.log(`\n  Scanning ${opts.url} (${mode} mode)...\n`);

  const config: ScanConfig = {
    targetUrl: opts.url,
    mode,
    jwt: opts.token,
    timeout: opts.timeout,
    concurrency: opts.concurrency,
  };

  const startTime = performance.now();
  const result = await scan(config);
  const elapsed = Math.round(performance.now() - startTime);

  // Output
  if (opts.format === 'table') {
    printTable(result);
  } else {
    const fmt: ReportFormat = opts.format === 'json' ? 'json' : 'markdown';
    const output = formatReport(result, fmt);
    console.log(output);
  }

  console.log(`\n  Completed in ${elapsed}ms\n`);

  // Save to file
  if (opts.output) {
    const output = formatReport(result, 'json');
    writeFileSync(opts.output, output, 'utf-8');
    console.log(`  Report saved to ${opts.output}\n`);
  }

  // Exit with non-zero if critical/high findings
  if (result.severityCounts.critical > 0 || result.severityCounts.high > 0) {
    process.exit(2);
  }
}
