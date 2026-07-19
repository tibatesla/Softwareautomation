// src/services/cinematic-avatar.service.ts
//
// Generates HeyGen Cinematic Avatar (Seedance) shots — the avatar walking
// through / gesturing within a described scene, camera movement included.
// Kept separate from heygen-chunk.service.ts because the request shape and
// purpose are fundamentally different: Cinematic Avatar takes a scene
// PROMPT (no script/voice_id), and returns a self-contained clip with the
// avatar already composited into its environment — no green-screen overlay
// needed downstream, unlike the talking-avatar chunks.
//
// Cinematic Avatar has no narration built in, so this file also exposes
// generateNarrationAudio() (HeyGen TTS) to produce the voice track that
// ffmpeg.service.ts's buildCinematicChunk() muxes onto the visual.

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BASE_URL = 'https://api.heygen.com';
const MAX_SHOT_SECONDS = 15;
const MIN_SHOT_SECONDS = 4;

function apiKey(): string {
  const key = process.env.HEYGEN_API_KEY;
  if (!key) throw new Error('HEYGEN_API_KEY is not set in .env');
  return key;
}

async function downloadToTemp(url: string, prefix: string, attempt = 1): Promise<string> {
  const tempPath = path.join(os.tmpdir(), `${prefix}_${Date.now()}.mp4`);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const buf = await res.arrayBuffer();
    await fs.writeFile(tempPath, Buffer.from(buf));
    return tempPath;
  } catch (err) {
    if (attempt < 3) {
      await sleep(attempt * 1500);
      return downloadToTemp(url, prefix, attempt + 1);
    }
    throw err;
  }
}

export interface CinematicShotParams {
  prompt: string;
  avatarId: string; // CHESTONE_PRESENTER_AVATAR_ID — the trained/synthetic look
  durationSeconds?: number; // clamped to HeyGen's 4-15s range
  resolution?: '720p' | '1080p';
}

/**
 * Kicks off a Cinematic Avatar render and polls until it's downloaded
 * locally. Combines create + poll + download into one call, mirroring
 * heygenChunkService.generateVoiceChunk's contract so orchestrator code
 * can treat both the same way (await a local file path back).
 */
export async function generateCinematicShot(params: CinematicShotParams): Promise<string> {
  const duration = Math.min(
    Math.max(params.durationSeconds ?? 10, MIN_SHOT_SECONDS),
    MAX_SHOT_SECONDS,
  );

  const createRes = await fetch(`${BASE_URL}/v3/videos`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'cinematic_avatar',
      prompt: params.prompt,
      avatar_id: [params.avatarId], // array — Cinematic Avatar supports up to 3 avatars per shot
      aspect_ratio: '9:16',
      resolution: params.resolution ?? '1080p',
      duration,
    }),
  });

  if (!createRes.ok) {
    throw new Error(`Cinematic Avatar create failed (${createRes.status}): ${await createRes.text()}`);
  }
  const createData = await createRes.json();
  const videoId = createData?.data?.video_id;
  if (!videoId) throw new Error('Cinematic Avatar: no video_id in response');

  console.log(`[CinematicAvatar] Shot ${videoId} started (${duration}s): "${params.prompt.slice(0, 60)}..."`);

  let attempts = 0;
  while (attempts < 90) {
    attempts++;
    await sleep(5000);

    const statusRes = await fetch(`${BASE_URL}/v3/videos/${videoId}`, {
      headers: { 'x-api-key': apiKey() },
    });
    if (!statusRes.ok) throw new Error(`Cinematic Avatar poll failed: ${statusRes.status}`);
    const statusData = await statusRes.json();
    const status = statusData?.data?.status;

    if (status === 'completed') {
      return downloadToTemp(statusData.data.video_url, `cinematic_${videoId}`);
    }
    if (status === 'failed') {
      throw new Error(`Cinematic Avatar shot ${videoId} failed: ${JSON.stringify(statusData.data?.error || statusData)}`);
    }
  }
  throw new Error(`Cinematic Avatar shot ${videoId} timed out after ~7.5 minutes`);
}

/**
 * Generates a standalone narration audio file via HeyGen's Text-to-Speech
 * endpoint (Starfish engine). Verified against real docs — corrected from
 * an earlier guess that used the wrong path (/v3/voices/tts) and wrong
 * response field name.
 *
 * IMPORTANT: not every voice supports this. Only voices returned by
 * GET /v3/voices?engine=starfish work here — a voice_id from the general
 * voice library may fail. Pick your persona voice IDs from that filtered
 * list, not the unfiltered one, or this will error on voices that look
 * fine everywhere else but aren't Starfish-compatible.
 */
export async function generateNarrationAudio(text: string, voiceId: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/v3/voices/speech`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice_id: voiceId }),
  });

  if (!res.ok) throw new Error(`HeyGen TTS failed (${res.status}): ${await res.text()}`);
  const data = await res.json();

  const audioUrl = data?.data?.audio_url;
  if (!audioUrl) throw new Error(`HeyGen TTS: no audio_url in response: ${JSON.stringify(data)}`);

  return downloadToTemp(audioUrl, 'narration');
}