// src/services/social-publishing.service.ts
//
// Auto-posts a new listing (or, for a development with multiple unit
// types, all of them at once) to the Chestone Facebook Page and Instagram
// Business account the moment a property gets its first photo (see
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
import { buildDevelopmentCaption, ListingForPost } from './development-post.service';

const GRAPH_API_BASE = 'https://graph.facebook.com/v25.0';
const CONTENT_PUBLISHING_SECRET_KEY = 'META_CONTENT_PUBLISHING_TOKEN';

// Instagram's own carousel limit; Facebook's multi-photo post has no
// comparably strict cap, but there's no reason to post more images than
// Instagram can actually carry in one post either.
const MAX_CAROUSEL_ITEMS = 10;

const getContentPublishingToken = async (): Promise<string | null> => {
  const secret = await withSystemContext((tx) =>
    tx.systemSecret.findFirst({ where: { keyName: CONTENT_PUBLISHING_SECRET_KEY, provider: 'meta', status: 'active' } }),
  );
  if (!secret) return null;
  if (secret.expiresAt && secret.expiresAt.getTime() < Date.now()) return null;
  return secret.secretValue;
};

/**
 * Instagram media containers process asynchronously -- publishing
 * immediately after creating one is a race that fails intermittently with
 * "media is not ready" (confirmed live: this was the single most common
 * failure in an earlier bulk-posting run). Polls status_code instead of
 * guessing a fixed delay; gives up after ~20s, which the caller treats as
 * a normal publish failure like any other.
 */
