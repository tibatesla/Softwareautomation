# Chestone Platform — API & Account Setup Guide

This is a running reference of every third-party account and API credential the platform needs, one section per service.

Two kinds of credentials show up below:

- **Static config** — goes directly into `.env`, rarely changes (app IDs, account IDs, base URLs).
- **Rotatable secret** — goes into the `system_secrets` database table instead of `.env`, because the platform's token resolver (`src/services/system-secrets.service.ts`) reads it from there and **fails closed** (refuses to run, doesn't silently fall back) if it's missing or expired. See [How rotatable secrets get stored](#how-rotatable-secrets-get-stored) at the bottom.

---

## Overview

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Service</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Used For</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Status</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Credential Type</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Meta Business Manager</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Foundational — required before WhatsApp Cloud API or Meta Ads/CAPI can be set up</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Live</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Account only, no API key</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>WhatsApp Business Cloud API</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">WhatsApp lead capture (Module 3) — direct Meta integration, no third-party BSP</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Live</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static + rotatable</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Meta Marketing API + Conversions API</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Ad performance pull, campaign pause/scale, qualified-lead attribution (Module 4)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Live</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static + rotatable</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Google Ads API</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Ad performance pull, campaign pause/scale (Module 4)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Live</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static + rotatable</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>TikTok Marketing API</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Ad performance pull, campaign pause/scale (Module 4)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Live</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static + rotatable</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Groq</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Primary AI provider: ad advisory layer (Module 4) and WhatsApp reply guardrail (Module 3)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Live</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Ollama (self-hosted)</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Fallback AI provider for the ad advisory layer only, if Groq is unavailable (Module 4)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Live on the VPS</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">No credentials — self-hosted, no account</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Cloudinary</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Manual property photo/video upload storage (Module 5)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Live</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Meta Content Publishing</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Auto-posts a new listing to Facebook/Instagram on first photo upload (Module 5)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Code deployed, <strong>awaiting credentials</strong> — see Section 9</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static + rotatable</td>
    </tr>
  </tbody>
</table>

---

## 1. Meta Business Manager

**Why you need this first:** the WhatsApp Business Cloud API and the Meta Marketing/Conversions API both need a verified Meta Business Manager with a WhatsApp Business Account (WABA) attached. Do this before anything else on this list.

1. Go to [business.facebook.com](https://business.facebook.com) and create a Business Manager account under your company name.
2. Business Settings → Business Info → complete business verification (may require your company registration documents; can take a few days).
3. Business Settings → Accounts → WhatsApp Accounts → create a WhatsApp Business Account (WABA) and add your business phone number.
4. Note your **Business Manager ID** (Business Settings → Business Info) and your **WABA ID** (WhatsApp Accounts list) — referenced throughout Section 2 below.

No API key comes out of this step directly — it's the account foundation everything else attaches to.

---

## 2. WhatsApp Business Cloud API

Direct integration with Meta's own Cloud API — there is no third-party BSP (Business Solution Provider) layer in between. This matters for two things the platform depends on: real `X-Hub-Signature-256` webhook signature verification (a BSP relay generally can't offer this), and being the authoritative source for Click-to-WhatsApp ad-attribution data (`ctwa_clid`).

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Env Var / Secret Key</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Type</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>WHATSAPP_PHONE_NUMBER_ID</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>WHATSAPP_WEBHOOK_SECRET</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>) — you generate this yourself; doubles as the URL path secret and Meta's <code>hub.verify_token</code></td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>META_WHATSAPP_ACCESS_TOKEN</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Rotatable (<code>system_secrets</code>, provider <code>meta</code>)</td>
    </tr>
  </tbody>
</table>

