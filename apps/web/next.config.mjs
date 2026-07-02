const isProd = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Required for the Docker runtime image, which copies `.next/standalone`.
  // Without `output: 'standalone'`, `pnpm build` doesn't emit that bundle
  // and the production container COPY fails.
  output: 'standalone',
  experimental: {
    typedRoutes: true,
    serverActions: { bodySizeLimit: '2mb' },
  },
  transpilePackages: ['@vrs/ui', '@vrs/types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.amazonaws.com' },
      { protocol: 'https', hostname: '*.cloudfront.net' },
      { protocol: 'http', hostname: 'localhost' },
    ],
  },
  async headers() {
    const base = [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
      // Cross-Origin-Opener-Policy blunts cross-window attacks; allow-popups
      // is required so Google OAuth's popup callback can post back.
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
    ];
    if (isProd) {
      // HSTS is a browser commitment. Only ship when we're confident we're
      // serving HTTPS everywhere; wrong-env deployment would lock users out.
      base.push({
        key: 'Strict-Transport-Security',
        value: 'max-age=63072000; includeSubDomains; preload',
      });
    }
    return [{ source: '/(.*)', headers: base }];
  },
};

export default nextConfig;
