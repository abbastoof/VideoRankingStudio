import type { FastifyInstance } from 'fastify';

/**
 * Prometheus metrics exposed at /metrics.
 *
 * We use `prom-client` if it's available; otherwise the endpoint returns
 * a static "no metrics" body so scrapers don't 500. Scraping is opt-in via
 * env — production always enables it.
 */

interface MinimalRegistry {
  contentType: string;
  metrics(): Promise<string> | string;
}

// Narrow accessor types over the prom-client concrete Counter/Histogram
// classes. The full generic types leak label unions across the module
// boundary; this indirection keeps the module facing consumers simple.
type CounterLike = { inc: (labels?: Record<string, string | number>, value?: number) => void };
type HistogramLike = {
  observe: (labels: Record<string, string | number>, value: number) => void;
};

let _registry: MinimalRegistry | null = null;
const _counters: Record<string, CounterLike> = {};
const _histograms: Record<string, HistogramLike> = {};

async function initRegistry(): Promise<void> {
  try {
    // Lazy import so environments without prom-client stay slim.
    const prom = (await import('prom-client')) as typeof import('prom-client');
    const registry = new prom.Registry();
    prom.collectDefaultMetrics({ register: registry, prefix: 'vrs_api_' });

    const httpDuration = new prom.Histogram({
      name: 'vrs_api_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
      registers: [registry],
    });

    const httpTotal = new prom.Counter({
      name: 'vrs_api_http_requests_total',
      help: 'Total HTTP requests handled',
      labelNames: ['method', 'route', 'status'],
      registers: [registry],
    });

    const jobsEnqueued = new prom.Counter({
      name: 'vrs_api_ai_jobs_enqueued_total',
      help: 'AI jobs enqueued by kind',
      labelNames: ['kind'],
      registers: [registry],
    });

    _registry = registry;
    // prom-client's Counter/Histogram carry a strongly-typed label union; the
    // module-facing accessor types (Counter/HistogramLike) are the loose
    // structural shape callers rely on. Both shapes accept the same runtime
    // inputs so the cast is safe.
    _histograms.httpDuration = httpDuration as unknown as HistogramLike;
    _counters.httpTotal = httpTotal as unknown as CounterLike;
    _counters.jobsEnqueued = jobsEnqueued as unknown as CounterLike;
  } catch {
    _registry = null;
  }
}

void initRegistry();

export async function registerMetrics(app: FastifyInstance): Promise<void> {
  app.addHook('onResponse', async (req, reply) => {
    const route = req.routeOptions.url ?? 'unmatched';
    const method = req.method;
    const status = String(reply.statusCode);
    const durationSec = reply.elapsedTime / 1000;
    _counters.httpTotal?.inc({ method, route, status });
    _histograms.httpDuration?.observe({ method, route, status }, durationSec);
  });

  app.get('/metrics', async (_req, reply) => {
    if (!_registry) {
      await reply.type('text/plain').send('# metrics disabled\n');
      return;
    }
    const body = await _registry.metrics();
    await reply.type(_registry.contentType).send(body);
  });
}

export function incAiJobEnqueued(kind: string): void {
  _counters.jobsEnqueued?.inc({ kind });
}
