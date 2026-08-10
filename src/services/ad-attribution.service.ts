// src/services/ad-attribution.service.ts
//
// Closes the qualified_leads/CPQL gap documented in ad-rule-engine.service.ts.
// dispatchQualifiedLeadEvent (meta-capi.service.ts) only pushes a signal
// OUT to Meta so its own algorithm can optimize; nothing wrote a qualified
// lead back into our own ad_performance_logs. This does that half.
//
// Covers all three platforms. Meta gets adSourceId for free from its own
// WhatsApp referral object; Google/TikTok have no equivalent, so their
// leads carry a reference code parsed out of the first message instead
// (see parseAdReferenceCode / buildAdReferenceWhatsAppLink in
// whatsapp.schema.ts) -- either way, by the time it gets here it's just
// an (adSourceId, platform) pair, same lookup regardless of origin.
//
// ad_performance_logs.windowStart is not a true per-click hour bucket --
// none of the three platforms' reporting APIs give real hourly granularity
// (see meta-ads.service.ts), so windowStart is really "the top of the hour
// the ingestion cron last ran and overwrote this row's cumulative-so-far
// snapshot". A lead can be qualified hours or days after the ad click that
// started the conversation, so there's no meaningful "the row for the hour
// of the click" to find -- the right target is whichever row is the MOST
// RECENT snapshot for that ad right now, matching how impressions/spend on
// that same row are themselves just "latest known snapshot", not a true
// hourly delta.
import { withSystemContext } from '../config/database';
import { AdProvider } from './system-secrets.service';

/**
 * Increments qualified_leads on the latest known ad_performance_logs row
 * for the ad that produced this lead. Silently no-ops (does not throw) when
 * adSourceId/platform is missing -- most leads still won't have one
 * (organic messages, or CTWA post clicks rather than ad clicks), same
 * "missing attribution is expected, not a failure" principle as
 * dispatchQualifiedLeadEvent. Also no-ops if no ad_performance_logs row
 * exists yet for that ad (e.g. the qualification happened before the
 * hourly ingestion cron ever ran, or before it ran for that platform) --
 * there's no campaignId available from the WhatsApp side to create one.
 */
export const attributeQualifiedLead = async (
  adSourceId: string | null | undefined,
  platform: AdProvider | null | undefined,
): Promise<void> => {
  if (!adSourceId || !platform) {
    return;
  }

  try {
    await withSystemContext(async (tx) => {
      const latestRow = await tx.adPerformanceLog.findFirst({
        where: { platform, adId: adSourceId },
        orderBy: { windowStart: 'desc' },
        select: { id: true },
      });

      if (!latestRow) {
        console.warn(`[Ad Attribution] No ad_performance_logs row yet for ${platform} ad ${adSourceId} -- skipping.`);
        return;
      }

      await tx.adPerformanceLog.update({
        where: { id: latestRow.id },
        data: { qualifiedLeads: { increment: 1 } },
      });
    });
  } catch (error) {
    // Same principle as dispatchQualifiedLeadEvent: a failed attribution
    // write shouldn't block or roll back lead qualification itself.
    console.error('[Ad Attribution] Failed to attribute qualified lead:', (error as Error).message);
  }
};
