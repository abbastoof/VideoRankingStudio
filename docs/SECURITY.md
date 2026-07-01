# Security policy and threat model

## Attack surface

| Surface | Threats | Mitigations |
| ------- | ------- | ----------- |
| Public web app | XSS, CSRF, clickjacking | CSP, `SameSite=Lax` cookies, `X-Frame-Options: DENY`, escaped React output |
| Public API | brute force, credential stuffing | rate limits on `/auth/*`, argon2id OTP hashing, opaque rotated refresh tokens |
| File uploads | oversized files, malicious content | presigned PUT with size + MIME allowlist, direct-to-S3 (never through app) |
| URL import | SSRF, resource exhaustion | yt-dlp runs in isolated worker with egress allowlist, bounded output size |
| Stripe webhooks | replay, forgery | signature verification + `WebhookDelivery` dedupe table |
| Internal callbacks | privilege escalation | HMAC token in header, no other auth accepted |
| Admin endpoints | privilege escalation | `requireAdmin` middleware + step-up verification for sensitive actions |
| AI providers | prompt injection, data exfil | server-side prompts only, no untrusted content in system prompts |
| Object storage | data leakage | private buckets by default, signed URLs, CloudFront OAC for public bucket |

## Sensitive data

- **PII:** email, name, IP (for audit). Encrypted at rest via AWS-managed keys. Redacted in logs.
- **Payment:** card data never touches our servers. Stripe Checkout / Portal handles it end-to-end.
- **Media:** user uploads and generated content encrypted at rest. Access via signed URLs only.
- **Voice biometrics:** cloned voice samples are treated as PII. Consent record stored on the `Voice` row (`consentSignedAt`).

## Secrets management

- Local: `.env` — never committed.
- Deployed: AWS Secrets Manager. ECS task role scoped to the specific secret ARNs it needs.
- Rotation cadence:
  - JWT signing keys: quarterly, with graceful overlap.
  - Stripe webhook secret: rotate immediately when Stripe rotates.
  - Database master password: annually via a scheduled Lambda.
  - Internal service token: on any team departure.

## Content moderation

- Voice cloning requires an explicit consent statement recorded server-side.
- LLM outputs are not published without the user accepting them.
- Abuse reports feed the admin queue; `PATCH /v1/admin/abuse-reports/:id` records the resolution.
- Repeat offenders → `User.status = SUSPENDED`, which revokes sessions on the next request.

## Compliance

- GDPR: user can export or delete their account (`DELETE /v1/users/me` — soft delete with 30-day grace period, then hard purge job).
- DMCA: `docs/legal/DMCA.md` (todo — legal review) describes the takedown process. The abuse queue is the intake surface.
- SOC2: audit log already captures the events required by CC7.2. Retention configured per env.

## Reporting

Send security reports to `security@` (once the domain is provisioned). We publish a public PGP key in `SECURITY.md` at the repo root.
