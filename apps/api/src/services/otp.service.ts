import { randomInt } from 'node:crypto';

import argon2 from 'argon2';

import type { OtpPurpose } from '@vrs/db';

import { prisma } from '../config/db';
import { env } from '../config/env';
import { getRedis } from '../config/redis';
import { Errors } from '../lib/errors';
import { logger } from '../lib/logger';

import { sendEmail, Templates } from './email.service';

const RESEND_KEY = (email: string, purpose: OtpPurpose) => `otp:resend:${purpose}:${email.toLowerCase()}`;

function generateNumericCode(length: number): string {
  // randomInt is bias-free across the requested range.
  const max = 10 ** length;
  return randomInt(0, max).toString().padStart(length, '0');
}

export interface IssueOtpInput {
  email: string;
  purpose: OtpPurpose;
  ip?: string;
  userAgent?: string;
  userId?: string;
}

export interface IssueOtpResult {
  expiresInSeconds: number;
  resendCooldownSeconds: number;
}

export async function issueOtp(input: IssueOtpInput): Promise<IssueOtpResult> {
  const redis = getRedis();
  const normalizedEmail = input.email.toLowerCase();

  // Enforce a resend cooldown to slow down brute force / mail bombing.
  const resendTtl = await redis.ttl(RESEND_KEY(normalizedEmail, input.purpose));
  if (resendTtl > 0) {
    throw Errors.otpResendTooSoon(resendTtl);
  }

  const code = generateNumericCode(env.OTP_LENGTH);
  const codeHash = await argon2.hash(code, {
    type: argon2.argon2id,
    memoryCost: 1 << 15, // 32 MiB
    timeCost: 3,
    parallelism: 1,
  });

  const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

  // Invalidate any unused OTPs for this email+purpose; one live code at a time.
  await prisma.otpCode.updateMany({
    where: {
      email: normalizedEmail,
      purpose: input.purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: { expiresAt: new Date() },
  });

  await prisma.otpCode.create({
    data: {
      userId: input.userId ?? null,
      email: normalizedEmail,
      purpose: input.purpose,
      codeHash,
      maxAttempts: env.OTP_MAX_ATTEMPTS,
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
      expiresAt,
    },
  });

  await redis.setex(RESEND_KEY(normalizedEmail, input.purpose), env.OTP_RESEND_COOLDOWN_SECONDS, '1');

  const tmpl = Templates.otp({
    code,
    expiresInMinutes: Math.round(env.OTP_TTL_SECONDS / 60),
    ip: input.ip,
  });

  try {
    await sendEmail({ to: normalizedEmail, ...tmpl });
  } catch (err) {
    // We've already stored the code; bubble the delivery failure but don't leak it.
    logger.error({ err, email: normalizedEmail }, 'otp delivery failed');
    throw Errors.internal('Could not send the code right now — please try again');
  }

  return {
    expiresInSeconds: env.OTP_TTL_SECONDS,
    resendCooldownSeconds: env.OTP_RESEND_COOLDOWN_SECONDS,
  };
}

export interface VerifyOtpInput {
  email: string;
  code: string;
  purpose: OtpPurpose;
}

export interface VerifyOtpResult {
  userId: string | null;
  email: string;
}

export async function verifyOtp(input: VerifyOtpInput): Promise<VerifyOtpResult> {
  const normalizedEmail = input.email.toLowerCase();

  const otp = await prisma.otpCode.findFirst({
    where: {
      email: normalizedEmail,
      purpose: input.purpose,
      consumedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!otp) {
    throw Errors.otpInvalid();
  }

  if (otp.expiresAt < new Date()) {
    throw Errors.otpExpired();
  }

  if (otp.attempts >= otp.maxAttempts) {
    throw Errors.otpAttemptsExceeded();
  }

  const ok = await argon2.verify(otp.codeHash, input.code);
  if (!ok) {
    await prisma.otpCode.update({
      where: { id: otp.id },
      data: { attempts: { increment: 1 } },
    });
    throw Errors.otpInvalid();
  }

  // Atomic consume: only one concurrent verify wins. If the row is already
  // consumed (double-click, replay, network retry), treat this as an invalid
  // code rather than issuing a second session from the same OTP.
  const consumed = await prisma.otpCode.updateMany({
    where: { id: otp.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) throw Errors.otpInvalid();

  return { userId: otp.userId, email: normalizedEmail };
}
