// src/scripts/build-avatar-samples.ts
//
// One-off comparison script — NOT part of the main pipeline. Pulls a real
// property from Supabase (populated from GHL by the poller) and builds two
// samples sharing one $7 Cinematic Avatar entrance shot: Sample 1 is just
// the entrance (short), Sample 2 reuses that same entrance clip then adds
// real-photo talking scenes for the rest of the property.
//
// Run with: npx ts-node src/scripts/build-avatar-samples.ts

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { supabase } from '../services/supabase.service';
import { buildScenePlan } from '../services/scene-planner.service';
import { generateCinematicShot, generateNarrationAudio } from '../services/cinematic-avatar.service';
import { heygenChunkService } from '../services/heygen-chunk.service';
import { runwayService } from '../services/runway.service';
import { ffmpegService, DynamicScene } from '../services/ffmpeg.service';
import { selectOptimalPersona } from '../services/personas.service';

const PROPERTY_REF = 'LIR-3BR-PLAT'; // the real property_unique_id from GHL
const SAVE_DIR = '/home/tesla/chestone-pipeline/saved-cinematic';
const OUTPUT_DIR = '/home/tesla/chestone-pipeline/sample-output';
const SAMPLE1_SECONDS = 16; // your 15-17s target

async function main() {
  // ── Step 1: pull the REAL property straight from Supabase (populated from GHL)
  const { data: property, error } = await supabase
    .from('chestone_properties')
    .select('property_name, specific_location, price_min, price_max, price, unit_type, property_images')
    .eq('property_unique_id', PROPERTY_REF)
    .single();

  if (error || !property) {
    throw new Error(`Property ${PROPERTY_REF} not found in Supabase — confirm it's uploaded in GHL and the poller has run.`);
  }

  const propertyData = {
    property_name: property.property_name,
    specific_location: property.specific_location,
    price_min: property.price_min ?? property.price,
    price_max: property.price_max ?? property.price,
    unit_type: property.unit_type,
  };
  const allPhotoUrls: string[] = property.property_images || [];

  if (allPhotoUrls.length === 0) {
    throw new Error(`Property ${PROPERTY_REF} has no photos in property_images — upload photos in GHL first.`);
  }

  await fs.mkdir(SAVE_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const persona = await selectOptimalPersona('Investment');

  // ── Step 2: one scene plan, on the FULL photo set, so wording/tone stays
  // consistent between both samples.
  console.log('[Samples] Building scene plan for full photo set...');
  const scenes = await buildScenePlan(propertyData, allPhotoUrls, 'Investment');
  const entranceScene = scenes[0];       // isCinematic scene, per i===0 logic
  const roomScenes = scenes.slice(1);    // kitchen, bedroom, pool, etc.

  // ── Step 3: generate the cinematic entrance shot + narration ONCE.
  console.log('[Samples] Generating cinematic entrance shot (one $7 charge)...');
  const cinematicVideoPath = await generateCinematicShot({
    prompt: entranceScene.cinematicPrompt!,
    avatarId: process.env.CHESTONE_PRESENTER_AVATAR_ID!,
    durationSeconds: SAMPLE1_SECONDS,
    resolution: '1080p',
  });
  const narrationAudioPath = await generateNarrationAudio(entranceScene.script, persona.voice_id);

  const savedVideoPath = path.join(SAVE_DIR, 'entrance_shot.mp4');
  const savedAudioPath = path.join(SAVE_DIR, 'entrance_narration.mp3');
  await fs.copyFile(cinematicVideoPath, savedVideoPath);
  await fs.copyFile(narrationAudioPath, savedAudioPath);
  console.log(`[Samples] Saved permanent copies to ${SAVE_DIR}`);

  const savedScriptPath = path.join(SAVE_DIR, 'entrance_script.txt');
  await fs.writeFile(savedScriptPath, entranceScene.script, 'utf-8');
  console.log(`[Samples] Saved script text to ${savedScriptPath}`);

  // ── Step 4: Sample 1 — entrance only, ~15-17s.
  console.log('[Samples] Building Sample 1 (entrance only)...');
  const sample1Scenes: DynamicScene[] = [
    { kind: 'cinematic', cinematicVideoPath, narrationAudioPath },
  ];
  const sample1Path = await ffmpegService.buildDynamicSyncedAsset(
    sample1Scenes,
    'sample1_entrance',
    {
      price: 'Price on Request',
      location: propertyData.specific_location,
      unitType: propertyData.unit_type,
    },
  );
  const sample1Final = path.join(OUTPUT_DIR, 'sample1_entrance_only.mp4');
  await fs.copyFile(sample1Path, sample1Final);
  console.log(`[Samples] Sample 1 ready: ${sample1Final}`);

  // ── Step 5: Sample 2 — reused entrance + real talking-chunk scenes.
  console.log('[Samples] Building Sample 2 (entrance + real room photos)...');
  const reuseVideoPath = path.join(os.tmpdir(), `reuse_cinematic_${Date.now()}.mp4`);
  const reuseAudioPath = path.join(os.tmpdir(), `reuse_narration_${Date.now()}.mp3`);
  await fs.copyFile(savedVideoPath, reuseVideoPath);
  await fs.copyFile(savedAudioPath, reuseAudioPath);

  const sample2Scenes: DynamicScene[] = [
    { kind: 'cinematic', cinematicVideoPath: reuseVideoPath, narrationAudioPath: reuseAudioPath },
  ];

  for (const scene of roomScenes) {
    console.log(`[Samples] Generating talking-chunk scene for: ${scene.photoUrl}`);
    const [heygenChunkPath, runwayVideoPath] = await Promise.all([
      heygenChunkService.generateVoiceChunk({
        script: scene.script,
        avatarId: persona.avatar_id,
        voiceId: persona.voice_id,
      }),
      runwayService.generateSceneVideo(scene.photoUrl, scene.runwayPrompt),
    ]);
    sample2Scenes.push({ kind: 'talking', runwayVideoPath, heygenChunkPath });
  }

  const sample2Path = await ffmpegService.buildDynamicSyncedAsset(
    sample2Scenes,
    'sample2_full',
    {
      price: 'Price on Request',
      location: propertyData.specific_location,
      unitType: propertyData.unit_type,
    },
  );
  const sample2Final = path.join(OUTPUT_DIR, 'sample2_full_property.mp4');
  await fs.copyFile(sample2Path, sample2Final);
  console.log(`[Samples] Sample 2 ready: ${sample2Final}`);

  console.log('\n[Samples] Done. Both files are in', OUTPUT_DIR);
}

main().catch((err) => {
  console.error('[Samples] Failed:', err);
  process.exit(1);
});