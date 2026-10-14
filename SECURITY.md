# Security Policy

## Supported versions

Only the latest release on `main` receives security fixes while the project is pre-1.0.

| Version                    | Supported |
| -------------------------- | --------- |
| latest `main` / newest 0.x | Yes       |
| older                      | No        |

## Reporting a vulnerability

Please **do not open a public issue**. Report privately via either:

- GitHub: [Report a vulnerability](https://github.com/ilramdhan/auto-reply-ig/security/advisories/new) (Security Advisories)
- Email: me@ilramdhan.dev (subject `SECURITY auto-reply-ig`)

Include steps to reproduce, impact and affected version. You will get an acknowledgement within 5 days and
we aim to ship a fix or mitigation within 30 days, crediting you if you wish.

## Scope

In scope: authentication/session handling, webhook signature verification, API keys, secret storage,
SQL/Row Level Security issues, SSRF/XSS/CSRF in the dashboard, leaks of tokens or secrets.
Out of scope: vulnerabilities in Meta, Vercel, Supabase or n8n themselves; social engineering; denial of
service by exhausting free-tier quotas; issues requiring a compromised admin account or leaked `APP_SECRET`.

## How secrets are protected

- Meta app secret, Instagram access tokens and the webhook verify token are encrypted at rest with
  **AES-256-GCM**. The key is derived with **HKDF** from `APP_SECRET`; it is never stored.
- Passwords are hashed with **argon2id**; sessions are httpOnly signed cookies with a `session_version`
  so password changes revoke old sessions. Login attempts are rate limited.
- API keys (n8n) are stored only as argon2id hashes plus a non-secret display prefix used for lookup; plaintext is shown once.
- Meta webhooks are verified with **`X-Hub-Signature-256`** (HMAC-SHA256 over the raw body, timing-safe
  comparison) before any parsing. Cron routes require `CRON_SECRET`.
- **Row Level Security** is enabled on every table with no policies, so the Supabase anon/public key
  cannot read or write anything.
- Secrets are never sent to the browser and never logged.
- Every page is served with a per-request **nonce-based Content-Security-Policy** (`script-src 'nonce-…' 'strict-dynamic'`, `frame-ancestors 'none'`, `object-src 'none'`), plus `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`.

## Operator hardening

Change the default admin password immediately, keep `APP_SECRET` backed up and private, set
`CRON_SECRET`, and rotate your Meta app secret if you suspect exposure.
