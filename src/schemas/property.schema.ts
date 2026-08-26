// src/schemas/property.schema.ts
import { z } from 'zod';

export const propertyStatusValues = ['available', 'reserved', 'sold', 'off_market'] as const;

// The client's approved focus areas -- also the exact set the public
// website (chestoneproperties.com) filters listings down to. Enforced
// here (not just on the public site) so a typo or an out-of-area entry
// can no longer be saved in the first place, rather than silently
// vanishing from the public site later with no warning to whoever
// entered it. Matches the amenities list's pattern: a fixed list at the
// API boundary, not a Postgres enum column, so adding an area later is a
// one-line change here instead of a migration.
export const propertyAreaValues = [
  'Kilimani, Nairobi',
  'Kileleshwa, Nairobi',
  'Westlands, Nairobi',
  'Lavington, Nairobi',
  'Karen, Nairobi',
  'Riverside, Nairobi',
] as const;

// Fixed amenity checklist (client-provided list, 37 items). Enforced at the
// API boundary via zod rather than as a Postgres enum column, so adding a
// new amenity later is a one-line change here instead of a migration --
// the DB column stays a plain text[].
export const propertyAmenityValues = [
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
] as const;

export const createPropertySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  location: z.enum(propertyAreaValues).optional(),
  price: z.number().nonnegative().optional(),
  currency: z.string().length(3).optional(),
  status: z.enum(propertyStatusValues).optional(),
  assignedAgentId: z.string().uuid().optional(),

  // CRM Handoff (CRM.pdf) field set, replacing GoHighLevel's property object.
  referenceId: z.string().optional(),
  priceMin: z.number().nonnegative().optional(),
  priceMax: z.number().nonnegative().optional(),
  unitType: z.string().optional(),
  totalUnits: z.number().int().nonnegative().optional(),
  developerContactName: z.string().optional(),
  developerEmail: z.string().email().optional(),
  developerPhone: z.string().optional(),
  completionTime: z.string().optional(),
  levelFloors: z.number().int().nonnegative().optional(),
  view: z.string().optional(),
  paymentPlanStructure: z.string().optional(),
  houseSizeSqft: z.number().nonnegative().optional(),
  houseSizeSqftMin: z.number().nonnegative().optional(),
  houseSizeSqftMax: z.number().nonnegative().optional(),
  developmentName: z.string().optional(),
  amenities: z.array(z.enum(propertyAmenityValues)).optional(),
  subLocation: z.string().optional(),
  images: z.array(z.string().url()).optional(), // any number, from any CDN (Cloudinary or otherwise)
  videos: z.array(z.string().url()).optional(), // any number, from any CDN (Cloudinary or otherwise)
});

export const updatePropertySchema = createPropertySchema.partial();

export const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export type CreatePropertyPayload = z.infer<typeof createPropertySchema>;
export type UpdatePropertyPayload = z.infer<typeof updatePropertySchema>;
