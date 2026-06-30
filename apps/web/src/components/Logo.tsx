import { cn } from '@vrs/ui';

interface LogoProps {
  className?: string;
  variant?: 'mark' | 'wordmark';
}

/**
 * The brand mark is a play-triangle made of three stacked rectangles —
 * suggests a queued render moving through the pipeline. Wordmark sets it
 * beside the product name in the display weight.
 */
export function Logo({ className, variant = 'wordmark' }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2 select-none', className)}>
      <svg
        viewBox="0 0 32 32"
        className="h-6 w-6 text-brand-500"
        aria-hidden
        focusable={false}
      >
        <path
          fill="currentColor"
          d="M8 5.2c0-1.6 1.8-2.6 3.1-1.7l16.4 10.8c1.2.8 1.2 2.6 0 3.4L11.1 28.5c-1.3.9-3.1-.1-3.1-1.7V5.2z"
          opacity="0.9"
        />
        <path
          fill="currentColor"
          d="M3 9.5c0-1 1.2-1.6 2-1L19.8 16 5 23.5c-.8.4-2-.1-2-1V9.5z"
          opacity="0.55"
        />
      </svg>
      {variant === 'wordmark' ? (
        <span className="font-display text-lg font-semibold tracking-tight">
          VideoRankingStudio
        </span>
      ) : null}
    </span>
  );
}
