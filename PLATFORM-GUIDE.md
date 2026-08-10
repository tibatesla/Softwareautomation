# Chestone Properties CRM — Platform & Ad Performance Guide

This explains what the platform does day-to-day, and how the Ad Performance dashboard's numbers are actually calculated — what's fully live today versus what's designed for but not yet wired up. Nothing below is aspirational; it matches the running code.

---

## 1. What the platform does

A single system covering the whole lead-to-sale journey for Chestone Properties:

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Area</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">What it does</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Properties</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Listings with photos/videos, pricing, amenities, and availability status (available / reserved / sold), assigned to an agent. Location is a fixed dropdown of the six approved areas — not free text — so a typo or an out-of-area entry can no longer be saved.</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Leads</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Auto-created from WhatsApp, qualified by an AI-assisted bot, claimed by an agent (or auto-assigned if nobody claims it in time — Section 4), tracked through a deal-stage pipeline to close.</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Bookings</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Site-visit scheduling, physical or virtual, tied to a lead and a property.</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Payments</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">A record-keeping ledger against a property — logs what's been paid, not a payment processor (no money moves through the platform itself).</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Ad Performance</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Hourly ingestion from Meta, Google, and TikTok Ads, a rule engine that flags/throttles underperforming ads automatically, and an AI advisor that explains why in plain language.</td>
    </tr>
  </tbody>
</table>

### Roles

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Role</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Can do</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Agent</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Claim qualified leads, reply to their own claimed leads' WhatsApp conversations, book site visits, log payments on assigned properties. Cannot see other agents' unclaimed-by-them data.</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Admin</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Everything an Agent can do, across every property/lead/agent, plus create/edit properties and assign them to agents. Cannot create or promote another Owner.</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Owner</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Everything, portfolio-wide — plus user management, payment corrections, and the Ad Performance dashboard.</td>
    </tr>
  </tbody>
</table>

This isn't just a UI convention — every boundary above is enforced by the database itself (Postgres Row-Level Security), not just hidden buttons.

---

## 2. Property media — photos and videos

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Piece</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">How it works</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Where it's stored</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Cloudinary — a dedicated media hosting service, not the platform's own server. Every photo/video an agent or admin uploads goes into its own folder per property (<code>chestone/properties/&lt;property id&gt;</code>), so a property's media is never mixed up with another's.</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">How it's uploaded</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">From a property's edit page in the CRM — pick a photo or video file, it uploads directly to Cloudinary, and the resulting link is added to that property's photo/video list. Photos and videos are both supported; which one it becomes is detected automatically from the file itself, not a separate toggle.</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">How it's used</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">The same uploaded links power both the CRM's property page <em>and</em> the public website's listing photos and gallery — one upload, everywhere it needs to appear. No separate upload step for the website.</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Removing media</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Deleting a photo/video from a property removes it from Cloudinary as well — it doesn't linger as an orphaned file taking up storage.</td>
    </tr>
  </tbody>
</table>

**Status:** ✅ Live.

---

## 3. WhatsApp lead capture, qualification, and the AI assistant

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Step</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">What happens</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">1. First message</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">A lead is auto-created from the contact's WhatsApp profile — no manual entry. Their WhatsApp display name is captured automatically at this point, so the bot doesn't ask for it again as a separate question (see note below). If they came from a Click-to-WhatsApp ad, the click ID (<code>ctwa_clid</code>) is captured with them.</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">2. Qualification</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">A bot asks one question at a time — property interest, investment type, budget, transaction type (plus name, only if it wasn't already available from their WhatsApp profile) — until all fields are captured, then the lead flips to <strong>qualified</strong> and enters the claim queue.</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">3. AI-phrased replies</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Every bot reply is rephrased naturally by AI (Groq) under a strict system prompt: only Chestone Properties topics, never fabricates listings/pricing/availability, never invents a name, resists prompt-injection attempts. If the AI is unavailable, it falls back to the plain scripted question — the qualification flow itself never breaks.</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">4. After qualification</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">The bot keeps helping with follow-up questions (still under the same guardrail) until a consultant sends a real reply from the CRM. Once a human has replied within the last 5 minutes, the bot goes quiet and leaves the conversation to them — it never talks over an agent, but resumes helping if the lead follows up later with nobody responding.</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">5. Full transcript</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Every inbound and outbound message is saved and viewable on the lead's page, labeled "Bot" or "Consultant" so it's clear who said what.</td>
    </tr>
  </tbody>
