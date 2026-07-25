// src/cron/ghl-poller.cron.ts
import cron from 'node-cron';
import { supabase } from '../services/supabase.service';
import { videoGenerationQueue } from '../config/queue.config';
import { makeService } from '../services/make.service';
import { ensureLocationVideoQueued } from '../services/location-video.service';

const GHL_API_TOKEN = process.env.GHL_API_TOKEN;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const GHL_OBJECT_KEY = process.env.GHL_PROPERTY_OBJECT_KEY ?? 'custom_objects.properties';
const GHL_BASE_URL = 'https://services.leadconnectorhq.com/objects';

function parseUnitPriceBreakdown(raw?: string): Array<{ type: string; price_min: number; price_max: number }> {
  if (!raw || typeof raw !== 'string') return [];

  return raw
    .split('|')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [typePart, pricePart] = entry.split(':');
      if (!typePart || !pricePart) return null;

      const type = typePart.trim();
      const [minPart, maxPart] = pricePart.split('-').map((part) => part.trim());
      const price_min = Number.parseFloat(minPart.replace(/[^\d.]/g, ''));
      const price_max = Number.parseFloat(maxPart.replace(/[^\d.]/g, ''));

      if (!type || Number.isNaN(price_min) || Number.isNaN(price_max)) return null;
      return {
        type,
        price_min,
        price_max,
      };
    })
    .filter((entry): entry is { type: string; price_min: number; price_max: number } => Boolean(entry));
}

interface GHLCustomObjectRecord {
  id: string;
  sort: [number, string]; // cursor for pagination
  properties: {
    property_id?: string;
    property_name?: string;
    location?: string;
    sublocation?: string; // NEW — e.g. "Gitanga Rd", separate from main location
    status?: string;
    manual_video_url?: string;
    image_urls?: string | string[]; // GHL may return this as a flat comma-separated string
                                    // or as an array, depending on field setup/legacy data.
    amenities?: string | string[]; // Checkbox-style fields can come back as an array of
                                    // slugs, while older records may still send a plain string.
    property_description?: string; // was: description
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
    show_house_ready?: string[]; // was: boolean — GHL checkbox always returns an array
    unit_price_breakdown?: string; // NEW — delimited text field for
                                    // multi-unit-type properties, e.g.
                                    // "1 Bed:10.5-10.9M|2 Bed:16.3-16.9M".
                                    // Parsed into structured objects
                                    // wherever propertyData is built for
                                    // buildScenePlan.
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

            // GHL may send these fields as either strings or arrays.
            // Normalize both shapes into a clean array of trimmed values.
            const imageUrls = Array.isArray(props.image_urls)
              ? props.image_urls
                  .map((url) => String(url).trim())
                  .filter(Boolean)
                  .filter((url) => {
                    try {
                      const parsed = new URL(url);
                      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
                    } catch {
                      console.warn(`[GHL Poller] Dropping non-URL entry in image_urls: "${url.slice(0, 60)}..."`);
                      return false;
                    }
                  })
              : typeof props.image_urls === 'string'
                ? props.image_urls
                    .split(',')
                    .map((url) => url.trim())
                    .filter(Boolean)
                    .filter((url) => {
                      try {
                        const parsed = new URL(url);
                        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
                      } catch {
                        console.warn(`[GHL Poller] Dropping non-URL entry in image_urls: "${url.slice(0, 60)}..."`);
                        return false;
                      }
                    })
                : [];

            const amenitiesList = Array.isArray(props.amenities)
              ? props.amenities
                  .map((item) => String(item).trim())
                  .filter(Boolean)
              : [];

            const unitPriceBreakdown = parseUnitPriceBreakdown(props.unit_price_breakdown);

            // Cif this record already exists BEFORE
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
              unit_price_breakdown: unitPriceBreakdown,
              developer_contact: props.developer_contact || null,
              developer_email: props.developer_email || null,
              developer_phone: props.developer_phone || null,
              completion_time: props.completion_time || null,
              level_floors: props.level_floors || null,
              view_description: props.view || null,
              description: props.property_description || null,
              show_house_ready: Array.isArray(props.show_house_ready) && props.show_house_ready.includes('yes'),
              sublocation: props.sublocation || null,
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
              if (dbError?.message?.includes('property_unique_id')) {
                console.error(
                  `[GHL Poller] Property Id "${upsertPayload.property_unique_id}" is already used by another ` +
                  `property (GHL Record ${record.id}, "${upsertPayload.property_name}"). ` +
                  `Go into GHL and change this property's Property Id field to something unique.`
                );
              } else {
                console.error(`[GHL Poller] DB Upsert Error for GHL Record ${record.id}:`, dbError?.message);
              }
              continue;
            }

            totalProcessed += 1;

//if (!existingRecord) {
 // ensureLocationVideoQueued(property.specific_location).catch((err: any) =>
   //console.error(`[GHL Poller] Location video queue failed for ${property.specific_location}:`, err.message)
 // );
//}

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
                  avatar_tag: 'manual_bypass',
                  whatsapp_message: `Hi, I'm interested in ${property.property_name} (Ref: ${property.property_unique_id})`
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

                // TEST_SINGLE_VARIANT in .env limits rendering to ONE
                // variant instead of all 3, for cheap testing. This
                // replaces manually commenting out array entries in code —
                // that approach kept getting silently undone every time
                // this file was replaced during bug fixes. An env var
                // survives file replacements; a code comment doesn't.
                // Leave unset (or empty) for real 3-variant production runs.
                const allVariants: Array<'Investment' | 'Lifestyle' | 'Architectural'> = [
                  'Investment', 'Lifestyle', 'Architectural'
                ];
                const testSingle = process.env.TEST_SINGLE_VARIANT as 'Investment' | 'Lifestyle' | 'Architectural' | undefined;
                const variants = testSingle && allVariants.includes(testSingle)
                  ? [testSingle]
                  : allVariants;

                if (testSingle) {
                  console.log(`[Router] TEST_SINGLE_VARIANT active — only generating ${testSingle} (set to test cheaply; unset in .env for full 3-variant runs).`);
                }

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