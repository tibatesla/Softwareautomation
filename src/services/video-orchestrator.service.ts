// src/services/video-orchestrator.service.ts
//
// The new per-variant pipeline. Replaces heygenService.processVideo as the
// thing video.worker.ts calls. Flow per variant:
//
//   scene plan → [per scene: cinematic OR (HeyGen chunk + Runway scene), in
//   parallel where applicable] → buildDynamicSyncedAsset → upload/serve →
//   DB update → Make.com deploy
//
// WIRE-UP: in src/queues/video.worker.ts, replace
//   await heygenService.processVideo(job.data);
// with
//   await videoOrchestrator.produceVariantVideo(job.data);
//
// COST PER VARIANT (know this number): N scenes × (1 HeyGen render + 1 Runway
// generation). At 4 scenes: 4 HeyGen + 4 Runway (~$1 Runway) per variant,
// ×3 variants = 12 HeyGen renders + 12 Runway gens (~$3) PER PROPERTY.
//
// CINEMATIC ADDITION — cost note: when USE_CINEMATIC_AVATAR is on, the
// opening scene (marked by scene-planner.service.ts) is replaced with ONE
// Cinematic Avatar shot instead of a talking HeyGen chunk + Runway pair.
// That single shot is billed flat at 60-150 HeyGen credits regardless of
// length — materially more than a talking chunk. Deliberately capped to
// one scene per variant for this reason; do not remove the isCinematic
// restriction in scene-planner without re-checking the cost math with the
// client first.

import { supabase } from './supabase.service';
import { buildScenePlan, VariantType } from './scene-planner.service';
import { heygenChunkService } from './heygen-chunk.service';
import { runwayService } from './runway.service';
import { generateCinematicShot, generateNarrationAudio } from './cinematic-avatar.service';
import { ffmpegService, DynamicScene } from './ffmpeg.service';
import { makeService } from './make.service';
import { gcsService } from './gcs.service';
import { selectOptimalPersona } from './personas.service';
import fs from 'fs/promises';
import path from 'path';

const OUTPUT_DIR = '/home/tesla/chestone-pipeline/output';
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL;

// Feature flag — same pattern as TEST_SINGLE_VARIANT (see project docs
// 3.11). Off by default so nothing changes until this is deliberately
// turned on for a real test run.
const USE_CINEMATIC_AVATAR = process.env.USE_CINEMATIC_AVATAR === 'true';
const CHESTONE_PRESENTER_AVATAR_ID = process.env.CHESTONE_PRESENTER_AVATAR_ID;

// Persona selection (real avatars + performance-based rotation) now lives
// in personas.service.ts — single source of truth, see that file's header
// comment for why this used to be duplicated across two files.

// Add near the top of video-orchestrator.service.ts, alongside other helpers

const WORDS_PER_SECOND = 2.3; // rough natural-speech estimate
const MAX_SHOT_SECONDS = 15;
const MIN_SHOT_SECONDS = 4;

function estimateSeconds(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(wordCount / WORDS_PER_SECOND);
}

/**
 * Splits a script into sentence-based chunks, each estimated to fit within
 * MAX_SHOT_SECONDS. Greedy: keeps adding sentences to the current chunk
 * until adding the next one would exceed the cap, then starts a new chunk.
 * A single sentence longer than the cap on its own still gets its own
 * chunk (better to slightly overrun one shot than silently drop content).
 */
