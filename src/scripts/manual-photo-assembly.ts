// src/scripts/manual-photo-assembly.ts
//
// Near-zero-cost full property test — no Runway, no Cinematic Avatar.
// Uses real property photos + HeyGen TTS narration (fractions of a cent)
// + FFmpeg zoompan for local, free simulated camera movement. Tests the
// full script generation + new intro/outro branding together on real
// content, without touching either paid video-generation API.
//
// Run with: npx ts-node src/scripts/manual-photo-assembly.ts

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { generateNarrationAudio } from '../services/cinematic-avatar.service';
import { selectOptimalPersona } from '../services/personas.service';
import { brandingToVfString } from '../services/videoBranding.service';

const execFileAsync = promisify(execFile);

const OUTPUT_DIR = '/home/tesla/chestone-pipeline/sample-output';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'photo_assembly_test.mp4');

const OUTPUT_W = 1080;
const OUTPUT_H = 1920;
const FPS = 25;
const MIN_HOLD_SECONDS = 3;
const OUTRO_SECONDS = 3;

// Fill in real property photo URLs + matching scripts. Reuse ROOM_LINES
// tone from scene-planner.service.ts for consistency, or write custom.
const ROOMS: { url: string; script: string }[] = [
  { url: 'https://assets.cdn.filesafe.space/gZq4AjxCqZKGYlYZXFjB/media/6a56b60b1097b81195e00069.jpeg', script: 'A modern kitchen with glossy cabinetry and quality finishes.' },
  { url: 'https://assets.cdn.filesafe.space/gZq4AjxCqZKGYlYZXFjB/media/6a5387fa9c9b37b5fdbcee23.jpeg', script: 'Spacious bedrooms with large floor-to-ceiling windows.' },
  { url: 'https://assets.cdn.filesafe.space/gZq4AjxCqZKGYlYZXFjB/media/6a536afe708c41d4df1e437e.jpeg', script: 'Premium bathroom finishes with glass shower enclosures.' },
  { url: 'https://assets.cdn.filesafe.space/gZq4AjxCqZKGYlYZXFjB/media/6a58c1eb9c9b37b5fd159a9d.jpeg', script: 'Resort-grade amenities including this swimming pool.' },
];

const OVERLAY = {
  price: 'KES 22.5M - 23.9M',
  location: 'Westlands, Nairobi',
  unitType: '3 Bedroom Platinium',
};

async function downloadToTemp(url: string, prefix: string): Promise<string> {
  const tempPath = path.join(os.tmpdir(), `${prefix}_${Date.now()}.jpg`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.statusText}`);
  const buf = await res.arrayBuffer();
  await fs.writeFile(tempPath, Buffer.from(buf));
  return tempPath;
}

async function getDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath,
  ]);
  return parseFloat(stdout.trim());
}

async function main() {
  if (ROOMS.length === 0) {
    throw new Error('Fill in ROOMS (url + script per photo) before running this script.');
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const persona = await selectOptimalPersona('Investment');

  console.log(`[Test] Downloading ${ROOMS.length} photos + generating narration (TTS only, near-free)...`);
  const roomAssets = await Promise.all(
    ROOMS.map(async (room, i) => {
      const [photoPath, audioPath] = await Promise.all([
        downloadToTemp(room.url, `photo${i}`),
        generateNarrationAudio(room.script, persona.voice_id),
      ]);
      const audioDuration = await getDurationSeconds(audioPath);
      const holdSeconds = Math.max(audioDuration, MIN_HOLD_SECONDS);
      return { photoPath, audioPath, holdSeconds };
    })
  );

  // Build raw (unbranded) video: photos with local FFmpeg zoompan, no
  // Runway, no Cinematic Avatar — just real photos + narration.
  const rawPath = path.join(os.tmpdir(), `raw_assembly_${Date.now()}.mp4`);
  const inputs: string[] = [];
  roomAssets.forEach((r) => {
    inputs.push('-loop', '1', '-t', String(r.holdSeconds), '-i', r.photoPath);
  });
  roomAssets.forEach((r) => {
    inputs.push('-i', r.audioPath);
  });

  const filterParts: string[] = [];
  roomAssets.forEach((r, i) => {
    const frames = Math.round(r.holdSeconds * FPS);
    filterParts.push(
      `[${i}:v]scale=${OUTPUT_W}:${OUTPUT_H}:force_original_aspect_ratio=increase,crop=${OUTPUT_W}:${OUTPUT_H},setsar=1,` +
      `zoompan=z='min(zoom+0.0012,1.1)':d=${frames}:s=${OUTPUT_W}x${OUTPUT_H}:fps=${FPS}[v${i}]`
    );
  });
  const videoLabels = roomAssets.map((_, i) => `[v${i}]`).join('');
  filterParts.push(`${videoLabels}concat=n=${roomAssets.length}:v=1:a=0[outv]`);

  const audioOffset = roomAssets.length;
  roomAssets.forEach((r, i) => {
    filterParts.push(`[${audioOffset + i}:a]apad=pad_dur=${r.holdSeconds.toFixed(3)},atrim=0:${r.holdSeconds.toFixed(3)}[a${i}]`);
  });
  const audioLabels = roomAssets.map((_, i) => `[a${i}]`).join('');
  filterParts.push(`${audioLabels}concat=n=${roomAssets.length}:v=0:a=1[outa]`);

  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...inputs,
    '-filter_complex', filterParts.join(';'),
    '-map', '[outv]', '-map', '[outa]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k',
    rawPath,
  ], { timeout: 180_000, maxBuffer: 1024 * 1024 * 1024 });

  console.log('[Test] Raw assembly done. Applying new intro/outro branding...');

  // Extend with frozen last frame for outro, THEN brand — same two-step
  // pattern as test-branding-only.ts, applied to genuinely fresh footage
  // this time (not a pre-branded old video).
  const originalDuration = await getDurationSeconds(rawPath);
  const totalDuration = originalDuration + OUTRO_SECONDS;
  const extendedPath = path.join(os.tmpdir(), `extended_${Date.now()}.mp4`);

  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', rawPath,
    '-vf', `tpad=stop_mode=clone:stop_duration=${OUTRO_SECONDS}`,
    '-af', `apad=pad_dur=${OUTRO_SECONDS}`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac',
    extendedPath,
  ], { timeout: 180_000, maxBuffer: 1024 * 1024 * 1024 });

  const brandingFilter = brandingToVfString(OVERLAY, totalDuration);

  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', extendedPath,
    '-vf', brandingFilter,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'copy',
    OUTPUT_FILE,
  ], { timeout: 180_000, maxBuffer: 1024 * 1024 * 1024 });

  await Promise.all([
    ...roomAssets.map((r) => fs.unlink(r.photoPath).catch(() => {})),
    ...roomAssets.map((r) => fs.unlink(r.audioPath).catch(() => {})),
    fs.unlink(rawPath).catch(() => {}),
    fs.unlink(extendedPath).catch(() => {}),
  ]);

  console.log(`[Test] Done: ${OUTPUT_FILE}`);
}

main().catch((err) => { console.error('[Test] Failed:', err); process.exit(1); });