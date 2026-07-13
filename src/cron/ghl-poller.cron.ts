// src/cron/ghl-poller.cron.ts
import cron from 'node-cron';
import { supabase } from '../services/supabase.service';
import { videoGenerationQueue } from '../config/queue.config';
import { makeService } from '../services/make.service';

const GHL_API_TOKEN = process.env.GHL_API_TOKEN;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const GHL_OBJECT_KEY = process.env.GHL_PROPERTY_OBJECT_KEY ?? 'custom_objects.properties';
const GHL_BASE_URL = 'https://services.leadconnectorhq.com/objects';

interface GHLCustomObjectRecord {
  id: string;
  sort: [number, string]; // cursor for pagination
  properties: {
    property_id?: string;
    property_name?: string;
    location?: string;
    status?: string;
    manual_video_url?: string;
    image_urls?: string; // comma-separated string — GHL has no array field type
    amenities?: string;  // comma-separated string — same reason
    price?: number;
    payment_plan_structure?: string;
    house_size_sqft?: number;
    unit_type?: string;
    total_units?: number;
    price_min?: number;
    price_max?: number;
    developer_contact?: string;
    developer_email?: string;
    developer_phone?: string;
    completion_time?: string;
    level_floors?: string;
    view?: string;
  };
}

export const initGhlPollerCron = () => {
  // Polls GoHighLevel every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log('[CRON] Polling GoHighLevel for new/updated properties...');

    if (!GHL_API_TOKEN || !GHL_LOCATION_ID) {
      console.warn('[GHL Poller] Missing GHL_API_TOKEN or GHL_LOCATION_ID in .env. Skipping poll.');
      return;
    }

    try {
      let searchAfter: [number, string] | undefined = undefined;
      let totalProcessed = 0;
      let totalQueued = 0;

      // Paginate through every record via searchAfter cursor — handles
      // property counts beyond a single 100-record page without missing any.
      while (true) {
        const requestBody: Record<string, unknown> = {
          locationId: GHL_LOCATION_ID,
          pageLimit: 100,
        };
        if (searchAfter) {
          requestBody.searchAfter = searchAfter;
        } else {
          requestBody.page = 1;
        }

        const response = await fetch(`${GHL_BASE_URL}/${GHL_OBJECT_KEY}/records/search`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GHL_API_TOKEN}`,
            'Version': '2021-07-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`GHL API Error: ${response.status} - ${errText}`);
        }

        const { records, total }: { records: GHLCustomObjectRecord[]; total: number } = await response.json();

        if (!records || records.length === 0) {
          if (totalProcessed === 0) console.log('[GHL Poller] No records found in this polling cycle.');
          break;
        }

        console.log(`[GHL Poller] Retrieved ${records.length} records this page. Processing...`);

        for (const record of records) {
          try {
            const props = record.properties || {};

            // GHL stores these as flat comma-separated strings — split and
            // trim. Empty/missing must become [], not [''] (what
            // ''.split(',') actually produces).
            const imageUrls = props.image_urls
              ? props.image_urls.split(',').map((url) => url.trim()).filter(Boolean)
              : [];
            const amenitiesList = props.amenities
              ? props.amenities.split(',').map((item) => item.trim()).filter(Boolean)
              : [];

            // CRITICAL FIX: check if this record already exists BEFORE
            // upserting. The old code always wrote status from GHL's data
            // on every cycle — but GHL's own copy of status never changes
            // (nothing writes RENDERING/COMPLETED back to GHL), so every
            // 10-minute poll was resetting an already-rendering property's
            // status right back to PENDING_INGESTION, causing it to be
            // re-queued for a brand new HeyGen render EVERY CYCLE. This
            // burned real credits 3x on the same property before being
            // caught. Now: status is only set on first insert. Once your
            // pipeline owns a property's lifecycle, GHL can't reset it.
            const { data: existingRecord } = await supabase
              .from('chestone_properties')
              .select('id, status')
              .eq('ghl_record_id', record.id)
              .maybeSingle();

            const upsertPayload: Record<string, unknown> = {
              ghl_record_id: record.id,
              property_unique_id: props.property_id || record.id,
              property_name: props.property_name || 'Unnamed Property',
              specific_location: props.location || 'Location unverified',
              manual_video_url: props.manual_video_url || null,
              property_images: imageUrls,
              amenities: amenitiesList,
              price: props.price || 0,
              payment_plan_structure: props.payment_plan_structure || null,
              house_size_sqft: props.house_size_sqft || null,
              unit_type: props.unit_type || null,
              total_units: props.total_units || null,
              price_min: props.price_min || props.price || null,
              price_max: props.price_max || props.price || null,
              developer_contact: props.developer_contact || null,
              developer_email: props.developer_email || null,
              developer_phone: props.developer_phone || null,
              completion_time: props.completion_time || null,
              level_floors: props.level_floors || null,
              view_description: props.view || null
            };

            // Only set status if this is a genuinely new record. Existing
            // records keep whatever status your pipeline already gave them.
            if (!existingRecord) {
              upsertPayload.status = props.status || 'PENDING_INGESTION';
            }

            const { data: property, error: dbError } = await supabase
              .from('chestone_properties')
              .upsert(upsertPayload, { onConflict: 'ghl_record_id' })
              .select('*')
              .single();

            if (dbError || !property) {
              console.error(`[GHL Poller] DB Upsert Error for GHL Record ${record.id}:`, dbError?.message);
              continue;
            }

            totalProcessed += 1;

            // Only route items sitting in 'PENDING_INGESTION' — anything
            // already RENDERING/COMPLETED/FAILED was handled on a prior cycle.
            if (property.status === 'PENDING_INGESTION') {

              if (property.manual_video_url) {
                // Branch A: Manual Video Bypass — client-supplied video,
                // skip HeyGen/FFmpeg entirely, straight to ad deployment.
                console.log(`[Router] Property ${property.property_name} has manual video. Bypassing AI generation.`);

                await supabase
                  .from('chestone_properties')
                  .update({ status: 'ROUTED_MANUAL' })
                  .eq('id', property.id);

                await makeService.deployAdCampaign({
                  property_id: property.property_unique_id,
                  gcs_url: property.manual_video_url,
                  avatar_tag: 'manual_bypass'
                }).catch(err => console.error('[Router] Make.com deployment failed:', err.message));

              } else {
                // Branch B: Automated AI Video Generation — 3 videos per
                // property now (Investment, Lifestyle, Architectural),
                // generated independently so one variant failing doesn't
                // block the other two.
                console.log(`[Router] Property ${property.property_name} queuing for HeyGen/FFmpeg pipeline (3 variants).`);

                await supabase
                  .from('chestone_properties')
                  .update({ status: 'RENDERING' })
                  .eq('id', property.id);

                const variants: Array<'Investment' | 'Lifestyle' | 'Architectural'> = [
                  'Investment', 'Lifestyle', 'Architectural'
                ];

                for (const variant of variants) {
                  // Pre-create the tracking row so the webhook handler has
                  // something to match against once HeyGen calls back.
                  const { error: variantError } = await supabase
                    .from('property_video_variants')
                    .upsert(
                      { property_id: property.id, variant, status: 'PENDING' },
                      { onConflict: 'property_id,variant' }
                    );

                  if (variantError) {
                    console.error(`[Router] Failed to create variant row for ${variant}:`, variantError.message);
                    continue;
                  }

                  await videoGenerationQueue.add({
                    internal_db_id: property.id,
                    variant,
                    property_data: property
                  }, {
                    attempts: 3,
                    backoff: { type: 'exponential', delay: 10000 },
                    removeOnComplete: true
                  });

                  totalQueued += 1;
                }
              }
            }
          } catch (recordError: any) {
            console.error(`[GHL Poller] Failed to process record ${record.id}:`, recordError.message);
          }
        }

        const lastRecord = records[records.length - 1];
        searchAfter = lastRecord.sort;

        if (totalProcessed >= total || records.length < 100) break;
      }

      console.log(`[GHL Poller] Cycle complete. Processed: ${totalProcessed}, queued for rendering: ${totalQueued}.`);

    } catch (error: any) {
      console.error('[CRON Fatal Error] GHL Poller execution failed:', error.message);
    }
  });

  console.log('[System] GoHighLevel Polling Engine (10m interval) initialized.');
};