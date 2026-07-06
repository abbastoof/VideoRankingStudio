/**
 * Development & production seed.
 *
 * What it seeds:
 *   - The four billing plans (FREE, CREATOR, BUSINESS, ENTERPRISE) with limits.
 *   - A handful of stock voices (provider IDs read from env at runtime).
 *   - A starter set of project templates with original copy.
 *   - In non-production: a demo admin user and a sample project.
 *
 * Idempotency: every record uses `upsert` keyed by a stable natural identifier
 * so that running the seed twice is safe.
 */

import { prisma, PlanCode, VoiceKind, VoiceProvider, UserRole } from '../src';

async function seedPlans(): Promise<void> {
  const plans = [
    {
      code: PlanCode.FREE,
      name: 'Free',
      description: 'Try the editor and ship your first short.',
      monthlyPriceCents: 0,
      annualPriceCents: 0,
      trialDays: 0,
      sortOrder: 1,
      limitsJson: {
        videosPerMonth: 5,
        voiceoverCharacters: 1500,
        transcriptionMinutes: 10,
        exportMinutes: 5,
        imageGenerations: 10,
        videoGenerations: 0,
        storageBytes: 5_368_709_120, // 5 GiB
        cloneVoiceCount: 0,
        watermark: true,
      },
      featuresJson: [
        'Up to 5 short videos per month',
        'Auto captions in 30+ languages',
        'Stock voiceover library',
        'Up to 5 minutes per export',
        '5 GB of project storage',
        'Watermark on exports',
      ],
      publishedAt: new Date(),
    },
    {
      code: PlanCode.CREATOR,
      name: 'Creator',
      description: 'For consistent creators publishing weekly.',
      monthlyPriceCents: 1900,
      annualPriceCents: 19000,
      trialDays: 7,
      sortOrder: 2,
      highlight: true,
      limitsJson: {
        videosPerMonth: 60,
        voiceoverCharacters: 50_000,
        transcriptionMinutes: 600,
        exportMinutes: 60,
        imageGenerations: 250,
        videoGenerations: 25,
        storageBytes: 53_687_091_200, // 50 GiB
        cloneVoiceCount: 1,
        watermark: false,
      },
      featuresJson: [
        'Up to 60 short videos per month',
        'No watermark',
        'One cloned voice',
        '50,000 voiceover characters / month',
        '10 hours of transcription / month',
        '50 GB of project storage',
        'Priority queue for AI jobs',
      ],
      publishedAt: new Date(),
    },
    {
      code: PlanCode.BUSINESS,
      name: 'Business',
      description: 'For teams and agencies producing at scale.',
      monthlyPriceCents: 4900,
      annualPriceCents: 49000,
      trialDays: 7,
      sortOrder: 3,
      limitsJson: {
        videosPerMonth: 250,
        voiceoverCharacters: 200_000,
        transcriptionMinutes: 3000,
        exportMinutes: 300,
        imageGenerations: 1500,
        videoGenerations: 200,
        storageBytes: 214_748_364_800, // 200 GiB
        cloneVoiceCount: 5,
        watermark: false,
      },
      featuresJson: [
        'Up to 250 short videos per month',
        '5 cloned voices',
        '200,000 voiceover characters / month',
        '50 hours of transcription / month',
        '200 GB of project storage',
        'Direct publish to YouTube and TikTok',
        'Premium support',
      ],
      publishedAt: new Date(),
    },
    {
      code: PlanCode.ENTERPRISE,
      name: 'Enterprise',
      description: 'Custom plans for high-volume teams. Contact sales.',
      monthlyPriceCents: 0, // billed externally
      annualPriceCents: 0,
      trialDays: 0,
      sortOrder: 4,
      limitsJson: {
        videosPerMonth: -1, // -1 == unlimited (enforced in service layer)
        voiceoverCharacters: -1,
        transcriptionMinutes: -1,
        exportMinutes: -1,
        imageGenerations: -1,
        videoGenerations: -1,
        storageBytes: -1,
        cloneVoiceCount: -1,
        watermark: false,
      },
      featuresJson: [
        'Unlimited usage',
        'SSO and SCIM',
        'Dedicated GPU pool',
        'SLA-backed support',
        'Custom legal terms',
      ],
      publishedAt: new Date(),
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: plan,
      create: plan,
    });
  }
  console.log(`✔ seeded ${plans.length} plans`);
}

