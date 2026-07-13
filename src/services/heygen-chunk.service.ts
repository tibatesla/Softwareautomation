// src/services/heygen-chunk.service.ts
//
// Generates ONE short HeyGen avatar clip per scene script and waits for it
// synchronously (poll-based, not webhook-based) — chunked assembly needs all
// pieces in-hand before FFmpeg can sync them, so the webhook flow doesn't fit
// here. The main heygen.service.ts webhook path stays untouched for anything
// still using it.
//
// The avatar clip's AUDIO is what we sync to; its video track is unused in
// the current design (Runway scene fills the screen). Keeping the avatar
// picture-in-picture later is a small FFmpeg overlay addition, not a rework.

import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const HEYGEN_GENERATE_URL = 'https://api.heygen.com/v2/video/generate';
const HEYGEN_STATUS_URL = 'https://api.heygen.com/v1/video_status.get';

export interface VoiceChunkParams {
  script: string;
  avatarId: string;
  voiceId: string;
}

export class HeygenChunkService {
  private apiKey = process.env.HEYGEN_API_KEY;

  public async generateVoiceChunk(params: VoiceChunkParams): Promise<string> {
    if (!this.apiKey) throw new Error('HEYGEN_API_KEY is not set in .env');

    const genRes = await fetch(HEYGEN_GENERATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': this.apiKey },
      body: JSON.stringify({
        video_inputs: [
          {
            character: { type: 'avatar', avatar_id: params.avatarId, avatar_style: 'normal' },
            voice: { type: 'text', input_text: params.script, voice_id: params.voiceId },
            background: { type: 'color', value: '#FFFFFF' },
          },
        ],
        dimension: { width: 1280, height: 720 }, // audio is what matters; smaller = faster render
      }),
    });

    if (!genRes.ok) throw new Error(`HeyGen chunk start failed (${genRes.status}): ${await genRes.text()}`);
    const genData = await genRes.json();
    const videoId = genData.data?.video_id || genData.data?.id;
    if (!videoId) throw new Error('HeyGen chunk: no video_id in response');

    console.log(`[HeyGen Chunk] Task ${videoId} started for script: "${params.script.slice(0, 40)}..."`);

    // Poll until complete — short scripts typically render in 1-3 minutes.
    let attempts = 0;
    while (attempts < 90) {
      attempts++;
      await sleep(5000);

      const statusRes = await fetch(`${HEYGEN_STATUS_URL}?video_id=${videoId}`, {
        headers: { 'X-Api-Key': this.apiKey },
      });
      if (!statusRes.ok) throw new Error(`HeyGen chunk poll failed: ${statusRes.status}`);
      const statusData = await statusRes.json();
      const status = statusData.data?.status;

      if (status === 'completed') {
        return this.downloadToTemp(statusData.data.video_url, `heygen_chunk_${videoId}`);
      }
      if (status === 'failed') {
        throw new Error(`HeyGen chunk ${videoId} failed: ${JSON.stringify(statusData.data?.error || statusData)}`);
      }
    }
    throw new Error(`HeyGen chunk ${videoId} timed out after ~7.5 minutes`);
  }

  private async downloadToTemp(url: string, prefix: string, attempt = 1): Promise<string> {
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
        return this.downloadToTemp(url, prefix, attempt + 1);
      }
      throw err;
    }
  }
}

export const heygenChunkService = new HeygenChunkService();