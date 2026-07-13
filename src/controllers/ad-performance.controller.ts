// src/controllers/ad-performance.controller.ts
import { Request, Response } from 'express';
import { adPerformanceWebhookSchema } from '../schemas/ad-performance.schema';
import { supabase } from '../services/supabase.service';

/**
 * Receives real ad performance data from Make.com. This is what makes
 * budgetMonitor.ts's hourly CPA check meaningful — before this existed,
 * fact_creative_performance only ever held the zero values make.service.ts
 * initializes on deploy, so the CPA breaker was querying dead numbers.
 *
 * Make.com side (build this scenario before wiring in real ad accounts):
 *   1. Scheduled trigger, every hour (offset ~5 min before your
 *      budgetMonitor cron's :00 run, so fresh data is ready by the time
 *      it checks).
 *   2. For each active campaign, call Meta Marketing API / TikTok Ads API /
 *      Google Ads API's insights endpoints for impressions/clicks/spend.
 *   3. HTTP POST each result to this endpoint.
 */
export const handleAdPerformanceWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = adPerformanceWebhookSchema.parse(req.body);

    // Upsert on (creative_id, platform) — same composite key
    // make.service.ts's initial insert used. Requires a unique constraint
    // on (creative_id, platform) in the table; add one via migration if it
    // doesn't already exist, or this upsert will just keep inserting
    // duplicate rows instead of updating.
    const { error } = await supabase
      .from('fact_creative_performance')
      .upsert(
        {
          creative_id: payload.creative_id,
          platform: payload.platform,
          impressions: payload.impressions,
          clicks: payload.clicks,
          spend: payload.spend,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'creative_id,platform' },
      );

    if (error) {
      console.error('[Ad Performance Webhook] Upsert failed:', error.message);
      
      res.status(500).json({ error: 'Failed to store performance data' });
      return;
    }

    console.log(`[Ad Performance] Upserted ${payload.creative_id} (${payload.platform}): ${payload.impressions} imp / ${payload.clicks} clicks / ${payload.spend} spend`);

    res.status(200).json({ success: true });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      res.status(400).json({ error: 'Malformed payload', details: error.errors });
      return;
    }
    console.error('[Ad Performance Webhook] Unexpected failure:', error.message);
    res.status(500).json({ error: 'Internal failure' });
  }
};