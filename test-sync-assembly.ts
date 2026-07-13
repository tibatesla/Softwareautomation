// test-sync-assembly.ts — Zero-cost test of buildDynamicSyncedAsset.
//
// Usage: npx ts-node test-sync-assembly.ts
//
// WHAT THIS PROVES: v2's riskiest code — ffprobe duration-reading, Runway-clip
// looping/trimming to match voice length, identical-codec chunk encoding, and
// concat-demuxer assembly — all without spending a single new credit:
//   • Voice chunks: your two ALREADY-PAID HeyGen videos, fetched by ID
//     (video_status.get is read-only, costs nothing)
//   • "Runway" clip: a 5s slice cut from one of your old rendered videos
//     (visuals are stand-in; the sync mechanics are what's under test)
//
// SUCCESS = a playable mp4 where scene 1's visuals last exactly as long as
// voice 1, then scene 2's visuals last exactly as long as voice 2, with
// branding burned on top. Watch it and listen for clean audio joins.

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ffmpegService } from './src/services/ffmpeg.service';

const execFileAsync = promisify(execFile);

// Your two already-paid HeyGen job IDs (from the July 12 Riverside renders)
const HEYGEN_VIDEO_IDS = [
  'f2e7bdefb1e348bc9556f748a2487e91', // Architectural voice
  'f5a87e2ee8934d31ad99f43d67ec28e6', // Investment voice
];

// Any existing local mp4 to slice a fake "Runway clip" from.
// Update the filename to whatever actually exists in your output folder:
//   ls -t /home/tesla/chestone-pipeline/output/
const SOURCE_VIDEO_FOR_FAKE_RUNWAY =
  '/home/tesla/chestone-pipeline/output/RIVERSIDE-2BR_Investment_1783865674159.mp4';

async function fetchHeygenVideo(videoId: string): Promise<string> {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) throw new Error('HEYGEN_API_KEY not set');

  console.log(`[Test] Fetching already-paid HeyGen video ${videoId} (read-only, no cost)...`);
  const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    headers: { 'X-Api-Key': apiKey },
  });
  const data = await res.json();

  if (data.data?.status !== 'completed') {
    throw new Error(`HeyGen ${videoId} status: ${data.data?.status} — expected completed. ` +
      `(If HeyGen expired the download URL, pick a more recent job ID from your dashboard.)`);
  }

  const videoUrl = data.data.video_url;
  const localPath = path.join(os.tmpdir(), `test_heygen_${videoId}.mp4`);
  const dl = await fetch(videoUrl);
  if (!dl.ok) throw new Error(`Download failed: ${dl.status}`);
  await fs.writeFile(localPath, Buffer.from(await dl.arrayBuffer()));
  console.log(`[Test] Saved voice chunk: ${localPath}`);
  return localPath;
}

async function makeFakeRunwayClip(): Promise<string> {
  // Slice a silent 5-second 768x1280-ish clip from an existing render —
  // mimics a Runway gen3a_turbo output closely enough for sync testing.
  const outPath = path.join(os.tmpdir(), `fake_runway_${Date.now()}.mp4`);
  console.log(`[Test] Cutting 5s stand-in "Runway" clip from ${path.basename(SOURCE_VIDEO_FOR_FAKE_RUNWAY)}...`);
  await execFileAsync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-ss', '5', '-t', '5',
    '-i', SOURCE_VIDEO_FOR_FAKE_RUNWAY,
    '-vf', 'scale=768:1280:force_original_aspect_ratio=increase,crop=768:1280,setsar=1',
    '-an', // Runway clips are silent — audio comes from HeyGen, same as production
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p',
    outPath,
  ], { timeout: 60_000 });
  console.log(`[Test] Stand-in clip ready: ${outPath}`);
  return outPath;
}

async function main() {
  console.log('=== v2 SYNC-ASSEMBLY TEST (zero cost) ===\n');

  // 1. Fetch both paid HeyGen voice chunks
  const [voice1, voice2] = await Promise.all(HEYGEN_VIDEO_IDS.map(fetchHeygenVideo));

  // 2. Two fake Runway clips (cut twice so cleanup can't collide)
  const runway1 = await makeFakeRunwayClip();
  const runway2 = await makeFakeRunwayClip();

  // 3. Run the REAL production assembly method — the actual code under test
  console.log('\n[Test] Running buildDynamicSyncedAsset (the real v2 code)...\n');
  const outputPath = await ffmpegService.buildDynamicSyncedAsset(
    [
      { runwayVideoPath: runway1, heygenChunkPath: voice1 },
      { runwayVideoPath: runway2, heygenChunkPath: voice2 },
    ],
    'SYNC-TEST',
    {
      price: 'KES 14.5M - 15.5M',
      location: 'Riverside Drive, Nairobi',
      unitType: '2 Bedroom — Riverside Grand',
    },
  );

  // 4. Copy final output somewhere it survives (assembly cleans its temps)
  const keepPath = `/home/tesla/chestone-pipeline/output/SYNC-TEST-${Date.now()}.mp4`;
  await fs.copyFile(outputPath, keepPath);
  await fs.unlink(outputPath).catch(() => {});

  console.log('\n=== SUCCESS ===');
  console.log(`Watch it:  xdg-open ${keepPath}`);
  console.log('\nCheck for: (1) scene 1 visuals last exactly as long as voice 1,');
  console.log('(2) clean cut to scene 2 exactly when voice 2 starts, (3) branding');
  console.log('overlays intact, (4) no frozen frames or audio pops at the join.');
}

main().catch((err) => {
  console.error('\n=== FAILED ===');
  console.error(err.message);
  process.exit(1);
});