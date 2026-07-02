import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Block authenticated app surfaces and API-adjacent internals. Google
        // and friends have no business indexing an editor URL or a settings
        // page — they redirect to /signin anyway.
        disallow: [
          '/api/',
          '/dashboard',
          '/projects',
          '/rankings',
          '/templates',
          '/voices',
          '/insights',
          '/settings',
          '/billing',
          '/support',
          '/publish',
          '/notifications',
          '/admin',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
