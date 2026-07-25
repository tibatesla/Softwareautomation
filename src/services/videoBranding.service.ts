// src/services/videoBranding.service.ts
export interface PropertyOverlayData {
  price: string;
  location: string;
  unitType: string;
}

export interface BrandingTiming {
  introSeconds: number;
  outroSeconds: number;
}

export const DEFAULT_BRANDING_TIMING: BrandingTiming = {
  introSeconds: 4,
  outroSeconds: 3,
};

const FONT = 'fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
const NAVY = '#002b5b';
const GOLD = '#C5A059';
const GREY = '#7a7a7a';

export function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, '\u2019')
    .replace(/%/g, '\\%');
}

/**
 * NO top navy band anymore — client wants it removed entirely, not resized.
 * Intro text now sits directly over the video with individual semi-
 * transparent boxes behind each line (same style already used for price),
 * stacked top to bottom, no overlapping. Outro window is now placed AFTER
 * the real video content, not overlapping the last few seconds — see
 * ffmpeg.service.ts, which now extends total duration by outroSeconds
 * before this function is called, so outroStart = originalDuration exactly.
 */
export function buildBrandingOps(
  overlay: PropertyOverlayData,
  totalDurationWithOutro: number, // original video length + outroSeconds
  timing: BrandingTiming = DEFAULT_BRANDING_TIMING,
): string[] {
  const { introSeconds, outroSeconds } = timing;
  const priceText = escapeDrawtext(overlay.price);
  const unitTypeText = escapeDrawtext(overlay.unitType);
  const locationText = escapeDrawtext(overlay.location);

  const outroStart = totalDurationWithOutro - outroSeconds;

  return [
    // --- INTRO: stacked text lines, own background box each, no full band ---
    `drawtext=${FONT}:text='${priceText}':fontcolor=${NAVY}:fontsize=52:x=30:y=60:box=1:boxcolor=white@0.9:boxborderw=12:enable='between(t,0,${introSeconds})'`,
    `drawtext=${FONT}:text='${unitTypeText}':fontcolor=${NAVY}:fontsize=32:x=30:y=130:box=1:boxcolor=white@0.9:boxborderw=10:enable='between(t,0,${introSeconds})'`,
    `drawtext=${FONT}:text='${locationText}':fontcolor=${GREY}:fontsize=26:x=30:y=170:box=1:boxcolor=white@0.9:boxborderw=10:enable='between(t,0,${introSeconds})'`,

    // --- OUTRO: full-screen navy card, only during the appended tail ---
    `drawbox=x=0:y=0:w=iw:h=ih:color=${NAVY}@1:t=fill:enable='between(t,${outroStart},${totalDurationWithOutro})'`,
    `drawtext=${FONT}:text='Chestone Properties':fontcolor=${GOLD}:fontsize=64:x=(w-tw)/2:y=(h-100)/2:enable='between(t,${outroStart},${totalDurationWithOutro})'`,
    `drawtext=${FONT}:text='Call/Text +254 726 111 133':fontcolor=white:fontsize=36:x=(w-tw)/2:y=(h-100)/2+80:enable='between(t,${outroStart},${totalDurationWithOutro})'`,
  ];
}

export function brandingToVfString(
  overlay: PropertyOverlayData,
  totalDurationWithOutro: number,
  timing?: BrandingTiming,
): string {
  return buildBrandingOps(overlay, totalDurationWithOutro, timing).join(',');
}

export function chainBrandingLabels(
  overlay: PropertyOverlayData,
  totalDurationWithOutro: number,
  inputLabel: string,
  outputLabel: string,
  timing?: BrandingTiming,
): string {
  const ops = buildBrandingOps(overlay, totalDurationWithOutro, timing);
  const parts: string[] = [];
  let prevLabel = inputLabel;

  ops.forEach((op, i) => {
    const isLast = i === ops.length - 1;
    const nextLabel = isLast ? outputLabel : `b_${i}`;
    parts.push(`[${prevLabel}]${op}[${nextLabel}]`);
    prevLabel = nextLabel;
  });

  return parts.join(';');
}