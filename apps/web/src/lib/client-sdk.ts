'use client';

import { createClient, type VrsClient } from '@vrs/sdk';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

let _client: VrsClient | undefined;

export function clientSdk(): VrsClient {
  if (!_client) {
    _client = createClient({
      baseUrl: API_URL,
      onUnauthorized: () => {
        if (typeof window !== 'undefined') {
          const next = window.location.pathname + window.location.search;
          window.location.href = `/signin?next=${encodeURIComponent(next)}`;
        }
      },
    });
  }
  return _client;
}
