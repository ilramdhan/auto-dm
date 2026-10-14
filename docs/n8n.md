# n8n mode (optional)

Targeted n8n version: **1.x** (node versions: Webhook 2, Respond to Webhook 1.1, HTTP Request 4.2, IF 2.2, Set 3.4, Code 2, Split Out 1). Written against the n8n 1.x node schema from memory of the official docs; if an import warns about a node version, n8n upgrades it automatically.

## Built-in vs n8n mode

- **Built-in (default):** Meta sends webhooks straight to the app (`/api/webhooks/instagram`). Simplest; nothing else to run.
- **n8n mode:** Meta sends webhooks to your self-hosted n8n, which relays them to the app. Use it if you want to add your own steps (Telegram/Slack alerts, Google Sheets log, CRM...). The app still does all matching and sending, and one workflow serves every post and keyword.

Requirements: a self-hosted n8n 1.x reachable over **public HTTPS** (Meta rejects plain HTTP), and the app deployed at a public URL.

## Setup

1. In the app open **Settings -> n8n**, generate an **API key** and copy it (shown once). Click **Download workflow**: it is pre-filled with your app URL. (Alternative: import `n8n/auto-reply-ig.workflow.json` from the repo.)
2. In n8n choose **Workflows -> Import from file** and select the file.
3. Create a credential **Header Auth** named `auto-reply-ig API key`: Name `Authorization`, Value `Bearer <your API key>`. Select it on the two HTTP Request nodes ("App: verify token" and "App: relay events").
4. Open the **Config** node. If you did not use the pre-filled download, set `appUrl` to your app's public URL, no trailing slash. This is the only place the URL is set.
5. **Activate** the workflow.
6. Open either webhook node, copy the **Production URL** (it ends in `/webhook/instagram`; both nodes share it).
7. In the Meta app dashboard -> **Webhooks -> Instagram**, set the callback URL to that Production URL and the verify token to the value shown in the app under **Settings -> Instagram**. Click Verify and save, then subscribe to `comments`.
8. In the app, **Settings -> Processing mode**, choose **n8n** so the dashboard reflects your setup. (Both the direct webhook and the n8n relay endpoint stay active; every comment is processed at most once, deduplicated by comment id.)
9. Test: comment a keyword on a post of the connected account. Check n8n **Executions** and the app's delivery list.

## How it works

- `GET /instagram` (Meta verification): forwards `hub.mode`, `hub.verify_token`, `hub.challenge` to `{appUrl}/api/v1/n8n/verify`, responds with the challenge as `text/plain` (200), or 403 on error.
- `POST /instagram` (events): the webhook has **Raw Body** on and responds immediately (Meta needs a fast 200). The Code node reads the original bytes from the binary `data` property and the `x-hub-signature-256` header. The HTTP Request node posts that string as a raw `application/json` body to `{appUrl}/api/v1/n8n/events`, so the app can re-verify Meta's HMAC. The response `results[]` is split per comment; any `failed` status (or an HTTP error from the app) goes to the **Notify on failure** placeholder.

## Troubleshooting

- **Signature mismatch (app returns 401/403 on events):** the body was re-serialized. Keep Raw Body enabled on the POST webhook and do not change the Code/HTTP Request body settings.
- **401 from the app:** wrong or revoked API key, or the credential value is missing the `Bearer ` prefix.
- **Meta "callback URL or verify token couldn't be validated":** workflow not active (use the Production URL, not the Test URL), wrong verify token, or n8n not publicly reachable over HTTPS.
- **n8n behind a reverse proxy:** set `WEBHOOK_URL=https://n8n.example.com/` so n8n shows the correct public webhook URL, and forward `X-Forwarded-*` headers. The proxy must not alter request bodies.
- **Events arrive twice:** safe; the app deduplicates by comment id.

## Extending

Add nodes after **Split results** (one item per comment: `commentId`, `status`, `matchedKeyword`, `error`):

- Telegram/Slack/Email node after **Notify on failure** to get alerts.
- Google Sheets "Append row" to log every comment and result.
- HTTP Request to your CRM when `status` is `sent` and `matchedKeyword` is set.

Don't place nodes between the POST webhook and the HTTP Request that modify the raw body string.
