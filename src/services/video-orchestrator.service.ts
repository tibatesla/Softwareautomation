// src/services/video-orchestrator.service.ts
//
// The new per-variant pipeline. Replaces heygenService.processVideo as the
// thing video.worker.ts calls. Flow per variant:
//
//   scene plan → [per scene: HeyGen chunk + Runway scene, in parallel] →
//   buildDynamicSyncedAsset → upload/serve → DB update → Make.com deploy
//
// WIRE-UP: in src/queues/video.worker.ts, replace
//   await heygenService.processVideo(job.data);
// with
//   await videoOrchestrator.produceVariantVideo(job.data);
//
// COST PER VARIANT (know this number): N scenes × (1 HeyGen render + 1 Runway
// generation). At 4 scenes: 4 HeyGen + 4 Runway (~$1 Runway) per variant,
// ×3 variants = 12 HeyGen renders + 12 Runway gens (~$3) PER PROPERTY.

import { supabase } from './supabase.service';
import { buildScenePlan, VariantType } from './scene-planner.service';
import { heygenChunkService } from './heygen-chunk.service';
import { runwayService } from './runway.service';
import { ffmpegService } from './ffmpeg.service';
import { makeService } from './make.service';
import { gcsService } from './gcs.service';
import fs from 'fs/promises';
import path from 'path';

const OUTPUT_DIR = '/home/tesla/chestone-pipeline/output';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

// Persona pools — same structure as before. ⚠️ STILL PLACEHOLDER IDS unless
// you've replaced them: all identical = all variants sound/look the same.
// Swap in 3+ real distinct HeyGen avatar/voice IDs before the client demo.
const PERSONAS: Record<VariantType, Array<{ tag: string; avatarId: string; voiceId: string }>> = {
  Investment: [
    { tag: 'inv_avatar_alpha', avatarId: '27ee7bdcf0e3442f8fee7dd48618a895', voiceId: '330290724a1b470fb63153f34d4c0183' },
  ],
  Lifestyle: [
    { tag: 'life_avatar_alpha', avatarId: '27ee7bdcf0e3442f8fee7dd48618a895', voiceId: '330290724a1b470fb63153f34d4c0183' },
  ],
  Architectural: [
    { tag: 'arch_avatar_alpha', avatarId: '27ee7bdcf0e3442f8fee7dd48618a895', voiceId: '330290724a1b470fb63153f34d4c0183' },
  ],
};

export interface ProduceVariantParams {
  internal_db_id: number;
  variant: VariantType;
  property_data: Record<string, any>;
}

async function uploadOrServeLocally(localPath: string, uniqueId: string): Promise<string> {
  try {
    return await gcsService.streamToGCPAndGetUrl(localPath, uniqueId);
  } catch {
    if (!PUBLIC_BASE_URL) throw new Error('GCS failed and PUBLIC_BASE_URL not set — no fallback available.');
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const filename = `${uniqueId}_${Date.now()}.mp4`;
    await fs.copyFile(localPath, path.join(OUTPUT_DIR, filename));
    return `${PUBLIC_BASE_URL.replace(/\/$/, '')}/rendered-videos/${filename}`;
  }
}

export class VideoOrchestrator {
  public async produceVariantVideo(params: ProduceVariantParams): Promise<void> {
    const { internal_db_id, variant, property_data } = params;
    const photoUrls: string[] = property_data.property_images || [];

    if (photoUrls.length === 0) {
      throw new Error(`Property ${internal_db_id} has no images — cannot build scene plan.`);
    }

    const pool = PERSONAS[variant];
    const persona = pool[Math.floor(Math.random() * pool.length)];

    console.log(`[Orchestrator] [${variant}] Analyzing photos + planning ${Math.min(photoUrls.length, 4)} scenes...`);
    const scenes = await buildScenePlan(property_data, photoUrls, variant);

    await supabase
      .from('property_video_variants')
      .update({ status: 'RENDERING', heygen_job_id: `chunked_${persona.tag}_${Date.now()}`, updated_at: new Date().toISOString() })
      .eq('property_id', internal_db_id)
      .eq('variant', variant);

    try {
      // Generate all scene assets. HeyGen+Runway for the SAME scene run in
      // parallel (independent APIs); scenes run sequentially to avoid
      // hammering both APIs with 8 simultaneous jobs per variant.
      const sceneAssets: Array<{ runwayVideoPath: string; heygenChunkPath: string }> = [];
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        console.log(`[Orchestrator] [${variant}] Scene ${i + 1}/${scenes.length}: generating voice + visuals in parallel...`);
        const [heygenChunkPath, runwayVideoPath] = await Promise.all([
          heygenChunkService.generateVoiceChunk({
            script: scene.script,
            avatarId: persona.avatarId,
            voiceId: persona.voiceId,
          }),
          runwayService.generateSceneVideo(scene.photoUrl, scene.runwayPrompt),
        ]);
        sceneAssets.push({ runwayVideoPath, heygenChunkPath });
      }

      // Assemble
      const priceMin = property_data.price_min ?? property_data.price;
      const priceMax = property_data.price_max ?? property_data.price;
      const overlay = {
        price: priceMin
          ? (priceMin === priceMax || !priceMax
              ? `KES ${(priceMin / 1_000_000).toFixed(1)}M`
              : `KES ${(priceMin / 1_000_000).toFixed(1)}M - ${(priceMax / 1_000_000).toFixed(1)}M`)
          : 'Price on Request',
        location: property_data.specific_location || 'Nairobi, Kenya',
        unitType: property_data.unit_type
          ? `${property_data.unit_type} — ${property_data.property_name || 'Property'}`
          : property_data.property_name || 'Property Listing',
      };

      const uniqueId = `${property_data.property_unique_id}_${variant}`;
      const localPath = await ffmpegService.buildDynamicSyncedAsset(sceneAssets, uniqueId, overlay);
      const finalUrl = await uploadOrServeLocally(localPath, uniqueId);
      await fs.unlink(localPath).catch(() => {});

      await supabase
        .from('property_video_variants')
        .update({ video_url: finalUrl, status: 'COMPLETED', updated_at: new Date().toISOString() })
        .eq('property_id', internal_db_id)
        .eq('variant', variant);

      console.log(`[Orchestrator] [${variant}] DONE: ${finalUrl}`);

      makeService.deployAdCampaign({
        property_id: uniqueId,
        gcs_url: finalUrl,
        avatar_tag: persona.tag,
      }).catch((err) => console.error(`[Orchestrator] Make.com deploy failed [${variant}]:`, err.message));

      // Parent property completion check (same logic as webhook path)
      const { data: allVariants } = await supabase
        .from('property_video_variants')
        .select('status')
        .eq('property_id', internal_db_id);
      const allDone = allVariants?.every((v) => v.status === 'COMPLETED' || v.status === 'FAILED');
      if (allDone) {
        const anyOk = allVariants!.some((v) => v.status === 'COMPLETED');
        await supabase
          .from('chestone_properties')
          .update({ status: anyOk ? 'COMPLETED' : 'FAILED' })
          .eq('id', internal_db_id);
      }
    } catch (err) {
      await supabase
        .from('property_video_variants')
        .update({ status: 'FAILED', updated_at: new Date().toISOString() })
        .eq('property_id', internal_db_id)
        .eq('variant', variant);
      throw err;
    }
  }
}

export const videoOrchestrator = new VideoOrchestrator();