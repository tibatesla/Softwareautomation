import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

const INTRO_DURATION = 4;
const MID_DURATION = 9;
const OUTRO_DURATION = 5;
const TOTAL_DURATION = INTRO_DURATION + MID_DURATION + OUTRO_DURATION; // 18s
const FPS = 25;

const OUTPUT_W = 1080;
const OUTPUT_H = 1920;
const HEADER_H = 200;
const INFO_BAND_H = 170; 
const FOOTER_H = 250;
const CONTENT_W = OUTPUT_W;
const CONTENT_H = OUTPUT_H - HEADER_H - INFO_BAND_H - FOOTER_H; // 1300

const BACKGROUND_MUSIC_PATH = process.env.BACKGROUND_MUSIC_PATH;
const BACKGROUND_MUSIC_VOLUME = 0.12;

async function downloadToTemp(url: string, prefix: string, attempt = 1): Promise<string> {
  const MAX_ATTEMPTS = 3;
  const tempPath = path.join(os.tmpdir(), `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    await fs.writeFile(tempPath, Buffer.from(buffer));
    return tempPath;
  } catch (err: any) {
    const isTransient = err.cause?.code === 'ETIMEDOUT' || err.cause?.code === 'ECONNRESET' || err.message === 'fetch failed';
    if (isTransient && attempt < MAX_ATTEMPTS) {
      const delayMs = attempt * 1500;
      console.warn(`[FFmpeg] Download attempt ${attempt} failed for ${prefix} (transient), retrying in ${delayMs}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return downloadToTemp(url, prefix, attempt + 1);
    }
    throw err;
  }
}

function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\u2019")
    .replace(/%/g, '\\%');
}

function formatPriceKes(min: number, max: number): string {
  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `${Math.round(n / 1000)}K`;
  return min === max ? `KES ${fmt(min)}` : `KES ${fmt(min)} - ${fmt(max)}`;
}

export interface PropertyOverlayData {
  price: string;
  location: string;
  unitType: string;
}

interface SyncedSceneInput {
  runwayVideoPath: string;  // local path, from runwayService.generateSceneVideo
  heygenChunkPath: string;  // local path, from heygenChunkService.generateVoiceChunk
}

function splitPhotos(photoPaths: string[]): { introPaths: string[]; outroPaths: string[] } {
  if (photoPaths.length === 0) throw new Error('At least one photo is required.');
  if (photoPaths.length === 1) return { introPaths: [photoPaths[0]], outroPaths: [photoPaths[0]] };

  const introCount = Math.ceil(photoPaths.length / 2);
  return {
    introPaths: photoPaths.slice(0, introCount),
    outroPaths: photoPaths.slice(introCount),
  };
}

