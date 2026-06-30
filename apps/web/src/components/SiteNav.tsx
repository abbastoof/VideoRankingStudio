import Link from 'next/link';

import { Button } from '@vrs/ui';

import { Logo } from './Logo';

export function SiteNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/85 backdrop-blur">
      <div className="container flex h-14 items-center justify-between">
        <Link href="/" aria-label="VideoRankingStudio home" className="hover:opacity-90">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
          <Link href="/#features" className="text-sm text-muted-foreground hover:text-foreground">
            Features
          </Link>
          <Link href="/#workflow" className="text-sm text-muted-foreground hover:text-foreground">
            How it works
          </Link>
          <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
          <Link href="/changelog" className="text-sm text-muted-foreground hover:text-foreground">
            Changelog
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/signin">
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
          </Link>
          <Link href="/signin?intent=signup">
            <Button size="sm">Start free</Button>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-muted/40">
      <div className="container py-10 flex flex-col gap-6 md:flex-row md:justify-between">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            The shortest path from raw footage to a polished short. Built for creators who ship every week.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          <FooterCol title="Product">
            <FooterLink href="/#features">Features</FooterLink>
            <FooterLink href="/pricing">Pricing</FooterLink>
            <FooterLink href="/changelog">Changelog</FooterLink>
            <FooterLink href="/roadmap">Roadmap</FooterLink>
          </FooterCol>
          <FooterCol title="Company">
            <FooterLink href="/about">About</FooterLink>
            <FooterLink href="/contact">Contact</FooterLink>
            <FooterLink href="/legal/terms">Terms</FooterLink>
            <FooterLink href="/legal/privacy">Privacy</FooterLink>
          </FooterCol>
          <FooterCol title="Resources">
            <FooterLink href="/docs">Docs</FooterLink>
            <FooterLink href="/blog">Blog</FooterLink>
            <FooterLink href="/status">Status</FooterLink>
            <FooterLink href="/legal/dmca">DMCA</FooterLink>
          </FooterCol>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container py-4 text-xs text-muted-foreground flex justify-between">
          <span>© {new Date().getFullYear()} VideoRankingStudio</span>
          <span>Built for ambitious creators.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="text-sm text-foreground/80 hover:text-foreground">
        {children}
      </Link>
    </li>
  );
}
