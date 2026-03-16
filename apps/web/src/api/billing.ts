import { Hono } from 'hono';
import type { Env } from '../worker';
import { validateBody, checkoutSchema } from '../middleware/validate';
import { getPlans, PLAN_LIMITS } from '../types';
import type { PlanTier } from '../types';

export const billingRoutes = new Hono<{ Bindings: Env; Variables: { userId: string; validatedBody: unknown } }>();

// GET /api/billing/plans (public)
billingRoutes.get('/plans', (c) => {
  return c.json({ success: true, data: getPlans() });
});

// GET /api/billing/subscription
billingRoutes.get('/subscription', async (c) => {
  const userId = c.get('userId');
  const sub = await c.env.DB.prepare(
    `SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(userId)
    .first();

  if (!sub) return c.json({ success: true, data: { plan: 'free', status: 'active' } });

  const plan = sub['plan'] as PlanTier;
  return c.json({
    success: true,
    data: {
      plan,
      status: sub['status'],
      limits: PLAN_LIMITS[plan],
      currentPeriodEnd: sub['current_period_end'],
    },
  });
});

// POST /api/billing/checkout
billingRoutes.post('/checkout', validateBody(checkoutSchema), async (c) => {
  const userId = c.get('userId');

  // Get or create Stripe customer
  const sub = await c.env.DB.prepare(
    `SELECT stripe_customer_id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(userId)
    .first();

  const user = await c.env.DB.prepare(`SELECT email FROM users WHERE id = ?`).bind(userId).first();
  const email = user?.['email'] as string;

  const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);

  let customerId = sub?.['stripe_customer_id'] as string | null;
  if (!customerId) {
    const customer = await stripe('customers', 'POST', { email, metadata: { userId } });
    customerId = customer['id'] as string;
    await c.env.DB.prepare(`UPDATE subscriptions SET stripe_customer_id = ? WHERE user_id = ?`)
      .bind(customerId, userId)
      .run();
  }

  const session = await stripe('checkout/sessions', 'POST', {
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: c.env.STRIPE_PRICE_STARTER, quantity: 1 }],
    success_url: `${new URL(c.req.url).origin}/app/dashboard?checkout=success`,
    cancel_url: `${new URL(c.req.url).origin}/pricing`,
    metadata: { userId, plan: 'starter' },
  });

  return c.json({ success: true, data: { url: session['url'] } });
});

// POST /api/billing/portal
billingRoutes.post('/portal', async (c) => {
  const userId = c.get('userId');
  const sub = await c.env.DB.prepare(
    `SELECT stripe_customer_id FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(userId)
    .first();

  const customerId = sub?.['stripe_customer_id'] as string | null;
  if (!customerId) return c.json({ success: false, error: 'No billing account' }, 400);

  const stripe = createStripeClient(c.env.STRIPE_SECRET_KEY);
  const session = await stripe('billing_portal/sessions', 'POST', {
    customer: customerId,
    return_url: `${new URL(c.req.url).origin}/app/dashboard`,
  });

  return c.json({ success: true, data: { url: session['url'] } });
});

// POST /api/billing/webhook (public, signature verified)
billingRoutes.post('/webhook', async (c) => {
  const body = await c.req.text();
  const sig = c.req.header('stripe-signature');
  if (!sig) return c.json({ error: 'Missing signature' }, 400);

  let event: { id: string; type: string; data: { object: Record<string, unknown> } };
  try {
    event = await verifyStripeSignature(body, sig, c.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Invalid signature' }, 400);
  }

  // Idempotency check
  const existing = await c.env.DB.prepare(`SELECT id FROM billing_events WHERE id = ?`).bind(event.id).first();
  if (existing) return c.json({ received: true });

  await c.env.DB.prepare(`INSERT INTO billing_events (id, event_type, payload) VALUES (?, ?, ?)`)
    .bind(event.id, event.type, body)
    .run();

  const obj = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      const metadata = obj['metadata'] as { userId?: string; plan?: string } | undefined;
      if (metadata?.userId && metadata.plan) {
        await c.env.DB.prepare(
          `UPDATE subscriptions SET plan = ?, status = 'active', stripe_subscription_id = ?, updated_at = datetime('now')
           WHERE user_id = ?`,
        )
          .bind(metadata.plan, obj['subscription'] ?? null, metadata.userId)
          .run();
      }
      break;
    }
    case 'customer.subscription.deleted': {
      const subId = obj['id'] as string;
      await c.env.DB.prepare(
        `UPDATE subscriptions SET plan = 'free', status = 'canceled', updated_at = datetime('now')
         WHERE stripe_subscription_id = ?`,
      )
        .bind(subId)
        .run();
      break;
    }
  }

  await c.env.DB.prepare(`UPDATE billing_events SET processed = 1 WHERE id = ?`).bind(event.id).run();
  return c.json({ received: true });
});

// Minimal Stripe API client (no SDK dependency)
function createStripeClient(secretKey: string) {
  return async (path: string, method: string, params?: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const body = params ? new URLSearchParams(flattenParams(params)).toString() : undefined;
    const resp = await fetch(`https://api.stripe.com/v1/${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    return (await resp.json()) as Record<string, unknown>;
  };
}

function flattenParams(obj: Record<string, unknown>, prefix = ''): [string, string][] {
  const result: [string, string][] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result.push(...flattenParams(value as Record<string, unknown>, fullKey));
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        if (typeof value[i] === 'object' && value[i] !== null) {
          result.push(...flattenParams(value[i] as Record<string, unknown>, `${fullKey}[${i}]`));
        } else {
          result.push([`${fullKey}[${i}]`, String(value[i])]);
        }
      }
    } else {
      result.push([fullKey, String(value ?? '')]);
    }
  }
  return result;
}

// ── Stripe webhook signature verification ──

const STRIPE_TOLERANCE_SECONDS = 300; // 5 minutes

export async function verifyStripeSignature(
  body: string,
  sigHeader: string,
  secret: string,
): Promise<{ id: string; type: string; data: { object: Record<string, unknown> } }> {
  // Parse "t=timestamp,v1=signature" header
  const parts = new Map<string, string>();
  for (const item of sigHeader.split(',')) {
    const [key, ...rest] = item.split('=');
    if (key && rest.length) parts.set(key.trim(), rest.join('=').trim());
  }

  const timestamp = parts.get('t');
  const v1Signature = parts.get('v1');
  if (!timestamp || !v1Signature) {
    throw new Error('Invalid stripe-signature header');
  }

  // Timestamp tolerance check
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts) || Math.abs(Date.now() / 1000 - ts) > STRIPE_TOLERANCE_SECONDS) {
    throw new Error('Webhook timestamp outside tolerance');
  }

  // HMAC-SHA256: sign "timestamp.body"
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${body}`));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison
  if (expected.length !== v1Signature.length || !timingSafeEqual(expected, v1Signature)) {
    throw new Error('Signature mismatch');
  }

  return JSON.parse(body);
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