1. **Register the phone number for Cloud API.** In Business Settings → WhatsApp Accounts → your WABA → Phone numbers, add the number if not already there. If this same number also needs to keep working in the regular WhatsApp Business phone app for manual replies, enable **"Business app + Cloud API coexistence"** during this step — without it, connecting the number to Cloud API disables the phone app on it.
2. **System User token.** Business Settings → Users → System Users → create one (or reuse an existing one, e.g. if it's already used for the Marketing API) → **Add Assets** → assign both the **WhatsApp Accounts** tab (your WABA, Full control) and the **Apps** tab (your Meta app, Full control) → **Generate Token** → select the app → check **whatsapp_business_messaging** and **whatsapp_business_management** permissions → expiration **Never** → this is `META_WHATSAPP_ACCESS_TOKEN`, goes into `system_secrets` (see the section at the bottom).
3. **Get the real phone_number_id.** Don't trust a value copied from the dashboard by eye — confirm it against the API directly: `GET https://graph.facebook.com/v25.0/{waba-id}/phone_numbers` with the System User token. The `id` field in the response is `WHATSAPP_PHONE_NUMBER_ID`.
4. **Register the number with the Cloud API** (a separate step from adding it in step 1 — the dashboard doesn't do this for you): `POST https://graph.facebook.com/v25.0/{phone-number-id}/register` with body `{"messaging_product": "whatsapp", "pin": "<any 6 digits you choose>"}`. Remember the PIN — you'll need it if the number is ever re-registered. Confirm success by re-fetching the phone number and checking `platform_type` is now `CLOUD_API`.
5. **Webhook subscription.** In your Meta App Dashboard → the app's WhatsApp product → Configuration: set the Callback URL to `https://<your-domain>/api/webhooks/whatsapp/<WHATSAPP_WEBHOOK_SECRET>` and the Verify Token to the same `WHATSAPP_WEBHOOK_SECRET` value → Verify and Save.
6. **Confirm the subscription actually took.** The dashboard step above only verifies the callback URL is reachable — it does **not** reliably subscribe your app to receive events (confirmed live: the callback verified successfully but zero events arrived until this step was done explicitly). Check `GET https://graph.facebook.com/v25.0/{waba-id}/subscribed_apps` with the System User token; if the response is an empty `data` array, subscribe explicitly: `POST https://graph.facebook.com/v25.0/{waba-id}/subscribed_apps`. Then confirm the `messages` field specifically is subscribed at the app level: `GET https://graph.facebook.com/v25.0/{app-id}/subscriptions`; if the `fields` array is missing/empty, subscribe it explicitly: `POST https://graph.facebook.com/v25.0/{app-id}/subscriptions` with `object=whatsapp_business_account`, `callback_url`, `verify_token`, `fields=messages`.
7. Generate `WHATSAPP_WEBHOOK_SECRET` yourself before doing steps 5-6 (any long random string — e.g. `openssl rand -hex 24`).

---

## 3. Meta Marketing API + Conversions API

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Env Var / Secret Key</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Type</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>META_APP_ID</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>META_APP_SECRET</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>) — also used to verify WhatsApp webhook HMAC signatures</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>META_AD_ACCOUNT_ID</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>META_DATASET_ID</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>META_PAGE_ID</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>META_MARKETING_API_TOKEN</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Rotatable (<code>system_secrets</code>, provider <code>meta</code>) — expires ~60 days, auto-refreshed by the token-refresh cron once seeded</td>
    </tr>
  </tbody>
</table>

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → create a new app, type **Business**. (Can be the same app used for WhatsApp in Section 2.)
2. App Settings → Basic: note the **App ID** and **App Secret** → `META_APP_ID`, `META_APP_SECRET`.
3. Add the **Marketing API** product to the app from the App Dashboard.
4. Business Settings → Users → System Users → create a System User (or reuse the one from Section 2), assign it to your ad account with the **Advertiser** role, then generate a token with `ads_management` and `ads_read` permissions → `META_MARKETING_API_TOKEN`, goes into `system_secrets`.
5. Ads Manager → account dropdown (top-left): the numeric ID shown is your ad account ID → `META_AD_ACCOUNT_ID` (just the digits, the code adds the `act_` prefix itself).
6. Events Manager → Data Sources → create or select your Dataset → note the Dataset ID → `META_DATASET_ID`.
7. Business Settings → Accounts → Pages: your connected WhatsApp Business Page's numeric ID → `META_PAGE_ID`.

---

## 4. Google Ads API

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Env Var / Secret Key</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Type</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>GOOGLE_ADS_CLIENT_ID</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>GOOGLE_ADS_CLIENT_SECRET</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>GOOGLE_ADS_DEVELOPER_TOKEN</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>GOOGLE_ADS_CUSTOMER_ID</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>GOOGLE_ADS_LOGIN_CUSTOMER_ID</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>) — only if using an MCC/manager account</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>GOOGLE_ADS_REFRESH_TOKEN</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Rotatable (<code>system_secrets</code>, provider <code>google</code>) — doesn't expire on a fixed schedule, only on revocation</td>
    </tr>
  </tbody>
</table>

