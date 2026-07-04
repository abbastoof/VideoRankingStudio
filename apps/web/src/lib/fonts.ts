import localFont from 'next/font/local';

/**
 * Self-hosted display fonts (OFL). The same families ship as TTFs in the
 * worker image (apps/workers/assets/fonts), so what the live preview shows
 * is what the export renders.
 */

export const archivoBlack = localFont({
  src: '../fonts/ArchivoBlack-Regular.woff2',
  weight: '400',
  variable: '--font-archivo-black',
  display: 'swap',
  fallback: ['Impact', 'sans-serif'],
});

export const rubik = localFont({
  src: [
    { path: '../fonts/Rubik-Regular.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/Rubik-Bold.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-rubik',
  display: 'swap',
  fallback: ['system-ui', 'sans-serif'],
});

/**
 * Registry the title-style controls and preview render from. `family` is the
 * canonical name persisted in textJson — the worker's text renderer resolves
 * font files by this exact string.
 */
export interface TitleFont {
  family: string;
  label: string;
  cssVar: string;
  /** Whether a real bold cut exists (single-weight display fonts fake it). */
  hasBold: boolean;
}

export const TITLE_FONTS: TitleFont[] = [
  {
    family: 'Archivo Black',
    label: 'Archivo Black',
    cssVar: 'var(--font-archivo-black)',
    hasBold: false,
  },
  { family: 'Rubik', label: 'Rubik', cssVar: 'var(--font-rubik)', hasBold: true },
  { family: 'Inter', label: 'Inter', cssVar: 'var(--font-sans)', hasBold: true },
];

export function fontCssFor(family: string | undefined): string {
  const found = TITLE_FONTS.find((f) => f.family === family);
  return found ? `${found.cssVar}, sans-serif` : 'var(--font-sans), sans-serif';
}