</table>

**What the AI never does:** decide what gets saved to a lead's record. The qualification bot's field-capture is a fixed, deterministic script — whatever the lead types is stored exactly as typed. The AI layer only decides the *wording* of the reply sent back, so a bad AI response can never corrupt CRM data.

**What "qualified" currently means:** a lead becomes qualified the moment they've answered every question above — there's no automatic accept/reject decision based on the answers themselves (e.g. a KES 2M budget and an "immediate" timeline both currently count the same as a KES 40M budget and a "just browsing" timeline; every completed conversation reaches the same <strong>qualified</strong> status and lands in the agent claim queue for a human to judge). If budget/timeline should actually filter which leads count as qualified versus get auto-rejected, that's a real rule to define and build, not something currently running.

---

## 4. Agent SLA & lead routing

Once a lead is qualified, it needs a human to actually pick it up fast — this is what enforces that, automatically, without relying on an agent noticing in time. Runs every minute, but only takes any action during business hours (08:00–18:00 EAT) — outside that window it's a no-op, so nobody gets auto-assigned or penalized overnight.

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Piece</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">How it works</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">On-duty toggle</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Each agent has their own on/off switch (their profile menu, top of the sidebar) — off-duty agents are skipped entirely by auto-assignment, no leads land on someone who's stepped away.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Auto-assignment</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">A qualified lead nobody has claimed within 5 minutes gets routed automatically to the next on-duty agent, round-robin (whoever's gone longest since their last assignment goes first) — fair rotation, not the same one or two agents getting everything.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Silent-claim penalty &amp; reopen</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">If an agent has held a lead for 10 minutes without sending it a single reply, that's logged against them and the lead is reopened — auto-assignment then routes it to someone else on the very next check, so a slow response doesn't leave a lead stuck.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
  </tbody>
</table>

**Honest limit:** there's no push notification, SMS, or email set up anywhere in this platform, so an agent isn't alerted the instant a lead lands on them — it becomes visible the next time they open the CRM. Real-time alerts would mean adding a new delivery channel (push/SMS/email), which is a separate piece of work, not something this module does on its own.

---

## 5. Ad Performance dashboard — every column explained

Each row is one ad, aggregated over an hourly time window, pulled automatically from Meta, Google, and TikTok Ads every hour.

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Column</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">What it means</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">How it's calculated / sourced</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Window</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">The one-hour period this row's numbers cover.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Set by the hourly ingestion job — one row per ad per hour.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Platform</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Which ad network this row came from — Meta, Google, or TikTok.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Directly from that platform's Ads API.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Campaign</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">The ad campaign this ad belongs to.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Campaign ID from the platform's API.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Ad</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">The specific ad/creative — the level all decisions (pause, throttle, scale) are made at.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Ad ID from the platform's API.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Spend</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Amount spent on this ad in this window, in KES.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Directly from the platform's API.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Impressions</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">How many times the ad was shown.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Directly from the platform's API.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Clicks</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">How many times it was clicked.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Directly from the platform's API.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>CTR</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Click-Through Rate — the percentage of people who saw the ad and clicked it. The earliest, cheapest signal that an ad's creative/targeting is or isn't resonating.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>(Clicks ÷ Impressions) × 100</code>, rounded to 3 decimal places. Computed automatically by the database whenever a row is written.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>Qualified leads</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">How many leads that clicked <em>this specific ad</em> went on to complete WhatsApp qualification.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Matches a qualified lead back to the ad it came from, then increments that ad's count. See <a href="#ctwa">Section 6</a> for how the match is made.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><strong>CPQL</strong></td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Cost Per Qualified Lead — the number that actually matters for deciding whether an ad is worth its spend, not just whether it gets clicks.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;"><code>Spend ÷ Qualified leads</code>. Computed automatically by the database whenever Qualified leads changes.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
  </tbody>
