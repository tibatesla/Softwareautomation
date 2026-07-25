// src/services/scene-planner.service.ts
//
// VISION-AWARE VERSION: each photo is classified by the vision model first
// (photo-vision.service.ts), then its script line is written about what the
// photo ACTUALLY shows. Upload order no longer matters — kitchen-first,
// bedroom-first, any order works. This is the real "voice matches visuals"
// mechanism, and it is genuinely ML-driven (vision model classification),
// which is exactly what the client asked for.
//
// CINEMATIC ADDITION: the opening scene (i === 0) is marked isCinematic:
// true and gets a director-style cinematicPrompt instead of the usual
// runwayPrompt. Kept to ONE scene per variant deliberately, since
// Cinematic Avatar bills a flat $7 per shot regardless of length, unlike
// the per-minute talking-avatar cost. Making every scene cinematic would
// multiply cost by scene count, not duration — see
// video-orchestrator.service.ts's cost comment.
//
// CLOSER REWRITE (2026-07-22): closer now pulls real CRM fields —
// total_units, completion_time, payment_plan_structure, amenities — not
// just price. Client flagged the script as generic; this fixes that by
// actually using the data already sitting in the CRM instead of ignoring
// most of it. Amenities come from GHL's "Amenities" checkbox field —
// NOTE: older property records may still have this field as a plain
// string (legacy text field, now deleted from the schema but old data
// persists on old records) rather than an array, so buildAmenitiesPhrase
// guards against that instead of assuming array shape everywhere.

import { analyzeAllPhotos, PhotoAnalysis } from './photo-vision.service';

export type VariantType = 'Investment' | 'Lifestyle' | 'Architectural';

export interface ScenePlan {
  photoUrl: string;
  runwayPrompt: string;
  script: string;
  isCinematic: boolean;
  cinematicPrompt?: string; // only set when isCinematic is true
}

interface PropertyData {
  property_name?: string;
  specific_location?: string;
  unit_type?: string;
  price_min?: number;
  price_max?: number;
  price?: number;
  // New records keep this as the raw checkbox array from GHL.
  amenities?: string[];
  total_units?: number;
  completion_time?: string;
  payment_plan_structure?: string;
  show_house_ready?: boolean;
  // For multi-unit-type properties (e.g. Lucky Inn: 5 different unit
  // types at 5 different price points). Not auto-populated from GHL yet
  // — entered manually per property until a proper multi-unit CRM
  // structure exists. See project docs for the minimal vs. full version.
  unit_price_breakdown?: {
    type: string;
    price_min: number;
    price_max: number;
  }[];
}

function fmtPrice(min?: number | null, max?: number | null): string {
  const m = min || 0;
  const x = max || m;
  if (!m) return 'a price available on request';
  const f = (n: number) => `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)} million shillings`;
  return m === x ? f(m) : `from ${f(m)} to ${f(x)}`;
}

/**
 * Maps GHL's checkbox field slugs (e.g. "wellness_swimming_pool") to
 * natural spoken phrases. GHL's checkbox field has no real category
 * support — the slug prefix is the only thing preserving category
 * grouping, so this map is what turns the prefix back into something
 * that reads naturally out loud. Keep in sync with the actual checkbox
 * options configured in GHL's "Amenities" field.
 */
const AMENITY_LABELS: Record<string, string> = {
  security_247_manned: '24/7 security',
  security_cctv: 'CCTV surveillance',
  security_smart_access: 'smart access control',
  security_electric_fencing: 'electric fencing',
  security_intercom: 'an intercom system',
  security_panic_buttons: 'panic buttons',
  infra_backup_generator: 'a backup generator',
  infra_borehole: 'borehole water',
  infra_solar_water_heating: 'solar water heating',
  infra_highspeed_lifts: 'high-speed lifts',
  infra_fiber_ready: 'fiber-ready internet',
  infra_rainwater_harvesting: 'rainwater harvesting',
  wellness_gym: 'a fully equipped gym',
  wellness_swimming_pool: 'a swimming pool',
  wellness_kids_splash_pool: 'a kids\u2019 splash pool',
  wellness_spa: 'a spa',
  wellness_sauna: 'a sauna',
  wellness_steam_room: 'a steam room',
  wellness_yoga_studio: 'a yoga studio',
  wellness_tennis_padel: 'tennis and padel courts',
  lifestyle_concierge: 'arrival concierge',
  lifestyle_lounge: 'a residence lounge',
  lifestyle_clubhouse: 'a clubhouse',
  lifestyle_sky_garden: 'a sky recreation garden',
  lifestyle_landscaped_gardens: 'landscaped gardens',
  lifestyle_bbq_area: 'a BBQ area',
  lifestyle_cafe: 'a cafe',
  convenience_business_center: 'a business center',
  convenience_retail_area: 'a retail area',
  convenience_laundry: 'laundry services',
  convenience_parcel_lockers: 'smart parcel lockers',
  elite_ev_charging: 'EV charging stations',
  elite_smart_home: 'smart home integration',
  elite_acoustic_windows: 'acoustic windows',
  elite_driver_waiting_room: 'a driver waiting room',
  elite_private_storage: 'private storage',
  elite_wine_cellar: 'a wine cellar',
};

