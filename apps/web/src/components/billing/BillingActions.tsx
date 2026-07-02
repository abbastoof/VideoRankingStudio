'use client';

import { useState } from 'react';

import { Button, useConfirm } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

type PlanCode = 'FREE' | 'CREATOR' | 'BUSINESS';

interface Props {
  planCode: PlanCode;
  current: boolean;
  hasSubscription: boolean;
}

export function BillingActions({ planCode, current, hasSubscription }: Props) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upgrade() {
    setBusy(true);
    setErr(null);
    try {
      const { checkoutUrl } = await clientSdk().startCheckout({
        planCode: planCode as 'CREATOR' | 'BUSINESS',
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

  async function openPortal() {
    setBusy(true);
    setErr(null);
    try {
      const { portalUrl } = await clientSdk().openPortal();
      window.location.href = portalUrl;
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not open portal');
      setBusy(false);
    }
  }

  async function cancel() {
    const ok = await confirm({
      title: 'Cancel at the end of the current period?',
      description:
        "You'll keep full access until the current period ends. You can resubscribe anytime.",
      confirmLabel: 'Cancel subscription',
      cancelLabel: 'Keep it',
      tone: 'danger',
    });
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      await clientSdk().cancelSubscription({ immediate: false });
      window.location.reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Cancel failed');
      setBusy(false);
    }
  }

  if (planCode === 'FREE') {
    return current ? (
      <Button fullWidth disabled>
        Current plan
      </Button>
    ) : (
      <Button fullWidth variant="outline" onClick={openPortal} loading={busy}>
        Manage subscription
      </Button>
    );
  }

  if (current) {
    return (
      <div className="space-y-2">
        <Button fullWidth variant="outline" onClick={openPortal} loading={busy}>
          Manage subscription
        </Button>
        <Button fullWidth variant="ghost" onClick={cancel} loading={busy}>
          Cancel at period end
        </Button>
        {err ? <p className="text-xs text-danger text-center" role="alert">{err}</p> : null}
      </div>
    );
  }

  return (
    <>
      <Button fullWidth onClick={upgrade} loading={busy}>
        {hasSubscription ? 'Switch plan' : 'Upgrade'}
      </Button>
      {err ? <p className="text-xs text-danger text-center" role="alert">{err}</p> : null}
    </>
  );
}
