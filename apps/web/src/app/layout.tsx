import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';

import { QueryProvider } from '@/components/QueryProvider';
import { SentryClientInit } from '@/lib/sentry';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'VideoRankingStudio — AI video studio for short-form creators',
    template: '%s · VideoRankingStudio',
  },
  description:
    'Turn long footage or a script into ready-to-publish vertical video. Auto-captions, AI voiceover, highlights, and one-click export — all in one editor.',
  applicationName: 'VideoRankingStudio',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    siteName: 'VideoRankingStudio',
    images: ['/og.png'],
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/favicon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SentryClientInit />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
