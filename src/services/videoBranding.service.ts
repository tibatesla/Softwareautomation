// src/services/videoBranding.service.ts
//


export interface PropertyOverlayData {
  price: string;
  location: string;
  unitType: string;
}

export interface BrandingLayout {
  headerH: number;
  footerH: number;
}

export const DEFAULT_BRANDING_LAYOUT: BrandingLayout = {
  headerH: 200,
  footerH: 250,
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


export function buildBrandingOps(
  overlay: PropertyOverlayData,
  layout: BrandingLayout = DEFAULT_BRANDING_LAYOUT,
): string[] {
  const { headerH, footerH } = layout;
  const priceText = escapeDrawtext(overlay.price);
  const unitTypeText = escapeDrawtext(overlay.unitType);
  const locationText = escapeDrawtext(overlay.location);

  // 80px clear margin under the header. 40px still LOOKED like the price
  // was touching the navy header when actually viewed on a phone — a small
  // absolute gap reads as "connected" at real viewing scale even when
  // mathematically separated. 80px gives an unambiguous visible white gap.
  const PRICE_TOP_MARGIN = 80;
  const priceY = headerH + PRICE_TOP_MARGIN; // 280
  const unitTypeY = priceY + 70;             // 350
  const locationY = unitTypeY + 40;          // 390

  return [
    // --- Header ---
    `drawbox=x=0:y=0:w=iw:h=${headerH}:color=${NAVY}@1:t=fill`,
    `drawtext=${FONT}:text='Chestone Properties':fontcolor=${GOLD}:fontsize=52:x=40:y=75`,
    `drawtext=${FONT}:text='Call/Text +254 726 111 133':fontcolor=${GOLD}:fontsize=42:x=w-tw-40:y=80`,

    // --- Price / info band ---
    `drawtext=${FONT}:text='${priceText}':fontcolor=${NAVY}:fontsize=56:x=30:y=${priceY}`,
    `drawtext=${FONT}:text='${unitTypeText}':fontcolor=${NAVY}:fontsize=34:x=30:y=${unitTypeY}`,
    `drawtext=${FONT}:text='${locationText}':fontcolor=${GREY}:fontsize=28:x=30:y=${locationY}`,

    // --- Footer ---
    `drawbox=x=0:y=h-${footerH}:w=iw:h=${footerH}:color=${NAVY}@1:t=fill`,
   // `drawtext=${FONT}:text='Structured Property Solution':fontcolor=${GOLD}:fontsize=48:x=(w-tw)/2:y=h-190`,
    `drawtext=${FONT}:text='High Returns on your investment.':fontcolor=white:fontsize=36:x=(w-tw)/2:y=h-125`,
    // Watermark: was white@0.55 on a navy background — invisible (white on
    // navy with only 55% opacity barely shows). Gold matches the header's
    // brand color and stays clearly readable, still subtle via opacity.
    `drawtext=${FONT}:text='Chestone Properties Ltd':fontcolor=${GOLD}@0.7:fontsize=26:x=(w-tw)/2:y=h-70`,
  ];
}

/** Flat -vf string — use when branding is the only filter needed (single -vf pass). */
export function brandingToVfString(
  overlay: PropertyOverlayData,
  layout?: BrandingLayout,
): string {
  return buildBrandingOps(overlay, layout).join(',');
}

/**
 * Chains the branding ops as labeled nodes inside a larger -filter_complex
 * graph. e.g. chainBrandingLabels(overlay, 'vertical', 'final_visual')
 * produces:
 *   [vertical]op1[b_0];[b_0]op2[b_1];...;[b_N-1]opLast[final_visual]
 */
export function chainBrandingLabels(
  overlay: PropertyOverlayData,
  inputLabel: string,
  outputLabel: string,
  layout?: BrandingLayout,
): string {
  const ops = buildBrandingOps(overlay, layout);
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