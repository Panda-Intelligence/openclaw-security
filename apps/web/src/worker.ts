import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { authRoutes } from './api/auth';
import { billingRoutes } from './api/billing';
import { communityRoutes } from './api/community';
import { projectRoutes } from './api/projects';
import { reportRoutes } from './api/reports';
import { scanRoutes } from './api/scans';
import { rateLimit } from './middleware/rate-limit';
import { handleScanQueue } from './queue/scan-consumer';
import { ensureAppSchema, SchemaMigrationRequiredError } from './state/bootstrap';
import { getAuthUser } from './utils/auth';

export interface Env {
  DB: D1Database;
  SCAN_QUEUE: Queue;
  ASSETS?: Fetcher;
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

function isLocalDevelopmentRequest(request: Request): boolean {
  const { hostname } = new URL(request.url);
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost');
}

// CORS
app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      // Allow same-origin (no Origin header) and localhost for dev
      if (!origin) return '*';
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) return origin;
      // Production: restrict to the deployed domain
      if (origin.endsWith('.openclawsecurity.io') || origin === 'https://openclawsecurity.io') return origin;
      return null;
    },
    allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Health
app.get('/health', (c) => c.json({ status: 'ok', service: 'openclaw-security' }));

app.get('/robots.txt', (c) => {
  const origin = new URL(c.req.url).origin;
  return c.text(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
});

app.get('/sitemap.xml', (c) => {
  const origin = new URL(c.req.url).origin;
  const routes = [
    '/',
    '/pricing',
    '/community',
    '/intel',
    '/blog',
    '/blog/welcome',
    '/blog/top-10-misconfigurations',
    '/blog/cors-deep-dive',
    '/blog/marketplace-skills-security',
    '/blog/openclaw-release-dependency-watch',
    '/blog/llm-runtime-security-checklist',
    '/auth/login',
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((route) => `  <url><loc>${origin}${route}</loc></url>`).join('\n')}
</urlset>`;
  return c.text(body, 200, { 'Content-Type': 'application/xml; charset=utf-8' });
});

// Rate limiting on sensitive endpoints
app.use('/api/auth/*', rateLimit({ limit: 15, windowMs: 60_000, keyPrefix: 'auth' }));
app.use('/api/billing/webhook', rateLimit({ limit: 100, windowMs: 60_000, keyPrefix: 'webhook' }));
app.use('/api/scans', rateLimit({ limit: 20, windowMs: 60_000, keyPrefix: 'scans' }));
app.use('/api/community', rateLimit({ limit: 30, windowMs: 60_000, keyPrefix: 'community' }));

// Public routes (before auth middleware)
app.use('/api/*', async (c, next) => {
  try {
    await ensureAppSchema(c.env.DB, { allowBootstrap: isLocalDevelopmentRequest(c.req.raw) });
  } catch (error) {
    if (error instanceof SchemaMigrationRequiredError) {
      return c.json(
        {
          success: false,
          error: {
            code: 'MIGRATION_REQUIRED',
            message: error.message,
          },
        },
        503,
      );
    }
    throw error;
  }
  return next();
});

app.route('/api/auth', authRoutes);
app.route('/api/community', communityRoutes);

// Auth middleware for protected /api/* routes
const PUBLIC_PREFIXES = [
  '/api/billing/webhook',
  '/api/billing/plans',
  '/api/auth/google',
  '/api/auth/github',
  '/api/community',
];

app.use('/api/*', async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (PUBLIC_PREFIXES.some((p) => path.startsWith(p))) return next();

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
  if (!c.env.ASSETS || typeof c.env.ASSETS.fetch !== 'function') {
    return c.json(
      {
        success: false,
        error: {
          code: 'ASSETS_BINDING_MISSING',
          message: 'Static asset binding "ASSETS" is not configured.',
        },
      },
      500,
    );
  }

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
