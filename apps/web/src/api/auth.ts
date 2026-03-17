import { Hono } from 'hono';
import type { Env } from '../worker';
import { signJwt } from '../utils/jwt';
import { ensureUser, getAuthUser } from '../utils/auth';

export const authRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// ── OAuth state CSRF helpers ──

const STATE_MAX_AGE_SECONDS = 600; // 10 minutes

function getOAuthSecret(env: { JWT_SECRET?: string }): string {
  return env.JWT_SECRET ?? 'openclaw-security-dev-secret-do-not-use-in-prod';
}

async function createSignedState(payload: { returnTo: string }, secret: string): Promise<string> {
  const data = JSON.stringify({ ...payload, ts: Math.floor(Date.now() / 1000) });
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sigHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return encodeURIComponent(`${data}.${sigHex}`);
}

async function verifySignedState(raw: string | undefined, secret: string): Promise<string> {
  if (!raw) return '/';
  try {
    const decoded = decodeURIComponent(raw);
    const dotIdx = decoded.lastIndexOf('.');
    if (dotIdx === -1) return '/';

    const data = decoded.slice(0, dotIdx);
    const sig = decoded.slice(dotIdx + 1);

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const sigBytes = new Uint8Array(sig.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes.buffer as ArrayBuffer, new TextEncoder().encode(data));
    if (!valid) return '/';

    const parsed = JSON.parse(data) as { returnTo?: string; ts?: number };
    if (parsed.ts && Math.abs(Date.now() / 1000 - parsed.ts) > STATE_MAX_AGE_SECONDS) return '/';

    return parsed.returnTo ?? '/';
  } catch {
    return '/';
  }
}

// ── Google OAuth ──

authRoutes.get('/google', async (c) => {
  const returnTo = c.req.query('returnTo') ?? '/';
  const state = await createSignedState({ returnTo }, getOAuthSecret(c.env));
  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: c.env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });
  return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

authRoutes.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const stateRaw = c.req.query('state');
  if (!code) return c.json({ success: false, error: 'Missing code' }, 400);

  const returnTo = await verifySignedState(stateRaw, getOAuthSecret(c.env));

  // Exchange code for tokens
  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: c.env.GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenResp.ok) return c.json({ success: false, error: 'Token exchange failed' }, 400);
  const tokens = (await tokenResp.json()) as { access_token: string };

  // Get user info
  const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = (await userResp.json()) as { id: string; email: string; name?: string; picture?: string };

  const userId = `google-${userInfo.id}`;
  await ensureUser(userId, userInfo.email, userInfo.name ?? null, userInfo.picture ?? null, c.env.DB);

  const secret = c.env.JWT_SECRET ?? 'openclaw-security-dev-secret-do-not-use-in-prod';
  const jwt = await signJwt({ sub: userId, email: userInfo.email, name: userInfo.name, picture: userInfo.picture }, secret);

  const redirectUrl = new URL(returnTo, c.req.url);
  redirectUrl.searchParams.set('token', jwt);
  return c.redirect(redirectUrl.toString());
});

// ── GitHub OAuth ──

authRoutes.get('/github', async (c) => {
  const returnTo = c.req.query('returnTo') ?? '/';
  const state = await createSignedState({ returnTo }, getOAuthSecret(c.env));
  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    redirect_uri: c.env.GITHUB_REDIRECT_URI,
    scope: 'read:user user:email',
    state,
  });
  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

authRoutes.get('/github/callback', async (c) => {
  const code = c.req.query('code');
  const stateRaw = c.req.query('state');
  if (!code) return c.json({ success: false, error: 'Missing code' }, 400);

  const returnTo = await verifySignedState(stateRaw, getOAuthSecret(c.env));

  const tokenResp = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: c.env.GITHUB_REDIRECT_URI,
    }),
  });

  const tokens = (await tokenResp.json()) as { access_token: string };
  if (!tokens.access_token) return c.json({ success: false, error: 'Token exchange failed' }, 400);

  const userResp = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'openclaw-security' },
  });
  const userInfo = (await userResp.json()) as { id: number; email: string | null; login: string; name?: string; avatar_url?: string };

  // GitHub may not return email — fetch from /user/emails
  let email = userInfo.email;
  if (!email) {
    const emailsResp = await fetch('https://api.github.com/user/emails', {
      headers: { Authorization: `Bearer ${tokens.access_token}`, 'User-Agent': 'openclaw-security' },
    });
    const emails = (await emailsResp.json()) as { email: string; primary: boolean }[];
    email = emails.find((e) => e.primary)?.email ?? emails[0]?.email ?? `${userInfo.login}@github`;
  }

  const userId = `github-${userInfo.id}`;
  await ensureUser(userId, email, userInfo.name ?? userInfo.login, userInfo.avatar_url ?? null, c.env.DB);

  const secret = c.env.JWT_SECRET ?? 'openclaw-security-dev-secret-do-not-use-in-prod';
  const jwt = await signJwt({ sub: userId, email, name: userInfo.name ?? userInfo.login, picture: userInfo.avatar_url }, secret);

  const redirectUrl = new URL(returnTo, c.req.url);
  redirectUrl.searchParams.set('token', jwt);
  return c.redirect(redirectUrl.toString());
});

// ── Me ──

authRoutes.get('/me', async (c) => {
  let userId = c.get('userId');
  if (!userId) {
    const user = await getAuthUser(c.req.raw, c.env);
    if (!user) {
      return c.json({ success: false, error: 'Authentication required' }, 401);
    }
    userId = user.userId;
  }

  const user = await c.env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(userId).first();
  const sub = await c.env.DB.prepare(
    `SELECT * FROM subscriptions WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(userId)
    .first();

  return c.json({
    success: true,
    data: {
      user: user ? { id: user['id'], email: user['email'], name: user['name'], picture: user['picture'] } : null,
      subscription: sub ? { plan: sub['plan'], status: sub['status'] } : null,
    },
  });
});
