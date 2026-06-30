import { createHash, randomBytes } from 'node:crypto';

import { jwtVerify, SignJWT, type JWTPayload } from 'jose';

import { env } from '../config/env';

const ACCESS_ISSUER = 'vrs.api';
const ACCESS_AUDIENCE = 'vrs.web';

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

export interface AccessTokenPayload extends JWTPayload {
  sub: string;
  role: 'USER' | 'ADMIN' | 'SUPPORT';
  sid: string; // session id
}

export async function signAccessToken(payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'iss' | 'aud'>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ACCESS_ISSUER)
    .setAudience(ACCESS_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_TTL_SECONDS}s`)
    .sign(accessSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecret, {
    issuer: ACCESS_ISSUER,
    audience: ACCESS_AUDIENCE,
  });
  return payload as AccessTokenPayload;
}

/**
 * Refresh tokens are *opaque* random bytes — never JWTs. We store the hash
 * server-side in the `Session` table and rotate on every use, so a token
 * can't be replayed if intercepted.
 */
export function generateRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(48).toString('base64url');
  const hash = createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
