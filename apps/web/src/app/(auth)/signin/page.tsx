'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { CheckCircle2, Info, Mail, ArrowRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button, Input } from '@vrs/ui';
import { otpRequestSchema, type OtpRequest, type OtpRequestResponse } from '@vrs/types';

import { GoogleSignInButton } from './GoogleSignInButton';
import { api, ApiError } from '@/lib/api';

const REASON_MESSAGES: Record<string, { tone: 'info' | 'success'; text: string }> = {
  'sessions-revoked': {
    tone: 'success',
    text: "You're signed out of every device. Sign in again to continue.",
  },
  'account-deleted': {
    tone: 'success',
    text: 'Your account is scheduled for deletion. Sign in within 30 days to cancel the request.',
  },
  'session-expired': {
    tone: 'info',
    text: 'Your session expired. Sign in again to continue where you left off.',
  },
};

const formSchema = otpRequestSchema.pick({ email: true }).extend({
  email: z.string().email('Enter a valid email'),
});
type FormValues = z.infer<typeof formSchema>;

export default function SignInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const intent = params.get('intent') === 'signup' ? 'SIGN_UP' : 'SIGN_IN';
  const next = params.get('next') ?? undefined;
  const reason = params.get('reason');
  const reasonMeta = reason ? REASON_MESSAGES[reason] : null;

  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '' },
    mode: 'onTouched',
  });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    setSubmitting(true);
    try {
      const body: OtpRequest = {
        email: values.email,
        purpose: intent,
      };
      await api.post<OtpRequestResponse>('/v1/auth/otp/request', body);
      const search = new URLSearchParams({ email: values.email });
      if (next) search.set('next', next);
      router.push(`/verify?${search.toString()}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Something went wrong. Try again in a moment.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {intent === 'SIGN_UP' ? 'Create your account' : 'Welcome back'}
        </h1>
        <p className="text-sm text-muted-foreground">
          We&rsquo;ll email you a one-time code. No password needed.
        </p>
      </header>

      {reasonMeta ? (
        <div
          role="status"
          className={`flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm ${
            reasonMeta.tone === 'success'
              ? 'border-success/30 bg-success/5 text-success'
              : 'border-brand-300 bg-brand-100/60 text-brand-800'
          }`}
        >
          {reasonMeta.tone === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          )}
          <p>{reasonMeta.text}</p>
        </div>
      ) : null}

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            inputMode="email"
            placeholder="you@studio.com"
            leftIcon={<Mail className="h-4 w-4" />}
            invalid={Boolean(form.formState.errors.email)}
            {...form.register('email')}
          />
          {form.formState.errors.email ? (
            <p className="text-xs text-danger">{form.formState.errors.email.message}</p>
          ) : null}
        </div>

        {serverError ? (
          <p role="alert" className="text-sm text-danger">
            {serverError}
          </p>
        ) : null}

        <Button type="submit" size="lg" fullWidth loading={submitting} rightIcon={<ArrowRight className="h-4 w-4" />}>
          Send code
        </Button>
      </form>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <div className="flex-1 h-px bg-border" />
        <span>or</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <GoogleSignInButton />

      <p className="text-xs text-center text-muted-foreground">
        By continuing you agree to our{' '}
        <a href="/legal/terms" className="underline hover:text-foreground">Terms</a> and{' '}
        <a href="/legal/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
      </p>
    </div>
  );
}
