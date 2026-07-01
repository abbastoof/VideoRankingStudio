import { closeRedis } from './config/redis';
import { logger } from './lib/logger';
import { initTracing } from './lib/tracing';
import { buildServer } from './server';

const PORT = Number(process.env.PORT ?? 4000);
const HOST = process.env.HOST ?? '0.0.0.0';

async function main(): Promise<void> {
  await initTracing();
  const app = await buildServer();

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'shutdown initiated');
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
  process.on('unhandledRejection', (reason) => {
    logger.error({ reason }, 'unhandled rejection');
  });

  await app.listen({ port: PORT, host: HOST });
  logger.info({ port: PORT, host: HOST }, 'api listening');
}

main().catch((err) => {
  logger.fatal({ err }, 'fatal boot error');
  process.exit(1);
});
