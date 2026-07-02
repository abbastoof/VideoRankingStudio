import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'VideoRankingStudio — from raw footage to a finished short.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Default Open Graph image, generated at build time and cached by Next.
 * Individual pages can override with their own `opengraph-image.tsx`.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '80px',
          background: 'linear-gradient(135deg, #0b0b0f 0%, #1a1b23 55%, #2a1e0a 100%)',
          color: '#fafafa',
          fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: 16,
              background: '#f5a70b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 32 32">
              <path
                fill="#291908"
                d="M8 5.2c0-1.6 1.8-2.6 3.1-1.7l16.4 10.8c1.2.8 1.2 2.6 0 3.4L11.1 28.5c-1.3.9-3.1-.1-3.1-1.7V5.2z"
              />
            </svg>
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, letterSpacing: '-0.02em' }}>
            VideoRankingStudio
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.08,
              letterSpacing: '-0.03em',
              maxWidth: 980,
            }}
          >
            From raw footage to a finished short, in one editor.
          </div>
          <div style={{ fontSize: 30, color: '#c8c8cf', maxWidth: 900, lineHeight: 1.35 }}>
            AI captions, voiceover, highlights, one-click export.
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 22,
            color: '#a1a1aa',
          }}
        >
          <span>videorankingstudio.com</span>
          <span>Public beta · Free plan available</span>
        </div>
      </div>
    ),
    { ...size },
  );
}
