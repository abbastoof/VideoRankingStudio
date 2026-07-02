'use client';

import { CheckCircle2, Send } from 'lucide-react';
import { useState } from 'react';

import { Button, Input, Textarea } from '@vrs/ui';

import { clientSdk } from '@/lib/client-sdk';

export type ContactTopic = 'general' | 'sales' | 'support' | 'press' | 'security';

interface ContactFormProps {
  initialTopic?: ContactTopic;
}

const TOPICS: { value: ContactTopic; label: string }[] = [
  { value: 'general', label: 'General enquiry' },
  { value: 'sales', label: 'Sales / enterprise' },
  { value: 'support', label: 'Support' },
  { value: 'press', label: 'Press' },
  { value: 'security', label: 'Security disclosure' },
];

const MAX_MESSAGE = 5_000;

export function ContactForm({ initialTopic = 'general' }: ContactFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [topic, setTopic] = useState<ContactTopic>(initialTopic);
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot
  const [state, setState] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [err, setErr] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    name?: string;
    email?: string;
    message?: string;
  }>({});

  function validate(): boolean {
    const next: typeof fieldErrors = {};
    if (name.trim().length === 0) next.name = 'Please enter your name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = 'Please enter a valid email address.';
    }
    if (message.trim().length < 10) next.message = 'Please share a few more details.';
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'submitting') return;
    if (!validate()) return;
    setState('submitting');
    setErr(null);
    try {
      await clientSdk().submitContactMessage({
        name: name.trim(),
        email: email.trim(),
        topic,
        message: message.trim(),
        website,
      });
      setState('success');
    } catch (e) {
      setState('error');
      setErr(e instanceof Error ? e.message : 'Could not send your message. Please try again.');
    }
  }

  if (state === 'success') {
    return (
      <div className="space-y-4 text-center">
        <div
          className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success"
          aria-hidden
        >
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold">Message received.</p>
          <p className="text-sm text-muted-foreground">
            We&apos;ll get back to you at{' '}
            <span className="font-medium text-foreground">{email}</span>. Usually
            within one business day.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setState('idle');
            setName('');
            setEmail('');
            setMessage('');
            setTopic('general');
          }}
        >
          Send another
        </Button>
      </div>
    );
  }

  const remaining = MAX_MESSAGE - message.length;

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <label htmlFor="contact-name" className="text-sm font-medium">
          Name
        </label>
        <Input
          id="contact-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          required
          maxLength={120}
          invalid={Boolean(fieldErrors.name)}
          aria-describedby={fieldErrors.name ? 'contact-name-err' : undefined}
        />
        {fieldErrors.name ? (
          <p id="contact-name-err" className="text-xs text-danger">
            {fieldErrors.name}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="contact-email" className="text-sm font-medium">
          Email
        </label>
        <Input
          id="contact-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          maxLength={254}
          invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'contact-email-err' : undefined}
        />
        {fieldErrors.email ? (
          <p id="contact-email-err" className="text-xs text-danger">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="contact-topic" className="text-sm font-medium">
          Topic
        </label>
        <select
          id="contact-topic"
          value={topic}
          onChange={(e) => setTopic(e.target.value as ContactTopic)}
          className="h-10 w-full rounded-md border border-border bg-surface-raised px-3 text-sm text-foreground focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-300"
        >
          {TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="contact-message" className="text-sm font-medium">
          Message
        </label>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
          rows={6}
          required
          maxLength={MAX_MESSAGE}
          placeholder="Tell us what you're working on and what you need."
          invalid={Boolean(fieldErrors.message)}
          aria-describedby={fieldErrors.message ? 'contact-message-err' : 'contact-message-hint'}
        />
        <div className="flex items-center justify-between text-xs">
          {fieldErrors.message ? (
            <p id="contact-message-err" className="text-danger">
              {fieldErrors.message}
            </p>
          ) : (
            <p id="contact-message-hint" className="text-muted-foreground">
              Plain text. Links are fine.
            </p>
          )}
          <p className="text-muted-foreground tabular-nums" aria-live="polite">
            {remaining.toLocaleString()} left
          </p>
        </div>
      </div>

      {/* Honeypot — hidden from real users, catches naïve bots. */}
      <div className="hidden" aria-hidden>
        <label htmlFor="contact-website">Website</label>
        <input
          id="contact-website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
        />
      </div>

      {err ? (
        <p className="text-sm text-danger" role="alert">
          {err}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-3 pt-1">
        <p className="text-xs text-muted-foreground">
          By sending, you consent to us replying to your email.
        </p>
        <Button
          type="submit"
          loading={state === 'submitting'}
          leftIcon={<Send className="h-4 w-4" />}
        >
          Send message
        </Button>
      </div>
    </form>
  );
}
