'use client';

import { LogOut, Menu, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentType } from 'react';

import { cn } from '@vrs/ui';
import type { SessionUser } from '@vrs/types';

import { Logo } from './Logo';

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface MobileNavProps {
  user: SessionUser;
  primary: NavItem[];
  secondary: NavItem[];
  pathname: string;
  signingOut: boolean;
  onSignOut: () => void;
}

/**
 * Header trigger + slide-in drawer for the authenticated app on `<md`
 * viewports. Mirrors the desktop sidebar so users have the full information
 * architecture — primary, account, admin (if applicable), and sign-out — in
 * one reachable place. A bottom-nav would only fit 4-5 destinations and would
 * hide account/admin, so we drawer the whole thing.
 */
export function MobileNav({
  user,
  primary,
  secondary,
  pathname,
  signingOut,
  onSignOut,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const drawerId = useId();
  const drawerRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // Auto-close on route change.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock scroll, trap Tab, close on Escape, restore focus on close.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    // Snapshot the trigger at effect-run time. The ref value can change by
    // the time cleanup runs (React re-render, unmount) and the hooks linter
    // is right to flag it — we want to restore focus to the trigger that
    // *opened* the drawer, not whatever the ref points at during cleanup.
    const triggerAtOpen = triggerRef.current;

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === 'Tab') {
        const container = drawerRef.current;
        if (!container) return;
        const focusable = getFocusable(container);
        if (focusable.length === 0) {
          e.preventDefault();
          container.focus();
          return;
        }
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const current = document.activeElement as HTMLElement | null;
        if (e.shiftKey) {
          if (current === first || !container.contains(current)) {
            e.preventDefault();
            last.focus();
          }
        } else if (current === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('keydown', onKey);
      triggerAtOpen?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-controls={drawerId}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>

      <div
        className={cn(
          'fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm transition-opacity md:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      <aside
        id={drawerId}
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        aria-hidden={!open}
        tabIndex={-1}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85%] flex-col border-r border-border bg-surface shadow-xl transition-transform duration-200 ease-out md:hidden',
          open ? 'translate-x-0 visible' : '-translate-x-full invisible',
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <Link href="/dashboard" aria-label="Dashboard" onClick={() => setOpen(false)}>
            <Logo />
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <nav
          className="flex-1 overflow-y-auto px-3 py-4 space-y-6"
          aria-label="Primary"
        >
          <DrawerList items={primary} pathname={pathname} />
          <div>
            <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Account
            </p>
            <DrawerList items={secondary} pathname={pathname} />
          </div>
          {user.role === 'ADMIN' ? (
            <div>
              <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Admin
              </p>
              <DrawerList
                items={[{ href: '/admin', label: 'Admin console', icon: ShieldCheck }]}
                pathname={pathname}
              />
            </div>
          ) : null}
        </nav>

        <div className="border-t border-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
              onClick={onSignOut}
              disabled={signingOut}
              aria-label="Sign out"
              className="rounded-md p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  const selector =
    'a[href], input:not([disabled]):not([type="hidden"]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';
  return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute('inert') && el.offsetParent !== null,
  );
}

function DrawerList({ items, pathname }: { items: NavItem[]; pathname: string }) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
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
