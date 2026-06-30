import { env } from '../config/env';
import { getMailer, mailFrom } from '../config/email';
import { logger } from '../lib/logger';

interface SendEmailOpts {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export async function sendEmail(opts: SendEmailOpts): Promise<void> {
  const transport = getMailer();
  const info = await transport.sendMail({
    from: mailFrom,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    replyTo: opts.replyTo ?? env.EMAIL_REPLY_TO,
  });
  logger.info({ to: opts.to, subject: opts.subject, messageId: info.messageId }, 'email sent');
}

/** Email templates. Plain HTML + text; original copy. */
export const Templates = {
  otp(opts: { code: string; expiresInMinutes: number; ip?: string }): { subject: string; html: string; text: string } {
    const { code, expiresInMinutes, ip } = opts;
    const subject = `Your sign-in code: ${code}`;
    const safeCode = code.replace(/(\d{3})(\d{3})/, '$1 $2');
    const text = [
      `Your one-time sign-in code is ${safeCode}.`,
      `It expires in ${expiresInMinutes} minutes.`,
      ip ? `Requested from ${ip}.` : '',
      `If you didn't request this, you can safely ignore this email.`,
    ]
      .filter(Boolean)
      .join('\n\n');

    const html = `
      <div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#0f0f11">
        <h1 style="font-size:20px;margin:0 0 16px;">Sign-in code</h1>
        <p style="font-size:14px;line-height:1.5;color:#52525b;margin:0 0 24px;">
          Use this one-time code to finish signing in to VideoRankingStudio.
        </p>
        <div style="background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:24px;text-align:center;margin:0 0 24px;">
          <div style="font-family:'JetBrains Mono',ui-monospace,monospace;font-size:34px;font-weight:700;letter-spacing:8px;color:#291908;">
            ${safeCode}
          </div>
        </div>
        <p style="font-size:13px;color:#71717a;margin:0 0 8px;">This code expires in ${expiresInMinutes} minutes.</p>
        ${ip ? `<p style="font-size:13px;color:#71717a;margin:0 0 16px;">Requested from ${ip}.</p>` : ''}
        <p style="font-size:13px;color:#71717a;margin:24px 0 0;border-top:1px solid #e4e4e7;padding-top:16px;">
          If you didn't request this code, you can ignore this email.
        </p>
      </div>
    `;
    return { subject, html, text };
  },

  exportReady(opts: { projectTitle: string; downloadUrl: string }): { subject: string; html: string; text: string } {
    const subject = `Your video "${opts.projectTitle}" is ready`;
    const text = `Your video "${opts.projectTitle}" finished rendering.\n\nDownload: ${opts.downloadUrl}`;
    const html = `
      <div style="font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#0f0f11">
        <h1 style="font-size:20px;margin:0 0 16px;">Your video is ready</h1>
        <p style="font-size:14px;line-height:1.5;color:#52525b;margin:0 0 24px;">
          "${opts.projectTitle}" has finished rendering.
        </p>
        <a href="${opts.downloadUrl}" style="display:inline-block;background:#f5a70b;color:#291908;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:8px;">
          Download video
        </a>
        <p style="font-size:13px;color:#71717a;margin:24px 0 0;">Link expires in 7 days.</p>
      </div>
    `;
    return { subject, html, text };
  },
};
