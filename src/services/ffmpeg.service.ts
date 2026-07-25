import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import {
  chainBrandingLabels,
  brandingToVfString,
  PropertyOverlayData,
} from './videoBranding.service';

const execFileAsync = promisify(execFile);

const INTRO_DURATION = 4;
const MID_DURATION = 9;
const OUTRO_DURATION = 5;
const TOTAL_DURATION = INTRO_DURATION + MID_DURATION + OUTRO_DURATION; // 18s
const FPS = 25;

const OUTPUT_W = 1080;
const OUTPUT_H = 1920;
const HEADER_H = 200;
// Reserved space for price/unit/location text. Was 170 — grown to 230 to
// match videoBranding.service.ts's larger PRICE_TOP_MARGIN (80px, up from
// 40px, since 40px still visually read as the price touching the navy
// header at real phone viewing scale). If the branding module's margins
// change again, this must grow/shrink to match or content will overlap
// the text (too small) or leave a dead gap (too big).
//const INFO_BAND_H = 230;
//const FOOTER_H = 250;
//const FOOTER_H = 150;
//const CONTENT_W = OUTPUT_W;
//const CONTENT_H = OUTPUT_H - HEADER_H - INFO_BAND_H - FOOTER_H; // 1240
//const CONTENT_Y_OFFSET = HEADER_H + INFO_BAND_H; // 430 — single source for both pipelines below
const CONTENT_W = OUTPUT_W;
const CONTENT_H = OUTPUT_H; // video now fills the full frame; branding overlays on top, doesn't reserve space

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

function formatPriceKes(min: number, max: number): string {
  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `${Math.round(n / 1000)}K`;
  return min === max ? `KES ${fmt(min)}` : `KES ${fmt(min)} - ${fmt(max)}`;
}

export interface SyncedSceneInput {
  runwayVideoPath: string;
  heygenChunkPath: string;
}

// Cinematic Avatar (HeyGen Seedance) scenes don't come with a script-synced
// voice track the way Avatar V/IV chunks do — HeyGen generates the whole
// shot (avatar + environment + camera movement) from a prompt, with no
// narration tied to it. Narration for these scenes is generated separately
// (TTS) and muxed on here instead. The compositing is also fundamentally
// different from a talking chunk: there's no green-screen avatar to overlay
// onto separate B-roll — the cinematic clip already IS the full scene.
export interface CinematicSceneInput {
  cinematicVideoPath: string;   // output of generateCinematicShot in cinematic-avatar.service.ts
  narrationAudioPath: string;   // separately generated TTS, ideally requested at
                                 // the same duration as the cinematic clip so no
                                 // stretching/padding is needed
}

