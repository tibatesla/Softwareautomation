// src/services/make.service.ts
import { supabase } from './supabase.service';

export interface DeployCampaignParams {
  property_id: string;
  gcs_url: string;
  avatar_tag: string;
  whatsapp_message: string;
}

const DUMMY_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';

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
        // FIX: was declared in the interface but never actually forwarded
        // in the payload — the WhatsApp CTA pre-fill would have silently
        // never received the property reference, defeating the whole
        // point of the upgrade (auto-detecting which property a lead is
        // asking about instead of the AI having to ask).
        whatsapp_message: params.whatsapp_message,
        platforms: ['Meta', 'TikTok', 'Google'],
        optimization_goal: 'LEAD_GENERATION',
        daily_budget_usd: this.TEST_MODE ? 0 : 50.00,
        test_mode: this.TEST_MODE,
      };

      const response = await fetch(this.MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Make.com Webhook Error: ${response.status} - ${errorText}`);
      }

      console.log(`[Stage 5] Success. Payload caught by Make.com for routing.`);

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

  public async throttleCampaign(creativeId: string, platform: string, currentCpaKes: number): Promise<void> {
    try {
      if (!this.MAKE_WEBHOOK_URL) {
        console.warn('[Throttle] MAKE_WEBHOOK_URL missing — cannot dispatch throttle command.');
        return;
      }

      console.warn(`[Throttle] Dispatching THROTTLE command for ${creativeId} on ${platform} (CPA: KES ${currentCpaKes.toFixed(0)})`);

      const response = await fetch(this.MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'THROTTLE',
          creative_id: creativeId,
          platform,
          reason: `CPA breached threshold: KES ${currentCpaKes.toFixed(0)}`,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Make.com throttle dispatch failed: ${response.status} - ${errorText}`);
      }

      console.log(`[Throttle] Command dispatched successfully for ${creativeId} on ${platform}.`);
    } catch (error: any) {
      console.error(`[Throttle] Failed to dispatch throttle command for ${creativeId}:`, error.message);
      throw error;
    }
  }
}

export const makeService = new MakeService();