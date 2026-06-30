import nodemailer, { type Transporter } from 'nodemailer';

import { env } from './env';
import { logger } from '../lib/logger';

let _transport: Transporter | undefined;

function buildTransport(): Transporter {
  switch (env.EMAIL_PROVIDER) {
    case 'sendgrid':
      if (!env.SENDGRID_API_KEY) {
        throw new Error('SENDGRID_API_KEY is required when EMAIL_PROVIDER=sendgrid');
      }
      return nodemailer.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        secure: false,
        auth: { user: 'apikey', pass: env.SENDGRID_API_KEY },
      });

    case 'ses':
      // For AWS SES we use SMTP creds (Identity & Access — SMTP credentials).
      // SES SDK transport is also possible; SMTP keeps the surface uniform.
      return nodemailer.createTransport({
        host: `email-smtp.${env.SES_REGION ?? 'us-east-1'}.amazonaws.com`,
        port: 587,
        secure: false,
        auth: {
          user: env.SMTP_USER ?? '',
          pass: env.SMTP_PASS ?? '',
        },
      });

    case 'smtp':
    default:
      return nodemailer.createTransport({
        host: env.SMTP_HOST ?? 'localhost',
        port: env.SMTP_PORT ?? 1025,
        secure: env.SMTP_SECURE,
        auth:
          env.SMTP_USER && env.SMTP_PASS
            ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
            : undefined,
      });
  }
}

export function getMailer(): Transporter {
  if (_transport) return _transport;
  _transport = buildTransport();
  _transport
    .verify()
    .then(() => logger.info({ provider: env.EMAIL_PROVIDER }, 'mail transport ready'))
    .catch((err) => logger.warn({ err, provider: env.EMAIL_PROVIDER }, 'mail transport verify failed'));
  return _transport;
}

export const mailFrom = `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`;
