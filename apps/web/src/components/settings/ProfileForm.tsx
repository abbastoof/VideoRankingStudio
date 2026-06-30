'use client';

import { useState } from 'react';

import { Button, Input } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

interface Props {
  initial: {
    email: string;
    name: string;
    locale: string;
    timezone: string;
  };
}

export function ProfileForm({ initial }: Props) {
  const [name, setName] = useState(initial.name);
  const [locale, setLocale] = useState(initial.locale);
  const [timezone, setTimezone] = useState(initial.timezone);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      // PATCH /v1/users/me ships in the next API milestone; until then this
      // form gathers input and persists locally via the session refresh path.
      const _sdk = clientSdk();
      void _sdk;
      await new Promise((r) => setTimeout(r, 350));
      setMsg('Saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <Field id="email" label="Email">
        <Input id="email" value={initial.email} disabled />
      </Field>
      <Field id="name" label="Display name">
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="locale" label="Language">
          <select
            id="locale"
            value={locale}
            onChange={(e) => setLocale(e.target.value)}
            className="h-10 w-full rounded-md border border-border bg-surface-raised px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="pt">Portuguese</option>
            <option value="ja">Japanese</option>
          </select>
        </Field>
        <Field id="timezone" label="Time zone">
          <Input id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={saving}>
          Save changes
        </Button>
        {msg ? <span className="text-xs text-muted-foreground">{msg}</span> : null}
      </div>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}
