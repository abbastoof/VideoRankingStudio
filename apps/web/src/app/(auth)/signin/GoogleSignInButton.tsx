'use client';

import { useState } from 'react';

import { Button } from '@vrs/ui';

import { API_URL } from '@/lib/api';

export function GoogleSignInButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setErr(null);
    try {
      // API_URL carries the localhost fallback — a bare NEXT_PUBLIC_API_URL
      // is undefined when unset and produced literal "/undefined/..." URLs.
      const res = await fetch(`${API_URL}/v1/auth/google/authorize`, {
        credentials: 'include',
      });
      if (!res.ok) {
        setErr('Google sign-in is temporarily unavailable. Please use email instead.');
        return;
      }
      const data = (await res.json()) as { url?: string };
      if (!data.url) {
        setErr('Google sign-in is temporarily unavailable. Please use email instead.');
        return;
      }
      window.location.href = data.url;
    } catch {
      setErr('Could not reach the sign-in service. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="outline" size="lg" fullWidth loading={busy} onClick={go}>
        <GoogleGlyph className="h-4 w-4" />
        Continue with Google
      </Button>
      {err ? (
        <p role="alert" className="text-xs text-danger">
          {err}
        </p>
      ) : null}
    </div>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.3H12v4.4h6a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.2-4.7 3.2-8.1z" />
      <path fill="#34A853" d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.5-2.7c-1 .6-2.2 1-3.7 1-2.8 0-5.2-1.9-6-4.5H2.4v2.8A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M6 14.2a6.6 6.6 0 0 1 0-4.4V7H2.4a11 11 0 0 0 0 10z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .5 4.1 1.6l3.1-3.1A11 11 0 0 0 2.4 7L6 9.8c.9-2.6 3.2-4.4 6-4.4z" />
    </svg>
  );
}
