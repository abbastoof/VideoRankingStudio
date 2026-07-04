'use client';

import { ChevronDown } from 'lucide-react';
import {
  createContext,
  useContext,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from 'react';

import { cn } from '../lib/cn';

/**
 * Controlled collapsible region with an animated height transition.
 *
 * The content animates via the `grid-template-rows: 0fr → 1fr` trick, which
 * needs no JS measurement and works for any content height.
 *
 *   <Collapsible open={open} onOpenChange={setOpen}>
 *     <CollapsibleTrigger>Video Rank 1</CollapsibleTrigger>
 *     <CollapsibleContent>…</CollapsibleContent>
 *   </Collapsible>
 */

interface CollapsibleContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contentId: string;
}

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

function useCollapsible(component: string): CollapsibleContextValue {
  const ctx = useContext(CollapsibleContext);
  if (!ctx) throw new Error(`<${component}> must be used inside <Collapsible>`);
  return ctx;
}

export interface CollapsibleProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

export function Collapsible({ open, onOpenChange, children, className }: CollapsibleProps) {
  const contentId = useId();
  return (
    <CollapsibleContext.Provider value={{ open, onOpenChange, contentId }}>
      <div className={className} data-state={open ? 'open' : 'closed'}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

export interface CollapsibleTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Hide the built-in rotating chevron. */
  hideChevron?: boolean;
}

export function CollapsibleTrigger({
  hideChevron,
  className,
  children,
  ...props
}: CollapsibleTriggerProps) {
  const ctx = useCollapsible('CollapsibleTrigger');
  return (
    <button
      type="button"
      aria-expanded={ctx.open}
      aria-controls={ctx.contentId}
      onClick={() => ctx.onOpenChange(!ctx.open)}
      className={cn(
        'inline-flex items-center gap-2 text-left',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded',
        className,
      )}
      {...props}
    >
      {hideChevron ? null : (
        <ChevronDown
          aria-hidden
          className={cn(
            'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none',
            !ctx.open && '-rotate-90',
          )}
        />
      )}
      {children}
    </button>
  );
}

export function CollapsibleContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const ctx = useCollapsible('CollapsibleContent');
  // `inert` keeps collapsed content out of the focus order and a11y tree
  // while it stays mounted for the height animation. React 18's types don't
  // know the attribute yet, hence the cast.
  const inertProps = ctx.open
    ? {}
    : ({ inert: '' } as unknown as HTMLAttributes<HTMLDivElement>);
  return (
    <div
      id={ctx.contentId}
      className={cn(
        'grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none',
        ctx.open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className={cn('overflow-hidden', className)} {...props} {...inertProps}>
        {children}
      </div>
    </div>
  );
}
