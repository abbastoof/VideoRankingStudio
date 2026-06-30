import Link from 'next/link';

import { Logo } from '@/components/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <main className="flex flex-col px-6 py-8 lg:px-12">
        <Link href="/" className="inline-block w-fit">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm space-y-8">{children}</div>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} VideoRankingStudio · <Link href="/legal/terms" className="hover:text-foreground">Terms</Link> · <Link href="/legal/privacy" className="hover:text-foreground">Privacy</Link>
        </p>
      </main>
      <aside
        aria-hidden
        className="hidden lg:flex items-center justify-center bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 text-brand-foreground p-12"
      >
        <div className="max-w-md space-y-6">
          <h2 className="text-3xl font-semibold leading-tight">
            One editor. Highlights, voice, captions, export.
          </h2>
          <p className="opacity-90 leading-relaxed">
            Sign in with a code we’ll email you. No password to remember, no
            phone to verify, no friction to cancel.
          </p>
          <dl className="grid grid-cols-2 gap-6 pt-4 text-sm">
            <Stat label="Languages" value="90+" />
            <Stat label="Aspect ratios" value="9:16, 1:1, 16:9, 4:5" />
            <Stat label="Median export" value="< 2 min" />
            <Stat label="Free tier" value="No card" />
          </dl>
        </div>
      </aside>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider opacity-70">{label}</dt>
      <dd className="mt-1 text-base font-semibold">{value}</dd>
    </div>
  );
}