// Discriminated union so buildDynamicSyncedAsset can accept a mixed list of
// scenes — e.g. one cinematic "walking in" opener followed by proven
// talking-avatar chunks for the rest of the script.
export type DynamicScene =
  | ({ kind: 'talking' } & SyncedSceneInput)
  | ({ kind: 'cinematic' } & CinematicSceneInput);

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
      filterParts.push(`[${whiteBgInputIndex}:v][content]overlay=0:0[vertical]`);

      filterParts.push(chainBrandingLabels(overlay, TOTAL_DURATION, 'vertical', 'branded'));
      filterParts.push(`[branded]scale=${OUTPUT_W}:${OUTPUT_H}:force_original_aspect_ratio=disable,setsar=1[final_visual]`);

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

  private async buildSyncedChunk(
    scene: SyncedSceneInput,
    chunkIndex: number,
    tempId: string,
  ): Promise<string> {
    const audioDuration = await this.getDurationSeconds(scene.heygenChunkPath);
    const chunkPath = path.join(os.tmpdir(), `chunk_${tempId}_${chunkIndex}.mp4`);

    await execFileAsync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-stream_loop', '-1', '-i', scene.runwayVideoPath,
      '-i', scene.heygenChunkPath,
      '-filter_complex',
      // Content area is CONTENT_W x CONTENT_H (matches the single source
      // above), padded onto the full canvas at CONTENT_Y_OFFSET — was
      // hardcoded "370" separately from the other pipeline's math before,
      // which is exactly how these two functions drifted out of sync
      // originally. Both now reference the same shared constants.
      `[0:v]scale=1080:${CONTENT_H}:force_original_aspect_ratio=increase,crop=1080:${CONTENT_H},setsar=1,fps=25[bg];` +
      `[1:v]chromakey=0x00FF00:0.25:0.08,despill=type=green,scale=480:-2[avatar];` +
      `[bg][avatar]overlay=(W-w)/2:H-h-20[v]`,
      '-map', '[v]',
      '-map', '1:a',
      '-t', audioDuration.toFixed(3),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
      chunkPath,
    ], { timeout: 180_000, maxBuffer: 50 * 1024 * 1024 });

    console.log(`[FFmpeg] Chunk ${chunkIndex} synced: ${audioDuration.toFixed(1)}s`);
    return chunkPath;
  }

  /**
   * Composites a Cinematic Avatar (Seedance) clip with separately-generated
   * narration audio, matching buildSyncedChunk's output contract (same
   * canvas dimensions, same content area, same white-pad-to-full-frame
   * behavior) so both chunk types concatenate seamlessly downstream.
   *
   * Deliberately does NOT loop the cinematic video to fill a duration
   * mismatch the way buildSyncedChunk loops B-roll (-stream_loop -1).
   * B-roll looping is safe because ambient motion has no obvious seam.
   * Looping a clip of a person walking/gesturing is not safe — a mid-stride
   * jump back to frame 1 is visibly broken. Duration mismatches should be
   * minimized upstream (request the cinematic clip at the narration's
   * duration, up to Cinematic Avatar's ~15s cap). Small mismatches here
   * (a second or less) are absorbed with a frozen last-frame pad, not a
   * loop. If the mismatch is large, this throws — that's a signal to fix
   * the generation request, not something to silently paper over with a
   * seam that will read as unclean in the final render.
   */
  private async buildCinematicChunk(
    scene: CinematicSceneInput,
    chunkIndex: number,
    tempId: string,
  ): Promise<string> {
    const [videoDuration, audioDuration] = await Promise.all([
      this.getDurationSeconds(scene.cinematicVideoPath),
      this.getDurationSeconds(scene.narrationAudioPath),
    ]);
    const chunkPath = path.join(os.tmpdir(), `cinechunk_${tempId}_${chunkIndex}.mp4`);

    const mismatch = audioDuration - videoDuration;
    const MAX_SILENT_PAD_SECONDS = 1.5; // beyond this, the mismatch should be fixed at generation time, not patched here

    if (mismatch > MAX_SILENT_PAD_SECONDS) {
      throw new Error(
        `[FFmpeg] Cinematic chunk ${chunkIndex}: narration (${audioDuration.toFixed(1)}s) exceeds ` +
        `cinematic video (${videoDuration.toFixed(1)}s) by ${mismatch.toFixed(1)}s — too large to freeze-frame pad ` +
        `cleanly. Re-request the cinematic clip at the correct duration (or split the narration across ` +
        `multiple ≤15s cinematic shots) instead of stretching this one.`
      );
    }

    // If narration is longer than the video by a small amount, hold the
    // last frame to cover the gap. tpad with stop_mode=clone repeats the
    // final frame rather than looping from the start, so there's no seam.
    const needsFreezePad = mismatch > 0;
    const targetDuration = Math.max(videoDuration, audioDuration);

    const videoFilter = needsFreezePad
      ? `[0:v]scale=1080:${CONTENT_H}:force_original_aspect_ratio=increase,crop=1080:${CONTENT_H},setsar=1,fps=25,` +
        `tpad=stop_mode=clone:stop_duration=${mismatch.toFixed(3)}[v]`
      : `[0:v]scale=1080:${CONTENT_H}:force_original_aspect_ratio=increase,crop=1080:${CONTENT_H},setsar=1,fps=25[v]`;

    await execFileAsync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', scene.cinematicVideoPath,
      '-i', scene.narrationAudioPath,
      '-filter_complex',
      // No avatar overlay step here — the cinematic clip already contains
      // the avatar composited into its environment by HeyGen/Seedance.
      // Same CONTENT_H / CONTENT_Y_OFFSET math as buildSyncedChunk so this
      // pads onto the shared canvas identically.
      videoFilter,
      '-map', '[v]',
      '-map', '1:a',
      '-t', targetDuration.toFixed(3),
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '23', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-ac', '2',
      chunkPath,
    ], { timeout: 180_000, maxBuffer: 50 * 1024 * 1024 });

    console.log(
      `[FFmpeg] Cinematic chunk ${chunkIndex} composited: video ${videoDuration.toFixed(1)}s, ` +
      `narration ${audioDuration.toFixed(1)}s${needsFreezePad ? ` (padded +${mismatch.toFixed(1)}s)` : ''}`
    );
    return chunkPath;
  }

  public async buildDynamicSyncedAsset(
    scenes: DynamicScene[],
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
      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const chunkPath =
          scene.kind === 'cinematic'
            ? await this.buildCinematicChunk(scene, i, tempId)
            : await this.buildSyncedChunk(scene, i, tempId);
        chunkPaths.push(chunkPath);
      }

      const listContent = chunkPaths.map((p) => `file '${p}'`).join('\n');
      await fs.writeFile(concatListPath, listContent);
      await execFileAsync('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-f', 'concat', '-safe', '0', '-i', concatListPath,
        '-c', 'copy',
        stitchedPath,
      ], { timeout: 120_000 });

      const videoDuration = await this.getDurationSeconds(stitchedPath);
      const brandingFilter = brandingToVfString(overlay, videoDuration);

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
      const sourcePaths = scenes.flatMap((s) =>
        s.kind === 'cinematic'
          ? [s.cinematicVideoPath, s.narrationAudioPath]
          : [s.runwayVideoPath, s.heygenChunkPath]
      );
      await Promise.all([
        ...chunkPaths.map((p) => fs.unlink(p).catch(() => {})),
        fs.unlink(concatListPath).catch(() => {}),
        fs.unlink(stitchedPath).catch(() => {}),
        ...sourcePaths.map((p) => fs.unlink(p).catch(() => {})),
      ]);
    }
  }
}

export const ffmpegService = new FFmpegService();
export { formatPriceKes };