const waitForContainerReady = async (containerId: string, token: string): Promise<void> => {
  for (let attempt = 0; attempt < 10; attempt++) {
    const res = await axios.get(`${GRAPH_API_BASE}/${containerId}`, { params: { fields: 'status_code', access_token: token } });
    const status = res.data.status_code;
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') throw new Error(`Instagram media container ${status}`);
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error('Instagram media container never finished processing');
};

const postFacebookPhotos = async (imageUrls: string[], caption: string, token: string, pageId: string): Promise<void> => {
  if (imageUrls.length === 0) return;

  // Always go through the two-step upload-then-feed flow, even for a single
  // photo -- POST /{page}/photos on its own creates a bare Photo object
  // (filed under the Page's Photos album, not a proper timeline Post),
  // which is exactly the "why is it posting as a photo, not a post"
  // behavior the client originally flagged. Attaching one photo to a feed
  // post via attached_media is fully supported and produces a real Post.
  const mediaIds: string[] = [];
  for (const url of imageUrls.slice(0, MAX_CAROUSEL_ITEMS)) {
    const res = await axios.post(`${GRAPH_API_BASE}/${pageId}/photos`, null, { params: { url, published: 'false', access_token: token } });
    mediaIds.push(res.data.id);
  }
  const params: Record<string, string> = { message: caption, access_token: token };
  mediaIds.forEach((mediaId, i) => {
    params[`attached_media[${i}]`] = JSON.stringify({ media_fbid: mediaId });
  });
  await axios.post(`${GRAPH_API_BASE}/${pageId}/feed`, null, { params });
};

// Instagram requires every photo -- single or in a carousel -- to have an
// aspect ratio between 4:5 (portrait) and 1.91:1 (landscape). Confirmed
// live: a 960x1280 (3:4 = 0.75, just under the 4:5 = 0.8 floor) property
// photo broke an entire 4-photo carousel with a generic "media could not
// be fetched" error that gives no hint it's an aspect-ratio problem. Since
// every property photo is already a Cloudinary URL, a safe crop can be
// applied on the fly via a URL transformation instead of fetching each
// image to check its real dimensions ourselves.
const toInstagramSafeUrl = (url: string): string => url.replace('/image/upload/', '/image/upload/c_fill,g_auto,ar_4:5/');

/**
 * A `c_fill,g_auto,ar_4:5` URL is a derived asset Cloudinary has likely
 * never generated before -- the first request for it takes real processing
 * time (confirmed live: ~1s, `g_auto`'s content-aware crop is the slow
 * part). Instagram's own fetch of image_url doesn't wait around for that;
 * a genuinely valid, working transformed image still failed with "media
 * could not be fetched" because Cloudinary hadn't finished generating it
 * yet on Instagram's first hit. Fetching it ourselves first forces
 * Cloudinary to generate and cache it (30-day cache-control), so
 * Instagram's subsequent fetch always lands on a warm URL.
 */
const warmUrl = async (url: string): Promise<void> => {
  try {
    await axios.get(url, { responseType: 'arraybuffer', timeout: 15000 });
  } catch (error) {
    console.error('[Social Publishing] Failed to pre-warm Instagram image URL (continuing anyway):', url, error);
  }
};

const postInstagramMedia = async (imageUrls: string[], caption: string, token: string, igAccountId: string): Promise<void> => {
  if (imageUrls.length === 0) return;
  const safeUrls = imageUrls.map(toInstagramSafeUrl);
  await Promise.all(safeUrls.map(warmUrl));

  if (safeUrls.length === 1) {
    const container = await axios.post(`${GRAPH_API_BASE}/${igAccountId}/media`, null, {
      params: { image_url: safeUrls[0], caption, access_token: token },
    });
    await waitForContainerReady(container.data.id, token);
    await axios.post(`${GRAPH_API_BASE}/${igAccountId}/media_publish`, null, { params: { creation_id: container.data.id, access_token: token } });
    return;
  }

  const childIds: string[] = [];
  for (const url of safeUrls.slice(0, MAX_CAROUSEL_ITEMS)) {
    const res = await axios.post(`${GRAPH_API_BASE}/${igAccountId}/media`, null, {
      params: { image_url: url, is_carousel_item: 'true', access_token: token },
    });
    await waitForContainerReady(res.data.id, token);
    childIds.push(res.data.id);
  }
  const carousel = await axios.post(`${GRAPH_API_BASE}/${igAccountId}/media`, null, {
    params: { media_type: 'CAROUSEL', children: childIds.join(','), caption, access_token: token },
  });
  await waitForContainerReady(carousel.data.id, token);
  await axios.post(`${GRAPH_API_BASE}/${igAccountId}/media_publish`, null, { params: { creation_id: carousel.data.id, access_token: token } });
};

export type PublishResult = { facebook: 'posted' | 'failed' | 'skipped'; instagram: 'posted' | 'failed' | 'skipped' };

/**
 * Publishes one or more listings as a single post -- a lone property posts
 * with its one photo, a development with several unit types posts once
 * with a combined caption (see buildDevelopmentCaption) and a multi-photo
 * carousel drawing one photo from each unit that has one. Publishes to
 * whichever of the Facebook Page / Instagram Business account are
 * configured -- either, both, or neither ('skipped' if the relevant env
 * var isn't set). Each platform's failure is independent.
 */
export const publishListingGroup = async (listings: ListingForPost[], developmentName: string | null): Promise<PublishResult> => {
  const result: PublishResult = { facebook: 'skipped', instagram: 'skipped' };
  if (listings.length === 0) return result;

  const token = await getContentPublishingToken();
  if (!token) {
    console.error(`[Social Publishing] No active ${CONTENT_PUBLISHING_SECRET_KEY} secret -- skipping auto-post for ${developmentName ?? listings[0].id}.`);
    return result;
  }

  const pageId = process.env.META_PAGE_ID;
  const igAccountId = process.env.META_INSTAGRAM_BUSINESS_ACCOUNT_ID;
  const caption = await buildDevelopmentCaption(listings, developmentName);
  const imageUrls = listings.map((l) => l.imageUrl).filter((url): url is string => Boolean(url));

  if (pageId) {
    try {
      await postFacebookPhotos(imageUrls, caption, token, pageId);
      result.facebook = 'posted';
    } catch (error) {
      result.facebook = 'failed';
      console.error('[Social Publishing] Facebook post failed:', axios.isAxiosError(error) ? JSON.stringify(error.response?.data) : error);
    }
  }

  if (igAccountId) {
    try {
      await postInstagramMedia(imageUrls, caption, token, igAccountId);
      result.instagram = 'posted';
    } catch (error) {
      result.instagram = 'failed';
      console.error('[Social Publishing] Instagram post failed:', axios.isAxiosError(error) ? JSON.stringify(error.response?.data) : error);
    }
  }

  return result;
};
