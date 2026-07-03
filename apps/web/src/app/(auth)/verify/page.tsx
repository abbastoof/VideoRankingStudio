'use client';

import { ArrowRight, ShieldCheck } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { Button } from '@vrs/ui';
import type { AuthSession, OtpRequestResponse } from '@vrs/types';

import { api, ApiError } from '@/lib/api';

const CODE_LENGTH = 6;

/**
 * `next` comes from a URL param and is used to redirect after sign-in. If we
 * blindly navigated to it we'd have an open redirect — a phisher could send
 * `?next=https://evil.example` and bounce authenticated users off-site.
 * Accept only same-origin, path-only values. Anything else falls back to
 * the safe default.
 */
function safeNext(raw: string | null): string {
  if (!raw) return '/dashboard';
  if (!raw.startsWith('/')) return '/dashboard';
  if (raw.startsWith('//')) return '/dashboard'; // protocol-relative
  return raw;
}

export default function VerifyPage() {
  // useSearchParams needs a Suspense boundary for Next 14 static generation.
  return (
    <Suspense fallback={<VerifyFallback />}>
      <VerifyInner />
    </Suspense>
  );
}

function VerifyFallback() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="h-8 w-40 rounded bg-surface-muted animate-pulse" />
      <div className="h-14 rounded bg-surface-muted animate-pulse" />
      <div className="h-11 rounded bg-surface-muted animate-pulse" />
    </div>
  );
}

function VerifyInner() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get('email') ?? '';
  const next = safeNext(params.get('next'));

  const [digits, setDigits] = useState<string[]>(() => Array.from({ length: CODE_LENGTH }, () => ''));
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(60);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (digits.every((d) => d.length === 1) && !submitting) {
      void verify(digits.join(''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  function setDigit(idx: number, value: string) {
    const clean = value.replace(/\D/g, '').slice(-1);
    setDigits((prev) => prev.map((d, i) => (i === idx ? clean : d)));
    if (clean && idx < CODE_LENGTH - 1) {
      inputs.current[idx + 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);
    if (!pasted) return;
    e.preventDefault();
    const next = Array.from({ length: CODE_LENGTH }, (_, i) => pasted[i] ?? '');
    setDigits(next);
    inputs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus();
  }

  function handleKeyDown(idx: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) inputs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < CODE_LENGTH - 1) inputs.current[idx + 1]?.focus();
  }

  async function verify(code: string) {
    if (!email) {
      setServerError('Email is missing — start over from sign-in.');
      return;
    }
    setSubmitting(true);
    setServerError(null);
    try {
      await api.post<AuthSession>('/v1/auth/otp/verify', { email, code });
      router.push(next);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Could not verify the code. Try again.');
      }
      setDigits(Array.from({ length: CODE_LENGTH }, () => ''));
      inputs.current[0]?.focus();
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (resendCooldown > 0 || !email) return;
    try {
      const res = await api.post<OtpRequestResponse>('/v1/auth/otp/request', {
        email,
        purpose: 'SIGN_IN',
      });
      setResendCooldown(res.resendCooldownSeconds || 60);
    } catch (err) {
      if (err instanceof ApiError) setServerError(err.message);
    }
  }

  const masked = email.replace(/(^.).+(@.+)$/, (_, a, c) => `${a}•••••${c}`);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Enter your code</h1>
        <p className="text-sm text-muted-foreground">
          We emailed a six-digit code to <span className="font-medium text-foreground">{masked}</span>.
          Codes expire after 10 minutes.
        </p>
      </header>

      <div className="flex justify-between gap-2" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={1}
            aria-label={`Digit ${i + 1}`}
            className="h-14 w-12 rounded-md border border-border bg-surface-raised text-center text-2xl font-mono font-semibold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        ))}
      </div>

      {serverError ? (
        <p role="alert" className="text-sm text-danger">
          {serverError}
        </p>
      ) : null}

      <Button
        size="lg"
        fullWidth
        loading={submitting}
        leftIcon={<ShieldCheck className="h-4 w-4" />}
        onClick={() => void verify(digits.join(''))}
        disabled={digits.some((d) => !d)}
      >
        Verify and sign in
      </Button>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={() => void resend()}
          disabled={resendCooldown > 0}
          className="text-brand-600 hover:text-brand-700 disabled:text-muted-foreground"
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
        </button>
        <a href="/signin" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          Use a different email <ArrowRight className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