export class FFmpegService {
  public async buildVerticalBrandedAsset(
    heygenVideoUrl: string,
    photoUrls: string[],
    propertyId: string,
    overlay: PropertyOverlayData,
  ): Promise<string> {
    const safePropertyId = propertyId.replace(/[^a-zA-Z0-9_-]/g, '');
    const tempId = `${safePropertyId}_${Date.now()}`;
    const outputPath = path.join(os.tmpdir(), `final_vertical_${tempId}.mp4`);

    let heygenPath = '';
    let photoPaths: string[] = [];
    let musicPath = '';

    try {
      console.log(`[FFmpeg] Downloading ${photoUrls.length} photo(s) + HeyGen asset for ${propertyId}...`);

      const downloads = await Promise.all([
        downloadToTemp(heygenVideoUrl, 'heygen'),
        ...photoUrls.map((url, i) => downloadToTemp(url, `photo${i}`)),
      ]);
      heygenPath = downloads[0];
      photoPaths = downloads.slice(1);

      if (BACKGROUND_MUSIC_PATH) {
        musicPath = BACKGROUND_MUSIC_PATH.startsWith('http')
          ? await downloadToTemp(BACKGROUND_MUSIC_PATH, 'music')
          : BACKGROUND_MUSIC_PATH;
      }

      const { introPaths, outroPaths } = splitPhotos(photoPaths);
      const introClipDuration = INTRO_DURATION / introPaths.length;
      const outroClipDuration = OUTRO_DURATION / outroPaths.length;

      const font = 'fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
      const priceText = escapeDrawtext(overlay.price);
      const locationText = escapeDrawtext(overlay.location);
      const unitTypeText = escapeDrawtext(overlay.unitType);

      const args: string[] = ['-y', '-loglevel', 'error', '-stats'];
      const inputIndexMap: number[] = [];
      let inputCursor = 0;

      for (const photoPath of photoPaths) {
        const duration = introPaths.includes(photoPath) ? introClipDuration : outroClipDuration;
        args.push('-loop', '1', '-t', String(duration), '-i', photoPath);
        inputIndexMap.push(inputCursor);
        inputCursor += 1;
      }
      const heygenInputIndex = inputCursor;
      args.push('-i', heygenPath);
      inputCursor += 1;

      const whiteBgInputIndex = inputCursor;
      args.push('-f', 'lavfi', '-i', `color=c=white:s=${OUTPUT_W}x${OUTPUT_H}:d=${TOTAL_DURATION}`);
      inputCursor += 1;

      let musicInputIndex: number | null = null;
      if (musicPath) {
        musicInputIndex = inputCursor;
        args.push('-stream_loop', '-1', '-i', musicPath);
        inputCursor += 1;
      }

      const introClipFrames = Math.round(introClipDuration * FPS);
      const outroClipFrames = Math.round(outroClipDuration * FPS);
      const filterParts: string[] = [];

      const introLabels: string[] = [];
      photoPaths.forEach((photoPath, i) => {
        if (!introPaths.includes(photoPath)) return;
        const label = `intro${i}`;
        filterParts.push(
          `[${inputIndexMap[i]}:v]scale=${CONTENT_W}:${CONTENT_H}:force_original_aspect_ratio=increase,` +
          `crop=${CONTENT_W}:${CONTENT_H},setsar=1,` +
          `zoompan=z='min(zoom+0.0015,1.15)':d=${introClipFrames}:s=${CONTENT_W}x${CONTENT_H}:fps=${FPS}[${label}]`
        );
        introLabels.push(label);
      });

      const outroLabels: string[] = [];
      photoPaths.forEach((photoPath, i) => {
        if (!outroPaths.includes(photoPath)) return;
        const label = `outro${i}`;
        filterParts.push(
          `[${inputIndexMap[i]}:v]scale=${CONTENT_W}:${CONTENT_H}:force_original_aspect_ratio=increase,` +
          `crop=${CONTENT_W}:${CONTENT_H},setsar=1,` +
          `zoompan=z='if(eq(on,1),1.15,max(zoom-0.0015,1.0))':d=${outroClipFrames}:s=${CONTENT_W}x${CONTENT_H}:fps=${FPS}[${label}]`
        );
        outroLabels.push(label);
      });

      if (introLabels.length > 1) {
        filterParts.push(`${introLabels.map((l) => `[${l}]`).join('')}concat=n=${introLabels.length}:v=1:a=0[intro]`);
      } else {
        filterParts.push(`[${introLabels[0]}]copy[intro]`);
      }
      if (outroLabels.length > 1) {
        filterParts.push(`${outroLabels.map((l) => `[${l}]`).join('')}concat=n=${outroLabels.length}:v=1:a=0[outro]`);
      } else {
        filterParts.push(`[${outroLabels[0]}]copy[outro]`);
      }

      filterParts.push(
        `[${heygenInputIndex}:v]scale=${CONTENT_W}:${CONTENT_H}:force_original_aspect_ratio=increase,` +
        `crop=${CONTENT_W}:${CONTENT_H},setsar=1,fps=${FPS}[mid]`
      );

      filterParts.push(`[intro][mid][outro]concat=n=3:v=1:a=0[content]`);
      filterParts.push(`[${whiteBgInputIndex}:v][content]overlay=0:${HEADER_H + INFO_BAND_H}[vertical]`);

      filterParts.push(`[vertical]drawbox=x=0:y=0:w=iw:h=${HEADER_H}:color=#002b5b@1:t=fill[b1]`);
      filterParts.push(`[b1]drawtext=${font}:text='Chestone Properties':fontcolor=#C5A059:fontsize=52:x=40:y=75[t1]`);
      filterParts.push(`[t1]drawtext=${font}:text='Call/Text +254 726 111 133':fontcolor=#C5A059:fontsize=42:x=w-tw-40:y=80[t2]`);

      filterParts.push(`[t2]drawtext=${font}:text='${priceText}':fontcolor=#002b5b:fontsize=60:x=30:y=${HEADER_H + 18}[p1]`);
      filterParts.push(`[p1]drawtext=${font}:text='${unitTypeText}':fontcolor=#002b5b:fontsize=34:x=30:y=${HEADER_H + 92}[p2]`);
      filterParts.push(`[p2]drawtext=${font}:text='${locationText}':fontcolor=#7a7a7a:fontsize=28:x=30:y=${HEADER_H + 132}[p3]`);

      // FOOTER FIX: Background is now white so the dark blue text shows up clearly
      filterParts.push(`[p3]drawbox=x=0:y=h-${FOOTER_H}:w=iw:h=${FOOTER_H}:color=white@1:t=fill[b2]`);
      filterParts.push(`[b2]drawtext=${font}:text='Structured Property Solution':fontcolor=#C5A059:fontsize=48:x=(w-tw)/2:y=h-180[t3]`);
      filterParts.push(`[t3]drawtext=${font}:text='High Returns on your investment.':fontcolor=#002b5b:fontsize=36:x=(w-tw)/2:y=h-110[t4]`);
      filterParts.push(`[t4]drawtext=${font}:text='Chestone Properties Ltd':fontcolor=#002b5b@0.4:fontsize=48:x=w-tw-30:y=h-th-260[pre_final]`);

      filterParts.push(`[pre_final]scale=${OUTPUT_W}:${OUTPUT_H}:force_original_aspect_ratio=disable,setsar=1[final_visual]`);

      filterParts.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=0:${INTRO_DURATION}[introAud]`);
      filterParts.push(`[${heygenInputIndex}:a]asetpts=PTS-STARTPTS[midAud]`);
      filterParts.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=0:${OUTRO_DURATION}[outroAud]`);
      filterParts.push(`[introAud][midAud][outroAud]concat=n=3:v=0:a=1[voiceTrack]`);

      let finalAudioLabel = 'voiceTrack';
      if (musicInputIndex !== null) {
        filterParts.push(`[${musicInputIndex}:a]atrim=0:${TOTAL_DURATION},volume=${BACKGROUND_MUSIC_VOLUME}[musicTrack]`);
        filterParts.push(`[voiceTrack][musicTrack]amix=inputs=2:duration=first:dropout_transition=0[final_audio]`);
        finalAudioLabel = 'final_audio';
      } else {
        filterParts.push(`[voiceTrack]acopy[final_audio]`);
        finalAudioLabel = 'final_audio';
      }

      args.push('-filter_complex', filterParts.join(';'));
      args.push('-map', '[final_visual]');
      args.push('-map', `[${finalAudioLabel}]`);
      args.push('-t', String(TOTAL_DURATION));
      args.push('-aspect', `${OUTPUT_W}:${OUTPUT_H}`);
      args.push('-c:v', 'libx264', '-preset', 'fast', '-crf', '23');
      args.push('-c:a', 'aac', '-b:a', '128k');
      args.push(outputPath);

      console.log(
        `[FFmpeg] Executing stitch (${photoPaths.length} photos, ${introPaths.length} intro / ${outroPaths.length} outro, ` +
        `content built directly at ${CONTENT_W}x${CONTENT_H}, ${musicPath ? 'with' : 'no'} music, ${TOTAL_DURATION}s)...`
      );
      await execFileAsync('ffmpeg', args, { timeout: 180_000, maxBuffer: 50 * 1024 * 1024 });

      console.log(`[FFmpeg] Render complete. File ready at: ${outputPath}`);
      return outputPath;
    } catch (error: any) {
      console.error('[FFmpeg Fatal Error] Processing failed:', error.message || String(error));
      throw error;
    } finally {
      const cleanupPaths = [heygenPath, ...photoPaths];
      if (musicPath && BACKGROUND_MUSIC_PATH?.startsWith('http')) cleanupPaths.push(musicPath);
      await Promise.all(cleanupPaths.map((p) => fs.unlink(p).catch(() => {})));
    }
  }

  // PIPELINE PER SCENE (buildDynamicSyncedAsset):
  //   1. ffprobe the HeyGen chunk's audio duration (the truth source)
  //   2. Loop the 5s Runway clip if the audio is longer; trim to exact duration
  //   3. Scale/crop Runway to the 1080x1470 content area, pad onto 1080x1920 canvas
  //   4. Mux: Runway visuals + HeyGen audio, encoded with IDENTICAL codec params
  //   5. concat demuxer (-c copy) glues all chunks losslessly — identical params
  //      across chunks is what makes -c copy safe; change one and it breaks
  //   6. Final pass burns branding (header/footer/price band) over the whole thing

  /** Reads a media file's duration in seconds via ffprobe. */
  private async getDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'csv=p=0',
    filePath,
  ]);
  const dur = parseFloat(stdout.trim());
  if (!dur || isNaN(dur)) throw new Error(`ffprobe returned invalid duration for ${filePath}`);
  return dur;
}

