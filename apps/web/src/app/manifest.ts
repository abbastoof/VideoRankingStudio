import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VideoRankingStudio',
    short_name: 'VRS',
    description:
      'From raw footage to a finished short. Auto-captions, AI voiceover, highlights, and one-click export — all in one editor.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0b0b0f',
    theme_color: '#f5a70b',
    categories: ['productivity', 'video', 'creativity'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
