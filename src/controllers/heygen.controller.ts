// src/controllers/heygen.controller.ts
import { Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { supabase } from '../services/supabase.service';
import { makeService } from '../services/make.service';
import { ffmpegService, formatPriceKes } from '../services/ffmpeg.service';
import { gcsService } from '../services/gcs.service';

const OUTPUT_DIR = '/home/tesla/chestone-pipeline/output';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

async function uploadOrServeLocally(localPath: string, uniqueId: string): Promise<string> {
  try {
    const gcsUrl = await gcsService.streamToGCPAndGetUrl(localPath, uniqueId);
    console.log(`[Stage 4c] Uploaded to GCS successfully.`);
    return gcsUrl;
  } catch (gcsError: any) {
    console.warn(`[Stage 4c] GCS upload failed (${gcsError.message}) — falling back to local serving.`);

    if (!PUBLIC_BASE_URL) {
      throw new Error(
        'GCS upload failed AND PUBLIC_BASE_URL is not set in .env — cannot construct a fallback URL.'
      );
    }

    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const filename = `${uniqueId}_${Date.now()}.mp4`;
    const destPath = path.join(OUTPUT_DIR, filename);
    await fs.copyFile(localPath, destPath);

    const fallbackUrl = `${PUBLIC_BASE_URL.replace(/\/$/, '')}/rendered-videos/${filename}`;
    console.log(`[Stage 4c] Served locally instead: ${fallbackUrl}`);
    return fallbackUrl;
  }
}

/**
 * Core processing for ONE variant's completed HeyGen video. Runs FFmpeg,
 * uploads/serves, updates that variant's row in property_video_variants,
 * checks whether all 3 variants are now done (marks the parent property
 * COMPLETED only when true), and fires a separate Make.com ad deployment
 * for THIS variant specifically — each variant becomes its own ad creative.
 */
async function processCompletedVariant(
  variantRow: { id: string; property_id: number; variant: string; heygen_job_id: string },
  propertyRecord: any,
  heygenVideoUrl: string,
): Promise<string> {
  const propertyImages: string[] = propertyRecord.property_images?.length
    ? propertyRecord.property_images
    : ['https://dummyimage.com/1920x1080/ccc/000.jpg&text=Property+View'];

  const extractedTag = (variantRow.heygen_job_id || '').split('_').slice(1).join('_') || 'default_avatar';

  const priceMin = propertyRecord.price_min ?? propertyRecord.price;
  const priceMax = propertyRecord.price_max ?? propertyRecord.price;

  const overlay = {
    price: priceMin ? formatPriceKes(priceMin, priceMax ?? priceMin) : 'Price on Request',
    location: propertyRecord.specific_location || 'Nairobi, Kenya',
    unitType: propertyRecord.unit_type
      ? `${propertyRecord.unit_type} — ${propertyRecord.property_name || 'Property'}`
      : propertyRecord.property_name || 'Property Listing',
  };

  const uniqueId = `${propertyRecord.property_unique_id}_${variantRow.variant}`;

  console.log(`[Stage 4b] [${variantRow.variant}] Handing off to local FFmpeg encoder...`);
  const localOutputPath = await ffmpegService.buildVerticalBrandedAsset(
    heygenVideoUrl,
    propertyImages,
    uniqueId,
    overlay,
  );

  console.log(`[Stage 4c] [${variantRow.variant}] Uploading finished asset...`);
  const finalVideoUrl = await uploadOrServeLocally(localOutputPath, uniqueId);

  await supabase
    .from('property_video_variants')
    .update({ video_url: finalVideoUrl, status: 'COMPLETED', updated_at: new Date().toISOString() })
    .eq('id', variantRow.id);

  console.log(`[Stage 4] [${variantRow.variant}] Success. Video available at: ${finalVideoUrl}`);

  await fs.unlink(localOutputPath).catch(() => {});

  makeService
    .deployAdCampaign({
      property_id: `${propertyRecord.property_unique_id}_${variantRow.variant}`,
      gcs_url: finalVideoUrl,
      avatar_tag: extractedTag,
      whatsapp_message: `Hi, I'm interested in ${propertyRecord.property_name} (Ref: ${propertyRecord.property_unique_id})`
    })
    .catch((err) => console.error(`[Stage 5 Handoff Error - ${variantRow.variant}]`, err));

  const { data: allVariants } = await supabase
    .from('property_video_variants')
    .select('status')
    .eq('property_id', variantRow.property_id);

  const allDone = allVariants && allVariants.every((v) => v.status === 'COMPLETED' || v.status === 'FAILED');
  if (allDone) {
    const anyCompleted = allVariants!.some((v) => v.status === 'COMPLETED');
    await supabase
      .from('chestone_properties')
      .update({ status: anyCompleted ? 'COMPLETED' : 'FAILED' })
      .eq('id', variantRow.property_id);
    console.log(`[Stage 4] All 3 variants finished for property ${variantRow.property_id}. Parent status: ${anyCompleted ? 'COMPLETED' : 'FAILED'}.`);
  }

  return finalVideoUrl;
}

async function findVariantAndProperty(heygenJobId: string) {
  const { data: variantRows, error: variantError } = await supabase
    .from('property_video_variants')
    .select('id, property_id, variant, heygen_job_id')
    .ilike('heygen_job_id', `${heygenJobId}%`)
    .limit(1);

  if (variantError || !variantRows || variantRows.length === 0) {
    return null;
  }

  const variantRow = variantRows[0];

  const { data: propertyRows, error: propertyError } = await supabase
    .from('chestone_properties')
    .select('id, property_unique_id, property_name, specific_location, price, price_min, price_max, unit_type, property_images')
    .eq('id', variantRow.property_id)
    .limit(1);

  if (propertyError || !propertyRows || propertyRows.length === 0) {
    return null;
  }

  return { variantRow, propertyRecord: propertyRows[0] };
}

export const handleHeyGenWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const { event_type, event_data } = req.body;

    const isVideoSuccess = event_type?.includes('video.success') || event_type?.includes('video_success');
    if (!isVideoSuccess) {
      res.status(200).json({ received: true });
      return;
    }

    res.status(200).json({ received: true });

    const heygenJobId = event_data.video_id;
    const heygenVideoUrl = event_data.url;

    const match = await findVariantAndProperty(heygenJobId);
    if (!match) {
      console.warn(`[HeyGen Webhook] Received video for unknown Job ID: ${heygenJobId}`);
      return;
    }

    console.log(`[Stage 4] Intercepted callback for variant: ${match.variantRow.variant}, property DB ID: ${match.propertyRecord.id}`);

    try {
      await processCompletedVariant(match.variantRow, match.propertyRecord, heygenVideoUrl);
    } catch (renderError) {
      console.error('[Stage 4 Render/Upload Error]:', renderError);
      await supabase
        .from('property_video_variants')
        .update({ status: 'FAILED', updated_at: new Date().toISOString() })
        .eq('id', match.variantRow.id)
        .then(() => {}, () => {});
    }
  } catch (error) {
    console.error('[Stage 4 Fatal Error Ingestion Pipeline Failure]:', error);
  }
};

