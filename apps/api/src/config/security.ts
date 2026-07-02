import type { HelmetOptions } from '@fastify/helmet';

import { env } from './env';

/**
 * Content-Security-Policy configuration.
 *
 * Design:
 *   - default-src 'self' — nothing by default.
 *   - script-src adds 'unsafe-inline' *only* when we can't avoid it (Next.js
 *     runtime injects one on the client). In production we lean on Next's
 *     built-in nonces where possible; here we ship the smallest attackable
 *     surface that still lets the stack function.
 *   - img-src covers our S3 buckets, CloudFront, user avatars, and the AI
 *     image providers so previews load.
 *   - connect-src allow-lists the API + WebSocket + telemetry sinks +
 *     AI providers we make browser-side requests to.
 *   - frame-ancestors 'none' — we never want to be embedded.
 *
 * All lists derive from env so ops can extend without a code change.
 */

const alwaysAllowScript = ["'self'", "'unsafe-inline'"];
const alwaysAllowStyle = ["'self'", "'unsafe-inline'"];
const alwaysAllowFont = ["'self'", 'https://fonts.gstatic.com', 'data:'];

function providerHosts(): string[] {
  const hosts = new Set<string>();
  if (env.API_URL) hosts.add(new URL(env.API_URL).origin);
  if (env.WEB_URL) hosts.add(new URL(env.WEB_URL).origin);
  if (env.PUBLIC_CDN_URL) hosts.add(new URL(env.PUBLIC_CDN_URL).origin);
  if (env.S3_ENDPOINT) hosts.add(new URL(env.S3_ENDPOINT).origin);
  return Array.from(hosts);
}

function aiImageProviders(): string[] {
  const providers: string[] = [];
  if (env.IMAGE_PROVIDER === 'stability') providers.push('https://api.stability.ai');
  if (env.IMAGE_PROVIDER === 'replicate') providers.push('https://replicate.com', 'https://replicate.delivery');
  if (env.IMAGE_PROVIDER === 'openai') providers.push('https://api.openai.com', 'https://oaidalleapiprodscus.blob.core.windows.net');
  return providers;
}

function telemetryHosts(): string[] {
  const hosts: string[] = [];
  if (env.SENTRY_DSN) {
    try {
      const dsn = new URL(env.SENTRY_DSN);
      hosts.push(`${dsn.protocol}//${dsn.host}`);
    } catch {
      // ignore
    }
  }
  const otel = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (otel) {
    try {
      hosts.push(new URL(otel).origin);
    } catch {
      // ignore
    }
  }
  return hosts;
}

function webSocketOrigins(): string[] {
  const hosts = new Set<string>();
  if (env.API_URL) {
    const api = new URL(env.API_URL);
    hosts.add(`${api.protocol === 'https:' ? 'wss:' : 'ws:'}//${api.host}`);
  }
  return Array.from(hosts);
}

export function buildHelmetOptions(): HelmetOptions {
  const providers = providerHosts();
  const imageProviders = aiImageProviders();
  const telemetry = telemetryHosts();
  const websockets = webSocketOrigins();

  const isDev = env.NODE_ENV === 'development';
  const stripeHosts = env.STRIPE_SECRET_KEY
    ? ['https://api.stripe.com', 'https://js.stripe.com', 'https://hooks.stripe.com']
    : [];

  return {
    // We intentionally keep contentSecurityPolicy enabled in every env; dev
    // gets slightly looser sources to allow HMR websockets.
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'", ...stripeHosts],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'script-src': [
          ...alwaysAllowScript,
          ...(isDev ? ["'unsafe-eval'"] : []),
          ...stripeHosts,
        ],
        'style-src': [...alwaysAllowStyle, 'https://fonts.googleapis.com'],
        'font-src': alwaysAllowFont,
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          ...providers,
          ...imageProviders,
          'https://*.amazonaws.com',
          'https://*.cloudfront.net',
          'https://lh3.googleusercontent.com', // Google avatars
        ],
        'media-src': [
          "'self'",
          'blob:',
          ...providers,
          'https://*.amazonaws.com',
          'https://*.cloudfront.net',
        ],
        'connect-src': [
          "'self'",
          ...providers,
          ...telemetry,
          ...websockets,
          ...stripeHosts,
          ...imageProviders,
        ],
        'worker-src': ["'self'", 'blob:'],
        'manifest-src': ["'self'"],
        'upgrade-insecure-requests': isDev ? null : [],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // OAuth popup flow
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    strictTransportSecurity: isDev
      ? false
      : { maxAge: 63_072_000, includeSubDomains: true, preload: true },
    xContentTypeOptions: true,
    xFrameOptions: { action: 'deny' },
    permittedCrossDomainPolicies: { permittedPolicies: 'none' },
  };
}
