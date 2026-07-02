import type { MetadataRoute } from 'next';

import { changelog } from '@/content/changelog';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Marketing sitemap. We deliberately do not enumerate authenticated app
 * routes — those live behind sign-in and are excluded via robots.ts.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const latestChangelog = changelog[0]?.date ? new Date(changelog[0].date) : now;

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`,           lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${baseUrl}/pricing`,    lastModified: now, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${baseUrl}/about`,      lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/contact`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.5 },
    { url: `${baseUrl}/status`,     lastModified: now, changeFrequency: 'hourly',  priority: 0.4 },
    { url: `${baseUrl}/changelog`,  lastModified: latestChangelog, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${baseUrl}/roadmap`,    lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${baseUrl}/legal/terms`,   lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/legal/privacy`, lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/legal/dmca`,    lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${baseUrl}/legal/security`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
  ];

  return staticRoutes;
}
