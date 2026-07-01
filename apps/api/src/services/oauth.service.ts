/**
 * Provider OAuth handshake helpers.
 *
 * Each provider owns its own auth URL, token exchange, and account-info
 * endpoint. We keep the surface uniform so the publish routes only care about
 * `startAuth(state)` and `completeAuth(code)`.
 */

import { randomBytes } from 'node:crypto';

import { getRedis } from '../config/redis';
import { env } from '../config/env';
import { Errors } from '../lib/errors';

const STATE_TTL_SECONDS = 600;

interface StartResult {
  url: string;
  state: string;
}

interface CompleteResult {
  provider: 'YOUTUBE' | 'TIKTOK' | 'INSTAGRAM' | 'GOOGLE';
  providerAccountId: string;
  displayName: string | null;
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: Date | null;
}

async function saveState(state: string, payload: Record<string, unknown>) {
  await getRedis().setex(`oauth:state:${state}`, STATE_TTL_SECONDS, JSON.stringify(payload));
}

async function consumeState(state: string): Promise<Record<string, unknown> | null> {
  const redis = getRedis();
  const key = `oauth:state:${state}`;
  const raw = await redis.get(key);
  if (!raw) return null;
  await redis.del(key);
  return JSON.parse(raw) as Record<string, unknown>;
}

// ─── YouTube (Google) ────────────────────────────────────────────────

export async function startYouTubeAuth(userId: string, redirectUri: string): Promise<StartResult> {
  if (!process.env.YOUTUBE_OAUTH_CLIENT_ID) {
    throw Errors.internal('YouTube OAuth is not configured');
  }
  const state = randomBytes(16).toString('hex');
  await saveState(state, { userId, provider: 'YOUTUBE', redirectUri });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', process.env.YOUTUBE_OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('access_type', 'offline');
  url.searchParams.set('include_granted_scopes', 'true');
  url.searchParams.set('prompt', 'consent');
  url.searchParams.set(
    'scope',
    ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'].join(' '),
  );
  url.searchParams.set('state', state);
  return { url: url.toString(), state };
}

export async function completeYouTubeAuth(code: string, state: string): Promise<CompleteResult & { userId: string }> {
  const saved = await consumeState(state);
  if (!saved || saved.provider !== 'YOUTUBE') throw Errors.badRequest('Invalid OAuth state');
  const redirectUri = saved.redirectUri as string;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.YOUTUBE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) throw Errors.badRequest('Token exchange failed');
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
  const channel = await fetch(
    'https://youtube.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  const info = (await channel.json()) as {
    items?: Array<{ id: string; snippet: { title: string } }>;
  };
  const primary = info.items?.[0];
  return {
    provider: 'YOUTUBE',
    userId: saved.userId as string,
    providerAccountId: primary?.id ?? 'unknown',
    displayName: primary?.snippet.title ?? null,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    scopes: tokens.scope?.split(' ') ?? [],
    expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
  };
}

// ─── TikTok ──────────────────────────────────────────────────────────

export async function startTikTokAuth(userId: string, redirectUri: string): Promise<StartResult> {
  if (!process.env.TIKTOK_CLIENT_KEY) throw Errors.internal('TikTok OAuth is not configured');
  const state = randomBytes(16).toString('hex');
  await saveState(state, { userId, provider: 'TIKTOK', redirectUri });
  const url = new URL('https://www.tiktok.com/v2/auth/authorize');
  url.searchParams.set('client_key', process.env.TIKTOK_CLIENT_KEY);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'user.info.basic,video.upload,video.publish');
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return { url: url.toString(), state };
}

export async function completeTikTokAuth(code: string, state: string): Promise<CompleteResult & { userId: string }> {
  const saved = await consumeState(state);
  if (!saved || saved.provider !== 'TIKTOK') throw Errors.badRequest('Invalid OAuth state');
  const redirectUri = saved.redirectUri as string;
  const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: process.env.TIKTOK_CLIENT_KEY ?? '',
      client_secret: process.env.TIKTOK_CLIENT_SECRET ?? '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  if (!tokenRes.ok) throw Errors.badRequest('Token exchange failed');
  const tokens = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    open_id?: string;
  };
  const userInfo = await fetch(
    'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  );
  const info = (await userInfo.json()) as {
    data?: { user?: { open_id: string; display_name: string } };
  };
  return {
    provider: 'TIKTOK',
    userId: saved.userId as string,
    providerAccountId: info.data?.user?.open_id ?? tokens.open_id ?? 'unknown',
    displayName: info.data?.user?.display_name ?? null,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    scopes: tokens.scope?.split(',') ?? [],
    expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
  };
}

// ─── Google sign-in (for user login) ────────────────────────────────

export async function startGoogleSignIn(redirectUri: string): Promise<StartResult> {
  if (!env.GOOGLE_OAUTH_CLIENT_ID) throw Errors.internal('Google sign-in is not configured');
  const state = randomBytes(16).toString('hex');
  await saveState(state, { provider: 'GOOGLE', redirectUri, intent: 'signin' });
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', state);
  return { url: url.toString(), state };
}

export async function completeGoogleSignIn(
  code: string,
  state: string,
  redirectUri: string,
): Promise<{ email: string; name: string | null; imageUrl: string | null; sub: string }> {
  const saved = await consumeState(state);
  if (!saved || saved.provider !== 'GOOGLE') throw Errors.badRequest('Invalid OAuth state');
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) throw Errors.badRequest('Token exchange failed');
  const tokens = (await tokenRes.json()) as { access_token: string; id_token?: string };
  const info = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = (await info.json()) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  };
  return {
    sub: profile.sub,
    email: profile.email,
    name: profile.name ?? null,
    imageUrl: profile.picture ?? null,
  };
}
