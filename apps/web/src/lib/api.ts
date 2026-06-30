/**
 * Typed fetcher for the VRS API.
 *
 * Works in both server and client components. Cookies are forwarded
 * automatically in the browser; on the server we read the incoming request's
 * cookie header via `next/headers`.
 */

import { cookies } from 'next/headers';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  /** Skip Next.js fetch cache when called from a server component. */
  noStore?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, API_URL);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function getCookieHeader(): string | undefined {
  if (typeof window !== 'undefined') return undefined;
  try {
    // Only available in server components / route handlers.
    const c = cookies();
    return c.toString();
  } catch {
    return undefined;
  }
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, noStore, headers = {} } = opts;
  const url = buildUrl(path, query);

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  if (body !== undefined) finalHeaders['Content-Type'] = 'application/json';
  const cookieHeader = getCookieHeader();
  if (cookieHeader) finalHeaders.Cookie = cookieHeader;

  const res = await fetch(url, {
    method,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
    signal,
    cache: noStore ? 'no-store' : 'default',
  });

  if (res.status === 204) return undefined as T;

  let payload: unknown = null;
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    payload = await res.json();
  }

  if (!res.ok) {
    const err = (payload as { error?: { code?: string; message?: string; requestId?: string; details?: unknown } })?.error;
    throw new ApiError(
      res.status,
      err?.code ?? 'UNKNOWN_ERROR',
      err?.message ?? `Request failed with ${res.status}`,
      err?.details,
      err?.requestId,
    );
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...opts, method: 'DELETE' }),
};
