'use client';

import { useState } from 'react';

import { clientSdk } from '@/lib/client-sdk';

interface Flag {
  id: string;
  key: string;
  description: string | null;
  defaultOn: boolean;
  rolloutPercent: number;
  updatedAt: string;
}

export function FlagsTable({ initial }: { initial: Flag[] }) {
  const [flags, setFlags] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);

  async function save(id: string, changes: Partial<Flag>) {
    setSaving(id);
    try {
      await clientSdk().adminUpdateFlag(id, {
        defaultOn: changes.defaultOn,
        rolloutPercent: changes.rolloutPercent,
      });
      setFlags((prev) => prev.map((f) => (f.id === id ? { ...f, ...changes } : f)));
    } finally {
      setSaving(null);
    }
  }

  if (flags.length === 0) {
    return <p className="text-sm text-muted-foreground">No flags configured yet.</p>;
  }

  return (
    <div className="rounded-lg border border-border bg-surface-raised overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface-muted text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left">Key</th>
            <th className="px-4 py-2 text-left">Default</th>
            <th className="px-4 py-2 text-left">Rollout %</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {flags.map((f) => (
            <tr key={f.id}>
              <td className="px-4 py-3">
                <div className="font-mono text-xs">{f.key}</div>
                {f.description ? (
                  <div className="text-xs text-muted-foreground mt-0.5">{f.description}</div>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={f.defaultOn}
                    onChange={(e) => void save(f.id, { defaultOn: e.target.checked })}
                  />
                  <span>{f.defaultOn ? 'On' : 'Off'}</span>
                </label>
              </td>
              <td className="px-4 py-3">
                <input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={f.rolloutPercent}
                  onBlur={(e) => {
                    const v = Number(e.target.value);
                    if (v !== f.rolloutPercent) void save(f.id, { rolloutPercent: v });
                  }}
                  className="w-20 h-8 rounded-md border border-border bg-surface px-2 text-sm"
                />
              </td>
              <td className="px-4 py-3 text-right">
                {saving === f.id ? (
                  <span className="text-xs text-muted-foreground">Saving…</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
