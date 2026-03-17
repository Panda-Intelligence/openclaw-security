import type { Context, Next } from 'hono';
import { z } from 'zod';

/**
 * Hono middleware that validates the JSON request body against a Zod schema.
 * Returns 400 with structured error on failure.
 */
export function validateBody<T extends z.ZodType>(schema: T) {
  return async (c: Context, next: Next) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ success: false, error: 'Invalid JSON body' }, 400);
    }

    const result = schema.safeParse(body);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      return c.json({ success: false, error: issues.join('; ') }, 400);
    }

    // Store validated body for handler access
    c.set('validatedBody', result.data);
    return next();
  };
}

// ── Schemas ──

export const createScanSchema = z.object({
  targetUrl: z.string().min(1, 'targetUrl is required'),
  mode: z.enum(['passive', 'active']).optional().default('passive'),
  jwt: z.string().optional(),
  projectId: z.string().uuid().optional(),
});

export const createProjectSchema = z.object({
  name: z.string().min(1, 'name is required').max(100),
  targetUrl: z.string().min(1, 'targetUrl is required').url('Invalid URL'),
});

export const checkoutSchema = z.object({
  plan: z.enum(['starter'], { message: 'Invalid plan' }),
});

export const createPairingSchema = z.object({
  projectId: z.string().uuid('Invalid projectId'),
  token: z.string().min(10, 'Token is required'),
});

export const refreshPairingSchema = z.object({
  token: z.string().min(10, 'Token is required'),
});

export const communityReportSchema = z.object({
  targetHost: z.string().min(1, 'targetHost is required'),
  score: z.number().int().min(0).max(100),
  severityCounts: z.record(z.string(), z.number().int().min(0)),
  findingCount: z.number().int().min(0),
  platformVersion: z.string().optional(),
});
