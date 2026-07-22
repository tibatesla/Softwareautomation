// src/scripts/manual-photo-assembly.ts
//
// Manually assembles the saved 15s cinematic entrance + real property
// photos, each with its own narration, into one video. Only cost here is
// cheap Starfish TTS (fractions of a cent) — no HeyGen video, no Runway.
//
// FIX HISTORY:
// 1. Entrance now uses the saved Aria narration (entrance_narration.mp3)
//    instead of the raw HeyGen clip's own baked-in audio track — previously
//    the entrance used HeyGen's own default voice while every room used
//    Aria, which is why it sounded like two different presenters.
// 2. Entrance video is now TRIMMED to match the narration's actual length
//    (13.37s) instead of playing the full 15.09s clip — the extra ~1.7s
//    was silent dead air after the narration finished, which is what
//    caused the audible gap before the kitchen scene. A large crossfade
//    was tried as a fix first but caused voices to overlap audibly on the
//    short room clips — trimming the source is the correct fix, not
//    masking the gap after the fact.
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

const execFileAsync = promisify(execFile);

const ENTRANCE_VIDEO = '/home/tesla/chestone-pipeline/saved-cinematic/entrance_shot.mp4';
const ENTRANCE_AUDIO = '/home/tesla/chestone-pipeline/saved-cinematic/entrance_narration.mp3';
const OUTPUT_DIR = '/home/tesla/chestone-pipeline/sample-output';
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'lucky_inn_manual_assembly.mp4');

const LISTING = {
  price: 'Price on Request',
  bedInfo: '3 Bedroom Platinium',
  location: 'Westlands, Nairobi',
 // tagline: 'Structured Property Solution',
  company: 'Chestone Properties Ltd',
};

const ROOMS: { url: string; script: string }[] = [
  { url: 'https://assets.cdn.filesafe.space/gZq4AjxCqZKGYlYZXFjB/media/6a5387b8c8fd689c35026cfe.jpeg', script: 'A modern kitchen with glossy cabinetry and quality finishes.' },
  { url: 'https://assets.cdn.filesafe.space/gZq4AjxCqZKGYlYZXFjB/media/6a5387fa9c9b37b5fdbcee23.jpeg', script: 'Spacious bedrooms with large floor-to-ceiling windows.' },
  { url: 'https://assets.cdn.filesafe.space/gZq4AjxCqZKGYlYZXFjB/media/6a536afe708c41d4df1e437e.jpeg', script: 'Premium bathroom finishes with glass shower enclosures.' },
  { url: 'https://assets.cdn.filesafe.space/gZq4AjxCqZKGYlYZXFjB/media/6a58c1eb9c9b37b5fd159a9d.jpeg', script: 'Resort-grade amenities including this swimming pool.' },
];

const OUTPUT_W = 1080;
const OUTPUT_H = 1920;
const FPS = 25;
const MIN_HOLD_SECONDS = 3;
const CROSSFADE_SECONDS = 0.15;

const FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const FONT_REGULAR = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf';

const NAVY = '0x0B2545';
const GOLD = '0xC9A227';

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%');
}

