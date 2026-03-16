import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './api/auth';
import { billingRoutes } from './api/billing';
import { communityRoutes } from './api/community';
import { projectRoutes } from './api/projects';
import { reportRoutes } from './api/reports';
import { scanRoutes } from './api/scans';
import { handleScanQueue } from './queue/scan-consumer';
import { getAuthUser } from './utils/auth';

export interface Env {
  DB: D1Database;
  SCAN_QUEUE: Queue;
  ASSETS: Fetcher;
  JWT_SECRET?: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GITHUB_REDIRECT_URI: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_STARTER: string;
}

type Variables = { userId: string };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS
app.use(
  '/api/*',
  cors({
    origin: '*',
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Health
app.get('/health', (c) => c.json({ status: 'ok', service: 'openclaw-security' }));

// Public routes (before auth middleware)
app.route('/api/auth', authRoutes);
app.route('/api/community', communityRoutes);

// Auth middleware for protected /api/* routes
const PUBLIC_PREFIXES = ['/api/billing/webhook', '/api/billing/plans'];

app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return next();
  if (path.startsWith('/api/auth/') || path.startsWith('/api/community')) return next();

  const user = await getAuthUser(c.req.raw, c.env);
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }
  c.set('userId', user.userId);
  return next();
});

// Protected routes
app.route('/api/scans', scanRoutes);
app.route('/api/reports', reportRoutes);
app.route('/api/projects', projectRoutes);
app.route('/api/billing', billingRoutes);

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
