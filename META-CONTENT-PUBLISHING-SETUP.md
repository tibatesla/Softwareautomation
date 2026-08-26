# Facebook & Instagram Auto-Posting — Setup Instructions

For whoever manages the Chestone Meta Business Manager (Facebook Page + Instagram admin). This unlocks the feature that automatically posts a new property listing to Facebook and Instagram the moment its first photo is uploaded in the CRM.

No new Facebook app is needed — this reuses the same app and System User already set up for WhatsApp and ads. You're just granting it two more permissions.

---

## What you'll be doing

1. Link the Instagram account to the Facebook Page (if not already linked).
2. Grant the System User permission to publish posts.
3. Generate a token and hand two values back to your developer.

---

## Step 1 — Link Instagram to the Facebook Page

Skip this step if the Chestone Instagram account is already connected to the Facebook Page.

1. Go to [business.facebook.com](https://business.facebook.com).
2. Open the Chestone Facebook Page → **Settings** → **Linked Accounts** → **Instagram**.
3. Connect the Chestone Instagram account. It must be a **Business** or **Creator** account — not a personal account. (If it's currently personal, Instagram's own app has a "Switch to Professional Account" option under Settings.)

---

## Step 2 — Grant the System User publishing permissions

1. Go to **Business Settings** (gear icon, top left of Business Manager) → **Users** → **System Users**.
2. Select the existing System User (the same one already used for WhatsApp/ads — don't create a new one).
3. Click **Add Assets**.
4. Under the **Pages** tab, select the Chestone Facebook Page and give it **Full control**. (Skip this if it's already assigned there.)
5. Click **Generate New Token**.
6. Select the Chestone app from the list.
7. Check these permission boxes:
   - ☑ `pages_manage_posts`
   - ☑ `pages_read_engagement`
   - ☑ `instagram_basic`
   - ☑ `instagram_content_publish`
8. Set expiration to **Never**.
9. Click **Generate Token** and **copy the token somewhere safe** — Facebook only shows it once.

---

## Step 3 — Hand these back to your developer

Your developer needs two things to finish the setup — send them:

1. **The token you just copied** in Step 2.
2. **Your Facebook Page ID** — found on the Page itself: **About** tab → scroll to **Page ID**, or in Business Settings → Accounts → Pages → click the Page → the ID is shown near the top.

Everything else (exchanging that token for the final one, finding the Instagram account ID, saving it into the system) is done on the developer's side — you don't need to do anything more after sending those two values.

---

## What happens after this

Once your developer confirms it's connected, any new property listing will automatically get a Facebook Page post (and Instagram post) as soon as its first photo is added in the CRM — no further action needed from anyone, ever, per listing.
