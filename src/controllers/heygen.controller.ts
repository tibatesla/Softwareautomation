// src/controllers/heygen.controller.ts
import { Request, Response } from 'express';
import { supabase } from '../services/supabase.service';
import { makeService } from '../services/make.service'; // NEW: Import the Make Service
//import { hyperaiService } from '../services/make.service'; 
import { ffmpegService } from '../services/ffmpeg.service'; 
import { gcsService } from '../services/gcs.service'; // Ensure this is imported
import fs from 'fs/promises';

export const handleHeyGenWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { event_type, event_data } = req.body;

    const isVideoSuccess = event_type?.includes('video.success') || event_type?.includes('video_success');
    if (!isVideoSuccess) {
       res.status(200).json({ received: true });
       return;
    }

    // Immediate acknowledgment to prevent retries
    res.status(200).json({ received: true });

    const heygenJobId = event_data.video_id;
    const heygenVideoUrl = event_data.url;

    // 1. Locate the DB record
    const { data: properties, error: findError } = await supabase
      .from('chestone_properties')
      .select('id, property_unique_id, heygen_job_id, property_images')
      .ilike('heygen_job_id', `${heygenJobId}%`)
      .limit(1);

    if (findError || !properties || properties.length === 0) {
      console.warn(`[HeyGen Webhook] Received video for unknown Job ID: ${heygenJobId}`);
      return;
    }

    const propertyRecord = properties[0];
    const propertyImages = propertyRecord.property_images || [];
    
    // Fallback images in case Lofty payload was missing them
    const photo1 = propertyImages[0] || 'https://dummyimage.com/1920x1080/ccc/000.jpg&text=Property+View+1';
    const photo2 = propertyImages[1] || 'https://dummyimage.com/1920x1080/ccc/000.jpg&text=Property+View+2';

    console.log(`[Stage 4] Intercepted callback for DB ID: ${propertyRecord.id}`);

    const storedJobId = propertyRecord.heygen_job_id || '';
    const extractedTag = storedJobId.split('_').slice(1).join('_') || 'default_avatar';

    // 2. FFmpeg Pipeline: Download, Stitch, Format Vertical, Brand
    console.log(`[Stage 4b] Handing off to local FFmpeg encoder...`);
    const localOutputPath = await ffmpegService.buildVerticalBrandedAsset(
      heygenVideoUrl,
      photo1,
      photo2,
      propertyRecord.property_unique_id
    );

    // 3. Stream to Google Cloud Storage
    console.log(`[Stage 4c] Streaming finished asset to GCP...`);
    const gcsSignedUrl = await gcsService.streamToGCPAndGetUrl(
      localOutputPath, 
      propertyRecord.property_unique_id
    );

    // 4. Update the Database Record with final GCS URL
    await supabase
      .from('chestone_properties')
      .update({
        gcs_video_url: gcsSignedUrl,
        status: 'COMPLETED',
      })
      .eq('id', propertyRecord.id);

    console.log(`[Stage 4] Success. Pipeline asset tracking finalized inside Supabase.`);

    // 5. Cleanup the local output file now that it's safe in the cloud
    await fs.unlink(localOutputPath).catch(err => 
      console.error(`[Cleanup Warning] Failed to delete ${localOutputPath}`, err)
    );

   // 6. Asynchronous Pipeline Handoff (Stage 5 via Make.com Custom Webhook)
    makeService.deployAdCampaign({
      property_id: propertyRecord.property_unique_id,
      gcs_url: gcsSignedUrl, 
      avatar_tag: extractedTag, 
    }).catch(err => console.error('[Stage 5 Handoff Error - Make.com Router]', err));

  } catch (error) {
    console.error('[Stage 4 Fatal Error Ingestion Pipeline Failure]:', error);
  }
};