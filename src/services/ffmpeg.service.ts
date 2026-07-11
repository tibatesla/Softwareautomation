// src/services/ffmpeg.service.ts
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

// --- Tunable segment durations (seconds) ---
// MID_DURATION must match whatever HeyGen actually generates (confirmed 9s
// per the project's own HeyGen integration — NOT a longer clip we slice a
// window out of). If you ever change the HeyGen persona/script config and
// the generated clip length changes, update MID_DURATION to match — don't
// trim a window that assumes the source is longer than it is, that was the
// original bug.
const INTRO_DURATION = 4;
const MID_DURATION = 9;    // = HeyGen's native output length, used as-is
const OUTRO_DURATION = 5;  // extended — now carries price/location/CTA
const TOTAL_DURATION = INTRO_DURATION + MID_DURATION + OUTRO_DURATION; // 18s

/**
 * Helper to download remote assets safely to the Ubuntu temp drive
 */
async function downloadToTemp(url: string, prefix: string): Promise<string> {
  const tempPath = path.join(os.tmpdir(), `${prefix}_${Date.now()}.tmp`);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);

  const buffer = await response.arrayBuffer();
  await fs.writeFile(tempPath, Buffer.from(buffer));
  return tempPath;
}

/** Escape text for FFmpeg's drawtext filter — colons and single quotes break
 *  the filter graph syntax if a property name/location ever contains them
 *  (e.g. "3:2 Executive Suite" or a location with an apostrophe). Do this on
 *  every dynamic string that goes into drawtext, not just the obvious ones. */
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\u2019") // swap to a typographic apostrophe rather than escaping
    .replace(/%/g, '\\%');
}

