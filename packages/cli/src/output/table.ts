import type { ScanResult, Severity } from '@openclaw-security/scanner-core';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
};

function severityColor(s: Severity): string {
  switch (s) {
    case 'critical': return COLORS.red;
    case 'high': return `${COLORS.red}`;
    case 'medium': return COLORS.yellow;
    case 'low': return COLORS.blue;
    case 'info': return COLORS.gray;
  }
}

function severityLabel(s: Severity): string {
  return `${severityColor(s)}${s.toUpperCase().padEnd(8)}${COLORS.reset}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return COLORS.green;
  if (score >= 50) return COLORS.yellow;
  return COLORS.red;
}

export function printTable(result: ScanResult): void {
  const c = COLORS;
  const w = 70;
  const line = '─'.repeat(w);

  console.log(`\n${c.bold}  OpenClaw Security Report${c.reset}`);
  console.log(`  ${c.dim}${line}${c.reset}`);
  console.log(`  ${c.bold}Target:${c.reset}  ${result.targetUrl}`);
  console.log(`  ${c.bold}Mode:${c.reset}    ${result.mode}`);
  console.log(`  ${c.bold}Score:${c.reset}   ${scoreColor(result.score)}${c.bold}${result.score}/100${c.reset}`);

  if (result.platformInfo.version) {
    console.log(`  ${c.bold}Version:${c.reset} ${result.platformInfo.version}`);
  }

  // Severity summary
  console.log(`\n  ${c.dim}${line}${c.reset}`);
  console.log(`  ${c.bold}Summary${c.reset}\n`);

  const severities: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  for (const s of severities) {
    const count = result.severityCounts[s];
    if (count > 0) {
      const bar = '█'.repeat(Math.min(count * 2, 30));
      console.log(`  ${severityLabel(s)} ${severityColor(s)}${bar}${c.reset} ${count}`);
    }
  }

  // Findings
  if (result.findings.length > 0) {
    console.log(`\n  ${c.dim}${line}${c.reset}`);
    console.log(`  ${c.bold}Findings (${result.findings.length})${c.reset}\n`);

    for (const f of result.findings) {
      console.log(`  ${severityLabel(f.severity)} ${c.bold}${f.title}${c.reset}`);
      console.log(`  ${c.dim}${f.description}${c.reset}`);
      if (f.evidence) {
        const ev = f.evidence.length > 80 ? f.evidence.substring(0, 80) + '…' : f.evidence;
        console.log(`  ${c.dim}Evidence: ${ev}${c.reset}`);
      }
      console.log(`  ${c.cyan}→ ${f.recommendation}${c.reset}`);
      if (f.cweId) console.log(`  ${c.dim}${f.cweId}${c.reset}`);
      console.log('');
    }
  } else {
    console.log(`\n  ${c.green}${c.bold}No findings — all checks passed!${c.reset}\n`);
  }

  // Check results summary
  console.log(`  ${c.dim}${line}${c.reset}`);
  console.log(`  ${c.bold}Check Results${c.reset}\n`);

  for (const cr of result.checkResults) {
    const statusIcon =
      cr.status === 'pass' ? `${c.green}✓${c.reset}` :
      cr.status === 'fail' ? `${c.red}✗${c.reset}` :
      cr.status === 'error' ? `${c.yellow}!${c.reset}` :
      `${c.gray}-${c.reset}`;
    const timing = cr.durationMs > 0 ? `${c.dim}${cr.durationMs}ms${c.reset}` : '';
    console.log(`  ${statusIcon} ${cr.checkId.padEnd(30)} ${timing}`);
  }

  console.log('');
}
