import type { ScanResult } from '@panda-ai/ocs-core';
import { readFileSync } from 'fs';

export async function runUploadCommand(args: string[]): Promise<void> {
  const file = args[0];
  if (!file) {
    console.error('Error: scan file path is required');
    process.exit(1);
  }

  let result: ScanResult;
  try {
    const content = readFileSync(file, 'utf-8');
    result = JSON.parse(content) as ScanResult;
  } catch (err) {
    console.error(`Error reading scan file: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  // Strip sensitive data for anonymous upload
  const payload = {
    targetHost: new URL(result.targetUrl).host,
    score: result.score,
    severityCounts: result.severityCounts,
    findingCount: result.findings.length,
    platformVersion: result.platformInfo.version,
    mode: result.mode,
  };

  const apiUrl = process.env['OPENCLAW_SECURITY_API'] ?? 'https://security.pandacat.ai';

  console.log(`\n  Uploading anonymized report to ${apiUrl}...`);
  console.log(`  Host: ${payload.targetHost}`);
  console.log(`  Score: ${payload.score}/100`);
  console.log(`  Findings: ${payload.findingCount}\n`);

  try {
    const resp = await fetch(`${apiUrl}/api/community`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (resp.ok) {
      const data = (await resp.json()) as { data?: { id: string } };
      console.log(`  Uploaded successfully! Report ID: ${data.data?.id ?? 'N/A'}\n`);
    } else {
      console.error(`  Upload failed: ${resp.status} ${resp.statusText}\n`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`  Upload failed: ${err instanceof Error ? err.message : err}\n`);
    process.exit(1);
  }
}
