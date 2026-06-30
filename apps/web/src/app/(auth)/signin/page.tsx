'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, ArrowRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button, Input } from '@vrs/ui';
import { otpRequestSchema, type OtpRequest, type OtpRequestResponse } from '@vrs/types';

import { api, ApiError } from '@/lib/api';

const formSchema = otpRequestSchema.pick({ email: true }).extend({
  email: z.string().email('Enter a valid email'),
});
type FormValues = z.infer<typeof formSchema>;

export default function SignInPage() {
  const router = useRouter();
  const params = useSearchParams();
  const intent = params.get('intent') === 'signup' ? 'SIGN_UP' : 'SIGN_IN';
  const next = params.get('next') ?? undefined;

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
          We’ll email you a one-time code. No password needed.
        </p>
      </header>

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

      <p className="text-xs text-center text-muted-foreground">
        By continuing you agree to our{' '}
        <a href="/legal/terms" className="underline hover:text-foreground">Terms</a> and{' '}
        <a href="/legal/privacy" className="underline hover:text-foreground">Privacy Policy</a>.
      </p>
    </div>
  );
}