/**
 * Joins amenity slugs into a natural spoken phrase: "A, B, and C" rather
 * than a raw comma-dump. Caps at 8 items so the spoken line doesn't run
 * on — the full list still lives in the CRM/overlay text, just not every
 * single item narrated aloud. Guards against legacy records where this
 * field is still a plain string (old deleted text field) instead of an
 * array, so it never throws on old data.
 */
function buildAmenitiesPhrase(amenitiesField?: string[]): string {
  if (!amenitiesField || amenitiesField.length === 0) return '';
  const slugs = amenitiesField;

  const labels = slugs
    .map((slug) => AMENITY_LABELS[slug])
    .filter((label): label is string => Boolean(label))
    .slice(0, 8);

  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;

  const allButLast = labels.slice(0, -1).join(', ');
  const last = labels[labels.length - 1];
  return `${allButLast}, and ${last}`;
}

/**
 * Builds the closing line(s) for a variant's script, pulling in every
 * relevant real CRM field rather than just price — this is the fix for
 * the "generic script" complaint. Multi-unit pricing (unit_price_breakdown)
 * takes priority over a single price range when present.
 */
function buildCloser(property: PropertyData, variant: VariantType, price: string): string {
  const parts: string[] = [];

  if (property.unit_price_breakdown && property.unit_price_breakdown.length > 0) {
    const priceLines = property.unit_price_breakdown
      .map((u) => `${u.type} from ${u.price_min.toFixed(1)}M`)
      .join(', ');
    parts.push(`Units available: ${priceLines}.`);
  } else {
    parts.push(`Priced ${price}.`);
  }

  if (property.total_units) {
    parts.push(`${property.total_units} units total.`);
  }
  if (property.completion_time) {
    parts.push(`Completion: ${property.completion_time}.`);
  }
  if (property.show_house_ready) {
    parts.push(`Show house ready for viewing.`);
  }
  if (property.payment_plan_structure) {
    parts.push(`${property.payment_plan_structure}.`);
  }

  const amenitiesPhrase = buildAmenitiesPhrase(property.amenities);
  if (amenitiesPhrase) {
    parts.push(`With ${amenitiesPhrase}.`);
  }

  const ctaByVariant: Record<VariantType, string> = {
    Investment: 'Secure your unit today \u2014 message us now.',
    Lifestyle: 'Your new home is waiting \u2014 talk to us today.',
    Architectural: 'Enquire today.',
  };
  parts.push(ctaByVariant[variant]);

  return parts.join(' ');
}

/** Room-specific script lines, per variant tone. The {features} slot gets the
 *  vision model's detected details when available. */
