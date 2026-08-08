# Chestone Platform — API & Account Setup Guide

This is a running reference of every third-party account and API credential the platform needs, one section per service. It covers everything already integrated (Modules 3–4) and leaves room for what's still coming (Module 5 and beyond) — add a new section here each time a future module introduces a new external account, so this stays the single place to check "what do I need to sign up for."

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
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Foundational — required before Wati or Meta Ads/CAPI can be set up</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Needed now</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Account only, no API key</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Wati.io</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">WhatsApp lead capture (Module 3)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Integrated, needs real account</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static + rotatable</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Meta Marketing API + Conversions API</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Ad performance pull, campaign pause/scale, qualified-lead attribution (Module 4)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Integrated, needs real account</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static + rotatable</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Google Ads API</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Ad performance pull, campaign pause/scale (Module 4)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Integrated, needs real account</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static + rotatable</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>TikTok Marketing API</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Ad performance pull, campaign pause/scale (Module 4)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Integrated, needs real account</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static + rotatable</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Groq</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">AI advisory layer on top of the ad rule engine (Module 4)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Integrated, needs real account</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Cloudinary</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Manual property photo/video upload storage (Module 5)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Planned, not yet built</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static</td>
    </tr>
  </tbody>
</table>

---

## 1. Meta Business Manager

**Why you need this first:** both Wati (for WhatsApp) and the Meta Marketing/Conversions API need a verified Meta Business Manager with a WhatsApp Business Account (WABA) attached. Do this before anything else on this list.

1. Go to [business.facebook.com](https://business.facebook.com) and create a Business Manager account under your company name.
2. Business Settings → Business Info → complete business verification (may require your company registration documents; can take a few days).
3. Business Settings → Accounts → WhatsApp Accounts → create a WhatsApp Business Account (WABA) and add your business phone number.
4. Note your **Business Manager ID** (Business Settings → Business Info) — you'll reference it during Wati's and Meta's setup below.

No API key comes out of this step directly — it's the account foundation everything else attaches to.

---

## 2. Wati.io

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Env Var</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Type</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>WATI_API_TOKEN</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>WATI_API_BASE_URL</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>WHATSAPP_WEBHOOK_SECRET</code></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>) — you generate this yourself, it's not from Wati</td>
    </tr>
  </tbody>
</table>

1. Sign up at [wati.io](https://wati.io) and pick a plan.
2. During onboarding, Wati walks you through Meta's embedded signup flow to connect the Business Manager and WABA from Section 1.
3. In the Wati dashboard: **Connector → API → Create API Token** — name it, select scopes (`contacts:read`, `contacts:write` at minimum), generate → this is `WATI_API_TOKEN`.
4. The same API page shows your tenant-specific base URL, formatted `https://live-mt-server.wati.io/<tenantId>` → this is `WATI_API_BASE_URL` (no trailing slash, no `/api/...` suffix).
5. Generate `WHATSAPP_WEBHOOK_SECRET` yourself (any long random string — e.g. `openssl rand -hex 24`), then in Wati: **Connector → Webhooks** → add `https://<your-domain>/api/webhooks/whatsapp/<the secret you generated>`, enable the **Message Received** and **New Contact Message** events.
6. To enable ad-click attribution later (Module 4's `ctwaClid` capture): link your Meta ad account under Wati's CTWA settings, once you've done Section 3 below.

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
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Static (<code>.env</code>)</td>
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

1. Go to [developers.facebook.com](https://developers.facebook.com) → **My Apps** → create a new app, type **Business**.
2. App Settings → Basic: note the **App ID** and **App Secret** → `META_APP_ID`, `META_APP_SECRET`.
3. Add the **Marketing API** product to the app from the App Dashboard.
4. Business Settings → Users → System Users → create a System User, assign it to your ad account with the **Advertiser** role, then generate a token with `ads_management` and `ads_read` permissions. This token is the value for `META_MARKETING_API_TOKEN` — it goes into `system_secrets`, not `.env` (see the section at the bottom for how).
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

**Note:** the exact budget-update field TikTok's API expects wasn't independently re-verified against a live sandbox during Module 4's build (flagged in `tiktok-ads.service.ts`) — test a budget-scale action against a real (or TikTok's sandbox) advertiser account before trusting it with real spend.

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
  </tbody>
</table>

1. Sign up at [console.groq.com](https://console.groq.com).
2. **API Keys** → create a new key → `GROQ_API_KEY`.

This is the simplest account on this list — no business verification, no approval wait.

---

## 7. Cloudinary (Module 5 — not built yet)

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

1. Sign up at [cloudinary.com](https://cloudinary.com) (a free tier exists and is enough for development).
2. The dashboard homepage shows **Cloud Name**, **API Key**, and **API Secret** directly — no extra setup needed.

*(This section will get real setup instructions once Module 5 is actually built — right now it's a placeholder so the account can be created ahead of time if you want to.)*

---

## How rotatable secrets get stored

Anything marked "Rotatable" above does **not** go into `.env`. It's read at runtime from the `system_secrets` table via `resolveActiveSecret()` (`src/services/system-secrets.service.ts`), which deliberately fails closed — if the row is missing or expired, the platform refuses to make that API call rather than silently doing nothing or falling back to a stale value.

To seed one, use the `upsertSecret` helper from a one-off script (same pattern used for local testing throughout this build):

```ts
import { upsertSecret } from './src/services/system-secrets.service';

await upsertSecret('meta', 'META_MARKETING_API_TOKEN', '<the real token>', new Date('2026-09-27')); // ~60 days out
await upsertSecret('google', 'GOOGLE_ADS_REFRESH_TOKEN', '<the real refresh token>'); // no expiresAt -- doesn't expire on a schedule
await upsertSecret('tiktok', 'TIKTOK_ADS_ACCESS_TOKEN', '<the real access token>');
```

Meta's token refreshes itself automatically once seeded (`src/cron/token-refresh.cron.ts`, runs daily). Google's and TikTok's don't have that automation yet — re-run `upsertSecret` manually if either ever gets revoked or stops working.

---

## Future modules

Add a new numbered section here, matching the pattern above (overview table row + step-by-step + env var table), for each new external account a future module introduces — the Agent SLA worker and the frontend build don't need new third-party accounts, but anything after that likely will.
