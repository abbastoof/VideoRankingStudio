import { prisma } from '../../src/config/db';

/**
 * Wipe every mutable table between tests. Order matters — FK cascades handle
 * most of it, but we start with the leaves for safety.
 */
export async function resetDb(): Promise<void> {
  const tables = [
    'AuditLog',
    'WebhookDelivery',
    'FeatureFlag',
    'AbuseReport',
    'TicketMessage',
    'SupportTicket',
    'Notification',
    'UsageRecord',
    'Invoice',
    'Subscription',
    'PublishJob',
    'PublishTarget',
    'Export',
    'AiJob',
    'Voiceover',
    'Voice',
    'Caption',
    'TranscriptSegment',
    'Transcript',
    'Clip',
    'Track',
    'Asset',
    'Project',
    'ApiKey',
    'OtpCode',
    'Session',
    'Account',
    'User',
  ];
  await prisma.$transaction(
    tables.map((t) => prisma.$executeRawUnsafe(`TRUNCATE TABLE "${t}" RESTART IDENTITY CASCADE`)),
  );
}

export async function seedPlanIfMissing(): Promise<void> {
  await prisma.plan.upsert({
    where: { code: 'FREE' },
    create: {
      code: 'FREE',
      name: 'Free',
      description: 'Test plan',
      limitsJson: {
        videosPerMonth: 5,
        voiceoverCharacters: 1500,
        transcriptionMinutes: 10,
        exportMinutes: 5,
        imageGenerations: 10,
        videoGenerations: 0,
        storageBytes: 5_368_709_120,
        cloneVoiceCount: 0,
        watermark: true,
      },
      featuresJson: [],
      publishedAt: new Date(),
    },
    update: {},
  });
}

export async function closeDb(): Promise<void> {
  await prisma.$disconnect();
}