async function seedVoices(): Promise<void> {
  // Stock voices are abstract identifiers; the provider mapping is resolved
  // at runtime by the TTS service using env vars. Providers can be swapped
  // without changing these rows.
  const voices = [
    {
      providerVoiceId: 'default',
      name: 'Basic (free)',
      description:
        'Offline synthetic voice with no per-character cost. Great for drafts and timing.',
      provider: VoiceProvider.INTERNAL,
      language: 'en-US',
      gender: 'neutral',
      ageGroup: 'adult',
    },
    {
      providerVoiceId: 'stock-narrator-male-us',
      name: 'Atlas',
      description: 'Confident US male narrator. Good for explainers.',
      provider: VoiceProvider.ELEVENLABS,
      language: 'en-US',
      gender: 'male',
      ageGroup: 'adult',
    },
    {
      providerVoiceId: 'stock-narrator-female-us',
      name: 'Nova',
      description: 'Warm US female narrator. Good for story content.',
      provider: VoiceProvider.ELEVENLABS,
      language: 'en-US',
      gender: 'female',
      ageGroup: 'adult',
    },
    {
      providerVoiceId: 'stock-narrator-male-uk',
      name: 'Wells',
      description: 'British male narrator. Authoritative.',
      provider: VoiceProvider.ELEVENLABS,
      language: 'en-GB',
      gender: 'male',
      ageGroup: 'adult',
    },
    {
      providerVoiceId: 'stock-narrator-female-uk',
      name: 'Harper',
      description: 'British female narrator. Approachable.',
      provider: VoiceProvider.ELEVENLABS,
      language: 'en-GB',
      gender: 'female',
      ageGroup: 'adult',
    },
    {
      providerVoiceId: 'stock-newsreader-neutral',
      name: 'Field',
      description: 'Neutral news-reader cadence.',
      provider: VoiceProvider.ELEVENLABS,
      language: 'en-US',
      gender: 'neutral',
      ageGroup: 'adult',
    },
  ];

  for (const voice of voices) {
    await prisma.voice.upsert({
      where: {
        provider_providerVoiceId: {
          provider: voice.provider,
          providerVoiceId: voice.providerVoiceId,
        },
      },
      update: voice,
      create: { ...voice, kind: VoiceKind.STOCK, userId: null },
    });
  }
  console.log(`✔ seeded ${voices.length} stock voices`);
}

async function seedTemplates(): Promise<void> {
  const templates = [
    {
      slug: 'top-10-ranking',
      title: 'Top 10 Ranking',
      category: 'ranking',
      description: 'Countdown-style ranking with split-screen visuals.',
      blueprintJson: {
        durationMs: 60_000,
        prompts: {
          script:
            'Generate a top-10 ranking script about {topic}. Each item should ' +
            'be one short sentence and end with a transition cue.',
        },
        layout: 'split-screen',
        captionStyle: 'kinetic-yellow',
      },
    },
    {
      slug: 'reddit-story',
      title: 'Reddit-Style Story',
      category: 'story',
      description: 'Narrated text story over background gameplay footage.',
      blueprintJson: {
        durationMs: 90_000,
        prompts: {
          script:
            'Rewrite the input as a first-person Reddit story. Keep tension; ' +
            'end on a question that invites comments.',
        },
        layout: 'single',
        captionStyle: 'word-highlight',
      },
    },
    {
      slug: 'listicle-quickfacts',
      title: 'Quick Facts Listicle',
      category: 'listicle',
      description: 'Five fast facts about a topic. Punchy and shareable.',
      blueprintJson: {
        durationMs: 45_000,
        prompts: {
          script:
            'Produce five surprising facts about {topic}. Each fact must be ' +
            'under 12 words.',
        },
        layout: 'single',
        captionStyle: 'block-bold',
      },
    },
    {
      slug: 'commentary-react',
      title: 'Reaction Commentary',
      category: 'commentary',
      description: 'Picture-in-picture reaction over source footage.',
      blueprintJson: {
        durationMs: 60_000,
        prompts: {
          script:
            'Write a four-beat reaction script that interrupts the source at ' +
            '{cuePoints}. Keep each beat under eight seconds.',
        },
        layout: 'pip',
        captionStyle: 'subtle-bottom',
      },
    },
    {
      slug: 'tutorial-howto',
      title: 'How-To Tutorial',
      category: 'tutorial',
      description: 'Step-by-step instructional video with on-screen labels.',
      blueprintJson: {
        durationMs: 75_000,
        prompts: {
          script:
            'Outline {topic} as 5–7 numbered steps. Each step should fit ' +
            'within a 7-second voiceover.',
        },
        layout: 'single',
        captionStyle: 'kinetic-yellow',
      },
    },
  ];

  for (const template of templates) {
    await prisma.template.upsert({
      where: { slug: template.slug },
      update: { ...template, publishedAt: new Date() },
      create: { ...template, publishedAt: new Date() },
    });
  }
  console.log(`✔ seeded ${templates.length} templates`);
}

async function seedDevAdmin(): Promise<void> {
  if (process.env.NODE_ENV === 'production') return;

  const email = 'admin@videorankingstudio.local';
  await prisma.user.upsert({
    where: { email },
    update: { role: UserRole.ADMIN, name: 'Local Admin' },
    create: {
      email,
      name: 'Local Admin',
      role: UserRole.ADMIN,
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`✔ seeded dev admin: ${email}`);
}

async function main(): Promise<void> {
  console.log('Seeding database...');
  await seedPlans();
  await seedVoices();
  await seedTemplates();
  await seedDevAdmin();
  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
