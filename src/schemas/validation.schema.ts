// src/schemas/validation.schema.ts
import { z } from 'zod';

/**
 * Calculates the urgency factor based on the ready_to_move_date.
 * Returns "high" if the date is within 3 months of today, otherwise "low".
 * @param dateString - The raw date string from the CRM payload
 * @returns "high" | "low"
 */
const calculateUrgencyFactor = (dateString?: string | null): 'high' | 'low' => {
  if (!dateString) return 'low';

  const readyDate = new Date(dateString);
  if (isNaN(readyDate.getTime())) return 'low';

  const today = new Date();
  const threeMonthsFromNow = new Date(today.setMonth(today.getMonth() + 3));

  return readyDate < threeMonthsFromNow ? 'high' : 'low';
};

/**
 * Zod Schema, Gatekeeper for GHL (GoHighLevel) CRM Webhooks
 * Validates types, injects exhaustive fallbacks, and formats data for Supabase PostgreSQL insertion.
 */
export const propertyIngestionSchema = z
  .object({
    property_unique_id: z.string().min(1, 'Property ID is strictly required for mapping'),
    price: z.number().nullable().optional(),
    specific_location: z.string().nullable().optional(),
    house_size_sqft: z.number().positive().nullable().optional(),
    house_size_beds: z.number().int().nonnegative().nullable().optional(),

    // Loosely parse the date string to account for varying CRM formats before standardizing
    ready_to_move_date: z
      .string()
      .refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date format' })
      .nullable()
      .optional(),

    payment_plan_structure: z.string().nullable().optional(),
    mortgage_allowed: z.boolean().nullable().optional(),
    amenities_list: z.array(z.string()).nullable().optional(),
    mall_1_dist: z.string().nullable().optional(),
    hospital_dist: z.string().nullable().optional(),
    security_features: z.string().nullable().optional(),

    // Explicitly define the image array so Zod doesn't strip it during parsing.
    // Feeds the Stage 4 Ken-Burns photo-stitch step in ffmpeg.service.ts.
    listing_photos: z.array(z.string().url()).nullable().optional(),
  })
  .transform((data) => {
    // Calculate Urgency Factor
    const urgency_factor = calculateUrgencyFactor(data.ready_to_move_date);

    // Resolve Price Logic (Supabase requires NUMERIC NOT NULL)
    const isPriceMissing = data.price === null || data.price === undefined;
    const dbPrice = isPriceMissing ? 0 : data.price!;
    const displayPrice = isPriceMissing
      ? 'Contact us for pricing'
      : `$${dbPrice.toLocaleString('en-US')}`;

    // Apply Exhaustive Fallback Dictionary
    return {
      // Database Core Fields (Aligns exactly with Supabase PostgreSQL schema)
      property_unique_id: data.property_unique_id,
      price: dbPrice,
      specific_location: data.specific_location || 'Location unverified',
      house_size_sqft: data.house_size_sqft ?? null,
      house_size_beds: data.house_size_beds ?? null,

      // Standardize the date to ISO string for PostgreSQL compatibility
      ready_to_move_date: data.ready_to_move_date
        ? new Date(data.ready_to_move_date).toISOString()
        : null,

      payment_plan_structure: data.payment_plan_structure || 'Standard payment terms apply',

      // Supabase requires BOOLEAN NOT NULL
      mortgage_allowed: data.mortgage_allowed ?? false,

      amenities_list: data.amenities_list && data.amenities_list.length > 0
        ? data.amenities_list
        : ['Standard amenities included'],

      mall_1_dist: data.mall_1_dist || 'Distance to mall not specified',
      hospital_dist: data.hospital_dist || 'Distance to nearest hospital not specified',
      security_features: data.security_features || 'Standard security protocol',

      // Pass listing photos through for the FFmpeg stitching stage, falling back to an empty array
      listing_photos: data.listing_photos || [],

      // Pipeline Meta-Data (Passed to HeyGen & WhatsApp services)
      display_price: displayPrice,
      urgency_factor,
    };
  });

/**
 * Exported Types for strict type-safety across controllers and services
 */
export type RawIngestionPayload = z.input<typeof propertyIngestionSchema>;
export type ValidatedChestonePayload = z.output<typeof propertyIngestionSchema>;

/**
 * Utility function to handle standard Zod error mapping for the Express Controller
 * @param error - The ZodError object
 * @returns A formatted object mapping fields to their validation error messages
 */
export const formatZodError = (error: z.ZodError) => {
  return error.issues.reduce((acc, issue) => {
    const path = issue.path.join('.');
    acc[path] = issue.message;
    return acc;
  }, {} as Record<string, string>);
};