/**
 * Builds one synced chunk: Runway visuals stretched/looped/trimmed to match
 * the HeyGen chunk's exact audio duration, sized to the final vertical canvas.
 */
private async buildSyncedChunk(
  scene: SyncedSceneInput,
  chunkIndex: number,
  tempId: string,
): Promise<string> {
  const audioDuration = await this.getDurationSeconds(scene.heygenChunkPath);
  const chunkPath = path.join(os.tmpdir(), `chunk_${tempId}_${chunkIndex}.mp4`);

  // -stream_loop -1 loops the 5s Runway clip endlessly; -t caps output at the
  // audio's exact duration. If audio < 5s, the loop simply never repeats.
  await execFileAsync('ffmpeg', [
    '-y', '-loglevel', 'error',
    '-stream_loop', '-1', '-i', scene.runwayVideoPath,
    '-i', scene.heygenChunkPath,
    '-filter_complex',
    // Content area 1080x1470 (between 200px header and 250px footer),
    // fill-and-crop for full-bleed, then padded onto the full 1080x1920
    // white canvas at y=370 (header 200 + info band 170) so the final
    // branding pass just draws over the top without repositioning video.
    `[0:v]scale=1080:1350:force_original_aspect_ratio=increase,crop=1080:1350,setsar=1,fps=25,` +
    `pad=1080:1920:0:370:color=white[v]`,
    '-map', '[v]',
    '-map', '1:a',
    '-t', audioDuration.toFixed(3),
    // IDENTICAL codec params across every chunk — mandatory for -c copy concat
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
    chunkPath,
  ], { timeout: 180_000, maxBuffer: 50 * 1024 * 1024 });

  console.log(`[FFmpeg] Chunk ${chunkIndex} synced: ${audioDuration.toFixed(1)}s`);
  return chunkPath;
}

