// src/services/photo-vision.service.ts
//
// Classifies each property photo (room type + notable features) using
// Google Gemini Flash — free tier covers 1,500 requests/day with no credit
// card, which at ~4 photos × 3 variants... actually vision analysis runs
// ONCE per photo per property (results reused across variants — see
// orchestrator note), so a property costs ~4 requests. Free tier covers
// hundreds of properties per day.
//
// Get a key at: https://aistudio.google.com → "Get API key" (no card needed)
// .env:  GEMINI_API_KEY=...
//
// NOTE: Gemini's API does not accept remote image URLs — images must be
// fetched and sent base64-inline. Handled internally here.

export interface PhotoAnalysis {
  roomType: string;
  features: string[];
  isExterior: boolean;
}

const GEMINI_MODEL = 'gemini-3.1-flash-lite'; // free tier, fast, plenty for room classification
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const PROMPT =
  'Classify this real-estate photo. Respond ONLY with compact JSON, no markdown fences: ' +
  '{"roomType": "<one of: kitchen, bedroom, bathroom, living room, dining room, ' +
  'swimming pool, gym, balcony, exterior, garden, parking, hallway, other>", ' +
  '"features": ["up to 3 short notable visible features"], "isExterior": true or false}';

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image ${url}: ${res.status}`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { data: buffer.toString('base64'), mimeType: contentType.split(';')[0] };
}

export async function analyzePhoto(imageUrl: string): Promise<PhotoAnalysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set in .env — get one free at aistudio.google.com');

  const image = await fetchImageAsBase64(imageUrl);

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: PROMPT },
            { inline_data: { mime_type: image.mimeType, data: image.data } },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 150, temperature: 0.1 },
    }),
  });

  if (!res.ok) throw new Error(`Gemini vision error (${res.status}): ${await res.text()}`);
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

  try {
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      roomType: String(parsed.roomType || 'other').toLowerCase(),
      features: Array.isArray(parsed.features) ? parsed.features.slice(0, 3) : [],
      isExterior: Boolean(parsed.isExterior),
    };
  } catch {
    console.warn(`[Vision] Could not parse Gemini analysis for ${imageUrl}, defaulting to generic.`);
    return { roomType: 'other', features: [], isExterior: false };
  }
}

export async function analyzeAllPhotos(imageUrls: string[]): Promise<PhotoAnalysis[]> {
  return Promise.all(imageUrls.map((url) => analyzePhoto(url)));
}