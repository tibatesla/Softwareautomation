// src/services/make.service.ts
import { supabase } from './supabase.service';

export interface DeployCampaignParams {
  property_id: string;
  gcs_url: string; 
  avatar_tag: string;
}

// Used only when GCS isn't wired up yet (billing pending). Lets you test that
// the pipeline correctly reaches Make.com without a real rendered asset.
const DUMMY_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';

/**
 * Service: Make.com Automation Router
 * Pushes the completed video asset to a Make Custom Webhook.
 * Make.com then handles the complex OAuth routing to Meta, TikTok, and Google Ads.
 *
 * ================================================================================
 * ⚠️ TODO — DO THIS BEFORE CONNECTING REAL META/TIKTOK/GOOGLE ACCOUNTS TO MAKE.COM:
 * ================================================================================
 * Right now (as of this comment) Make.com has NO live ad accounts connected, so
 * this service can't accidentally spend real money — that's why TEST_MODE isn't
 * urgent today. THIS CHANGES the moment real Meta/TikTok/Google accounts get
 * wired into the Make.com scenario. Before that happens:
 *
 *   1. Set PIPELINE_TEST_MODE=true in .env whenever testing
 *   2. In the Make.com scenario itself, add a branch/filter that checks the
 *      incoming `test_mode` field on the webhook payload — if true, route to a
 *      NO-OP path (e.g. just log it / post to Slack) instead of the real
 *      "Create Campaign" modules for Meta/TikTok/Google.
 *   3. Only flip PIPELINE_TEST_MODE=false for real, intentional production runs.
 *
 * Without step 2 done on the Make.com side, this flag does NOTHING — it only
 * protects you if the scenario actually checks for it.
 * ================================================================================
 *
 * IMPORTANT — TEST_MODE safety guard:
 * When PIPELINE_TEST_MODE=true in .env, this sends test_mode: true and forces
 * daily_budget_usd to 0 in the payload. Your Make.com scenario MUST check for
 * test_mode === true and branch to a NO-OP / log-only path instead of actually
 * creating live ad campaigns. Without that check on the Make.com side, this
 * flag does nothing — it only works if the scenario respects it.
 *
 * Do NOT run this against a Make.com scenario that has live Meta/TikTok/Google
 * publish actions wired up unless you've confirmed test_mode is respected, or
 * you WILL launch real paid ad campaigns using dummy/placeholder video content.
 */
class MakeService {
  private readonly MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
  private readonly TEST_MODE = process.env.PIPELINE_TEST_MODE === 'true';

  public async deployAdCampaign(params: DeployCampaignParams): Promise<void> {
    try {
      console.log(`[Stage 5] Routing ad payload to Make.com for Property ID: ${params.property_id}`);

      if (!this.MAKE_WEBHOOK_URL) {
        console.warn('[Stage 5 Warning] MAKE_WEBHOOK_URL is missing in .env. Halting deployment.');
        return; 
      }

      // Fallback to dummy video only if the real GCS URL wasn't produced
      // (e.g. GCS billing still pending on client's end)
      const effectiveVideoUrl = params.gcs_url || DUMMY_VIDEO_URL;

      if (!params.gcs_url) {
        console.warn(`[Stage 5] No real GCS URL for ${params.property_id} — falling back to dummy test video.`);
      }

      if (this.TEST_MODE) {
        console.warn(`[Stage 5] PIPELINE_TEST_MODE is ON — budget forced to $0, test_mode flag sent to Make.com.`);
      }

      const payload = {
        creative_url: effectiveVideoUrl,
        campaign_name: `Chestone_Auto_${params.property_id}_${params.avatar_tag}_${Date.now()}`,
        avatar_tag: params.avatar_tag,
        property_id: params.property_id,
        platforms: ['Meta', 'TikTok', 'Google'],
        optimization_goal: 'LEAD_GENERATION',
        daily_budget_usd: this.TEST_MODE ? 0 : 50.00,
        test_mode: this.TEST_MODE,   // Make.com scenario MUST branch on this
      };

      const response = await fetch(this.MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Make.com Webhook Error: ${response.status} - ${errorText}`);
      }

      console.log(`[Stage 5] Success. Payload caught by Make.com for routing.`);

      // Initialize Analytics in Supabase to track Cost Per Lead (CPL) per avatar
      const performanceRecords = payload.platforms.map((platform) => ({
        creative_id: payload.campaign_name,
        platform: platform,
        impressions: 0,
        clicks: 0,
        spend: 0.0,
      }));

      const { error: insertError } = await supabase
        .from('fact_creative_performance')
        .insert(performanceRecords);

      if (insertError) {
        console.error(`[Supabase Warning] Failed to initialize analytics: ${insertError.message}`);
      }

    } catch (error: any) {
      console.error(`[SENTRY ALERT - Non-Fatal] Stage 5 Make.com routing failed for Property ${params.property_id}.`);
      console.error(`[SENTRY ERROR TRACE]:`, error.message || error);
    }
  }
}

export const makeService = new MakeService();