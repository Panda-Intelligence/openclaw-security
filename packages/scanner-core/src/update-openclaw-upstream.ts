import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildOpenClawUpstreamSnapshot } from './openclaw-feed';
import type { OpenClawUpstreamSnapshot } from './openclaw-upstream';

const OUTPUT_FILE = resolve(import.meta.dir, 'generated/openclaw-upstream-snapshot.ts');

function toModuleSource(snapshot: OpenClawUpstreamSnapshot): string {
  return `export const OPENCLAW_UPSTREAM_SNAPSHOT = ${JSON.stringify(snapshot, null, 2)} as const;\n`;
}

export async function updateOpenClawUpstreamSnapshot(): Promise<OpenClawUpstreamSnapshot> {
  const snapshot = await buildOpenClawUpstreamSnapshot();
  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, toModuleSource(snapshot), 'utf8');
  return snapshot;
}

if (import.meta.main) {
  const snapshot = await updateOpenClawUpstreamSnapshot();
  console.log(
    `Updated OpenClaw upstream snapshot: latest stable ${snapshot.latestStableVersion} (${snapshot.latestStableTag}), captured ${snapshot.capturedAt}`,
  );
}