</table>

---

<a name="ctwa"></a>

## 6. Ad-to-lead attribution — how a qualified lead gets matched back to its ad

This is the mechanism that connects "someone clicked this specific ad" to "this specific WhatsApp conversation" — without it, there's no way to know which ad actually produced a qualified lead, only which ad got clicks. The mechanism is different for Meta than for Google/TikTok, because WhatsApp is a Meta product: Meta's own webhook can tell the platform "this message came from ad X" for free, but Google and TikTok have no equivalent hook into WhatsApp.

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Platform</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">How the ad is identified</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Meta</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">When someone clicks a Meta Click-to-WhatsApp ad and messages in, Meta attaches the ad's own ID to that first message automatically — no setup needed on any individual ad.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Google &amp; TikTok</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Each ad's WhatsApp destination link carries a short reference code in its pre-filled message text (e.g. <code>...(ref: GOOGLE-8821172)</code>). If the person sends that message as-is, the platform reads the code, silently removes it from what gets stored (an agent never sees it), and attributes the lead to that ad. <strong>Requires setting up each ad's destination link with this reference code</strong> — see below.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Signal back to Meta</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Separately, when a lead qualifies, the platform also fires a "Lead" event to Meta's own Conversions API — this teaches <em>Meta's</em> ad-delivery algorithm which clicks turned into real leads, improving future Meta ad targeting automatically. Meta-only; Google/TikTok don't have an equivalent hooked up yet.</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Duplicate-event protection</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Every event carries a stable <code>event_id</code> (<code>lead_qual_&lt;lead id&gt;</code>), so Meta can merge it with any other conversion signal for the same lead instead of double-counting. A lead also can't fire this event twice within a 7-day window even if this handler somehow runs more than once for it (e.g. two webhook deliveries racing each other).</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
  </tbody>
</table>

### Setting up a Google/TikTok ad's WhatsApp link so it gets tracked

Instead of a plain `wa.me/<number>` link, the ad's destination needs to be:

```text
https://wa.me/254726111133?text=Hi!%20I'm%20interested%20in%20Chestone%20Properties.%20(ref%3A%20GOOGLE-<ad ID>)
```

(swap `GOOGLE` for `TIKTOK` on TikTok ads, and `<ad ID>` for that specific ad's own ID from the platform's Ads Manager). Paste that as the ad's "Message" / "Chat on WhatsApp" destination — nothing else changes about how the ad runs.

**Honest limits, not glossed over:**

- If the person edits or deletes the pre-filled text before hitting send, that specific lead's attribution is lost — the lead still gets captured and qualified normally, it just won't count toward any ad's Qualified Leads/CPQL. This is expected and doesn't happen often enough to be a real problem, but it's not 100% coverage.
- An organic WhatsApp message (someone messaging in without coming from any ad) never has attribution to begin with — same as before.
- **Google Ads currently isn't pulling any data at all** — the account needs a payment method added before Google will serve data (unrelated to the code above, which is fully wired and tested).
- **TikTok is fully connected and verified**, but there's no active ad spend on the account yet, so its rows in the dashboard are still empty for now — they'll start populating the first time a TikTok ad actually runs.

---

## 7. The rule engine — deterministic, automatic decisions

