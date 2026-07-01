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

let _registry: MinimalRegistry | null = null;
let _counters: Record<string, { inc: (labels?: Record<string, string>, value?: number) => void }> = {};
let _histograms: Record<string, { observe: (labels: Record<string, string>, value: number) => void }> = {};

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
    _histograms.httpDuration = httpDuration;
    _counters.httpTotal = httpTotal;
    _counters.jobsEnqueued = jobsEnqueued;
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
