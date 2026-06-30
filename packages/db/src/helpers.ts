import { prisma, Prisma } from './client';
import type { PrismaClient } from '@prisma/client';

/**
 * Convenience helpers for safe transactional work.
 *
 * Usage:
 *   await withTransaction(async (tx) => {
 *     await tx.user.update(...);
 *     await tx.auditLog.create(...);
 *   });
 */

export type Tx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

const DEFAULT_TX_OPTIONS: Parameters<PrismaClient['$transaction']>[1] = {
  maxWait: 5_000,
  timeout: 30_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
};

export function withTransaction<T>(
  fn: (tx: Tx) => Promise<T>,
  options: Parameters<PrismaClient['$transaction']>[1] = {},
): Promise<T> {
  return prisma.$transaction(fn, { ...DEFAULT_TX_OPTIONS, ...options });
}

/** Translates a Prisma "not found" error into a sentinel `null`. */
export async function tryFind<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      return null;
    }
    throw err;
  }
}

/** Cursor-pagination helper. */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function buildCursorPage<T extends { id: string }>(
  items: T[],
  limit: number,
): CursorPage<T> {
  if (items.length > limit) {
    const next = items.pop()!;
    return { items, nextCursor: next.id };
  }
  return { items, nextCursor: null };
}
