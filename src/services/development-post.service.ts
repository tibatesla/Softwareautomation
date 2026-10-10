// src/services/development-post.service.ts
//
// Builds the rich social-post caption for a property or development group
// -- unit-by-unit price breakdown, aggregated amenities, an AI-written
// "Why Invest" pitch, and contact details. Separate from
// social-publishing.service.ts on purpose: that file owns the raw Graph
// API mechanics (posting, carousels, auth), this one owns the content.
import { generateChatCompletion } from './ai-provider.service';

const CONTACT_PHONE = '+254 726 111133';
const CONTACT_EMAIL = 'info@chestoneproperties.com';
const PUBLIC_SITE_URL = process.env.PUBLIC_SITE_URL || 'https://chestoneproperties.com';

// Fixed priority order amenities are listed/capped in -- a rough
// security/utility/lifestyle/tech ordering. No longer paired with emoji
// (the client asked for plain hyphen bullets instead), so this is just the
// ranking list now, not a display lookup.
const AMENITY_ORDER: string[] = [
  '24/7 Manned Security',
  'CCTV Surveillance',
  'Smart Access',
  'Electric Fencing',
  'Intercom',
  'Panic Buttons',
  'Backup Generator',
  'Borehole',
  'Solar Water Heating',
  'High-Speed Lifts',
  'Fiber-Ready',
  'Rainwater Harvesting',
  'Fully Equipped Gym',
  'Swimming Pool',
  "Kids' Splash Pool",
  'Spa',
  'Sauna',
  'Steam Room',
  'Yoga Studio',
  'Tennis/Padel Courts',
  'Arrival Concierge',
  'Residence Lounge',
  'Clubhouse',
  'Sky Recreation Garden',
  'Landscaped Gardens',
  'BBQ Area',
  'Cafe',
  'Business Center',
  'Retail Area',
  'Laundry Services',
  'Smart Parcel Lockers',
  'EV Charging',
  'Smart Home Integration',
  'Acoustic Windows',
  'Driver Waiting Room',
  'Private Storage',
  'Wine Cellar',
];

// Instagram hard-caps captions at 2,200 characters (Facebook's limit is far
// looser). A development with many units and a fully-populated amenities
// list can blow past that easily, so the amenities section -- the one
// unbounded part of the caption -- gets capped, in this fixed order (a
// rough security/utility/lifestyle/tech priority), rather than posting a
// caption Instagram will just reject.
const MAX_AMENITIES_SHOWN = 8;
const INSTAGRAM_CAPTION_LIMIT = 2200;

const FALLBACK_WHY_INVEST = [
  'Prime Location – High rental demand and strong value appreciation.',
  'Lifestyle Upgrade – Premium amenities for modern living.',
  'Flexible Payment Options – Secure your investment with ease.',
];

const FALLBACK_DESCRIPTION =
  'Discover refined living in one of Nairobi\'s most sought-after neighborhoods, where thoughtful architecture meets premium amenities for an elevated lifestyle and strong investment potential.';

export interface ListingForPost {
  id: string;
  title: string;
  unitType: string | null;
  location: string | null;
  subLocation: string | null;
  price: number;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  houseSizeSqft: number | null;
  houseSizeSqftMin: number | null;
  houseSizeSqftMax: number | null;
  amenities: string[];
  outstandingAmenities: string[];
  imageUrl: string | null;
}

const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Matches from the start of the actual unit-type wording onward -- "Studio",
// "Penthouse", or an "N Bedroom..." phrase (keeping whatever follows it,
// e.g. "+ Study", "Duplex", "Luxury").
const UNIT_TYPE_PATTERN = /(studio|penthouse|\d+\s*bedroom.*)/i;

/** Picks the per-unit label shown in the caption -- the client doesn't
 * want any building/residency name in the post, only a plain unit
 * description like "1 Bedroom+ Study". The CRM's own `unitType` field
 * (e.g. "1 Bedroom+ Study") is exactly that, purpose-built and clean, so
 * it's used whenever set. `title` is only a fallback for older records
 * that predate that field being filled in -- titles don't reliably start
 * with the CRM's own `developmentName` either (a data-entry quirk:
 * developmentName "Ravi Homes" but titles reading "Luster Arbor
 * Residency-..."), so this looks for where recognizable unit-type wording
 * starts in the title rather than trying to strip a known prefix. */
