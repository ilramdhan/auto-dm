# n8n mode (optional)

Targeted n8n version: **1.x** (node versions: Webhook 2, Respond to Webhook 1.1, HTTP Request 4.2, IF 2.2, Set 3.4, Code 2, Split Out 1). Written against the n8n 1.x node schema from memory of the official docs; if an import warns about a node version, n8n upgrades it automatically.

## Built-in vs n8n mode

- **Built-in (default):** Meta sends webhooks straight to the app (`/api/webhooks/instagram`). Simplest; nothing else to run.
- **n8n mode:** Meta sends webhooks to your self-hosted n8n, which relays them to the app. Use it if you want to add your own steps (Telegram/Slack alerts, Google Sheets log, CRM...). The app still does all matching and sending, and one workflow serves every post and keyword.

Requirements: a self-hosted n8n 1.x reachable over **public HTTPS** (Meta rejects plain HTTP), and the app deployed at a public URL.

## Before you start

- Finish [deployment.md](deployment.md) steps 1–11 **with the direct webhook first**. If a test
  comment already gets a reply and a DM, n8n only adds your own extra steps. If it does not, n8n will
  not fix it.
- n8n must be reachable over **public HTTPS** (n8n Cloud, or self-hosted behind a domain with TLS).
  `http://localhost:5678` will not work: Meta cannot call it.

## Setup, step by step

### A. In the app: create a key and download the workflow

1. **Settings → n8n → API keys → Create API key**. Name it `n8n`, create, then **Copy API key**. It
   starts with `ard_` and is shown only once.
2. **Settings → n8n → Relay workflow → Download**. The file already contains your app URL.

### B. In n8n: import

3. **Workflows → Add workflow** (or **Create workflow**) → **⋯ menu (top right) → Import from File** →
   choose the downloaded file. You see a canvas with yellow sticky notes and these nodes:
   `Webhook GET (Meta verification)`, `Webhook POST (Meta events)`, `Extract raw body + signature`,
   `Config`, `Is verification request?`, `App: verify token`, `Respond challenge (200)`,
   `Respond 403`, `App: relay events`, `Split results`, `Any failed?`, `Notify on failure`.

### C. After importing: what to change (only 3 things)

4. **Create the credential.** Double-click **App: verify token** → under **Credential for Header
   Auth** choose **Create new credential**:
   - **Name** (the header name): `Authorization`
   - **Value**: `Bearer ard_…` (the word `Bearer`, one space, then your key)
   - Rename the credential (top left of the dialog) to `AutoDM API key` → **Save**.
5. Double-click **App: relay events** → **Credential for Header Auth** → pick the same
   `AutoDM API key`. Both HTTP nodes must use it.
6. Double-click **Config** and check `appUrl`: your app's public URL, e.g.
   `https://my-replies.vercel.app`, **no trailing slash**. (Already filled if you used the Download
   button; if you imported `n8n/autodm.workflow.json` from the repo, set it here.)
7. **Save** the workflow (Ctrl/Cmd+S), then switch the **Inactive / Active** toggle at the top to
   **Active**. Meta only reaches the Production URL of an active workflow.

Do **not** change the two Webhook nodes, the Code node or the body settings of **App: relay events**:
Meta's signature is checked on the exact original bytes.

### D. Point Meta at n8n instead of the app

8. Double-click **Webhook POST (Meta events)** → tab **Production URL** → copy it. It looks like
   `https://n8n.example.com/webhook/instagram`. (Not the Test URL.)
9. Meta dashboard → **Instagram → API setup with Instagram login → 2. Configure webhooks**:
   - **Callback URL**: the n8n Production URL from step 8.
   - **Verify token**: the same token as before, from the app **Settings → Instagram → Webhook**.
   - **Verify and save**. Check `comments` is still subscribed.
10. In the app: **Settings → Processing → Receive comments via → Through n8n** → Save. This is a
    label for the dashboard; the direct endpoint stays active, and each comment is processed at most
    once (deduplicated by comment id).

### E. Test

11. Comment your keyword from a tester account.
12. In n8n open **Executions**: you should see one run for the verification (step 9) and one per
    comment, all green. In the app, the comment appears in **Activity** as usual.

Red execution? Click it and open the failing node: see Troubleshooting below.

### Going back to the direct webhook

Set Meta's callback URL back to `https://<app>/api/webhooks/instagram`, verify and save, and choose
**Direct webhook** in Settings → Processing. You can deactivate the n8n workflow afterwards.

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
