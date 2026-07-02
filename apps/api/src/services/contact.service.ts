import { env } from '../config/env';
import { sendEmail } from './email.service';

interface ContactMessage {
  name: string;
  email: string;
  topic: 'general' | 'sales' | 'support' | 'press' | 'security';
  message: string;
  ip?: string;
  userAgent?: string;
}

const topicLabels: Record<ContactMessage['topic'], string> = {
  general: 'General enquiry',
  sales: 'Sales / enterprise',
  support: 'Support',
  press: 'Press',
  security: 'Security disclosure',
};

/**
 * Dispatch a contact-form message to the ops inbox. Falls back to the
 * `EMAIL_FROM_ADDRESS` if no dedicated inbox is configured — that way the
 * form works out of the box in every environment without an extra required
 * env var.
 */
export async function sendContactMessage(msg: ContactMessage): Promise<void> {
  const to = process.env.CONTACT_INBOX_EMAIL || env.EMAIL_FROM_ADDRESS;
  const topicLabel = topicLabels[msg.topic];
  const subject = `[Contact · ${topicLabel}] ${msg.name}`;

  const safeMessage = escapeHtml(msg.message);
  const meta = [msg.ip ? `IP: ${msg.ip}` : null, msg.userAgent ? `UA: ${msg.userAgent}` : null]
    .filter(Boolean)
    .join(' · ');

  const text = [
    `Topic: ${topicLabel}`,
    `From: ${msg.name} <${msg.email}>`,
    meta ? `Meta: ${meta}` : '',
    '',
    msg.message,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
    <div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f0f11">
      <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#71717a;margin:0 0 4px;">${topicLabel}</p>
      <h1 style="font-size:18px;margin:0 0 16px;">Message from ${escapeHtml(msg.name)}</h1>
      <p style="font-size:14px;color:#52525b;margin:0 0 16px;">
        <a href="mailto:${escapeHtml(msg.email)}" style="color:#0369a1;">${escapeHtml(msg.email)}</a>
      </p>
      <div style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:16px;white-space:pre-wrap;font-size:14px;line-height:1.55;color:#111827;">${safeMessage}</div>
      ${meta ? `<p style="font-size:12px;color:#a1a1aa;margin:16px 0 0;">${escapeHtml(meta)}</p>` : ''}
    </div>
  `;

  await sendEmail({ to, subject, html, text, replyTo: msg.email });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
