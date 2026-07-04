import 'server-only';

import { cookies, headers } from 'next/headers';

import { createClient, type VrsClient } from '@vrs/sdk';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Server-side SDK instance. Forwards the incoming request's cookies so the
 * API sees the user's session.
 *
 * Every call opts out of the Next Data Cache: these are authenticated,
 * per-user reads, and a cached `/v1/auth/session` (or project list) would
 * outlive signout and token rotation.
 */
export function serverClient(): VrsClient {
  const cookieHeader = cookies().toString();
  const forwardedFor = headers().get('x-forwarded-for') ?? undefined;
  return createClient({
    baseUrl: API_URL,
    fetchFn: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
    defaultHeaders: {
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {}),
    },
  });
}
