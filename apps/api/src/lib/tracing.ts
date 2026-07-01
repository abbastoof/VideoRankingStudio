/**
 * OpenTelemetry + Sentry initialisation for the API service.
 *
 * Must be imported before Fastify or any other instrumented library, so
 * `index.ts` imports this module first. Both integrations are lazy: if the
 * SDK dependencies aren't installed or the env vars aren't set, the module
 * initialises to a no-op instead of throwing.
 */

import { env } from '../config/env';

let _initialised = false;

export async function initTracing(): Promise<void> {
  if (_initialised) return;
  _initialised = true;

  // Sentry — lazy import, opt-in via SENTRY_DSN.
  if (env.SENTRY_DSN) {
    try {
      const Sentry = (await import('@sentry/node')) as typeof import('@sentry/node');
      Sentry.init({
        dsn: env.SENTRY_DSN,
        environment: env.SENTRY_ENVIRONMENT,
        release: process.env.GIT_SHA,
        tracesSampleRate: 0.1,
        profilesSampleRate: 0.05,
        integrations: [Sentry.httpIntegration({ tracing: true })],
      });
    } catch {
      // Sentry not installed — skip.
    }
  }

  // OpenTelemetry — opt-in via OTEL_EXPORTER_OTLP_ENDPOINT.
  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (otlpEndpoint) {
    try {
      const { NodeSDK } = await import('@opentelemetry/sdk-node');
      const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
      const { Resource } = await import('@opentelemetry/resources');
      const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');
      const { getNodeAutoInstrumentations } = await import(
        '@opentelemetry/auto-instrumentations-node'
      );

      const sdk = new NodeSDK({
        resource: new Resource({
          [SemanticResourceAttributes.SERVICE_NAME]: 'vrs-api',
          [SemanticResourceAttributes.SERVICE_VERSION]: process.env.GIT_SHA ?? 'dev',
          [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: env.NODE_ENV,
        }),
        traceExporter: new OTLPTraceExporter({ url: `${otlpEndpoint}/v1/traces` }),
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false },
            '@opentelemetry/instrumentation-http': {
              ignoreIncomingRequestHook: (req) =>
                req.url === '/health' || req.url === '/metrics',
            },
          }),
        ],
      });
      sdk.start();
    } catch {
      // OTel not installed — skip.
    }
  }
}

/**
 * Attach a request-scoped span. Callers wrap significant handler paths in
 * this so we get a business-relevant span in addition to the HTTP one.
 */
export function withSpan<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  return Promise.resolve()
    .then(async () => {
      try {
        const { trace, SpanStatusCode } = await import('@opentelemetry/api');
        const tracer = trace.getTracer('vrs-api');
        return await tracer.startActiveSpan(name, async (span) => {
          try {
            const result = await fn();
            span.setStatus({ code: SpanStatusCode.OK });
            return result;
          } catch (err) {
            span.setStatus({
              code: SpanStatusCode.ERROR,
              message: err instanceof Error ? err.message : String(err),
            });
            if (err instanceof Error) span.recordException(err);
            throw err;
          } finally {
            span.end();
          }
        });
      } catch {
        // OTel API unavailable — just execute.
        return fn();
      }
    });
}

/** Capture a caught error in Sentry without swallowing it. */
export async function captureException(err: unknown, context?: Record<string, unknown>): Promise<void> {
  if (!env.SENTRY_DSN) return;
  try {
    const Sentry = (await import('@sentry/node')) as typeof import('@sentry/node');
    Sentry.captureException(err, { extra: context });
  } catch {
    // Sentry not installed — swallow.
  }
}
