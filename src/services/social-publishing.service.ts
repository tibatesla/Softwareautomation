// src/services/social-publishing.service.ts
//
// Auto-posts a new listing to the Chestone Facebook Page and Instagram
// Business account the moment it gets its first photo (see
// uploadPropertyMediaFile in property.controller.ts). Best-effort and
// non-fatal by design: a publishing failure (credentials not yet granted,
// Meta API outage, etc.) is logged and never blocks the photo upload
// itself, same pattern as that controller's own Cloudinary cleanup calls.
//
// Deliberately does NOT go through resolveActiveSecret/system-secrets.service.ts's
// AdProvider machinery -- that path logs a "SYSTEM_HALT" row into
// ad_rule_executions on any failure, which is the ad-optimization engine's
// own audit trail (surfaced on the CRM's Ad Performance page). A missing
// content-publishing credential isn't an ad-rule halt and has no business
// showing up there, so this reads the same system_secrets table directly.
import axios from 'axios';
import { withSystemContext } from '../config/database';

const GRAPH_API_BASE = 'https://graph.facebook.com/v25.0';
const CONTENT_PUBLISHING_SECRET_KEY = 'META_CONTENT_PUBLISHING_TOKEN';

const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://chestoneproperties.com';

const getContentPublishingToken = async (): Promise<string | null> => {
  const secret = await withSystemContext((tx) =>
    tx.systemSecret.findFirst({ where: { keyName: CONTENT_PUBLISHING_SECRET_KEY, provider: 'meta', status: 'active' } }),
  );
  if (!secret) return null;
  if (secret.expiresAt && secret.expiresAt.getTime() < Date.now()) return null;
  return secret.secretValue;
};

export interface ListingForPost {
  id: string;
  title: string;
  location: string | null;
  subLocation: string | null;
  price: number;
  currency: string;
  imageUrl: string;
}

const buildCaption = (listing: ListingForPost): string => {
  const priceLabel =
    listing.price > 0
      ? new Intl.NumberFormat('en-KE', { style: 'currency', currency: listing.currency, maximumFractionDigits: 0 }).format(
          listing.price,
        )
      : 'Price on request';
  const locationLabel = [listing.location, listing.subLocation].filter(Boolean).join(', ');
  const link = `${PUBLIC_SITE_URL}/properties/${listing.id}`;

  return [listing.title, locationLabel ? `📍 ${locationLabel}` : null, `💰 ${priceLabel}`, '', `View more & enquire: ${link}`]
    .filter((line): line is string => line !== null)
    .join('\n');
};

export interface PublishResult {
  facebook: 'posted' | 'failed' | 'skipped';
  instagram: 'posted' | 'failed' | 'skipped';
}

/**
 * Publishes to whichever of the Facebook Page / Instagram Business account
 * are configured -- either, both, or neither ('skipped' if the relevant env
 * var isn't set, since this feature might be enabled for Facebook only).
 * Each platform's failure is independent: Instagram failing never stops the
 * Facebook post from being attempted, and vice versa. Returns a result per
 * platform rather than throwing -- the caller (the live upload trigger, or
 * a one-off backfill script) decides what to do with a failure; this
 * function's own job is just to attempt the post and report what happened.
 */
export const publishNewListing = async (listing: ListingForPost): Promise<PublishResult> => {
  const result: PublishResult = { facebook: 'skipped', instagram: 'skipped' };

  const token = await getContentPublishingToken();
  if (!token) {
    console.error(`[Social Publishing] No active ${CONTENT_PUBLISHING_SECRET_KEY} secret -- skipping auto-post for property ${listing.id}.`);
    return result;
  }

  const pageId = process.env.META_PAGE_ID;
  const igAccountId = process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const caption = buildCaption(listing);

  if (pageId) {
    try {
      await axios.post(`${GRAPH_API_BASE}/${pageId}/photos`, null, {
        params: { url: listing.imageUrl, caption, access_token: token },
      });
      result.facebook = 'posted';
    } catch (error) {
      result.facebook = 'failed';
      console.error(
        '[Social Publishing] Facebook Page post failed:',
        axios.isAxiosError(error) ? JSON.stringify(error.response?.data) : error,
      );
    }
  }

  if (igAccountId) {
    try {
      const container = await axios.post(`${GRAPH_API_BASE}/${igAccountId}/media`, null, {
        params: { image_url: listing.imageUrl, caption, access_token: token },
      });
      await axios.post(`${GRAPH_API_BASE}/${igAccountId}/media_publish`, null, {
        params: { creation_id: container.data.id, access_token: token },
      });
      result.instagram = 'posted';
    } catch (error) {
      result.instagram = 'failed';
      console.error(
        '[Social Publishing] Instagram post failed:',
        axios.isAxiosError(error) ? JSON.stringify(error.response?.data) : error,
      );
    }
  }

  return result;
};
