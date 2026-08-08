// src/services/ad-platforms/google-ads.service.ts
//
// Google Ads API client. Verified against Google's own docs during Module
// 4 planning: OAuth2 refresh-token exchange, searchStream for reads,
// campaigns:mutate with the update/updateMask sparse-update pattern for
// writes (different shape from Meta's "just POST the changed field").
//
// Unlike Meta's ~60-day token, a Google refresh_token doesn't expire on a
// fixed schedule (only on revocation) -- resolveActiveSecret still works
// for it, just with no expiresAt set when it's stored.
import axios from 'axios';
import { AdPlatformClient, AdPerformanceRow } from './types';
import { resolveActiveSecret } from '../system-secrets.service';

const GOOGLE_ADS_API_VERSION = 'v24';
const GOOGLE_ADS_API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;

class GoogleAdsClient implements AdPlatformClient {
  public readonly platform = 'google' as const;

  private async getAccessToken(): Promise<string> {
    const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Missing critical GOOGLE_ADS_CLIENT_ID/GOOGLE_ADS_CLIENT_SECRET environment configuration.');
    }
    const refreshToken = await resolveActiveSecret('google', 'GOOGLE_ADS_REFRESH_TOKEN');

    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    return response.data.access_token;
  }

  private async headers(): Promise<Record<string, string>> {
    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
      throw new Error('Missing critical GOOGLE_ADS_DEVELOPER_TOKEN environment configuration.');
    }
    const accessToken = await this.getAccessToken();

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': developerToken,
      'Content-Type': 'application/json',
    };
    if (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID) {
      headers['login-customer-id'] = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    }
    return headers;
  }

  public async pullPerformance(sinceHours: number): Promise<AdPerformanceRow[]> {
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    if (!customerId) {
      throw new Error('Missing critical GOOGLE_ADS_CUSTOMER_ID environment configuration.');
    }
    const headers = await this.headers();
    const dateFilter = sinceHours <= 24 ? 'DURING TODAY' : 'DURING LAST_7_DAYS';

    const query = `
      SELECT campaign.id, ad_group_ad.ad.id, metrics.impressions, metrics.clicks, metrics.cost_micros
      FROM ad_group_ad
      WHERE segments.date ${dateFilter}
    `;

    const response = await axios.post(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:searchStream`,
      { query },
      { headers },
    );

    const windowStart = new Date();
    windowStart.setMinutes(0, 0, 0);

    // searchStream returns an array of response chunks, each with a `results` array.
    const chunks = Array.isArray(response.data) ? response.data : [response.data];
    const rows: AdPerformanceRow[] = [];

    for (const chunk of chunks) {
      for (const result of chunk.results || []) {
        rows.push({
          platform: 'google',
          campaignId: String(result.campaign?.id ?? ''),
          adId: String(result.adGroupAd?.ad?.id ?? ''),
          windowStart,
          impressions: parseInt(result.metrics?.impressions ?? '0', 10),
          clicks: parseInt(result.metrics?.clicks ?? '0', 10),
          spend: parseInt(result.metrics?.costMicros ?? '0', 10) / 1_000_000, // Google reports cost in micros
          currency: 'KES',
        });
      }
    }

    return rows;
  }

  public async pauseAd(campaignId: string): Promise<void> {
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    const headers = await this.headers();

    await axios.post(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaigns:mutate`,
      {
        operations: [
          {
            update: {
              resourceName: `customers/${customerId}/campaigns/${campaignId}`,
              status: 'PAUSED',
            },
            updateMask: 'status',
          },
        ],
      },
      { headers },
    );
  }

  /**
   * NOTE: a campaign's budget is a separate linked resource in Google's
   * model, not an inline field -- this resolves it via campaign.get first.
   * The read shape here (campaign.campaignBudget resourceName, then
   * fetching amountMicros off that resource) follows Google's documented
   * resource-linking pattern but was not independently re-verified line
   * by line -- confirm against a real account/sandbox before relying on
   * this in production, same caveat as TikTok's budget field.
   */
  public async adjustBudget(campaignId: string, factor: number): Promise<void> {
    const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
    const headers = await this.headers();

    const query = `SELECT campaign.campaign_budget, campaign_budget.amount_micros FROM campaign WHERE campaign.id = ${campaignId}`;
    const searchResponse = await axios.post(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/googleAds:searchStream`,
      { query },
      { headers },
    );
    const chunks = Array.isArray(searchResponse.data) ? searchResponse.data : [searchResponse.data];
    const firstResult = chunks[0]?.results?.[0];
    const budgetResourceName = firstResult?.campaign?.campaignBudget;
    const currentAmountMicros = parseInt(firstResult?.campaignBudget?.amountMicros ?? '0', 10);

    if (!budgetResourceName || !currentAmountMicros) {
      throw new Error(`Could not resolve current budget for Google campaign ${campaignId}.`);
    }

    await axios.post(
      `${GOOGLE_ADS_API_BASE}/customers/${customerId}/campaignBudgets:mutate`,
      {
        operations: [
          {
            update: {
              resourceName: budgetResourceName,
              amountMicros: Math.round(currentAmountMicros * factor),
            },
            updateMask: 'amountMicros',
          },
        ],
      },
      { headers },
    );
  }
}

export const googleAdsClient = new GoogleAdsClient();