const ROOM_LINES: Record<string, Record<VariantType, string>> = {
  kitchen: {
    Investment: 'A modern kitchen like this{features} is exactly what quality tenants look for.',
    Lifestyle: 'Your kitchen{features} \u2014 where every day starts and the best evenings end.',
    Architectural: 'The kitchen{features} \u2014 clean lines, functional flow, beautifully resolved.',
  },
  bedroom: {
    Investment: 'Spacious bedrooms{features} keep units rented and tenants staying longer.',
    Lifestyle: 'Your bedroom{features} \u2014 your calm, your retreat, your own space.',
    Architectural: 'Bedrooms{features} designed around light, proportion, and quiet.',
  },
  bathroom: {
    Investment: 'Premium bathroom finishes{features} that hold value and impress viewings.',
    Lifestyle: 'A bathroom{features} that feels like your own private spa.',
    Architectural: 'The bathroom{features} \u2014 precise detailing, quality materials throughout.',
  },
  'living room': {
    Investment: 'Open living spaces{features} \u2014 the feature every serious buyer asks about first.',
    Lifestyle: 'The living room{features} \u2014 made for slow Sundays and full-house gatherings.',
    Architectural: 'A living space{features} composed around light and openness.',
  },  'dining room': {
    Investment: 'A dedicated dining space{features} — the kind of detail serious buyers notice.',
    Lifestyle: 'Your dining room{features} — where every gathering happens.',
    Architectural: 'A dining space{features} composed with intention.',
  },  'swimming pool': {
    Investment: 'Resort-grade amenities like this pool lift both rental yield and resale value.',
    Lifestyle: 'Morning laps or weekend lounging \u2014 the pool is steps from your door.',
    Architectural: 'The pool area \u2014 a considered centerpiece of the development.',
  },
  gym: {
    Investment: 'An on-site gym \u2014 the amenity modern tenants now expect as standard.',
    Lifestyle: 'Your workout, downstairs. No commute, no excuses.',
    Architectural: 'A fully equipped gym, integrated into the design of the development.',
  },
  balcony: {
    Investment: 'Private balconies add real premium to both rent and resale.',
    Lifestyle: 'Your balcony \u2014 morning coffee with a view, evenings in the open air.',
    Architectural: 'Balconies that extend the living space outward, seamlessly.',
  },
  exterior: {
    Investment: 'First impressions matter \u2014 and this facade makes a strong one.',
    Lifestyle: 'Welcome home \u2014 this is what arriving feels like, every single day.',
    Architectural: 'The facade \u2014 bold, contemporary, and unmistakably intentional.',
  },
  garden: {
    Investment: 'Landscaped grounds \u2014 low maintenance, high perceived value.',
    Lifestyle: 'Green space right outside \u2014 room to breathe, play, and unwind.',
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

/**
 * Builds a director-style prompt for the Cinematic Avatar (Seedance) shot —
 * scene, action, camera, and mood, per HeyGen's own prompting guidance.
 * This REPLACES the script for this one scene (Cinematic Avatar has no
 * script/voice_id param) — the script text is still generated separately
 * via TTS in video-orchestrator, so narration content stays consistent
 * with the rest of the variant's tone even though the visual is generated
 * differently.
 */
function buildCinematicPrompt(roomType: string, propertyName: string): string {
  const roomDescriptions: Record<string, string> = {
    exterior: `the entrance of ${propertyName}`,
    'living room': 'a bright, modern living room',
    kitchen: 'a modern kitchen',
    bedroom: 'a spacious bedroom',
    'swimming pool': 'a poolside area',
  };
  const setting = roomDescriptions[roomType] || `a space inside ${propertyName}`;

  return (
    `The presenter walks slowly into ${setting}, gesturing naturally toward the space. ` +
    `Tracking shot from the side, medium distance, documentary style, warm natural lighting, photorealistic.`
  );
}

export async function buildScenePlan(
  property: PropertyData,
  photoUrls: string[],
  variant: VariantType,
): Promise<ScenePlan[]> {
  const name = property.property_name || 'this property';
  const location = property.specific_location || 'Nairobi';
  const price = fmtPrice(property.price_min ?? property.price, property.price_max ?? property.price);

  const photos = photoUrls.slice(0, 10); // cap to avoid runaway ad length

  console.log(`[ScenePlanner] Analyzing ${photos.length} photos with vision model...`);
  const analyses: PhotoAnalysis[] = await analyzeAllPhotos(photos);

  const openers: Record<VariantType, string> = {
    Investment: `Welcome to ${name} in ${location} \u2014 a serious investment opportunity.`,
    Lifestyle: `Welcome to ${name}, right here in ${location}.`,
    Architectural: `${name}, ${location} \u2014 where design leads.`,
  };

  // Closer is now built once per variant via buildCloser(), pulling in
  // real CRM fields (units, completion, payment plan, amenities) instead
  // of just price. See buildCloser's header comment.
  const closerText = buildCloser(property, variant, price);

  return photos.map((photoUrl, i) => {
    const analysis = analyses[i];
    const roomLines = ROOM_LINES[analysis.roomType] || ROOM_LINES.other;
    const featureText = analysis.features.length ? ` with ${analysis.features.slice(0, 2).join(' and ')}` : '';
    let script = roomLines[variant].replace('{features}', featureText);

    // First scene gets the opener prepended; last scene gets the full
    // closer (price, units, completion, payment plan, amenities, CTA)
    // appended.
    if (i === 0) script = `${openers[variant]} ${script}`;
    if (i === photos.length - 1) script = `${script} ${closerText}`;

    const runwayPrompt = MOTION_BY_ROOM[analysis.roomType] || MOTION_BY_ROOM.default;

    // Deliberately only the opening scene is cinematic — see file header
    // comment on cost. Orchestrator still checks USE_CINEMATIC_AVATAR
    // before actually acting on this flag, so this stays inert until
    // that's turned on.
    const isCinematic = i === 0;
    const cinematicPrompt = isCinematic ? buildCinematicPrompt(analysis.roomType, name) : undefined;

    console.log(`[ScenePlanner] Scene ${i + 1}: detected "${analysis.roomType}" \u2192 matched script generated.${isCinematic ? ' (cinematic opener)' : ''}`);

    return { photoUrl, runwayPrompt, script, isCinematic, cinematicPrompt };
  });
}