function splitScriptForCinematic(script: string): string[] {
  const sentences = script.match(/[^.!?]+[.!?]+/g) || [script];
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = (current + ' ' + sentence).trim();
    if (current && estimateSeconds(candidate) > MAX_SHOT_SECONDS) {
      chunks.push(current.trim());
      current = sentence.trim();
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

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

    try {
      if (photoUrls.length === 0) {
        throw new Error(`Property ${internal_db_id} has no images — cannot build scene plan.`);
      }
      if (USE_CINEMATIC_AVATAR && !CHESTONE_PRESENTER_AVATAR_ID) {
        throw new Error('USE_CINEMATIC_AVATAR is true but CHESTONE_PRESENTER_AVATAR_ID is not set in .env');
      }

      const persona = await selectOptimalPersona(variant);

      console.log(`[Orchestrator] [${variant}] Analyzing photos + planning ${Math.min(photoUrls.length, 4)} scenes...`);
      const scenes = await buildScenePlan(property_data, photoUrls, variant);

      await supabase
        .from('property_video_variants')
        .update({ status: 'RENDERING', heygen_job_id: `chunked_${persona.internal_tag}_${Date.now()}`, updated_at: new Date().toISOString() })
        .eq('property_id', internal_db_id)
        .eq('variant', variant);

      // Generate all scene assets. Talking scenes run HeyGen+Runway in
      // parallel (independent APIs); scenes run sequentially to avoid
      // hammering both APIs with 8 simultaneous jobs per variant. Cinematic
      // scenes run their own two calls (video + narration) in parallel too.
      const sceneAssets: DynamicScene[] = [];
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const useCinematicForThisScene = USE_CINEMATIC_AVATAR && scene.isCinematic && CHESTONE_PRESENTER_AVATAR_ID;

        if (useCinematicForThisScene) {
  const totalEstimate = estimateSeconds(scene.script);

  if (totalEstimate <= MAX_SHOT_SECONDS) {
    const shotSeconds = Math.min(Math.max(totalEstimate, MIN_SHOT_SECONDS), MAX_SHOT_SECONDS);
    console.log(`[Orchestrator] [${variant}] Scene ${i + 1}/${scenes.length}: cinematic shot + narration in parallel (${shotSeconds}s)...`);

    const [cinematicVideoPath, narrationAudioPath] = await Promise.all([
      generateCinematicShot({
        prompt: scene.cinematicPrompt!,
        avatarId: CHESTONE_PRESENTER_AVATAR_ID!,
        durationSeconds: shotSeconds,
        resolution: '1080p',
      }),
      generateNarrationAudio(scene.script, persona.voice_id),
    ]);
    sceneAssets.push({ kind: 'cinematic', cinematicVideoPath, narrationAudioPath });

  } else {
    const chunks = splitScriptForCinematic(scene.script);
    console.log(`[Orchestrator] [${variant}] Scene ${i + 1}/${scenes.length}: cinematic script needs ${totalEstimate}s — splitting into ${chunks.length} shots (cost: ${chunks.length}x cinematic credits for this scene).`);

    for (let c = 0; c < chunks.length; c++) {
      const chunkSeconds = Math.min(Math.max(estimateSeconds(chunks[c]), MIN_SHOT_SECONDS), MAX_SHOT_SECONDS);
      console.log(`[Orchestrator] [${variant}] Scene ${i + 1}, cinematic part ${c + 1}/${chunks.length} (${chunkSeconds}s)...`);

      const [cinematicVideoPath, narrationAudioPath] = await Promise.all([
        generateCinematicShot({
          prompt: scene.cinematicPrompt!,
          avatarId: CHESTONE_PRESENTER_AVATAR_ID!,
          durationSeconds: chunkSeconds,
          resolution: '1080p',
        }),
        generateNarrationAudio(chunks[c], persona.voice_id),
      ]);
      sceneAssets.push({ kind: 'cinematic', cinematicVideoPath, narrationAudioPath });
    }
  }
} else {
          console.log(`[Orchestrator] [${variant}] Scene ${i + 1}/${scenes.length}: generating voice + visuals in parallel...`);
          const [heygenChunkPath, runwayVideoPath] = await Promise.all([
            heygenChunkService.generateVoiceChunk({
              script: scene.script,
              avatarId: persona.avatar_id,
              voiceId: persona.voice_id,
            }),
            runwayService.generateSceneVideo(scene.photoUrl, scene.runwayPrompt),
          ]);
          sceneAssets.push({ kind: 'talking', runwayVideoPath, heygenChunkPath });
        }
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

      // Deploy THIS variant's ad immediately — don't wait for the other 2
      // variants, each is independently ready to advertise once done.
      makeService.deployAdCampaign({
        property_id: uniqueId,
        gcs_url: finalUrl,
        avatar_tag: persona.internal_tag,
        whatsapp_message: `Hi, I'm interested in ${property_data.property_name} (Ref: ${property_data.property_unique_id})`
      }).catch((err) => console.error(`[Orchestrator] Make.com deploy failed [${variant}]:`, err.message));

      await this.checkParentCompletion(internal_db_id);
    } catch (err) {
      // Runs for EVERY failure path — no-images, vision, HeyGen, Runway,
      // cinematic, narration, FFmpeg, upload. Previously the no-images check
      // threw before this block existed in scope, meaning that specific
      // failure never marked the variant FAILED and the property retried
      // forever on every server restart. Now every failure reaches here.
      await supabase
        .from('property_video_variants')
        .update({ status: 'FAILED', updated_at: new Date().toISOString() })
        .eq('property_id', internal_db_id)
        .eq('variant', variant);

      await this.checkParentCompletion(internal_db_id);
      throw err;
    }
  }

  /** Checks if all 3 variants for a property have reached a terminal state
   *  (COMPLETED or FAILED) and updates the parent property's status
   *  accordingly. Called after both success and failure so a property can
   *  never get stuck at RENDERING forever just because one variant died
   *  before this check used to run. */
  private async checkParentCompletion(internal_db_id: number): Promise<void> {
    const { data: allVariants } = await supabase
      .from('property_video_variants')
      .select('status')
      .eq('property_id', internal_db_id);

    const allDone = allVariants?.every((v) => v.status === 'COMPLETED' || v.status === 'FAILED');
    if (allDone && allVariants) {
      const anyOk = allVariants.some((v) => v.status === 'COMPLETED');
      await supabase
        .from('chestone_properties')
        .update({ status: anyOk ? 'COMPLETED' : 'FAILED' })
        .eq('id', internal_db_id);
      console.log(`[Orchestrator] All variants terminal for property ${internal_db_id}. Parent: ${anyOk ? 'COMPLETED' : 'FAILED'}.`);
    }
  }
}

export const videoOrchestrator = new VideoOrchestrator();