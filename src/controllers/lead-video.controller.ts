// src/controllers/lead-video.controller.ts
//
// Called by Make.com the moment a new ad lead comes in from GHL. Given
// whatever location the lead showed interest in, finds the matching
// property's video and returns it — so Make.com can immediately send it
// back to the lead as an instant follow-up.
//
// DESIGN: one dynamic endpoint instead of one hardcoded Make.com Router
// path per property. Make.com passes whatever location text came in on
// the lead; this endpoint does the matching. A new property added in GHL
// becomes automatically routable — no Make.com scenario edit required.
//
// Wire up in your routes file:
//   import { handleLeadVideoLookup } from '../controllers/lead-video.controller';
//   router.get('/lead-video', handleLeadVideoLookup);

import { Request, Response } from 'express';
import { supabase } from '../services/supabase.service';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

type VariantName = 'Investment' | 'Lifestyle' | 'Architectural';

const VALID_VARIANTS: readonly VariantName[] = ['Investment', 'Lifestyle', 'Architectural'];

function isValidVariant(value: string): value is VariantName {
  return (VALID_VARIANTS as readonly string[]).includes(value);
}

interface PropertyRow {
  id: number;
  property_name: string;
  property_unique_id: string;
  specific_location: string | null;
}

interface VariantRow {
  video_url: string | null;
  variant: VariantName;
}

interface LeadVideoSuccessResponse {
  success: true;
  property_name: string;
  location: string | null;
  variant: VariantName;
  video_url: string;
  matched_by: 'property_id' | 'location' | 'fallback_most_recent';
}

interface LeadVideoErrorResponse {
  success: false;
  error: string;
}

const DEFAULT_VARIANT: VariantName = 'Investment';

// ─────────────────────────────────────────────────────────────────────────
// Data access helpers — isolated so the controller body stays readable
// ─────────────────────────────────────────────────────────────────────────

/** Finds the most recently completed property whose location text contains
 *  the given search string (case-insensitive substring match). */
async function findPropertyByLocation(location: string): Promise<PropertyRow | null> {
  const { data, error } = await supabase
    .from('chestone_properties')
    .select('id, property_name, property_unique_id, specific_location')
    .eq('status', 'COMPLETED')
    .ilike('specific_location', `%${location}%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Lead Video Lookup] findPropertyByLocation query failed:', error.message);
    return null;
  }
  return data as PropertyRow | null;
}

/** Fallback when no location match exists: most recently completed
 *  property overall, so a lead never gets nothing. Satisfies the "Path 3"
 *  fallback requirement without needing a separate hardcoded Make.com path. */
async function findMostRecentCompletedProperty(): Promise<PropertyRow | null> {
  const { data, error } = await supabase
    .from('chestone_properties')
    .select('id, property_name, property_unique_id, specific_location')
    .eq('status', 'COMPLETED')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Lead Video Lookup] findMostRecentCompletedProperty query failed:', error.message);
    return null;
  }
  return data as PropertyRow | null;
}

/** Fetches a specific completed variant for a property. Returns null
 *  (not an error) if that exact variant isn't ready — caller decides
 *  whether to fall back to any completed variant. */
async function findCompletedVariant(propertyId: number, variant: VariantName): Promise<VariantRow | null> {
  const { data, error } = await supabase
    .from('property_video_variants')
    .select('video_url, variant')
    .eq('property_id', propertyId)
    .eq('status', 'COMPLETED')
    .eq('variant', variant)
    .maybeSingle();

  if (error) {
    console.error('[Lead Video Lookup] findCompletedVariant query failed:', error.message);
    return null;
  }
  return data as VariantRow | null;
}

/** Any completed variant for a property, regardless of which one — used
 *  when the specifically requested variant isn't ready yet. */
async function findAnyCompletedVariant(propertyId: number): Promise<VariantRow | null> {
  const { data, error } = await supabase
    .from('property_video_variants')
    .select('video_url, variant')
    .eq('property_id', propertyId)
    .eq('status', 'COMPLETED')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[Lead Video Lookup] findAnyCompletedVariant query failed:', error.message);
    return null;
  }
  return data as VariantRow | null;
}

/** Exact match on property_unique_id — the reliable path, used when the
 *  WhatsApp CTA embedded the property reference in the pre-filled message.
 *  Preferred over fuzzy location text whenever available. */
async function findPropertyById(propertyUniqueId: string): Promise<PropertyRow | null> {
  const { data, error } = await supabase
    .from('chestone_properties')
    .select('id, property_name, property_unique_id, specific_location')
    .eq('status', 'COMPLETED')
    .eq('property_unique_id', propertyUniqueId)
    .maybeSingle();

  if (error) {
    console.error('[Lead Video Lookup] findPropertyById query failed:', error.message);
    return null;
  }
  return data as PropertyRow | null;
}

// ─────────────────────────────────────────────────────────────────────────
// Controller
// ─────────────────────────────────────────────────────────────────────────

export const handleLeadVideoLookup = async (
  req: Request,
  res: Response<LeadVideoSuccessResponse | LeadVideoErrorResponse>,
): Promise<void> => {
  try {
    const rawPropertyId = req.query.property_id;
    const rawLocation = req.query.location;
    const rawVariant = req.query.variant;

    const propertyId: string = typeof rawPropertyId === 'string' ? rawPropertyId.trim() : '';
    const location: string = typeof rawLocation === 'string' ? rawLocation.trim() : '';
    const requestedVariant: VariantName =
      typeof rawVariant === 'string' && isValidVariant(rawVariant) ? rawVariant : DEFAULT_VARIANT;

    let property: PropertyRow | null = null;
    let matchedBy: 'property_id' | 'location' | 'fallback_most_recent' = 'fallback_most_recent';

    // Exact ID match first — this is the reliable path once the WhatsApp
    // pre-filled message embeds the property reference (Step 1-3 of the
    // upgrade). Fuzzy location text stays as a fallback for leads that
    // came in before this was wired up, or through any other channel.
    if (propertyId.length > 0) {
      property = await findPropertyById(propertyId);
      if (property) matchedBy = 'property_id';
    }

    if (!property && location.length > 0) {
      property = await findPropertyByLocation(location);
      if (property) matchedBy = 'location';
    }

    if (!property) {
      console.warn(`[Lead Video Lookup] No match for property_id="${propertyId}" location="${location}" — using fallback property.`);
      property = await findMostRecentCompletedProperty();
    }

    if (!property) {
      res.status(404).json({ success: false, error: 'No completed properties available yet.' });
      return;
    }

    let variantRow = await findCompletedVariant(property.id, requestedVariant);

    if (!variantRow) {
      variantRow = await findAnyCompletedVariant(property.id);
    }

    if (!variantRow || !variantRow.video_url) {
      res.status(404).json({
        success: false,
        error: `Property "${property.property_name}" has no completed videos yet.`,
      });
      return;
    }

    console.log(
      `[Lead Video Lookup] location="${location}" → ${property.property_name} ` +
      `(${variantRow.variant}, matched_by=${matchedBy})`
    );

    res.status(200).json({
      success: true,
      property_name: property.property_name,
      location: property.specific_location,
      variant: variantRow.variant,
      video_url: variantRow.video_url,
      matched_by: matchedBy,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Lead Video Lookup] Unhandled failure:', message);
    res.status(500).json({ success: false, error: message });
  }
};