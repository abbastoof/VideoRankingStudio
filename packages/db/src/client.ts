import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client.
 *
 * In production each Node process holds one instance. In development we cache
 * the instance on `globalThis` so that Next.js hot reloading doesn't open a
 * new connection on every code change.
 */

type GlobalWithPrisma = typeof globalThis & {
  __vrsPrisma?: PrismaClient;
};

const globalForPrisma = globalThis as GlobalWithPrisma;

function buildClient(): PrismaClient {
  const logLevels =
    process.env.NODE_ENV === 'production'
      ? ['error', 'warn']
      : ['error', 'warn', 'info'];

  return new PrismaClient({
    log: logLevels.map((level) => ({
      emit: 'stdout',
      level: level as 'error' | 'warn' | 'info' | 'query',
    })),
    errorFormat: process.env.NODE_ENV === 'production' ? 'minimal' : 'pretty',
    datasources: {
      db: { url: process.env.DATABASE_URL },
    },
  });
}

export const prisma: PrismaClient =
  globalForPrisma.__vrsPrisma ?? buildClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__vrsPrisma = prisma;
}

export type { PrismaClient } from '@prisma/client';
export { Prisma } from '@prisma/client';
