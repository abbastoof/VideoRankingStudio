import { prisma } from '../config/db';
import { logger } from '../lib/logger';

/**
 * Fire-and-forget audit logger. Failures never bubble up — audit gaps are
 * annoying, but never worth breaking a user request.
 */

interface AuditOpts {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  ip?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
}

export function audit(opts: AuditOpts): void {
  prisma.auditLog
    .create({
      data: {
        actorId: opts.actorId ?? null,
        action: opts.action,
        targetType: opts.targetType ?? null,
        targetId: opts.targetId ?? null,
        ip: opts.ip ?? null,
        userAgent: opts.userAgent ?? null,
        metaJson: opts.meta ?? {},
      },
    })
    .catch((err) => logger.warn({ err, action: opts.action }, 'audit.write_failed'));
}
