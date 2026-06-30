'use client';

import { useState } from 'react';

import { Button } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

type PlanCode = 'FREE' | 'CREATOR' | 'BUSINESS';

interface Props {
  planCode: PlanCode;
  current: boolean;
  hasSubscription: boolean;
}

export function BillingActions({ planCode, current, hasSubscription }: Props) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (planCode === 'FREE') {
    return current ? (
      <Button fullWidth disabled>Current plan</Button>
    ) : (
      <Button fullWidth variant="outline" onClick={() => openPortal(setBusy, setErr)} loading={busy}>
        Manage subscription
      </Button>
    );
  }

  if (current) {
    return (
      <div className="space-y-2">
        <Button fullWidth variant="outline" onClick={() => openPortal(setBusy, setErr)} loading={busy}>
          Manage subscription
        </Button>
        <Button
          fullWidth
          variant="ghost"
          onClick={() => cancel(setBusy, setErr)}
          loading={busy}
        >
          Cancel at period end
        </Button>
        {err ? <p className="text-xs text-danger text-center">{err}</p> : null}
      </div>
    );
  }

  return (
    <>
      <Button fullWidth onClick={() => upgrade(planCode as 'CREATOR' | 'BUSINESS', setBusy, setErr)} loading={busy}>
        {hasSubscription ? 'Switch plan' : 'Upgrade'}
      </Button>
      {err ? <p className="text-xs text-danger text-center">{err}</p> : null}
    </>
  );
}

async function upgrade(
  planCode: 'CREATOR' | 'BUSINESS',
  setBusy: (b: boolean) => void,
  setErr: (s: string | null) => void,
) {
  setBusy(true);
  setErr(null);
  try {
    const sdk = clientSdk();
    const { checkoutUrl } = await sdk.startCheckout({
      planCode,
      interval: 'MONTH',
      successUrl: `${window.location.origin}/billing?status=upgraded`,
      cancelUrl: `${window.location.origin}/billing`,
    });
    window.location.href = checkoutUrl;
  } catch (e) {
    setErr(e instanceof Error ? e.message : 'Checkout failed');
    setBusy(false);
  }
}

async function openPortal(setBusy: (b: boolean) => void, setErr: (s: string | null) => void) {
  setBusy(true);
  setErr(null);
  try {
    const sdk = clientSdk();
    const { portalUrl } = await sdk.openPortal();
    window.location.href = portalUrl;
  } catch (e) {
    setErr(e instanceof Error ? e.message : 'Could not open portal');
    setBusy(false);
  }
}

async function cancel(setBusy: (b: boolean) => void, setErr: (s: string | null) => void) {
  if (!confirm('Cancel at the end of the current period? You can resubscribe any time.')) return;
  setBusy(true);
  setErr(null);
  try {
    const sdk = clientSdk();
    await sdk.cancelSubscription({ immediate: false });
    window.location.reload();
  } catch (e) {
    setErr(e instanceof Error ? e.message : 'Cancel failed');
    setBusy(false);
  }
}
