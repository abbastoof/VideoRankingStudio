'use client';

import {
  BarChart3,
  CreditCard,
  LayoutGrid,
  LifeBuoy,
  LogOut,
  Mic2,
  Plus,
  Settings,
  ShieldCheck,
  Sparkles,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Button, cn } from '@vrs/ui';
import type { SessionUser } from '@vrs/types';

import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { api } from '@/lib/api';

interface AppShellProps {
  user: SessionUser;
  children: ReactNode;
}

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutGrid },
  { href: '/projects', label: 'Projects', icon: Video },
  { href: '/templates', label: 'Templates', icon: Sparkles },
  { href: '/voices', label: 'Voices', icon: Mic2 },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
];

const secondaryNav = [
  { href: '/settings', label: 'Settings', icon: Settings },
  { href: '/billing', label: 'Billing', icon: CreditCard },
  { href: '/support', label: 'Help & support', icon: LifeBuoy },
];

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await api.post('/v1/auth/signout');
    } finally {
      router.push('/signin');
      router.refresh();
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-surface">
        <div className="px-5 py-4 border-b border-border">
          <Link href="/dashboard" aria-label="Dashboard">
            <Logo />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6" aria-label="Primary">
          <NavList items={nav} pathname={pathname} />
          <div>
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Account
            </p>
            <NavList items={secondaryNav} pathname={pathname} />
          </div>
          {user.role === 'ADMIN' ? (
            <div>
              <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin
              </p>
              <NavList
                items={[{ href: '/admin', label: 'Admin console', icon: ShieldCheck }]}
                pathname={pathname}
              />
            </div>
          ) : null}
        </nav>

        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 rounded-md px-2 py-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-100 text-brand-700 font-semibold">
              {(user.name ?? user.email)[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
              <p className="truncate text-xs text-muted-foreground capitalize">
                {user.planCode.toLowerCase()} plan
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              disabled={signingOut}
              aria-label="Sign out"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
          <div className="md:hidden">
            <Logo variant="mark" />
          </div>
          <div className="flex flex-1 items-center justify-end gap-3">
            <Link href="/projects/new">
              <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
                New project
              </Button>
            </Link>
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

function NavList({
  items,
  pathname,
}: {
  items: { href: string; label: string; icon: typeof LayoutGrid }[];
  pathname: string;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-100 text-brand-800'
                  : 'text-foreground/80 hover:bg-surface-muted hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
