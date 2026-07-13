// src/schemas/ad-performance.schema.ts
import { z } from 'zod';

// Make.com calls this on a schedule (e.g. every hour, right before your
// budgetMonitor cron runs) after pulling real numbers from Meta/TikTok/
// Google Ads Insights APIs. One call per creative per platform.
export const adPerformanceWebhookSchema = z.object({
  creative_id: z.string().min(1),
  platform: z.enum(['Meta', 'TikTok', 'Google']),
  impressions: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  spend: z.number().nonnegative(), // USD, matching daily_budget_usd's unit in make.service.ts
});

export type AdPerformanceWebhookPayload = z.infer<typeof adPerformanceWebhookSchema>;