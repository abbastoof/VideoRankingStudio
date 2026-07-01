'use client';

import { useState } from 'react';

import { Button } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

interface Props {
  provider: 'YOUTUBE' | 'TIKTOK';
  existingId: string | null;
}

export function PublishingActions({ provider, existingId }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function connect() {
    setBusy(true);
    setErr(null);
    try {
      const res = await clientSdk().startPublishAuth(provider);
      window.location.href = res.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not start OAuth');
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!existingId) return;
    if (!confirm(`Disconnect from ${provider.toLowerCase()}?`)) return;
    setBusy(true);
    setErr(null);
    try {
      await clientSdk().revokePublishTarget(existingId);
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not disconnect');
      setBusy(false);
    }
  }

  if (existingId) {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button size="sm" variant="outline" onClick={disconnect} loading={busy}>
          Disconnect
        </Button>
        {err ? <p className="text-xs text-danger">{err}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" onClick={connect} loading={busy}>
        Connect
      </Button>
      {err ? <p className="text-xs text-danger">{err}</p> : null}
    </div>
  );
}
