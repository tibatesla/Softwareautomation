// src/services/ad-platforms/types.ts
import { AdProvider } from '../system-secrets.service';

export interface AdPerformanceRow {
  platform: AdProvider;
  campaignId: string;
  adId: string;
  windowStart: Date;
  impressions: number;
  clicks: number;
  spend: number;
  currency: string;
}

/**
 * Common shape every platform client implements, despite three different
 * auth models and request/response shapes underneath (see the Module 4
 * plan for the verified per-platform API reference). The rule engine and
 * BullMQ worker only ever talk to this interface, never to a specific
 * platform's HTTP quirks directly.
 */
export interface AdPlatformClient {
  readonly platform: AdProvider;
  pullPerformance(sinceHours: number): Promise<AdPerformanceRow[]>;
  pauseAd(adId: string): Promise<void>;
  /**
   * Multiplies the ad/campaign's current daily budget by `factor` (e.g.
   * 1.25 for winner-scaling, 0.5 for throttling) -- not an absolute
   * amount, since we don't track budget state locally. Each client
   * resolves the current budget itself before applying the change.
   */
  adjustBudget(adId: string, factor: number): Promise<void>;
}
