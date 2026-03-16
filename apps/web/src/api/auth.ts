import { Hono } from 'hono';
import type { Env } from '../worker';
import { signJwt } from '../utils/jwt';
import { ensureUser } from '../utils/auth';

export const authRoutes = new Hono<{ Bindings: Env; Variables: { userId: string } }>();

// ── Google OAuth ──

authRoutes.get('/google', (c) => {
  const returnTo = c.req.query('returnTo') ?? '/';
  const state = encodeURIComponent(JSON.stringify({ returnTo }));
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

  let returnTo = '/';
  try {
    const parsed = JSON.parse(decodeURIComponent(stateRaw ?? '{}')) as { returnTo?: string };
    returnTo = parsed.returnTo ?? '/';
  } catch { /* use default */ }

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

authRoutes.get('/github', (c) => {
  const returnTo = c.req.query('returnTo') ?? '/';
  const state = encodeURIComponent(JSON.stringify({ returnTo }));
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

  let returnTo = '/';
  try {
    const parsed = JSON.parse(decodeURIComponent(stateRaw ?? '{}')) as { returnTo?: string };
    returnTo = parsed.returnTo ?? '/';
  } catch { /* use default */ }

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
  const userId = c.get('userId');
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
