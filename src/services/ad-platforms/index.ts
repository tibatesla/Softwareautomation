// src/services/ad-platforms/index.ts
import { AdProvider } from '../system-secrets.service';
import { AdPlatformClient } from './types';
import { metaAdsClient } from './meta-ads.service';
import { googleAdsClient } from './google-ads.service';
import { tiktokAdsClient } from './tiktok-ads.service';

export const adPlatformClients: Record<AdProvider, AdPlatformClient> = {
  meta: metaAdsClient,
  google: googleAdsClient,
  tiktok: tiktokAdsClient,
};

export * from './types';
