# Unified Login (new Meta apps)

This is an opt-in connection path. Keep `META_CONFIG_ID` unset for the original
Instagram Login path. Do not switch an already-connected deployment between modes
without disconnecting and reconnecting: existing tokens are not interchangeable.
No database schema migration or campaign deletion is required.

## Configure your deployment

1. In Vercel, set `META_CONFIG_ID` to your configuration ID for Production. Set `APP_URL`
   to your public URL (for example `https://autodm.example.com`) and redeploy.
   Replace the example domain below with your actual deployment domain.
2. In AutoDM Settings â†’ Instagram, save your Meta App ID and the
   **Meta App Secret from App settings â†’ Basic**. Do not use Instagram-specific
   credentials or place the secret in source code.
3. Keep the registered redirect URI exactly
   `https://autodm.example.com/api/instagram/oauth/callback`.
4. Click Connect Instagram **in AutoDM**. This generates a fresh signed security
   state; do not open the dashboard's placeholder login link manually.
5. Select your portfolio and share **exactly one** Instagram Creator/Business
   account. Turn on message access. Skip ad accounts; the configuration only needs
   `instagram_basic`, `instagram_manage_comments`, `instagram_manage_messages`.
6. On the **Meta app's Instagram Webhooks object**, configure
   `https://autodm.example.com/api/webhooks/instagram` and the verify token
   shown in AutoDM. Subscribe to `comments` and `messaging_postbacks`.
7. Confirm the account-level subscription in AutoDM Webhook diagnostics. Use
   Re-subscribe if necessary. Create a campaign and test a new matching comment
   from a different account. Check Activity and webhook diagnostics for errors.

## Limits and verification

This path exchanges the login code once for a system-user token, records the client
business ID/configuration/account IDs, uses Facebook Graph v27.0, and addresses the
Instagram account explicitly for media and webhook subscriptions. It retains the
existing signed-state, encrypted token storage and webhook-signature checks.
It does not pick arbitrarily when more than one account is shared.

Choose a **Never expires** configuration for unattended operation. Automatic system-user
token rotation is not implemented: the Instagram 60-day refresh endpoint is never
used in this mode. Reconnect if a finite token expires or permission is revoked.
Meta may require App Review/Advanced Access for production use; this change does not
bypass those requirements. Test login, webhook receipt and a real DM before relying
on it. Mock tests are not a live Meta approval or delivery test.

Rollback: disconnect in AutoDM while the current mode is still enabled, revert the
commit/remove `META_CONFIG_ID`, restore the matching credentials, redeploy and
reconnect. Never treat a Unified Login token as an Instagram Login token.

References:

- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/authentication/
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login/get-started/
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/migration-guide
