import { closeRedis } from './config/redis';
import { logger } from './lib/logger';
import { initTracing } from './lib/tracing';
import { buildServer } from './server';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';
// Graceful shutdown ceiling. Orchestrators (ECS, K8s) send SIGTERM then
// SIGKILL some seconds later; hanging longer than the container runtime
// waits just means we get force-killed with in-flight work half-done.
const SHUTDOWN_TIMEOUT_MS = 20_000;

async function main(): Promise<void> {
  await initTracing();
  const app = await buildServer();

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutdown initiated');
    // Absolute deadline. If app.close() hangs on a stuck WebSocket or a
    // long-running handler, we'd rather exit than get SIGKILLed with logs
    // half-flushed and DB connections wedged.
    const killTimer = setTimeout(() => {
      logger.error({ signal }, 'shutdown timeout exceeded — force-exiting');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    killTimer.unref();

    try {
      await app.close();
      await closeRedis();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'shutdown failed');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  // Unhandled promise rejections are bugs. Log + crash so the orchestrator
  // restarts us instead of leaving the process in a half-broken state
  // where subsequent requests may behave unpredictably.
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'unhandled rejection — exiting');
    void shutdown('unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception — exiting');
    // Don't try to graceful-shutdown from an already-broken process.
    process.exit(1);
  });

  await app.listen({ port: PORT, host: HOST });
  logger.info({ port: PORT, host: HOST }, 'api listening');
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal boot error');
  process.exit(1);
});
