/**
 * Pulls per-video stats from YouTube for videos published through us.
 *
 * We resolve a user's YouTube PublishTarget, refresh its OAuth token if
 * needed, then query the Videos endpoint for the video IDs recorded on their
 * PublishJob rows. Results are stashed on the PublishJob.metadataJson so the
 * insights page can render aggregates without hitting YouTube every time.
 */

import { prisma } from '../config/db';
import { logger } from '../lib/logger';
import { getDecryptedTarget } from './publish.service';

interface VideoStats {
  viewCount: number;
  likeCount: number;
  commentCount: number;
  fetchedAt: string;
}

export async function refreshYouTubeStatsForUser(userId: string): Promise<{ updated: number }> {
  const target = await prisma.publishTarget.findFirst({
    where: { userId, provider: 'YOUTUBE', revokedAt: null },
  });
  if (!target) return { updated: 0 };

  const jobs = await prisma.publishJob.findMany({
    where: {
      targetId: target.id,
      status: 'PUBLISHED',
      providerVideoId: { not: null },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { id: true, providerVideoId: true, metadataJson: true },
  });
  if (jobs.length === 0) return { updated: 0 };

  const decrypted = await getDecryptedTarget(target.id);
  const accessToken = await ensureFreshAccessToken(target.id, decrypted);
  if (!accessToken) return { updated: 0 };

  // YouTube Videos.list accepts up to 50 IDs per call.
  let updated = 0;
  for (let i = 0; i < jobs.length; i += 50) {
    const batch = jobs.slice(i, i + 50);
    const ids = batch.map((j) => j.providerVideoId).filter(Boolean).join(',');
    const url = new URL('https://youtube.googleapis.com/youtube/v3/videos');
    url.searchParams.set('part', 'statistics,snippet');
    url.searchParams.set('id', ids);
    url.searchParams.set('maxResults', '50');
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      logger.warn({ status: res.status, body: await res.text() }, 'youtube.stats.fetch_failed');
      break;
    }
    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
      }>;
    };
    const now = new Date().toISOString();
    for (const item of data.items ?? []) {
      const stats: VideoStats = {
        viewCount: Number(item.statistics?.viewCount ?? 0),
        likeCount: Number(item.statistics?.likeCount ?? 0),
        commentCount: Number(item.statistics?.commentCount ?? 0),
        fetchedAt: now,
      };
      const job = batch.find((j) => j.providerVideoId === item.id);
      if (!job) continue;
      const meta = (job.metadataJson as Record<string, unknown> | null) ?? {};
      await prisma.publishJob.update({
        where: { id: job.id },
        data: { metadataJson: { ...meta, stats } as never },
      });
      updated += 1;
    }
  }
  return { updated };
}

/**
 * If the stored access token is expired, exchange the refresh token. Persist
 * the new token bundle to the PublishTarget.
 */
async function ensureFreshAccessToken(
  targetId: string,
  target: { accessToken: string; refreshToken: string | null },
): Promise<string | null> {
  // Probe cheaply: fetch a lightweight endpoint. If 401, refresh.
  const probe = await fetch(
    'https://youtube.googleapis.com/youtube/v3/channels?part=id&mine=true',
    { headers: { Authorization: `Bearer ${target.accessToken}` } },
  );
  if (probe.status !== 401) return target.accessToken;

  if (!target.refreshToken || !process.env.YOUTUBE_OAUTH_CLIENT_ID) {
    logger.warn({ targetId }, 'youtube.stats.refresh_unavailable');
    return null;
  }
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.YOUTUBE_OAUTH_CLIENT_ID,
      client_secret: process.env.YOUTUBE_OAUTH_CLIENT_SECRET ?? '',
      refresh_token: target.refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    logger.warn({ targetId, status: res.status }, 'youtube.stats.refresh_failed');
    return null;
  }
  const tokens = (await res.json()) as { access_token: string; expires_in?: number };
  // Save the refreshed access token in the encrypted store.
  const { upsertTarget } = await import('./publish.service');
  const row = await prisma.publishTarget.findUniqueOrThrow({ where: { id: targetId } });
  await upsertTarget(row.userId, {
    provider: 'YOUTUBE',
    providerAccountId: row.providerAccountId,
    displayName: row.displayName,
    accessToken: tokens.access_token,
    refreshToken: target.refreshToken,
    scopes: row.scopesJson as string[],
    expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
  });
  return tokens.access_token;
}

export async function externalStatsForUser(userId: string) {
  const jobs = await prisma.publishJob
    .findMany({
      where: {
        status: 'PUBLISHED',
        export: { userId },
      },
      include: {
        target: { select: { provider: true, displayName: true } },
        export: { select: { projectId: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 100,
    })
    .catch(() => [] as never[]);

  return jobs.map((j) => {
    const meta = (j.metadataJson as { stats?: VideoStats; title?: string }) ?? {};
    return {
      publishJobId: j.id,
      projectId: j.projectId,
      provider: j.target.provider,
      providerVideoId: j.providerVideoId,
      providerUrl: j.providerUrl,
      title: meta.title ?? '(untitled)',
      publishedAt: j.publishedAt?.toISOString() ?? null,
      views: meta.stats?.viewCount ?? null,
      likes: meta.stats?.likeCount ?? null,
      comments: meta.stats?.commentCount ?? null,
      fetchedAt: meta.stats?.fetchedAt ?? null,
    };
  });
}