/**
 * Full dynamic assembly: N scenes in, one branded vertical ad out.
 * Total video length = sum of all HeyGen audio durations (no fixed 18s —
 * the script drives the length now).
 */
public async buildDynamicSyncedAsset(
  scenes: SyncedSceneInput[],
  propertyId: string,
  overlay: PropertyOverlayData,
): Promise<string> {
  if (scenes.length === 0) throw new Error('buildDynamicSyncedAsset: no scenes provided');

  const safeId = propertyId.replace(/[^a-zA-Z0-9_-]/g, '');
  const tempId = `${safeId}_${Date.now()}`;
  const chunkPaths: string[] = [];
  const concatListPath = path.join(os.tmpdir(), `concat_${tempId}.txt`);
  const stitchedPath = path.join(os.tmpdir(), `stitched_${tempId}.mp4`);
  const outputPath = path.join(os.tmpdir(), `final_synced_${tempId}.mp4`);

  try {
    // 1. Build every synced chunk (sequential — parallel FFmpeg encodes on a
    //    laptop compete for CPU and all slow down; sequential is net faster)
    for (let i = 0; i < scenes.length; i++) {
      chunkPaths.push(await this.buildSyncedChunk(scenes[i], i, tempId));
    }

    // 2. concat demuxer — lossless glue, no re-encode
    const listContent = chunkPaths.map((p) => `file '${p}'`).join('\n');
    await fs.writeFile(concatListPath, listContent);
    await execFileAsync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'concat', '-safe', '0', '-i', concatListPath,
      '-c', 'copy',
      stitchedPath,
    ], { timeout: 120_000 });

    // 3. Final branding pass over the whole stitched video
    const font = 'fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
    const esc = (t: string) => t.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, '\u2019').replace(/%/g, '\\%');
    const priceText = esc(overlay.price);
    const unitTypeText = esc(overlay.unitType);
    const locationText = esc(overlay.location);

    const brandingFilter = [
      `drawbox=x=0:y=0:w=iw:h=200:color=#002b5b@1:t=fill`,
      `drawtext=${font}:text='Chestone Properties':fontcolor=#C5A059:fontsize=52:x=40:y=75`,
      `drawtext=${font}:text='Call/Text +254 726 111 133':fontcolor=#C5A059:fontsize=42:x=w-tw-40:y=80`,
      `drawtext=${font}:text='${priceText}':fontcolor=#002b5b:fontsize=60:x=30:y=218`,
      `drawtext=${font}:text='${unitTypeText}':fontcolor=#002b5b:fontsize=34:x=30:y=292`,
      `drawtext=${font}:text='${locationText}':fontcolor=#7a7a7a:fontsize=28:x=30:y=332`,
      `drawbox=x=0:y=h-250:w=iw:h=250:color=#002b5b@1:t=fill`,
      `drawtext=${font}:text='Structured Property Solution':fontcolor=#C5A059:fontsize=48:x=(w-tw)/2:y=h-180`,
      `drawtext=${font}:text='High Returns on your investment.':fontcolor=#FFFFFF:fontsize=36:x=(w-tw)/2:y=h-110`,
    ].join(',');

    await execFileAsync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', stitchedPath,
      '-vf', brandingFilter,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
      '-c:a', 'copy',
      outputPath,
    ], { timeout: 180_000, maxBuffer: 50 * 1024 * 1024 });

    console.log(`[FFmpeg] Dynamic synced render complete: ${outputPath}`);
    return outputPath;
  } finally {
    // Clean intermediates; keep only the final output
    await Promise.all([
      ...chunkPaths.map((p) => fs.unlink(p).catch(() => {})),
      fs.unlink(concatListPath).catch(() => {}),
      fs.unlink(stitchedPath).catch(() => {}),
      ...scenes.flatMap((s) => [
        fs.unlink(s.runwayVideoPath).catch(() => {}),
        fs.unlink(s.heygenChunkPath).catch(() => {}),
      ]),
    ]);
    }
  }
}

export const ffmpegService = new FFmpegService();
export { formatPriceKes };