export const handleManualHeygenReprocess = async (req: Request, res: Response): Promise<void> => {
  try {
    const { video_id } = req.body;
    if (!video_id) {
      res.status(400).json({ error: 'video_id is required' });
      return;
    }

    const heygenApiKey = process.env.HEYGEN_API_KEY;
    const statusResponse = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${video_id}`, {
      headers: { 'X-Api-Key': heygenApiKey as string },
    });
    const statusData = await statusResponse.json();

    if (statusData.data?.status !== 'completed') {
      res.status(400).json({ error: `Video not completed yet, status: ${statusData.data?.status}` });
      return;
    }

    const heygenVideoUrl = statusData.data.video_url;

    const match = await findVariantAndProperty(video_id);
    if (!match) {
      res.status(404).json({ error: `No variant found matching heygen_job_id starting with ${video_id}` });
      return;
    }

    console.log(`[Manual Reprocess] Re-running pipeline for variant ${match.variantRow.variant}, property DB ID: ${match.propertyRecord.id}`);

    const finalVideoUrl = await processCompletedVariant(match.variantRow, match.propertyRecord, heygenVideoUrl);

    res.status(200).json({ success: true, variant: match.variantRow.variant, video_url: finalVideoUrl });
  } catch (error: any) {
    console.error('[Manual Reprocess] Failed:', {
      message: error.message,
      cause: error.cause,
      code: error.cause?.code,
      stack: error.stack,
    });
    res.status(500).json({ error: error.message, code: error.cause?.code || null });
  }
};