function formatPriceKes(min: number, max: number): string {
  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M` : `${Math.round(n / 1000)}K`;
  return min === max ? `KES ${fmt(min)}` : `KES ${fmt(min)} - ${fmt(max)}`;
}

export interface PropertyOverlayData {
  price: string;        // pre-formatted, e.g. "KES 8.5M - 12M" — see formatPriceKes helper
  location: string;      // e.g. "Kilimani, Nairobi"
  unitType: string;      // e.g. "2 Bedroom Executive"
}

export class FFmpegService {
  /**
   * Stitches photos/video, applies vertical formatting, and adds corporate
   * branding + property details (price/location/unit type).
   * Returns the local file path to the finished asset.
   */
  public async buildVerticalBrandedAsset(
    heygenVideoUrl: string,
    photoUrl1: string,
    photoUrl2: string,
    propertyId: string,
    overlay: PropertyOverlayData,
  ): Promise<string> {
    const safePropertyId = propertyId.replace(/[^a-zA-Z0-9_-]/g, '');
    const tempId = `${safePropertyId}_${Date.now()}`;

    let heygenPath = '';
    let photo1Path = '';
    let photo2Path = '';
    const outputPath = path.join(os.tmpdir(), `final_vertical_${tempId}.mp4`);

    try {
      console.log(`[FFmpeg] Downloading assets to Ubuntu tmpdir for ${propertyId}...`);

      [heygenPath, photo1Path, photo2Path] = await Promise.all([
        downloadToTemp(heygenVideoUrl, 'heygen'),
        downloadToTemp(photoUrl1, 'photo1'),
        downloadToTemp(photoUrl2, 'photo2'),
      ]);

      const font = 'fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
      const introFrames = INTRO_DURATION * 25;
      const outroFrames = OUTRO_DURATION * 25;

      const priceText = escapeDrawtext(overlay.price);
      const locationText = escapeDrawtext(overlay.location);
      const unitTypeText = escapeDrawtext(overlay.unitType);

      // --- The Master Filter Graph ---
      const filterGraph = [
        // 1. Ken Burns Intro -> 1920x1080
        `[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,zoompan=z='min(zoom+0.0015,1.2)':d=${introFrames}:s=1920x1080:fps=25[intro]`,

        // 2. HeyGen Core — used as-is, no trim. HeyGen's output IS the mid
        // segment (9s), not a slice out of something longer. setpts reset
        // only, so it concats cleanly regardless of container timestamp quirks.
        `[1:v]setpts=PTS-STARTPTS,scale=1920:1080,setsar=1,fps=25[mid]`,

        // 3. Ken Burns Outro -> 1920x1080
        `[2:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2,setsar=1,zoompan=z='if(eq(on,1),1.2,max(zoom-0.0015,1.0))':d=${outroFrames}:s=1920x1080:fps=25[outro]`,

        // 4. Stitch them together
        `[intro][mid][outro]concat=n=3:v=1:a=0[stitched]`,

        // 5. Vertical white-background conversion (9:16), COMPLIANT WITH COLOR RATIO SPEC
        `[stitched]scale=1080:1920:force_original_aspect_ratio=decrease[fg]`,
        `[3:v][fg]overlay=(W-w)/2:(H-h)/2[vertical]`,

        // 6. Corporate Branding — top header
        `[vertical]drawbox=x=0:y=0:w=iw:h=200:color=#002b5b@1:t=fill[b1]`,
        `[b1]drawtext=${font}:text='Chestone Properties':fontcolor=#C5A059:fontsize=52:x=40:y=75[t1]`,
        `[t1]drawtext=${font}:text='Call/Text +254 726 111 133':fontcolor=#C5A059:fontsize=42:x=w-tw-40:y=80[t2]`,

        // 7. Property details, placed in the white gap directly below the
        // header — this is the space you flagged in the screenshot. Price
        // is the psychological anchor so it goes largest/first (top),
        // location and unit type stacked below it, all left-aligned so it
        // reads like a listing card rather than a caption.
        `[t2]drawtext=${font}:text='${priceText}':fontcolor=#002b5b:fontsize=64:x=40:y=230[p1]`,
        `[p1]drawtext=${font}:text='${unitTypeText}':fontcolor=#002b5b:fontsize=40:x=40:y=310[p2]`,
        `[p2]drawtext=${font}:text='${locationText}':fontcolor=#7a7a7a:fontsize=36:x=40:y=360[p3]`,

        // 8. Corporate Branding — bottom footer / CTA
        `[p3]drawbox=x=0:y=h-250:w=iw:h=250:color=#002b5b@1:t=fill[b2]`,
        `[b2]drawtext=${font}:text='Structured Property Solution':fontcolor=#C5A059:fontsize=48:x=(w-tw)/2:y=h-180[t3]`,
        `[t3]drawtext=${font}:text='High Returns on your investment.':fontcolor=#002b5b:fontsize=36:x=(w-tw)/2:y=h-110[t4]`,
        `[t4]drawtext=${font}:text='Chestone Properties Ltd':fontcolor=#002b5b@0.2:fontsize=48:x=w-tw-30:y=h-th-260[final_visual]`,
      ].join(';');

      // Audio: built explicitly to match TOTAL_DURATION instead of relying
      // on the raw HeyGen audio track + `-shortest`. This is the actual fix
      // for the 9s truncation — silence pads the intro/outro, HeyGen's own
      // (untrimmed) audio fills the mid segment, and the three are
      // concatenated so audio duration always equals video duration.
      const audioFilter = [
        `anullsrc=channel_layout=stereo:sample_rate=44100,atrim=0:${INTRO_DURATION}[introAud]`,
        `[1:a]asetpts=PTS-STARTPTS[midAud]`,
        `anullsrc=channel_layout=stereo:sample_rate=44100,atrim=0:${OUTRO_DURATION}[outroAud]`,
        `[introAud][midAud][outroAud]concat=n=3:v=0:a=1[final_audio]`,
      ].join(';');

      const args = [
        '-y',
        '-loglevel', 'error', '-stats',
        '-loop', '1', '-t', String(INTRO_DURATION), '-i', photo1Path,   // [0:v] Image 1
        '-i', heygenPath,                                               // [1:v]/[1:a] HeyGen
        '-loop', '1', '-t', String(OUTRO_DURATION), '-i', photo2Path,   // [2:v] Image 2
        '-f', 'lavfi', '-i', `color=c=white:s=1080x1920:d=${TOTAL_DURATION}`, // [3:v] white bg
        // Note: no extra -i needed for the silence pads — anullsrc is
        // generated as an inline filter source inside filter_complex below,
        // not a real input stream.
        '-filter_complex', `${filterGraph};${audioFilter}`,
        '-map', '[final_visual]',
        '-map', '[final_audio]',
        '-t', String(TOTAL_DURATION), // hard cap regardless of internal drift — same fix pattern as the earlier runaway-duration bug
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '23',
        '-c:a', 'aac', '-b:a', '128k',
        outputPath,
      ];

      console.log(`[FFmpeg] Executing dynamic stitch, vertical white-pad, and branding (${TOTAL_DURATION}s)...`);
      await execFileAsync('ffmpeg', args, {
        timeout: 180_000,
        maxBuffer: 50 * 1024 * 1024,
      });

      console.log(`[FFmpeg] Render complete. File ready at: ${outputPath}`);
      return outputPath;
    } catch (error: any) {
      console.error('[FFmpeg Fatal Error] Processing failed:', error.message || String(error));
      throw error;
    } finally {
      await Promise.all([
        fs.unlink(heygenPath).catch(() => {}),
        fs.unlink(photo1Path).catch(() => {}),
        fs.unlink(photo2Path).catch(() => {}),
      ]);
    }
  }
}

export const ffmpegService = new FFmpegService();
export { formatPriceKes };