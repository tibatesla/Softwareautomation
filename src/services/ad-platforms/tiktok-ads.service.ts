// src/services/ad-platforms/tiktok-ads.service.ts
//
// TikTok Business/Marketing API client. Verified during Module 4 planning:
// base URL, the custom Access-Token header (NOT "Authorization: Bearer" --
// a real gotcha, easy to get wrong by pattern-matching Meta/Google), and
// the reporting endpoint. The status-update endpoint path is confirmed by
// convention from TikTok's adgroup-equivalent endpoint (same SDK family);
// the exact budget-update field was not independently verified against
// TikTok's official docs -- confirm against a sandbox advertiser account
// before relying on setBudget in production.
import axios from 'axios';
import { AdPlatformClient, AdPerformanceRow } from './types';
import { resolveActiveSecret } from '../system-secrets.service';

const TIKTOK_API_BASE = 'https://business-api.tiktok.com/open_api/v1.3';

class TikTokAdsClient implements AdPlatformClient {
  public readonly platform = 'tiktok' as const;

  private async headers(): Promise<Record<string, string>> {
    const accessToken = await resolveActiveSecret('tiktok', 'TIKTOK_ADS_ACCESS_TOKEN');
    return {
      'Access-Token': accessToken,
      'Content-Type': 'application/json',
    };
  }

  public async pullPerformance(sinceHours: number): Promise<AdPerformanceRow[]> {
    const advertiserId = process.env.TIKTOK_ADS_ADVERTISER_ID;
    if (!advertiserId) {
      throw new Error('Missing critical TIKTOK_ADS_ADVERTISER_ID environment configuration.');
    }
    const headers = await this.headers();

    const today = new Date().toISOString().slice(0, 10);
    const startDate = sinceHours <= 24 ? today : new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);

    const response = await axios.get(`${TIKTOK_API_BASE}/report/integrated/get/`, {
      headers,
      params: {
        advertiser_id: advertiserId,
        report_type: 'BASIC',
        data_level: 'AUCTION_AD',
        // campaign_id is NOT a valid dimension at the AUCTION_AD level (verified
        // live against the real API -- TikTok rejects it with "data_level
        // AUCTION_AD and dimension campaign_id do not match"). At this level it
        // must be requested as a metric instead, which TikTok does accept.
        dimensions: JSON.stringify(['ad_id']),
        metrics: JSON.stringify(['spend', 'impressions', 'clicks', 'campaign_id']),
        start_date: startDate,
        end_date: today,
        page_size: 1000,
      },
    });

    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);

    const list = response.data?.data?.list || [];

    return list.map((row: { dimensions: Record<string, string>; metrics: Record<string, string> }) => ({
      platform: 'tiktok' as const,
      campaignId: row.metrics.campaign_id,
      adId: row.dimensions.ad_id,
      windowStart,
      impressions: parseInt(row.metrics.impressions, 10) || 0,
      clicks: parseInt(row.metrics.clicks, 10) || 0,
      spend: parseFloat(row.metrics.spend) || 0,
      currency: 'KES',
    }));
  }

  public async pauseAd(campaignId: string): Promise<void> {
    const advertiserId = process.env.TIKTOK_ADS_ADVERTISER_ID;
    const headers = await this.headers();

    await axios.post(
      `${TIKTOK_API_BASE}/campaign/update/status/`,
      {
        advertiser_id: advertiserId,
        campaign_ids: [campaignId],
        operation_status: 'DISABLE',
      },
      { headers },
    );
  }

  /** Unverified field names against official docs -- see file header note. */
  public async adjustBudget(campaignId: string, factor: number): Promise<void> {
    const advertiserId = process.env.TIKTOK_ADS_ADVERTISER_ID;
    const headers = await this.headers();

    const current = await axios.get(`${TIKTOK_API_BASE}/campaign/get/`, {
      headers,
      params: { advertiser_id: advertiserId, campaign_ids: JSON.stringify([campaignId]) },
    });
    const currentBudget = parseFloat(current.data?.data?.list?.[0]?.budget ?? '0');
    if (!currentBudget) {
      throw new Error(`Could not resolve current budget for TikTok campaign ${campaignId}.`);
    }

    await axios.post(
      `${TIKTOK_API_BASE}/campaign/update/`,
      {
        advertiser_id: advertiserId,
        campaign_id: campaignId,
        budget: Math.round(currentBudget * factor),
      },
      { headers },
    );
  }
}

export const tiktokAdsClient = new TikTokAdsClient();
