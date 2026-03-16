#!/usr/bin/env bun

import type { ReportFormat, ScanConfig, ScanMode } from '@openclaw-security/scanner-core';
import { formatReport, scan } from '@openclaw-security/scanner-core';
import { runReportCommand } from './commands/report';
import { runScanCommand } from './commands/scan';
import { runUploadCommand } from './commands/upload';

const args = process.argv.slice(2);
const command = args[0];

function printUsage(): void {
  console.log(`
  openclaw-security — Security audit tool for OpenClaw deployments

  Usage:
    openclaw-security scan <url>                   Passive scan
    openclaw-security scan <url> --deep             Active scan (prompts for JWT)
    openclaw-security scan <url> --token <jwt>      Active scan with JWT
    openclaw-security scan <url> --format json      Output format (json|markdown|table)
    openclaw-security scan <url> --output <file>    Save report to file
    openclaw-security report <scan-file>            Render existing report
    openclaw-security upload <scan-file>            Upload to community database

  Options:
    --deep              Enable active scan (requires JWT)
    --token <jwt>       JWT for active scan
    --format <fmt>      Output format: table (default), json, markdown
    --output <file>     Write report to file
    --timeout <ms>      Per-check timeout (default 15000)
    --concurrency <n>   Max parallel checks (default 5)
    -h, --help          Show this help
`);
}

async function main(): Promise<void> {
  if (!command || command === '-h' || command === '--help') {
    printUsage();
    process.exit(0);
  }

  switch (command) {
    case 'scan':
      await runScanCommand(args.slice(1));
      break;
    case 'report':
      await runReportCommand(args.slice(1));
      break;
    case 'upload':
      await runUploadCommand(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
