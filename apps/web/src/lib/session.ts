import 'server-only';

import type { AuthSession } from '@vrs/types';

import { api, ApiError } from './api';

/**
 * Read the current authenticated session by calling the API with the
 * incoming request's cookies. Returns null for any failure — the caller
 * decides whether that's an error or a redirect.
 */
export async function getSession(): Promise<AuthSession | null> {
  try {
    return await api.get<AuthSession>('/v1/auth/session', { noStore: true });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 410)) {
      return null;
    }
    throw err;
  }
}

export async function requireSession(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) {
    // Server components can't redirect imperatively from here without leaking
    // implementation; throwing a known sentinel lets layouts handle it.
    throw new SessionRequiredError();
  }
  return session;
}

export class SessionRequiredError extends Error {
  constructor() {
    super('Session required');
    this.name = 'SessionRequiredError';
  }
}
