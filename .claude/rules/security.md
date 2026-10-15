# Security rules (supplements CLAUDE.md)

- Compare secrets, signatures and tokens with the timing-safe helper in `server/crypto.ts`, never `===`.
- Verify the Meta signature against the **raw** request body (`await req.text()`), before `JSON.parse`.
- New secret setting: `secret: true` in `SETTINGS`; read via `getSetting`, expose only `configured: boolean`.
- Error messages returned to clients must not include tokens, SQL, stack traces or Graph API raw bodies; log a redacted summary.
- Outbound requests go only to `graph.instagram.com` / `api.instagram.com`, plus the fixed
  `api.github.com/repos/<owner>/<repo>/releases` URL for the Settings → About update check
  (`server/updates.ts`); never fetch user-supplied URLs.
- Validate DM button URLs as `https://` only.
- Rate-limit anything unauthenticated that touches the DB (login).
- Don't add dependencies without need; prefer built-ins (`node:crypto`).
