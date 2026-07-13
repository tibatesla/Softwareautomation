// src/services/runway.service.ts
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// CRITICAL: the developer API host is api.dev.runwayml.com — NOT
// api.runwayml.com. The non-.dev host is Runway's product site, not the
// API, and requests there fail. This is Runway's most common integration
// mistake (docs: https://docs.dev.runwayml.com).
const RUNWAY_API_BASE = 'https://api.dev.runwayml.com/v1';

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

    const startRes = await fetch(`${RUNWAY_API_BASE}/image_to_video`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        model: 'gen3a_turbo',
        promptImage: imageUrl,
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