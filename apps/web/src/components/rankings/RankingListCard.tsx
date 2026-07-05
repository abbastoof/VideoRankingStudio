'use client';

import { Copy, ListOrdered, MoreVertical, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import type { ProjectSummary } from '@vrs/types';
import { Badge, Card, CardContent, cn, useConfirm, useToast } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

/** One ranking in the /rankings index: open, duplicate, delete. */
export function RankingListCard({ project }: { project: ProjectSummary }) {
  const router = useRouter();
  const confirm = useConfirm();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  async function duplicate() {
    setMenuOpen(false);
    setBusy(true);
    try {
      await clientSdk().duplicateProject(project.id);
      toast({ tone: 'success', title: 'Ranking duplicated' });
      router.refresh();
    } catch {
      toast({ tone: 'danger', title: 'Could not duplicate the ranking' });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setMenuOpen(false);
    const ok = await confirm({
      title: `Delete "${project.title}"?`,
      description: 'The ranking, its videos, and settings will be deleted.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await clientSdk().deleteProject(project.id);
      toast({ tone: 'success', title: 'Ranking deleted' });
      router.refresh();
    } catch {
      toast({ tone: 'danger', title: 'Could not delete the ranking' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn('group relative transition-shadow hover:shadow-elevation', busy && 'opacity-60')}>
      <Link
        href={`/rankings/${project.id}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded-lg"
        aria-label={`Open ranking ${project.title}`}
      >
        <div className="grid aspect-video place-items-center overflow-hidden rounded-t-lg bg-surface-muted">
          {project.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.thumbnailUrl}
              alt=""
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none"
            />
          ) : (
            <ListOrdered className="h-8 w-8 text-muted-foreground" aria-hidden />
          )}
        </div>
        <CardContent className="space-y-1.5 p-4">
          <p className="truncate text-sm font-medium">{project.title}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge tone={project.status === 'READY' ? 'brand' : 'neutral'}>
              {project.status.toLowerCase()}
            </Badge>
            <span>
              Edited{' '}
              {new Date(project.lastEditedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </CardContent>
      </Link>

      <div ref={menuRef} className="absolute right-2 top-2">
        <button
          type="button"
          aria-label={`Actions for ${project.title}`}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(
            'grid h-8 w-8 place-items-center rounded-md bg-background/80 text-muted-foreground shadow-sm backdrop-blur transition-opacity',
            'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100',
            'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
            menuOpen && 'opacity-100',
          )}
        >
          <MoreVertical className="h-4 w-4" aria-hidden />
        </button>
        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-10 mt-1 w-40 overflow-hidden rounded-md border border-border bg-surface-raised py-1 shadow-floating animate-fade-in"
          >
            <MenuItem onClick={() => void duplicate()} icon={<Copy className="h-3.5 w-3.5" />}>
              Duplicate
            </MenuItem>
            <MenuItem
              onClick={() => void remove()}
              icon={<Trash2 className="h-3.5 w-3.5" />}
              danger
            >
              Delete
            </MenuItem>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function MenuItem({
  onClick,
  icon,
  danger,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted',
        'focus-visible:outline-none focus-visible:bg-surface-muted',
        danger ? 'text-danger' : 'text-foreground',
      )}
    >
      {icon}
      {children}
    </button>
  );
}
