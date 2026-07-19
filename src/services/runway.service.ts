// src/services/runway.service.ts
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const execFileAsync = promisify(execFile);

// CRITICAL: the developer API host is api.dev.runwayml.com — NOT
// api.runwayml.com. The non-.dev host is Runway's product site, not the
// API, and requests there fail. This is Runway's most common integration
// mistake (docs: https://docs.dev.runwayml.com).
const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1';

// Runway hard-rejects source images outside this aspect ratio range
// ("width / height ratio must be at most 2"). Real admin-uploaded phone
// photos WILL hit this occasionally (panoramas, unusual crops) — this
// preprocessing runs on every image, not just as a one-off fix.
const HARD_MAX_ASPECT_RATIO = 2.0;
const HARD_MIN_ASPECT_RATIO = 1 / HARD_MAX_ASPECT_RATIO;
// Crop TARGET stays under the hard limit — ffmpeg's crop filter rounds to
// whole pixels, which can push the result back OVER 2.0 if we target
// exactly 2.0 (seen in testing: cropping toward 2.0 landed at 2.003 and
// Runway rejected it again). Targeting 1.9 leaves rounding headroom.
const CROP_TARGET_RATIO = 1.9;

async function imageAsDataUri(filePath: string, cleanup = false): Promise<string> {
  const buffer = await fs.readFile(filePath);
  if (cleanup) await fs.unlink(filePath).catch(() => {});
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

/** Downloads a photo and, if its aspect ratio falls outside Runway's
 *  accepted range, center-crops it into bounds before use. */
async function prepareImageForRunway(imageUrl: string): Promise<string> {
  const tempIn = path.join(os.tmpdir(), `runway_src_${Date.now()}.jpg`);
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to download image for Runway: ${res.status}`);
  await fs.writeFile(tempIn, Buffer.from(await res.arrayBuffer()));

  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height',
    '-of', 'csv=s=x:p=0',
    tempIn,
  ]);
  const [w, h] = stdout.trim().split('x').map(Number);
  const ratio = w / h;

  if (ratio <= HARD_MAX_ASPECT_RATIO && ratio >= HARD_MIN_ASPECT_RATIO) {
    return imageAsDataUri(tempIn, true);
  }

  console.warn(`[Runway] Image aspect ratio ${ratio.toFixed(3)} out of bounds, center-cropping toward ${CROP_TARGET_RATIO}...`);
  const tempOut = path.join(os.tmpdir(), `runway_cropped_${Date.now()}.jpg`);
  const cropFilter = ratio > HARD_MAX_ASPECT_RATIO
    ? `crop=floor(ih*${CROP_TARGET_RATIO}/2)*2:floor(ih/2)*2`
    : `crop=floor(iw/2)*2:floor(iw*${CROP_TARGET_RATIO}/2)*2`;

  await execFileAsync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tempIn, '-vf', cropFilter, tempOut]);
  await fs.unlink(tempIn).catch(() => {});
  return imageAsDataUri(tempOut, true);
}

export class RunwayService {
  private apiKey = process.env.RUNWAYML_API_SECRET;
  private headers = {
    'Authorization': `Bearer ${this.apiKey}`,
    'X-Runway-Version': '2024-11-06',
    'Content-Type': 'application/json'
  };

  public async generateSceneVideo(imageUrl: string, promptText: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('RUNWAYML_API_SECRET is not set in .env');
    }

    console.log(`[Runway] Starting generation for prompt: ${promptText.substring(0, 30)}...`);

    const preparedImage = await prepareImageForRunway(imageUrl);

    const startRes = await fetch(`${RUNWAY_API_BASE}/image_to_video`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: 'gen3a_turbo',
        promptImage: preparedImage,
        promptText: promptText, // must be under 512 chars per Runway docs
        duration: 5,
        ratio: '768:1280', // vertical — correct format for gen3a_turbo
        watermark: false
      })
    });

    if (!startRes.ok) {
      const errBody = await startRes.text();
      throw new Error(`Runway Start Error (${startRes.status}): ${errBody}`);
    }
    const { id: taskId } = await startRes.json();
    console.log(`[Runway] Task created: ${taskId}. Polling...`);

    let attempts = 0;
    while (attempts < 60) {
      attempts++;
      await sleep(5000);

      const pollRes = await fetch(`${RUNWAY_API_BASE}/tasks/${taskId}`, {
        headers: this.headers
      });

      if (!pollRes.ok) throw new Error(`Runway Poll Error (${pollRes.status}): ${await pollRes.text()}`);
      const taskData = await pollRes.json();

      if (taskData.status === 'SUCCEEDED') {
        const videoUrl = taskData.output[0];
        console.log(`[Runway] Success! Downloading...`);
        return this.downloadToTemp(videoUrl, `runway_${taskId}`);
      }

      if (taskData.status === 'FAILED') {
        throw new Error(`Runway task failed: ${taskData.failureCode || JSON.stringify(taskData)}`);
      }
    }
    throw new Error('Runway generation timed out after 5 minutes.');
  }

  private async downloadToTemp(url: string, prefix: string, attempt = 1): Promise<string> {
    const MAX_ATTEMPTS = 3;
    const tempPath = path.join(os.tmpdir(), `${prefix}_${Date.now()}.mp4`);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const buffer = await res.arrayBuffer();
      await fs.writeFile(tempPath, Buffer.from(buffer));
      console.log(`[Runway] Downloaded to ${tempPath}`);
      return tempPath;
    } catch (err: any) {
      if (attempt < MAX_ATTEMPTS) {
        console.warn(`[Runway] Download attempt ${attempt} failed, retrying...`);
        await sleep(attempt * 1500);
        return this.downloadToTemp(url, prefix, attempt + 1);
      }
      throw err;
    }
  }
}

export const runwayService = new RunwayService();