const unitLabel = (title: string, unitType: string | null, developmentName: string | null): string => {
  if (unitType?.trim()) return unitType.trim();
  const match = title.match(UNIT_TYPE_PATTERN);
  if (match) return match[0].trim();
  if (!developmentName) return title;
  const stripped = title.replace(new RegExp(`^\\s*${escapeRegex(developmentName)}\\s*[-–]?\\s*`, 'i'), '').trim();
  return stripped || title;
};

const formatPrice = (p: ListingForPost): string => {
  const fmt = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: p.currency, notation: 'compact', maximumFractionDigits: 1 }).format(n);
  if (p.priceMin && p.priceMax) return `${fmt(p.priceMin)} – ${fmt(p.priceMax)}`;
  if (p.price > 0) return fmt(p.price);
  if (p.priceMin) return fmt(p.priceMin);
  if (p.priceMax) return fmt(p.priceMax);
  return 'Price on request';
};

const formatSize = (p: ListingForPost): string | null => {
  if (p.houseSizeSqftMin && p.houseSizeSqftMax) return `${p.houseSizeSqftMin}–${p.houseSizeSqftMax} sqm`;
  if (p.houseSizeSqft) return `${p.houseSizeSqft} sqm`;
  return null;
};

/**
 * Never throws -- an AI outage or malformed response degrades to a fixed
 * generic pitch rather than blocking the whole post, same non-fatal
 * philosophy as the rest of this codebase's AI-assisted features.
 */
