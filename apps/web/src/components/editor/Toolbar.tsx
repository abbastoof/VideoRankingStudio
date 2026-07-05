'use client';

import { ChevronLeft, Download, Redo, Save, Undo, ZoomIn, ZoomOut } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Button, Input } from '@vrs/ui';

import { useEditorStore } from '@/state/editor-store';

export function Toolbar({
  onSave,
  onExport,
}: {
  onSave: () => Promise<void> | void;
  onExport: () => Promise<void> | void;
}) {
  const title = useEditorStore((s) => s.title);
  const setTitle = useEditorStore((s) => s.setTitle);
  const dirty = useEditorStore((s) => s.dirty);
  const zoomIn = useEditorStore((s) => s.zoomIn);
  const zoomOut = useEditorStore((s) => s.zoomOut);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.history.past.length > 0);
  const canRedo = useEditorStore((s) => s.history.future.length > 0);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  async function exportVideo() {
    setExporting(true);
    try {
      await onExport();
    } finally {
      setExporting(false);
    }
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-background px-4">
      <Link
        href="/projects"
        className="rounded-md p-2 text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        aria-label="Back to projects"
      >
        <ChevronLeft className="h-4 w-4" />
      </Link>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="max-w-xs"
        aria-label="Project title"
      />
      {dirty ? <span className="text-2xs text-muted-foreground">Unsaved</span> : null}

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-1 border-r border-border pr-3 mr-1">
        <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} aria-label="Undo"><Undo className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} aria-label="Redo"><Redo className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={zoomOut} aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
        <Button variant="ghost" size="icon" onClick={zoomIn} aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
      </div>

      <Button variant="outline" size="sm" loading={saving} leftIcon={<Save className="h-4 w-4" />} onClick={save}>
        Save draft
      </Button>
      <Button size="sm" loading={exporting} leftIcon={<Download className="h-4 w-4" />} onClick={exportVideo}>
        Export
      </Button>
    </header>
  );
}
