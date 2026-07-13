// src/services/scene-planner.service.ts
//
// VISION-AWARE VERSION: each photo is classified by the vision model first
// (photo-vision.service.ts), then its script line is written about what the
// photo ACTUALLY shows. Upload order no longer matters — kitchen-first,
// bedroom-first, any order works. This is the real "voice matches visuals"
// mechanism, and it is genuinely ML-driven (vision model classification),
// which is exactly what the client asked for.

import { analyzeAllPhotos, PhotoAnalysis } from './photo-vision.service';

export type VariantType = 'Investment' | 'Lifestyle' | 'Architectural';

export interface ScenePlan {
  photoUrl: string;
  runwayPrompt: string;
  script: string;
}

interface PropertyData {
  property_name?: string;
  specific_location?: string;
  unit_type?: string;
  price_min?: number;
  price_max?: number;
  price?: number;
  amenities?: string[];
}

function fmtPrice(min?: number | null, max?: number | null): string {
  const m = min || 0;
  const x = max || m;
  if (!m) return 'a price available on request';
  const f = (n: number) => `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} million shillings`;
  return m === x ? f(m) : `from ${f(m)} to ${f(x)}`;
}

/** Room-specific script lines, per variant tone. The {features} slot gets the
 *  vision model's detected details when available. */
const ROOM_LINES: Record<string, Record<VariantType, string>> = {
  kitchen: {
    Investment: 'A modern kitchen like this{features} is exactly what quality tenants look for.',
    Lifestyle: 'Your kitchen{features} — where every day starts and the best evenings end.',
    Architectural: 'The kitchen{features} — clean lines, functional flow, beautifully resolved.',
  },
  bedroom: {
    Investment: 'Spacious bedrooms{features} keep units rented and tenants staying longer.',
    Lifestyle: 'Your bedroom{features} — your calm, your retreat, your own space.',
    Architectural: 'Bedrooms{features} designed around light, proportion, and quiet.',
  },
  bathroom: {
    Investment: 'Premium bathroom finishes{features} that hold value and impress viewings.',
    Lifestyle: 'A bathroom{features} that feels like your own private spa.',
    Architectural: 'The bathroom{features} — precise detailing, quality materials throughout.',
  },
  'living room': {
    Investment: 'Open living spaces{features} — the feature every serious buyer asks about first.',
    Lifestyle: 'The living room{features} — made for slow Sundays and full-house gatherings.',
    Architectural: 'A living space{features} composed around light and openness.',
  },
  'swimming pool': {
    Investment: 'Resort-grade amenities like this pool lift both rental yield and resale value.',
    Lifestyle: 'Morning laps or weekend lounging — the pool is steps from your door.',
    Architectural: 'The pool area — a considered centerpiece of the development.',
  },
  gym: {
    Investment: 'An on-site gym — the amenity modern tenants now expect as standard.',
    Lifestyle: 'Your workout, downstairs. No commute, no excuses.',
    Architectural: 'A fully equipped gym, integrated into the design of the development.',
  },
  balcony: {
    Investment: 'Private balconies add real premium to both rent and resale.',
    Lifestyle: 'Your balcony — morning coffee with a view, evenings in the open air.',
    Architectural: 'Balconies that extend the living space outward, seamlessly.',
  },
  exterior: {
    Investment: 'First impressions matter — and this facade makes a strong one.',
    Lifestyle: 'Welcome home — this is what arriving feels like, every single day.',
    Architectural: 'The facade — bold, contemporary, and unmistakably intentional.',
  },
  garden: {
    Investment: 'Landscaped grounds — low maintenance, high perceived value.',
    Lifestyle: 'Green space right outside — room to breathe, play, and unwind.',
    Architectural: 'Landscaping designed as part of the whole, not an afterthought.',
  },
  other: {
    Investment: 'Every corner of this property is finished to a standard buyers notice.',
    Lifestyle: 'Every detail here is designed around how you actually live.',
    Architectural: 'Considered design, carried through every space.',
  },
};

const MOTION_BY_ROOM: Record<string, string> = {
  exterior: 'Slow cinematic aerial-style push toward the building facade, gentle parallax, photorealistic, no people, no text',
  'swimming pool': 'Smooth slow glide across the water surface, gentle ripples, cinematic, photorealistic, no people, no text',
  default: 'Slow smooth cinematic camera push forward through the space, gentle parallax, photorealistic, steady motion, no people, no text',
};

export async function buildScenePlan(
  property: PropertyData,
  photoUrls: string[],
  variant: VariantType,
): Promise<ScenePlan[]> {
  const name = property.property_name || 'this property';
  const location = property.specific_location || 'Nairobi';
  const price = fmtPrice(property.price_min ?? property.price, property.price_max ?? property.price);

  const photos = photoUrls.slice(0, 4);

  console.log(`[ScenePlanner] Analyzing ${photos.length} photos with vision model...`);
  const analyses: PhotoAnalysis[] = await analyzeAllPhotos(photos);

  const openers: Record<VariantType, string> = {
    Investment: `Welcome to ${name} in ${location} — a serious investment opportunity.`,
    Lifestyle: `Welcome to ${name}, right here in ${location}.`,
    Architectural: `${name}, ${location} — where design leads.`,
  };
  const closers: Record<VariantType, string> = {
    Investment: `Priced ${price}. Secure your unit today — message us now.`,
    Lifestyle: `All this ${price}. Your new home is waiting — talk to us today.`,
    Architectural: `Own considered design, ${price}. Enquire today.`,
  };

  return photos.map((photoUrl, i) => {
    const analysis = analyses[i];
    const roomLines = ROOM_LINES[analysis.roomType] || ROOM_LINES.other;
    const featureText = analysis.features.length ? ` with ${analysis.features.slice(0, 2).join(' and ')}` : '';
    let script = roomLines[variant].replace('{features}', featureText);

    // First scene gets the opener prepended; last scene gets the CTA appended
    if (i === 0) script = `${openers[variant]} ${script}`;
    if (i === photos.length - 1) script = `${script} ${closers[variant]}`;

    const runwayPrompt = MOTION_BY_ROOM[analysis.roomType] || MOTION_BY_ROOM.default;

    console.log(`[ScenePlanner] Scene ${i + 1}: detected "${analysis.roomType}" → matched script generated.`);

    return { photoUrl, runwayPrompt, script };
  });
}