const generateWhyInvest = async (location: string, amenities: string[]): Promise<string[]> => {
  try {
    const raw = await generateChatCompletion({
      systemPrompt:
        'You write short, punchy real estate marketing bullet points for a Kenyan property developer\'s Facebook/Instagram post. Given a location and amenities, write exactly 3 bullet points in the format "Label – one short sentence reason" (each under 100 characters), covering location value, lifestyle appeal, and investment potential. Do not invent or mention any building, development, or project name -- refer only to the location and amenities given. Respond with ONLY the 3 lines, one per line, no numbering, no extra commentary.',
      userMessage: `Location: ${location || 'Nairobi'}\nAmenities: ${amenities.join(', ') || 'premium amenities'}`,
      temperature: 0.6,
      maxTokens: 400,
    });
    const lines = raw
      .split('\n')
      .map((l) => l.replace(/^[-*•\d.]+\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 3);
    return lines.length > 0 ? lines : FALLBACK_WHY_INVEST;
  } catch (error) {
    console.error('[Development Post] Why-invest generation failed, using fallback:', error);
    return FALLBACK_WHY_INVEST;
  }
};

/**
 * Short scene-setting intro paragraph -- the client wanted something like
 * the AI-written "About This Property" text on the website (fine living,
 * investment appeal, amenities, architecture) but shorter and written to
 * hook a scrolling social feed, sitting above the Unit Types & Prices list
 * rather than replacing the more tactical "Why Invest" bullets below it.
 * Never throws, same non-fatal fallback pattern as generateWhyInvest.
 */
const generateDescription = async (location: string, amenities: string[]): Promise<string> => {
  try {
    const raw = await generateChatCompletion({
      systemPrompt:
        'You write a short, warm marketing description (2-3 sentences, well under 400 characters) opening a Kenyan property developer\'s Facebook/Instagram post. Touch on fine living, investment appeal, amenities, and architecture in one flowing paragraph, fully optimised for conversions. Do not invent or mention any building, development, or project name -- refer only to the location and amenities given. Respond with ONLY the paragraph, no headers, no bullet points, no quotation marks.',
      userMessage: `Location: ${location || 'Nairobi'}\nAmenities: ${amenities.join(', ') || 'premium amenities'}`,
      temperature: 0.7,
      maxTokens: 300,
    });
    const text = raw.trim();
    return text.length > 0 ? text : FALLBACK_DESCRIPTION;
  } catch (error) {
    console.error('[Development Post] Description generation failed, using fallback:', error);
    return FALLBACK_DESCRIPTION;
  }
};

/**
 * Builds the full caption for one or more listings sharing a development
 * (or a single standalone property, passed as a one-item array). Every
 * unit in `listings` gets its own price/size line regardless of whether it
 * has a photo yet -- the photo carousel is a separate, stricter selection
 * (see social-publishing.service.ts), this text list is meant to be
 * complete.
 */
export const buildDevelopmentCaption = async (listings: ListingForPost[], developmentName: string | null): Promise<string> => {
  const first = listings[0];
  // location and subLocation frequently overlap in the CRM data (e.g.
  // location "Westlands, Nairobi", subLocation "Westlands") -- joining both
  // unconditionally produced captions like "WESTLANDS, NAIROBI, WESTLANDS".
  const loc = first.location?.trim() || null;
  const sub = first.subLocation?.trim() || null;
  const location =
    loc && sub
      ? loc.toLowerCase().includes(sub.toLowerCase())
        ? loc
        : sub.toLowerCase().includes(loc.toLowerCase())
          ? sub
          : `${sub}, ${loc}`
      : loc || sub || 'Nairobi, Kenya';

  const sorted = [...listings].sort((a, b) => {
    const priceOf = (p: ListingForPost) => (p.price > 0 ? p.price : (p.priceMin ?? p.priceMax ?? Number.MAX_SAFE_INTEGER));
    return priceOf(a) - priceOf(b);
  });

  // Outstanding amenities sort first, so they survive the length-cap below
  // even on a development with many amenities. Within each group, known
  // presets keep their curated AMENITY_ORDER; free-text/custom entries
  // (not in that list) fall to the end of their group rather than jumping
  // to the front, which `indexOf` returning -1 would otherwise do.
  const outstandingSet = new Set(listings.flatMap((p) => p.outstandingAmenities));
  const amenityRank = AMENITY_ORDER;
  const rankOf = (a: string) => {
    const i = amenityRank.indexOf(a);
    return i === -1 ? amenityRank.length : i;
  };
  const allAmenities = [...new Set(listings.flatMap((p) => p.amenities))].sort((a, b) => {
    const outDiff = Number(outstandingSet.has(b)) - Number(outstandingSet.has(a));
    return outDiff !== 0 ? outDiff : rankOf(a) - rankOf(b);
  });
  const [description, whyInvest] = await Promise.all([
    generateDescription(location, allAmenities),
    generateWhyInvest(location, allAmenities),
  ]);

  // The client doesn't want the building/development name itself mentioned
  // in the post -- location and unit details only -- so the enquiry link
  // stays generic rather than carrying the development name as visible
  // query-string text in the caption. Single-property posts still link
  // straight to that listing (a UUID in the URL, not a name).
  const footer = [
    '',
    `- ${CONTACT_PHONE}`,
    `- ${CONTACT_EMAIL}`,
    developmentName
      ? `- View more & enquire: ${PUBLIC_SITE_URL}/properties`
      : `- View more & enquire: ${PUBLIC_SITE_URL}/properties/${first.id}`,
  ];

  // Rebuilds with progressively fewer amenities shown until the caption
  // clears Instagram's cap -- the amenities list is the only section with
  // unbounded length, so it's the one that gives when a development has a
  // lot of units and a fully-populated amenity list (confirmed necessary:
  // a 5-unit development with ~30 amenities alone ran ~2,700 characters).
  const assemble = (amenitiesLimit: number): string => {
    const lines: string[] = [];
    lines.push(location.toUpperCase());
    lines.push('');
    lines.push(description);
    lines.push('');
    lines.push('Unit Types & Prices');
    lines.push('');
    for (const p of sorted) {
      const label = unitLabel(p.title, p.unitType, developmentName);
      const size = formatSize(p);
      lines.push(`- ${label}${size ? ` – ${size}` : ''} – ${formatPrice(p)}`);
    }

    if (allAmenities.length > 0) {
      lines.push('');
      lines.push('Amenities & Lifestyle');
      const shown = allAmenities.slice(0, amenitiesLimit);
      for (const a of shown) {
        const label = outstandingSet.has(a) ? `${a} (Outstanding)` : a;
        lines.push(`- ${label}`);
      }
      const remaining = allAmenities.length - shown.length;
      if (remaining > 0) lines.push(`+ ${remaining} more`);
    }

    lines.push('');
    lines.push(`Why Invest in ${location}?`);
    lines.push(...whyInvest.map((line) => `- ${line}`));
    lines.push(...footer);
    return lines.join('\n');
  };

  let caption = assemble(MAX_AMENITIES_SHOWN);
  if (caption.length > INSTAGRAM_CAPTION_LIMIT) caption = assemble(4);
  if (caption.length > INSTAGRAM_CAPTION_LIMIT) caption = assemble(0);
  if (caption.length > INSTAGRAM_CAPTION_LIMIT) {
    console.error(`[Development Post] Caption for "${developmentName ?? first.title}" still over Instagram's limit at ${caption.length} chars even with amenities dropped -- truncating.`);
    caption = `${caption.slice(0, INSTAGRAM_CAPTION_LIMIT - 1)}…`;
  }
  return caption;
};
