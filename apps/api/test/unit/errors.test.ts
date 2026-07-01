import { describe, expect, it } from 'vitest';

import { AppError, Errors } from '../../src/lib/errors';

describe('AppError factory', () => {
  it('produces 404 for notFound', () => {
    const err = Errors.notFound('Project');
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toContain('Project');
  });

  it('produces 402 for projectLimitReached with details', () => {
    const err = Errors.projectLimitReached(5);
    expect(err.statusCode).toBe(402);
    expect(err.code).toBe('PROJECT_LIMIT_REACHED');
    expect(err.details).toEqual({ limit: 5 });
  });

  it('hides internal message from the client', () => {
    const err = Errors.internal('boom');
    expect(err.expose).toBe(false);
  });

  it('honours a custom message for otpResendTooSoon', () => {
    const err = Errors.otpResendTooSoon(45);
    expect(err.details).toEqual({ cooldownSeconds: 45 });
    expect(err.statusCode).toBe(429);
  });
});
