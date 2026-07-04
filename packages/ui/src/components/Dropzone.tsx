'use client';

import { UploadCloud } from 'lucide-react';
import { useRef, useState, type DragEvent, type ReactNode } from 'react';

import { cn } from '../lib/cn';
import { Button } from './Button';

export interface DropzoneProps {
  /** Called with the accepted files (post `accept`/`maxSizeBytes` filtering). */
  onFiles: (files: File[]) => void;
  /** Called when a dragged/browsed file is rejected, with a human reason. */
  onReject?: (reason: string, file: File) => void;
  /** MIME types or extensions, same syntax as `<input accept>`. */
  accept?: string;
  maxSizeBytes?: number;
  multiple?: boolean;
  disabled?: boolean;
  /** Main line, e.g. "Choose a clip or drag and drop it here". */
  label?: ReactNode;
  /** Secondary line, e.g. "MP4 format, up to 500MB". */
  hint?: ReactNode;
  browseLabel?: string;
  className?: string;
}

function matchesAccept(file: File, accept: string): boolean {
  const rules = accept
    .split(',')
    .map((r) => r.trim().toLowerCase())
    .filter(Boolean);
  if (rules.length === 0) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return rules.some((rule) => {
    if (rule.startsWith('.')) return name.endsWith(rule);
    if (rule.endsWith('/*')) return type.startsWith(rule.slice(0, -1));
    return type === rule;
  });
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${Math.round(bytes / 1_000_000_000)}GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)}MB`;
  return `${Math.round(bytes / 1_000)}KB`;
}

/**
 * File dropzone with real drag-and-drop plus click/keyboard browse.
 * Purely presentational: hand the accepted `File`s to your upload flow.
 */
export function Dropzone({
  onFiles,
  onReject,
  accept,
  maxSizeBytes,
  multiple = false,
  disabled = false,
  label = 'Choose a file or drag and drop it here',
  hint,
  browseLabel = 'Browse file',
  className,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  // Child elements fire enter/leave pairs while dragging across the zone;
  // counting keeps the highlight stable until the pointer truly exits.
  const dragDepth = useRef(0);

  function takeFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list).slice(0, multiple ? undefined : 1);
    const accepted: File[] = [];
    for (const file of files) {
      if (accept && !matchesAccept(file, accept)) {
        onReject?.('Unsupported file type', file);
        continue;
      }
      if (maxSizeBytes !== undefined && file.size > maxSizeBytes) {
        onReject?.(`File is larger than ${formatBytes(maxSizeBytes)}`, file);
        continue;
      }
      accepted.push(file);
    }
    if (accepted.length > 0) onFiles(accepted);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragActive(false);
    if (disabled) return;
    takeFiles(e.dataTransfer.files);
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-label={typeof label === 'string' ? label : 'Upload file'}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        if (disabled) return;
        dragDepth.current += 1;
        setDragActive(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragActive(false);
      }}
      onDrop={onDrop}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        dragActive
          ? 'border-brand-500 bg-brand-50'
          : 'border-border bg-surface-muted/50 hover:border-border-strong',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid h-11 w-11 place-items-center rounded-full bg-surface-raised shadow-sm transition-transform',
          dragActive && 'scale-110',
        )}
      >
        <UploadCloud className="h-5 w-5 text-muted-foreground" />
      </span>
      <p className="text-sm font-medium text-foreground">{label}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="mt-1 pointer-events-none"
        tabIndex={-1}
        aria-hidden
      >
        {browseLabel}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(e) => {
          takeFiles(e.target.files);
          // Allow re-selecting the same file.
          e.target.value = '';
        }}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
