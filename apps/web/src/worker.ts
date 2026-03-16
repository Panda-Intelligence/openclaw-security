import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { scanRoutes } from './api/scans.js';
import { reportRoutes } from './api/reports.js';
import { communityRoutes } from './api/community.js';
import { handleScanQueue } from './queue/scan-consumer.js';

export interface Env {
  DB: D1Database;
  SCAN_QUEUE: Queue;
  ASSETS: Fetcher;
}

const app = new Hono<{ Bindings: Env }>();

// CORS
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
}));

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'openclaw-security' }));

// API routes
app.route('/api/scans', scanRoutes);
app.route('/api/reports', reportRoutes);
app.route('/api/community', communityRoutes);

// SPA fallback
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  const assetResp = await c.env.ASSETS.fetch(c.req.raw);
  if (assetResp.status !== 404) return assetResp;
  return c.env.ASSETS.fetch(new Request(new URL('/index.html', url.origin)));
});

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch<{ scanId: string; jwt?: string }>, env: Env): Promise<void> {
    for (const msg of batch.messages) {
      try {
        await handleScanQueue(msg.body, env);
        msg.ack();
      } catch {
        msg.retry();
      }
    }
  },
};
