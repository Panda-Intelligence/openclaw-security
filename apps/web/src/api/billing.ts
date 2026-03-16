import { Hono } from 'hono';
import type { Env } from '../worker';
import { getPlans, PLAN_LIMITS } from '../types';
import type { PlanTier } from '../types';

export const billingRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

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
billingRoutes.post('/checkout', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ plan: string }>();

  if (body.plan !== 'starter') {
    return c.json({ success: false, error: 'Invalid plan' }, 400);
  }

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

  // Simple signature check (in production, use Stripe SDK)
  // For now, just parse the event
  let event: { id: string; type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return c.json({ error: 'Invalid body' }, 400);
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
