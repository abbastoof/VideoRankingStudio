import type { NotificationKind } from '@vrs/db';

import { prisma } from '../config/db';
import { logger } from '../lib/logger';

/**
 * Fire-and-forget notification writer. Failures never break the caller — a
 * missed notification is annoying, but never worth breaking a user action.
 */

interface CreateNotificationOpts {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string | null;
  link?: string | null;
  metadata?: Record<string, unknown>;
}

export function notify(opts: CreateNotificationOpts): void {
  prisma.notification
    .create({
      data: {
        userId: opts.userId,
        kind: opts.kind,
        title: opts.title,
        body: opts.body ?? null,
        link: opts.link ?? null,
        metadataJson: opts.metadata ?? {},
      },
    })
    .catch((err) => logger.warn({ err, kind: opts.kind }, 'notification.write_failed'));
}