Runs every hour right after ingestion, looking at each ad's totals over the trailing 48 hours. Fully deterministic — no AI involved in the decision itself, only in explaining it afterward (Section 8).

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Rule</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Fires when</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Action</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Status</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">CTR friction</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Spend ≥ KES 2,000 and CTR &lt; 1.2%</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Pause the ad</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Zero qualified spend</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Spend ≥ KES 3,500 with 0 qualified leads</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Pause the ad</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live</td>
    </tr>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">CPQL breach</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">CPQL exceeds KES 2,400 (domestic) or KES 4,500 (diaspora) — see below</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Cut budget by 50%</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live (see attribution coverage notes, Section 6)</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Winner scale</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">CPQL ≤ KES 1,800 with spend ≥ KES 5,000</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Increase budget by 25%</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">✅ Live (see attribution coverage notes, Section 6)</td>
    </tr>
  </tbody>
</table>

Every decision (including "no threshold breached, no action taken") is logged, so there's a full audit trail of why an ad's budget changed. The two CPQL-dependent rules above now fire correctly whenever Qualified Leads has real data behind it — in practice that means Meta today, and Google/TikTok once billing/spend is active on those accounts respectively (Section 6).

**Domestic vs. diaspora CPQL caps.** The CPQL breach rule no longer applies one flat ceiling to every ad — each ad's target segment is resolved from the actual leads attributed to it (majority domestic vs. diaspora among that ad's attributed leads), and the diaspora cap (KES 4,500) is higher than the domestic one (KES 2,400), reflecting that diaspora buyers typically carry higher budgets. An ad with no attributed leads yet falls back to the stricter domestic cap until it has enough data to tell. ✅ Live.

---

## 8. The AI advisory layer

On top of the rule engine's decision, whenever an ad gets paused or throttled, the platform asks an AI model to explain the situation in plain language for a human to act on — the AI never decides the action itself, only narrates it.

<table style="border-collapse:collapse; width:100%; font-family:sans-serif;">
  <thead>
    <tr style="background-color:#dbe4f0; color:#1e3a5f; font-weight:700; border-bottom:2px solid #1e3a5f;">
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Provider</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Role</th>
      <th style="padding:10px 14px; border:1px solid #cbd5e1; text-align:left;">Notes</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background-color:#ffffff;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Groq</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Primary</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Fast, cloud-hosted. Used first for every advisory.</td>
    </tr>
    <tr style="background-color:#f1f5f9;">
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Ollama (self-hosted)</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Fallback</td>
      <td style="padding:10px 14px; border:1px solid #cbd5e1;">Runs directly on the platform's own server, no external API cost. Only kicks in if Groq is unavailable — tested live by deliberately breaking the Groq connection and confirming a real recommendation still came back.</td>
    </tr>
  </tbody>
</table>

The advisory never overrides or delays the rule engine's own action — the pause/throttle/scale already happened by the time the AI writes its explanation, so an AI outage never blocks ad spend protection.

---

## 9. Putting it together — one ad click, end to end

```text
Someone clicks a Chestone ad on Meta/Google/TikTok
  -> lands in WhatsApp, sends a message
     (Meta: ad ID captured automatically / Google & TikTok: reference code parsed from the message text)
  -> lead auto-created, AI-guided qualification bot asks up to 5 questions
     (fewer if their WhatsApp name is already known)
  -> lead flips to "qualified", visible in the Agent claim queue
  -> that ad's Qualified Leads count increments in the dashboard above (Section 6)
  -> Meta leads additionally fire a "Lead" event back to Meta's Conversions API (improves Meta's own ad delivery)
  -> an agent claims it (or gets auto-assigned round-robin after 5 min unclaimed -- Section 4),
     replies from the CRM, books a site visit, logs a payment

Meanwhile, every hour, independently:
  -> spend/impressions/clicks pulled from Meta, Google, TikTok
  -> CTR and CPQL computed automatically
  -> rule engine checks each ad against the thresholds above
  -> anything paused/throttled gets a plain-language AI explanation attached
```

Lead capture and ad ingestion run independently, and now meet in one place: the Qualified Leads count on each ad's row in the dashboard (Section 5), fed by the attribution mechanism in Section 6.
