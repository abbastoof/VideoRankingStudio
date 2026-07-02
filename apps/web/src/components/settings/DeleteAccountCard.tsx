'use client';

import { AlertTriangle } from 'lucide-react';
import { useState } from 'react';

import { Button, Input } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

const CONFIRMATION_PHRASE = 'delete my account';

/**
 * Two-stage delete flow:
 *  1. Click "Delete account" to expose the confirmation form.
 *  2. Type the phrase exactly, then click Confirm.
 *
 * Backing endpoint is a soft delete with a 30-day grace period, so a
 * mistake here isn't irrecoverable — but we still make it explicit.
 */
export function DeleteAccountCard() {
  const [stage, setStage] = useState<'idle' | 'confirming' | 'submitting'>('idle');
  const [phrase, setPhrase] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (phrase.trim().toLowerCase() !== CONFIRMATION_PHRASE) {
      setErr(`Type "${CONFIRMATION_PHRASE}" to confirm.`);
      return;
    }
    setStage('submitting');
    setErr(null);
    try {
      await clientSdk().deleteAccount();
      window.location.href = '/signin?reason=account-deleted';
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not delete the account');
      setStage('confirming');
    }
  }

  if (stage === 'idle') {
    return (
      <Button
        variant="outline"
        onClick={() => setStage('confirming')}
        leftIcon={<AlertTriangle className="h-4 w-4 text-danger" />}
      >
        Delete account
      </Button>
    );
  }

  return (
    <div className="space-y-4 rounded-md border border-danger/30 bg-danger/5 p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium text-danger">This is a permanent action.</p>
        <p className="text-xs text-muted-foreground">
          Every project, export, transcript, and voiceover tied to this account
          will be scheduled for deletion after a 30-day grace period. Type{' '}
          <code className="rounded bg-surface-muted px-1 py-0.5 font-mono">
            {CONFIRMATION_PHRASE}
          </code>{' '}
          to confirm.
        </p>
      </div>
      <label className="block space-y-1.5">
        <span className="sr-only">Confirmation phrase</span>
        <Input
          value={phrase}
          onChange={(e) => setPhrase(e.target.value)}
          placeholder={CONFIRMATION_PHRASE}
          autoFocus
          autoComplete="off"
          spellCheck={false}
          aria-label="Type the confirmation phrase"
        />
      </label>
      {err ? (
        <p className="text-xs text-danger" role="alert">
          {err}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setStage('idle');
            setPhrase('');
            setErr(null);
          }}
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          loading={stage === 'submitting'}
          disabled={phrase.trim().toLowerCase() !== CONFIRMATION_PHRASE}
          onClick={submit}
        >
          Delete my account
        </Button>
      </div>
    </div>
  );
}
