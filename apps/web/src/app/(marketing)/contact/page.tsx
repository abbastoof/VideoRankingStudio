import type { Metadata } from 'next';
import { Mail, MessageSquare, Shield, ShoppingBag } from 'lucide-react';

import { Card, CardContent } from '@vrs/ui';

import { ContactForm, type ContactTopic } from '@/components/marketing/ContactForm';
import { SiteFooter, SiteNav } from '@/components/SiteNav';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Talk to the team behind VideoRankingStudio — sales, support, press, or a security disclosure. We reply from a real inbox.',
};

interface PageProps {
  searchParams?: { topic?: string };
}

const VALID_TOPICS: ContactTopic[] = ['general', 'sales', 'support', 'press', 'security'];

function normalizeTopic(input: string | undefined): ContactTopic {
  if (!input) return 'general';
  const lower = input.toLowerCase();
  if (lower === 'enterprise') return 'sales';
  return (VALID_TOPICS as string[]).includes(lower) ? (lower as ContactTopic) : 'general';
}

export default function ContactPage({ searchParams }: PageProps) {
  const initialTopic = normalizeTopic(searchParams?.topic);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="container py-16 md:py-24 max-w-5xl">
          <div className="grid gap-10 md:grid-cols-[1.1fr_1fr] md:gap-14">
            <div className="space-y-6">
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                  Talk to a real human.
                </h1>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  A short-form video studio should feel like a workshop, not a
                  call centre. Whichever route you use below, the reply comes
                  from somebody on the team who works on the product.
                </p>
              </div>

              <div className="space-y-3">
                <ContactRoute
                  icon={<MessageSquare className="h-4 w-4" aria-hidden />}
                  label="General questions"
                  detail="Ideas, feedback, or product questions from anyone."
                />
                <ContactRoute
                  icon={<ShoppingBag className="h-4 w-4" aria-hidden />}
                  label="Sales &amp; enterprise"
                  detail="Volume plans, SSO/SCIM, dedicated capacity, custom terms."
                />
                <ContactRoute
                  icon={<Mail className="h-4 w-4" aria-hidden />}
                  label="Support"
                  detail="Signed-in? Use in-app support for faster context. This works too."
                />
                <ContactRoute
                  icon={<Shield className="h-4 w-4" aria-hidden />}
                  label="Security disclosure"
                  detail="Report vulnerabilities responsibly. We acknowledge within 72 hours."
                />
              </div>

              <p className="pt-3 text-sm text-muted-foreground">
                We aim to respond within one business day. Security reports and
                trial-blocking issues get priority.
              </p>
            </div>

            <Card>
              <CardContent className="p-6 md:p-8">
                <ContactForm initialTopic={initialTopic} />
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function ContactRoute({
  icon,
  label,
  detail,
}: {
  icon: React.ReactNode;
  label: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-brand-100 text-brand-700"
        aria-hidden
      >
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}
