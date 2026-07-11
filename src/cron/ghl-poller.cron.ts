import cron from 'node-cron';
import { supabase } from '../services/supabase.service';
import { videoGenerationQueue } from '../config/queue.config';
import { makeService } from '../services/make.service';

const GHL_API_TOKEN = process.env.GHL_API_TOKEN;
const GHL_CUSTOM_OBJECT_ID = process.env.GHL_PROPERTY_OBJECT_ID; // The ID of your Property Custom Object
const GHL_BASE_URL = 'https://services.leadconnectorhq.com/custom-objects';

interface GHLCustomObjectRecord {
  id: string;
  customData: {
    property_id?: string;
    property_name?: string;
    location?: string;
    status?: string;
    manual_video_url?: string;
    image_urls?: string[];
    amenities?: Record<string, string[]>;
    price?: number;
  };
}

export const initGhlPollerCron = () => {
  // Polls GoHighLevel every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    console.log('[CRON] Polling GoHighLevel for new/updated properties...');

    if (!GHL_API_TOKEN || !GHL_CUSTOM_OBJECT_ID) {
      console.warn('[GHL Poller] Missing GHL credentials in .env. Skipping poll.');
      return;
    }

    try {
      // 1. Fetch records from GoHighLevel Custom Objects
      // GHL v2 API strictly requires the Version header
      const response = await fetch(`${GHL_BASE_URL}/${GHL_CUSTOM_OBJECT_ID}/records?limit=100`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${GHL_API_TOKEN}`,
          'Version': '2021-07-28',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`GHL API Error: ${response.status} - ${errText}`);
      }

      const { records }: { records: GHLCustomObjectRecord[] } = await response.json();

      if (!records || records.length === 0) {
        console.log('[GHL Poller] No records found in this polling cycle.');
        return;
      }

      console.log(`[GHL Poller] Successfully retrieved ${records.length} records. Commencing processing...`);

      // 2. Process each record with isolated error handling
      for (const record of records) {
        try {
          const customData = record.customData || {};
          
          // Upsert into Supabase (Cache it)
          // We use onConflict: 'ghl_record_id' so we don't create duplicate properties
          const { data: property, error: dbError } = await supabase
            .from('chestone_properties')
            .upsert({
              ghl_record_id: record.id,
              property_unique_id: customData.property_id || record.id,
              property_name: customData.property_name || 'Unnamed Property',
              specific_location: customData.location || 'Location unverified',
              status: customData.status || 'PENDING_INGESTION',
              manual_video_url: customData.manual_video_url || null,
              property_images: customData.image_urls || [],
              amenities: customData.amenities || {},
              price: customData.price || 0
            }, { onConflict: 'ghl_record_id' })
            .select('*')
            .single();

          if (dbError || !property) {
            console.error(`[GHL Poller] DB Upsert Error for GHL Record ${record.id}:`, dbError?.message);
            continue; // Skip to the next record so one failure doesn't crash the loop
          }

          // 3. Routing Logic: Only process items sitting in 'PENDING_INGESTION'
          if (property.status === 'PENDING_INGESTION') {
            
            if (property.manual_video_url) {
              // BRANCH A: Manual Video Bypass
              console.log(`[Router] Property ${property.property_name} has manual video. Bypassing AI generation.`);
              
              // Mark as routed so we don't process it again next polling cycle
              await supabase
                .from('chestone_properties')
                .update({ status: 'ROUTED_MANUAL' })
                .eq('id', property.id);

              // Push straight to Make.com ad router
              await makeService.deployAdCampaign({
                property_id: property.property_unique_id,
                gcs_url: property.manual_video_url,
                avatar_tag: 'manual_bypass'
              }).catch(err => console.error('[Router] Make.com deployment failed:', err.message));

            } else {
              // BRANCH B: Automated AI Video Generation
              console.log(`[Router] Property ${property.property_name} queuing for HeyGen/FFmpeg pipeline.`);
              
              // Mark as rendering so the next 10-minute poll ignores it
              await supabase
                .from('chestone_properties')
                .update({ status: 'RENDERING' })
                .eq('id', property.id);

              // Push to Redis Queue for background processing
              await videoGenerationQueue.add({
                internal_db_id: property.id,
                property_data: property 
              }, {
                attempts: 3,
                backoff: { type: 'exponential', delay: 10000 },
                removeOnComplete: true
              });
            }
          }
        } catch (recordError: any) {
          // Isolate errors per record
          console.error(`[GHL Poller] Failed to process record ${record.id}:`, recordError.message);
        }
      }

    } catch (error: any) {
      console.error('[CRON Fatal Error] GHL Poller execution failed:', error.message);
    }
  });

  console.log('[System] GoHighLevel Polling Engine (10m interval) initialized.');
};