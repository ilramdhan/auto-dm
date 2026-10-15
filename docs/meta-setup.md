# Meta (Instagram) setup guide

This guide connects your own Instagram account to your own auto-reply-ig deployment. It takes about
15 minutes and costs nothing. You create **your own Meta app** (nobody else's credentials are shared),
so you stay in full control of your data.

> **Verification status.** Written October 2026 from Meta's developer documentation and secondary
> sources. The Meta developer site could not be fetched directly while writing, so items marked
> **⚠ verify** come from search snippets or third parties. Meta changes its dashboard often; if a
> label differs slightly, look for the closest match and please [open an issue](https://github.com/ilramdhan/auto-reply-ig/issues).

## What you need first

- An **Instagram Professional account** (Business or Creator). Switch in the Instagram app:
  _Settings → Account type and tools → Switch to professional account_.
- In the Instagram app: _Settings → Messages and story replies → Message controls → Connected tools →
  Allow access to messages_ **ON**. Without it every DM fails.
- A **Facebook account** to log in to developers.facebook.com (a Facebook Page is **not** required for
  the "Instagram Login" flow this app uses).
- Your app deployed and reachable over **HTTPS** (see [deployment.md](deployment.md)). Meta cannot call
  `localhost`; for local testing use a tunnel such as `cloudflared` or `ngrok`.
- You have logged in to the app and changed the default password.

Throughout, `{APP_URL}` is your public URL, e.g. `https://my-replies.vercel.app` (no trailing slash).

| Value                                                        | You will paste it into                   |
| ------------------------------------------------------------ | ---------------------------------------- |
| OAuth redirect URI: `{APP_URL}/api/instagram/oauth/callback` | Meta dashboard → Business login settings |
| Webhook callback URL: `{APP_URL}/api/webhooks/instagram`     | Meta dashboard → Webhooks                |
| Verify token (shown in **Settings → Instagram**)             | Meta dashboard → Webhooks                |
| Meta App ID and App Secret                                   | **Settings → Instagram** in the app      |

The app shows the callback URL and the verify token with copy buttons so you do not have to type them.

## Part 1 - Create the Meta app

1. Go to <https://developers.facebook.com/apps> and log in. If asked, register as a Meta developer
   (accept the terms, verify phone/email).
2. Click **Create app**.
3. Enter an **App name** (anything, e.g. "My Comment Replies") and a contact email. Click **Next**.
4. When asked for a use case, choose **Other** (or the option about "Manage messaging & content on
   Instagram" if shown - ⚠ verify, Meta renames use cases regularly). Then choose the app type
   **Business**. Click **Next**, then **Create app**.
5. On the app dashboard, find **Add products** (or _Products_ in the left menu) and add **Instagram**.
   Open **Instagram → API setup with Instagram login**. In newer dashboards the same page is under
   **Use cases → Manage messaging & content on Instagram → Customize**.

## Part 2 - Permissions

On the **API setup with Instagram login** page, step "Generate access tokens" lists the permissions.
This app needs three:

| Permission                           | Used for                                            |
| ------------------------------------ | --------------------------------------------------- |
| `instagram_business_basic`           | Read your profile and your media list (post picker) |
| `instagram_business_manage_comments` | Read comments, post public replies                  |
| `instagram_business_manage_messages` | Send the private reply (DM)                         |

The app requests exactly these during **Connect Instagram**. ⚠ verify: Meta's current Private Replies
page lists `instagram_business_basic` + `instagram_business_manage_comments` as requirements, and
treats `instagram_business_manage_messages` as the messaging permission. Requesting all three is the
safe choice and is what the app does.

## Part 3 - Enter the app credentials in the app

1. In the Meta dashboard open **App settings → Basic**. Copy the **App ID** and click **Show** next to
   **App Secret** (re-enter your Facebook password if prompted).
   - ⚠ verify: on the _Instagram → API setup_ page Meta also shows a separate **Instagram app ID** and
     **Instagram app secret**. For Instagram Login, **use the Instagram app ID/secret shown on the API
     setup page** if they differ from App settings → Basic.
2. In auto-reply-ig go to **Settings → Instagram**, paste **Meta App ID** and **App Secret**, and save.
   The secret is encrypted at rest and never shown again.

## Part 4 - OAuth redirect URI

1. In the Meta dashboard open **Instagram → API setup with Instagram login → 3. Set up Instagram
   business login** and click **Business login settings**.
2. Under **OAuth redirect URIs** add exactly:
   `{APP_URL}/api/instagram/oauth/callback`
3. Save. The URI must match **character for character** (https, no trailing slash).

## Part 5 - Add your Instagram account as a tester (Development mode)

New apps start in **Development mode**: only people with a role on the app can use it.

1. Dashboard → **App roles → Roles → Add People**, choose **Instagram Testers**, enter your Instagram
   username, and submit. (If your account owns the Meta developer login via Facebook, also add it as
   Administrator.)
2. Open the Instagram app (or instagram.com) with that account: _Settings → Website permissions
   (or "Apps and websites") → Tester invites_ → **Accept**.
3. Back in the dashboard, the tester should now show as accepted.

## Part 6 - Connect Instagram

1. In auto-reply-ig: **Settings → Instagram → Connect Instagram**.
2. Log in to Instagram and **Allow** all three permissions.
3. You return to the app and see your username. Behind the scenes the app exchanges the code for a
   short-lived token, upgrades it to a **long-lived (~60 days)** token, encrypts it, and subscribes
   your account to the `comments` webhook field (`POST /me/subscribed_apps`).

## Part 7 - Webhook setup

1. In the Meta dashboard open **Instagram → API setup with Instagram login → 2. Configure webhooks**.
2. **Callback URL**: `{APP_URL}/api/webhooks/instagram`
   **Verify token**: copy it from **Settings → Instagram** in the app.
3. Click **Verify and save**. Meta sends a `GET` with `hub.challenge`; the app answers if the token
   matches. If it fails, see [troubleshooting.md](troubleshooting.md).
4. In the webhook fields list, **subscribe to `comments`** (toggle it on).
5. Your account must also be subscribed to the app. The **Connect Instagram** step does this; the
   dashboard shows "Webhook subscriptions" per account on the same page.

Using n8n as relay instead? Point Meta at your n8n webhook URL and follow [n8n.md](n8n.md).

## Part 8 - Development vs Live mode (important)

|                                      | Development mode                                              | Live mode                                         |
| ------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------- |
| Who can trigger webhooks / be served | Accounts with a role on the app (admins, developers, testers) | Everyone, subject to your permission access level |
| Comments from random followers       | **Not delivered** (⚠ verify - widely reported)                | Delivered if permissions allow (see below)        |
| Needs Privacy Policy URL             | No                                                            | **Yes** (App settings → Basic)                    |

To go Live:

1. App settings → Basic: add a **Privacy Policy URL** (any public page stating how you handle data; a
   simple page on your site is fine), a **Category**, and an app icon (1024x1024).
2. Use the **toggle at the top of the dashboard** ("App mode: Development → Live").

### Standard vs Advanced Access - do I need App Review?

Meta's rule (from the Instagram Platform App Review docs): **Standard Access** is for apps that only
serve Instagram professional accounts **you own or manage** (accounts that have a role on the app).
**Advanced Access** - which requires **App Review and Business Verification** - is required when the app
serves accounts you do not own (a SaaS for other people).

For a self-hosted tool used on **your own account**, Standard Access is the intended path and App Review
is not required. The open question is whether, in Live mode with Standard Access, comments from the
general public (non-testers) reach your webhook:

- Meta's webhook documentation says apps need **Advanced Access** on the relevant permission to
  receive webhook notifications, and development mode only notifies for users with an app role.
  (⚠ verify - this wording comes from the older Facebook-Login-based docs and community reports.)
- In practice many self-hosters report that **Live mode + Standard Access + your own account** works
  for comments by anyone. Other reports say Meta requires Advanced Access for `comments` webhooks.
  **We could not confirm either from primary sources.** Test it: switch to Live, comment from a
  second account that is _not_ a tester, and check **Activity** in the app.
- If webhooks do not arrive, request Advanced Access for `instagram_business_manage_comments` and
  `instagram_business_manage_messages`: dashboard → **App Review → Permissions and features**. Expect to
  provide a screencast, a privacy policy and (for Advanced Access) **Business Verification**
  (Business settings → Security centre). Reviews can take days to weeks.

Apps migrating from Facebook Login may be granted Advanced Access automatically; that does not apply
to a brand-new app.

## Part 9 - Private Reply rules (what limits your DMs)

Verified against Meta's Private Replies documentation and secondary sources:

- **One private reply per comment.** You cannot send a second DM using the same `comment_id`.
- **Within 7 days** of the comment's creation. (Instagram Live comments: only while the broadcast is live.)
- The private reply is sent with `POST /{ig-user-id}/messages` and `recipient: { "comment_id": "..." }`.
- The message includes a link to the commented post (Meta adds it).
- **Follow-ups:** after the private reply, you may send further messages only if the user **replies**,
  which opens the standard **24-hour** messaging window.
- **Text length:** the app caps DM text at **1000 characters** (Meta's Messaging API text limit is
  commonly cited as 1000 bytes/characters - ⚠ verify exact unit; keep messages short and avoid long emoji runs).
- **Buttons:** a link button requires the _generic template_ message format. ⚠ verify that generic
  templates/buttons are accepted in a _private reply_ to a comment; if Meta rejects it the app falls
  back to a plain-text DM with the URL included in the text (see `docs/troubleshooting.md`).
- **Rate limits** (⚠ verify, from secondary sources): about **750 calls/hour per account** for private
  replies on posts/reels (100/second for Live). General Graph API call limits also apply. A typical
  creator account never gets near these, but a viral post can; the app logs failures in **Activity**.
- **Public comment replies** use `POST /{comment-id}/replies`. Don't reply to your own comments; the app
  ignores them to prevent loops. Instagram may hide spammy repeated replies - use several variants.

## Part 10 - Tokens

- Short-lived token: ~1 hour. Long-lived token: **~60 days** (⚠ verify). Refresh with
  `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=...`;
  the token must be at least 24 hours old and not expired. Each refresh gives a fresh 60 days.
- The app does this automatically with a **daily Vercel Cron** (`/api/cron/refresh-tokens`, protected
  by `CRON_SECRET`). If it ever fails (app asleep for 60+ days), just click **Connect Instagram** again.
- Graph API version: the Instagram Login host `graph.instagram.com` accepts versioned paths; at the
  time of writing the latest is reported as **v25.0** (⚠ verify at
  <https://developers.facebook.com/docs/graph-api/changelog>). The app pins one version in code.

## Is it free and unlimited?

**The software: yes.** MIT licensed, no per-contact fee, no per-message fee, no "contact limit", no
paywalled features. Hosting runs on the free tiers of Vercel Hobby and Supabase Free.

**The platform: limits come from Meta, not from this project.**

- Meta's APIs are free to use; there is no charge per comment or DM.
- Rate limits apply (see Part 9) and Meta can throttle or restrict an account that sends spam-like
  content. Don't send unsolicited promotions; only DM people who commented a keyword you asked for.
- Private replies: one per comment, within 7 days, no follow-ups unless the user answers.
- Live mode and (possibly) App Review / Business Verification are required to serve the public.
- Free-tier hosting has its own quotas (Vercel Hobby is for non-commercial use per Vercel's terms -
  ⚠ check if you run this for a business; Supabase Free pauses inactive projects after a week - the daily
  cron keeps it active).
- "Unlimited keywords / posts / campaigns" is true of the app: there is no artificial cap.

## Quick checklist

- [ ] Professional IG account
- [ ] Meta app (Business type) with Instagram product
- [ ] App ID + Secret saved in **Settings → Instagram**
- [ ] Redirect URI `{APP_URL}/api/instagram/oauth/callback` whitelisted
- [ ] IG account added as Instagram Tester and invite accepted
- [ ] **Connect Instagram** done
- [ ] Webhook callback `{APP_URL}/api/webhooks/instagram` + verify token verified, `comments` subscribed
- [ ] App switched to **Live** (privacy policy URL added)
- [ ] Test comment from a _second_ account produces a row in **Activity**

## Sources

- Private Replies: <https://developers.facebook.com/docs/instagram-platform/private-replies/>
- App Review for Instagram API: <https://developers.facebook.com/docs/instagram-platform/app-review>
- Instagram Platform overview: <https://developers.facebook.com/docs/instagram-platform/overview>
- Webhooks for Instagram: <https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-instagram>
- Secondary: <https://postproxy.dev/how-to/instagram-comment-to-dm-private-reply/>, <https://www.postmcpai.com/instagram-messaging-api>
