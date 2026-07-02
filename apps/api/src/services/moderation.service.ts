/**
 * Prompt moderation.
 *
 * A defence-in-depth layer between our AI generation endpoints and the
 * providers. Runs a fast local classifier first, then optionally forwards
 * the prompt to OpenAI's moderation endpoint if a key is configured.
 *
 * The local classifier deliberately errs on the side of false positives for
 * categories where a false negative could carry legal or reputational risk
 * (CSAM, identifiable-person deepfakes). Everything else defers to the
 * provider's own classifier.
 */

import { Errors } from '../lib/errors';
import { env } from '../config/env';
import { logger } from '../lib/logger';

export type ModerationCategory =
  | 'csam'
  | 'sexual'
  | 'violence'
  | 'hate'
  | 'self_harm'
  | 'illicit'
  | 'personal_impersonation';

export interface ModerationResult {
  flagged: boolean;
  categories: ModerationCategory[];
  score: number;
  source: 'local' | 'openai' | 'combined';
}

// Coarse token lists (defence-in-depth only; provider models catch nuance).
const HARD_BLOCK = [
  /\bchild\s*porn\b/i,
  /\bcsam\b/i,
  /\bunderage\s+(?:nude|sex|porn)\b/i,
  /\bkid(?:s|die)?\s+(?:nude|sex|porn)\b/i,
];

const SIGNAL_TERMS: Array<{ pattern: RegExp; category: ModerationCategory; weight: number }> = [
  { pattern: /\bnude|naked|sexual\b/i, category: 'sexual', weight: 0.4 },
  { pattern: /\bexplicit|xxx|porn\b/i, category: 'sexual', weight: 0.6 },
  { pattern: /\bkill|murder|shoot|behead\b/i, category: 'violence', weight: 0.4 },
  { pattern: /\btorture|gore|dismember\b/i, category: 'violence', weight: 0.6 },
  { pattern: /\bracial\s+slur|ethnic\s+cleansing\b/i, category: 'hate', weight: 0.8 },
  { pattern: /\bsuicide|self.?harm|cutting\s+myself\b/i, category: 'self_harm', weight: 0.6 },
  { pattern: /\bcook\s+meth|how\s+to\s+make\s+a\s+bomb|c-4\s+recipe\b/i, category: 'illicit', weight: 0.9 },
];

const CELEBRITY_MARKERS = [
  /\bimpersonat(?:e|ing|ion)\b/i,
  /\bdeepfake\b/i,
  /\bpretend\s+to\s+be\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/,
  /\bas\s+if\s+said\s+by\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/,
];

export async function moderateText(input: string): Promise<ModerationResult> {
  const local = classifyLocal(input);
  if (local.flagged && local.score >= 1.0) return local;

  if (env.OPENAI_API_KEY) {
    try {
      const remote = await classifyOpenAI(input);
      if (remote.flagged) {
        return {
          flagged: true,
          categories: Array.from(new Set([...local.categories, ...remote.categories])),
          score: Math.max(local.score, remote.score),
          source: 'combined',
        };
      }
    } catch (err) {
      logger.warn({ err }, 'moderation.openai_failed');
    }
  }
  return local;
}

export async function assertPromptAllowed(input: string): Promise<void> {
  const result = await moderateText(input);
  if (result.flagged) {
    throw Errors.unprocessable('This prompt violates our acceptable-use policy', {
      categories: result.categories,
    });
  }
}

function classifyLocal(input: string): ModerationResult {
  for (const pat of HARD_BLOCK) {
    if (pat.test(input)) {
      return { flagged: true, categories: ['csam'], score: 1.0, source: 'local' };
    }
  }

  const hits = new Map<ModerationCategory, number>();
  for (const { pattern, category, weight } of SIGNAL_TERMS) {
    if (pattern.test(input)) {
      hits.set(category, Math.max(hits.get(category) ?? 0, weight));
    }
  }
  for (const pat of CELEBRITY_MARKERS) {
    if (pat.test(input)) {
      hits.set('personal_impersonation', Math.max(hits.get('personal_impersonation') ?? 0, 0.7));
    }
  }

  const score = Math.max(0, ...hits.values());
  return {
    flagged: score >= 0.7,
    categories: Array.from(hits.keys()),
    score,
    source: 'local',
  };
}

async function classifyOpenAI(input: string): Promise<ModerationResult> {
  // Hard-cap the moderation call so a slow OpenAI incident doesn't hold user
  // requests. If the remote moderator is unreachable we fall back to the
  // local classifier's verdict — safer than letting a prompt through
  // unchecked, but also better than a 30-second stall on every request.
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), 4_000);
  let res: Response;
  try {
    res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ input, model: 'omni-moderation-latest' }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(abortTimer);
  }
  if (!res.ok) throw new Error(`moderation ${res.status}`);
  const data = (await res.json()) as {
    results?: Array<{
      flagged: boolean;
      categories?: Record<string, boolean>;
      category_scores?: Record<string, number>;
    }>;
  };
  const first = data.results?.[0];
  if (!first) return { flagged: false, categories: [], score: 0, source: 'openai' };

  const categoryMap: Record<string, ModerationCategory> = {
    'sexual/minors': 'csam',
    sexual: 'sexual',
    violence: 'violence',
    'violence/graphic': 'violence',
    hate: 'hate',
    'hate/threatening': 'hate',
    'self-harm': 'self_harm',
    'self-harm/intent': 'self_harm',
    'self-harm/instructions': 'self_harm',
    harassment: 'hate',
    'harassment/threatening': 'hate',
    illicit: 'illicit',
    'illicit/violent': 'illicit',
  };

  const mapped = new Set<ModerationCategory>();
  let score = 0;
  for (const [key, hit] of Object.entries(first.categories ?? {})) {
    const target = categoryMap[key];
    if (hit && target) mapped.add(target);
  }
  for (const [key, value] of Object.entries(first.category_scores ?? {})) {
    if (categoryMap[key]) score = Math.max(score, value);
  }
  return {
    flagged: first.flagged,
    categories: Array.from(mapped),
    score,
    source: 'openai',
  };
}
