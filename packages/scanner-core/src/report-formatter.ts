import type { ScanResult, Finding, ReportFormat, Severity } from './types.js';

export function formatReport(result: ScanResult, format: ReportFormat): string {
  switch (format) {
    case 'json':
      return JSON.stringify(result, null, 2);
    case 'markdown':
      return formatMarkdown(result);
    case 'html':
      return formatHtml(result);
  }
}

function severityBadge(s: Severity): string {
  const map: Record<Severity, string> = {
    critical: '🔴 CRITICAL',
    high: '🟠 HIGH',
    medium: '🟡 MEDIUM',
    low: '🔵 LOW',
    info: '⚪ INFO',
  };
  return map[s];
}

function formatMarkdown(r: ScanResult): string {
  const lines: string[] = [
    `# OpenClaw Security Report`,
    '',
    `**Target:** ${r.targetUrl}`,
    `**Score:** ${r.score}/100`,
    `**Mode:** ${r.mode}`,
    `**Scanned:** ${r.startedAt}`,
    '',
    `## Summary`,
    '',
    `| Severity | Count |`,
    `|----------|-------|`,
    ...Object.entries(r.severityCounts)
      .filter(([, n]) => n > 0)
      .map(([s, n]) => `| ${severityBadge(s as Severity)} | ${n} |`),
    '',
  ];

  if (r.platformInfo.version) {
    lines.push(`## Platform`, '', `- Version: ${r.platformInfo.version}`, '');
  }

  if (r.findings.length === 0) {
    lines.push('## Findings', '', 'No issues found.', '');
  } else {
    lines.push('## Findings', '');
    const grouped = groupBySeverity(r.findings);
    for (const [severity, findings] of grouped) {
      lines.push(`### ${severityBadge(severity)}`, '');
      for (const f of findings) {
        lines.push(`#### ${f.title}`, '');
        lines.push(f.description, '');
        if (f.evidence) lines.push(`**Evidence:** \`${truncate(f.evidence, 200)}\``, '');
        lines.push(`**Recommendation:** ${f.recommendation}`, '');
        if (f.cweId) lines.push(`**CWE:** ${f.cweId}`, '');
        lines.push('---', '');
      }
    }
  }

  return lines.join('\n');
}

function formatHtml(r: ScanResult): string {
  const findings = r.findings
    .map(
      (f) => `
    <div class="finding finding-${f.severity}">
      <h3>${esc(f.title)}</h3>
      <span class="badge badge-${f.severity}">${f.severity.toUpperCase()}</span>
      <p>${esc(f.description)}</p>
      ${f.evidence ? `<pre>${esc(truncate(f.evidence, 300))}</pre>` : ''}
      <p><strong>Recommendation:</strong> ${esc(f.recommendation)}</p>
      ${f.cweId ? `<p class="cwe">${esc(f.cweId)}</p>` : ''}
    </div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OpenClaw Security Report</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    .score { font-size: 3rem; font-weight: bold; }
    .badge { padding: 2px 8px; border-radius: 4px; color: #fff; font-size: 0.75rem; }
    .badge-critical { background: #dc2626; }
    .badge-high { background: #ea580c; }
    .badge-medium { background: #ca8a04; }
    .badge-low { background: #2563eb; }
    .badge-info { background: #6b7280; }
    .finding { border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin: 1rem 0; }
    .finding-critical { border-color: #dc2626; }
    .finding-high { border-color: #ea580c; }
    pre { background: #f3f4f6; padding: 0.5rem; border-radius: 4px; overflow-x: auto; }
  </style>
</head>
<body>
  <h1>OpenClaw Security Report</h1>
  <p><strong>Target:</strong> ${esc(r.targetUrl)}</p>
  <p class="score">${r.score}/100</p>
  <p><strong>Mode:</strong> ${r.mode} | <strong>Scanned:</strong> ${esc(r.startedAt)}</p>
  <h2>Findings (${r.findings.length})</h2>
  ${findings || '<p>No issues found.</p>'}
</body>
</html>`;
}

function groupBySeverity(findings: Finding[]): [Severity, Finding[]][] {
  const order: Severity[] = ['critical', 'high', 'medium', 'low', 'info'];
  const groups = new Map<Severity, Finding[]>();
  for (const f of findings) {
    if (!groups.has(f.severity)) groups.set(f.severity, []);
    groups.get(f.severity)!.push(f);
  }
  return order.filter((s) => groups.has(s)).map((s) => [s, groups.get(s)!]);
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
