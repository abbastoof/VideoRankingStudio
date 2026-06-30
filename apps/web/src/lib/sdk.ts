import 'server-only';

import { cookies, headers } from 'next/headers';

import { createClient, type VrsClient } from '@vrs/sdk';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/**
 * Server-side SDK instance. Forwards the incoming request's cookies so the
 * API sees the user's session.
 */
export function serverClient(): VrsClient {
  const cookieHeader = cookies().toString();
  const forwardedFor = headers().get('x-forwarded-for') ?? undefined;
  return createClient({
    baseUrl: API_URL,
    defaultHeaders: {
      ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      ...(forwardedFor ? { 'X-Forwarded-For': forwardedFor } : {}),
    },
  });
}
