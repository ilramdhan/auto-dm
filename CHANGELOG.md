# Changelog

All notable changes are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning: [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Multi-post campaigns (per post/reel or all posts) with unlimited keyword rules.
- Keyword matching: word, exact and contains modes (case, accent and emoji safe).
- Public comment replies with random variants; personalised private-reply DMs with `{username}` and `{keyword}`.
- Optional link button, once-per-user rule, priority, date windows, loop protection.
- Live activity log, processing kill switch.
- Instagram Login OAuth connect, comments webhook with signature verification, idempotent deliveries.
- Automatic long-lived token refresh via daily Vercel Cron.
- Encrypted secrets (AES-256-GCM, HKDF), argon2id auth with forced first-run password change, RLS on all tables.
- Optional n8n relay and API keys.
- Auto-applied database migrations on build; one-click Vercel + Supabase deploy.
- Documentation, CI, issue/PR templates.
