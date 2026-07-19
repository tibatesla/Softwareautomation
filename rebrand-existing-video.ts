// rebrand-existing-video.ts — patches an already-rendered video's branding
// (fixes the price-clipping + missing-watermark bugs) WITHOUT touching
// HeyGen or Runway. Pure local FFmpeg, zero API cost.
//
// WHY THIS IS NEEDED: the old price/unit/location text is permanently baked
// into the video's pixels — you can't "remove" it, only paint over it. This
// script draws an opaque WHITE box over the entire info-band region first
// (blotting out the old, wrongly-positioned text), THEN uses your real
// videoBranding.service.ts to draw the correct header/price/footer/
// watermark on top — same module, same layout, that any new render uses.
//
// Usage: npx ts-node rebrand-existing-video.ts

import { execFile } from 'child_process';
import { promisify } from 'util';
import { chainBrandingLabels, PropertyOverlayData } from './src/services/videoBranding.service';

const execFileAsync = promisify(execFile);

// ── EDIT THESE THREE THINGS ────────────────────────────────────────────
const INPUT_VIDEO = '/home/tesla/chestone-pipeline/output/Kileleshwa_Lifestyle_REBRANDED.mp4';
const OUTPUT_VIDEO = '/home/tesla/chestone-pipeline/output/Kileleshwa_Lifestylee_REBRANDED.mp4';
const OVERLAY: PropertyOverlayData = {
  price: 'KES 19M - 125M',       // put the REAL correct price here
  unitType: '2 Bedroom — Kileleshwa',
  location: 'Kileleshwa, Nairobi',
};
// ─────────────────────────────────────────────────────────────────────

const HEADER_H = 200;
const INFO_BAND_H = 230; // matches the updated layout — must fully cover the taller price/unit/location zone

async function main() {
  console.log('Patching branding on existing video (no AI regeneration, no cost)...');

  // 1. White box covering the ENTIRE info-band region (y=200 to y=370) —
  //    this blots out the old, wrongly-positioned price text that was
  //    bleeding into the header. Nothing lives below the header at this
  //    stage except that old broken text, so a full white repaint is safe.
  const coverBox = `drawbox=x=0:y=${HEADER_H}:w=iw:h=${INFO_BAND_H}:color=white@1:t=fill`;

  // 2. Real branding module draws the correct header/price/footer/
  //    watermark on top — the SAME code path any future fresh render uses,
  //    so this patched video matches what new videos will look like.
  const brandingChain = chainBrandingLabels(OVERLAY, 'covered', 'final', {
    headerH: HEADER_H,
    footerH: 250,
  });

  const filterComplex = [
    `[0:v]${coverBox}[covered]`,
    brandingChain,
  ].join(';');

  await execFileAsync('ffmpeg', [
    '-y', '-loglevel', 'error', '-stats',
    '-i', INPUT_VIDEO,
    '-filter_complex', filterComplex,
    '-map', '[final]',
    '-map', '0:a',
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-c:a', 'copy',
    OUTPUT_VIDEO,
  ], { timeout: 180_000, maxBuffer: 50 * 1024 * 1024 });

  console.log(`Done. Fixed video: ${OUTPUT_VIDEO}`);
  console.log(`Watch it: xdg-open ${OUTPUT_VIDEO}`);
}

main().catch((err) => {
  console.error('Failed:', err.message);
  process.exit(1);
});