async function downloadToTemp(url: string, prefix: string, ext: string): Promise<string> {
  const tempPath = path.join(os.tmpdir(), `${prefix}_${Date.now()}.${ext}`);
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

  try {
    await fs.access(ENTRANCE_AUDIO);
  } catch {
    throw new Error(
      `Entrance narration file not found at ${ENTRANCE_AUDIO}. ` +
      `This should have been saved alongside entrance_shot.mp4 during the ` +
      `original build-avatar-samples.ts run — check that directory.`
    );
  }

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const persona = await selectOptimalPersona('Investment');

  console.log(`[Manual] Downloading ${ROOMS.length} photos + generating narration...`);
  const roomAssets = await Promise.all(
    ROOMS.map(async (room, i) => {
      const [photoPath, audioPath] = await Promise.all([
        downloadToTemp(room.url, `photo${i}`, 'jpg'),
        generateNarrationAudio(room.script, persona.voice_id),
      ]);
      const audioDuration = await getDurationSeconds(audioPath);
      const holdSeconds = Math.max(audioDuration, MIN_HOLD_SECONDS);
      return { photoPath, audioPath, holdSeconds };
    })
  );

  const entranceVideoDuration = await getDurationSeconds(ENTRANCE_VIDEO);
  const entranceAudioDuration = await getDurationSeconds(ENTRANCE_AUDIO);
  const entranceUseDuration = Math.min(entranceVideoDuration, entranceAudioDuration);
  if (entranceAudioDuration > entranceVideoDuration) {
    console.warn(
      `[Manual] WARNING: entrance narration (${entranceAudioDuration.toFixed(1)}s) is LONGER than ` +
      `the entrance video (${entranceVideoDuration.toFixed(1)}s). Narration will be cut off at ` +
      `${entranceUseDuration.toFixed(1)}s. Consider regenerating the cinematic shot at a longer duration.`
    );
  } else {
    console.log(
      `[Manual] Trimming entrance to ${entranceUseDuration.toFixed(2)}s (narration length) — ` +
      `removes ${(entranceVideoDuration - entranceAudioDuration).toFixed(2)}s of silent dead air ` +
      `that was at the end of the raw video.`
    );
  }

  const inputs: string[] = ['-i', ENTRANCE_VIDEO, '-i', ENTRANCE_AUDIO];
  roomAssets.forEach((r) => {
    inputs.push('-loop', '1', '-i', r.photoPath);
  });
  roomAssets.forEach((r) => {
    inputs.push('-i', r.audioPath);
  });

  const filterParts: string[] = [];
  filterParts.push(
    `[0:v]trim=duration=${entranceUseDuration.toFixed(3)},setpts=PTS-STARTPTS,` +
    `scale=${OUTPUT_W}:${OUTPUT_H}:force_original_aspect_ratio=increase,crop=${OUTPUT_W}:${OUTPUT_H},setsar=1,fps=${FPS}[v0]`
  );
  const PHOTO_INPUT_OFFSET = 2;
  roomAssets.forEach((r, i) => {
    const frames = Math.round(r.holdSeconds * FPS);
    filterParts.push(
      `[${PHOTO_INPUT_OFFSET + i}:v]scale=${OUTPUT_W}:${OUTPUT_H}:force_original_aspect_ratio=increase,crop=${OUTPUT_W}:${OUTPUT_H},setsar=1,` +
      `zoompan=z='min(zoom+0.0012,1.1)':d=${frames}:s=${OUTPUT_W}x${OUTPUT_H}:fps=${FPS},` +
      `trim=duration=${r.holdSeconds.toFixed(3)},setpts=PTS-STARTPTS[v${i + 1}]`
    );
  });
  const videoLabels = ['[v0]', ...roomAssets.map((_, i) => `[v${i + 1}]`)].join('');
  filterParts.push(`${videoLabels}concat=n=${roomAssets.length + 1}:v=1:a=0[concatv]`);

  const headerBarH = 230;
  const priceBandH = 140;
  const footerBarY = OUTPUT_H - 190;
  const footerBarH = 190;

  filterParts.push(
    `[concatv]` +
    `drawbox=x=0:y=0:w=${OUTPUT_W}:h=${headerBarH}:color=${NAVY}@1:t=fill,` +
    `drawbox=x=0:y=${headerBarH}:w=${OUTPUT_W}:h=${priceBandH}:color=white@1:t=fill,` +
    `drawtext=fontfile=${FONT_BOLD}:text='${escapeDrawtext(LISTING.price)}':fontsize=54:fontcolor=${NAVY}:x=40:y=${headerBarH + 20},` +
    `drawtext=fontfile=${FONT_BOLD}:text='${escapeDrawtext(LISTING.bedInfo)}':fontsize=34:fontcolor=${NAVY}:x=40:y=${headerBarH + 85},` +
    `drawtext=fontfile=${FONT_REGULAR}:text='${escapeDrawtext(LISTING.location)}':fontsize=26:fontcolor=gray:x=40:y=${headerBarH + 120},` +
    `drawbox=x=0:y=${footerBarY}:w=${OUTPUT_W}:h=${footerBarH}:color=white@1:t=fill,` +
    //`drawtext=fontfile=${FONT_BOLD}:text='${escapeDrawtext(LISTING.tagline)}':fontsize=40:fontcolor=${GOLD}:x=(w-text_w)/2:y=${footerBarY + 30},` +
    `drawtext=fontfile=${FONT_REGULAR}:text='${escapeDrawtext(LISTING.company)}':fontsize=22:fontcolor=${NAVY}:x=(w-text_w)/2:y=${footerBarY + 90}` +
    `[outv]`
  );

  filterParts.push(
    `[1:a]atrim=0:${entranceUseDuration.toFixed(3)},asetpts=PTS-STARTPTS[aEntrance]`
  );
  const audioInputOffset = PHOTO_INPUT_OFFSET + roomAssets.length;
  roomAssets.forEach((r, i) => {
    filterParts.push(`[${audioInputOffset + i}:a]apad=pad_dur=${(r.holdSeconds).toFixed(3)},atrim=0:${r.holdSeconds.toFixed(3)}[aRoom${i}]`);
  });

  let prevLabel = 'aEntrance';
  roomAssets.forEach((r, i) => {
    const outLabel = i === roomAssets.length - 1 ? 'outa' : `xf${i}`;
    filterParts.push(
      `[${prevLabel}][aRoom${i}]acrossfade=d=${CROSSFADE_SECONDS}:c1=tri:c2=tri[${outLabel}]`
    );
    prevLabel = outLabel;
  });

  const outputTemp = path.join(os.tmpdir(), `manual_output_${Date.now()}.mp4`);
  const args = [
    '-y', '-loglevel', 'error',
    ...inputs,
    '-filter_complex', filterParts.join(';'),
    '-map', '[outv]',
    '-map', '[outa]',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'aac', '-b:a', '128k',
    outputTemp,
  ];

  console.log('[Manual] Assembling with FFmpeg (video + narration + overlay)...');
  await execFileAsync('ffmpeg', args, { timeout: 180_000, maxBuffer: 50 * 1024 * 1024 });

  await fs.copyFile(outputTemp, OUTPUT_FILE);
  console.log(`[Manual] Done: ${OUTPUT_FILE}`);

  await Promise.all([
    ...roomAssets.map((r) => fs.unlink(r.photoPath).catch(() => {})),
    ...roomAssets.map((r) => fs.unlink(r.audioPath).catch(() => {})),
    fs.unlink(outputTemp).catch(() => {}),
  ]);
}

main().catch((err) => {
  console.error('[Manual] Failed:', err.message || err);
  if (err.stderr) console.error('[Manual] FFmpeg stderr:', err.stderr);
  console.error('[Manual] Temp files NOT deleted — check /tmp/photo*.jpg and /tmp/narration_*.mp4 manually.');
  process.exit(1);
});