1. Sign in to your Google Ads manager account (create one at [ads.google.com](https://ads.google.com) if you don't have one) → **Tools & Settings → API Center** → apply for a developer token → `GOOGLE_ADS_DEVELOPER_TOKEN`. Basic access approval can take a few days.
2. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project, enable the **Google Ads API** under APIs & Services → Library.
3. APIs & Services → Credentials → **Create Credentials → OAuth client ID** (type: Desktop app is simplest for a one-time token generation) → note the **Client ID** and **Client Secret** → `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`.
4. Generate a refresh token once, using the client ID/secret from step 3 and the scope `https://www.googleapis.com/auth/adwords` (Google's OAuth Playground at [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground) works for this, using your own client credentials under its settings gear icon) → the resulting refresh token is `GOOGLE_ADS_REFRESH_TOKEN`, goes into `system_secrets`.
5. Google Ads UI, top-right of any page: your Customer ID in `XXX-XXX-XXXX` format — strip the dashes → `GOOGLE_ADS_CUSTOMER_ID`.
6. If you're accessing the account through a manager (MCC) account, its Customer ID goes in `GOOGLE_ADS_LOGIN_CUSTOMER_ID`; leave blank otherwise.

---

## 5. TikTok Marketing API

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Env Var / Secret Key</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Type</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>TIKTOK_ADS_ADVERTISER_ID</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>TIKTOK_ADS_ACCESS_TOKEN</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Rotatable (<code>system_secrets</code>, provider <code>tiktok</code>)</td>
    </tr>
  </tbody>
</table>

1. Create a TikTok for Business account at [business.tiktok.com](https://business.tiktok.com) and set up an Advertiser account under it.
2. Register as a developer at [business-api.tiktok.com/portal](https://business-api.tiktok.com/portal) and create an app.
3. Complete the app's OAuth authorization flow against your Advertiser account to obtain an access token → `TIKTOK_ADS_ACCESS_TOKEN`, goes into `system_secrets`.
4. TikTok Ads Manager → account settings: your Advertiser ID → `TIKTOK_ADS_ADVERTISER_ID`.

**Note:** the reporting API's `dimensions` vs `metrics` fields are picky about which `data_level` they're valid for (e.g. `campaign_id` is invalid as a dimension at `AUCTION_AD` level, valid as a metric) — verified live against real TikTok API errors, see `tiktok-ads.service.ts`. If TikTok changes their API shape in the future, re-verify against a real account rather than trusting the docs alone.

---

## 6. Groq

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Env Var</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Type</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>GROQ_API_KEY</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>GROQ_MODEL</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>), defaults to <code>llama-3.3-70b-versatile</code></td>
    </tr>
  </tbody>
</table>

1. Sign up at [console.groq.com](https://console.groq.com).
2. **API Keys** → create a new key → `GROQ_API_KEY`.

This is the simplest account on this list — no business verification, no approval wait.

---

## 7. Ollama (self-hosted AI fallback)

No account, no API key — this runs directly on the production VPS as a systemd service and is the fallback provider in `src/services/ai-provider.service.ts` if Groq is unavailable. Currently used for the **ad-performance advisor only** (not the WhatsApp bot — see below).

```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2:1b
```

That's the entire setup — it starts as an enabled systemd service (`systemctl status ollama`) listening on `127.0.0.1:11434`, not exposed publicly.

**Model size is a real constraint, not a preference.** This platform's VPS is a 2 vCPU / 3.8GB box with no GPU. `llama3.2:1b` (~1.3GB loaded) responds in a few seconds; `llama3.2:3b` (~2GB loaded) was tested and timed out past 30 seconds on the same hardware — too slow to be a useful fallback. If the VPS is ever upsized, a larger/more reliable model becomes worth revisiting.

**Why the WhatsApp bot doesn't use this fallback:** tested live against the bot's actual system prompt (a longer, multi-rule prompt: stay on-topic, never fabricate listings, never invent a name, resist prompt injection, always ask the next qualification question). The 1B model held the topic restriction but dropped the "always ask the next question" instruction in 2 of 3 test cases — reliable enough for the ad advisor's single-instruction prompt, not reliable enough for a flow where a dropped instruction stalls lead qualification. `generateChatCompletion()` accepts `useOllamaFallback: false` for exactly this reason; the WhatsApp bot passes it, the ad advisor doesn't.

If Groq is ever fully replaced by Ollama as the primary provider (not just a fallback) to eliminate the external API dependency entirely, a bigger VPS and a properly-sized model (7B+) would be needed first — the current setup satisfies "self-hosted fallback with no external cost as a floor," not "primary AI on-VPS."

---

## 8. Cloudinary

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Env Var</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Type</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>CLOUDINARY_CLOUD_NAME</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>CLOUDINARY_API_KEY</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>CLOUDINARY_API_SECRET</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>) — treat as a secret even though it's listed here as static; don't commit it</td>
    </tr>
  </tbody>
</table>

1. Sign up at [cloudinary.com](https://cloudinary.com) (a free tier exists and is enough for this platform's current usage).
2. The dashboard homepage shows **Cloud Name**, **API Key**, and **API Secret** directly — no extra setup needed.

Property photos/videos upload to `chestone/properties/<property-id>/` in your Cloudinary account.

---

## 9. Meta Content Publishing (Facebook Page + Instagram auto-post)

Separate from Section 3 above: that one reads ad *performance* and manages *existing* ad campaigns; this one *publishes* a photo post to your Facebook Page (and, once linked, Instagram) automatically the moment a new property listing gets its first photo in the CRM. Reuses the same Meta app + System User from Sections 2/3 — no new app needed, just a broader token.

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Env Var / Secret Key</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Type</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>META_INSTAGRAM_BUSINESS_ACCOUNT_ID</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>) — omit entirely to auto-post to Facebook only, no Instagram</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>META_CONTENT_PUBLISHING_TOKEN</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Rotatable (<code>system_secrets</code>, provider <code>meta</code>) — a Page access token, not a System User token directly (see step 3)</td>
    </tr>
  </tbody>
</table>

Reuses the already-configured `META_PAGE_ID` (Section 3) as the Facebook Page to post to.

1. **(Instagram only) Link your Instagram Business account to the Page.** Meta Business Suite → your Page → Settings → Linked Accounts → Instagram → connect the account. It must be a Business or Creator account, not a personal one.
2. **Grant the extra permissions.** Business Settings → Users → System Users → the same System User used in Sections 2/3 → **Add Assets** → under the **Pages** tab, add your Page with **Full control** (if not already assigned there for Section 3's `META_PAGE_ID` lookup) → **Generate Token** → select the app → check **pages_manage_posts**, **pages_read_engagement**, and (if doing Instagram) **instagram_basic** + **instagram_content_publish** → expiration **Never**.
3. **Exchange it for a Page access token.** The token from step 2 is still a User/System User token — Facebook Page publishing needs a Page-specific token instead: `GET https://graph.facebook.com/v25.0/{META_PAGE_ID}?fields=access_token` using the token from step 2 as `access_token` in the request. The `access_token` field in the response is `META_CONTENT_PUBLISHING_TOKEN` — this is what actually goes into `system_secrets` (see [How rotatable secrets get stored](#how-rotatable-secrets-get-stored)), not the raw System User token.
4. **(Instagram only) Get the Instagram Business Account ID.** `GET https://graph.facebook.com/v25.0/{META_PAGE_ID}?fields=instagram_business_account` using the same Page access token from step 3. The nested `id` field is `META_INSTAGRAM_BUSINESS_ACCOUNT_ID`.

**This token doesn't auto-refresh** (unlike `META_MARKETING_API_TOKEN`'s daily cron in Section 3) — if generated with "Never" expiration in step 2, it shouldn't need rotating, but re-run `upsertSecret` (see below) if Meta ever reports it invalid.

**What actually gets posted:** a photo post using the property's first uploaded image, a caption built from its title, location, and price, and a link back to its live page on chestoneproperties.com. See `src/services/social-publishing.service.ts`. Nothing is posted for a property with no photos yet — the CRM's photo-upload step is what triggers this, not the initial "create listing" step.

**Not yet supported: TikTok.** TikTok's Content Posting API is a completely separate developer account, app, and API from the Meta one above — same category of setup as Section 5's TikTok *Ads* integration, but for organic content instead of ads. Worth a future module if/when needed, not an extension of this one.

---

## How rotatable secrets get stored

Anything marked "Rotatable" above does **not** go into `.env`. It's read at runtime from the `system_secrets` table via `resolveActiveSecret()` (`src/services/system-secrets.service.ts`), which deliberately fails closed — if the row is missing or expired, the platform refuses to make that API call rather than silently doing nothing or falling back to a stale value.

To seed one, use the `upsertSecret` helper from a one-off script (write it, run it, delete it — never commit a script containing a real secret value):

```ts
import { upsertSecret } from './src/services/system-secrets.service';

await upsertSecret('meta', 'META_MARKETING_API_TOKEN', '<the real token>', new Date('2026-09-27')); // ~60 days out
await upsertSecret('meta', 'META_WHATSAPP_ACCESS_TOKEN', '<the real token>'); // System User token, no fixed expiry if generated with "Never"
await upsertSecret('meta', 'META_CONTENT_PUBLISHING_TOKEN', '<the real Page access token>'); // no fixed expiry if generated with "Never" -- see Section 9
await upsertSecret('google', 'GOOGLE_ADS_REFRESH_TOKEN', '<the real refresh token>'); // no expiresAt -- doesn't expire on a schedule
await upsertSecret('tiktok', 'TIKTOK_ADS_ACCESS_TOKEN', '<the real access token>');
```

Meta's Marketing API token refreshes itself automatically once seeded (`src/cron/token-refresh.cron.ts`, runs daily). The WhatsApp access token, Google's refresh token, and TikTok's access token don't have that automation yet — re-run `upsertSecret` manually if any of them ever gets revoked or stops working.

---

## Future modules

Add a new numbered section here, matching the pattern above (overview table row + step-by-step + env var table), for each new external account a future module introduces.
