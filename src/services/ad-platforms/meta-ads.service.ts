// src/services/ad-platforms/meta-ads.service.ts
//
// Meta Marketing API client. Verified against Meta's own docs (Ads
// Insights API, ad-campaign/ad-set reference) during Module 4 planning --
// not the rag spec's secondhand version. API version pinned to v25.0.
import axios from 'axios';
import { AdPlatformClient, AdPerformanceRow } from './types';
import { resolveActiveSecret } from '../system-secrets.service';

const GRAPH_API_BASE = 'https://graph.facebook.com/v25.0';

class MetaAdsClient implements AdPlatformClient {
  public readonly platform = 'meta' as const;

  private async getToken(): Promise<string> {
    return resolveActiveSecret('meta', 'META_MARKETING_API_TOKEN');
  }

  /**
   * Pulls per-ad spend/impressions/clicks for the last N hours from the
   * configured ad account. Meta's Insights API windows by day (date_preset),
   * not by hour -- sinceHours < 24 still pulls "today" as the window; the
   * ingestion cron runs hourly and relies on the upsert in
   * ad_performance_logs (unique on platform/campaign/ad/windowStart) to
   * avoid duplicate rows, not on Meta giving us hour-granularity itself.
   */
  public async pullPerformance(sinceHours: number): Promise<AdPerformanceRow[]> {
    const accountId = process.env.META_AD_ACCOUNT_ID;
    if (!accountId) {
      throw new Error('Missing critical META_AD_ACCOUNT_ID environment configuration.');
    }
    const token = await this.getToken();
    const datePreset = sinceHours <= 24 ? 'today' : 'last_7d';

    const response = await axios.get(`${GRAPH_API_BASE}/act_${accountId}/insights`, {
      params: {
        level: 'ad',
        fields: 'ad_id,campaign_id,impressions,clicks,spend',
        date_preset: datePreset,
        access_token: token,
      },
    });

    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);

    return (response.data.data || []).map(
      (row: { ad_id: string; campaign_id: string; impressions: string; clicks: string; spend: string }) => ({
        platform: 'meta' as const,
        campaignId: row.campaign_id,
        adId: row.ad_id,
        windowStart,
        impressions: parseInt(row.impressions, 10) || 0,
        clicks: parseInt(row.clicks, 10) || 0,
        spend: parseFloat(row.spend) || 0,
        currency: 'KES',
      }),
    );
  }

  public async pauseAd(adId: string): Promise<void> {
    const token = await this.getToken();
    await axios.post(`${GRAPH_API_BASE}/${adId}`, null, {
      params: { status: 'PAUSED', access_token: token },
    });
  }

  /**
   * NOTE: applied at campaign level, since ad_performance_logs doesn't
   * store a separate ad-set ID and Campaign Budget Optimization makes
   * campaign-level daily_budget valid for most account setups. Accounts
   * using ad-set-level budgets instead would need this pointed at the ad
   * set -- verify against the real account before relying on this in
   * production.
   */
  public async adjustBudget(campaignId: string, factor: number): Promise<void> {
    const token = await this.getToken();

    const current = await axios.get(`${GRAPH_API_BASE}/${campaignId}`, {
      params: { fields: 'daily_budget', access_token: token },
    });
    const currentMinorUnits = parseInt(current.data.daily_budget, 10);
    if (!currentMinorUnits) {
      throw new Error(`Meta campaign ${campaignId} has no daily_budget to adjust (ad-set-level budget?).`);
    }

    await axios.post(`${GRAPH_API_BASE}/${campaignId}`, null, {
      params: { daily_budget: Math.round(currentMinorUnits * factor), access_token: token },
    });
  }
}

export const metaAdsClient = new MetaAdsClient();
