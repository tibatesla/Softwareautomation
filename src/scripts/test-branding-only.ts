// src/scripts/test-branding-only.ts
import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const OUTRO_SECONDS = 3;

async function getDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', filePath,
  ]);
  return parseFloat(stdout.trim());
}

async function main() {
  //const inputPath = '/home/tesla/chestone-pipeline/saved-cinematic/entrance_shot.mp4';
  const inputPath = '/tmp/blank_test.mp4';
  const extendedPath = '/tmp/extended_branding_test.mp4';
  const outputPath = '/home/tesla/chestone-pipeline/sample-output/branding_test.mp4';

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const originalDuration = await getDurationSeconds(inputPath);
  const totalDuration = originalDuration + OUTRO_SECONDS;
  console.log(`[Test] Original: ${originalDuration}s, extended total: ${totalDuration}s`);

  // Step 1: extend the video by freezing the last frame for OUTRO_SECONDS —
  // this is what makes the outro play AFTER real content, not overlapping it.
  await execFileAsync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', inputPath,
    '-vf', `tpad=stop_mode=clone:stop_duration=${OUTRO_SECONDS}`,
    '-af', `apad=pad_dur=${OUTRO_SECONDS}`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac',
    extendedPath,
  ], { timeout: 180_000, maxBuffer: 50 * 1024 * 1024 });

  // Step 2: apply branding on the now-extended video, outro window placed
  // exactly at [originalDuration, totalDuration] — the appended tail.
  const { brandingToVfString } = await import('../services/videoBranding.service');
  const brandingFilter = brandingToVfString(
    { price: 'KES 22.5M - 23.9M', location: 'Westlands, Nairobi', unitType: '3 Bedroom Platinium' },
    totalDuration,
  );

  await execFileAsync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-i', extendedPath,
    '-vf', brandingFilter,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'copy',
    outputPath,
  ], { timeout: 180_000, maxBuffer: 50 * 1024 * 1024 });

  await fs.unlink(extendedPath).catch(() => {});
  console.log(`[Test] Done: ${outputPath}`);
}

main().catch((err) => { console.error('[Test] Failed:', err); process.exit(1); });